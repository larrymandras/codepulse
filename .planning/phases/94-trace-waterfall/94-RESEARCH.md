# Phase 94: Trace Waterfall - Research

**Researched:** 2026-07-06
**Domain:** Convex schema/ingest extension (cross-repo) + custom React/Tailwind timing-bar visualization
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Ástríðr-side emitter change is IN this phase** (Phase 93 D-01 precedent). No producer exists today — the `llm_call` payload (`anthropic_provider.py` ~L563) carries no trace field, so "ingest pass-through" is dead weight without this. Follow the proven cross-repo pattern (astridr commits `26874fac`/`97c63643`).
- **D-02: One traceId = one agent-loop turn.** All LLM calls made while handling one user message / one loop iteration share a traceId. A session contains many traces stacked in the waterfall.
- **D-03: traceId is generated once in the agent loop and propagated via contextvar**, mirroring the existing `goalId` `get_goal_context()` pattern — so ALL emitting providers (anthropic_provider, openrouter, ollama) attach it uniformly with one mechanism. No per-provider ID generation.
- **D-04: Backward compatibility = flat chronological fallback.** Rows without `traceId` (all existing rows, plus any future untraced emitters) render as an ungrouped chronological "untraced" section in the same waterfall. No time-gap pseudo-trace inference — zero invented boundaries. Satisfies TRACE-01's no-break criterion.
- **D-05: Live E2E completion bar** (carried from Phase 93 D-04 / Phase 90 lesson): the phase is not done until a real Ástríðr-emitted `llm_call` carrying a `traceId` lands in prod Convex (`tidy-whale-981`) and renders grouped in the waterfall. Explicit verification step in the plan; convex-test green alone does not close the phase.
- **D-06: Waterfall lives as a new "Trace" tab on SessionDetail** — added to the existing tab bar (overview/timeline/files/bash/errors). No new route or nav entry.
- **D-07: `LangfuseTraceLink.tsx` is removed outright** — delete the component and its Analytics header slot (`Analytics.tsx` L30/L83). No replacement affordance in the Analytics header; per-session traces are reached through session drill-in.
- **D-08: Trace tab is deep-linkable** via URL param (e.g., `/sessions/:id?tab=trace`), and rows in existing LLM-call tables (Analytics recent calls) cross-link to their session's trace — following the v8.0/v9.0 cross-nav deep-link house pattern (`?event=`, `?goal=`).
- **D-09: New `TraceWaterfall` component, Gantt-styled** — purpose-built for `llmMetrics` rows (bar start = `timestamp − latencyMs`, width = duration), mirroring `GanttTimeline`'s structure and time-axis conventions but NOT entangling its agents/events props. Custom flex/CSS bars per house convention; no new chart library.
- **D-10: Vertical layout = collapsible trace groups with per-call rows.** Each trace (turn) is a collapsible group with a header showing total duration/cost; each LLM call is its own row within the group, bars positioned on the shared session time axis. Untraced legacy calls form one flat group at the end (per D-04).
- **D-11: Bar labels = model + cost + cache badge inline** (e.g., "opus-4-8 · $0.042 · 92% cached"); hover/click reveals full detail — tokens in/out, cacheRead/cacheCreation, latency, provider, toolName, billingType.
- **D-12: Live-updating via native Convex reactivity** — the Trace tab uses `useQuery` on `llmMetrics` `by_session`; new calls appear as they ingest, time axis extends. No polling code.
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

### Deferred Ideas (OUT OF SCOPE)

- **Per-session cache rollup surface** — already listed in REQUIREMENTS.md Future Requirements (capability-audit #5 follow-on); the D-15 summary strip shows session cache ratio but a dedicated rollup/analytics surface stays deferred.
- **Time-gap pseudo-trace inference for legacy rows** — rejected for this phase (D-04); revisit only if the untraced fallback proves unreadable for long historical sessions.
- **Standalone cross-session Traces page** — placement decision chose the SessionDetail tab; a global trace browser would be its own phase if ever needed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRACE-01 | `llmMetrics` rows carry a `traceId` grouping field (schema + ingest pass-through), backward compatible with existing rows that lack it. | Pattern 2 (Optional-field backward-compatible schema extension) gives the exact `v.optional(v.string())` + alias-pass-through code to add to `schema.ts`/`llm.ts`/`runtimeIngest.ts`. Pattern 1 + Pitfalls 1-3 cover the cross-repo Ástríðr emitter side (contextvar propagation, insertion-point choice, goalId/traceId separation, the Ollama gap). Validation Architecture maps this requirement to concrete unit tests plus the D-05 live-integration manual gate. |
| TRACE-02 | Operator can open a session's LLM call chain as an in-app trace waterfall — timing bars, cost-per-call, cache annotations — replacing the dead-link `LangfuseTraceLink.tsx`. | Architecture Patterns (System Diagram, Pattern 3) and Code Examples give the client-side grouping/query shape. Pitfall 1 (timestamp/latency unit mismatch) and Pitfall 4 (backward-compat rendering) directly de-risk the bar-rendering math and the D-04 fallback bucket. Pitfall 5 covers the `LangfuseTraceLink` deletion scope. Don't Hand-Roll table enforces the D-13/D-14 no-fabrication constraints. |
</phase_requirements>

## Summary

This phase is small in surface area but spans two repos. On the CodePulse side it is a textbook "add one optional field to an existing table" change (`llmMetrics.traceId: v.optional(v.string())`) plus a new purely-custom presentational component (`TraceWaterfall.tsx`) that reads data already captured (`latencyMs`, `cost`, `cacheReadInputTokens`, `cacheCreationInputTokens`). No new libraries, no new Convex indexes are strictly required, no new shadcn components need installing. On the Ástríðr side, the only non-trivial engineering is propagating a per-turn `traceId` via a contextvar so all three provider emit-sites (`anthropic_provider.py`, `openrouter.py`, `ollama.py`) attach it uniformly — this repo already has the exact precedent to mirror twice over: `goalId`'s `get_goal_context()`/`set_goal_context()` pair in `astridr/engine/telemetry.py`, and a live example of setting a **fresh per-turn** id at `astridr/channels/router.py:498` (`set_goal_context(str(uuid.uuid4()))`, wrapped in try/finally around the turn lock).

Two verified pitfalls surfaced that are not visible from CONTEXT.md alone and should shape the plan: (1) `ollama.py`'s `llm_call` emitter does **not** currently call `get_goal_context()` at all (unlike anthropic_provider.py and openrouter.py) — CONTEXT.md's framing ("all providers already emit goalId uniformly") is not quite accurate for Ollama, so wiring `traceId` there is net-new emitter code, not just an extension; and (2) `llmMetrics.timestamp` is stored in **seconds** (Unix epoch / 1000, consistent with every other Convex table and query in this codebase) while `latencyMs` is in **milliseconds** — the UI-SPEC's literal formula "`start = timestamp − latencyMs`" is a unit mismatch unless divided by 1000 first. This must be corrected in the component, not copied verbatim.

**Primary recommendation:** Extend `llmMetrics`/`recordCall`/`runtimeIngest.ts` with an optional `traceId` (snake/camel alias, exactly like every other field in that switch case) with no new index — group client-side within the already-fetched `by_session` result set (session-scale row counts, typically tens to low hundreds). Build `TraceWaterfall.tsx` as a new, fully independent component (no import of `GanttTimeline`) using the same `toPercent`/tick-generation math but reading colors exclusively from CSS custom properties (`var(--chart-1)`, `var(--status-*)`) — do NOT copy `GanttTimeline`'s hardcoded hex `EVENT_COLORS`/`STATUS_COLORS` maps, which predate the Phase 89 tokenization and are the one part of that component NOT to mirror. On the Ástríðr side, set the per-turn `traceId` contextvar at the entry of `AgentLoop._process_inner` (fires for every `process()` invocation — chat turns via router.py AND automation/queen-triggered runs) rather than only in `router.py`, since `queen.py`'s swarm-task path calls the loop directly and would otherwise never get a traceId.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| traceId generation (per-turn) | Astridr agent loop (backend, cross-repo) | — | The "turn" boundary only exists inside `AgentLoop`; CodePulse has no concept of a turn, only of ingested rows |
| traceId propagation to LLM providers | Astridr providers (backend, cross-repo) | — | Each provider (`anthropic_provider.py`, `openrouter.py`, `ollama.py`) builds its own `llm_call` payload independently; propagation is a contextvar read at each emit site, mirroring `goalId` |
| traceId ingest pass-through | API / Backend (Convex `runtimeIngest.ts` + `llm.ts`) | Database (`schema.ts`) | Existing `/runtime-ingest` HTTP route already owns all `llm_call` field mapping; schema is the storage contract |
| Trace grouping / waterfall assembly | Browser / Client (`TraceWaterfall.tsx`) | — | Grouping by `traceId` at session scale (tens–hundreds of rows) is cheap client-side `Map` bucketing; no new Convex query/index needed |
| Live reactivity | API / Backend (Convex `useQuery` subscription) | Browser / Client | Convex's reactive query system already pushes new `llmMetrics` rows to any open `by_session` subscription — zero new plumbing |
| Cost/cache annotation display | Browser / Client | — | Pure presentation of already-ingested fields (`cost`, `cacheReadInputTokens`, `cacheCreationInputTokens`); no derivation, no estimation (D-14) |
| LangfuseTraceLink removal | Browser / Client (`Analytics.tsx`) | — | Static component + two import/usage sites; no backend involvement |

## Standard Stack

### Core
No new libraries. This phase is 100% additive within the existing stack:

| Library | Version (verified installed) | Purpose | Why Standard (house convention) |
|---------|---------|---------|--------------|
| convex | ^1.42.0 (CLI `1.42.1` confirmed via `npx convex --version`) | Schema, mutations, queries, reactivity | Already the sole backend; no alternative considered |
| react / react-dom | ^19.2.7 | UI | Existing stack |
| react-router-dom | ^7.13.1 | `useSearchParams` for the `?tab=trace` deep-link (D-08), mirroring the existing `useFocusParam` cross-nav pattern | Already used for 5+ cross-nav deep-links (Phase 85/88/90) |
| tailwindcss | ^4.2.1 | Styling via `var(--...)` tokens | House convention (Phase 89 tokenization) |
| radix-ui (via shadcn) | ^1.4.3 | `Collapsible` primitive for trace-group expand/collapse | Already installed, zero new `npx shadcn add` |
| vitest | ^4.1.9 | Unit tests (Convex functions + component logic) | Existing test runner |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/components/ui/card.tsx`, `badge.tsx`, `tooltip.tsx` | already installed | Trace-group card chrome, cache badge, hover detail | Reuse verbatim per UI-SPEC Registry Safety table |
| `src/lib/formatters.ts` (`formatCost`, `formatDurationMs`) | n/a (in-repo) | `formatCost` produces `"$0.0420"`-style 4-decimal strings matching UI-SPEC's `"$0.042"` bar-label example; `formatDurationMs` handles the ms-based `latencyMs` field directly (no unit conversion needed for display, only for bar-position math) | Reuse, do not reimplement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom flex/CSS bars (chosen, D-09) | Recharts (already a dependency, `^3.8.0`) | Recharts has no native Gantt/waterfall primitive; would require the same custom-bar math anyway, plus SVG overhead for a simple flex-positioned bar — house precedent (`GanttTimeline`) already proves custom CSS bars are the established pattern for exactly this shape of data |
| `by_session` + client grouping (recommended) | New `by_trace` Convex index | A dedicated index only pays off if querying traces independent of session becomes common (e.g., a future cross-session trace browser, explicitly deferred in CONTEXT.md); at session scale, grouping ~50-300 already-fetched rows by a string key client-side is O(n) and trivial |

**Installation:**
No `npm install` needed — every library above is already a project dependency.

**Version verification:**
```bash
npm view convex version   # confirms latest npm-published version, informational only — do NOT bump the pinned ^1.42.0
```
Convex CLI `1.42.1` is already installed and working in this environment (verified via `npx convex --version`). No package changes required for this phase.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new external packages.** Every library referenced above is already present in `package.json` (verified by reading the file directly) and already in active use elsewhere in the codebase. The Package Legitimacy Gate protocol is skipped per its own scope ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Ástríðr (astridr-repo)                                             │
│                                                                       │
│  AgentLoop._process_inner()  ── entry of every process() call ──┐   │
│    (chat turns via router.py AND queen.py automation turns)      │   │
│    set_trace_context(str(uuid.uuid4()))  [NEW, mirrors goalId]   │   │
│    ...turn executes, may call multiple providers/tools...        │   │
│    reset_trace_context(token)  [finally]                          │   │
│         │                                                          │   │
│         ▼                                                          │   │
│  anthropic_provider.py / openrouter.py / ollama.py                │   │
│    get_trace_context() → attach traceId to llm_call payload        │   │
│    (mirrors existing get_goal_context() → goalId pattern)          │   │
│         │                                                          │   │
│         ▼                                                          │   │
│  ConvexHandler.send("llm_call", payload)                            │   │
│    → buffered, flushed to CodePulse /runtime-ingest (existing)      │   │
└─────────┼────────────────────────────────────────────────────────────┘
          │  HTTP POST (existing transport, no change)
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CodePulse (convex/)                                                 │
│                                                                       │
│  runtimeIngest.ts  case "llm_call":                                  │
│    traceId: d.traceId ?? d.trace_id   [NEW alias, existing pattern] │
│         │                                                            │
│         ▼                                                            │
│  llm.ts  recordCall(mutation)  →  llmMetrics table                   │
│    traceId: v.optional(v.string())   [NEW field]                    │
│    (rows without traceId: existing rows + any untraced emitter)     │
└─────────┼──────────────────────────────────────────────────────────┘
          │  Convex reactive query (existing, no polling)
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (src/)                                                      │
│                                                                       │
│  SessionDetail.tsx  "Trace" tab  (?tab=trace deep-link)              │
│         │  useQuery(api.llm.<query>, {sessionId}) via by_session     │
│         ▼                                                            │
│  TraceWaterfall.tsx  [NEW component]                                 │
│    1. group rows by traceId (client-side Map)                       │
│    2. rows with traceId=undefined → single "Untraced calls" group    │
│    3. sort groups chronologically by first-call timestamp            │
│    4. render each group as collapsible header + per-call bars        │
│       bar.start = row.timestamp − row.latencyMs/1000  (seconds!)     │
│       bar.width = row.latencyMs/1000                                 │
│                                                                       │
│  Analytics.tsx  recent-calls table row → "View Trace" cross-link     │
│    → /sessions/:id?tab=trace  (D-08, house cross-nav pattern)        │
│  LangfuseTraceLink.tsx  [DELETED] + its two Analytics.tsx usages     │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
convex/
├── schema.ts            # llmMetrics: add traceId: v.optional(v.string())
├── llm.ts                # recordCall: add traceId arg + pass to db.insert
├── llm.test.ts           # extend mirrored-logic tests (see Validation Architecture)
├── runtimeIngest.ts      # llm_call case: traceId: d.traceId ?? d.trace_id
└── runtimeIngest.test.ts # extend traceId extraction test (mirrors existing goalId test)

src/
├── components/
│   ├── TraceWaterfall.tsx        # NEW — Gantt-styled, parallel structure to GanttTimeline
│   ├── TraceWaterfall.test.tsx   # NEW
│   └── LangfuseTraceLink.tsx     # DELETE
├── pages/
│   ├── SessionDetail.tsx         # TABS array: add {key:"trace", label:"Trace"}; useSearchParams wiring
│   └── Analytics.tsx             # remove LangfuseTraceLink import + 2 usage sites; add "View Trace" cross-link in recent-calls table
```

### Pattern 1: Turn-scoped contextvar propagation (mirror `goalId`)
**What:** A `contextvars.ContextVar` set once per unit-of-work, read by every downstream emitter, reset in a `finally` block.
**When to use:** Any cross-cutting id that needs to reach multiple independent emit sites without threading it through every function signature.
**Example (existing, to mirror exactly):**
```python
# Source: astridr/channels/router.py:490-516 (existing, working precedent)
lock = self.get_turn_lock(message.chat_id)
async with lock:
    _goal_token = set_goal_context(str(uuid.uuid4()))
    try:
        await self._route_locked(message, channel)
    finally:
        reset_goal_context(_goal_token)
```
```python
# Source: astridr/providers/anthropic_provider.py:560-579 (existing, working precedent)
if self._telemetry:
    from astridr.engine.telemetry import get_goal_context as _get_goal_ctx
    _llm_payload: dict[str, Any] = { ... }
    _gid = _get_goal_ctx()
    if _gid:
        _llm_payload["goalId"] = _gid
    await self._telemetry.send("llm_call", _llm_payload)
```
The new `traceId` mechanism should add a parallel `_current_trace_id` ContextVar + `set_trace_context`/`get_trace_context`/`reset_trace_context` trio in `telemetry.py` (do not overload the existing goal-context vars — traceId and goalId have different scopes: one turn vs. one swarm-delegation chain, and both can be present on the same call simultaneously).

**Recommended insertion point:** `AgentLoop._process_inner()` (astridr/agent/loop.py:819+), not `router.py`. `_process_inner` is the single choke point for every `process()` invocation regardless of caller — chat messages via `router.py`'s turn lock, **and** automation/swarm-triggered runs via `queen.py`, which calls the loop directly and does not go through `router.py`'s turn lock at all. Setting the traceId only in `router.py` (as CONTEXT.md's phrasing might suggest by analogy to goalId) would silently leave all queen-triggered LLM calls untraced — worth flagging explicitly since D-02 says "one loop iteration," and `_process_inner` is the literal one-per-loop-iteration entry point.

### Pattern 2: Optional-field backward-compatible schema extension
**What:** Add `v.optional(v.string())` to an existing `defineTable`, extend the corresponding mutation's args, extend the ingest handler's field mapping — no migration, no backfill.
**When to use:** Any additive, non-breaking schema change (established house pattern — `agentId`, `goalId`, both cache fields were all added this way).
**Example:**
```typescript
// Source: convex/schema.ts:297-320 (existing table, pattern to extend)
llmMetrics: defineTable({
  // ...existing fields...
  goalId: v.optional(v.string()),          // Phase 149 PULSE-01 — precedent
  traceId: v.optional(v.string()),         // NEW — Phase 94 TRACE-01
})
  .index("by_session", ["sessionId", "timestamp"])
  // no new index needed — see Standard Stack "Alternatives Considered"
```
```typescript
// Source: convex/runtimeIngest.ts:58-76 (existing switch case, pattern to extend)
case "llm_call": {
  const d = data as any;
  await ctx.runMutation(api.llm.recordCall, {
    // ...existing fields...
    goalId: d.goalId ?? d.goal_id,
    traceId: d.traceId ?? d.trace_id,        // NEW — same alias convention
    cacheReadInputTokens: d.cacheReadInputTokens ?? d.cache_read_input_tokens,
    cacheCreationInputTokens: d.cacheCreationInputTokens ?? d.cache_creation_input_tokens,
  });
  break;
}
```
After schema/mutation changes, run `npx convex codegen` (offline, regenerates `convex/_generated/api.d.ts` — NOT a deploy) exactly as done in Phase 88 Plan 02. A full `npx convex dev --once` or `npx convex deploy --yes` is a separate, later step (see D-05 live-integration gate below), not needed for local type-checking.

### Pattern 3: Client-side grouping of a reactive query result
**What:** Fetch once via `useQuery(..., by_session)`, then bucket rows by `traceId` in a `useMemo`, exactly like `GanttTimeline`'s existing `agentEventMap`/`orphanEvents` split (traced-agent-event vs. orphan-event) — same shape of problem, one more level of grouping.
**Example (structural precedent — not traceId-specific, GanttTimeline's existing orphan-bucket pattern to mirror):**
```typescript
// Source: src/components/GanttTimeline.tsx:73-85 (existing, structural precedent for D-04's "Untraced calls" bucket)
const agentEventMap = new Map<string, Event[]>();
const orphanEvents: Event[] = [];
for (const e of events) {
  const agentId = e.payload?.agentId;
  if (agentId && agents.some((a) => a.agentId === agentId)) {
    if (!agentEventMap.has(agentId)) agentEventMap.set(agentId, []);
    agentEventMap.get(agentId)!.push(e);
  } else {
    orphanEvents.push(e);
  }
}
```
`TraceWaterfall.tsx` should build an equivalent `Map<traceId, LlmMetricRow[]>` plus an `untracedRows: LlmMetricRow[]` array (rows where `traceId === undefined`), sort trace groups by their earliest row's `timestamp`, and render the untraced group last and un-collapsible (per D-10/UI-SPEC).

### Anti-Patterns to Avoid
- **Copying `GanttTimeline`'s hardcoded hex color maps (`EVENT_COLORS`, `STATUS_COLORS`):** These predate the Phase 89 CSS-token migration and are a live violation of the "never hardcode hex" house rule the UI-SPEC restates for this phase. Mirror `GanttTimeline`'s *structure* (time-axis math, lane layout, hover pattern) but use `var(--chart-1)`, `var(--status-ok)`, `var(--status-warn)`, `var(--status-error)`, `var(--muted-foreground)` directly in inline `style` (consistent with how the UI-SPEC's Color table is written) — do not introduce a new hardcoded color constant object.
- **Mixing timestamp units:** `llmMetrics.timestamp` is Unix **seconds** (confirmed via every query in `convex/llm.ts` using `Date.now() / 1000` for cutoffs, and `GanttTimeline`'s own `const now = Date.now() / 1000`). `latencyMs` is **milliseconds**. Bar math must be `start = row.timestamp - row.latencyMs / 1000` and `width = row.latencyMs / 1000` — both in the seconds domain the rest of the time axis uses. A literal reading of the UI-SPEC's shorthand formula ("start = timestamp − latencyMs") would place every bar off-screen or with a near-zero visible width once the axis is scaled in seconds.
- **Auto-injecting traceId inside `ConvexHandler.send()`:** Unlike `sessionId` (which IS auto-injected in `send()` at telemetry.py:271-278), `goalId` is manually read and attached at each provider's payload-construction site, not centrally. Follow the `goalId` precedent for `traceId` (explicit per-provider read) rather than the `sessionId` precedent (central auto-inject) — mixing the two auto-inject patterns in one `send()` call adds branching complexity for no benefit, since only 3 call sites need it.
- **Assuming Ollama already emits goalId-style context:** It does not (verified — `ollama.py`'s `llm_call` payload has no `get_goal_context()` call, unlike `anthropic_provider.py` and `openrouter.py`). Adding `traceId` to Ollama's emitter is new code, not an extension of an existing pattern at that specific site — budget accordingly.
- **New Convex index for traceId:** Not needed at session scale (see Alternatives Considered). Adding one anyway costs a schema-migration write-amplification cycle for zero read benefit until a cross-session trace browser exists (explicitly deferred).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timing-bar/Gantt rendering | A canvas-based or SVG-based Gantt renderer | Flex/absolute-positioned `<div>` bars with `left`/`width` percentages, exactly like `GanttTimeline.tsx` | The existing component proves this scales fine at session-level row counts (tens–hundreds of bars); canvas/SVG adds complexity (hit-testing, redraw) with no payoff at this scale |
| Cost estimation for rows missing `cost` | A per-model price-table lookup to "fill in" a plausible cost | Render `"n/a"` / dash (D-14) | Explicit house decision (standing precision bar) — any derived number becomes a second source of truth that can silently drift from the real billing data |
| Cache-hit inference for legacy rows | Treating `cacheReadInputTokens === undefined` the same as `=== 0` (i.e., rendering a fake "MISS") | Three-state badge: HIT / MISS / NO DATA (D-13) — `undefined` fields render no badge at all | Conflating "no data" with "cache miss" would fabricate a signal that never existed for pre-Phase-94 rows |
| Trace-group time-gap inference for untraced rows | Clustering untraced legacy `llmMetrics` rows into synthetic "traces" by idle-gap heuristics | Flat, single "Untraced calls" bucket, un-collapsible (D-04) | Explicitly rejected in CONTEXT.md — any inferred boundary is an invented fact that could mislead an operator debugging a real incident |

**Key insight:** Every "don't hand-roll" item in this phase is really "don't invent data that doesn't exist" — the phase's precision bar (zero fabricated costs, zero fabricated cache states, zero fabricated trace boundaries) is the dominant design constraint, more so than any technical library choice.

## Common Pitfalls

### Pitfall 1: Timestamp/latency unit mismatch in bar positioning
**What goes wrong:** Bars render with the wrong position/width, or all appear collapsed near time-axis origin.
**Why it happens:** `llmMetrics.timestamp` is stored in seconds; `latencyMs` is milliseconds. A naive `start = timestamp - latencyMs` (per the UI-SPEC's shorthand) treats a ~200-5000 range of milliseconds as if it were seconds, shifting bars by minutes instead of fractions of a second.
**How to avoid:** Always divide `latencyMs` by 1000 before combining with `timestamp` in the same arithmetic expression. Write a one-line unit test asserting `barStart === row.timestamp - row.latencyMs / 1000` for a known fixture row.
**Warning signs:** Bars that don't visually align under their trace group's time-axis position, or bars that all look identical width regardless of actual latency.

### Pitfall 2: traceId set only at the chat/router layer, missing automation-triggered calls
**What goes wrong:** LLM calls made during `queen.py`-triggered swarm/automation turns never carry a `traceId`, so they permanently land in the "Untraced calls" bucket even after the emitter change ships — looking like a bug ("why isn't tracing working for automation sessions?") rather than a scope gap.
**Why it happens:** `router.py`'s turn-lock wrapper (the obvious place to mirror, since it's where `goalId` is set for goal-scoped conversational turns) is chat-specific; `queen.py` calls `AgentLoop.process()`/`run()` directly for automation, bypassing `router.py` entirely.
**How to avoid:** Set the traceId contextvar inside `AgentLoop._process_inner()` (or an equivalent single-entry wrapper covering both `process()` and `run()`), not in `router.py`.
**Warning signs:** During the D-05 live-verification step, an automation-triggered session shows zero traced calls while a chat session shows normal grouping.

### Pitfall 3: Confusing `goalId` and `traceId` semantics
**What goes wrong:** Reusing the existing `_current_goal_id` contextvar (or wiring `traceId` to always equal `goalId`) collapses two genuinely different groupings — a goal can span many turns (many traceIds), and a turn with no active goal (plain chat) should still get a traceId.
**Why it happens:** Both are "just a string set via contextvar and read at provider emit sites," and D-03's phrasing ("mirroring the existing goalId `get_goal_context()` pattern") could be misread as "reuse the same variable."
**How to avoid:** Add a distinct `_current_trace_id` ContextVar with its own `set_trace_context`/`get_trace_context`/`reset_trace_context` trio. A single `llm_call` payload may legitimately carry both a `goalId` and a `traceId` simultaneously (independent axes: "which swarm goal" vs. "which turn").
**Warning signs:** Every row with a `traceId` also has an identical `goalId` and vice versa (a strong signal the two got merged), or turns with no goal never get grouped in the waterfall at all.

### Pitfall 4: Backward-compat regression on rows already in prod
**What goes wrong:** A query or component assumes `traceId` is always present and throws/renders incorrectly on the many existing rows that lack it.
**Why it happens:** TypeScript's `v.optional()` types the field as `string | undefined` in Convex codegen, but a naive `row.traceId.slice(...)` or `groupBy(row => row.traceId)` (using `undefined` as a literal Map key across many rows) will silently bucket ALL untraced rows under a single `undefined` key — which is actually the desired D-04 behavior, but must be verified explicitly, not assumed.
**How to avoid:** Write an explicit test fixture mixing traced and untraced rows and assert the untraced ones land in exactly one "Untraced calls" group, in chronological order, and that no row is dropped.
**Warning signs:** Existing/older sessions (recorded before this phase ships) show either a crash or a waterfall with zero data.

### Pitfall 5: `LangfuseTraceLink` deletion breaking `Analytics.tsx`'s import graph
**What goes wrong:** Deleting the component file without removing both usage sites (`Analytics.tsx:30` import, `Analytics.tsx:83` JSX usage) breaks `tsc --noEmit` and the Vite build.
**Why it happens:** Simple omission — two separate line numbers in the same file, easy to catch one and miss the other.
**How to avoid:** `grep -rn "LangfuseTraceLink" src/` before and after the deletion to confirm zero remaining references (confirmed at research time: exactly these two lines in `Analytics.tsx` plus the component's own file — no other usage sites in the repo).
**Warning signs:** `npx tsc --noEmit` fails with "Cannot find module '../components/LangfuseTraceLink'".

## Code Examples

### Verified: current `llmMetrics` schema (base to extend)
```typescript
// Source: convex/schema.ts:297-320 (read directly, current state)
llmMetrics: defineTable({
  provider: v.string(),
  model: v.string(),
  promptTokens: v.float64(),
  completionTokens: v.float64(),
  totalTokens: v.float64(),
  latencyMs: v.float64(),
  cost: v.optional(v.float64()),
  sessionId: v.optional(v.string()),
  timestamp: v.float64(),
  archived: v.optional(v.boolean()),
  agentId: v.optional(v.string()),
  toolName: v.optional(v.string()),
  billingType: v.optional(v.string()),
  goalId: v.optional(v.string()),
  cacheReadInputTokens: v.optional(v.float64()),
  cacheCreationInputTokens: v.optional(v.float64()),
})
  .index("by_provider", ["provider", "timestamp"])
  .index("by_model", ["model", "timestamp"])
  .index("by_session", ["sessionId", "timestamp"])
  .index("by_timestamp", ["timestamp"])
  .index("by_agent", ["agentId", "timestamp"])
  .index("by_goal", ["goalId", "timestamp"]),
```

### Verified: existing "recent calls" query shape to add a session-scoped equivalent from
```typescript
// Source: convex/llm.ts:117-127 (existing pattern — not session-scoped;
// the new Trace-tab query should mirror this but filter/withIndex on
// by_session instead of by_timestamp, per D-12's "useQuery on by_session")
export const recentCalls = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .take(50);
  },
});
```

### Verified: existing SessionDetail tab-bar pattern to extend
```typescript
// Source: src/pages/SessionDetail.tsx:16-24 (current state — no useSearchParams
// wiring exists yet for any tab; D-08's deep-link requires adding this, not
// just extending TABS)
type Tab = "overview" | "timeline" | "files" | "bash" | "errors";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "timeline", label: "Timeline" },
  { key: "files", label: "Files" },
  { key: "bash", label: "Bash" },
  { key: "errors", label: "Errors" },
];
// activeTab is currently local useState only — NOT wired to useSearchParams.
// D-08 says "initialize from useSearchParams if not already wired for other
// tabs — check before adding a second mechanism." VERIFIED: it is not wired
// for any existing tab, so this phase introduces the FIRST useSearchParams
// wiring on this page — no existing second mechanism to conflict with.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Static `<LangfuseTraceLink />` pointing to `https://cloud.langfuse.com` (never configured, always a dead external link) | In-app `TraceWaterfall` reading data already in Convex | This phase (94) | Operators get an actual per-call breakdown instead of a link to a service that was never stood up |
| `goalId`-only grouping (Phase 149, swarm cost attribution) | `traceId` grouping (this phase, per-turn) | This phase (94) | Finer granularity: one goal can span many turns/traces; this phase adds the turn-level axis alongside the existing goal-level one — they coexist, not replace each other |

**Deprecated/outdated:** Nothing in this phase deprecates prior work — `goalId`/`by_goal` stays exactly as-is; this phase is purely additive.

**Separately worth flagging (not in scope, but adjacent):** `astridr/integrations/langfuse_tracer.py` (`LangfuseTracer`, wired via `BaseProvider.chat_with_trace()` in `astridr/agent/loop.py:1202,2089`) is a **real**, feature-flagged, optional Langfuse Cloud SDK integration (`LANG-01`), separate from the CodePulse `LangfuseTraceLink.tsx` dead link this phase removes. REQUIREMENTS.md's "no self-hosted Langfuse/Phoenix" exclusion refers to standing up new infrastructure, not this existing optional astridr-side integration — this phase does not touch `langfuse_tracer.py`, and the planner should not conflate the two when scoping the Ástríðr-side changes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `_process_inner` is the correct universal insertion point for the traceId contextvar (rather than `router.py` alone) | Architecture Patterns / Pitfall 2 | If wrong (e.g., if `queen.py` intentionally should NOT trace automation turns), the plan would add tracing to a path the user didn't want traced; low risk since untraced rows degrade gracefully to the "Untraced calls" bucket (D-04) regardless |
| A2 | `traceId` should be a distinct contextvar from `goalId`, not reuse it | Pitfall 3 | If the user actually wants trace≡goal for simplicity, a distinct-variable design still supports that trivially (just set both to the same generated id at the call site) — low risk, more flexible either way |

**Risk assessment:** Both assumptions are LOW risk because the D-04 backward-compatible fallback (flat "Untraced calls" bucket) means any gap in traceId propagation degrades to a visible-but-correct state rather than a broken one. Recommend confirming A1 with the user during planning discretion resolution ("Loop-level insertion point... is Claude's discretion" per CONTEXT.md) rather than treating it as a hard requirement.

## Open Questions (RESOLVED)

1. **Should `traceId` be a bare `uuid4()` or a prefixed/structured id (e.g., `trace_<uuid4>`)?**
   - What we know: `goalId` uses bare `str(uuid.uuid4())` with no prefix (`router.py:498`).
   - What's unclear: whether a prefix would help future debugging (grepping raw logs for `trace_` vs `goal_` ids) — CONTEXT.md marks the exact format as Claude's discretion.
   - Recommendation: Follow the `goalId` precedent exactly (bare uuid4, no prefix) for consistency — the two ids are already visually distinguishable by which JSON field they appear under.
   - **RESOLVED:** Adopted the recommendation — bare `str(uuid.uuid4())`, no prefix (matches `goalId` precedent). Implemented in Plan 94-02.

2. **Does automation/queen-triggered traceId tracing need a separate opt-out?**
   - What we know: `queen.py` already sets its own `goalId` per swarm task (queen.py:744-797); adding traceId at the `_process_inner` level would apply uniformly to both chat and automation turns.
   - What's unclear: whether the user wants automation-triggered LLM calls traced at all, or considers "trace" to mean "conversational turn" specifically (D-02's wording: "one user message / one loop iteration" — automation IS a loop iteration, just not user-initiated).
   - Recommendation: Trace uniformly (simpler, one code path, and D-04's fallback means nothing breaks if some rows end up traced that the user didn't strictly need traced) — flag for a quick confirmation during planning/discuss if the user wants to exclude automation turns explicitly.
   - **RESOLVED:** Adopted uniform tracing — the traceId contextvar is set once at `_process_inner`, covering both chat and automation/queen turns (no separate opt-out). Implemented in Plan 94-02.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev/build, Vitest | ✓ | v22.22.3 | — |
| npm | Package management | ✓ | 10.9.8 | — |
| Convex CLI (`npx convex`) | Schema deploy, codegen, `convex dev` | ✓ | 1.42.1 | — |
| Ástríðr repo access (`C:/Users/mandr/astridr-repo`) | Cross-repo provider/loop changes (TRACE-01 emitter) | ✓ (confirmed readable in this session) | n/a | — |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** None identified — this phase has no new external service or package dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (jsdom environment, `src/test/setup.ts`) |
| Config file | `vite.config.ts` (Vitest config colocated with Vite config — confirmed via `npm test` → `vitest`) |
| Convex test pattern | **No `convex-test` library is used** (confirmed absent from `package.json`). Convex function logic is tested via hand-mirrored pure functions with an in-memory mock `ctx.db` (see `convex/llm.test.ts`, `convex/runtimeIngest.test.ts` — e.g. `recordCallLogic()` mirrors `recordCall`'s handler body byte-for-byte and `extractLlmCallGoalId()` mirrors the ingest alias logic). New `traceId` tests must follow this exact mirrored-logic-function pattern, not attempt to import/instantiate real Convex runtime objects. |
| Quick run command | `npx vitest run convex/llm.test.ts convex/runtimeIngest.test.ts` |
| Full suite command | `npm test -- --run` (or `npx vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRACE-01 | `recordCall`/ingest persist `traceId` when present, `undefined` when absent (backward compat) | unit | `npx vitest run convex/llm.test.ts` | ✅ (extend existing `goalId`-mirror pattern) |
| TRACE-01 | `runtimeIngest.ts` extracts `traceId` from both `traceId` and `trace_id` payload keys | unit | `npx vitest run convex/runtimeIngest.test.ts` | ✅ (extend existing `extractLlmCallGoalId`-style test) |
| TRACE-02 | Rows grouped by `traceId` render as collapsible groups; rows without `traceId` render in one flat "Untraced calls" group | unit (component logic) | `npx vitest run src/components/TraceWaterfall.test.tsx -x` | ❌ Wave 0 — new file |
| TRACE-02 | Bar position math: `start = timestamp - latencyMs/1000`, `width = latencyMs/1000` | unit | `npx vitest run src/components/TraceWaterfall.test.tsx -x` | ❌ Wave 0 — same new file, dedicated test case per Pitfall 1 |
| TRACE-02 | Cache badge three-state logic (HIT/MISS/NO DATA per D-13) | unit | `npx vitest run src/components/TraceWaterfall.test.tsx -x` | ❌ Wave 0 — same new file |
| TRACE-02 | Cost dash rendering when `cost` is undefined (D-14, no estimation) | unit | `npx vitest run src/components/TraceWaterfall.test.tsx -x` | ❌ Wave 0 — same new file |
| TRACE-02 | `LangfuseTraceLink` fully removed, `tsc --noEmit` and build stay green | smoke | `npx tsc --noEmit && npm run build` | ✅ (existing commands, no new file) |
| TRACE-01 (cross-repo) | Real Ástríðr-emitted `llm_call` carrying `traceId` lands in prod Convex and renders grouped | manual-only (D-05 live-integration gate) | operator verification against `tidy-whale-981` after deploy | N/A — explicit plan verification step, not automatable in CI (mirrors Phase 90/93 lesson) |

### Sampling Rate
- **Per task commit:** `npx vitest run convex/llm.test.ts convex/runtimeIngest.test.ts src/components/TraceWaterfall.test.tsx`
- **Per wave merge:** `npm test -- --run && npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`, AND the D-05 live E2E bar (a real traceId observed grouped in prod) — convex-test/vitest green alone does not close this phase, per CONTEXT.md D-05.

### Wave 0 Gaps
- [ ] `src/components/TraceWaterfall.test.tsx` — covers TRACE-02 grouping, bar math, cache-badge, cost-dash logic (net-new component, net-new test file)
- [ ] Extend `convex/llm.test.ts` — add `traceId`-persistence test case mirroring the existing `goalId` test block (lines 37-52)
- [ ] Extend `convex/runtimeIngest.test.ts` — add `traceId`/`trace_id` extraction test case mirroring `extractLlmCallGoalId` (lines 232-237)
- [ ] Ástríðr-side: no existing test file covers `get_goal_context`-style contextvar propagation directly by name — check `tests/test_queen_unit.py` and `tests/unit/tools/test_delegate_task_goal_grouping.py` (both already exercise the `goalId` contextvar path) as the pattern to mirror for a new `test_trace_context` — this is a Wave 0 gap on the Ástríðr side too, to be confirmed during planning since astridr-repo's test suite is a separate CI surface from CodePulse's.

*(No framework install needed — Vitest is already configured and running.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface — `/runtime-ingest` already Bearer-gated (`validateIngestAuth`), unchanged by this phase |
| V3 Session Management | no | No session-management change |
| V4 Access Control | no | Trace tab is read-only (no new mutations), gated by the same session-scoped read access as every other SessionDetail tab |
| V5 Input Validation | yes | `traceId` is `v.optional(v.string())` — Convex validators already reject non-string values at the mutation boundary; no additional validation needed since it's an opaque grouping key, never interpolated into a query string or rendered as raw HTML |
| V6 Cryptography | no | Not a secret; uuid4 generation on the Ástríðr side uses Python's `uuid` stdlib, same as the existing `goalId` precedent |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated write to `/runtime-ingest` forging a `traceId` to pollute another session's waterfall | Tampering / Spoofing | Already mitigated by the existing `validateIngestAuth` Bearer-token gate on the whole route (unchanged, inherited) — no new gate needed since `traceId` rides the same authenticated `llm_call` payload as every other field |
| XSS via reflecting `traceId`/`model` string directly into the DOM in the bar label | Tampering | React's default JSX text-node escaping handles this automatically (no `dangerouslySetInnerHTML` anywhere in the proposed component) — same protection every other text-rendering component in the codebase already relies on |

## Sources

### Primary (HIGH confidence — read directly from the live repos in this session)
- `C:/Users/mandr/codepulse/convex/schema.ts` (lines 297-320) — current `llmMetrics` table shape
- `C:/Users/mandr/codepulse/convex/runtimeIngest.ts` (lines 1-981, `llm_call` case at 58-77) — full ingest dispatcher and the exact alias pattern to extend
- `C:/Users/mandr/codepulse/convex/llm.ts` (full file) — `recordCall` mutation, all session/provider/model query shapes
- `C:/Users/mandr/codepulse/convex/llm.test.ts`, `convex/runtimeIngest.test.ts` — confirmed the mirrored-logic-function test pattern (no `convex-test` library in use)
- `C:/Users/mandr/codepulse/src/components/LangfuseTraceLink.tsx`, `src/pages/Analytics.tsx` (lines 1-100) — confirmed exact deletion scope, only 2 usage sites in the whole repo (grep-verified)
- `C:/Users/mandr/codepulse/src/pages/SessionDetail.tsx` (full file) — tab bar, `useQuery` wiring per tab, confirmed no existing `useSearchParams` wiring on this page
- `C:/Users/mandr/codepulse/src/components/GanttTimeline.tsx` (full file) — structural precedent (`toPercent`, tick generation, orphan-lane grouping) and the hardcoded-hex anti-pattern to avoid
- `C:/Users/mandr/codepulse/src/hooks/useThemeColors.ts`, `src/index.css` (token grep) — confirmed theme-token names (`--chart-1`, `--status-ok/warn/error`) and that they vary per active skin (cyan/emerald/readable/aubergine)
- `C:/Users/mandr/codepulse/src/lib/formatters.ts` — confirmed `formatCost`/`formatDurationMs` helpers exist and match UI-SPEC's label examples
- `C:/Users/mandr/codepulse/src/components/ui/collapsible.tsx` — confirmed Radix Collapsible wrapper already installed
- `C:/Users/mandr/codepulse/package.json` — confirmed all dependency versions, confirmed no `convex-test` package
- `C:/Users/mandr/astridr-repo/astridr/engine/telemetry.py` (full goal-context section, lines 71-84, 520-562) — the exact `goalId` contextvar API to mirror for `traceId`
- `C:/Users/mandr/astridr-repo/astridr/channels/router.py` (lines 480-518) — the exact per-turn `set_goal_context(uuid4())`/`reset_goal_context` wrapping pattern (working precedent)
- `C:/Users/mandr/astridr-repo/astridr/agent/loop.py` (lines 784-833) — confirmed `_process_inner` as the universal per-`process()`-call entry point, used by both `router.py` and `queen.py` callers
- `C:/Users/mandr/astridr-repo/astridr/automation/queen.py` (goalId set/reset call sites, lines 744-797) — confirmed automation path sets its own `goalId` independent of `router.py`, supporting Pitfall 2's finding
- `C:/Users/mandr/astridr-repo/astridr/providers/anthropic_provider.py` (lines 500-582) — confirmed `goalId` manual-read-per-emit pattern (not auto-injected in `send()`)
- `C:/Users/mandr/astridr-repo/astridr/providers/openrouter.py` (lines 300-325) — confirmed same `goalId` pattern present
- `C:/Users/mandr/astridr-repo/astridr/providers/ollama.py` (lines 190-229) — confirmed `goalId`/`get_goal_context()` is **absent** here (Pitfall 1's cross-repo counterpart)
- `C:/Users/mandr/astridr-repo/astridr/providers/base.py` (lines 160-194), `astridr/integrations/langfuse_tracer.py` (lines 1-40) — confirmed the separate, feature-flagged, optional Langfuse Cloud SDK integration exists and is out of this phase's scope
- `.planning/phases/94-trace-waterfall/94-CONTEXT.md`, `94-UI-SPEC.md`, `94-DISCUSSION-LOG.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — full read, all decisions/constraints incorporated
- Live environment probe: `node --version` (v22.22.3), `npm --version` (10.9.8), `npx convex --version` (1.42.1)

### Secondary (MEDIUM confidence)
None — every claim in this document was verified directly against live repo files or live environment probes in this session; no WebSearch was needed since the entire phase is self-contained within two already-accessible repos with no new third-party library research required.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every library version confirmed directly from `package.json` and live CLI probes
- Architecture: HIGH — every pattern cited was read directly from the live source files in both repos, not inferred from training data
- Pitfalls: HIGH — all five pitfalls are backed by direct code reads (unit mismatch confirmed by reading both the schema comment convention and query code; Ollama gap confirmed by grep; router-vs-loop insertion point confirmed by reading both call sites)

**Research date:** 2026-07-06
**Valid until:** 30 days (stable — no external API/library surface involved; the only decay risk is if the Ástríðr repo's `telemetry.py`/`loop.py` structure changes before this phase executes, since it's a live cross-repo dependency)
