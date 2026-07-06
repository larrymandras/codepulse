---
phase: 93-eval-pipeline-quality-kpis
reviewed: 2026-07-06T14:30:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - convex/schema.ts
  - convex/evalScores.ts
  - convex/evalScores.test.ts
  - convex/runtimeIngest.ts
  - convex/runtimeIngest.test.ts
  - convex/profiles.ts
  - convex/briefings.ts
  - convex/crons.ts
  - convex/_generated/api.d.ts
  - src/App.tsx
  - src/components/QualityTrendChart.tsx
  - src/components/StatusBadge.tsx
  - src/hooks/useEvalScores.ts
  - src/layouts/DashboardLayout.tsx
  - src/pages/Quality.test.tsx
  - src/pages/Quality.tsx
  - src/pages/QualityDetail.tsx
  - C:/Users/mandr/astridr-repo/astridr/agent/loop.py
  - C:/Users/mandr/astridr-repo/astridr/agent/post_turn_pipeline.py
  - C:/Users/mandr/astridr-repo/astridr/agent/self_improvement.py
  - C:/Users/mandr/astridr-repo/astridr/channels/agent_processor.py
  - C:/Users/mandr/astridr-repo/astridr/channels/web.py
  - C:/Users/mandr/astridr-repo/astridr/engine/bootstrap/core.py
  - C:/Users/mandr/astridr-repo/astridr/integrations/langfuse_eval.py
  - C:/Users/mandr/astridr-repo/config/self-improvement.yaml
  - C:/Users/mandr/astridr-repo/tests/test_langfuse_eval.py
  - C:/Users/mandr/astridr-repo/tests/test_self_improvement.py
  - C:/Users/mandr/astridr-repo/tests/test_web_auth.py
findings:
  critical: 3
  warning: 8
  info: 2
  total: 13
status: issues_found
---

# Phase 93: Code Review Report

**Reviewed:** 2026-07-06T14:30:00Z
**Depth:** standard
**Files Reviewed:** 28 (17 CodePulse + 11 Ástríðr cross-repo)
**Status:** issues_found

## Summary

Reviewed the full eval pipeline: task_quality ingest (EVAL-01), nightly LLM-judge machinery (EVAL-02), KPI queries + regression detector (EVAL-03), the Quality/QualityDetail UI, and the Ástríðr producer/mirror side including the new cookie-session web auth (674a13c4).

The overall structure is strong — idempotent inserts, zod-validated judge output, `Promise.allSettled` batch isolation, and the web.py cookie auth is genuinely well built (constant-time key compare, hashed server-side tokens, HttpOnly/SameSite=Strict, rate-limited login, the profile-route auth bypass closed, XSS-safe `textContent` rendering, 14 solid middleware-level tests). I found **no exploitable defect in the new auth surface**.

However, three Critical defects exist in the eval pipeline itself: the nightly judge's day window is wrong (most sessions are never judged), the regression-alert dedup deterministically re-fires the same alert nightly after an operator acknowledges/resolves it, and the OpenAI judge branch's strict JSON schema is invalid (hard 400 whenever provider=openai). Several Warnings concern data-semantics drift between the two repos (first-turn-wins mirror dedup, dead persona fallback, task_quality/judge score blending) and UI window mislabeling.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Nightly judge only ever sees sessions completed between 00:00 and 05:00 UTC — the rest of each day is permanently skipped

**File:** `convex/evalScores.ts:732`, `convex/crons.ts:137-141`, `convex/evalScores.ts:670-681`
**Issue:** The cron fires at 05:00 UTC (`crons.ts:139: { hourUTC: 5, minuteUTC: 0 }`), but the action computes the **current** UTC day:

```ts
const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400;   // evalScores.ts:732
```

and `getCandidateSessionsInternal` selects `lastEventAt` in `[dayStart, dayStart + 86400)` (evalScores.ts:671, 676-680). At 05:00 UTC on day D, that window is day D — of which only the first 5 hours exist. Sessions completing after 05:00 UTC on day D fall in day D's window, but day D's run has already happened, and the next run (D+1, 05:00) queries day D+1. So every session completing between 05:00 and 24:00 UTC (~midnight–8 p.m. ET, i.e. the entire working day) is **never sampled or judged**. The Quality page will systematically show only late-evening sessions.
**Fix:**
```ts
// Judge the PREVIOUS complete UTC day — the run at 05:00 rides after it closes.
const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
```
(The `judge:${sessionId}` idempotency key already protects against any overlap double-judging.)

### CR-02: Regression alert re-fires every night after acknowledge/resolve — dedup is keyed to a mutable `status`

**File:** `convex/evalScores.ts:1092-1103, 1201-1205, 782`; `convex/alertLifecycle.ts:15, 29`
**Issue:** `detectRegressionsForPersona` dedups only on an alert with `status === "active"`:

```ts
.filter((q) => q.eq(q.field("status"), "active"))   // evalScores.ts:1100
```

But the UI lifecycle mutations flip status: `alertLifecycle.ts:15` (`status: "acknowledged"`) and `alertLifecycle.ts:29` (`status: "resolved"`). The regression evaluation inputs are **immutable history** — a fixed change event within the 30-day lookback (`CHANGE_EVENT_LOOKBACK_SECONDS`, evalScores.ts:782) and fixed ±7-day score windows — so once the operator acknowledges or resolves the alert, the very next nightly run re-evaluates the same event, gets the same `fire: true`, inserts an identical alert, and schedules another webhook delivery (evalScores.ts:1241-1261). This repeats every night until the change event ages past 30 days. It directly contradicts the module's own invariant comment ("the existing-alert dedup guard already blocks re-scanning once a regression is open", evalScores.ts:1190-1192) and the phase's zero-false-positive bar (T-93-10). Inverse edge: if the operator never touches the alert, `acknowledge`/`autoAcknowledgeStaleInternal` (alerts.ts:42-53, 147-170) set `acknowledged` but leave `status: "active"`, so the stale alert blocks detection of any *new* regression for that persona indefinitely.
**Fix:** Dedup on the event, not on alert lifecycle — e.g. check for **any** prior alert (regardless of status) whose `details.changeDate === event.timestamp` for that `eval-regression:${profileId}` source before firing:
```ts
const prior = await ctx.db.query("alerts")
  .withIndex("by_source", (q) => q.eq("source", `eval-regression:${profileId}`))
  .collect();
if (prior.some((a) => a.details?.changeDate === event.timestamp)) continue;
```

### CR-03: OpenAI judge branch sends an invalid strict JSON schema — hard 400 on every call when provider=openai

**File:** `convex/evalScores.ts:271-296, 393-400`
**Issue:** `callOpenAIJudge` passes `JUDGE_TOOL.input_schema` verbatim as a strict structured-output schema:

```ts
response_format: {
  type: "json_schema",
  json_schema: { name: JUDGE_TOOL_NAME, strict: true, schema: JUDGE_TOOL.input_schema },
}
```

OpenAI strict mode **requires** `"additionalProperties": false` on every object schema; `JUDGE_TOOL.input_schema` (evalScores.ts:271-295) omits it, so the API rejects the request with a 400 (`'additionalProperties' is required to be supplied and to be false`). The retry loop resends the same schema, so all 3 attempts fail deterministically — the entire OpenAI judge path is non-functional whenever `intelligence.llm_eval.provider = "openai"` is configured (a value `setLLMConfig` explicitly permits, briefings.ts:249-253). The comment at evalScores.ts:262-263 ("reused verbatim ... no nullable-union translation needed") misses this constraint. Lower confidence adjunct: `minimum`/`maximum` keyword support in strict mode has historically been restricted too — verify against current API behavior when fixing.
**Fix:** For the OpenAI branch, send a strict-compatible variant:
```ts
schema: { ...JUDGE_TOOL.input_schema, additionalProperties: false }
```
and add a unit test asserting the OpenAI request body carries `additionalProperties: false`.

## Warnings

### WR-01: Mirror idempotency key omits the turn — only the FIRST turn's binary score per session ever persists in evalScores

**File:** `C:/Users/mandr/astridr-repo/astridr/integrations/langfuse_eval.py:130`; `astridr/agent/post_turn_pipeline.py:520-536`; `convex/evalScores.ts:85-93`
**Issue:** `spawn_evaluation` runs after **every turn** (post_turn_pipeline.py:521-536) and each turn's score is 1.0/0.0 (`self_improvement.py:68`). The mirror's dedup key is:

```python
"idempotencyKey": f"{session_id}:{agent_id}:{name}",   # langfuse_eval.py:130
```

— identical for every turn of a session. `ingestTaskQuality` treats a matching key as a redelivery and returns without writing (evalScores.ts:85-93), so CodePulse keeps only the **first** turn's coin-flip while Langfuse receives one score per turn. A session whose first turn succeeds and then degrades is recorded 1.0 forever; the KPI mean inherits first-turn bias. The comment "stable producer-generated id derived from score identity" (D-05) is inaccurate — the score identity includes the turn (`comment=f"turn={turn_count} ..."`).
**Fix:** Include the turn in the key (`f"{session_id}:{agent_id}:{name}:{turn_count}"`) if per-turn rows are wanted, or — if one row per session is the intent — make `ingestTaskQuality` patch the existing row (last-write-wins) instead of dropping the update.

### WR-02: Persona fallback `or self._active_profile` is dead code — non-channel sessions mirror as profileId "default"

**File:** `C:/Users/mandr/astridr-repo/astridr/agent/loop.py:173, 1545-1546`; `astridr/agent/post_turn_pipeline.py:534-535`
**Issue:** Both call sites use:

```python
profile_id=getattr(session, "active_profile", "") or self._active_profile,
```

but `AgentSession.active_profile` defaults to the truthy string `"default"` (`loop.py:173: active_profile: str = "default"`), not `""`. For any session not stamped by `agent_processor.py:115`, the expression yields `"default"` and the documented persona fallback ("_active_profile is only the fallback for non-channel sessions") can never trigger. `"default"` joins neither `profileConfigs` (invisible on the Quality page — `listPersonaKpis` iterates profileConfigs only) nor the judge's active-persona set (lands in the "unknown" bucket as `"default"`). Same pattern at `loop.py:1089` (session replay), which commit 24f07a18 claims as a fixed "side benefit" but has the same dead fallback.
**Fix:**
```python
_ap = getattr(session, "active_profile", "")
profile_id=(_ap if _ap and _ap != "default" else self._active_profile),
```

### WR-03: KPI means and regression windows blend binary task_quality scores with judge rubric scores — no `scoreName` filter

**File:** `convex/evalScores.ts:909-924, 976-981, 1133-1140`; contrast `convex/evalScores.ts:1014`
**Issue:** `listPersonaKpis`, `getPersonaDetail`, and `getEvalScoresWindowInternal` read `evalScores` by `by_profileId` with **no scoreName filter**, so the "quality score" averages 0/1 task_quality rows (Ástríðr's per-turn success bit, self_improvement.py:68) together with 0-1 judge rubric scores. `listJudgedSessions` (evalScores.ts:1014) filters `scoreName === "llm_judge"`, proving the distinction was known. Consequences: (a) the Quality page copy claims "judged nightly" and counts "Sessions Judged" (Quality.tsx:153, 170) over rows that are not judge scores; (b) a burst of binary 0.0 task_quality rows in a ±7-day window can single-handedly fire — or mask — a regression, undermining the E5 trend-attributability and D-14 zero-false-positive goals.
**Fix:** Either filter all three reads to `scoreName === "llm_judge"`, or, if blending is intended, document it and rename the UI copy/metric labels accordingly.

### WR-04: Quality page range selector doesn't change the data window — "90d window" label over fixed 30d data

**File:** `src/pages/Quality.tsx:114-119, 93-95, 109`; `src/hooks/useEvalScores.ts:9-11`; `convex/evalScores.ts:773, 901-903`
**Issue:** `useQualityKpis()` calls `listPersonaKpis` with no args; the backend hard-fixes the window to `DEFAULT_KPI_RANGE_DAYS = 30` (evalScores.ts:773, 901-903). The page's 7/30/90 selector only re-filters the returned 30d sparkline client-side (`Quality.tsx:119, 125`) and updates the label:

```tsx
<p ...>{rangeDays}d window</p>   // Quality.tsx:93-95
```

Selecting "Last 90 days" therefore shows at most 30 days of data labeled "90d window", while the headline score, sparkline, and delta remain the fixed 30d values regardless of selection (DeltaBadge honestly hardcodes "vs previous 30d", Quality.tsx:109 — inconsistently with the card label).
**Fix:** Add a `rangeDays: v.optional(v.float64())` arg to `listPersonaKpis` (mirroring `getPersonaDetail`) and pass the selected range through `useQualityKpis(rangeDays)`.

### WR-05: Change-event markers silently fail to render when no session was judged on the marker's exact date

**File:** `src/components/QualityTrendChart.tsx:66-80, 116-124`
**Issue:** The XAxis is a category axis of per-session formatted dates (`row.date`, line 68), and markers render as `<ReferenceLine x={m.date} ...>` (line 119). On a category axis, Recharts drops a ReferenceLine whose `x` doesn't match an existing category — and a model/instruction change rarely lands on the same calendar day as a judged session. The most important marker (the change that caused a gap in judging) is exactly the one most likely to vanish. Duplicate date categories (multiple sessions per day) also make marker placement ambiguous. `Quality.test.tsx` can't catch this because its Recharts mock renders ReferenceLine unconditionally (Quality.test.tsx:21-25).
**Fix:** Use a numeric time axis (`XAxis dataKey="timestamp" type="number" domain={['dataMin','dataMax']}` with a tick formatter) so `ReferenceLine x={m.timestamp}` positions independently of session dates; or snap each marker to the nearest existing category before rendering.

### WR-06: `ingestTaskQuality` is a public mutation — directly callable with only the deployment URL, bypassing the Bearer gate

**File:** `convex/evalScores.ts:64`; contrast `convex/runtimeIngest.ts:940`
**Issue:** The T-93-02 comment (runtimeIngest.ts:81-83) says the task_quality path "inherits the validateIngestAuth Bearer gate", but that gate covers only the HTTP `/runtime-ingest` route. `ingestTaskQuality` is declared with the public `mutation()` builder (evalScores.ts:64), so any client holding `VITE_CONVEX_URL` (shipped in the frontend bundle) can call `api.evalScores.ingestTaskQuality` directly and inject arbitrary quality scores — polluting KPI means and the regression detector without any credential. The same file's `storeEvalScore`/`insertRegressionAlert` correctly use `internalMutation`, and `runtimeIngest.ts:940` (`internal.graphSnapshots.upsertGraphSnapshot`) proves httpActions can call internal mutations. (This mirrors a pre-existing pattern on other ingest mutations, but this phase added a new instance while claiming Bearer inheritance.)
**Fix:** Change to `internalMutation` and invoke via `internal.evalScores.ingestTaskQuality` from runtimeIngest.

### WR-07: configChanges audit rows written by Ástríðr runtime sync are attributed to "dashboard"

**File:** `convex/profiles.ts:115-121`; `convex/runtimeIngest.ts:475-484`
**Issue:** `upsertConfig` hardcodes `changedBy: "dashboard"` (profiles.ts:119) in the Phase-93 modelPreferences audit row, but the `profile_config` runtime event routes through the same mutation (runtimeIngest.ts:477: `api.profiles.upsertConfig`). Every persona model change synced from Ástríðr is recorded in the audit trail — and surfaced as a "model change" regression marker — as if the operator changed it from the dashboard. An audit trail with a wrong actor defeats its purpose (this is precisely the D-11 change-source signal the regression copy cites).
**Fix:** Add an optional `changedBy: v.optional(v.string())` arg to `upsertConfig` (default `"dashboard"`), and pass `"astridr-sync"` from the runtimeIngest call site.

### WR-08: `detectRegressions` has no per-persona error isolation and runs before the E7 liveness summary

**File:** `convex/evalScores.ts:1269-1279, 750-756`
**Issue:** `detectRegressions` iterates personas sequentially with no try/catch (evalScores.ts:1275-1277) — one persona's query/mutation failure aborts the remaining personas. It is also awaited (evalScores.ts:750) **before** the `[eval-judge] ... sampled / scored / failed` liveness line (evalScores.ts:754), so a throw there both fails the cron and suppresses the E7 summary even though judging fully succeeded — the exact "no data vs nothing happened" ambiguity E7 exists to prevent. This contrasts with the module's own `Promise.allSettled` discipline in `runJudgeBatch`.
**Fix:** Wrap each `detectRegressionsForPersona` call in try/catch (log and continue), and emit the liveness summary before — or in a `finally` around — the regression pass.

## Info

### IN-01: Biased shuffle in nightly sampling

**File:** `convex/evalScores.ts:637`
**Issue:** `[...sessionIds].sort(() => Math.random() - 0.5)` is the classic biased shuffle — comparison sorts with random comparators produce non-uniform permutations, so D-08's "random sample within the day" is skewed toward insertion order.
**Fix:** Use a Fisher–Yates shuffle (5 lines) for uniform sampling.

### IN-02: Unused import in test file

**File:** `convex/evalScores.test.ts:39`
**Issue:** `import { internal } from "./_generated/api";` is never used — the tests deliberately avoid proxy comparisons (per the comment at lines 776-781), leaving the import dead.
**Fix:** Remove the import.

---

**What I dropped and why:** I dropped (a) the before/after regression windows using judge-run timestamps rather than session timestamps (≤1-day blur on a 7-day window — materiality uncertain), (b) `JSON.stringify` key-order sensitivity in `upsertConfig`'s modelPreferences diff (spurious audit rows only if the producer's key order varies — unproven), (c) OpenAI `max_tokens`-vs-`max_completion_tokens` / `temperature:0` model-compat concerns (model-dependent, folded a pointer into CR-03), (d) the unbounded completed-sessions scan in `getCandidateSessionsInternal` (perf, out of v1 scope), and (e) the login rate bucket collapsing to one IP behind the tunnel (pre-existing rate-limit design, not introduced by this phase) — all per the zero-false-positive rule.

---

_Reviewed: 2026-07-06T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
