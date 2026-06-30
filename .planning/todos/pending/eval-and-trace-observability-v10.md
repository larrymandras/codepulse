---
id: TODO-eval-trace-observability
status: pending
planted: 2026-06-30
planted_during: Cross-Repo Capability Audit (2026-06-30, ecosystem-sourced)
trigger_when: Next CodePulse milestone (v10.0). The marquee pair — do #2 + #3 together; they share the evalScores table and both ride existing llmMetrics data.
scope: Medium (one milestone, two phases)
source: 04-research/cross-repo-capability-audit-2026-06-30.md (#2, #3); patterns from Langfuse v3 / Arize Phoenix
producer_repo: astridr (already emits task_quality via langfuse_eval.py; sends per-call data to llmMetrics)
---

# TODO: Eval + Trace Observability for CodePulse (v10.0 marquee pair)

CodePulse is Astridr's observability surface but has two high-leverage gaps the data already supports. Do both as one milestone — they share the `evalScores` table.

## Phase A — LLM-as-judge eval pipeline + ingest (audit #2)

**Gap:** Astridr already *emits* binary `task_quality` scores (`astridr/.../langfuse_eval.py`), but CodePulse has **no endpoint, table, or UI** to receive them (grep `convex/` for `llm_judge`/`eval_pipeline` → 0 matches; the only "eval" surface is `convex/memoryQuality.ts`, which is memory dedup/staleness, not agent-output quality). So the scores hit the floor.

**Build:**
- An `evalScores` table + an ingest endpoint for Astridr's emitted scores.
- A nightly Convex `internalAction` that LLM-judges sampled sessions on a rubric.
- A quality KPI + regression detection when a persona's model/instructions change.

## Phase B — Native trace waterfall on `llmMetrics` (audit #3)

**Gap:** `LangfuseTraceLink.tsx` is a **static dead link** (no trace id, no in-app tree), yet per-call LLM data already flows into `llmMetrics` (`convex/schema.ts:297-320`, with `by_goal` rollups from Phase 149).

**Build:**
- A `traceId` grouping field on `llmMetrics`.
- An in-app call-chain UI: timing bars, cost-per-call, cache annotation.
- Defer self-hosted Langfuse/Phoenix — the data's already in Convex.

## Success criteria

1. Astridr's `task_quality` scores are received, stored, and visualized; a persona model/instruction change that drops quality is detectable.
2. A session's LLM calls render as a trace waterfall with per-call timing + cost + cache info.
3. Both ride existing `llmMetrics`/`evalScores` data — no new transport from Astridr.

## Related (not part of this todo)

- Audit #5 (per-session cache rollup + the `runtimeIngest.ts:642` data-loss bug) is a separate knock-out-now item, but its ingest fix is adjacent — coordinate.
