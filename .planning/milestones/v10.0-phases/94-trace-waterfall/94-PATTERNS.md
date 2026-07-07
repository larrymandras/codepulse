# Phase 94: Trace Waterfall - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 10 (5 CodePulse modified, 2 CodePulse new, 1 CodePulse deleted, 4 Ástríðr modified — cross-repo)
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/schema.ts` (`llmMetrics` table) | model | CRUD (schema) | same file, `goalId`/cache-field additions (L308-313) | exact — literal prior instance of this exact change shape |
| `convex/llm.ts` (`recordCall` mutation) | service/mutation | CRUD | same file, `goalId` arg + `db.insert` (L19, L38) | exact |
| `convex/llm.ts` (new session-scoped trace query) | service/query | CRUD (read) | `cacheStats`'s `by_session`-conditional branch (L76-83) in same file | role-match (nearest existing session-scoped `llmMetrics` read) |
| `convex/runtimeIngest.ts` (`llm_call` case) | controller (ingest dispatcher) | event-driven / request-response | same file, `goalId`/cache alias lines (L72-74) | exact |
| `convex/llm.test.ts` (extend) | test | CRUD | same file, `recordCall — goalId persistence` describe block (L37-67) | exact |
| `convex/runtimeIngest.test.ts` (extend) | test | event-driven | same file, `extractLlmCallGoalId` function + tests (L60-63, L232-246) | exact |
| `src/components/TraceWaterfall.tsx` (new) | component | transform (client-side grouping + render) | `src/components/GanttTimeline.tsx` (structure) | role-match (explicitly NOT to be imported/entangled, D-09) |
| `src/components/TraceWaterfall.test.tsx` (new) | test | transform | none (Wave 0 gap) — mirror `GanttTimeline`'s absence of a test + `runtimeIngest.test.ts`'s pure-function-extraction convention | no analog (new file, new test) |
| `src/pages/SessionDetail.tsx` (add Trace tab + `useSearchParams`) | component/page | request-response (routing) | same file's existing `TABS`/`activeTab` bar (L16-24, L59-73); `HivePage.tsx` for the **first** `useSearchParams` wiring pattern (L11, L24-25, L32-34) | role-match |
| `src/pages/Analytics.tsx` (remove `LangfuseTraceLink`, add "View Trace" cross-link) | component/page | request-response | same file (deletion sites, L30/L83); `KGDetailsPanel.tsx`'s `provenanceHref`/`ProvenanceLink` (L29-40) for the new cross-link | exact (deletion) / role-match (new link) |
| `src/components/LangfuseTraceLink.tsx` (DELETE) | component | n/a | — | n/a — deletion target, not an analog subject |
| `astridr/engine/telemetry.py` (new `_current_trace_id` contextvar trio) | service (context propagation) | event-driven | same file, `_current_goal_id` + `set_/reset_/get_goal_context` (L81-83, L546-561) | exact |
| `astridr/agent/loop.py` (`_process_inner` insertion point) | controller (agent loop) | event-driven | same file, `run_state.turn_count` / try-finally shape at `process()`→`_process_inner()` (L797-838) | role-match (loop has no existing per-turn-id precedent to copy verbatim; router.py's is the pattern to mirror, applied at a different insertion point) |
| `astridr/providers/anthropic_provider.py` (attach `traceId`) | service (provider emitter) | event-driven | same file, `goalId` attach block (L560-579) | exact |
| `astridr/providers/openrouter.py` (attach `traceId`) | service (provider emitter) | event-driven | same file, `goalId` attach block (L308-325) | exact |
| `astridr/providers/ollama.py` (attach `traceId` — net-new, no goalId precedent here) | service (provider emitter) | event-driven | `anthropic_provider.py`/`openrouter.py`'s attach block (cross-file, since ollama.py has no local precedent) | no local analog — cross-file pattern only (Pitfall confirmed: ollama.py's own `llm_call` emit at L213-228 has no `get_goal_context()` call) |

## Pattern Assignments

### `convex/schema.ts` (model, CRUD) — add `traceId` to `llmMetrics`

**Analog:** same table, `goalId`/cache-field precedent

**Current state** (lines 297-320, read directly):
```typescript
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
  agentId: v.optional(v.string()),    // Phase 59 SCH-02
  toolName: v.optional(v.string()),   // Phase 59 SCH-02
  billingType: v.optional(v.string()),  // "api" | "subscription" — Phase 67
  goalId: v.optional(v.string()),     // Phase 149 PULSE-01 — swarm cost join
  cacheReadInputTokens: v.optional(v.float64()),      // prompt-cache hit monitoring
  cacheCreationInputTokens: v.optional(v.float64()),  // prompt-cache write monitoring
})
  .index("by_provider", ["provider", "timestamp"])
  .index("by_model", ["model", "timestamp"])
  .index("by_session", ["sessionId", "timestamp"])
  .index("by_timestamp", ["timestamp"])
  .index("by_agent", ["agentId", "timestamp"])
  .index("by_goal", ["goalId", "timestamp"]),
```

**Pattern to copy:** add exactly one line, same style as `goalId`, no new index (per Claude's Discretion resolution — `by_session` + client grouping suffices at session scale, per RESEARCH.md Alternatives Considered):
```typescript
  goalId: v.optional(v.string()),     // Phase 149 PULSE-01 — swarm cost join
  traceId: v.optional(v.string()),    // Phase 94 TRACE-01 — per-turn trace grouping
```
Run `npx convex codegen` after (offline regen of `convex/_generated/api.d.ts`, not a deploy).

---

### `convex/llm.ts` (`recordCall` mutation) — thread `traceId` through

**Analog:** same file's `goalId` arg (line 19) and insert field (line 38)

**Current state** (lines 6-43, read directly):
```typescript
export const recordCall = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    promptTokens: v.float64(),
    completionTokens: v.float64(),
    totalTokens: v.float64(),
    latencyMs: v.float64(),
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
    agentId: v.optional(v.string()),
    toolName: v.optional(v.string()),
    goalId: v.optional(v.string()),   // Phase 149 PULSE-01 — swarm cost join
    cacheReadInputTokens: v.optional(v.float64()),      // prompt-cache hit monitoring
    cacheCreationInputTokens: v.optional(v.float64()),  // prompt-cache write monitoring
  },
  handler: async (ctx, args) => {
    const billingType = getBillingType(args.provider);
    await ctx.db.insert("llmMetrics", {
      provider: args.provider,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      latencyMs: args.latencyMs,
      cost: args.cost,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
      agentId: args.agentId,
      toolName: args.toolName,
      billingType,
      goalId: args.goalId,
      cacheReadInputTokens: args.cacheReadInputTokens,
      cacheCreationInputTokens: args.cacheCreationInputTokens,
    });
  },
});
```
Add `traceId: v.optional(v.string())` to `args` and `traceId: args.traceId,` to the insert — same position/style as `goalId`.

**New query needed for the Trace tab (TRACE-02, D-12):** no existing session-scoped `llmMetrics` query returns raw rows for client-side grouping (`cacheStats` aggregates, doesn't return rows). Nearest analog is `cacheStats`'s `by_session` conditional branch (lines 76-83):
```typescript
// Source: convex/llm.ts:76-83 (existing, structural precedent for a new session-scoped query)
const all = args.sessionId
  ? await ctx.db
      .query("llmMetrics")
      .withIndex("by_session", (q) =>
        q.eq("sessionId", args.sessionId!).gte("timestamp", cutoff)
      )
      .filter((q) => q.neq(q.field("archived"), true))
      .collect()
  : ...
```
New query (e.g. `bysession` or extend an existing session query) should drop the `cutoff`/`gte` (Trace tab wants the full session, not a rolling window) and `.order("asc")` for chronological bar rendering, mirroring `costOverTime`'s `by_timestamp`+`order("asc")` shape (lines 202-219) crossed with the `by_session` index usage above.

---

### `convex/runtimeIngest.ts` (`llm_call` case) — alias pass-through

**Analog:** same file, `goalId`/cache alias lines

**Current state** (lines 58-77, read directly):
```typescript
case "llm_call": {
  const d = data as any;
  await ctx.runMutation(api.llm.recordCall, {
    provider: d.provider ?? "unknown",
    model: d.model ?? "unknown",
    promptTokens: d.promptTokens ?? d.prompt_tokens ?? d.inputTokens ?? d.input_tokens ?? 0,
    completionTokens: d.completionTokens ?? d.completion_tokens ?? d.outputTokens ?? d.output_tokens ?? 0,
    totalTokens: d.totalTokens ?? d.total_tokens ?? (...),
    latencyMs: d.latencyMs ?? d.latency_ms ?? 0,
    cost: d.cost ?? d.costUsd ?? d.cost_usd,
    sessionId: d.sessionId ?? d.session_id,
    timestamp,
    agentId: d.agentId ?? d.agent_id,
    toolName: d.toolName ?? d.tool_name,
    goalId: d.goalId ?? d.goal_id,            // Phase 149 PULSE-01 — cost-by-goal join
    cacheReadInputTokens: d.cacheReadInputTokens ?? d.cache_read_input_tokens,
    cacheCreationInputTokens: d.cacheCreationInputTokens ?? d.cache_creation_input_tokens,
  });
  break;
}
```
Add one line following the exact same alias convention:
```typescript
    traceId: d.traceId ?? d.trace_id,          // Phase 94 TRACE-01 — per-turn grouping
```

---

### `convex/llm.test.ts` (extend) — mirror the `goalId` persistence tests

**Analog:** same file, lines 1-67

**Pattern to copy** — the file uses a hand-mirrored `recordCallLogic()` (not real Convex runtime) plus an in-memory `makeLlmStore()`:
```typescript
// Source: convex/llm.test.ts:6-34 (existing pattern — mirror byte-for-byte, add traceId)
function makeLlmStore() {
  const llmMetrics: Record<string, any>[] = [];
  const db = {
    insert: async (tableName: string, data: Record<string, any>) => {
      if (tableName === "llmMetrics") llmMetrics.push({ ...data });
    },
  };
  return { llmMetrics, db };
}

async function recordCallLogic(ctx: any, args: any) {
  await ctx.db.insert("llmMetrics", {
    // ...existing fields...
    goalId: args.goalId,
    traceId: args.traceId,   // NEW — mirror goalId's field position exactly
  });
}
```
Then add a `describe("recordCall — traceId persistence (Phase 94 TRACE-01)")` block with the same two-test shape as lines 37-67 (persists when present / `toBeUndefined()` when absent — backward compat).

---

### `convex/runtimeIngest.test.ts` (extend) — mirror `extractLlmCallGoalId`

**Analog:** same file, lines 60-63 (function) and 232-246 (tests)

**Pattern to copy:**
```typescript
// Source: convex/runtimeIngest.test.ts:60-63 (existing pure-function extraction, mirror for traceId)
function extractLlmCallGoalId(data: Record<string, any>): string | undefined {
  const d = data;
  return d.goalId ?? d.goal_id;
}

function extractLlmCallTraceId(data: Record<string, any>): string | undefined {
  const d = data;
  return d.traceId ?? d.trace_id;
}
```
```typescript
// Source: convex/runtimeIngest.test.ts:232-246 (existing describe block — mirror exactly, s/goalId/traceId/)
describe("runtimeIngest — llm_call traceId extraction", () => {
  it("extracts traceId from camelCase field", () => {
    expect(extractLlmCallTraceId({ traceId: "trace-camel", trace_id: undefined })).toBe("trace-camel");
  });
  it("falls back to trace_id snake_case when traceId absent", () => {
    expect(extractLlmCallTraceId({ trace_id: "trace-snake" })).toBe("trace-snake");
  });
  it("returns undefined when neither field present (untraced legacy call)", () => {
    expect(extractLlmCallTraceId({ provider: "anthropic", model: "sonnet" })).toBeUndefined();
  });
});
```

---

### `src/components/TraceWaterfall.tsx` (new component, transform)

**Analog:** `src/components/GanttTimeline.tsx` (structure only — D-09 explicitly forbids importing/entangling its `agents`/`events` props)

**Imports pattern to mirror** (GanttTimeline.tsx lines 1-2):
```typescript
import { useMemo, useRef, useState } from "react";
import { usePrivacyMask } from "../hooks/usePrivacyMask";
```
TraceWaterfall's own imports should add `useSearchParams` is NOT needed here (that's SessionDetail's concern) — but DO reuse `usePrivacyMask` if any agentId/session-derived text is shown, plus `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent` from `src/components/ui/collapsible.tsx` (already installed, Radix-backed) for D-10's expand/collapse groups.

**Core grouping pattern to copy — client-side Map + orphan bucket** (GanttTimeline.tsx lines 73-85, this is the exact structural precedent for D-04's "Untraced calls" bucket):
```typescript
// Source: src/components/GanttTimeline.tsx:73-85
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
Adapt as: `Map<string, LlmMetricRow[]>` keyed by `traceId`, `untracedRows: LlmMetricRow[]` for rows where `row.traceId === undefined` — rendered last, flat, un-collapsible (D-04/D-10).

**Time-axis math to copy — WITH THE UNIT-MISMATCH FIX** (GanttTimeline.tsx lines 63-115):
```typescript
// Source: src/components/GanttTimeline.tsx:69-71, 96-104, 114-115
const minTs = Math.min(...all);
const maxTs = Math.max(...all, now);
const range = Math.max(maxTs - minTs, 1);

const tickCount = 8;
const tickArr: { pos: number; label: string }[] = [];
for (let i = 0; i <= tickCount; i++) {
  const t = minTs + (range * i) / tickCount;
  tickArr.push({ pos: ((t - minTs) / range) * 100, label: formatTime(t - minTs) });
}

const toPercent = (ts: number) => ((ts - timeRange.min) / timeRange.range) * 100;
```
**CRITICAL DEVIATION from GanttTimeline (do not copy this part literally):** `llmMetrics.timestamp` is Unix **seconds**; `latencyMs` is **milliseconds**. Bar math must be:
```typescript
const barStart = row.timestamp - row.latencyMs / 1000;  // seconds domain
const barWidth = row.latencyMs / 1000;                   // seconds domain
```
A literal `timestamp − latencyMs` (UI-SPEC's shorthand, and GanttTimeline has no latency field to get this wrong with) collapses every bar near-zero width. Write a unit test asserting this exact formula (RESEARCH.md Pitfall 1).

**ROW_HEIGHT constant to copy verbatim** (GanttTimeline.tsx line 117): `const ROW_HEIGHT = 36;` — UI-SPEC explicitly calls this out as an inherited exception, do not "fix" to a multiple of 8.

**Anti-pattern — do NOT copy GanttTimeline's hardcoded hex color maps** (lines 28-48):
```typescript
// DO NOT COPY — predates Phase 89 tokenization, a live house-rule violation
const EVENT_COLORS: Record<string, string> = { ToolUse: "#6366f1", ... };
const STATUS_COLORS: Record<string, string> = { running: "#22c55e", ... };
```
Instead use `var(--chart-1)`, `var(--status-ok)`, `var(--status-warn)`, `var(--status-error)`, `var(--muted-foreground)` directly in inline `style={{ backgroundColor: "var(--chart-1)" }}` — these are plain CSS custom properties and resolve correctly in inline styles without needing the `useThemeColors()` JS-resolution hook (that hook exists only for `<canvas>` consumers that cannot read CSS vars natively — `src/hooks/useThemeColors.ts` lines 1-13 confirm this scope).

**Cache badge three-state logic (D-13, new — no direct analog, derive from schema fields):**
```typescript
function cacheBadge(row: { cacheReadInputTokens?: number }): "HIT" | "MISS" | "NO_DATA" {
  if (row.cacheReadInputTokens === undefined) return "NO_DATA";
  return row.cacheReadInputTokens > 0 ? "HIT" : "MISS";
}
```
Never conflate `undefined` with `0` (RESEARCH.md Don't Hand-Roll table).

**Cost dash logic (D-14):**
```typescript
// formatCost exists in src/lib/formatters.ts:11-13 — use directly, never estimate
const costLabel = row.cost !== undefined ? formatCost(row.cost) : "n/a";
```

---

### `src/components/TraceWaterfall.test.tsx` (new test file)

**Analog:** no direct component-test analog exists for GanttTimeline (it has none) — follow `convex/runtimeIngest.test.ts`'s pure-function-extraction convention (no `convex-test`/no heavy mount, test the grouping/math/badge functions directly) plus standard Vitest + RTL component patterns already used elsewhere in `src/components/*.test.tsx`. Cover exactly the 4 Wave-0 gaps from RESEARCH.md Validation Architecture: grouping (traced vs untraced-bucket), bar-position math (`start = timestamp - latencyMs/1000`), cache-badge three-state, and cost-dash rendering.

---

### `src/pages/SessionDetail.tsx` (add Trace tab + first `useSearchParams` wiring)

**Analog:** same file's `TABS`/`activeTab` bar; `src/pages/HivePage.tsx` for the `useSearchParams` deep-link pattern (this page has NO existing `useSearchParams` wiring — confirmed, this is the first)

**Current state — tab bar** (lines 1-24, 26-31, 56-73, read directly):
```typescript
type Tab = "overview" | "timeline" | "files" | "bash" | "errors";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "timeline", label: "Timeline" },
  { key: "files", label: "Files" },
  { key: "bash", label: "Bash" },
  { key: "errors", label: "Errors" },
];

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  ...
```
Extend: `type Tab = "overview" | "timeline" | "files" | "bash" | "errors" | "trace";` + `{ key: "trace", label: "Trace" }` appended to `TABS`. Tab-button rendering (lines 59-73) needs zero changes — it already maps generically over `TABS`.

**Deep-link wiring pattern to copy** (HivePage.tsx lines 11, 24-25, 32-34 — inbound-param-takes-precedence pattern):
```typescript
// Source: src/pages/HivePage.tsx:11, 24-25, 32-34
import { useNavigate, useSearchParams } from "react-router-dom";
...
const [searchParams] = useSearchParams();
const goalParam = searchParams.get("goal");
...
useEffect(() => {
  if (goalParam) setGoalId(goalParam);
}, [goalParam]);
```
Adapt for `?tab=trace`: initialize `activeTab` state from `searchParams.get("tab")` (cast/validate against the `Tab` union, default `"overview"` on absent/invalid — same silent-fallback posture as `useFocusParam`'s "no match → no-op", see `src/hooks/useFocusParam.ts` lines 56-68) rather than a `useEffect` override, since `SessionDetail`'s tab is user-togglable client state, not a one-shot node lookup.

**"View Trace" cross-link from Analytics recent-calls rows (D-08) — analog:**
```typescript
// Source: src/components/kg/KGDetailsPanel.tsx:29-31 (provenanceHref pattern — exact shape to mirror)
function provenanceHref(sourceEventId?: string | null): string | null {
  return sourceEventId ? `/memory?event=${encodeURIComponent(sourceEventId)}` : null;
}
```
Adapt: `` `/sessions/${encodeURIComponent(sessionId)}?tab=trace` `` — same `encodeURIComponent` + optional-null-guard convention. Render via `<Link>` from `react-router-dom` (already imported in `KGDetailsPanel.tsx` line 1) with copy `"View Trace"` per UI-SPEC's Copywriting Contract.

---

### `src/pages/Analytics.tsx` (delete `LangfuseTraceLink`, add cross-link)

**Analog:** same file (deletion sites confirmed via grep — exactly 2 references outside the component's own file)

**Deletion sites** (confirmed exact, read directly):
```typescript
// Line 30 — DELETE this import
import { LangfuseTraceLink } from "../components/LangfuseTraceLink";
```
```typescript
// Lines 79-85 — DELETE the <LangfuseTraceLink /> usage; TokenSavingsIndicator stays
<div className="flex items-center justify-between col-span-12 mb-6">
  <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
  <div className="flex items-center gap-3">
    <TokenSavingsIndicator savedTokens={0} totalTokens={0} />
    <LangfuseTraceLink />   {/* DELETE this line only — keep the wrapping div/TokenSavingsIndicator */}
  </div>
</div>
```
Then delete `src/components/LangfuseTraceLink.tsx` entirely (27 lines, read in full — confirmed no other exports/usages depend on it).

**New cross-link in the recent-calls table** — Analytics.tsx's LLM-call table isn't yet read in this pass (large file); when planning, locate the `llmCalls`-rendering `<TableRow>` (via `useLlmMetrics()` hook, imported line 4) and add a "View Trace" `<Link>` cell per row using the `provenanceHref`-style helper above, targeting `` `/sessions/${call.sessionId}?tab=trace` `` (guard: only render the link when `call.sessionId` is present, same null-guard convention as `provenanceHref`).

---

### `astridr/engine/telemetry.py` (new `_current_trace_id` contextvar trio)

**Analog:** same file, `_current_goal_id` (lines 81-83) + `set_/reset_/get_goal_context` trio (lines 546-561)

**Current state (goalId precedent, read directly):**
```python
# Source: astridr/engine/telemetry.py:81-83
_current_goal_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(  # contextvar-ok: goal ID, not a secret
    "telemetry_goal_id", default=None
)
```
```python
# Source: astridr/engine/telemetry.py:546-561
def set_goal_context(goal_id: str | None) -> contextvars.Token[str | None]:
    """Set the current goal ID for telemetry auto-grouping.

    Returns a token for reset_goal_context().
    """
    return _current_goal_id.set(goal_id)


def reset_goal_context(token: contextvars.Token[str | None]) -> None:
    """Reset the goal context to its previous value."""
    _current_goal_id.reset(token)


def get_goal_context() -> str | None:
    """Return the current goal ID, or None if not set."""
    return _current_goal_id.get()
```
**Pattern to copy — DISTINCT variable, per Pitfall 3 (do not reuse `_current_goal_id`):**
```python
_current_trace_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(  # contextvar-ok: trace ID, not a secret
    "telemetry_trace_id", default=None
)

def set_trace_context(trace_id: str | None) -> contextvars.Token[str | None]:
    """Set the current per-turn trace ID for telemetry grouping (Phase 94 TRACE-01)."""
    return _current_trace_id.set(trace_id)

def reset_trace_context(token: contextvars.Token[str | None]) -> None:
    """Reset the trace context to its previous value."""
    _current_trace_id.reset(token)

def get_trace_context() -> str | None:
    """Return the current trace ID, or None if not set."""
    return _current_trace_id.get()
```

---

### `astridr/channels/router.py` — NOT the insertion point (reference only)

**Analog for the set/try/finally shape** (lines 489-516, confirmed working precedent), but per RESEARCH.md Pitfall 2/A1, the traceId contextvar must be set in `AgentLoop._process_inner()` instead, because `queen.py` calls the loop directly and bypasses this turn-lock wrapper entirely:
```python
# Source: astridr/channels/router.py:489-516 — the SHAPE to mirror (set-before-work,
# reset-in-finally), NOT the insertion site itself for traceId
lock = self.get_turn_lock(message.chat_id)
async with lock:
    _goal_token = set_goal_context(str(uuid.uuid4()))
    try:
        await self._route_locked(message, channel)
    finally:
        reset_goal_context(_goal_token)
```

---

### `astridr/agent/loop.py` (`_process_inner` — actual insertion point)

**Analog:** same file's `process()` → `_process_inner()` try/finally shape (lines 797-838, confirmed as the universal per-`process()`-call entry point used by both `router.py` and `queen.py`)

```python
# Source: astridr/agent/loop.py:819-828 (current state — insertion point for traceId)
async def _process_inner(
    self, run_state: RunState, session: Session, message: Message
) -> "AgentResponse":
    """Inner implementation of process() — all per-run logic lives here.
    ...
    """
    # Increment turn counter for memory preflight cooldown tracking (D-03)
    run_state.turn_count += 1
    ...
```
Wrap the body of `_process_inner` (or its caller) with `set_trace_context(str(uuid.uuid4()))` / `finally: reset_trace_context(token)`, mirroring `router.py`'s try/finally shape but at this choke point so automation/`queen.py`-triggered turns get a `traceId` too (RESEARCH.md Pitfall 2).

---

### `astridr/providers/anthropic_provider.py` + `openrouter.py` (attach `traceId`)

**Analog:** same files' `goalId` attach block — both already present and structurally identical

```python
# Source: astridr/providers/anthropic_provider.py:560-579 (existing, mirror exactly for traceId)
if self._telemetry:
    from astridr.engine.telemetry import get_goal_context as _get_goal_ctx
    _llm_payload: dict[str, Any] = {
        "provider": self.name,
        "model": resolved_model,
        ...
    }
    _gid = _get_goal_ctx()
    if _gid:
        _llm_payload["goalId"] = _gid
    await self._telemetry.send("llm_call", _llm_payload)
```
```python
# Source: astridr/providers/openrouter.py:308-325 (existing, identical shape)
if self._telemetry:
    from astridr.engine.telemetry import get_goal_context as _get_goal_ctx
    _llm_payload: dict[str, Any] = { ... }
    _gid = _get_goal_ctx()
    if _gid:
        _llm_payload["goalId"] = _gid
    await self._telemetry.send("llm_call", _llm_payload)
```
Add, in both files, alongside the existing `_gid` block:
```python
from astridr.engine.telemetry import get_trace_context as _get_trace_ctx
...
_tid = _get_trace_ctx()
if _tid:
    _llm_payload["traceId"] = _tid
```

---

### `astridr/providers/ollama.py` (attach `traceId` — net-new, no local goalId precedent)

**Confirmed via direct read (lines 190-229):** ollama.py's `llm_call` emit block has **no** `get_goal_context()` call at all — unlike anthropic_provider.py and openrouter.py. This is net-new emitter code, not an extension.

**Current state (lines 213-228):**
```python
if self._telemetry:
    await self._telemetry.send(
        "llm_call",
        {
            "provider": self.name,
            "model": resolved_model,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "cachedTokens": 0,
            "costUsd": 0.0,
            "latencyMs": latency_ms,
            "finishReason": finish_reason,
            "hasToolCalls": parsed_tool_calls is not None,
        },
    )
```
**Pattern to introduce (copy the anthropic_provider.py/openrouter.py shape, cross-file, into this new site):**
```python
if self._telemetry:
    from astridr.engine.telemetry import get_trace_context as _get_trace_ctx
    _llm_payload: dict[str, Any] = {
        "provider": self.name,
        "model": resolved_model,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "cachedTokens": 0,
        "costUsd": 0.0,
        "latencyMs": latency_ms,
        "finishReason": finish_reason,
        "hasToolCalls": parsed_tool_calls is not None,
    }
    _tid = _get_trace_ctx()
    if _tid:
        _llm_payload["traceId"] = _tid
    await self._telemetry.send("llm_call", _llm_payload)
```
Do NOT add `goalId` here too — out of scope for this phase; only `traceId` per D-03's uniform-mechanism requirement.

## Shared Patterns

### Optional-field backward-compatible schema extension (house convention)
**Source:** `convex/schema.ts` (`goalId`, cache fields), `convex/llm.ts` (`recordCall`), `convex/runtimeIngest.ts` (alias pass-through)
**Apply to:** `schema.ts`, `llm.ts`, `runtimeIngest.ts` (the entire TRACE-01 surface)
```typescript
traceId: v.optional(v.string())   // schema.ts field + recordCall arg
traceId: d.traceId ?? d.trace_id  // runtimeIngest.ts alias
traceId: args.traceId             // recordCall handler → db.insert
```
No new index (session-scale client grouping suffices, per RESEARCH.md).

### Contextvar propagation for cross-cutting turn/session ids (house convention)
**Source:** `astridr/engine/telemetry.py` `_current_goal_id`/`get_goal_context` trio; `astridr/channels/router.py` set/try/finally shape
**Apply to:** `telemetry.py` (new trio), `agent/loop.py` (`_process_inner` insertion), all three provider files (attach-at-emit-site)
- Distinct ContextVar per concern (traceId ≠ goalId — Pitfall 3)
- Set before work, reset in `finally`
- Read-and-attach at each emit site, NOT auto-injected centrally (unlike `sessionId`)

### Theme-token-only color usage (house rule, Phase 89)
**Source:** `src/index.css` tokens (`--chart-1`, `--status-ok/warn/error`, `--muted-foreground`); anti-pattern confirmed in `GanttTimeline.tsx` L28-48 (predates the rule, do not copy)
**Apply to:** `TraceWaterfall.tsx` exclusively — every fill/border color as `var(--...)` in inline `style`, never a hardcoded hex constant object.

### Cross-nav deep-link via URL param (house convention, v8.0/v9.0)
**Source:** `src/pages/HivePage.tsx` (`?goal=`), `src/components/kg/KGDetailsPanel.tsx` `provenanceHref` (`?event=`), `src/hooks/useFocusParam.ts` (silent no-op on non-match)
**Apply to:** `SessionDetail.tsx` (`?tab=trace` inbound), `Analytics.tsx`/wherever "View Trace" is rendered (`?tab=trace` outbound link construction)
```typescript
function traceHref(sessionId?: string | null): string | null {
  return sessionId ? `/sessions/${encodeURIComponent(sessionId)}?tab=trace` : null;
}
```

### Hand-mirrored Convex test pattern (no `convex-test` library)
**Source:** `convex/llm.test.ts` (`recordCallLogic`, `makeLlmStore`), `convex/runtimeIngest.test.ts` (`extractLlmCallGoalId`)
**Apply to:** `convex/llm.test.ts` and `convex/runtimeIngest.test.ts` extensions for `traceId` — copy the pure-function-mirror + in-memory-store approach exactly, do not attempt to instantiate real Convex runtime objects.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/TraceWaterfall.test.tsx` | test | transform | GanttTimeline (the structural analog) has no test file of its own; this is a genuinely new test file — use RESEARCH.md's Validation Architecture test map (grouping, bar math, cache badge, cost dash) as the spec instead of a code analog |
| `astridr/providers/ollama.py`'s `traceId` attach block | service (provider emitter) | event-driven | No local precedent exists in this file (confirmed absent — no `get_goal_context()` call anywhere in ollama.py); must be authored fresh by copying the *shape* from the sibling provider files, budgeted as net-new code, not a mechanical extension |

## Metadata

**Analog search scope:** `convex/` (schema.ts, llm.ts, runtimeIngest.ts, llm.test.ts, runtimeIngest.test.ts), `src/components/` (GanttTimeline.tsx, LangfuseTraceLink.tsx, ui/collapsible.tsx, ui/badge.tsx, kg/KGDetailsPanel.tsx, MetricCard.tsx), `src/pages/` (SessionDetail.tsx, Analytics.tsx, HivePage.tsx), `src/hooks/` (useFocusParam.ts, useThemeColors.ts), `src/lib/` (formatters.ts), and cross-repo `astridr-repo/astridr/` (engine/telemetry.py, channels/router.py, agent/loop.py, providers/anthropic_provider.py, providers/openrouter.py, providers/ollama.py)
**Files scanned:** 22
**Pattern extraction date:** 2026-07-06
