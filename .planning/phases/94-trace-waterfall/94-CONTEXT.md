# Phase 94: Trace Waterfall - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators can open any session and see exactly how its LLM call chain executed — ordered timing bars, per-call cost, and cache-hit annotations — natively inside CodePulse. `llmMetrics` gains a `traceId` grouping field (schema + ingest pass-through, backward compatible with rows that lack it — TRACE-01), rendered as an in-app trace waterfall (TRACE-02). The dead-link `LangfuseTraceLink.tsx` is removed. Includes the Ástríðr-side emitter change needed to make `traceId` real (nothing emits one today). Eval pipeline (Phase 93, complete) and hardening (Phase 95) are out of scope; self-hosted Langfuse/Phoenix explicitly excluded (REQUIREMENTS.md).

</domain>

<decisions>
## Implementation Decisions

### traceId provenance & scope (TRACE-01)
- **D-01: Ástríðr-side emitter change is IN this phase** (Phase 93 D-01 precedent). No producer exists today — the `llm_call` payload (`anthropic_provider.py` ~L563) carries no trace field, so "ingest pass-through" is dead weight without this. Follow the proven cross-repo pattern (astridr commits `26874fac`/`97c63643`).
- **D-02: One traceId = one agent-loop turn.** All LLM calls made while handling one user message / one loop iteration share a traceId. A session contains many traces stacked in the waterfall.
- **D-03: traceId is generated once in the agent loop and propagated via contextvar**, mirroring the existing `goalId` `get_goal_context()` pattern — so ALL emitting providers (anthropic_provider, openrouter, ollama) attach it uniformly with one mechanism. No per-provider ID generation.
- **D-04: Backward compatibility = flat chronological fallback.** Rows without `traceId` (all existing rows, plus any future untraced emitters) render as an ungrouped chronological "untraced" section in the same waterfall. No time-gap pseudo-trace inference — zero invented boundaries. Satisfies TRACE-01's no-break criterion.
- **D-05: Live E2E completion bar** (carried from Phase 93 D-04 / Phase 90 lesson): the phase is not done until a real Ástríðr-emitted `llm_call` carrying a `traceId` lands in prod Convex (`tidy-whale-981`) and renders grouped in the waterfall. Explicit verification step in the plan; convex-test green alone does not close the phase.

### Waterfall placement & entry (TRACE-02)
- **D-06: Waterfall lives as a new "Trace" tab on SessionDetail** — added to the existing tab bar (overview/timeline/files/bash/errors). No new route or nav entry.
- **D-07: `LangfuseTraceLink.tsx` is removed outright** — delete the component and its Analytics header slot (`Analytics.tsx` L30/L83). No replacement affordance in the Analytics header; per-session traces are reached through session drill-in.
- **D-08: Trace tab is deep-linkable** via URL param (e.g., `/sessions/:id?tab=trace`), and rows in existing LLM-call tables (Analytics recent calls) cross-link to their session's trace — following the v8.0/v9.0 cross-nav deep-link house pattern (`?event=`, `?goal=`).

### Waterfall rendering (TRACE-02)
- **D-09: New `TraceWaterfall` component, Gantt-styled** — purpose-built for `llmMetrics` rows (bar start = `timestamp − latencyMs`, width = duration), mirroring `GanttTimeline`'s structure and time-axis conventions but NOT entangling its agents/events props. Custom flex/CSS bars per house convention; no new chart library.
- **D-10: Vertical layout = collapsible trace groups with per-call rows.** Each trace (turn) is a collapsible group with a header showing total duration/cost; each LLM call is its own row within the group, bars positioned on the shared session time axis. Untraced legacy calls form one flat group at the end (per D-04).
- **D-11: Bar labels = model + cost + cache badge inline** (e.g., "opus-4-8 · $0.042 · 92% cached"); hover/click reveals full detail — tokens in/out, cacheRead/cacheCreation, latency, provider, toolName, billingType.
- **D-12: Live-updating via native Convex reactivity** — the Trace tab uses `useQuery` on `llmMetrics` `by_session`; new calls appear as they ingest, time axis extends. No polling code.

### Cache & cost annotations (TRACE-02)
- **D-13: Cache badge is three-state with hit ratio:** HIT (`cacheReadInputTokens > 0`, badge shows read ratio e.g. "92% cached"), MISS (cache fields present but reads = 0), NO DATA (legacy rows lacking cache fields — no badge, never rendered as a fake miss).
- **D-14: No client-side cost estimation.** Missing `cost` renders as a dash/"n/a"; trace and session totals footnote "N calls without cost". No fallback price-table derivation — zero invented numbers (standing precision bar), no second cost-derivation path to drift.
- **D-15: Session-level MetricCard summary strip above the waterfall** — total LLM cost, call count, total tokens, overall cache-read ratio — reusing the MetricCard pattern already on SessionDetail.

### Claude's Discretion
- traceId format (uuid4 vs prefixed id) and the exact payload/ingest field aliases (`traceId`/`trace_id`), following the existing snake/camel alias convention in `runtimeIngest.ts`.
- Whether `llmMetrics` needs a `by_trace` index or whether `by_session` + client-side grouping suffices at session-scale volumes.
- Loop-level insertion point for the contextvar in `astridr/agent/loop.py` (where a "turn" begins/ends) and its interaction with the existing goal-context plumbing.
- Time-axis stability handling while live updates arrive (D-12), zoom/scroll behavior for very long sessions, error-call bar styling.
- Empty states: session with zero `llmMetrics` rows; sessions where all rows are untraced.
- Exact hover/click mechanism (tooltip vs side panel) within the D-11 constraint.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & scoping
- `.planning/REQUIREMENTS.md` — TRACE-01/02 definitions; out-of-scope list (no self-hosted Langfuse/Phoenix, no new transport protocol)
- `.planning/ROADMAP.md` — Phase 94 entry and success criteria (4 criteria incl. backward compatibility and LangfuseTraceLink replacement)
- `.planning/todos/completed/eval-and-trace-observability-v10.md` — milestone seed with the original gap analysis

### CodePulse integration points
- `convex/schema.ts` — `llmMetrics` table (L297): existing fields (`latencyMs`, `cost` optional, `cacheReadInputTokens`, `cacheCreationInputTokens`) and indexes (`by_session`) the waterfall reads; where `traceId` lands
- `convex/runtimeIngest.ts` — `llm_call` case (L58): snake/camel alias pass-through pattern to extend with `traceId`
- `convex/llm.ts` — `recordCall` mutation + session-scoped queries the Trace tab builds on
- `src/pages/SessionDetail.tsx` — tab bar to extend with the Trace tab; existing `useQuery` wiring per tab
- `src/components/GanttTimeline.tsx` — structural/time-axis reference for the new `TraceWaterfall` (do not entangle; D-09)
- `src/components/LangfuseTraceLink.tsx` + `src/pages/Analytics.tsx` (L30, L83) — the component and usage to DELETE (D-07)

### Producer (cross-repo — Ástríðr)
- `C:/Users/mandr/astridr-repo/astridr/providers/anthropic_provider.py` (~L560-580) — `llm_call` telemetry payload to extend with `traceId`; the `get_goal_context()` goalId propagation pattern to mirror
- `C:/Users/mandr/astridr-repo/astridr/providers/openrouter.py`, `.../providers/ollama.py`, `.../providers/base.py` — the other `llm_call` emit sites that must pick up the contextvar (D-03)
- `C:/Users/mandr/astridr-repo/astridr/agent/loop.py` — where the per-turn traceId contextvar is set
- Phase 90/93 cross-repo precedent: astridr commits `26874fac` (transcript mirror) and `97c63643` (war-room ingest) — env-gated emitter-change pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `llmMetrics` already carries everything the bars need — `latencyMs`, optional `cost`, `cacheReadInputTokens`, `cacheCreationInputTokens`, `by_session` index — no data backfill required, only the new `traceId` field
- `GanttTimeline.tsx` (278 lines): session-relative time axis, lane rendering, hover conventions to mirror in `TraceWaterfall`
- SessionDetail tab bar: adding a tab is a `TABS` array entry + conditional `useQuery`
- MetricCard: summary strip (D-15); `SectionErrorBoundary` + `InfoTooltip` for the new tab section
- Cross-nav deep-link pattern (v8.0 Phase 85 / quick tasks 260629): URL-param focus + back-chips, strict no-fuzzy matching

### Established Patterns
- Ingest aliases: every `llm_call` field accepts snake_case and camelCase (`runtimeIngest.ts` L63-74) — `traceId ?? trace_id` follows suit
- New optional fields on existing tables are the house backward-compat mechanism (`agentId`, `goalId`, cache fields were all added this way with `v.optional`)
- Ástríðr context propagation: `goalId` flows to telemetry via `get_goal_context()` contextvar — traceId mirrors this exactly (D-03)
- Theme-aware UI via `useThemeColors()`; Lucide icons only; custom flex/CSS charts over chart libs
- Live surfaces ride Convex `useQuery` reactivity — no polling

### Integration Points
- Ástríðr: loop.py sets per-turn traceId contextvar → providers attach it to `llm_call` payloads → existing telemetry ConvexHandler → `/runtime-ingest` (no transport change)
- Convex: `schema.ts` `traceId: v.optional(v.string())` on `llmMetrics` + `recordCall` arg + `runtimeIngest.ts` pass-through
- Frontend: SessionDetail Trace tab → `TraceWaterfall` component + summary strip; Analytics LLM-call rows → deep-link to `/sessions/:id?tab=trace`; `LangfuseTraceLink` deleted

</code_context>

<specifics>
## Specific Ideas

- The waterfall's mental model is "one turn = one collapsible trace group" — an operator scanning a session should see turns stack chronologically, expand one, and read the call chain inside it.
- Honesty over polish in annotations: NO DATA is distinct from MISS, missing cost is a dash not an estimate — consistent with the standing zero-false-positive precision bar.
- Phase 90/93's live-integration lesson is codified as D-05: the cross-repo gate is a plan verification step ("real traceId in prod, grouped render in UI"), not a scoping footnote.

</specifics>

<deferred>
## Deferred Ideas

- **Per-session cache rollup surface** — already listed in REQUIREMENTS.md Future Requirements (capability-audit #5 follow-on); the D-15 summary strip shows session cache ratio but a dedicated rollup/analytics surface stays deferred.
- **Time-gap pseudo-trace inference for legacy rows** — rejected for this phase (D-04); revisit only if the untraced fallback proves unreadable for long historical sessions.
- **Standalone cross-session Traces page** — placement decision chose the SessionDetail tab; a global trace browser would be its own phase if ever needed.

</deferred>

---

*Phase: 94-Trace Waterfall*
*Context gathered: 2026-07-06*
