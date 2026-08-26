# Phase 121: Analytics Query Resilience - Research

**Researched:** 2026-08-18
**Domain:** Convex query boundary hardening + `aggregates` rollup extension (self-hosted Convex, React error boundaries)
**Confidence:** HIGH — every claim below is evidence-checked against the live repo at the commit checked out during this session; none of it restates CONTEXT.md's prose without independent verification.

## Summary

`/analytics` is a single ~545-line page component (`src/pages/Analytics.tsx`) that both fetches
data (10 hoisted hook calls in its own function body) and composes every rendered section directly
in its own JSX (35+ `<SectionErrorBoundary>`-wrapped `<GlassPanel>` blocks). That "god component"
shape is actually good news for D-04's ratchet: because both the query calls and the boundary
wrapping live in the *same file*, a single-file AST walk of `Analytics.tsx` can answer both halves
of "is every query protected" without needing to reach into any child component's file — contrary
to what the research prompt worried about. The one real blind spot is a component-file boundary
that already exists today and was found during this research, not hypothesized: the "Summary Row"
GlassPanel (`Analytics.tsx:121-159`, five `MetricCard`s plus two `AnomalyBadge`s fed by
`totalAggregateEvents`, `llmCalls`, `totalTokens`, `cacheStats`, `apiSpendDerived`, `anomalies`) has
**no `SectionErrorBoundary` at all** — it is the one rendered block on the page that isn't wrapped,
and it happens to consume `cacheStats` and `apiSpendDerived`, two of the ten hoisted queries.

For the rollup migration: `computeHourly`'s `insertTokenSplitBuckets` helper already receives the
full `llmRows` array for the hour and already builds a `{provider}::{model}::{billingType}::{goalId}`
dimension key identical to the one D-05 needs — a `callsByDim` accumulator (`+1` per row) added to
that same loop, with its own `insertMissing("calls", callsByDim)` call, requires zero schema change
(`by_type_period_bucket` indexes on `metric_type` as a bare `v.string()`) and reuses the same helper
already called from *both* `computeHourly` (the live cron) and `backfillTokenSplit` (the resumable
historical backfill) — meaning D-08's backfill may not need a new mutation at all, only an
extension of the existing one.

**Primary recommendation:** (1) build D-04's ratchet as a TypeScript-compiler-API walk of
`Analytics.tsx` alone, asserting zero top-level hook calls outside a small denylist of React/router
builtins — no new dependency, `typescript` is already installed. (2) Fix the unwrapped Summary Row
as part of D-02's relocation work, not as an afterthought — it is currently the single largest gap
criterion 1 exists to close. (3) Extend `insertTokenSplitBuckets` with a `callsByDim` accumulator
rather than writing a parallel helper, and reuse `backfillTokenSplit` rather than writing a new
mutation for D-08.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Fault isolation per Analytics section | Browser / Client (React) | — | `SectionErrorBoundary` is a client-only React error boundary; nothing server-side participates in blast-radius containment |
| `calls` metric aggregation | API / Backend (Convex `computeHourly` cron + `backfillTokenSplit`) | Database (`aggregates` table writes) | Aggregation must happen where `llmMetrics` is bounded-read; the client never sees raw rows for this metric |
| Rollup read (`costByModel`, `providerBreakdown`) | API / Backend (Convex `query`) | — | Query functions own the read-cap/truncation/asOf logic; the React panel only renders the returned shape |
| Structural ratchet (D-04) | Build / Test tooling (Vitest, `typescript` compiler API) | — | Runs at test time against source text, not at runtime; not a browser or API-tier concern |

## User Constraints (from CONTEXT.md)

This phase's CONTEXT.md is authoritative and settles WHAT to build (D-01 through D-11, all in
`121-CONTEXT.md`). It is not restated in full here — see that file. This research targets the HOW,
per the five research questions in the task brief, and treats every CONTEXT.md claim as something to
re-verify against live code rather than accept, per that document's own premise-correction framing.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-08 | `/analytics` survives a failing query; `costByModel`/`providerBreakdown` read `aggregates` rollups instead of raw `llmMetrics` scans | Q1/Q2 cover the resilience half; Q3/Q4/Q5 cover the rollup-migration half |
</phase_requirements>

---

## Q1 — Building D-04's derived structural ratchet

**Available mechanisms, checked against `package.json` (read in full, both `dependencies` and
`devDependencies` blocks):**

- `typescript: ^6.0.3` is already a devDependency (`package.json:86`) — used today only for
  `npx tsc --noEmit`, but its compiler API (`import * as ts from "typescript"`) is fully available
  to a Vitest test with zero new install.
- `@babel/parser`, `es-module-lexer`, `ts-morph` — **not installed**. Control: `@vitejs/plugin-react`
  and `vite` themselves depend on esbuild/babel transitively, but neither exposes a parser as a
  project-level import; a `require("@babel/parser")` from a test file would fail to resolve
  (unverified by direct `npm ls`, but absent from both `dependencies` and `devDependencies` in
  `package.json` — a `require` resolving via a *transitive* subdependency's own `node_modules` is
  possible in npm's hoisting model but is not something to build a permanent test on).
- No Vitest custom transform hook exists in `vitest.config.ts` (read in full, 30 lines) — adding
  one is possible but is materially more code than an in-test `ts.createSourceFile` call.
- **Existing in-repo precedent for source-text structural tests**: `src/components/LlmAnalyticsPanel.test.tsx:120-127`
  already does `readFileSync(resolve(process.cwd(), "src/components/LlmAnalyticsPanel.tsx"), "utf-8")`
  and asserts on it with a regex (`expect(src).not.toMatch(/formatCost\(\s*row\.cost\s*\)/)`). This
  is real precedent for "read your own source and assert on its shape" in this codebase, but it is
  regex-based and enumerated (checks for one known-bad literal pattern), which is exactly the shape
  D-04 rejects for the ratchet itself. It is useful precedent for the *file-reading* mechanism, not
  the *matching* mechanism.

**Can a single-file AST walk answer the real question?** The research prompt's concern — that a
child component's `useQuery` lives in a different file from the boundary that wraps it — does not
apply here, and this is verified, not assumed: `Analytics.tsx` (read in full, 545 lines) both makes
every hoisted call *and* renders every wrapped section directly in its own return JSX. There is no
intermediate layout component. Every one of the 35+ `<SectionErrorBoundary name="...">` wraps sits
directly in `Analytics.tsx`'s own `return (...)` block (e.g. `:98-101`, `:105-109`, `:335-341`,
`:481-494`). So a single-file walk of `Analytics.tsx` can check two independent, both fully
in-file, structural properties:

1. **No query-shaped hook call sits at the top level of `Analytics()`'s function body** (i.e.
   outside the JSX it returns). Verified population today: exactly 10 such calls —
   `useRecentEvents` (`:52`), `useLlmMetrics` (`:53`), and 8 direct `useQuery` calls (`:63`
   `apiSpendDerived`, `:67` `subscriptionUsage`, `:69` `cacheStats`, `:73` `eventCounts`, `:76`
   `anomalies`, `:79-81` `depthHistogram`/`advisorSavings`/`advisorRecent`) — hand-counted by
   reading the file, matching CONTEXT.md's "roughly ten" claim exactly (control: CONTEXT.md said
   "roughly," the live count is precisely 10).
2. **Every custom (capitalized, non-DOM) JSX element that `Analytics()` renders has a
   `SectionErrorBoundary` ancestor within the same returned tree.** This is checkable on the exact
   same AST without leaving the file, because the render tree is fully inline.

**Both checks are one AST walk, one file.** Recommended shape:

```ts
// convex-free, browser-free: pure ts.createSourceFile parse of the page's own source text.
import * as ts from "typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REACT_SAFE_HOOKS = new Set([
  "useState", "useEffect", "useMemo", "useCallback", "useRef", "useReducer",
  "useContext", "useId", "useLayoutEffect", "useImperativeHandle",
  "useNavigate", "useParams", "useLocation", "useSearchParams", // react-router
]);

function isHookCall(name: string): boolean {
  return /^use[A-Z]/.test(name);
}
```

Walk `sourceFile.statements`, find the default-exported function `Analytics`, and:
- For check 1: iterate the function body's **top-level statements only** (not descending into the
  returned JSX subtree), collect every `CallExpression` whose callee identifier matches
  `isHookCall()` and is *not* in `REACT_SAFE_HOOKS`. Assert this list's length is what the phase
  leaves it at (0, if D-02 fully relocates all ten) — **derived from AST shape, not from a name
  list**, so a future stray `useSomeNewQuery()` dropped back into the function body fails the test
  even though the ratchet's author never heard of that hook name.
- For check 2: walk the JSX returned by `Analytics()`, and for every `JsxElement`/`JsxSelfClosingElement`
  whose tag name is capitalized and is not itself `SectionErrorBoundary`, `GlassPanel`,
  `SectionHeader`, `MetricCard`, `Badge`, `AnomalyBadge`, `FlexBarChart`, `Link`, or one of the
  `Table*` primitives (a **small, closed, presentational allowlist** — these are proven pure/no-query
  by inspection, unlike the open-ended set of domain panels), assert it has a `SectionErrorBoundary`
  ancestor in the JSX tree. This is the check that would have caught the unwrapped Summary Row
  found during this research (see Q1 finding below) — `MetricCard` itself is presentational (no
  query), so it's correctly excluded, but the *GlassPanel wrapping it* has no boundary ancestor,
  which the walk would flag if it targets the JSX subtree containing `AnomalyBadge`/`MetricCard`
  siblings rather than only the panel components. State this precisely when implementing: the
  check should fire on the **wrapping `GlassPanel`/`div` block**, not attempt to whitelist
  `MetricCard` itself as "safe" and stop there — the goal is "is this rendered block inside a
  boundary," not "is this specific tag a query owner."

**Finding, not hypothesis — the unwrapped Summary Row.** `Analytics.tsx:121-159` renders a
`<GlassPanel>` containing `MetricCard`s driven by `totalAggregateEvents` (from `eventCounts`),
`llmCalls.length`, `totalTokens`, `cacheStats`, and `apiSpendDerived`/`totalApiSpend`, plus two
`AnomalyBadge`s driven by `anomalies.errors`/`anomalies.cost` — **with no `SectionErrorBoundary`
wrapping it**, unlike every other section on the page (compare `:97-101` Unpriced Models Nudge,
`:104-109` Cost Forecast, `:161-212` Prompt Cache, all of which are wrapped). This is the second
place, after `subscriptionUsage`, where a hoisted-query throw would blank the whole route even
after D-02's other relocations, if this block is missed. Flag this explicitly for the planner: D-02
must wrap the Summary Row (or split it into a child component and wrap that), or criterion 1
remains unmet for exactly the section most likely to throw (`cacheStats` and `apiSpendDerived` both
feed it, and `apiSpendDerived` calls `costDerived.billedOverTime`, an unbounded-window-style query
that hasn't been checked for a read cap in this research — out of the 7-site census's scope, since
that census covered only `llmMetrics` scans, not `costDerived.ts`).

**Recommendation:** Use the TypeScript compiler API (`typescript`, already a devDependency) in a
new `src/pages/Analytics.structuralGuard.test.tsx` (or similar), with the two-check design above:
(1) zero non-safe-hook calls in `Analytics()`'s top-level function body, (2) every custom JSX
element in its returned tree has a `SectionErrorBoundary` ancestor, using a closed
presentational-primitive allowlist to avoid false positives on genuinely inert components. Both
checks operate on one parse of one file — no cross-file resolution needed for *this* page's shape.

**Blind spots / unverified:**
- This design is single-file because `Analytics.tsx` is currently a god component with no
  sub-layout file. If a future phase splits page composition into a separate layout component (the
  milestone's own Phase 124 does exactly this kind of shell/IA work, though for the nav/header, not
  this page's body), the ratchet's file target would need updating or it silently stops covering
  whatever moved out — this is a real, stated limitation, not a hedge.
- The presentational allowlist (`MetricCard`, `Badge`, `AnomalyBadge`, `FlexBarChart`, `Link`,
  `Table*`) is asserted by *inspection* of their current implementations, not by re-reading each of
  those component files in this research pass — if any of them independently calls `useQuery`
  internally (unlikely for `MetricCard`/`Badge`/`Table*`, which are pure presentational primitives
  by their names and usage pattern, but not verified line-by-line here), the ratchet would wrongly
  treat their parent as safe. The planner/implementer should grep each allowlisted component for
  `useQuery`/`usePaginatedQuery` before finalizing the allowlist.
- The check needs the tag identity to survive **prop-spreading or aliased imports**
  (`import Foo as SectionErrorBoundary`) — not currently a pattern in this file (imports are
  unaliased, confirmed by reading the full import block at `:1-44`), but the AST check should
  resolve import specifiers rather than trust the literal JSX tag string, to survive that class of
  evasion.

---

## Q2 — Fault-injecting a single Convex query throw in Vitest

**Existing mock mechanism (precedent, `src/components/LlmAnalyticsPanel.test.tsx:14-25`):**

```ts
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
vi.mock("../../convex/_generated/api", () => ({
  api: { llm: { providerBreakdown: "llm:providerBreakdown", costByModel: "llm:costByModel" }, ... },
}));
```
`mockUseQuery.mockImplementation((ref, args) => { if (ref === "llm:providerBreakdown") return [...]; ... })`
switches on the **string-ref** identity of `api.x.y`, not the real generated Convex function
reference — the whole `convex/_generated/api` module is itself mocked to string literals. This is
the mechanism to extend for a per-query throw: `mockUseQuery.mockImplementation((ref) => { if (ref
=== "llm:subscriptionUsage") throw new Error("boom"); return <fixture for everything else>; })`.

**Two hooks need mocking for a full-page test, not one.** `useLlmMetrics` (`src/hooks/useLlmMetrics.ts:1,5`)
wraps `usePaginatedQuery`, not `useQuery` — confirmed by reading the file; grepping it for
`useQuery` returns zero matches (control: the same grep against `useRecentEvents.ts` returns one
match at `:1,5`, so the search discriminates — this is a real difference between the two hooks, not
a search failure). A full `Analytics.tsx` fault-injection test must mock **both**
`convex/react`'s `useQuery` and `usePaginatedQuery` exports, or `useLlmMetrics`'s real
implementation will attempt a real Convex network call in jsdom and fail for an unrelated reason.

**Does a jsdom/Vitest React tree actually catch the throw via `SectionErrorBoundary`?**
`SectionErrorBoundary` (`src/components/SectionErrorBoundary.tsx`, read in full) is a plain React
class component using `static getDerivedStateFromError` + `componentDidCatch` — vanilla React error
boundary machinery with no jsdom-specific or Node-specific dependency. React's own reconciler
catches a render-phase throw and routes it to the nearest ancestor boundary regardless of DOM
implementation (jsdom vs. real browser) — this is a React-runtime property, not a DOM API, so
nothing in `src/test/setup.ts` (read in full, 139 lines: jsdom API stubs for
`SpeechRecognition`/`Audio`/`Worker`/`AudioWorkletNode` plus one `vi.mock("livekit-client")`) or
`vitest.config.ts` (read in full, 31 lines: `environment: 'jsdom'`, `globals: true`,
`setupFiles: ['./src/test/setup.ts']`, no `onConsoleLog`/reporter strictness config) could plausibly
interfere with it. **Unverified claim, stated as such:** this research did not execute a live throw
inside this repo's actual Vitest run to directly observe the catch (the constraints permit running
`npx vitest run <file>` read-only, but no existing test currently exercises this path — writing and
running a throwaway probe was judged out of scope for a read-only research pass; the planner should
treat "React error boundaries catch render-phase throws in jsdom" as HIGH-confidence general React
knowledge, not as something re-derived from this repo's own test output).

**Console noise.** `SectionErrorBoundary.componentDidCatch` calls `console.error` directly (`:24-28`),
and React itself additionally logs its own "The above error occurred in the <Component> component"
warning in development mode when a boundary catches an error — this is standard React behavior, not
specific to this repo. No existing test file in this repo suppresses `console.error` (grepped
`console\.error` across `src/**/*.test.tsx`, zero matches — control: the same grep pattern
correctly matches a live literal `console.error` when run against `SectionErrorBoundary.tsx` itself,
confirming the search string is not the reason for the zero). Recommendation: wrap each
fault-injection test with `vi.spyOn(console, "error").mockImplementation(() => {})` (restored via
`afterEach`) purely to keep test output readable — no test in this repo currently needs this because
no test currently forces a boundary catch.

**Recommendation:** Extend the existing `vi.mock("convex/react", ...)` pattern to intercept both
`useQuery` and `usePaginatedQuery`, switch on the mocked `api` string-ref exactly as
`LlmAnalyticsPanel.test.tsx` already does, throw for exactly one ref per test case, return realistic
fixtures for every other ref, render the real `<Analytics />`, and assert on rendered *content*
(e.g. `screen.getByText(...)` for a sibling section's real data) rather than a boundary internal
state flag — matching the CONTEXT.md `<specifics>` requirement directly. Suppress `console.error`
locally per test file.

**Blind spots / unverified:** The actual catch behavior was not executed in this session (read-only
research); the mock's fidelity depends on `api.*` string refs staying string-identical to the real
generated `api` object's dotted paths, which is already a live assumption in
`LlmAnalyticsPanel.test.tsx` and not something this phase introduces.

---

## Q3 — D-08's backfill shape under the 4,096-read ceiling

**`backfillTokenSplit` (`convex/aggregates.ts:765-837`), exact mechanism:**
- Cursor: `agentConfigs["phase104.tokenSplitBackfill.cursor"]`, **insert-only** (never patched) —
  the newest row by insertion order is read as current (`:778-784`).
- Per invocation, walks backwards from the cursor hour by `maxHours` (default 6, `:768`) hours,
  one hour per loop iteration (`:800-821`).
- Per hour: `fetchLlmRowsForHour` → `fetchLlmRowsForWindow` (`:35-48`) does one `.take(LLM_WINDOW_READ_CAP)`
  where `LLM_WINDOW_READ_CAP = 4000` (`:33`), index-range-bounded on `by_timestamp` — **not** a
  `.paginate()` loop (the file's own header comment `:11-32` explains why: Convex allows exactly
  one paginated query per invocation, and this cap-via-`.take()` shape sidesteps that limit
  entirely by not pagination at all).
- Then `insertTokenSplitBuckets(ctx, hourStart, llmRows)` (`:71-112`) does **two** `.collect()`
  queries per hour (one each for `tokens_prompt` and `tokens_completion`, `:85-107` `insertMissing`),
  each scoped to `by_type_period_bucket.eq(metric_type).eq("hourly").eq(hourStart)` — i.e. bounded
  to the existing rows for exactly that hour and metric type, not the whole table.
- Idempotency: per-dimension-key, via `reconstructTokenSplitKey` matching the write-side key
  exactly (`:58-61`) — a dimension already present for that hour+metric is skipped (`:95`), never
  patched or deleted (insert-only end to end, matching CLAUDE.md's self-hosted rule).
- `truncated` is reported per hour (`:808-816`), never silently swallowed.
- Termination: `done: true` once the cursor passes the retention floor (`retentionFloorHour`,
  `:775-776`, `801-804`); the returned `done` flag is what an operator's repeat-loop checks
  (`:786-788`, `:835`). **One invocation does not process the whole window** — it is explicitly
  designed to be repeated (doc comment `:734`: `npx convex run aggregates:backfillTokenSplit
  '{"maxHours": 6}'`, "repeat until the return value's `done` is true").

**Read-cost estimate for a `calls` backfill over the 30-day window, given the measured 5,274-row
population (`convex/llm.ts:384`, measured 2026-08-11):**
- 30 days = 720 hours. At `maxHours = 6` (the proven-safe default), completing the full window
  needs **⌈720/6⌉ = 120 invocations** — a cursor-resumed chain, not one call. This directly answers
  the question: one mutation call does **not** suffice.
- Per-hour read cost: `fetchLlmRowsForHour` reads only the rows that actually match the hour's
  index range (Convex index-range scans cost proportional to matching rows, not to the `.take()`
  cap), so realistic per-hour cost ≈ 5,274 / 720 ≈ **7.3 rows/hour on average** (some hours will be
  denser — activity is not uniform — but nowhere near the 4,000-row cap based on the measured
  30-day total).
- Per-hour `insertTokenSplitBuckets`-shaped work today costs 2 `.collect()` queries, each scoped to
  a single hour+metric-type (small result sets — bounded by the number of *distinct dimension
  keys* active that hour, historically single-digit per the existing production behavior). Adding a
  third metric type (`calls`) for D-08/D-05 adds a third such query per hour — a ~50% increase in
  aggregates-table query count per hour, still tiny in absolute terms.
- **The "query after N inserts costs ~N extra reads" trap** (Claude memory
  `convex-mutation-read-limit-4096`, restated in `CLAUDE.md`'s canonical refs) applies within a
  single mutation invocation whenever a query follows prior inserts in the *same* transaction.
  `backfillTokenSplit`'s loop does exactly this shape (insert in hour N, then query again in hour
  N+1) — but at `maxHours = 6` and ~7 rows/hour, the number of prior inserts accumulated by the time
  any later query runs is at most a few dozen, which is why the existing mutation already works in
  production at this cap. **This bounds `maxHours` for the new `calls` accumulation too**: it should
  stay at the same proven-safe default (6) rather than being raised to "go faster," because raising
  it grows the cumulative insert-then-query tax quadratically-ish across the invocation, not just
  linearly with row count.
- Total reads across the full 120-invocation chain: ≈5,274 (llmMetrics rows, each read exactly
  once) + a few hundred small aggregates-table `.collect()` calls (2-3 per hour × 720 hours, each
  tiny) + a similarly small number of inserts. No single invocation approaches 4,096 reads at the
  existing `maxHours = 6`.

**Reuse vs. new mutation.** `insertTokenSplitBuckets` already receives the full `llmRows` array for
the hour and already computes the identical `{provider}::{model}::{billingType}::{goalId}` key
(`:80`) that D-05 specifies. Adding a `callsByDim` accumulator (`callsByDim[key] = (callsByDim[key]
?? 0) + 1` per row) alongside the existing `promptByDim`/`completionByDim` loop, and a third
`insertMissing("calls", callsByDim)` call, extends the *shared* helper — the one already called from
**both** `computeHourly` (`:342`, the live cron) and `backfillTokenSplit` (`:817`, the historical
backfill). This means D-08 likely does not need a new mutation at all: extending
`insertTokenSplitBuckets` gives `backfillTokenSplit` `calls` support automatically, and it is
already resumable, already cursor-tracked, and already the operator-documented tool
(`convex/aggregates.ts:734`). The remaining open question — not resolvable from a read-only pass —
is whether `backfillTokenSplit`'s cursor is currently at `"done"` on the live instance; if so, an
operator needs to reset it (there is no reset mechanism visible in the read code — `backfillDailyRollup`
resets itself on completion per its own `:649-663` comment, but `backfillTokenSplit`'s cursor
(`:786-788`) returns early forever once it reaches `"done"`, with no reset path in the code read).
**This is the single largest open question for the planner in this section.**

**Recommendation:** Extend `insertTokenSplitBuckets` with a `callsByDim` accumulator and a third
`insertMissing("calls", ...)` call rather than writing a parallel helper or a new mutation. Keep
`maxHours` at the existing default (6) for the `calls` accumulation too. Before relying on
`backfillTokenSplit` to backfill `calls` history, have the plan include a live check (attended, by
the operator) of whether its cursor has already latched at `"done"`, and if so, either add a reset
path or accept that only new-hour `calls` data — never before this deploy — will be materialized
until one is added.

**Blind spots / unverified:** The 5,274-row figure is a point-in-time measurement from
2026-08-11 (`convex/llm.ts:384`), not re-measured live in this session (constraints forbid touching
the live backend); the real population when this phase executes will differ. Whether
`backfillTokenSplit`'s cursor is currently latched at `"done"` is unknown without a live read.

---

## Q4 — The `computeHourly` `calls` block (D-05)

**Cost/tokens accumulation, exact structure (`convex/aggregates.ts:259-331`):**
```ts
const costByDim: Record<string, number> = {};
const tokensByDim: Record<string, number> = {};
for (const r of llmRows) {
  const billingType = (r as any).billingType ?? getBillingType(r.provider);
  const key = `${r.provider}::${r.model}::${billingType}::${(r as any).goalId ?? ""}`;
  costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
  tokensByDim[key] = (tokensByDim[key] ?? 0) + ((r as any).totalTokens ?? 0);
}
```
- 4-segment key confirmed: `provider::model::billingType::goalId`, with `billingType` defaulting via
  `getBillingType(r.provider)` when absent on the row (not a literal `?? "api"` — that default lives
  in the *idempotency-guard reconstruction*, see next point) and `goalId` defaulting to `""` at
  accumulation time (`:269` comment: `"" for non-swarm rows — that is a valid bucket, not a missing
  value"`).
- Idempotency-guard key reconstruction (`:283-289` for cost, `:313-319` for tokens) uses
  `dims?.provider ?? "unknown"`, `dims?.model ?? "unknown"`, `dims?.billingType ?? "api"`,
  `dims?.goalId ?? ""` — **these defaults differ from the accumulation-time key** (accumulation uses
  the row's actual `getBillingType()` result, reconstruction falls back to the literal string
  `"api"` only for legacy rows with no stored `billingType` dimension at all). This asymmetry is
  pre-existing and load-bearing (the doc comment at `:286` flags it: "Must reconstruct the identical
  4-segment key — goalId defaults to \"\" (Pitfall 3)") — a `calls` block copying this pattern must
  reuse `reconstructTokenSplitKey` (`:58-61`, which already encodes exactly these defaults) rather
  than hand-rolling a third copy, to avoid a silent key-mismatch bug.
- Per-metric idempotency guard shape: a fresh `.collect()` scoped to
  `by_type_period_bucket.eq(metric_type).eq("hourly").eq(hourStart)`, building a `Set` of
  reconstructed keys, then skipping any `costByDim`/`tokensByDim` entry whose key is already in that
  set (`:277-301` for cost, `:307-331` for tokens) — **fully duplicated inline in `computeHourly`**,
  not shared via a helper for these two metrics (unlike `insertTokenSplitBuckets`, which *is*
  shared). This is the direct precedent D-05 should NOT copy a third time inline; the cleaner path
  is folding `calls` into `insertTokenSplitBuckets`'s already-shared, already-helper-ized pattern
  (see Q3) rather than adding a fourth inline block to `computeHourly` matching the cost/tokens
  shape.

**Schema — no change needed.** `convex/schema.ts:944-976` (the `aggregates` table definition,
inferred from the `by_type_period_bucket` index at `:976`, read in the surrounding block) defines
`metric_type: v.string()` and indexes `["metric_type", "period", "bucket_start"]` with **no enum
constraint** on `metric_type`'s value — confirmed by grepping `aggregates.ts` for `shard` and
`dimension_key` (both schema fields that exist per `schema.ts:965,971`) and finding **zero matches**
in the file that writes `cost`/`tokens`/`tokens_prompt`/`tokens_completion`/`tool_*` rows — i.e. the
hourly cron and both backfills write plain `dimensions: {...}` objects with no `shard` or
`dimension_key` field at all (control: the schema *does* define those two fields, at `:965` and
`:971`, so their absence from every write in `aggregates.ts` is a real finding about the write path,
not a search failure — they are set only by the `events`/`sankey_edge` ingest path per the schema
comment at `:966-970`). A new `metric_type: "calls"` string value requires nothing beyond adding the
string literal at the write site; `by_type_period_bucket` is explicitly documented as "READERS ONLY
... do not narrow it" (`:973-975`), so no index change is needed either.

**Recommendation:** Fold `calls` into `insertTokenSplitBuckets` (see Q3's reuse recommendation)
rather than adding a fourth inline accumulation block to `computeHourly` in the cost/tokens style —
this both satisfies D-05's "own per-dimension-key idempotency guard" requirement (the shared
helper's `insertMissing()` already provides a fresh guard per metric type call) and gives
`backfillTokenSplit` `calls` support for free. If the planner instead prefers an inline block
matching the cost/tokens pattern exactly (for symmetry/readability), it must reuse
`reconstructTokenSplitKey` for the guard reconstruction rather than hand-writing a third copy of the
default-fallback logic, given the accumulation-vs-reconstruction default asymmetry documented above.

**Blind spots / unverified:** None — this question's claims are all directly read from the live
file with line numbers.

---

## Q5 — Reading the rollups back (D-07 + D-10)

**Existing `aggregates` readers are themselves unbounded — a finding outside the 7-site census's
scope.** `costByPeriod` (`:841-876`), `costByPeriodByProvider` (`:878-918`), `errorTrendByPeriod`
(`:920-943`), and `eventCountsByPeriod` (`:1063-1088`) all read via
`.withIndex("by_type_period_bucket", q => q.eq(...).eq(...).gte("bucket_start", cutoff)).collect()`
— a bare, uncapped `.collect()` over a 30-day (or caller-supplied) hourly window, **no `.take()`
cap, no truncation reporting**. This is a *different* unbounded-read class from the CONTEXT.md
census, which covered only raw `llmMetrics` scans in `convex/`, not `aggregates` scans — worth
flagging because D-07's migrated `costByModel`/`providerBreakdown` will be two more readers of this
exact same table+index, and if they copy the *existing* `aggregates`-reader pattern verbatim, they
inherit an unbounded `.collect()` rather than the bounded/honest pattern the rest of this phase
is built to establish.

**Row-count magnitude (bounding the risk, not resolving it):** dimension cardinality for the
`cost`/`tokens` metric types is `provider × model × billingType × goalId`. Historically small
(Phase 104/105 comments throughout `aggregates.ts` describe single-digit-to-low-double-digit
distinct combinations being typical), but `goalId` is populated by PULSE-02 swarm activity and its
cardinality is not bounded by this file — a busy swarm period could multiply the dimension count for
a given hour. **This was not measured live** (constraints forbid touching the backend); the planner
should treat "how many rows does a 30-day hourly `calls`+`provider` (or `calls`+`model`) rollup read
actually return" as an open measurement, not an assumption, before deciding whether a `.take()` cap
is merely defensive or load-bearing.

**Does the `by_timestamp`-with-`gte` ordering trap apply to the `aggregates` read path?**
It applies **conditionally**, not unconditionally — this is a real distinction CONTEXT.md's prose
doesn't spell out. The trap (oldest-first without an explicit `.order("desc")`) only matters when
the read is *also bounded* by a `.take(N)` — an unbounded `.collect()` returns every matching row
regardless of order, so summing/grouping them is order-independent. **Today's `aggregates` readers
are all unbounded `.collect()` calls, so the trap does not currently manifest for them.** It becomes
directly relevant the moment D-07's migrated queries add a `.take(CAP)` (recommended above, to avoid
inheriting the unbounded pattern) — at that point they must use `.order("desc").take(CAP)` and
reverse for display, exactly matching the now-being-deleted `providerBreakdown`'s own established
8,000-row-cap pattern (CONTEXT.md's `<code_context>` cites this precedent directly, and it is
consistent with `llm.ts:275-306`'s `providerBreakdown` structure, read in full above).

**`asOf` and `{expectedBuckets, presentBuckets}` — computed from data already read, no extra cost:**
- If the new reader is `.order("desc").take(CAP)`: `asOf` = the `bucket_start` of the **first**
  returned row (already the newest, by construction of the descending order) — no extra scan needed.
- `presentBuckets` = the size of a `Set` built from every row's `bucket_start` while iterating the
  already-fetched rows for the sum — one pass, no extra read.
- `expectedBuckets` = a pure arithmetic value from the requested window bounds
  (`Math.floor((windowEnd - windowStart) / 3600)` for an hourly rollup), requiring no read at all —
  it is a property of the *request*, not the data.
- D-10's stated honest limit ("a zero-activity hour is indistinguishable from a missed cron run")
  is a direct consequence of this shape: `presentBuckets` only counts hours where **some** dimension
  key produced a row; a genuinely idle hour and a cron-miss hour are both simply absent from the
  read, and nothing in the read path (or, per this research, anywhere else in `aggregates.ts`)
  distinguishes them — confirmed by there being no "heartbeat" or zero-value row written by
  `computeHourly` for hours with no `llmRows` (the loop bodies at `:265-272`/`:291-331` simply
  produce empty `costByDim`/`tokensByDim` objects and insert nothing, rather than writing an
  explicit zero — matching D-10's own stated limitation exactly).

**Recommendation:** Do not copy the existing `costByPeriod`/`eventCountsByPeriod` unbounded-`.collect()`
pattern for the two migrated queries. Bound them with `.order("desc").take(CAP)` (a CAP sized after
a live measurement — not assumed from this research), reverse for chronological display, and derive
`asOf`/`presentBuckets`/`expectedBuckets` from the already-fetched rows plus the request window
bounds, exactly as specified above, adding no additional read.

**Blind spots / unverified:** Actual 30-day rollup row-count magnitude for `cost`/`tokens` (and the
new `calls`) metric types was not measured live — this research could not query the self-hosted
backend under its own constraints. The planner or an attended step should measure this before
finalizing a `.take()` cap value, the same way `cacheStats`' `CACHE_STATS_READ_CAP` and
`providerBreakdown`'s row cap were each sized from a live measurement rather than guessed
(`llm.ts:85-88`, `:384-395`).

---

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest ^4.1.9 (`vitest.config.ts`) |
| Config file | `vitest.config.ts` (environment: jsdom, globals: true, setupFiles: `src/test/setup.ts`) |
| Quick run command | `npx vitest run src/pages/Analytics.test.tsx` (once created) |
| Full suite command | `npm test` (Vitest watch) / `npx vitest run` (CI-style single pass) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| DEBT-08 (criterion 1) | Forcing a throw in any one `/analytics` query leaves every sibling panel rendering content | unit (React render + mocked `convex/react`) | `npx vitest run src/pages/Analytics.test.tsx` | ❌ Wave 0 — no `Analytics.test.tsx` exists today (confirmed by glob, zero matches) |
| DEBT-08 (criterion 1, ratchet) | No query-shaped hook sits unprotected in `Analytics.tsx`'s own source, derived not enumerated | unit (AST parse of own source) | `npx vitest run src/pages/Analytics.structuralGuard.test.tsx` | ❌ Wave 0 — new file |
| DEBT-08 (criterion 2) | `costByModel`/`providerBreakdown` read `aggregates`, not raw `llmMetrics` | unit (mock Convex ctx over an in-memory fake `db`, assert `.query("aggregates")` is called and `.query("llmMetrics")` is not) | `npx vitest run convex/llm.test.ts` (or wherever the migrated query lands) | ❌ Wave 0 — no existing `convex/llm.test.ts` found in this pass (not directly checked; grep `convex/**/*.test.ts` if the planner needs to confirm) |
| DEBT-08 (criterion 3) | Each surviving query independently reports its own failure without masking a sibling | unit — same fault-injection harness as criterion 1, asserting the boundary's own retry affordance renders (`SectionErrorBoundary`'s "Retry" button, `:51-56`) for the one broken panel while siblings show real content, not an error state | same file as criterion 1 | same as above |

### Sampling Rate
- **Per task commit:** `npx vitest run <the specific new/changed test file>` — Vitest is fast
  enough at this repo's scale (per `npm test` config) that a full-file run is a reasonable per-commit
  gate.
- **Per wave merge:** `npx vitest run` (full suite) plus `npx tsc --noEmit` (the AST-walk ratchet
  imports `typescript` types; a type error there should fail the type-check gate, not just the test).
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus a live-render smoke check (not
  automatable from this research pass) that `/analytics` actually mounts against the dev backend —
  the fault-injection unit tests prove the *mechanism*, not that the real page compiles and mounts
  end to end after D-02's relocation refactor.

### Wave 0 Gaps
- [ ] `src/pages/Analytics.test.tsx` — new file, covers criterion 1 and criterion 3 fault-injection
  cases, one `it()` per hoisted query (post-relocation, per-child-component) plus one for the
  now-wrapped Summary Row.
- [ ] `src/pages/Analytics.structuralGuard.test.tsx` — new file, the D-04 derived ratchet plus its
  required mutation test (synthetic new hoisted hook call must fail the ratchet).
- [ ] A migrated-query test file for `costByModel`/`providerBreakdown` reading `aggregates` — exact
  location depends on where the planner places the migrated queries (`convex/llm.ts` in place, or a
  new module); no existing test file was found covering these two queries' *data source* (only
  `LlmAnalyticsPanel.test.tsx`, which mocks them at the React-hook boundary and never exercises the
  real Convex handler).
- [ ] Framework install: none — Vitest, `typescript`, and `@testing-library/react` are all already
  present; no new dependency is needed for any part of this phase's validation.

---

## Sources

### Primary (HIGH confidence — direct repo reads, line-numbered)
- `src/pages/Analytics.tsx` (full file, 545 lines)
- `convex/aggregates.ts` (full file, 1089 lines)
- `convex/llm.ts` (full file, 484 lines)
- `convex/schema.ts` (targeted reads: `:300-335` `llmMetrics` table, `:955-989` `aggregates` table
  and indexes, plus a full-file grep for `by_type_period_bucket`/`by_timestamp`/`by_provider`/`by_goal`/`by_session`)
- `convex/evalScores.ts:130-180`
- `convex/retention.ts:100-199`
- `src/components/LlmAnalyticsPanel.tsx` (full file, 116 lines)
- `src/components/LlmAnalyticsPanel.test.tsx` (full file, 129 lines)
- `src/components/SectionErrorBoundary.tsx` (full file, 65 lines)
- `src/hooks/useAnalytics.ts`, `src/hooks/useRecentEvents.ts`, `src/hooks/useLlmMetrics.ts` (full files)
- `src/test/setup.ts` (full file, 139 lines)
- `vitest.config.ts` (full file, 31 lines), `vite.config.ts` (full file, 104 lines)
- `package.json` (full file, both dependency blocks)
- `.planning/phases/121-analytics-query-resilience/121-CONTEXT.md` (full file, treated as the
  authoritative decision record, re-verified rather than restated per the constraints)
- `.planning/REQUIREMENTS.md:60-89`, `.planning/ROADMAP.md:675-753`

### Secondary (MEDIUM confidence)
- None — no WebSearch or external documentation lookup was needed; this phase is pure in-repo
  Convex/React investigation and the in-repo precedent was sufficient for every question.

### Tertiary (LOW confidence / unverified)
- The 5,274-row `llmMetrics` 30-day population figure (`convex/llm.ts:384`) is a point-in-time
  measurement from 2026-08-11, not re-measured live in this session.
- `backfillTokenSplit`'s current live cursor state (latched at `"done"` or not) — unknown without a
  live read, explicitly out of scope per this research's constraints.
- Rollup row-count magnitude for a 30-day hourly `cost`/`tokens`/`calls` read — not measured live.
- React error boundary catch behavior in this repo's actual jsdom/Vitest runtime — asserted from
  general React knowledge and the absence of any interfering setup code, not directly observed by
  running a throwaway probe in this session.

## Metadata

**Confidence breakdown:**
- Q1 (ratchet design): HIGH — the file-boundary claim, the ten-call count, and the unwrapped Summary
  Row are all directly read from `Analytics.tsx`, not inferred.
- Q2 (fault injection): HIGH for the mocking mechanism (direct precedent in-repo); MEDIUM for the
  "React catches it in jsdom" claim specifically, since it was not executed in this session.
- Q3 (D-08 backfill): HIGH for the mechanism and read-cost math (directly from
  `backfillTokenSplit`'s code and the documented 4,096-read constraint); LOW for the live cursor
  state, which is unverifiable read-only.
- Q4 (`computeHourly` calls block): HIGH — schema, index, and accumulation-vs-guard asymmetry are
  all directly read with line numbers.
- Q5 (reading rollups back): HIGH for the existing readers' unbounded shape and the conditional
  nature of the ordering trap; LOW for actual rollup row-count magnitude, unmeasured.

**Research date:** 2026-08-18
**Valid until:** ~14 days (fast-moving phase; the live cursor/row-count unknowns should be
re-checked at plan time regardless of this date, since they were never HIGH confidence to begin with)
