# Phase 93: Eval Pipeline & Quality KPIs - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the eval-score loop end-to-end: Ástríðr's `task_quality` scores land in a new `evalScores` Convex table via the existing Bearer-authed ingest path (EVAL-01), a nightly Convex `internalAction` LLM-judges sampled sessions against a code-defined rubric (EVAL-02), and the operator sees per-persona quality KPIs with regression detection joined against `profileSwitches`/`configChanges` (EVAL-03). Includes the small Ástríðr-side mirror emit needed to make EVAL-01 real. Trace waterfall (`traceId`, Phase 94) and hardening (Phase 95) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Cross-repo emitter (EVAL-01)
- **D-01: Ástríðr-side change is IN this phase.** `langfuse_eval.py:spawn_score()` currently writes only to Langfuse — nothing POSTs to CodePulse. Add a fire-and-forget mirror POST to CodePulse from the score path, following the Phase 90 transcript-ingest mirroring precedent (astridr commit `26874fac`, `CONVEX_URL` + `ASTRIDR_INGEST_API_KEY` env pattern).
- **D-02: Transport = new `task_quality` eventType case on the existing `/runtime-ingest` dispatch** in `convex/runtimeIngest.ts`. No new HTTP route; inherits the `validateIngestAuth` Bearer gate and CORS.
- **D-03: Dual-write with independent gates.** The Langfuse write stays as-is behind `LANGFUSE_*` keys; the CodePulse mirror fires whenever `CONVEX_URL` + ingest key are configured. Neither blocks the other; the local `_score_cache` / `get_score_trend()` used by `self_improvement.py` is untouched.
- **D-04: Completion bar = live E2E.** The phase is not done until a real Ástríðr-emitted `task_quality` score lands in prod Convex (`tidy-whale-981`) and renders in the UI. This must be an explicit verification step in the plan — convex-test green alone does not close the phase (Phase 90 lesson: the cross-repo gate was flagged but never closed until live testing surfaced 5 gaps).
- **D-05: Idempotency on at-least-once retry is required** (EVAL-01 wording). Key mechanics are Claude's discretion (see below), but a redelivered score must not double-insert.

### Nightly LLM judge (EVAL-02)
- **D-06: Judge input = Convex-resident data only.** The judge reads `events` (tool activity + payloads), `sessions` metadata, and `llmMetrics` stats for the session. Hard constraint: the Convex cloud action cannot reach the local Ástríðr API (localhost:8181), so no transcript fetches. The rubric judges observable behavior (errors, retries, tool churn, cost/efficiency), not conversational content. No new transcript mirror in this phase.
- **D-07: Dedicated eval LLM config slot, default `claude-haiku-4-5`.** Reuse the `briefings.ts` caller pattern (configurable provider/model/apiKey slot, anthropic + openai support) but as a separate slot so changing the briefings model never silently shifts judge scoring. NOTE: Opus 4.8+/Claude 5 SDKs have no `budget_tokens` — do not add extended-thinking config to the judge call.
- **D-08: Sampling = per-persona nightly quota** — up to ~3 completed sessions per active persona per night, randomly chosen within the day. Guarantees every persona's KPI trend accrues data (what EVAL-03 needs); nightly cost bounded by persona count.
- **D-09: Rubric = multi-dimension + overall.** 3–4 code-defined dimensions (suggested: task completion, error handling, efficiency/tool discipline, cost discipline), each scored 0–1, plus an overall. Stored per-dimension in `evalScores` via a score-name/dimension field so Ástríðr's binary `task_quality` slots in as just another named score in the same table. Rubric editing UI explicitly deferred (REQUIREMENTS.md Future).
- **D-10: Judge stores a short per-dimension rationale** with each score (see D-16).

### Regression detection (EVAL-03)
- **D-11: Change boundary = BOTH `profileSwitches` rows AND persona-scoped `configChanges` rows** (configKeys mapping to a persona's model/instructions). Either kind of change starts a comparison window.
- **D-12: Detection = before/after window means.** Compare mean overall score in a window before vs after the change event (~7 days each side), require a minimum judged-session count per side, flag when the drop exceeds a threshold. Chosen over z-score (too noisy at ~3 samples/night) and over UI-only comparison.
- **D-13: On detection, raise an alert through the existing alert engine** so it inherits Discord/Slack/PagerDuty/email routing, acknowledge/mute lifecycle, and severity preferences. Regression is an operational event like any other alert.
- **D-14: Conservative, code-defined thresholds.** Minimum ≥5 judged sessions per side and a meaningful drop before alerting — zero-false-positive bias (Larry's standing precision bar). Constants live in code; tuned by commit, no settings UI in this phase.

### Quality KPI surface (EVAL-03)
- **D-15: New dedicated Quality page** — standard pattern: `src/pages/` + route in `App.tsx` + nav entry in `DashboardLayout.tsx` (`navItems` + `iconMap`). Not a section on Analytics or Agents.
- **D-16: Layout = per-persona KPI cards + drill-in detail.** Card grid (current score, sparkline, delta badge) → persona detail with full trend, change-event markers (profile switches / config changes), per-dimension breakdown, and a judged-sessions list showing the judge's rationale with a link to the session. Reuse MetricCard/EntityRow patterns.
- **D-17: History = 30-day default with a range picker.** `evalScores` rows kept indefinitely — volume is tiny (a few rows/night), no archival sweep, no 16 MiB risk.

### Claude's Discretion
- Idempotency key mechanics for `task_quality` ingest (producer-generated id vs derived key) — follow the Phase 88 `idempotencyKey` + `by_idempotencyKey` early-return precedent.
- `evalScores` schema details (field names, indexes), persona identity mapping (producer `agent_id` ↔ persona/profileId), and which configKeys count as "persona-scoped".
- Exact rubric dimension names/wording, judge prompt, and structured-output parsing.
- Cron time slot (pick an unused UTC slot; existing crons cluster 01:00–06:05 — avoid scheduler contention per the Phase 82/83 offset precedent).
- Chart implementation (custom flex charts vs D3, per existing conventions) and empty-state design before data accrues.
- Exact threshold/window constants for D-12/D-14 (within the conservative bounds stated).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scoping
- `.planning/REQUIREMENTS.md` — EVAL-01..03 definitions, out-of-scope list (no Langfuse/Phoenix self-hosting, no new transport protocol)
- `.planning/ROADMAP.md` — Phase 93 entry and success criteria
- `.planning/todos/pending/eval-and-trace-observability-v10.md` — milestone seed with the original gap analysis (audit #2)

### Producer (cross-repo — Ástríðr)
- `C:/Users/mandr/astridr-repo/astridr/integrations/langfuse_eval.py` — the score producer to modify (`spawn_score` / `_write_score`); note T-73-16 (scores carry only numeric values + agent_id/session_id, no PII) and RELI-03 flush semantics
- `C:/Users/mandr/astridr-repo/tests/test_langfuse_eval.py` — existing producer tests to extend
- Phase 90 mirror precedent: astridr commits `26874fac` (transcript mirror) and `97c63643` (war-room ingest) — the fire-and-forget POST + compose env-anchor pattern to copy

### CodePulse integration points
- `convex/runtimeIngest.ts` — Bearer-authed eventType dispatch where the `task_quality` case lands; `validateIngestAuth` gate
- `convex/schema.ts` — `llmMetrics` (L297), `configChanges` (L259), `profileSwitches` (L528), `events`/`sessions` (L24/L42) shapes and indexes
- `convex/briefings.ts` — the existing configurable LLM caller (anthropic/openai fetch pattern, config slots, T-07-05 apiKey redaction) to reuse for the judge
- `convex/crons.ts` — cron registration patterns and existing UTC slot usage
- `convex/alerts.ts` — alert engine the regression detector feeds

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runtimeIngest.ts` dispatch: ~35 eventType cases behind one Bearer gate — `task_quality` is one more case + domain mutation
- `briefings.ts` LLM caller: provider-switched fetch (anthropic `x-api-key` / openai Bearer), config-slot storage with public-query key redaction — the judge action reuses this wholesale
- Phase 88 idempotency precedent: `idempotencyKey` field + `by_idempotencyKey` index + early-return dedup inside one OCC mutation
- Alert engine: rules, severity routing, delivery channels, ack/mute lifecycle — regression detection plugs in rather than building notification plumbing
- UI: MetricCard, EntityRow, sparkline/flex-chart patterns, `SectionErrorBoundary`, `InfoTooltip`; page-addition pattern (pages/ + App.tsx route + DashboardLayout navItems/iconMap)

### Established Patterns
- Nightly work = `crons.daily` + `internalAction`; existing slots cluster 01:00–06:05 UTC with deliberate offsets to avoid scheduler contention
- All ingest mutations validate with `v.` validators; `internalMutation` for anything cron-written (never public — Phase 88 T-88-03)
- Reads must stay 16 MiB-safe: paginate or index-bound; `evalScores` volume is small but queries should still be index-first
- Theme-aware UI via `useThemeColors()`; Lucide icons only

### Integration Points
- Ástríðr side: `spawn_score()` → mirror POST to `${CONVEX_URL}/runtime-ingest` gated on `CONVEX_URL`+`ASTRIDR_INGEST_API_KEY` (compose env anchor already exists from Phase 90)
- Convex: new `evalScores` table + `evalScores.ts` domain module (ingest mutation, judge write path, KPI queries, regression internalAction) + cron entries
- Frontend: new Quality page + `useEvalScores`-style hook wrapping `useQuery`
- Regression alerts → existing `alerts` tables/delivery

</code_context>

<specifics>
## Specific Ideas

- Phase 90's live-integration failure is the explicit reference point: the cross-repo gate goes IN the plan as a verification step, not a scoping footnote. "Done" = real score, prod Convex, visible UI.
- Ástríðr's binary `task_quality` and the nightly judge's rubric scores share one `evalScores` table, distinguished by score name/source — one KPI surface reads both.
- Judge scoring comparability matters: dedicated config slot exists specifically so the judge model doesn't drift when other surfaces change models.

</specifics>

<deferred>
## Deferred Ideas

- **Session-transcript mirroring into Convex** (would enable conversational-quality judging) — new capability, own phase if ever; the current rubric judges observable behavior only.
- **Rubric editing UI** — already listed in REQUIREMENTS.md Future Requirements; v1 rubric is code-defined.
- **Settings knobs for regression thresholds** — revisit only if code-defined constants prove too rigid.
- **evalScores archival sweep** — unnecessary at current volume; reconsider if judge sampling scales up.

### Reviewed Todos (not folded)
- `eval-and-trace-observability-v10.md` (match score 0.2) — this is the milestone seed itself, already formalized into REQUIREMENTS.md/ROADMAP.md on 2026-07-04; kept as a canonical ref rather than folded as a new decision. Its `resolves_phase: 93` frontmatter means Phase A of the todo closes with this phase.

</deferred>

---

*Phase: 93-Eval Pipeline & Quality KPIs*
*Context gathered: 2026-07-05*
