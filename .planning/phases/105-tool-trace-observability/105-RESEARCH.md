# Phase 105: Tool & Trace Observability - Research

**Researched:** 2026-08-03
**Domain:** Convex ingest/schema extension + React/Recharts observability UI, cross-repo (astridr-repo Python telemetry emitters)
**Confidence:** HIGH

## Summary

This phase is almost entirely a **verification exercise, not a discovery exercise** — `105-CONTEXT.md` already
names exact files, line numbers, and payload shapes for every decision (D-01..D-16), all gathered live against
the running self-hosted Convex and the astridr-repo checkout. This research independently re-read every cited
file in both repos and confirms every claim in CONTEXT.md is accurate as of 2026-08-03: `runtimeIngest.ts`'s
`tool_executed` case (line 841) really does only upsert `callGraphEdges`; the switch really has no
`tool_policy_event` case and no `default`; `loop.py:2051`'s `tool_executed` emit really omits `durationMs`
despite `_duration_ms` being computed one line above and discarded; the leak-detector's `telemetry.send` at
`loop.py:1471-1476` really drops `tool_was_offered`/`tools_offered_count`/`round`/`agentId` that are live local
variables in the `logger.warning` call five lines above; no per-round ContextVar exists anywhere in
`astridr/engine/telemetry.py` today; and `astridr/engine/config.py:1166-1187` really does set
`_tool_policy_malformed_signal = {"field": ..., "error": ...}`, the exact payload shape both `bootstrap/core.py`
call sites forward under `event: "malformed_policy_boot"` / `"malformed_policy_reload_rejected"`.

One gap this research adds beyond CONTEXT.md: `astridr-repo/docs/astridr-contract.md` §2.34 (`tool_policy_event`)
already documents 3 of the 4 kinds (`malformed_policy_boot`, `malformed_policy_reload_rejected`,
`execution_denied`) with exact field tables — but **omits `tool_call_leaked_as_text` entirely**, and doesn't yet
document the widened fields D-08 adds. The single astridr-repo commit this phase makes should update §2.34 to
add the fourth kind and the widened leak/tool_executed field sets, matching this project's contract-first
convention (Phase 103/104 precedent).

**Primary recommendation:** Execute D-01 through D-16 exactly as specified in CONTEXT.md — do not re-litigate
any decision. This document exists to hand the planner verified line numbers, payload shapes, existing helper
signatures, and the handful of things CONTEXT.md left to "planning discretion" (table/index names, aggregate
metric-type naming, row caps, chart primitives) with concrete recommendations.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool call recording (OBS-01) | API/Backend (Convex mutation, `runtimeIngest.ts` case + `toolExecutions.insert`) | Database (new rows + hourly aggregate buckets) | Ingest boundary already exists; this is a data-completeness fix, not new architecture |
| Tool-usage "over time" charts (OBS-01) | Frontend (React query hooks + Recharts/FlexBarChart) | Database (`aggregates` table, index-bounded reads) | Rendering reads pre-aggregated buckets so the browser never re-derives frequency from raw rows |
| Tool-policy/leak ingest (OBS-02) | API/Backend (new `runtimeIngest.ts` case + new `toolPolicyEvents` table) | — | New table, new case — a pure additive ingest-boundary fix, same tier as OBS-01 |
| Policy alerting (OBS-02, D-06) | API/Backend (`computeHourly` tail, `alerts` insert + `internal.webhookDelivery.sendAlertWebhook`) | — | Reuses Phase 104's evaluator-at-cron-tail pattern; no new tier, no new cron |
| Trace nesting / cache ratio (OBS-03) | Frontend (`TraceWaterfall.tsx` pure helpers + nested `Collapsible`) | API/Backend (`llm.sessionCalls` / `toolExecutions.listBySession`, both need row caps) | Grouping/nesting logic is client-side (existing convention); the two feeder queries are the only backend surface touched |
| Round/trace attribution (OBS-03, D-10) | Astridr backend (Python ContextVar in `agent/loop.py` + 3 provider files) | — | Cross-repo — CodePulse cannot infer nesting without astridr reporting it explicitly |
| Cross-links from existing panels (D-15) | Frontend (`Link` additions to 3 existing components) | — | Pure navigation, zero data-flow change |

## User Constraints (from CONTEXT.md)

### Locked Decisions

D-01 through D-16 are locked (see full text in `105-CONTEXT.md`). Verbatim summary, one line each:

- **D-01** — Ástríðr tool calls land as per-call rows in `toolExecutions` via an added `runMutation` inside the existing `case "tool_executed"` (`convex/runtimeIngest.ts:841`); the `callGraphEdges` upsert stays (Tool Galaxy reads it).
- **D-02** — Rows are `provider`-tagged (reuse existing optional field); default Tools-page view is Ástríðr-only, never a mixed ranking by accident.
- **D-03** — One astridr-repo commit adds `durationMs` (from the already-computed, currently-discarded `_duration_ms`) and `traceId` (from the existing `get_trace_context()`) to the `tool_executed` payload at `astridr/agent/loop.py:2051`.
- **D-04** — "Over time" is served by hourly aggregate buckets (same pattern as Phase 104's `tokens_prompt`/`tokens_completion`), attached to `computeHourly`'s tail; raw `toolExecutions` rows stay the 14-day drill-down (retention NOT raised).
- **D-05** — New dedicated `toolPolicyEvents` table, index-bounded, closing the fact that `runtimeIngest.ts`'s switch has no `tool_policy_event` case and no `default` (all 4 kinds silently dropped today).
- **D-06** — Alert only on `malformed_policy_boot` and `malformed_policy_reload_rejected` (the fail-open kinds); `tool_call_leaked_as_text` and `execution_denied` are view-only. Delivery reuses Phase 104's exact path (`alerts` insert + `internal.webhookDelivery.sendAlertWebhook`, evaluated at `computeHourly`'s tail, try/catch-wrapped). No new `convex/crons.ts` entry.
- **D-07** — Ingest path proven by inducing real events live during execution (the 104-11 pattern), not shipped-and-hoped; the panel states when it last received *any* policy event so later silence is distinguishable from a dead pipe.
- **D-08** — Same astridr commit widens the leak payload with `tool_was_offered`, `tools_offered_count`, `round`, `agentId` (all already local variables at the `logger.warning` call, currently dropped from the `telemetry.send` three lines below).
- **D-09** — Tool executions nest under the LLM call that triggered them — two levels of the existing `Collapsible` in `TraceWaterfall.tsx` (trace group → LLM call → tool executions).
- **D-10** — Nesting attribution is reported via a new per-round ContextVar in astridr (mirrors the existing `traceId` ContextVar pattern) — `llm_call` is emitted from inside each provider, which has no access to the loop's `round_num`, so inference-by-timestamp is rejected.
- **D-11** — Per-turn cache visibility = a cache ratio on the trace-group header, using the identical `read / (read + creation + prompt)` denominator already in `computeSummary` (`TraceWaterfall.tsx`) and `shapeCacheAcc` (`convex/llm.ts`) — one formula, not three.
- **D-12** — Both feeder reads (`llm.sessionCalls`, `toolExecutions.listBySession`) are capped (both are unbounded `.collect()` today); truncation is stated on screen; confirm `TraceWaterfall` sits inside a `SectionErrorBoundary`.
- **D-13** — A new dedicated Tools page owning OBS-01's usage analytics + OBS-02's policy/leak feed.
- **D-14** — Sits in the `OBSERVE` nav group (`src/lib/navRegistry.ts:150-163`), beside Analytics/Alerts/Quality/Security.
- **D-15** — The three already-mounted tool panels (`ToolBreakdown` on Dashboard, `ToolExecutionPanel` on Dashboard, `PermissionDecisionsChart` on Analytics) stay in place and gain links into the new page. `ToolBreakdown` reads the build-time `events` table via `useRecentEvents(100)`, NOT `toolExecutions` — D-01/D-02's source mixing does not reach it, no source filter needed there.
- **D-16** — The Tools page is stacked sections on one scroll (usage analytics, then policy feed), not tabs — each in its own `SectionErrorBoundary`.

### Claude's Discretion

Exact table/field names and indexes; the aggregate metric-type naming for D-04; the specific row caps for D-12;
chart primitives; plan/wave decomposition; whether existing `toolExecutions` rows need backfill (raised, not
discussed — see Deferred). Concrete recommendations for each are given below in Architecture Patterns / Don't
Hand-Roll / Common Pitfalls.

### Deferred Ideas (OUT OF SCOPE)

- Backfill of existing `toolExecutions` rows (no `traceId`, mostly no Ástríðr provenance) — left to planning;
  nothing to backfill for `toolPolicyEvents` (never stored before).
- Enforcement of `toolGovernance.disabled` — table exists, enforcement is a documented future phase; this phase
  observes only.
- A definition of tool "failure" beyond the boolean, beyond keeping CodePulse's rate aligned with astridr's own
  (which deliberately excludes off-turn blocks from its failure-rate circuit breaker).
- Retiring the duplicate Dashboard/Analytics tool panels (D-15 keeps them deliberately).
- The 40+ static alert rules that only fire while the Alerts page is open (carried forward from Phase 104,
  untouched here).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-01 | Tool-usage analytics: per-tool call frequency + success/failure rates over time | D-01 (per-call rows), D-02 (source tagging/filter), D-04 (hourly aggregates for "over time") — confirmed `toolExecutions` schema already has every field needed (`toolName`, `success`, `durationMs`, `provider`, `timestamp`), zero schema changes required beyond D-05's new table |
| OBS-02 | Surface astridr tool-filter signals (leak/policy events) with the offending tool named | D-05 (new `toolPolicyEvents` table), D-06 (fail-open-only alerting), D-07 (live-induction proof), D-08 (widened leak payload) — confirmed live that all 4 kinds are silently dropped today (no case, no default in the switch) |
| OBS-03 | Deeper trace waterfall: nested spans, per-tool timings, cache-hit visibility per turn | D-09 (nested Collapsible), D-10 (round ContextVar for real attribution), D-11 (shared cache-ratio formula), D-12 (capped, truncation-honest feeder reads) — confirmed both feeder queries (`llm.sessionCalls`, `toolExecutions.listBySession`) are today unbounded `.collect()` |
</phase_requirements>

## Standard Stack

No new external packages are introduced by this phase (confirmed by reading `package.json` — see below). Every
surface is built from already-installed libraries.

### Core (verified installed versions, `package.json` read directly 2026-08-03)

| Library | Version | Purpose | Why Standard (for this repo) |
|---------|---------|---------|--------------|
| `convex` | ^1.42.0 | Backend (schema, mutations, queries, httpActions, cron tail) | Existing backend; this phase adds one table + two ingest cases |
| `react` / `react-dom` | ^19.2.7 | Frontend | Existing |
| `react-router-dom` | ^7.13.1 | Routing (D-13's new `/tools` route) | Existing `lazy()` route pattern in `src/App.tsx` |
| `recharts` | ^3.8.0 | Charts | Already used elsewhere; this phase's usage-over-time chart can use it directly OR the repo's own `FlexBarChart` (see below) |
| `radix-ui` (via shadcn) | ^1.4.3 | `Collapsible`, `Tooltip`, `ToggleGroup`, `Table`, `ScrollArea`, `Badge`, `Select` primitives | UI-SPEC mandates reuse, zero new shadcn installs |
| `lucide-react` | ^1.23.0 | Icons (`Bell` etc.) | Locked convention |
| `vitest` | ^4.1.9 | Unit/component tests | `npm test`, jsdom environment, `src/test/setup.ts` |
| `@playwright/test` | ^1.61.1 | E2E | `npm run test:e2e` |

### Supporting (already-built, in-repo — reuse, do not reinstall)

| Component/module | Purpose | When to use |
|---|---|---|
| `src/components/FlexBarChart.tsx` | Stacked-bar renderer; `segments: StackedSegment[]` prop already supports a per-tool success/fail stacked bar (verified — reads `data[].segments[].{value,color,label}`) | OBS-01's frequency/success chart |
| `src/components/SectionErrorBoundary.tsx` | Class-component error boundary, `name` prop → "`{name}` failed to load" + Retry | Wrap both new Tools-page sections (D-16) and confirm it already wraps `TraceWaterfall`'s mount point |
| `src/hooks/useCostDerived.ts`, `useCostBudgets.ts` | `useQuery(...) ?? DEFAULT` wrapper-hook convention | Template for this phase's `useToolUsage`/`useToolPolicyEvents` hooks |

### Alternatives Considered

None — this phase is scoped by CONTEXT.md to extend existing tables/components. No alternative charting or
state-management library was considered or needed.

**Installation:** None required — zero new packages.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Verified by reading `package.json` directly; no
`npm install` is needed for any decision (D-01 through D-16 all touch existing Convex tables/mutations, existing
React components, and existing astridr-repo Python modules). The Package Legitimacy Gate is skipped per its own
"required whenever this phase installs external packages" condition — none does.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │            astridr-repo (Python)             │
                        │                                               │
  agent/loop.py         │  _execute_tool()                             │
  round_num (existing)  │    ├─ NEW: round ContextVar set/reset (D-10) │
                        │    ├─ tool_executed emit (loop.py:2051)      │
                        │    │    + durationMs, traceId (D-03)         │
                        │    │    + round (D-10, via ContextVar read)  │
                        │    │                                        │
                        │  leak detector (loop.py:1454-1476)           │
                        │    └─ tool_policy_event: leaked_as_text      │
                        │         + tool_was_offered/tools_offered_    │
                        │           count/round/agentId (D-08)         │
                        │                                               │
                        │  execution_denied (loop.py:2088-2109)        │
                        │    └─ tool_policy_event: execution_denied    │
                        │                                               │
                        │  bootstrap/core.py                           │
                        │    ├─ boot: malformed_policy_boot             │
                        │    └─ reload: malformed_policy_reload_       │
                        │               rejected                       │
                        │                                               │
                        │  providers/{anthropic,ollama,openrouter}.py  │
                        │    └─ llm_call emit + round (D-10, NEW read) │
                        └────────────────────┬──────────────────────────┘
                                             │ POST /runtime-ingest
                                             │ (Bearer auth, existing)
                        ┌────────────────────▼──────────────────────────┐
                        │        convex/runtimeIngest.ts (switch)       │
                        │                                                │
                        │  case "tool_executed":  (existing, EXTENDED)  │
                        │    ├─ callGraphEdges.upsertEdge (unchanged)   │
                        │    └─ NEW: toolExecutions.insert (D-01)       │
                        │                                                │
                        │  case "tool_policy_event": (NEW, D-05)        │
                        │    └─ toolPolicyEvents.insert                 │
                        │                                                │
                        │  case "llm_call": (existing, unchanged)       │
                        │    └─ llm.recordCall (traceId + round?)       │
                        └────────────────────┬──────────────────────────┘
                                             │
                        ┌────────────────────▼──────────────────────────┐
                        │              Convex tables                    │
                        │  toolExecutions (existing + new rows)         │
                        │  toolPolicyEvents (NEW)                       │
                        │  llmMetrics (existing, traceId already there) │
                        │  aggregates (existing, new tool_* bucket types)│
                        │  alerts (existing, D-06's two alert kinds)    │
                        └───────┬──────────────────┬────────────────────┘
                                │                   │
              computeHourly tail│                   │ useQuery (reactive)
              (D-04 buckets +   │                   │
               D-06 alert eval) │                   ▼
                        ┌───────▼──────┐   ┌────────────────────────────┐
                        │ webhookDelivery│  │   /tools (NEW page, D-13) │
                        │ .sendAlertWebhook│ │  ├─ Usage section (OBS-01)│
                        └────────────────┘  │  └─ Policy feed (OBS-02) │
                                             └────────────────────────────┘
                                             ┌────────────────────────────┐
                                             │ TraceWaterfall.tsx (EXTEND)│
                                             │  trace group → LLM call →  │
                                             │  tool executions (D-09)   │
                                             └────────────────────────────┘
```

### Recommended Project Structure (additive files only)

```
convex/
├── toolPolicyEvents.ts     # NEW — insert/list/lastReceivedAt (D-05, D-07)
├── runtimeIngest.ts        # EXTEND — tool_executed case, new tool_policy_event case
├── toolExecutions.ts       # EXTEND — cap listBySession (D-12), maybe a windowed frequency query for D-04
├── aggregates.ts           # EXTEND — new tool_* bucket types in computeHourly + D-06's alert-eval branch
└── schema.ts               # EXTEND — toolPolicyEvents table; toolExecutions unchanged in shape

src/
├── pages/
│   └── Tools.tsx           # NEW (D-13)
├── hooks/
│   ├── useToolUsage.ts      # NEW — useQuery(...) ?? [] wrapper
│   └── useToolPolicyEvents.ts # NEW
├── components/
│   ├── ToolUsagePanel.tsx   # NEW (OBS-01 section)
│   ├── ToolPolicyFeed.tsx   # NEW (OBS-02 section)
│   └── TraceWaterfall.tsx   # EXTEND (D-09/D-11/D-12)
└── lib/navRegistry.ts       # EXTEND — one OBSERVE entry (D-14)
```

### Pattern 1: Extending an existing ingest `case` without a schema-shape break

**What:** `tool_executed` already parses `agentId`/`toolName`/`sessionId`/`success`/`timestamp` with snake_case
fallbacks (`convex/runtimeIngest.ts:841-857`). D-01 adds one more `runMutation` call inside the same case body —
it does not touch the existing `callGraphEdges.upsertEdge` call above it.
**When to use:** Any time an existing event type needs to feed a second table without altering its first
consumer.
**Example (verified live source, `convex/runtimeIngest.ts:841-857`):**
```typescript
case "tool_executed": {
  const d = data as any;
  const toolExecutedAgent = d.agentId ?? d.agent_id;
  if (toolExecutedAgent) {
    await ctx.runMutation(api.callGraphEdges.upsertEdge, {
      agentId: toolExecutedAgent,
      toolName: d.toolName ?? d.tool_name ?? "unknown",
      sessionId: d.sessionId ?? d.session_id ?? "unknown",
      success: d.success ?? true,
      timestamp,
    });
  }
  // D-01: ADD a second write here, e.g.:
  // await ctx.runMutation(api.toolExecutions.insert, {
  //   sessionId: d.sessionId ?? d.session_id ?? "unknown",
  //   toolName: d.toolName ?? d.tool_name ?? "unknown",
  //   durationMs: d.durationMs ?? d.duration_ms,       // D-03 field
  //   success: d.success ?? true,
  //   provider: "astridr",                              // D-02 tag
  //   timestamp,
  // });
  break;
}
```
`api.toolExecutions.insert` (`convex/toolExecutions.ts:4-19`) already accepts `durationMs`, `success`,
`errorMessage`, `provider` optionally — confirmed no mutation signature change is needed for D-01/D-02.

### Pattern 2: Bounded index-range read instead of unbounded `.collect()`

**What:** `convex/aggregates.ts`'s `fetchLlmRowsForWindow` (lines 33-46) is the exact template for a bounded,
truncation-honest read this phase's D-12 caps must follow: `.withIndex(...).take(CAP)`, then
`truncated: rows.length >= CAP`.
**When to use:** `llm.sessionCalls` and `toolExecutions.listBySession`, both currently unbounded `.collect()`
(confirmed live, `convex/llm.ts:126-136` and `convex/toolExecutions.ts:91-99`).
**Example (verified live source, `convex/aggregates.ts:31-46`):**
```typescript
const LLM_WINDOW_READ_CAP = 4000;
async function fetchLlmRowsForWindow(ctx, windowStart, windowEnd) {
  const rows = await ctx.db
    .query("llmMetrics")
    .withIndex("by_timestamp", (q) => q.gte("timestamp", windowStart).lt("timestamp", windowEnd))
    .filter((q) => q.neq(q.field("archived"), true))
    .take(LLM_WINDOW_READ_CAP);
  return { rows, truncated: rows.length >= LLM_WINDOW_READ_CAP };
}
```
Apply the identical `{ rows, truncated }` shape to both D-12 feeder queries so `TraceWaterfall` can render the
D-12 truncation banner from a single boolean, matching the UI-SPEC's mandatory copy.

### Pattern 3: Cron-tail alert evaluation, never a new cron (D-06)

**What:** `convex/costBudgetEval.ts`'s `evaluateBudgets` is invoked from `computeHourly`'s tail
(`convex/aggregates.ts:257-262`) inside a mandatory `try/catch`, and inserts directly into `alerts` +
schedules `internal.webhookDelivery.sendAlertWebhook` — never the public `alerts.create` mutation.
**When to use:** D-06's fail-open-kind alerting for `toolPolicyEvents`.
**Example (verified live source, `convex/costBudgetEval.ts:316-347`):**
```typescript
const alertId = await ctx.db.insert("alerts", {
  severity: level,              // "error" | "warning" (D-06: boot=error-ish, reload_rejected=warn-ish per UI-SPEC's color mapping)
  source,                       // unique per (kind, tool) for by_source dedup
  message,                      // built with NO enforcement wording (buildAlertMessage's forbidden-word gate)
  acknowledged: false,
  status: "active",
  createdAt: nowSec,
  webhookStatus: "pending",
  details: { /* event-specific: field, error, tool, etc. */ },
});
await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, { alertId, attempt: 1 });
```
Dedup via the existing `alerts.by_source` index (composite `["source", "createdAt"]`) exactly as
`evaluateBudgets` does at lines 288-300 — for `toolPolicyEvents`, `source` should be something like
`tool-policy:${event}` (not per-tool, since a boot-degrade or reload-rejection is a system-wide event, not scoped
to one tool) so repeated identical failures within the same window dedupe.
**Then wire the same call site pattern used for costBudgetEval** — add a second `try { await
evaluateToolPolicyAlerts(ctx, now); } catch {...}` block immediately after the existing cost-budget evaluator
call in `computeHourly` (lines 257-262), not a separate cron.

### Pattern 4: Shared pure-function cache-ratio (D-11) — do not reimplement

**What:** `computeSummary` in `TraceWaterfall.tsx` (lines 134-164) already computes
`cacheRatio = cacheReadSum / (cacheReadSum + cacheCreationSum + promptTokenSum)` — the identical formula as
`shapeCacheAcc` in `convex/llm.ts` (lines 59-69, `hitRate: total > 0 ? a.read / total : 0`). D-11 requires a
**per-group** (per-turn) version of this, not just the session-wide `computeSummary`.
**Example — new helper to add to `TraceWaterfall.tsx`, following the exact denominator convention:**
```typescript
function groupCacheRatio(rows: LlmCallRow[]): number {
  let read = 0, creation = 0, prompt = 0;
  for (const r of rows) {
    read += r.cacheReadInputTokens ?? 0;
    creation += r.cacheCreationInputTokens ?? 0;
    prompt += r.promptTokens;
  }
  const denom = read + creation + prompt;
  return denom > 0 ? read / denom : 0;
}
```
Append to the existing group-header line (`groupCostLabel`, line 167-172) per the UI-SPEC's exact copy contract:
`Turn {n} · {count} · {duration} · {cost} · {cacheRatio}% cached`.

### Anti-Patterns to Avoid

- **Reintroducing a `default:` case or a broad `catch` that swallows unrecognized `tool_policy_event` kinds** —
  D-05 exists specifically because the switch currently has neither a case nor a default for this event type,
  so ALL FOUR kinds silently vanish today. Adding the case is the fix; do not also add a generic default that
  could mask a fifth future kind's absence the same way.
- **Summing `toolExecutions` across `provider` values without an explicit operator choice (D-02)** — the whole
  reason this decision exists is that `Bash` (594 calls, Claude Code hook rows) currently outranks every real
  Ástríðr tool in a naive frequency chart; any new chart or aggregate must filter on `provider` by default.
- **Inferring trace nesting from timestamp proximity instead of D-10's explicit round ContextVar** —
  CONTEXT.md explicitly rejected this ("a wrong parent renders exactly as confidently as a right one with
  nothing on screen to signal doubt"). Do not fall back to this even as a stopgap before the astridr commit
  lands — ship OBS-03's nesting only once the round field is genuinely present.
- **Treating an empty `toolPolicyEvents` view as "healthy"** — this project's own recurring failure mode (Phase
  90 War Room, `gatewayQuotaSnapshots` `[]`). D-07 requires the empty state to name the last-received timestamp
  (or "never") so silence is distinguishable from a dead ingest pipe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounded time-window read over a growing table | A custom cursor/pagination loop | The `fetchLlmRowsForWindow` `.withIndex().take(CAP)` pattern (Pattern 2 above) | `aggregates.ts`'s own doc comment (lines 9-30) documents that Convex allows exactly ONE paginated query per invocation — a naive `while(true)` cursor loop already broke `backfillTokenSplit` in Phase 104 and would break identically here |
| Alert delivery / webhook fan-out | A new notification channel or delivery mutation | `internal.webhookDelivery.sendAlertWebhook` (existing, `convex/webhookDelivery.ts:406`) | D-06 explicitly forbids new channel plumbing; the function already handles Discord/Slack embed formatting and per-channel preferences |
| Cache-hit-rate math | A second/third formula for "% cached" | `shapeCacheAcc`'s denominator (`convex/llm.ts:59-69`), mirrored into a new `groupCacheRatio` helper in `TraceWaterfall.tsx` | D-11 explicitly requires ONE formula, not three drifting copies (`computeSummary`, `shapeCacheAcc`, and any new per-group version) |
| Per-tool success/fail bar chart | A new chart primitive | `FlexBarChart`'s existing `segments` prop (verified: accepts `StackedSegment[]` with `{value, color, label}`) | Already renders exactly this shape for other stacked panels; UI-SPEC names it directly |
| Error-boundary-per-panel | A bespoke try/catch + fallback UI per new component | `SectionErrorBoundary` (`src/components/SectionErrorBoundary.tsx`), `name` prop | Standard convention, 10 panels already retrofitted after the `3b31c9f4` Analytics-blackout incident; both new Tools-page sections need this per D-16 |

**Key insight:** every "don't hand-roll" item above is not a general best-practice reminder — each one maps to
an actual live incident or an actual live drift already documented in this project's history (the 2026-07-21/22
retry-storm/tombstone incident, the `3b31c9f4` Analytics blackout, three now-reconciled cache-ratio formulas
before Phase 104 unified them for cost). Reusing the existing helper is cheaper than re-deriving it and avoids
repeating a fixed defect class.

## Common Pitfalls

### Pitfall 1: The astridr-repo contract doc will silently drift again if not updated in the same commit

**What goes wrong:** `docs/astridr-contract.md` §2.34 documents `tool_policy_event`'s 3 known kinds
(`malformed_policy_boot`, `malformed_policy_reload_rejected`, `execution_denied`) with exact field tables, but
**omits `tool_call_leaked_as_text` entirely** — verified by grep, it does not appear anywhere in that document.
**Why it happens:** the leak detector shipped in a different astridr phase (`b7e4a534`, referenced in
REQUIREMENTS.md) than the Phase 182 tool-access-policy work that documented the other three kinds in the
contract — the contract was updated for one shipment and not the other.
**How to avoid:** the single astridr-repo commit this phase makes (D-03/D-08/D-10) should also update
`docs/astridr-contract.md` §2.34 to add the fourth kind's row and widen the field lists for
`tool_executed` (§2.26, add `durationMs`/`traceId`/`round`) and the leak kind (add
`tool_was_offered`/`tools_offered_count`/`round`/`agentId`) — matching this project's contract-first convention
(103/104 precedent cited in CONTEXT.md's canonical refs).
**Warning signs:** a future researcher reading only the contract doc (not the live code) would miss the leak
kind's existence entirely, the exact trap CLAUDE.md's "a design spec's symbol list is a proposal, not an
inventory" lesson warns about.

### Pitfall 2: `alerts.severity` free-text values must match what `AlertRulesEngine`/`webhookDelivery` already expect

**What goes wrong:** the `alerts` schema's `severity` field is a bare `v.string()` (`convex/schema.ts:112`,
comment says `"info" | "warning" | "error" | "critical"`) — nothing enforces this at the type level. D-06's two
alert-worthy kinds must pick values consistent with `webhookDelivery.ts`'s existing severity-color mapping
(verified referenced in `__tests__/webhookDelivery.test.ts:30`, "builds correct Discord embed payload with
severity color") or the Discord/Slack embed will render an unstyled/default color.
**How to avoid:** read `webhookDelivery.ts`'s severity→color mapping before picking `"error"` vs `"critical"`
for `malformed_policy_boot` (the more severe, fully-permissive case) vs `"warning"` for
`malformed_policy_reload_rejected` — this matches the UI-SPEC's own color table (`--status-error` vs
`--status-warn`).

### Pitfall 3: `toolExecutions`'s existing indexes may not cover the new per-tool-over-time query shape

**What goes wrong:** the current indexes are `by_session`, `by_tool` (`["toolName", "timestamp"]`),
`by_timestamp`, `by_provider` (single-field). None of these covers "this tool, this provider, over time" in one
index-bounded scan — a query filtering on both `toolName` and `provider` plus a time range would need either a
compound index or a post-filter over a `by_tool` scan (acceptable since `by_tool` is already time-bounded, and
`provider` cardinality is tiny — 3-4 values).
**How to avoid:** for the aggregate/hourly-bucket path (D-04), this doesn't matter — aggregates already key on
whatever dimension tuple the planner chooses (mirroring `{provider, model, billingType, goalId}` from Phase
104). For the raw 14-day drill-down (also D-04's stated "raw rows stay the detail view"), a `by_tool` index scan
filtered client-side (or in the query handler) by `provider` is fine at this table's actual volume (hundreds,
not millions, of rows/day per the live counts CONTEXT.md cites: `web_search` 125, `cli_gateway` 103, etc.) — do
not add a new compound index speculatively; CLAUDE.md's own lesson (`2026-07-20`) is "an index cannot speed an
unfiltered count" and a similarly unnecessary index adds write cost with no read win at this volume.

### Pitfall 4: The `SectionErrorBoundary` component is itself pre-existing hex debt — do not let it set a precedent

**What goes wrong:** `SectionErrorBoundary.tsx` (verified, lines 38-56) hardcodes `bg-gray-800/50`,
`border-red-500/30`, `text-red-400`, `text-gray-300`, `text-gray-500`, `bg-gray-700`, `text-gray-200` — none of
these are the token-driven `--card`/`--destructive`/`--muted-foreground` variables CLAUDE.md and the UI-SPEC
mandate everywhere else.
**Why it happens:** it predates the Phase 89 token system and was never swept (unlike the panels Phase 104's
hex-remediation plans fixed).
**How to avoid:** the UI-SPEC's Copywriting Contract explicitly says "Reuse `SectionErrorBoundary` verbatim... No
new error copy pattern" — this phase should NOT modify `SectionErrorBoundary` itself (out of scope, would touch
every consumer app-wide), but the planner should not treat its hardcoded-hex styling as a template for any *new*
component this phase builds. Flag this as a candidate for Phase 106 (DEBT items) rather than silently
replicating the pattern.

## Code Examples

### Verified: exact `tool_executed` emit site (astridr, before D-03/D-08/D-10)

```python
# astridr/agent/loop.py:2030-2057 (verified live 2026-08-03)
_duration_ms = int((time.monotonic() - _start_mono) * 1000)  # computed, currently only used for agent_metric
...
if self.telemetry is not None:
    await self.telemetry.send("tool_executed", {
        "agentId": self._active_profile or "astridr",
        "toolName": tool_call.name,
        "sessionId": self._active_session_id or "",
        "success": _tool_success,
        "timestamp": _end_dt.timestamp(),
        # D-03 ADDS: "durationMs": _duration_ms, "traceId": get_trace_context()
        # D-10 ADDS: "round": get_round_context()  (new ContextVar, mirrors get_trace_context())
    })
```

### Verified: exact leak-detector emit site (astridr, before D-08)

```python
# astridr/agent/loop.py:1454-1476 (verified live 2026-08-03)
_leaked_tool = _detect_leaked_tool_call(response.content)
if _leaked_tool is not None:
    _permitted = run_state.tools_for_turn_names if run_state is not None else None
    logger.warning(
        "agent_loop.tool_call_leaked_as_text",
        leaked_tool=_leaked_tool, round=round_num, task_category=self._task_category,
        tools_offered_count=len(_permitted) if _permitted is not None else None,
        tool_was_offered=(_leaked_tool in _permitted) if _permitted else False,
        session_id=self._active_session_id or "", agent_id=self._active_profile or "",
    )
    if self.telemetry is not None:
        await self.telemetry.send("tool_policy_event", {
            "event": "tool_call_leaked_as_text",
            "tool": _leaked_tool,
            "taskCategory": self._task_category or "",
            "sessionId": self._active_session_id or "",
            # D-08 ADDS: "tool_was_offered", "tools_offered_count", "round", "agentId"
            # — all four already local variables in the logger.warning call above
        })
```

### Verified: `_tool_policy_malformed_signal` payload shape (astridr `config.py:1166-1187`)

```python
_tool_policy_malformed_signal: dict[str, str] | None = None
...
merged["tool_clusters"] = {}
_tool_policy_malformed_signal = {"field": "tool_clusters", "error": str(exc)}
...
result.__dict__["_tool_policy_malformed"] = _tool_policy_malformed_signal
```
Forwarded verbatim as `**signal` in both `bootstrap/core.py` call sites (`_emit_boot_malformed_policy_telemetry`
line 129-132: `{"event": "malformed_policy_boot", **signal}`; `_make_on_config_change` line 230-233:
`{"event": "malformed_policy_reload_rejected", **signal}`) — so the CodePulse-side `toolPolicyEvents` schema for
these two kinds needs exactly `event`, `field`, `error` plus the standard ingest timestamp. `execution_denied`
needs `event`, `tool`, `sessionId`. `tool_call_leaked_as_text` needs `event`, `tool`, `taskCategory`,
`sessionId` + D-08's four additions.

### Verified: no round ContextVar exists yet anywhere in astridr

Grepped `_current_round`, `round_id`, `telemetry_round` across the entire `astridr/` package — zero matches.
D-10's new ContextVar is genuinely new, not a rename of something existing; follow the exact
`_current_trace_id` pattern (`astridr/engine/telemetry.py:87-89`, `set_trace_context`/`reset_trace_context`/
`get_trace_context` at lines 610-625) for the new `set_round_context`/`reset_round_context`/`get_round_context`
trio.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `callGraphEdges` as the only Ástríðr tool-call record (cumulative counters, `lastCallAt`/`lastErrorAt` only) | `toolExecutions` gains per-call Ástríðr rows (D-01) | This phase | "Over time" charts become possible for the first time — today it is architecturally impossible from either existing table |
| `tool_policy_event` silently dropped at ingest (no case, no default) | Dedicated `toolPolicyEvents` table + case (D-05) | This phase | First time these signals are visible anywhere in CodePulse — genuinely empty history, no backfill possible |
| `TraceWaterfall` flat per-call bars only | Two-level nesting (trace → LLM call → tool executions) (D-09) | This phase | Matches the actual turn structure (model responds → tools run → model responds) instead of an undifferentiated timeline |

**Deprecated/outdated:** none — this phase extends live, current-generation code (Phase 94's `TraceWaterfall`,
shipped 2026-07-06, and Phase 104's `computeHourly`-tail alert pattern, shipped 2026-08-03 — both still the
current convention).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Suggested `source` key for D-06's dedup (`tool-policy:${event}`) is a recommendation, not verified against any existing naming convention beyond `costBudgetEval.ts`'s own scoped-string pattern | Architecture Patterns, Pattern 3 | Low — if the planner picks a different scheme, dedup still works as long as it's stable per (event-kind, evaluation-window); no functional risk, just a naming choice |
| A2 | Recommended alert `severity` values (`"error"` for boot-degrade, `"warning"` for reload-rejected) assume `webhookDelivery.ts`'s color mapping treats these two strings as expected — the mapping itself was not fully read (only its test file was grepped for confirmation it exists) | Common Pitfalls, Pitfall 2 | Low-medium — wrong severity string could render an unstyled embed color; easily caught in the D-07 live-induction step, not a functional/data-loss risk |
| A3 | `by_tool` index (no `provider` field) is assumed sufficient for the raw-drill-down query at current volume, without measuring actual current row counts against a live index scan | Common Pitfalls, Pitfall 3 | Low — if volume is higher than estimated, this is a performance tune-up (add a compound index later), not a correctness risk; CONTEXT.md's own live-queried counts (125/103/58/etc. per tool) support the "hundreds not millions" estimate |

**If this table is empty:** N/A — see above. All three items are low-risk naming/tuning recommendations, not
load-bearing factual claims; every payload-shape and file:line claim in this document was independently
re-verified against the live source in both repos during this research session.

## Open Questions

1. **Should `toolPolicyEvents` alerting dedup per-window or per-lifetime-until-acknowledged?**
   - What we know: D-06 says "alert on the fail-open kinds only," reusing Phase 104's exact delivery path.
     Phase 104's `evaluateBudgets` dedups on `(budgetId, level, periodStart)` — i.e., once per period.
   - What's unclear: a `malformed_policy_boot` event is a discrete occurrence (one per boot), not a
     continuously-evaluated state like a budget — the natural dedup key might be "one alert per occurrence"
     (no dedup at all, since inducing it live during D-07 should only happen once per test) rather than a
     per-period window.
   - Recommendation: dedup on `(event, createdAt-bucket)` at, say, 5-minute granularity — cheap insurance
     against an astridr retry/backoff storm re-emitting the same boot-degrade repeatedly, without suppressing a
     genuinely new occurrence hours later. Confirm during planning; this is a small, reversible implementation
     detail with no data-model consequence.

2. **Does the astridr-repo commit's round ContextVar need a reset/`finally` guarantee at loop boundaries?**
   - What we know: `_current_trace_id` (the existing sibling ContextVar) has explicit `set_trace_context`/
     `reset_trace_context` functions returning a `Token` for reset — implying callers are expected to reset it,
     but this research did not trace every call site of `set_trace_context`/`reset_trace_context` to confirm a
     `try/finally` discipline is followed consistently today.
   - What's unclear: whether a round ContextVar that's set-but-never-reset across concurrent async tasks could
     leak a stale round number into an unrelated turn (ContextVars are task-local in asyncio, so this is
     probably safe by construction, but worth the implementer confirming against the actual call pattern at
     `loop.py`'s round-increment site, line ~1143-1145).
   - Recommendation: mirror whatever discipline `_current_trace_id` already uses at its actual call site inside
     `_process_inner` (not just the definition) — do not invent a different lifecycle for the new round
     ContextVar.

## Environment Availability

Skipped — this phase has no external tool/service dependencies beyond the already-running local stack (self-hosted
Convex at `convex-selfhost/`, the astridr containers). Both are already operational per `STATE.md`'s live-verify
history; no new dependency (database, CLI, runtime) is introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 (jsdom environment) + `@testing-library/react` 16.3.2 for component tests; Playwright 1.61.1 for E2E |
| Config file | `vitest.config.ts` (repo root) — `include: ['src/**/*.test.{ts,tsx}', 'convex/**/*.test.ts', 'hooks/**/*.test.mjs']`, `setupFiles: ['./src/test/setup.ts']` |
| Quick run command | `npx vitest run src/components/TraceWaterfall.test.tsx` (or the equivalent new test file) |
| Full suite command | `npm test` (runs `vitest`; CI/pre-merge convention in this repo is `vitest run` for a one-shot pass) |

Note: `convex-test` is NOT installed in this repo (confirmed — `resolveGatewayTaskCompleted`'s own doc comment
in `runtimeIngest.ts` states this explicitly). The established convention for testing ingest-boundary logic is
**pure-function extraction** — e.g. `resolveGatewayTaskCompleted`, `processTaskQualityEvent`,
`isUnresolvedRouting` are all exported pure functions unit-tested directly, with the `runMutation`/`ctx.db` calls
left thin and un-unit-tested (covered instead by the D-07 live-induction step). Follow this same convention for
any new parsing logic in the `tool_policy_event` case.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-01 | `tool_executed` case writes a `toolExecutions` row tagged `provider: "astridr"` alongside the existing `callGraphEdges` upsert | unit (pure-function extraction, mirroring `resolveGatewayTaskCompleted`) | `npx vitest run convex/runtimeIngest.test.ts` | ❌ Wave 0 — no `runtimeIngest.test.ts` exists yet (confirmed via file search) |
| OBS-01 | Hourly aggregate buckets for tool call/failure/duration, keyed by tool + provider | unit | `npx vitest run convex/aggregates.test.ts` | ✅ exists (34 tests as of Phase 104 Plan 3) — extend it |
| OBS-01 | Tools-page usage panel renders per-tool frequency + success/fail from live query | component | `npx vitest run src/pages/Tools.test.tsx` | ❌ Wave 0 |
| OBS-02 | `tool_policy_event` case parses all 4 kinds and inserts into `toolPolicyEvents` | unit | `npx vitest run convex/toolPolicyEvents.test.ts` | ❌ Wave 0 |
| OBS-02 | Alert fires ONLY for `malformed_policy_boot`/`malformed_policy_reload_rejected`, never for the other two kinds | unit (mirrors `costBudgetEval.test.ts`'s dedup/fire/isolation pattern) | `npx vitest run convex/toolPolicyAlertEval.test.ts` (or wherever the D-06 evaluator lives) | ❌ Wave 0 |
| OBS-02 | Ingest path proven by inducing real events live against the running stack (D-07) | manual-only (live induction) | N/A — operator-attended, documented in `105-VALIDATION.md` per the 104-11 pattern | manual |
| OBS-03 | `TraceWaterfall`'s nested rendering: tool rows appear under the correct LLM-call parent when `round` is present | unit (pure-function, extending `TraceWaterfall.test.tsx`'s existing `groupByTrace`/`barMetrics`/`cacheBadge` coverage) | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ exists — extend it |
| OBS-03 | `groupCacheRatio` matches `shapeCacheAcc`'s denominator exactly (regression test, matching D-11's "one formula" requirement) | unit | `npx vitest run src/components/TraceWaterfall.test.tsx` | ✅ exists — extend it |
| OBS-03 | Both feeder queries are capped and the UI states truncation when hit | unit + component | `npx vitest run convex/llm.test.ts` (if exists) / `src/components/TraceWaterfall.test.tsx` | Check — `convex/llm.test.ts` existence not confirmed this session, verify in Wave 0 |
| Cross-repo | astridr `tool_executed`/`tool_policy_event`/`llm_call` payload widening (D-03/D-08/D-10) | unit (Python, astridr-repo's own test suite convention — pytest) | astridr-repo: `pytest tests/unit/agent/test_loop.py -k tool_executed` (exact path to confirm in astridr-repo at plan time) | Check in astridr-repo during planning |

### Sampling Rate

- **Per task commit:** `npx vitest run <changed test file>` (fast, targeted)
- **Per wave merge:** `npm test` (full Vitest suite) + `npx tsc --noEmit`
- **Phase gate:** Full suite green + the D-07 live-induction manual step recorded in `105-VALIDATION.md` before
  `/gsd:verify-work` — per this project's own established "green suite is not proof of a live fix" convention
  (see LESSONS / STATE.md's repeated Phase 103/104 pattern of PARTIAL markers pending live re-verification).

### Wave 0 Gaps

- [ ] `convex/runtimeIngest.test.ts` — does not exist; needed to cover the extended `tool_executed` case and the
      new `tool_policy_event` case (pure-function extraction convention, mirroring `resolveGatewayTaskCompleted`)
- [ ] `convex/toolPolicyEvents.test.ts` — new table, new mutations, needs its own test file
- [ ] `src/pages/Tools.test.tsx` — new page, needs a component test scaffold
- [ ] Confirm whether `convex/llm.test.ts` exists and covers `sessionCalls` — not verified this session; check
      first in Wave 0 before assuming a green baseline for the D-12 cap change
- [ ] astridr-repo test file/path for `loop.py`'s `tool_executed`/leak-detector emits — confirm the exact pytest
      path during cross-repo planning (this research did not enumerate astridr-repo's test directory)

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → treated as enabled per the default.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no new user-facing auth surface — the new Tools page is read-only, same auth posture as every other OBSERVE page |
| V3 Session Management | No | No session semantics introduced |
| V4 Access Control | No | No new mutating endpoint from the browser — the only new writes (`toolExecutions`, `toolPolicyEvents` inserts) happen server-side inside the existing Bearer-gated `/runtime-ingest` httpAction, same as every other event type in that switch |
| V5 Input Validation | Yes | Convex `v.` validators on the new `toolPolicyEvents` table/mutation args (existing convention — every table in `schema.ts` uses typed validators); dual snake_case/camelCase coalescing at the ingest boundary per the established WR-06/168-06 defensive-ingest convention (a single unhandled null must never poison a whole batch — this file's own documented incident history) |
| V6 Cryptography | No | No new secrets, keys, or crypto — reuses the existing `validateIngestAuth` Bearer check unchanged |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded read on a growing table inside a request path (the exact class that caused the 2026-07-21/22 self-hosted outage and the `3b31c9f4` Analytics blackout) | Denial of Service | Index-range-bounded `.take(CAP)` reads everywhere (Pattern 2); this phase's D-12 caps are a direct application |
| A single malformed/unexpected event payload poisoning an entire ingest batch (documented live incident: one null `resultSnippet` broke an 8-event batch) | Denial of Service (self-inflicted) | Defensive coalescing (`??`) on every optional field at the ingest boundary, regardless of what the current emitter actually sends — established convention throughout `runtimeIngest.ts` |
| A public/anonymous write path bypassing the Bearer-gated httpAction (WR-06 pattern: an `internalMutation` reachable only through the authenticated route, vs. a `mutation` directly callable with just the deployment URL) | Elevation of Privilege | `toolPolicyEvents`'s insert should be an `internalMutation` (like `internal.evalScores.ingestTaskQuality`), called only from inside the already-Bearer-gated `runtimeIngest` httpAction — NOT a public `mutation` |
| Mass deletion / bulk mutation of a large table on the live self-hosted instance | Denial of Service | Hard-forbidden by CLAUDE.md; `toolPolicyEvents` and `toolExecutions` retention/pruning must follow the existing batch-capped `retention.ts` pattern (200 docs/batch, 3s apart, sequential tables) — do not add a new bespoke prune path |

## Sources

### Primary (HIGH confidence — live code read directly this session)

- `C:\Users\mandr\codepulse\.planning\phases\105-tool-trace-observability\105-CONTEXT.md` — locked decisions D-01..D-16
- `C:\Users\mandr\codepulse\.planning\phases\105-tool-trace-observability\105-UI-SPEC.md` — approved UI design contract
- `C:\Users\mandr\codepulse\convex\runtimeIngest.ts` — full ingest switch, confirmed `tool_executed` case shape and absence of `tool_policy_event`/`default`
- `C:\Users\mandr\codepulse\convex\schema.ts` (lines 540-660) — `toolExecutions` table shape/indexes
- `C:\Users\mandr\codepulse\convex\toolExecutions.ts` — `insert`/`successRate`/`avgDuration`/`listBySession` (confirmed unbounded `.collect()`)
- `C:\Users\mandr\codepulse\convex\llm.ts` (lines 1-150) — `recordCall`, `shapeCacheAcc`, `sessionCalls` (confirmed unbounded)
- `C:\Users\mandr\codepulse\convex\retention.ts` — `RETENTION_DAYS["toolExecutions"] = 14`, batch-capped prune pattern
- `C:\Users\mandr\codepulse\convex\callGraphEdges.ts` — `upsertEdge` shape
- `C:\Users\mandr\codepulse\convex\aggregates.ts` (lines 1-100, 225-270) — `computeHourly`, bounded-read pattern, D-06's call-site precedent
- `C:\Users\mandr\codepulse\convex\costBudgetEval.ts` — `evaluateBudgets`, alert-insert + `sendAlertWebhook` pattern
- `C:\Users\mandr\codepulse\src\components\TraceWaterfall.tsx` — full component, all pure helpers
- `C:\Users\mandr\codepulse\src\components\FlexBarChart.tsx` — `segments` prop confirmed
- `C:\Users\mandr\codepulse\src\components\SectionErrorBoundary.tsx` — confirmed pre-existing hex debt
- `C:\Users\mandr\codepulse\src\components\ToolExecutionPanel.tsx` — `ScrollArea`, expandable-row, `PillButton` conventions
- `C:\Users\mandr\codepulse\src\lib\navRegistry.ts` (lines 147-166) — `OBSERVE` group contents
- `C:\Users\mandr\codepulse\package.json` — all dependency versions
- `C:\Users\mandr\codepulse\vitest.config.ts` — test framework config
- `C:\Users\mandr\astridr-repo\astridr\agent\loop.py` (lines 1440-1560, 2030-2150) — leak detector, `tool_executed` emit, `execution_denied` emit, round_num usage
- `C:\Users\mandr\astridr-repo\astridr\engine\telemetry.py` (lines 75-130, 595-630) — `_current_trace_id` ContextVar pattern; confirmed no round ContextVar exists
- `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\core.py` (lines 95-245) — both malformed-policy telemetry emit sites
- `C:\Users\mandr\astridr-repo\astridr\engine\config.py` (lines 1155-1190) — `_tool_policy_malformed_signal` exact shape
- `C:\Users\mandr\astridr-repo\astridr\providers\anthropic_provider.py`, `ollama.py`, `openrouter.py` — confirmed `llm_call` emit sites, confirmed no `round` field sent today
- `C:\Users\mandr\astridr-repo\docs\astridr-contract.md` (§2.26, §2.34) — confirmed contract documents 3 of 4 `tool_policy_event` kinds, omits the leak kind
- `C:\Users\mandr\codepulse\.planning\REQUIREMENTS.md`, `.planning\STATE.md`, `.planning\ROADMAP.md` — requirement text, project history, Phase 104 precedent

### Secondary (MEDIUM confidence)

None used — this research relied entirely on direct code reads across both repos rather than web search, since
CONTEXT.md already scoped the domain to internal/cross-repo code with no external library research need.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, all versions read directly from `package.json`
- Architecture: HIGH — every cited file:line in CONTEXT.md independently re-verified live in this session, plus one gap found (contract doc's missing leak-kind documentation)
- Pitfalls: HIGH — grounded in this project's own documented incident history (retention/tombstone outage, Analytics blackout, cache-ratio drift) rather than generic advice

**Research date:** 2026-08-03
**Valid until:** 14 days (fast-moving — this codebase has multiple live phases in flight per week; re-verify file:line citations if planning is delayed beyond that window)
