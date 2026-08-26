# Phase 121: Analytics Query Resilience - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 6 (2 new test files, 1 modified page, 1 modified/new backend module, 1 new/extended backfill, 1 modified component)
**Analogs found:** 5 / 6

This document does not restate CONTEXT.md's `<code_context>` (already names
`SectionErrorBoundary.tsx`, `convex/aggregates.ts:265-330`, `backfillTokenSplit`,
`backfillDailyRollup`, `insertTokenSplitBuckets`, `LlmAnalyticsPanel.test.tsx`). It adds concrete
excerpts and the two analogs nobody had identified: a page-level fault-injection test and the
`aggregates.test.ts` fake-ctx harness.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/Analytics.test.tsx` (NEW) | test (page, fault-injection) | request-response | `src/pages/WorkspaceMap.test.tsx` | **exact** |
| `src/pages/Analytics.structuralGuard.test.ts` (NEW) | test (AST/structural) | transform | `src/components/LlmAnalyticsPanel.test.tsx:120-127` | partial (mechanism only, not matcher) |
| `src/pages/Analytics.tsx` (MODIFIED — D-01/D-02: relocate 10 hoisted queries, wrap Summary Row) | controller/page (React) | request-response | `src/pages/WorkspaceMap.tsx` (lens-owned children pattern) + itself (`:329-341`) | role-match |
| New child component(s) receiving the relocated queries (e.g. a `SummaryRow.tsx` or per-metric components) | component (self-fetching panel) | request-response | `src/components/LlmAnalyticsPanel.tsx` | **exact** |
| `convex/aggregates.ts` (MODIFIED — D-05 `calls` in `insertTokenSplitBuckets`; D-07 trimmed `costByModel`/`providerBreakdown` readers) | service (Convex mutation/query) | CRUD / batch | `convex/aggregates.ts:56-111` (`insertTokenSplitBuckets`) itself | **exact** (already named in CONTEXT.md — self-analog) |
| `convex/aggregates.test.ts` (MODIFIED — new `calls` coverage; possibly new `costByModel`/`providerBreakdown` handler tests) | test (Convex handler, fake ctx.db) | CRUD | `convex/aggregates.test.ts:46-189` (`makeAggregatesCtx`) itself | **exact** — file exists, settles RESEARCH.md's open question |

## Pattern Assignments

### `src/pages/Analytics.test.tsx` (NEW test, page-level fault-injection)

**Analog: `src/pages/WorkspaceMap.test.tsx` — exact match.** This is the file to copy the shape
of, not `LlmAnalyticsPanel.test.tsx` (component-level, already known). WorkspaceMap.test.tsx is a
**page** that renders two `SectionErrorBoundary`-wrapped children and has a dedicated `describe("error
isolation")` block proving each boundary is independent — literally D-04's criterion 1/3 shape,
already built once in this repo.

**Per-test throw flags via `vi.hoisted`** (`src/pages/WorkspaceMap.test.tsx:23-26`):
```typescript
const h = vi.hoisted(() => ({
  throwInStrip: false,
  throwInCanvas: false,
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));
```
For Analytics, after D-02 relocates the 10 hoisted queries into children, this becomes one flag
per relocated query/component (or a single `throwFor: string | null` keyed by component name, to
avoid a 10-field hoisted object).

**Wrapping the REAL component so healthy tests still measure real output** (`:98-109`):
```typescript
vi.mock("@/components/workspace/WorkspaceCoverageStrip", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/workspace/WorkspaceCoverageStrip")>();
  return {
    ...actual,
    WorkspaceCoverageStrip: (props: Record<string, unknown>) => {
      if (h.throwInStrip) throw new Error("boom-strip");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <actual.WorkspaceCoverageStrip {...(props as any)} />;
    },
  };
});
```
Comment at `:93-97` states the rationale explicitly: a full stub would make the non-throw tests
measure nothing. This directly satisfies the CONTEXT.md `<specifics>` requirement to assert
"observable outcome... not a proxy."

**Render helper + assertion shape** (`:143-163`, `:219-237`):
```typescript
function renderPage(initialEntry: string) {
  localStorage.setItem("codepulse-privacy", JSON.stringify({ ... }));
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PrivacyProvider>
        <LocationProbe />
        <WorkspaceMap />
      </PrivacyProvider>
    </MemoryRouter>
  );
}

describe("error isolation", () => {
  it("a fault in the coverage strip does not blank the canvas", () => {
    h.throwInStrip = true;
    renderPage("/workspace-map");

    expect(screen.getByText(/Workspace Coverage Strip failed to load/i)).toBeInTheDocument();
    // The canvas section rendered its real content despite the strip's fault.
    expect(screen.getByRole("button", { name: /expand map/i })).toBeInTheDocument();
  });
});
```
The `"X failed to load"` string comes directly from `SectionErrorBoundary`'s own render output
(`src/components/SectionErrorBoundary.tsx:45`: `` `${this.props.name} failed to load` ``) — so
each fault-injection test's failure assertion is literally `screen.getByText(/{boundary name} failed
to load/i)`, and the "sibling still renders" assertion targets that sibling's own real content
(a button label, a text fragment), never `hasError` or any internal boundary state — matching
CONTEXT.md's explicit anti-pattern warning.

**Analytics.tsx does NOT need the `convex/_generated/api` mock rewiring WorkspaceMap.test.tsx
needed** (`:40-49`) — that file needed it because `react-force-graph-2d`'s canvas mock required
stable reference-equal sentinels across three importers. Analytics has no such graph dependency;
follow `LlmAnalyticsPanel.test.tsx:16-25`'s simpler `mockUseQuery` switch-on-string-ref pattern
instead for the `useQuery`/`usePaginatedQuery` mock (RESEARCH.md Q2 already specifies this; this
file is the source of that specific snippet, quoted here for completeness):
```typescript
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
vi.mock("../../convex/_generated/api", () => ({
  api: { llm: { providerBreakdown: "llm:providerBreakdown", costByModel: "llm:costByModel" }, ... },
}));
```

**Console noise:** No existing test file suppresses `console.error` (RESEARCH.md's grep, zero
matches, control-verified against `SectionErrorBoundary.tsx`'s own literal). This phase's test file
will be the *first* to need `vi.spyOn(console, "error").mockImplementation(() => {})` in an
`afterEach` — there is no in-repo precedent to copy for that specific line; write it directly.

---

### `src/pages/Analytics.structuralGuard.test.ts` (NEW test, AST-derived ratchet)

**No analog exists in this repo for an AST-walking test.** Search run: `Grep("createSourceFile|from
[\"']typescript[\"']|import \* as ts", path: src/)` → **0 files**. Control proving the search
discriminates: the same tool call for `readFileSync` over the same `src/` tree in the same
invocation → **14 files** (`src/pages/LiveRun.test.tsx`, `src/App.test.tsx`,
`src/components/LlmAnalyticsPanel.test.tsx`, etc.) — so the zero is a real finding about AST
tooling, not a broken grep. `typescript` is a devDependency (`package.json`, per RESEARCH.md Q1)
but nothing in `src/` currently imports its compiler API as a value; every existing
"read-your-own-source" test (see below) uses `readFileSync` + a regex, never a parse.

**Closest available precedent — the file-reading mechanism only, not the matcher**
(`src/components/LlmAnalyticsPanel.test.tsx:120-127`):
```typescript
it("does not import the legacy cost value into the money column at source level", async () => {
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const src = readFileSync(resolve(process.cwd(), "src/components/LlmAnalyticsPanel.tsx"), "utf-8");
  // The regression was literally `formatCost(row.cost)`.
  expect(src).not.toMatch(/formatCost\(\s*row\.cost\s*\)/);
  expect(src).toContain("costDerived.costBreakdown");
});
```
This establishes the `readFileSync(resolve(process.cwd(), "src/pages/Analytics.tsx"), "utf-8")`
opening move — reuse verbatim for locating the source file. Everything past that point (the
`ts.createSourceFile` parse and the two AST walks) is new code with no in-repo precedent; build it
from RESEARCH.md Q1's design (already fully specified there, including the `REACT_SAFE_HOOKS`
denylist and the closed presentational allowlist) rather than from an existing test shape. CONTEXT.md
D-04 is explicit that this test must NOT be enumerated/regex-based like the
`LlmAnalyticsPanel.test.tsx` precedent — the precedent's *file-reading setup* transfers, its
*matching strategy* is exactly what D-04 rejects.

**Mutation-test requirement (D-04):** no in-repo precedent for "add a synthetic new call and assert
the guard fails" exists either — this is a novel test-of-a-test. Nearest procedural analog is
`aggregates.test.ts:141-159`'s comment explaining why the `paginate()` fake enforces Convex's
real one-paginated-query-per-invocation limit ("This mock previously allowed unlimited calls, which
let two real multi-paginate bugs... pass 34 green tests") — same spirit (a guard must be shown to
actually constrain), different mechanism.

---

### `convex/aggregates.test.ts` — EXISTS, settling RESEARCH.md's open question

Confirmed present at `convex/aggregates.test.ts` (read in full through line 209+). RESEARCH.md's
Wave-0 gap table listed this file as unchecked/unverified; it exists, is large, and already tests
`computeHourly`, `backfillTokenSplit`, `backfillDailyRollup`, `costByGoalPeriod`, `llmByGoal`,
`eventCountsByPeriod`, `rollupDaily`, `repairDayTargets` directly via `._handler()`.

**The fake `ctx.db` this repo uses for Convex handler tests — no `convex-test` dependency**
(`convex/aggregates.test.ts:46-189`, `makeAggregatesCtx`). This is the harness D-05/D-08's new
`calls`-metric tests and any new `costByModel`/`providerBreakdown` handler tests should extend,
not reinvent:
```typescript
function makeAggregatesCtx(
  opts: {
    llmMetrics?: FakeDoc[];
    aggregates?: FakeDoc[];
    agentConfigs?: FakeDoc[];
    modelPricing?: FakeDoc[];
    toolExecutions?: FakeDoc[];
    costBudgets?: FakeDoc[];
    toolPolicyEvents?: FakeDoc[];
    alerts?: FakeDoc[];
  } = {}
) {
  const tables: Record<string, FakeDoc[]> = { llmMetrics: [...], aggregates: [...], ... };
  let nextId = 1;
  let paginateCalls = 0;

  function query(table: string) {
    const rows = tables[table] ?? (tables[table] = []);
    const predicates: Array<(r: FakeDoc) => boolean> = [];
    let dir: "asc" | "desc" = "asc";
    const chain = {
      withIndex(_index, cb) { /* eq/gte/gt/lte/lt predicate builder */ return chain; },
      filter(cb) { /* neq predicate */ return chain; },
      order(direction) { dir = direction; return chain; },
      async collect() { /* filter + order */ },
      async first() { /* ... */ },
      async take(n) { /* ... */ },
      async paginate({ numItems, cursor }) {
        paginateCalls++;
        if (paginateCalls > 1) throw new Error("... only supports a single paginated query ...");
        /* ... */
      },
    };
    return chain;
  }

  const db = {
    query,
    async insert(table, doc) { /* pushes with _id/_creationTime */ },
    patch(...args) { throw new Error("db.patch must not be called — insert-only"); },
    delete(...args) { throw new Error("db.delete must not be called — insert-only"); },
  };
  const scheduler = { async runAfter(delay, _fn, args) { schedulerCalls.push({ delay, args }); } };
  return { ctx: { db, scheduler }, tables, patchCalls, deleteCalls, schedulerCalls };
}
```

**Invocation pattern** (repeated 10+ times, `:545` onward):
```typescript
const { ctx } = makeAggregatesCtx({ llmMetrics: [...] });
await (computeHourly as any)._handler(ctx);
```

**Criterion 2's "assert `llmMetrics` never queried" proof — not a ready-made excerpt, a one-line
extension.** No existing test in this file currently tracks *which table names* `query()` was
called with; the fake exposes the `tables` map keyed by name but nothing logs invocation order. The
cheapest faithful extension (matching this harness's own style, not a new mechanism) is a
`queriedTables: string[]` array pushed to at the top of `query(table)` before it builds the chain,
returned alongside `ctx`/`tables`/`patchCalls`. A `costByModel`/`providerBreakdown` handler test can
then assert `expect(queriedTables).not.toContain("llmMetrics")` and
`expect(queriedTables).toContain("aggregates")` after invoking the migrated handler via `._handler()`
— giving the CONTEXT.md `<specifics>` control ("a probe that would show the raw path if it were
still live") for free, since the same fixture used for a pre-migration control run would show
`llmMetrics` present in that array.

**`db.patch`/`db.delete` throwing rather than no-op'ing** (`:172-179`) is the insert-only enforcement
pattern D-05/D-08 must preserve — any new `calls`-metric code path that accidentally patches or
deletes an aggregate row fails the test loudly, matching CLAUDE.md's self-hosted insert-only rule.

---

### `src/components/SectionErrorBoundary.tsx` — the boundary D-02 wraps with

Full file already short (65 lines); the two pieces the planner needs verbatim:

**Props and error-state render** (`:3-11`, `:35-59`):
```typescript
interface Props {
  children: ReactNode;
  name?: string;
}
interface State {
  hasError: boolean;
  error: Error | null;
}
```
```typescript
render() {
  if (this.state.hasError) {
    return (
      <div className="bg-gray-800/50 border border-red-500/30 rounded-xl p-4">
        {/* ... */}
        <p className="text-base text-gray-300">
          {this.props.name ? `${this.props.name} failed to load` : "Something went wrong"}
        </p>
        {/* ... Retry button, handleRetry clears hasError ... */}
      </div>
    );
  }
  return this.props.children;
}
```
The `"{name} failed to load"` string is the exact text every fault-injection assertion in
`Analytics.test.tsx` targets — see the Q2/WorkspaceMap.test.tsx pattern above.

**Canonical call site to copy the wrap shape from** (`src/pages/Analytics.tsx:335-341`, the
existing, already-correct "LLM Analytics" boundary D-02's new wraps should match structurally):
```tsx
<div className="md:col-span-6">
   <SectionErrorBoundary name="LLM Analytics">
     <GlassPanel className="p-4 h-full">
       <LlmAnalyticsPanel />
     </GlassPanel>
   </SectionErrorBoundary>
</div>
```
This is the exact target shape for the Summary Row fix (verified unwrapped at `Analytics.tsx:121-159`
— confirmed live during this pass, matches RESEARCH.md's finding precisely: a bare `<GlassPanel
className="p-4">` at `:122` with no `SectionErrorBoundary` ancestor, containing five `MetricCard`s
fed by `cacheStats` and `apiSpendDerived` among others).

---

### Self-fetching panel component — the template D-02's relocated queries follow

**Analog: `src/components/LlmAnalyticsPanel.tsx` — exact match, already known but not yet quoted
concretely.** This is the existing, working example of "a component that calls its own `useQuery`
internally and is rendered inside a `SectionErrorBoundary`" — the literal template D-02 asks for.

**Imports + own-query pattern** (`:1-27`):
```tsx
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import { formatCost } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

export default function LlmAnalyticsPanel() {
  const providerData = useQuery(api.llm.providerBreakdown, {}) ?? [];
  const callsAndTokensByModel = useQuery(api.llm.costByModel) ?? {};
  const breakdown = useQuery(api.costDerived.costBreakdown, {
    period: "hourly",
    lookbackHours: 30 * 24,
  });
  // ... derive rows, render ...
}
```
No error handling inside the component itself — it relies entirely on its `SectionErrorBoundary`
ancestor (`Analytics.tsx:336`) to catch a throw from any of its three `useQuery` calls. This is the
exact division of responsibility D-02 wants for every relocated query: the component owns the
fetch, the boundary owns the failure.

**Honest-loading convention worth carrying into new relocated components** (`:97-104`):
```tsx
{breakdown === undefined ? (
  // Loading is NOT $0.00 — an honest dash until the derivation lands.
  <span className="text-muted-foreground">--</span>
) : row.derivedCost === null ? (
  <span className="text-muted-foreground">Unpriced</span>
) : (
  formatCost(row.derivedCost)
)}
```
Matches CONTEXT.md's D-10/D-11 "never render a stale/uncaveated number" spirit, though D-11
explicitly defers the shared tile primitive to Phase 122 — this is just the existing convention new
components should not regress.

---

## Shared Patterns

### Error boundary wrap (applies to every relocated query's new host component)
**Source:** `src/components/SectionErrorBoundary.tsx` + call site `src/pages/Analytics.tsx:335-341`
**Apply to:** Every new child component created by D-02, including the Summary Row fix.
See excerpts above — one `<SectionErrorBoundary name="...">` per section, matching the 35+ existing
uses on this page.

### Convex handler test harness (fake ctx.db, no `convex-test`)
**Source:** `convex/aggregates.test.ts:46-189` (`makeAggregatesCtx`)
**Apply to:** Any new/modified handler test for `insertTokenSplitBuckets`'s `calls` accumulator
(D-05), the `calls`-aware `backfillTokenSplit` path (D-08), and the trimmed `costByModel`/
`providerBreakdown` readers (D-07) if their tests move to handler-level rather than
React-hook-level. Extend with a `queriedTables` log (see above) for D-07's "reads aggregates, not
llmMetrics" proof.

### Page-level fault-injection test shape
**Source:** `src/pages/WorkspaceMap.test.tsx` (full file — `vi.hoisted` throw flags,
`importOriginal`-wrapped mocks, `describe("error isolation")` block)
**Apply to:** `src/pages/Analytics.test.tsx` in full. This is the single most load-bearing analog
in this phase — it is a working, already-reviewed instance of exactly D-04's proof obligation
(per-query throw, assert sibling renders real content, assert the failed boundary's own text) built
for a different page in Phase 114.

### Component-level `useQuery` mock (simpler case, no cross-file reference-equality needs)
**Source:** `src/components/LlmAnalyticsPanel.test.tsx:14-25`
**Apply to:** Any test that only needs to mock `convex/react` + the generated `api` module without
WorkspaceMap.test.tsx's extra `react-force-graph-2d`/reference-equality machinery (which Analytics
does not need — no canvas/graph dependency).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/pages/Analytics.structuralGuard.test.ts` | test, AST-derived structural ratchet | transform | Zero-hit search for `ts.createSourceFile`/`import * as ts` across `src/`, control-verified against a 14-hit `readFileSync` search in the same pass. No AST-walking test exists anywhere in this repo (`src/` or `convex/`). Build from RESEARCH.md Q1's fully-specified design; only the `readFileSync(resolve(process.cwd(), ...))` file-location idiom has a precedent (`LlmAnalyticsPanel.test.tsx:121-123`). |
| D-04's ratchet mutation-test ("add a synthetic new hoisted query, confirm the guard fails") | test-of-a-test | transform | No in-repo precedent for testing a structural guard's own sensitivity. Nearest procedural cousin (different mechanism, same "prove the guard actually constrains" spirit): `aggregates.test.ts:141-159`'s comment on the `paginate()` single-call enforcement. |

## Metadata

**Analog search scope:** `src/pages/`, `src/pages/__tests__/`, `src/components/`, `convex/`
(full-repo glob for `*.test.ts(x)`, targeted grep for AST-tooling imports and `readFileSync` usage)
**Files scanned (Read in full or targeted):** `src/pages/Analytics.tsx` (through line 345),
`src/pages/WorkspaceMap.test.tsx` (through line 237), `src/components/LlmAnalyticsPanel.tsx` (full,
116 lines), `src/components/LlmAnalyticsPanel.test.tsx` (targeted, lines 1-40, 108-129),
`src/components/SectionErrorBoundary.tsx` (full, 65 lines), `convex/aggregates.test.ts` (targeted,
lines 1-209), `convex/llm.test.ts` (targeted, lines 1-80), `src/pages/ForgePage.test.tsx` (targeted,
ruled out as a weaker analog than WorkspaceMap.test.tsx — mocks a custom hook, not `convex/react`,
and has no boundary-isolation test)
**Pattern extraction date:** 2026-08-18
