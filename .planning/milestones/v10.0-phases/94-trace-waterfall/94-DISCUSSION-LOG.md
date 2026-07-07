# Phase 94: Trace Waterfall - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 94-Trace Waterfall
**Areas discussed:** traceId provenance & scope, Waterfall placement & entry, Waterfall rendering, Cache & cost annotations

---

## traceId provenance & scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, cross-repo in phase | Mirror of Phase 93 D-01: without a producer the waterfall can only group by sessionId; follows the fire-and-forget emitter-change precedent (astridr 26874fac) | ✓ |
| CodePulse-only | Schema + pass-through + waterfall grouped by sessionId; Ástríðr emitter deferred | |
| You decide | Claude picks during planning | |

**User's choice:** Ástríðr-side emitter change is in this phase.

| Option | Description | Selected |
|--------|-------------|----------|
| One agent-loop turn | All LLM calls handling one user message/loop iteration share a traceId; a session contains many traces | ✓ |
| One task/goal | traceId follows goal context; coarser, needs fallback for goal-less turns | |
| One session | traceId ≈ sessionId; adds nothing over by_session index | |

**User's choice:** One traceId = one agent-loop turn.

| Option | Description | Selected |
|--------|-------------|----------|
| Flat chronological fallback | Untraced rows render as an ungrouped chronological section; zero inference | ✓ |
| Time-gap pseudo-traces | Cluster untraced rows by idle-gap heuristic; invents boundaries | |
| Traced rows only | Waterfall shows only rows carrying traceId | |

**User's choice:** Flat chronological fallback for rows without traceId.

| Option | Description | Selected |
|--------|-------------|----------|
| All emitting providers | Generate traceId once in the agent loop (contextvar, mirroring goalId pattern); every provider picks it up | ✓ |
| Anthropic only first | Smallest cross-repo diff; partial waterfall coverage | |
| You decide | Claude picks after reading telemetry handler sharing | |

**User's choice:** All emitting providers via loop-level contextvar.

---

## Waterfall placement & entry

| Option | Description | Selected |
|--------|-------------|----------|
| SessionDetail "Trace" tab | Add to existing tab bar; zero new routes or nav entries | ✓ |
| Standalone Traces page | New page + route + nav (Quality-page pattern) | |
| Both | Tab as canonical + thin standalone recent-traces page | |

**User's choice:** SessionDetail Trace tab.

| Option | Description | Selected |
|--------|-------------|----------|
| Remove it outright | Delete LangfuseTraceLink component and Analytics header slot | ✓ |
| In-app "Traces" affordance | Replace with link/dropdown to recent sessions' Trace tabs | |
| You decide | Claude picks during planning | |

**User's choice:** Remove LangfuseTraceLink outright.

| Option | Description | Selected |
|--------|-------------|----------|
| URL param + LLM-call cross-links | Tab addressable via URL; LLM-call table rows deep-link to session trace (house cross-nav pattern) | ✓ |
| URL param only | Addressable but no new cross-links this phase | |
| No deep-linking | Tab is local UI state only | |

**User's choice:** URL param + cross-links from LLM-call tables.

---

## Waterfall rendering

| Option | Description | Selected |
|--------|-------------|----------|
| New TraceWaterfall, Gantt-styled | Purpose-built for llmMetrics (bar start = timestamp − latencyMs); mirrors GanttTimeline conventions without entangling it; custom flex/CSS bars | ✓ |
| Extend GanttTimeline | Generalize existing component; touches shipped surface, mixes data models | |
| You decide | Claude weighs reusability during planning | |

**User's choice:** New Gantt-styled TraceWaterfall component.

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by trace, rows per call | Collapsible trace groups (turn header with duration/cost), one row per call, shared time axis; untraced group at end | ✓ |
| One row per call, flat | Chronological rows; traceId as color/label only | |
| Lane per trace | One lane per trace; cramped for many-call turns | |

**User's choice:** Collapsible trace groups with per-call rows.

| Option | Description | Selected |
|--------|-------------|----------|
| Model+cost inline, rest on hover | Bar label model + cost + cache badge; hover/click reveals tokens, cache, latency, provider, toolName, billingType | ✓ |
| Minimal bars, click-to-panel | Duration/color only; detail side panel on click | |
| Everything inline | All fields on the bar row; dense | |

**User's choice:** Model + cost + cache badge inline; full detail on hover/click.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, native Convex reactivity | useQuery on llmMetrics by_session; new calls appear as ingested | ✓ |
| Static snapshot | Render once with manual refresh | |
| You decide | Claude picks (likely reactive with axis-stability handling) | |

**User's choice:** Live-updating via native Convex reactivity.

---

## Cache & cost annotations

| Option | Description | Selected |
|--------|-------------|----------|
| Three-state + hit ratio | HIT (reads > 0, shows read ratio), MISS (fields present, reads = 0), NO DATA (legacy rows — no badge, not fake miss) | ✓ |
| Binary hit/miss | Rows without fields render as MISS; mislabels legacy rows | |
| Token counts only | Raw cache token numbers, no derived state | |

**User's choice:** Three-state cache badge with hit ratio.

| Option | Description | Selected |
|--------|-------------|----------|
| Show — (no estimate) | Missing cost renders as dash; totals footnote "N calls without cost"; no client-side estimation | ✓ |
| Estimate from pricing registry | Tokens × pricing registry, marked ≈; second derivation path can drift | |
| You decide | Claude checks prod missing-cost frequency | |

**User's choice:** Dash, no estimation — zero invented numbers.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, MetricCard strip | Total cost, call count, total tokens, overall cache-read ratio above the waterfall | ✓ |
| No, bars only | Totals only in trace group headers | |
| You decide | Claude checks Overview-tab overlap | |

**User's choice:** MetricCard summary strip on the Trace tab.

---

## Claude's Discretion

- traceId format and ingest field aliases (traceId/trace_id)
- Whether llmMetrics needs a by_trace index vs by_session + client grouping
- Loop-level contextvar insertion point in astridr loop.py (turn boundaries)
- Time-axis stability during live updates, zoom/scroll for long sessions, error-call styling
- Empty states (no llmMetrics rows; all-untraced sessions)
- Hover tooltip vs side panel mechanics

## Deferred Ideas

- Per-session cache rollup surface (already in REQUIREMENTS.md Future Requirements)
- Time-gap pseudo-trace inference for legacy rows (rejected D-04; revisit only if fallback proves unreadable)
- Standalone cross-session Traces page (own phase if ever needed)
