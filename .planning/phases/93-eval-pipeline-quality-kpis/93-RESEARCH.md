# Phase 93: Eval Pipeline & Quality KPIs - Research

**Researched:** 2026-07-05
**Domain:** Convex ingest/cron pipeline + LLM-as-judge + operator dashboard (single-operator internal observability tool)
**Confidence:** MEDIUM-HIGH — codebase patterns are HIGH confidence (read directly); persona-identity join and a few UI-SPEC file references required correction after verification (see Pitfalls/Assumptions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Ástríðr-side change is IN this phase.** `langfuse_eval.py:spawn_score()` currently writes only to Langfuse — nothing POSTs to CodePulse. Add a fire-and-forget mirror POST to CodePulse from the score path, following the Phase 90 transcript-ingest mirroring precedent (astridr commit `26874fac`, `CONVEX_URL` + `ASTRIDR_INGEST_API_KEY` env pattern).
- **D-02: Transport = new `task_quality` eventType case on the existing `/runtime-ingest` dispatch** in `convex/runtimeIngest.ts`. No new HTTP route; inherits the `validateIngestAuth` Bearer gate and CORS.
- **D-03: Dual-write with independent gates.** The Langfuse write stays as-is behind `LANGFUSE_*` keys; the CodePulse mirror fires whenever `CONVEX_URL` + ingest key are configured. Neither blocks the other; the local `_score_cache` / `get_score_trend()` used by `self_improvement.py` is untouched.
- **D-04: Completion bar = live E2E.** The phase is not done until a real Ástríðr-emitted `task_quality` score lands in prod Convex (`tidy-whale-981`) and renders in the UI. This must be an explicit verification step in the plan — convex-test green alone does not close the phase (Phase 90 lesson: the cross-repo gate was flagged but never closed until live testing surfaced 5 gaps).
- **D-05: Idempotency on at-least-once retry is required** (EVAL-01 wording). Key mechanics are Claude's discretion, but a redelivered score must not double-insert.
- **D-06: Judge input = Convex-resident data only.** The judge reads `events` (tool activity + payloads), `sessions` metadata, and `llmMetrics` stats for the session. Hard constraint: the Convex cloud action cannot reach the local Ástríðr API (localhost:8181), so no transcript fetches. The rubric judges observable behavior (errors, retries, tool churn, cost/efficiency), not conversational content. No new transcript mirror in this phase.
- **D-07: Dedicated eval LLM config slot, default `claude-haiku-4-5`.** Reuse the `briefings.ts` caller pattern (configurable provider/model/apiKey slot, anthropic + openai support) but as a separate slot so changing the briefings model never silently shifts judge scoring. NOTE: Opus 4.8+/Claude 5 SDKs have no `budget_tokens` — do not add extended-thinking config to the judge call.
- **D-08: Sampling = per-persona nightly quota** — up to ~3 completed sessions per active persona per night, randomly chosen within the day. Guarantees every persona's KPI trend accrues data; nightly cost bounded by persona count.
- **D-09: Rubric = multi-dimension + overall.** 3–4 code-defined dimensions (suggested: task completion, error handling, efficiency/tool discipline, cost discipline), each scored 0–1, plus an overall. Stored per-dimension in `evalScores` via a score-name/dimension field so Ástríðr's binary `task_quality` slots in as just another named score in the same table. Rubric editing UI explicitly deferred.
- **D-10: Judge stores a short per-dimension rationale** with each score.
- **D-11: Change boundary = BOTH `profileSwitches` rows AND persona-scoped `configChanges` rows** (configKeys mapping to a persona's model/instructions). Either kind of change starts a comparison window.
- **D-12: Detection = before/after window means.** Compare mean overall score in a window before vs after the change event (~7 days each side), require a minimum judged-session count per side, flag when the drop exceeds a threshold. Chosen over z-score (too noisy at ~3 samples/night) and over UI-only comparison.
- **D-13: On detection, raise an alert through the existing alert engine** so it inherits Discord/Slack/PagerDuty/email routing, acknowledge/mute lifecycle, and severity preferences. Regression is an operational event like any other alert.
- **D-14: Conservative, code-defined thresholds.** Minimum ≥5 judged sessions per side and a meaningful drop before alerting — zero-false-positive bias. Constants live in code; tuned by commit, no settings UI in this phase.
- **D-15: New dedicated Quality page** — standard pattern: `src/pages/` + route in `App.tsx` + nav entry in `DashboardLayout.tsx` (`navItems` + `iconMap`). Not a section on Analytics or Agents.
- **D-16: Layout = per-persona KPI cards + drill-in detail.** Card grid (current score, sparkline, delta badge) → persona detail with full trend, change-event markers, per-dimension breakdown, and a judged-sessions list showing the judge's rationale with a link to the session. Reuse MetricCard/EntityRow patterns.
- **D-17: History = 30-day default with a range picker.** `evalScores` rows kept indefinitely — volume is tiny, no archival sweep, no 16 MiB risk.

### Claude's Discretion

- Idempotency key mechanics for `task_quality` ingest (producer-generated id vs derived key) — follow the Phase 88 `idempotencyKey` + `by_idempotencyKey` early-return precedent.
- `evalScores` schema details (field names, indexes), persona identity mapping (producer `agent_id` ↔ persona/profileId), and which configKeys count as "persona-scoped".
- Exact rubric dimension names/wording, judge prompt, and structured-output parsing.
- Cron time slot (pick an unused UTC slot; existing crons cluster 01:00–06:05 — avoid scheduler contention per the Phase 82/83 offset precedent).
- Chart implementation (custom flex charts vs D3, per existing conventions) and empty-state design before data accrues.
- Exact threshold/window constants for D-12/D-14 (within the conservative bounds stated).

### Deferred Ideas (OUT OF SCOPE)

- **Session-transcript mirroring into Convex** (would enable conversational-quality judging) — new capability, own phase if ever; the current rubric judges observable behavior only.
- **Rubric editing UI** — already listed in REQUIREMENTS.md Future Requirements; v1 rubric is code-defined.
- **Settings knobs for regression thresholds** — revisit only if code-defined constants prove too rigid.
- **evalScores archival sweep** — unnecessary at current volume; reconsider if judge sampling scales up.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVAL-01 | Ástríðr's emitted `task_quality` scores received via bearer-authed ingest, stored idempotently in `evalScores`, no longer dropped | `runtimeIngest.ts` switch-case pattern + `events.ts` `by_idempotencyKey` early-return precedent (both read directly, code cited below) give a concrete, provenly-working template. `validateIngestAuth`/CORS already exist — zero new auth code needed. |
| EVAL-02 | Nightly Convex `internalAction` LLM-judges sampled sessions against a rubric, writes to `evalScores` | `briefings.ts`'s `callLLMWithFallback` + `getLLMConfigInternal`/`setLLMConfig` config-slot pattern is the direct template for the eval LLM caller (needs a 3rd slot value, `"eval"`, since `setLLMConfig` currently hard-validates `slot !== "primary" && slot !== "backup"`). `crons.ts` shows exactly which UTC slots are already taken (05:00 is free). **Persona-to-session attribution has no existing schema join — flagged as the single most important open question (see Pitfalls/Open Questions).** |
| EVAL-03 | Per-persona quality KPI/trend visible; regression after persona model/instruction change flagged/alerted, joined against `profileSwitches`/`configChanges` | `profileSwitches`/`configChanges`/`profileConfigs` schemas read directly (see Architecture Patterns). **Critical gap found:** neither `profiles.upsertConfig` (persona `modelPreferences` sync) nor `agentProfiles.update` (persona model/prompt edit) currently writes a `configChanges` audit row — D-11's "persona-scoped configChanges" join has no data to read from until this gap is closed in-phase. Alert delivery must follow `evaluateInternal`'s `createIfNew` pattern (webhookStatus + scheduled `sendAlertWebhook`), not the simpler public `alerts.create` mutation, to actually inherit routing per D-13. |
</phase_requirements>

---

## Summary

This phase is unusually well-specified before research even starts — `93-CONTEXT.md` and `93-AI-SPEC.md` already lock the framework (raw `fetch`, no SDK), the LLM caller pattern to reuse (`briefings.ts`), the idempotency mechanics to reuse (Phase 88's `idempotencyKey`/`by_idempotencyKey`), and a fully worked judge-call code sketch. Codebase research therefore focused on **verifying those assumptions against the live repo** rather than exploring alternatives, and surfaced several corrections the planner needs:

1. **`zod` is already a dependency** (`^4.4.3` in `package.json`) — no new install needed; AI-SPEC's "npm install zod" instruction is a no-op.
2. **`convex-test` is NOT installed**, despite AI-SPEC Section 5 stating otherwise. Every existing Convex test file (`runtimeIngest.test.ts`, `swarmTasks.test.ts`, `cacheStats.test.ts`) explicitly comments "convex-test is not installed in this repo" and instead **mirrors the mutation/handler logic as an extracted pure function**, unit-tested with plain vitest. `vitest.config.ts` confirms a single `jsdom` environment with no Convex runtime harness. The Validation Architecture section below is built around this real pattern, not a hypothetical convex-test suite.
3. **Persona identity is genuinely ambiguous in the schema** and is the highest-risk unresolved question in this phase (full detail in Pitfalls). UI-SPEC's own Assumption #6 already resolves "persona" = `profileConfigs` rows (the 3 seeded operational profiles: `personal`/`business`/`consulting`), which is consistent with the existing `profileSwitches` table (`fromProfile`/`toProfile` use exactly these 3 values) — but **no table currently joins an arbitrary `sessions`/`events` row to a `profileId`.** `sessions` is keyed by `provider` (which coding tool: claude/codex/antigravity) and `cwd`, not persona. This has direct consequences for EVAL-02's "3 sessions per active persona per night" sampling query, which the plan must resolve explicitly.
4. **The alert-engine integration point needs precision.** The existing `alerts.create` public mutation does NOT wire webhook delivery (no `webhookStatus`, no `scheduler.runAfter(...sendAlertWebhook...)`). Only `evaluateInternal`/`evaluateCriticalInternal`'s internal `createIfNew` helpers do that. D-13 ("raise an alert through the existing alert engine so it inherits routing") requires the regression detector to follow the `createIfNew` shape (or extract a shared helper), not the simpler public mutation.
5. **UI-SPEC cites a nonexistent file** (`CompletionRateChart.tsx` does not exist in `src/components/`). The closest real precedent for "Recharts line/bar chart + `ReferenceLine` markers + shadcn `ChartContainer`/`ChartConfig`" is `src/components/hr/detail/ResponseTimeChart.tsx`.

**Primary recommendation:** Build EVAL-01 as one more `runtimeIngest.ts` switch case (near-zero new infrastructure), build EVAL-02's judge exactly per AI-SPEC Section 3/4's code sketch but resolve persona-session attribution explicitly as a first-class design decision before writing the sampling query, and build EVAL-03's regression alert via a new internal helper that mirrors `evaluateInternal`'s `createIfNew` (not the public `create` mutation) so it actually gets delivered.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Receive Ástríðr `task_quality` score (EVAL-01) | API/Backend (Convex `httpAction`) | — | Existing `/runtime-ingest` dispatch already owns all Ástríðr→CodePulse telemetry; this is one more `case` in that switch, not a new tier boundary. |
| Idempotent write to `evalScores` | API/Backend (Convex `internalMutation`) | Database (Convex table + index) | Dedup logic must live in the same mutation as the insert (OCC atomicity) — this is a backend concern, not a database-only constraint. |
| Nightly session sampling + LLM judge call (EVAL-02) | API/Backend (Convex `internalAction`) | External (Anthropic/OpenAI HTTP API) | `internalAction` is the only Convex function type allowed to `fetch()`; the LLM call itself is an external-service dependency the action orchestrates. |
| Judge digest construction (events/sessions/llmMetrics → prompt text) | Database/Storage (Convex `internalQuery`) | API/Backend | Read-only aggregation over existing tables; no new storage, purely a query-shape concern. |
| Regression detection (before/after window comparison) | API/Backend (Convex `internalAction`/cron) | Database (reads `evalScores`, `profileSwitches`, `configChanges`) | Pure computation over existing rows; triggers a side effect (alert) rather than storing new comparison state. |
| Alert delivery (Discord/Slack/PagerDuty/email) | API/Backend (existing `alerts.ts`/`webhookDelivery.ts`) | — | Regression detection is a producer into the alert engine, not a new delivery mechanism — must not duplicate webhook logic. |
| Quality KPI dashboard (EVAL-03) | Browser/Client (React SPA) | API/Backend (Convex `query` via `useQuery`) | Standard CodePulse page pattern — reactive `useQuery` hooks, no client-side computation beyond formatting/thresholding. |

---

## Project Constraints (from CLAUDE.md)

- **Windows paths:** any shell operations touching this repo or `astridr-repo` must use PowerShell/forward-slashes, never bash-style backslash escaping.
- **Model settings:** Opus 4.8+/Claude 5 have **no `budget_tokens`/extended-thinking config** — any Anthropic SDK/fetch code (including the judge caller) must not set it; already correctly excluded in AI-SPEC's code sketch.
- **Bug fixing:** grep the entire codebase for all instances before fixing (applied above — confirmed `configChanges` write-sites, `sessions`/`events` profileId absence, and convex-test non-installation across all matching files, not just one).
- **Error triage:** during execution, do not classify anomalies as "pre-existing" without root-causing — directly relevant to the persona-identity gap and the missing `configChanges` audit trail found here; these should be fixed in-phase, not deferred silently, since D-11/EVAL-03 depend on them.
- **Deployment:** `docker compose --profile prod up --build -d` — not directly relevant to this Convex/Vite phase (no Docker services touched), but do not `docker compose restart` if any container changes are made incidentally.
- **GSD phase completion:** STATE.md progress counters are advisory; verify real data flow end-to-end at phase close (this is exactly D-04's mandatory live-E2E bar — already locked as a decision, reinforced by CLAUDE.md's general phase-completion discipline).

---

## Standard Stack

### Core

| Library | Version (verified in repo) | Purpose | Why Standard |
|---------|-----|---------|--------------|
| `convex` | `^1.42.0` [VERIFIED: package.json] | Backend runtime — httpAction/internalAction/internalMutation/internalQuery, cron scheduler | Already the sole backend for this project; no alternative considered. |
| `zod` | `^4.4.3` [VERIFIED: package.json] | Judge-output structured validation | **Already installed** — no new dependency. AI-SPEC's install instruction is a no-op; do not re-add to plan tasks as if new. |
| `react` / `react-dom` | `^19.2.7` [VERIFIED: package.json] | Quality page + hooks | Existing frontend stack. |
| `recharts` | `^3.8.0` [VERIFIED: package.json] | Trend line chart with `ReferenceLine` change markers | Already used elsewhere (`ResponseTimeChart.tsx`, `ConversationTimeline.tsx`, `PulseChart.tsx`) via the shadcn `ChartContainer` wrapper at `src/components/ui/chart.tsx`. |
| `vitest` | `^4.1.9` [VERIFIED: package.json] | Test runner | Single `jsdom` environment (`vitest.config.ts`), no Convex-runtime split. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^1.22.0` [VERIFIED: package.json] | `Gauge` icon for Quality nav entry (per UI-SPEC) | Icon-only use, no new install. |
| shadcn `select`/`badge`/`card`/`separator`/`tooltip` | pre-installed [VERIFIED: `src/components/ui/`, confirmed by UI-SPEC "Registry Safety" table] | Range preset control, regression badge, KPI cards | Already present — no shadcn CLI run needed this phase. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch` dual-provider caller (chosen) | Vercel AI SDK (`ai` + `generateObject`) | Adds a dependency the codebase has zero precedent for; only worth it if raw-fetch JSON parsing of the rubric output proves brittle in practice (per AI-SPEC's own framework rationale). |
| `zod` runtime validation (chosen) | Hand-rolled type guards | `zod` is already a dependency and is the direct TS equivalent of the Pydantic-style validation this template calls for — no reason to hand-roll. |
| Recharts `LineChart` + `ReferenceLine` (chosen for detail page) | `FlexBarChart` custom component (used by `CostTrendChart.tsx`) | `FlexBarChart` is this codebase's other real charting convention (non-Recharts, custom bar-segment component) — viable if the planner prefers zero-Recharts-dependency consistency with `CostTrendChart.tsx`, but UI-SPEC explicitly specifies a Recharts `LineChart` for the multi-dimension trend + `ReferenceLine` markers, which `FlexBarChart` does not support (bar-only, no reference-line API). Recommend keeping UI-SPEC's Recharts choice for the detail page; the top-level KPI cards' sparkline should keep using the existing `Sparkline` component (used by `OperatorScoreCard.tsx`), not Recharts, for consistency with that precedent. |

**Installation:**
```bash
# No new packages required this phase — zod, convex, recharts, react, vitest all already installed.
npm ls zod convex recharts   # confirms versions above; no `npm install` needed
```

**Version verification performed:**
```bash
# Read directly from package.json (dependencies block) — see Sources.
# convex 1.42.0, zod 4.4.3, react 19.2.7, recharts 3.8.0, vitest 4.1.9
```

---

## Package Legitimacy Audit

**No external packages are being newly installed in this phase.** `zod` (the only package AI-SPEC's Section 3/5 mentions installing) is already present in `package.json` dependencies at `^4.4.3`. No `npm install`/`pip install`/`cargo add` command is required for this phase's implementation.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|--------------|-----------|-------------|
| zod | npm | already installed, multi-year | very high | github.com/colinhacks/zod | not run (no new install) | N/A — pre-existing dependency, not a new install this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none (no new packages to check).
**Packages flagged as suspicious [SUS]:** none.

---

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │         Ástríðr (external repo, Python)      │
                        │                                               │
                        │  langfuse_eval.py:spawn_score()  (D-01)       │
                        │    ├─ writes Langfuse (unchanged, LANGFUSE_*) │
                        │    └─ fire-and-forget mirror POST (new)       │
                        │        gated on CONVEX_URL + ASTRIDR_INGEST_  │
                        │        API_KEY (existing Phase-90 env anchor) │
                        └───────────────────┬───────────────────────────┘
                                            │ POST /runtime-ingest
                                            │ { eventType: "task_quality", ... }
                                            │ Authorization: Bearer <key>
                                            ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  convex/runtimeIngest.ts  (httpAction, existing dispatch)      │
        │    validateIngestAuth() ──▶ 401 if bad/missing token           │
        │    switch (evt.eventType) { ... + case "task_quality": NEW }   │
        └───────────────────────────────────┬───────────────────────────┘
                                            ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  convex/evalScores.ts — internalMutation storeEvalScore()       │
        │    by_idempotencyKey lookup ──▶ early-return no-op if seen       │
        │    else insert { scoreName:"task_quality", profileId, overall } │
        └───────────────────────────────────┬───────────────────────────┘
                                            ▼
                                    evalScores table
                                            ▲
        ┌───────────────────────────────────┴───────────────────────────┐
        │  Nightly cron (convex/crons.ts, new UTC slot ~05:00)            │
        │    internalAction judgeSessionsAction()                         │
        │      1. internalQuery: sample ≤3 sessions/active persona/night  │
        │         (D-08 — REQUIRES a session→persona attribution — see    │
        │          Open Questions/Pitfalls)                                │
        │      2. internalQuery: build per-session digest (events.take(200)│
        │         + llmMetrics summary stats, truncate free-text ~200-300c)│
        │      3. fetch() Anthropic/OpenAI judge call (config slot          │
        │         "intelligence.llm_eval", tool_choice forced)              │
        │      4. zod-validate output; retry ≤3 attempts; NO row on         │
        │         exhausted failure (session stays re-sampleable)           │
        │      5. internalMutation: insert { scoreName:"llm_judge", ... }   │
        │         with idempotencyKey = `judge:${sessionId}`                │
        └───────────────────────────────────┬───────────────────────────┘
                                            ▼
        ┌───────────────────────────────────────────────────────────────┐
        │  Regression detector (internalAction, same or adjacent cron)    │
        │    reads evalScores + profileSwitches + configChanges            │
        │    before/after window means per persona (D-12, ≥5/side)         │
        │    on drop ≥ threshold ──▶ raise alert via createIfNew-style      │
        │    helper (webhookStatus:"pending" + scheduler.runAfter          │
        │    sendAlertWebhook) — NOT the public alerts.create mutation      │
        └───────────────────────────────────┬───────────────────────────┘
                                            ▼
                                    alerts table + existing
                                webhookDelivery/pagerdutyDelivery
                                            │
        ┌───────────────────────────────────┴───────────────────────────┐
        │  Frontend: src/pages/Quality.tsx + QualityDetail.tsx            │
        │    useQuery(api.evalScores.*)  ──▶  KPI cards, trend chart,      │
        │    per-dimension bars, judged-session list, regression badge     │
        └───────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
convex/
├── evalScores.ts          # NEW — ingest mutation (task_quality), judge
│                           #   internalQuery/internalAction/internalMutation,
│                           #   KPI queries, regression-detection internalAction
├── schema.ts               # + evalScores table (this phase)
├── runtimeIngest.ts        # + "task_quality" eventType case in the existing switch
├── briefings.ts            # unchanged — setLLMConfig needs a 3rd valid `slot` value
├── crons.ts                # + nightly judge cron entry, offset from 01:00-06:05 cluster
└── alerts.ts                # unchanged — regression detector calls a createIfNew-style
                              #   helper, does not modify this file's fixed rule set
src/
├── pages/
│   ├── Quality.tsx          # NEW — KPI card grid, route "/quality"
│   └── QualityDetail.tsx    # NEW — persona drill-in, route "/quality/:profileId"
├── hooks/useEvalScores.ts   # NEW — useQuery wrapper(s), loading-safe (?? [])
└── layouts/DashboardLayout.tsx  # + "Quality" nav entry (OBSERVE group) + Gauge icon
```

### Pattern 1: Ingest dispatch — new `eventType` case (EVAL-01)

**What:** Add one `case "task_quality":` block inside the existing `switch (evt.eventType)` in `convex/runtimeIngest.ts` (currently ~35 cases, lines 56-934). Follows the exact shape of every existing case: snake_case/camelCase coalesce (`d.field ?? d.field_name`), then `ctx.runMutation(api.<domain>.<fn>, {...})`.

**When to use:** Any new Ástríðr→CodePulse event type. This is the established, exclusive convention — there is no case in this file that creates a new HTTP route instead.

**Example (verified from live code, `convex/runtimeIngest.ts:57-76` — `llm_call` case, the closest structural analog since it also has cost/token/session fields):**
```typescript
// Source: convex/runtimeIngest.ts:57-76 (existing pattern, read directly)
case "llm_call": {
  const d = data as any;
  await ctx.runMutation(api.llm.recordCall, {
    provider: d.provider ?? "unknown",
    model: d.model ?? "unknown",
    // ... snake_case/camelCase coalesce for every field ...
    sessionId: d.sessionId ?? d.session_id,
    agentId: d.agentId ?? d.agent_id,
  });
  break;
}

// NEW case to add, same shape:
case "task_quality": {
  const d = data as any;
  await ctx.runMutation(api.evalScores.ingestTaskQuality, {
    profileId: d.profileId ?? d.profile_id ?? "unknown",
    sessionId: d.sessionId ?? d.session_id ?? "unknown",
    overall: d.score ?? d.overall ?? 0,
    idempotencyKey: d.idempotencyKey ?? d.event_id, // D-05
    timestamp,
  });
  break;
}
```

### Pattern 2: Idempotent write — `by_idempotencyKey` early-return (EVAL-01, D-05)

**What:** Look up the dedup key first inside the SAME mutation as the insert (one OCC transaction); no-op if found.

**When to use:** Every write path fed by an at-least-once-retry producer (Phase 88 precedent, reused verbatim here per Claude's Discretion note).

**Example (verified from live code, `convex/events.ts:20-30`):**
```typescript
// Source: convex/events.ts:20-30 (Phase 88 D-04/D-05 precedent, read directly)
if (args.idempotencyKey) {
  const existing = await ctx.db
    .query("events")
    .withIndex("by_idempotencyKey", (q) =>
      q.eq("idempotencyKey", args.idempotencyKey!)
    )
    .first();
  if (existing) return; // idempotent no-op
}
await ctx.db.insert("events", { /* ... */ idempotencyKey: args.idempotencyKey });
```
Apply the identical shape to `evalScores`: add `.index("by_idempotencyKey", ["idempotencyKey"])` to the new table, and gate every insert (both the EVAL-01 ingest mutation and the EVAL-02 judge's `storeEvalScore`) behind this exact lookup-then-insert pattern. **Do not** invent a new dedup mechanism — this one is proven and already the phase's own precedent (per CONTEXT.md's "Claude's Discretion" note explicitly pointing here).

### Pattern 3: Dual-provider LLM caller with config slot (EVAL-02, D-07)

**What:** `briefings.ts`'s `callLLMWithFallback` + `getLLMConfigInternal`/`setLLMConfig` is the existing, proven config-slot pattern. **Correction needed:** `setLLMConfig`'s current validation hard-rejects any `slot` other than `"primary"`/`"backup"` (`convex/briefings.ts:241-243`) — the eval slot (`intelligence.llm_eval`, referred to as `"eval"`) requires either extending this validation or adding a parallel mutation. This is a real code change, not just a config-value change.

**Example (verified from live code, `convex/briefings.ts:228-272`, showing the exact validation that must be extended):**
```typescript
// Source: convex/briefings.ts:241-243 — CURRENT hard-coded slot validation
if (slot !== "primary" && slot !== "backup") {
  throw new Error(`Invalid slot "${slot}". Must be "primary" or "backup".`);
}
// NEEDS: `slot !== "primary" && slot !== "backup" && slot !== "eval"` (or equivalent)
// so intelligence.llm_eval can be set via the same Settings-page mutation.
```
The judge caller itself should live in `evalScores.ts` (not `briefings.ts` — D-07's whole point is an isolated config slot so briefings-model changes never silently reweight judge scoring), reusing `getLLMConfigInternal`'s query shape but reading key `"intelligence.llm_eval"`.

### Pattern 4: Alert engine integration — dedup-by-source + delivery wiring (EVAL-03, D-13)

**What:** There are TWO different "create an alert" code paths in `alerts.ts`, and only one of them actually delivers:

- `alerts.create` (public mutation, `convex/alerts.ts:22-40`) — inserts a row with `acknowledged: false, status: "active"` but **does NOT set `webhookStatus` and does NOT schedule `sendAlertWebhook`**. An alert created this way sits in the dashboard's alert list but never reaches Discord/Slack/PagerDuty/email.
- `createIfNew` (private helper inside `evaluateInternal`/`evaluateCriticalInternal`, `convex/alerts.ts:716-736` and `948-967`) — inserts with `webhookStatus: "pending"` **and** `ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, { alertId, attempt: 1 })`. This is the path that actually inherits D-13's routing.

**When to use:** The regression detector MUST follow the `createIfNew` shape (dedup-by-`source` + `webhookStatus: "pending"` + scheduled webhook), not the simpler public mutation, or D-13 is silently unmet (the alert would exist but never notify).

**Example (verified from live code, `convex/alerts.ts:716-736`):**
```typescript
// Source: convex/alerts.ts:716-736 — the pattern the regression detector must mirror
async function createIfNew(ruleId: string, severity: string, source: string, message: string): Promise<any> {
  if (disabledRules.has(ruleId)) return null;
  if (activeSourceSet.has(ruleId)) return null;   // dedup by `source` field
  const newAlertId = await ctx.db.insert("alerts", {
    severity, source, message,
    acknowledged: false, status: "active", createdAt: now,
    webhookStatus: "pending",                       // <- required for delivery
  });
  await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
    alertId: newAlertId, attempt: 1,
  });
  return newAlertId;
}
```
Recommendation: use a per-persona dynamic `source` value (e.g. `` `eval-regression:${profileId}` ``) so the existing `by_source`/active-alert-set dedup logic naturally prevents re-firing while an unresolved regression alert is still open for that persona — no new dedup mechanism needed. The `details` field (structured before/after means, change date, change type) is supported by the `alerts` table schema (`v.optional(v.any())`) but is NOT threaded through by the existing `createIfNew` helpers — the regression detector's own insert call should pass it directly (bypassing/extending `createIfNew`, since neither existing helper accepts a `details` argument today).

### Pattern 5: Recharts trend chart with change-event markers

**What:** UI-SPEC references `CompletionRateChart.tsx` "exactly" — **this file does not exist in the repo** (`Glob "src/components/*Chart*.tsx"` confirms the actual set: `ActiveTimeChart`, `CapabilityGrowthChart`, `CostTrendChart`, `FlexBarChart`, `PermissionDecisionsChart`, `PromptActivityChart`, `ProviderComparisonChart`, `PulseChart`). The closest real precedent for "Recharts + shadcn `ChartContainer`/`ChartConfig` + `ReferenceLine` markers" is `src/components/hr/detail/ResponseTimeChart.tsx`.

**Example (verified from live code, `src/components/hr/detail/ResponseTimeChart.tsx:1-40`):**
```typescript
// Source: src/components/hr/detail/ResponseTimeChart.tsx:1-40 (read directly)
import { BarChart, Bar, XAxis, YAxis, ReferenceLine } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const chartConfig: ChartConfig = {
  count: { label: "Count", color: "var(--chart-1)" },
};
// ... <ChartContainer config={chartConfig}><BarChart data={data}>
//       <ReferenceLine x={...} label={...} /> ... </BarChart></ChartContainer>
```
For the Quality detail page's multi-dimension `LineChart` (per UI-SPEC layout contract), swap `BarChart`/`Bar` for `LineChart`/`Line` (per-dimension + overall, `strokeWidth={2}`, `dot={false}` — `strokeWidth={2}` precedent already confirmed in `src/components/PulseChart.tsx:64`), keep the same `ChartContainer`/`ChartConfig`/`ReferenceLine` scaffolding.

### Anti-Patterns to Avoid

- **`Promise.all` over the per-persona sampling loop.** If one session's judge call throws after exhausting retries, `Promise.all` aborts the entire batch — every other in-flight session that night gets silently dropped. Use `Promise.allSettled` (per AI-SPEC 4b.2, confirmed as correct against this codebase's async conventions — no existing counter-example found).
- **Inserting a partial/zeroed `evalScores` row to satisfy an idempotency key on judge failure.** A session whose judge call exhausts all retries must produce **zero** rows, not a placeholder — otherwise it silently poisons the dedup key and the session can never be re-sampled.
- **Using `alerts.create` for regression alerts.** Confirmed above (Pattern 4) — it silently fails to deliver.
- **Reusing `briefings.ts`'s existing `slot` validation without extending it.** `setLLMConfig` will throw `Invalid slot "eval"` today; this must be fixed in-code, not worked around in the judge caller.
- **Assuming `sessions`/`events` carry a `profileId` field.** They do not (confirmed by direct schema read, `convex/schema.ts:24-54`) — any sampling query written as if `sessions.profileId` exists will fail at the type level and, if worked around with a cast, silently return wrong data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bearer-token auth + CORS on the ingest endpoint | A new auth check in a new route | `validateIngestAuth`/`getCorsHeaders` from `convex/ingestAuth.ts`, inherited by adding a case to the existing `/runtime-ingest` dispatch | Already implements fail-open-in-dev/fail-closed-in-prod correctly (CPHLTH-02); a new route means re-deriving this from scratch. |
| At-least-once dedup | A custom hash/dedup table | `idempotencyKey` + `by_idempotencyKey` index + early-return-inside-the-mutation (Phase 88 precedent, `convex/events.ts:20-30`) | Proven pattern already in production for exactly this failure mode. |
| Alert routing (Discord/Slack/PagerDuty/email, ack/mute lifecycle) | A parallel notification system for regression alerts | Existing `alerts` table + `webhookDelivery.ts`/`pagerdutyDelivery.ts`, via the `createIfNew` shape | Full severity-routing/ack/mute lifecycle already exists; hand-rolling a second path fragments the operator's alert inbox. |
| Structured LLM output validation | Hand-written type guards / regex parsing of judge JSON | `zod` (already a dependency) `.safeParse()` against a schema mirroring `JUDGE_TOOL.input_schema` | Direct TS equivalent of Pydantic; already installed, zero marginal cost. |
| Chart change-event markers on a trend line | A custom SVG overlay for "this is when the model changed" | Recharts `ReferenceLine` (already used in `ResponseTimeChart.tsx`) | Native Recharts primitive for exactly this use case — verified in-repo precedent. |

**Key insight:** Every piece of infrastructure this phase needs (auth, dedup, alert delivery, structured validation, chart markers) already has exactly one established pattern somewhere in this codebase. The research task here was almost entirely "find and cite the existing pattern," not "evaluate options" — consistent with how thoroughly CONTEXT.md/AI-SPEC already scoped this phase.

---

## Common Pitfalls

### Pitfall 1: Persona identity has no existing session-level join (the single biggest risk in this phase)

**What goes wrong:** EVAL-02's D-08 requires sampling "~3 completed sessions per active persona per night." A sampling query written against `sessions`/`events` with an assumed `profileId` field will not compile (the field doesn't exist) — or worse, if a query is written against some unrelated field that happens to type-check (e.g. `provider`), it will silently sample the wrong pool and produce meaningless per-persona KPI data that looks plausible on the dashboard.

**Why it happens:** Three different "identity" concepts coexist in this schema and are easy to conflate:
1. `profileConfigs`/`profileSwitches` (`convex/schema.ts:498-533`) — the 3 seeded **operational profiles** (`personal`/`business`/`consulting`), scoped by channels/budget/modelPreferences. **UI-SPEC's Assumption #6 explicitly resolves "persona" to mean this identity** ("Active persona for the KPI grid = personas with a `profileConfigs` row").
2. `agentProfiles` (`convex/schema.ts:80-92`) — a **separate**, individually-named agent-persona table (model/systemPrompt/displayName/avatar) with zero real rows found in the codebase (no "Loki"/"Odin"-style names exist anywhere in `convex/` or `src/` — confirmed via full-repo grep). The UI-SPEC's own regression-alert copy example ("Loki quality dropped...") uses this table's naming *flavor* but is illustrative only, not evidence this table is populated or wired to `profileSwitches`.
3. `sessions`/`events` (`convex/schema.ts:24-54`) — keyed by `sessionId`, with `provider` (which coding tool: claude/codex/antigravity) and `cwd`, **no `profileId` field at all** (confirmed via `sessions.ts`'s `upsert` mutation, which only ever sets `cwd`/`model`/`provider`).

**How to avoid:** Resolve explicitly, before writing the sampling query, which of these is the practical join key. Given UI-SPEC's Assumption #6 already commits to `profileConfigs` identity, the most consistent path is: the Ástríðr producer (already being modified in-phase per D-01) should include `profileId` directly in the `task_quality` mirror payload (Ástríðr knows which operational profile was active — this is a natural, low-cost addition to the mirror POST). For EVAL-02's own judge sampling (which needs to pick sessions BEFORE any score exists), the plan needs one of: (a) extend the existing `llm_call`/`gateway.task_*` runtime events to also carry `profileId` so a session→profileId lookup becomes possible via `llmMetrics`/`events`, or (b) accept that EVAL-02's judge samples from the general session pool without persona pre-filtering and instead groups post-hoc using whatever attribution data EVAL-01's own scores carry, or (c) treat "active persona" more loosely for sampling purposes than for KPI display. **This must be an explicit planning decision with a written rationale, not an implicit assumption baked into a query.**

**Warning signs:** A sampling query that filters `sessions` by anything other than `status`/`lastEventAt`/`sessionId` and calls the result "per-persona" without a traced join path back to `profileConfigs.profileId`.

### Pitfall 2: `configChanges` has no audit trail for persona model/instruction changes today

**What goes wrong:** D-11's regression-detection change boundary requires "persona-scoped `configChanges` rows (configKeys mapping to a persona's model/instructions)." Today, changing a persona's model via `profiles.upsertConfig` (`convex/profiles.ts:81-114`, patches `profileConfigs.modelPreferences`) or via `agentProfiles.update` (`convex/agentProfiles.ts:26-43`, patches `model`/`systemPrompt`) **writes no `configChanges` row at all.** The only `profiles.ts` mutation that does insert into `configChanges` is `updateEmail` (`convex/profiles.ts:116-152`) — a completely different field.

**Why it happens:** `configChanges` was built for drift-tracking generic Ástríðr-side config sync (`ingest.ts:225-237`'s `ConfigChange` event → `drift.recordChange`) and capability-registry changes (`registry.ts`'s MCP/tool/skill/plugin sync writes), not for dashboard-initiated persona edits. The audit-insert habit exists in some mutations (`updateEmail`) but was never applied to `upsertConfig`/`agentProfiles.update`.

**How to avoid:** This gap must be closed in-phase, or D-11's join has zero real data to read from until some other unrelated code path happens to write a `configKey` that looks persona-scoped. Add a `configChanges` insert (`configKey: \`profile.${profileId}.modelPreferences\`` or similar, mirroring `updateEmail`'s exact shape) to whichever mutation(s) the plan decides constitute "a persona's model or instruction change" — likely `profiles.upsertConfig` given the operational-profile identity resolution in Pitfall 1.

**Warning signs:** A regression-detection query against `configChanges` that returns zero rows in testing/staging even after a deliberate persona-model change was made through the dashboard — this indicates the audit-insert was never added, not that no changes occurred.

### Pitfall 3: `convex-test` is not installed — do not write a plan/tests around it

**What goes wrong:** AI-SPEC Section 5 states "Primary Tool: vitest + convex-test (already in the repo...)." This is factually incorrect. If Wave 0 test scaffolding is written assuming a `convex-test` harness (e.g. `convexTest(schema)` instantiation), every such test file will fail to even import.

**Why it happens:** AI-SPEC's Section 5 checklist appears to have assumed the CLAUDE.md-documented "Testing" convention implies convex-test without checking `package.json`/existing test files directly.

**How to avoid:** Follow the actual, repeatedly-confirmed convention: **extract pure/testable logic as an exported function mirroring the real mutation/action body**, and unit-test that function with plain vitest + manual mocks (fetch, `ctx.db`-shaped fixtures). This is the pattern in `runtimeIngest.test.ts` ("Uses plain vitest mocks (convex-test is not installed in this repo)"), `swarmTasks.test.ts`, and `cacheStats.test.ts` — all three files state this explicitly in their own header comments. `briefings.test.ts` similarly only tests the exported pure helper `groupActivityEvents`, never the mutation/action wrapper itself.

**Warning signs:** Any test file that imports `convex-test` or `convexTest` — this will fail immediately since the package is absent from both `dependencies` and `devDependencies`.

### Pitfall 4: `tool_choice` forced tool use is incompatible with extended thinking

**What goes wrong:** If a future change (or a copy-paste from another part of the codebase that does use thinking config) adds `budget_tokens`/thinking to the judge call, the Anthropic Messages API will reject the request — forced `tool_choice` and extended thinking are mutually exclusive.

**Why it happens:** Not a risk in the current design (no thinking config is used), but worth flagging since CLAUDE.md's own global model-settings note independently confirms "Thinking is adaptive-only... there is NO `budget_tokens` config" for the Opus 4.8/Claude 5 SDK family — two independent sources (AI-SPEC + user's global CLAUDE.md) agree this must never be added here.

**How to avoid:** Never add `budget_tokens`/thinking parameters to the judge's Anthropic call. Already correctly excluded in AI-SPEC's Section 3 code sketch — just don't regress it later.

### Pitfall 5: Cron slot collision

**What goes wrong:** Adding the nightly judge cron at an already-used UTC slot causes contention with an existing job (Phase 82/83 precedent explicitly calls this out).

**Why it happens:** `convex/crons.ts` (read directly, full file) shows the following UTC slots already occupied: `01:00` (daily aggregate), `02:00` (archive-stale-events), `03:00` (evaluate-memory-quality), `03:30` (sweep-forge-log-chunks), `04:00` (sweep-forge-file-records), `04:30` (sweep-graph-snapshot-versions), `06:00` (generate-daily-digest), `06:05` (send-email-digest). Plus interval-based jobs (hourly/every-N-minutes) that run continuously regardless of slot.

**How to avoid:** `05:00 UTC` is confirmed free (no daily job registered at that slot) and sits with a clean 30-60 min buffer from its neighbors (04:30 sweep, 06:00 digest) — recommend this slot for the nightly judge cron, and a second offset slot (e.g. `05:30`) for the regression-detection pass if it runs as a separate job from the judge itself.

**Warning signs:** `crons.daily(...)` registered at `01:00`, `02:00`, `03:00`, `03:30`, `04:00`, `04:30`, `06:00`, or `06:05` — any of these silently doubles up with existing work.

---

## Code Examples

### Idempotent ingest mutation (EVAL-01 target shape)

```typescript
// Source: convex/events.ts:8-48 (existing Phase 88 precedent, adapted)
export const ingestTaskQuality = mutation({
  args: {
    profileId: v.string(),
    sessionId: v.string(),
    overall: v.float64(),
    idempotencyKey: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("evalScores")
        .withIndex("by_idempotencyKey", (q) =>
          q.eq("idempotencyKey", args.idempotencyKey!)
        )
        .first();
      if (existing) return; // idempotent no-op — D-05
    }
    await ctx.db.insert("evalScores", {
      scoreName: "task_quality",
      profileId: args.profileId,
      sessionId: args.sessionId,
      overall: args.overall,
      idempotencyKey: args.idempotencyKey,
      timestamp: args.timestamp,
    });
  },
});
```

### Extending `setLLMConfig` for the eval slot (concrete diff target)

```typescript
// Source: convex/briefings.ts:240-246 (current code, needs this exact change)
// BEFORE:
if (slot !== "primary" && slot !== "backup") {
  throw new Error(`Invalid slot "${slot}". Must be "primary" or "backup".`);
}
// AFTER (minimal change to unblock D-07):
if (slot !== "primary" && slot !== "backup" && slot !== "eval") {
  throw new Error(`Invalid slot "${slot}". Must be "primary", "backup", or "eval".`);
}
```

### Cron registration (target UTC slot)

```typescript
// Source: convex/crons.ts (existing file pattern, new entry to append)
// Phase 93: Nightly LLM-judge sampling (EVAL-02). Offset from the 04:30 graph-snapshot
// sweep and the 06:00 daily-digest generation to avoid scheduler contention.
crons.daily(
  "judge-sampled-sessions",
  { hourUTC: 5, minuteUTC: 0 },
  internal.evalScores.judgeSessionsAction,
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `task_quality` scores written to Langfuse only, never reaching CodePulse | Dual-write: Langfuse unchanged + fire-and-forget mirror to `/runtime-ingest` | This phase (D-01/D-03) | Closes the silent-score-loss gap that motivated EVAL-01; matches the Phase 90 transcript-mirror precedent already proven live. |
| `alertRules.ts`'s fixed, code-defined rule array evaluated by `evaluateInternal` | Regression detector as a standalone dynamic per-persona check outside the fixed `alertRules` array, using the `createIfNew` delivery shape directly | This phase (recommended, not yet built) | The existing `alertRules` array assumes one static threshold check per rule id; per-persona dynamic comparisons don't fit that shape cleanly — better to call the alert-insert helper directly than force-fit into `alertRules.ts`. |

**Deprecated/outdated:** None identified — this phase adds new capability rather than replacing an existing one, aside from the corrections noted in Pitfalls (AI-SPEC's convex-test/CompletionRateChart/zod-install claims, all superseded by direct repo verification above).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Persona" for D-08 sampling and D-11 change-boundary detection = `profileConfigs`/`profileSwitches` identity (`personal`/`business`/`consulting`), per UI-SPEC Assumption #6, not `agentProfiles`' individually-named agents | Pitfall 1, Architectural Responsibility Map | If wrong, the entire sampling query, KPI grid grouping, and regression-detection join target the wrong table, requiring a redesign mid-phase. This is UI-SPEC's own stated assumption, not newly invented here — but it has NOT been operator-confirmed and should be surfaced explicitly in planning, since it's genuinely load-bearing. |
| A2 | `claude-haiku-4-5` is a valid, current model identifier for the eval config-slot default | D-07, Code Examples | Low risk — this exact model string is already used as a real value elsewhere in this same codebase (`convex/profiles.ts:215` `seedProfiles`'s `modelPreferences.fallback: "claude-haiku-4-5"`), so it's an internally-consistent convention, not a training-data guess. Still worth a final API-side confirmation before the phase's live-E2E gate (D-04). |
| A3 | The regression detector should run as a separate internalAction/cron entry from the nightly judge (not inline in the same action) | Architecture Patterns, Pitfall 5 | If the plan instead chains regression detection directly inside the judge action, a slot-offset recommendation (05:30) becomes moot — low risk either way, but affects the cron-registration code example above. |
| A4 | `configChanges` audit-trail gap (Pitfall 2) should be closed by adding an insert to `profiles.upsertConfig`, not by adding a brand-new dedicated audit table | Pitfall 2, Phase Requirements table | If the planner instead builds a separate persona-config-audit table, D-11's "configChanges rows" wording would need reinterpreting — recommend closing the gap in the existing table since D-11 explicitly names `configChanges`, not a new table. |

**If this table is empty:** N/A — see rows above; all four are genuine judgment calls surfaced by this research that the planner should either confirm or explicitly override.

---

## Open Questions

1. **How does a `sessions`/`events` row get attributed to a persona/profileId for EVAL-02's sampling query?**
   - What we know: `sessions`/`events` have no `profileId` field (confirmed by direct schema + mutation read). `llmMetrics` has `agentId` (not `profileId`). `profileConfigs`/`profileSwitches` use `profileId` ∈ {personal, business, consulting} with no session linkage. `commandExecutions`'s telemetry path even overloads `toolExecutions.sessionId` to literally hold a `profileId` value in one case (`runtimeIngest.ts:611`, `command_execution` case) — a precedent that a plan could deliberately extend, but it's inconsistent with the "real" sessionId semantics elsewhere.
   - What's unclear: Whether Ástríðr's own runtime emits any event that already carries both `sessionId` and `profileId` together, which CodePulse isn't yet capturing into a joinable place. This can only be resolved with certainty by inspecting `astridr-repo`'s emitter code (out of scope for this research pass, which was scoped to CodePulse).
   - Recommendation: Before writing the EVAL-02 sampling query, either (a) grep `astridr-repo` for what identity fields the runtime `llm_call`/`gateway.task_*`/future `task_quality` mirror payloads actually carry, or (b) make an explicit, documented planning decision to widen one existing runtime event (most likely `llm_call`, which already has `agentId`) to also carry `profileId`, then join `sessions` → `llmMetrics` (by `sessionId`) → `profileId` (by `agentId` or the new field) for sampling purposes.

2. **Which specific `configKeys` count as "persona-scoped" for regression detection (D-11)?**
   - What we know: `configChanges.configKey` is a free-form string with observed prefixes like `config:`, `mcpServer:`, `plugin:`, `profile.<id>.emailAddress` (the one real precedent, from `updateEmail`). No persona-model/instruction-scoped key currently exists in practice (Pitfall 2).
   - What's unclear: The exact key naming scheme the plan should adopt once the audit-insert gap (Pitfall 2) is closed — e.g. `` `profile.${profileId}.modelPreferences` `` vs `` `persona.${profileId}.model` ``.
   - Recommendation: Match the existing `updateEmail` precedent's naming shape (`` `profile.${profileId}.<field>` ``) for consistency, since it's the only real prior art for a profile-scoped `configChanges` key in this codebase.

3. **Should the regression detector run inline inside the nightly judge action, or as a separate scheduled action?**
   - What we know: D-12's before/after window comparison only needs `evalScores` rows that already exist (both `task_quality` mirror rows and `llm_judge` rows) — it does not strictly need to run in the same tick as the judge.
   - What's unclear: Whether running it separately (e.g., 30 min after the judge, at 05:30 UTC) risks reading a partially-written night's judge output, vs. running it inline right after the judge action completes (guaranteeing that night's scores are all in before comparing).
   - Recommendation: Run it as a distinct step at the end of the same judge action (after all `Promise.allSettled` results are known), rather than a separate cron — this guarantees the night's own scores are counted before the before/after comparison runs, and avoids adding yet another cron slot to track.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex CLI / deployment (`tidy-whale-981`) | All of EVAL-01/02/03 (backend) | ✓ (existing project deployment, confirmed via STATE.md/existing `convex/` tree) | `convex ^1.42.0` | — |
| Anthropic API key (for `intelligence.llm_eval` config slot) | EVAL-02 judge calls | Not verifiable from this repo (secret lives in Convex env/`agentConfigs`, never read directly per security policy) | — | If unconfigured, `callJudgeLLM` throws `"Eval LLM not configured"` per the AI-SPEC's own code sketch — judge action fails gracefully with a clear error, no silent partial score (consistent with Pitfall/Guardrail design already in AI-SPEC). Must be configured via the dashboard's `setLLMConfig` mutation (once extended per Pattern 3) before the D-04 live-E2E gate can pass. |
| `ASTRIDR_INGEST_API_KEY` env var (Convex-side, gates `/runtime-ingest` Bearer auth) | EVAL-01 ingest | ✓ pattern already exists and is used by Phase 90's war-room/transcript mirrors (per CONTEXT.md canonical refs) | — | — |
| astridr-repo `langfuse_eval.py` mirror POST (producer-side change, D-01) | EVAL-01 (cross-repo) | Not yet built — this IS the phase's own D-01 deliverable | — | None — this is in-scope work, not a pre-existing dependency. |

**Missing dependencies with no fallback:**
- Anthropic (or OpenAI) API key for the `intelligence.llm_eval` slot must be configured before the phase's D-04 live-E2E completion bar can be met — this is an operator action outside the codebase, not a code gap.

**Missing dependencies with fallback:**
- None beyond the above — the judge caller already has a documented graceful-failure path if the config slot is empty.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.9` [VERIFIED: package.json], single `jsdom` environment (no Convex-runtime harness — `convex-test` is NOT installed, confirmed above) |
| Config file | `vitest.config.ts` (repo root) |
| Quick run command | `npx vitest run convex/evalScores.test.ts` |
| Full suite command | `npm test` (runs full vitest suite, includes `src/**/*.test.tsx` + `convex/**/*.test.ts` per `vitest.config.ts`'s `include` glob) |

**Testing convention to follow (not convex-test):** Export the pure logic underlying each Convex function (idempotency check, digest builder, judge-output zod validation, threshold-comparison math, alert-dedup-by-source logic) as a standalone function from `evalScores.ts`, and unit-test those directly with plain vitest + manual mocks for `fetch`/`ctx.db`-shaped inputs — exactly the pattern in `runtimeIngest.test.ts`/`swarmTasks.test.ts`/`cacheStats.test.ts`/`briefings.test.ts` (all four read directly, all confirm this convention explicitly).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVAL-01 | Redelivered `task_quality` event (same idempotencyKey) yields exactly one `evalScores` row | unit (extracted-logic) | `npx vitest run convex/evalScores.test.ts -t "idempoten"` | ❌ Wave 0 |
| EVAL-01 | `task_quality` case correctly coalesces snake_case/camelCase fields (mirrors `runtimeIngest.test.ts`'s `processSwarmTaskEvent` pattern) | unit (extracted-logic) | `npx vitest run convex/runtimeIngest.test.ts -t "task_quality"` | ❌ Wave 0 (extend existing file) |
| EVAL-02 | Judge output either passes zod validation within 3 attempts, or is dropped with zero row written | unit (fixture replay, no live LLM) | `npx vitest run convex/evalScores.test.ts -t "judge"` | ❌ Wave 0 |
| EVAL-02 | `Promise.allSettled` (not `Promise.all`) used for the per-persona sampling loop — one failed session does not abort the batch | unit (extracted-logic) | `npx vitest run convex/evalScores.test.ts -t "allSettled\|partial failure"` | ❌ Wave 0 |
| EVAL-03 | Regression detector fires only when both sides have ≥5 judged sessions AND the mean drop clears threshold; does not fire on 2-vs-2, 4-vs-6, or a single-outlier swing | unit (synthetic fixtures at the boundary) | `npx vitest run convex/evalScores.test.ts -t "regression"` | ❌ Wave 0 |
| EVAL-03 | Regression alert is created via the `createIfNew`-style delivery path (webhookStatus + scheduled webhook), not the bare public mutation | unit (extracted-logic, assert on the shape of the insert call) | `npx vitest run convex/evalScores.test.ts -t "alert delivery"` | ❌ Wave 0 |
| EVAL-01/02/03 | Live E2E: real Ástríðr-emitted `task_quality` score reaches prod Convex and renders on the Quality page (D-04) | manual, mandatory completion bar | n/a — manual verification step in the plan, not a CI assertion | ❌ Wave 0 (manual checklist item, not a test file) |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/evalScores.test.ts` (and `convex/runtimeIngest.test.ts` when the `task_quality` case is added)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green AND the D-04 manual live-E2E step completed before `/gsd:verify-work` — green tests alone do not close this phase (explicit CONTEXT.md decision, reinforced by the Phase 90 precedent of the exact same failure mode).

### Wave 0 Gaps

- [ ] `convex/evalScores.test.ts` — new file; covers EVAL-01 (idempotency), EVAL-02 (digest/judge/retry/allSettled), EVAL-03 (regression threshold math, alert-delivery shape)
- [ ] Extend `convex/runtimeIngest.test.ts` — add a `task_quality` case test mirroring the existing `processSwarmTaskEvent`-style extracted-logic pattern
- [ ] No framework install needed — vitest/zod already present; no `convex-test` install should be attempted (confirmed absent from the project's testing strategy, not a gap to fill)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (internal, single-operator; existing Clerk-gated dashboard mutations like `setLLMConfig` already require `ctx.auth.getUserIdentity()`) | N/A — no new auth surface added by this phase beyond extending an existing Clerk-gated mutation's slot validation |
| V4 Access Control | Yes | Ingest endpoint reuses `validateIngestAuth` Bearer-token gate (fail-open only when no key configured — existing, unmodified pattern); `setLLMConfig` (storing the eval API key) already requires Clerk identity (`convex/briefings.ts:237-238`) |
| V5 Input Validation | Yes | `v.` Convex validators on every new mutation arg; `zod` `.min(0).max(1)` bounds on judge dimension scores/overall before insert; score-range clamp/reject at both the EVAL-01 ingest path and the EVAL-02 judge-output path |
| V6 Cryptography | No | No new cryptographic operations introduced; API keys stored via the existing `agentConfigs` value-blob pattern (already redacted from public queries per `T-07-05`, `convex/briefings.ts:218-224`) |
| V7 Error Handling / Logging | Yes (via AI-SPEC's own guardrail design) | Judge failures logged with `sessionId` + reason, never the API key (matches existing `T-07-05` redaction discipline); no partial/zeroed row on exhausted retry |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Replayed/duplicated `task_quality` ingest event (at-least-once retry) | Tampering (data integrity) | `by_idempotencyKey` early-return dedup (Pattern 2 above) |
| Unauthenticated ingest POST | Spoofing | `validateIngestAuth` Bearer check, already fail-closed in prod (only fails-open when no key configured at all — a deploy-config concern, not a code gap) |
| Prompt injection via judge digest (a session's tool-output/error text, truncated into the judge's user prompt, contains adversarial instructions) | Tampering (indirect) | Low realistic risk here since the only "attacker" able to influence session content is Larry's own Ástríðr agents acting on his own systems (single-operator, no external/untrusted input per Section 1b's Stakes Level assessment) — no additional mitigation beyond the existing ~200-300 char truncation is warranted for this phase; note as accepted risk, not a gap to close. |
| Regression-alert false positive treated as ground truth without human review | N/A (not a STRIDE category — an operational-trust risk, not a security one) | D-14's ≥5-sessions-per-side + conservative threshold gate; covered fully in AI-SPEC Section 5/6/7, not duplicated here |

---

## Sources

### Primary (HIGH confidence — read directly from the live repo)

- `C:\Users\mandr\codepulse\.planning\phases\93-eval-pipeline-quality-kpis\93-CONTEXT.md` — locked decisions D-01..D-17, discretion areas, deferred ideas
- `C:\Users\mandr\codepulse\.planning\phases\93-eval-pipeline-quality-kpis\93-AI-SPEC.md` — framework selection, judge-call code sketch, evaluation strategy
- `C:\Users\mandr\codepulse\.planning\phases\93-eval-pipeline-quality-kpis\93-UI-SPEC.md` — UI design contract, including Assumption #6 (persona identity resolution)
- `convex/schema.ts` (full file read) — `events`/`sessions`/`agents`/`agentProfiles` (L24-92), `agentConfigs`/`configChanges` (L252-267), `llmMetrics` (L297-320), `profileConfigs`/`profileSwitches` (L495-533)
- `convex/runtimeIngest.ts` (full file read) — the entire `/runtime-ingest` eventType dispatch, ~35 existing cases
- `convex/events.ts` (full file read) — `by_idempotencyKey` early-return dedup pattern
- `convex/briefings.ts` (full file read) — dual-provider LLM caller, config-slot pattern, `setLLMConfig`'s slot validation
- `convex/crons.ts` (full file read) — all existing UTC cron slots
- `convex/alerts.ts` (full file read, ~1144 lines) — `create` vs `createIfNew` delivery-wiring distinction
- `convex/profiles.ts` (full file read) — `upsertConfig`/`updateEmail`/`recordSwitch` and the `configChanges` audit-insert gap
- `convex/agentProfiles.ts` (full file read) — confirms `update` does not write `configChanges`
- `convex/drift.ts`, `convex/ingest.ts` (L190-260) — `configChanges` write-site inventory (full-repo grep of `configChanges` across `convex/*.ts`)
- `convex/sessions.ts` (full file read) — confirms no `profileId` field anywhere in the sessions mutation surface
- `convex/ingestAuth.ts` (full file read) — `validateIngestAuth`/CORS implementation
- `package.json` (full file read) — confirms `zod ^4.4.3`, `convex ^1.42.0`, `react ^19.2.7`, `recharts ^3.8.0`, `vitest ^4.1.9`, and the **absence** of `convex-test`
- `vitest.config.ts` (full file read) — single `jsdom` environment, no Convex-runtime test harness
- `convex/runtimeIngest.test.ts`, `convex/swarmTasks.test.ts`, `convex/cacheStats.test.ts`, `convex/briefings.test.ts` — all four confirm the extracted-pure-function testing convention (three explicitly state "convex-test is not installed in this repo")
- `src/components/MetricCard.tsx`, `src/components/OperatorScoreCard.tsx`, `src/components/StatusBadge.tsx` (full files read) — `thresholdColor`, `SubScoreBar`, `legacyMap` reuse patterns
- `src/components/hr/detail/ResponseTimeChart.tsx`, `src/components/CostTrendChart.tsx`, `src/components/PulseChart.tsx` — real chart-pattern precedents (correcting UI-SPEC's nonexistent `CompletionRateChart.tsx` reference)
- `src/layouts/DashboardLayout.tsx` (grep) — `navGroups`/`iconComponents` structure confirming the OBSERVE nav-group insertion point
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `C:\Users\mandr\CLAUDE.md`, `C:\Users\mandr\codepulse\CLAUDE.md`, `C:\Users\mandr\.claude\CLAUDE.md` — project/requirement/user-instruction context
- Full-repo `grep`/`Bash` searches for `"Loki"`/`"Odin"` (zero matches), `profileSwitches` usages, `configChanges` write-sites, `convex-test` presence, and `CompletionRateChart` existence

### Secondary (MEDIUM confidence)

- None — all findings in this document were verified directly against the live repository; no WebSearch/external-source claims were needed since this phase's technical domain is entirely internal codebase convention, not a third-party library API question.

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version number read directly from `package.json`, no training-data guesses
- Architecture: HIGH — every pattern cited with `file:line` from a direct read of the actual mutation/action code, not inferred
- Pitfalls: HIGH — the persona-identity gap, the configChanges audit-trail gap, the convex-test absence, and the CompletionRateChart nonexistence are all confirmed by direct grep/read, not speculation
- Security: MEDIUM — ASVS mapping is straightforward given the existing auth/validation patterns already in place; no new threat surface introduced by this phase beyond what's already mitigated elsewhere in the codebase

**Research date:** 2026-07-05
**Valid until:** 30 days (stable internal-codebase conventions; re-verify if `astridr-repo`'s emitter schema for `task_quality`/`llm_call` changes in the meantime, since that directly affects Open Question 1)
