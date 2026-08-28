# Phase 129: Dashboard Unbounded Read & Ratchet Coverage - Research

**Researched:** 2026-08-28
**Domain:** Convex query bounding + static-analysis ratchet coverage (TypeScript AST)
**Confidence:** HIGH for code facts (all read live, `file:line` cited below); MEDIUM for the
recommended window/field-name discretion calls (D-05); the AST re-derivation itself is
`[VERIFIED: this session's own AST scan]` — see the disagreements-with-CONTEXT section, which
is the most load-bearing part of this document.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope of the fix:**
- D-01: Bound the reads AND fix the caller. Both `metrics.ts:19` and `:24` become bounded, and
  the `cost_summary` field mismatch (F-2) is resolved in the same phase.
- D-02: Correct FIX-01 in `.planning/REQUIREMENTS.md` in place, with a dated note, naming the
  real consumer (`insightsChat.ts`'s `cost_summary`, not `/`). This is a phase deliverable —
  not pre-edited during discussion.
- D-03: `cost_summary`'s `totalCost`/`totalTokens` come from the bounded `aggregates` rollup
  (`analytics:tokenSunburst` / `sunburstFromAggregates`), not from widening `dashboardSummary`.
  Reuse that read (or a small shared helper over it); do not invent a new scan.
- D-04: Prove the caller fix both structurally (type-derived guard, `tsc` error on
  missing/renamed field) and by value (unit test with a fixture of known cost). Neither alone
  is sufficient.

**Count semantics:**
- D-05: Window `totalEvents` heroStats-style (range-bounded `by_timestamp2` + `.take()` cap);
  rename the field to say it's windowed. Window (1h vs 24h) and field names are Claude's
  discretion — see below.
- D-06: Share `TOOLS_COUNT_CAP` from one place — export it from `heroStats.ts:8` and reuse in
  `metrics.ts:24`. The one deliberate touch of `heroStats.ts` (export only, no behavior change).
- D-07: Report `truncated`/`rowsRead` alongside the figures, matching `llm:costByModel`'s
  payload contract. This diverges deliberately from heroStats' silence — comment why at the
  read site.

**Ratchet signature (FIX-02):**
- D-08: Table-scoped, not shape-only. Flags a bare `.collect()` only on tables from a declared
  high-volume list.
- D-09: Parse with the TypeScript AST (already a dependency) — walk real call chains, not a
  line-by-line regex.
- D-10: The high-volume list is schema-derived (tables carrying a time-ish index) PLUS an
  explicit additions list for growth-shaped tables the schema can't reveal — at minimum
  `discoveredTools` and `forgeLogChunks` — each pinned with a one-line reason.
- D-11: The other 10 growth-shaped bare collects are allowlisted with reasons, not fixed:
  `sessions` (`migrations.ts:182`), `subagentJobs`, `swarmTasks`, `tasks`, `anomalyEvents`,
  `episodicEvents`, `dockerContainers`, `prompts`, `ideationFindings`.
  **⚠ See "Disagreements with CONTEXT.md" below — this list does not match live code as cited
  and needs correcting before the planner writes the allowlist.**

**Guard family:**
- D-12: Extend `convex/boundedReads.ratchet.test.ts` in place — one file, side-by-side
  signatures, header updated to reflect the new coverage.
- D-13: New `convex/metricsDashboardBounded.test.ts` — recorded-query assertions (index +
  range + limit) for BOTH reads, plus D-07 truncation flag on both sides of the cap boundary.
  Never assert on returned rows.
- D-14: Extract `makeRecordingDb` to a shared test helper; use it for the new test only.
  Migrating the existing 7 copies is explicitly deferred.
- D-15: Wire to `npm test` + CI only, not the pre-commit hook. `npm test` runs `unit` then
  `browser` sequentially.

### Claude's Discretion
- D-05's exact window (1h vs 24h) and the replacement field names. Prefer matching heroStats'
  hour unless the Insights use case demonstrably needs longer, in which case use the
  `aggregates` rollup rather than widening the raw scan.
- Whether the D-03 rollup read is a direct call to the existing query or a small extracted
  helper — subject to the dead-surface rule.
- How the new ratchet proves it can fail: `check-dead-surface.mjs`'s `--self-test` flag style
  vs. a red/green mutation against the real `metrics.ts` — one is mandatory.

### Deferred Ideas (OUT OF SCOPE)
- Deduplicate the `activeSessions` read (`metrics.ts:20-23` / `heroStats.ts:17-20` byte-identical) — later cleanup phase.
- Migrate the existing 7 `makeRecordingDb` copies to the D-14 shared helper — file as a todo.
- Triage the other ~78 (this research found: ~75, see below) config-shaped bare collects by row count — deliberately not executed here.
- `forgeLogChunks` bare `.collect()` (`forge.ts:1136` per CONTEXT; this research found `:1518` — see disagreements) — gets ratchet coverage via D-10's additions list but is NOT fixed here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | Dashboard/`metrics.ts` no longer reads the whole `events` table (as corrected by D-02: real consumer is `insightsChat.ts`'s `cost_summary` tool, not `/`) | heroStats.ts:43-47 bounded-read analog; TOOLS_COUNT_CAP pattern at heroStats.ts:8-9,89-102; llm.ts truncated/rowsRead contract at llm.ts:260-280,323-324 |
| FIX-02 | Ratchet gains a table-scoped, AST-based signature for the bare-`.collect()` shape | AST scanner design below (Q2); AST re-derivation of the growth-shaped table population (Q1, Q3); in-repo TS-compiler-API analogs at `src/pages/Analytics.structuralGuard.test.ts:23`, `src/tokenSweep.ratchet.test.ts:75` |
</phase_requirements>

## Summary

This phase is a defect fix plus a static-analysis ratchet extension, not new feature work.
Everything needed already exists in the repo as an analog: `heroStats.ts` already solved the
"bound the `events` read to a window" problem and the "cap an unfilterable count" problem for
the exact same two tables (`events`, `discoveredTools`) that `metrics.ts` needs fixed;
`analytics.ts`/`analyticsRollupQueries.ts` already produce `totalCost`/`totalTokens` from a
bounded `aggregates` read; `llm.ts` already established the `truncated`/`rowsRead` +
`console.warn` contract this phase's D-07 wants to reuse; and five `*Bounded.test.ts` files
already establish the "assert on the recorded query, not the returned rows" pattern D-13
requires. The one genuinely new piece of engineering is the AST-based ratchet signature (D-08/
D-09) — no in-repo analog does exactly this (the two cited TS-compiler-API files check other
things), so its design is worked through in detail below (Q2).

**Primary recommendation:** Bound `metrics.ts:19` with the identical `by_timestamp2` +
`.take()` window pattern from `heroStats.ts:43-47` (rename the field, per D-05 discretion:
`eventsLastHour`); bound `metrics.ts:24` with the shared `TOOLS_COUNT_CAP` export from
`heroStats.ts:8`; route `cost_summary`'s cost/token figures through `ctx.runQuery(api.
analytics.tokenSunburst)` (already exported, already called from the frontend, so D-03's reuse
is a zero-new-export operation — the cleanest way to satisfy CLAUDE.md's dead-surface rule);
build the AST ratchet as a `ts.forEachChild` walk rooted at `ctx.db.query(...)` CallExpressions,
walking the parent chain to detect `.withIndex(`/`.take(`/`.first(`/`.unique(`/`.paginate(`
anywhere in the chain (see Q2); and derive the high-volume table list by parsing
`convex/schema.ts`'s `defineTable().index(...)` chains for a time-ish field in any index's
field list (see Q3). **Before writing D-11's allowlist, re-verify its table names against this
research's AST re-derivation — two of its nine cited tables (`sessions`, `episodicEvents`) have
zero bare-`.collect()` hits in live code, and two real ones (`registeredHooks`,
`supabaseHealth`) are missing from its list.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bounding `events`/`discoveredTools` reads | API/Backend (Convex query) | — | Pure backend query-shape fix; `dashboardSummary` is a `query()` in `convex/metrics.ts`, no frontend caller exists (F-1, confirmed below) |
| Cost/token figures for `cost_summary` | API/Backend (Convex action calling another query) | Database/Storage (`aggregates` rollup table) | `insightsChat.ts`'s `executeTool` is an `action` that calls `ctx.runQuery`; the actual aggregation already lives in the `aggregates` table via the Phase 88 rollup cron |
| Static-analysis ratchet (AST scan) | Build/Test tooling (not a runtime tier) | — | `convex/boundedReads.ratchet.test.ts` runs inside `vitest`'s `unit` project against source text on disk — it is dev-time tooling, not a deployed capability |
| `TOOLS_COUNT_CAP` sharing | API/Backend (Convex module-level constant) | — | Both `heroStats.ts` and `metrics.ts` are Convex query modules; sharing a constant across them is an intra-tier concern, no cross-tier boundary crossed |

No Browser/Client, Frontend-Server, or CDN/Static tier is touched by this phase — F-1 (below)
confirms `src/` has zero references to `api.metrics`, so no route or component depends on this
query's shape changing.

## Disagreements with CONTEXT.md (AST re-derivation of F-3/F-4)

CONTEXT.md's F-3/F-4 numbers are stated as "an approximate regex scan, not an AST parse" and
explicitly instruct re-deriving with the AST scanner D-09 calls for. **Done below.** The scan
walked every `convex/*.ts` file (excluding `*.test.ts`, `schema.ts`, `_generated/`) with the
`typescript@6.0.3` compiler API (`ts.createSourceFile` + `ts.forEachChild`), found every
`ctx.db.query(TABLE)` `CallExpression`, walked its parent chain, and classified it as a "bare
collect" only if the chain contains `.collect()` and contains NONE of `.withIndex(`, `.take(`,
`.first(`, `.unique(`, `.paginate(`. `[VERIFIED: this session's own AST scan against live
`convex/*.ts` at HEAD]`.

**Controls (non-zero, so a scan matching nothing isn't mistaken for a clean bill of health):**
chains containing `.withIndex(`: **473** (non-zero); chains containing `.take(`: **205**
(non-zero); dynamic (non-string-literal) table-name hits: **0** (so every finding below has a
real table name, not a variable that would need separate handling).

| Metric | CONTEXT.md (regex) | This scan (AST) | Agreement |
|---|---|---|---|
| Total `ctx.db.query(...)` call sites | 608 | 582 | Close, not exact — different counting unit (regex likely counts `.withIndex(`-style lines too broadly or narrowly; not investigated further, doesn't affect the phase) |
| Bare-`.collect()` violations (FIX-01's shape) | 90 | **77** | **Disagreement — 13 fewer under AST parsing** |
| `events` table hits | 1 (`metrics.ts:19`) | 1 (`metrics.ts:19`) | ✅ Match |
| `discoveredTools` table hits | 5 | 5 (`registry.ts:617,785,1107`; `alerts.ts:329`; `metrics.ts:24`) | ✅ Match |
| `registry.ts` file-level hits | 24 | **25** | Off by one — negligible, not investigated further |
| `skillCategories.ts` file-level hits | 14 | **10** | **Real disagreement** — verified by hand: `skillCategories.ts` has exactly 9 direct `ctx.db.query("X").collect()` lines (127,137,145,147,148,181,183,289,309,345 = 10 total incl. the `.then()`-chained one at :127) plus zero others; the regex overcounted by 4 |
| Schema tables parsed | 146 | **148** | Off by 2 — negligible |
| Growth-shaped tables (schema-wide) | not enumerated | **101 of 148** | New data point (F-4 only reported the subset hit by bare collects) |
| Growth-shaped tables WITH a bare-collect hit (excl. `events`) | "12", but only 9 named: `sessions`, `subagentJobs`, `swarmTasks`, `tasks`, `anomalyEvents`, `episodicEvents`, `dockerContainers`, `prompts`, `ideationFindings` | **9 distinct tables, different set**: `anomalyEvents`, `dockerContainers`, `ideationFindings`, `prompts`, `registeredHooks`, `subagentJobs`, `supabaseHealth`, `swarmTasks`, `tasks` (15 hit sites total across these 9) | **Real disagreement — see below** |
| `discoveredTools` classifies as config-shaped (no time-ish index) | Yes, `by_name`/`by_source`/`by_usage`, schema.ts:185-187 | Yes — confirmed. Exact span is `schema.ts:175-187`. It DOES have `discoveredAt`/`lastUsedAt` fields (time-ish by name) but neither is in any `.index(...)` call, which is why it still classifies config-shaped under the "time-ish INDEX" rule (not a "time-ish FIELD" rule) | ✅ Confirmed, with the field-vs-index nuance made explicit |
| `forgeLogChunks` bare-collect line | `forge.ts:1136` (CONTEXT deferred-section citation) | `forge.ts:1518` | **Citation is off by ~380 lines** — verify at plan time; `:1518` is `await ctx.db.query("forgeLogChunks").collect()` with indexes `by_host_job_seq`/`by_host_job` (schema), config-shaped by this scan too, so D-10's classification is still correct even though the line number is wrong |

**D-11's allowlist as literally written does not match live code — this needs correcting
before the plan writes the ratchet's allowlist:**

1. **`sessions (migrations.ts:182)` is WRONG.** `migrations.ts:182` is
   `const rows = await ctx.db.query("skills").collect();` (inside `listSkillOrigins`) — a
   `skills` table read, not `sessions`. Verified by reading the file directly
   (`convex/migrations.ts:8-18`). A repo-wide grep for `ctx.db.query("sessions")` across all
   16 non-test call sites (`agents.ts:133`, `alerts.ts:235,747`, `analytics.ts:115`,
   `briefings.ts:135,173`, `evalScores.ts:156,734`, `health.ts:20`, `heroStats.ts:19`,
   `metrics.ts:21`, `sessions.ts:14,50,68,81,94`) finds **zero** that terminate in a bare
   `.collect()` with no `withIndex`/`take`/etc — every one is either indexed or capped.
   `sessions` should NOT be in the D-11 allowlist; it has nothing to allowlist.
2. **`episodicEvents` is WRONG.** Every `ctx.db.query("episodicEvents")` call site
   (`memory.ts:8,39,59,109,121,128`) uses `.withIndex(` or `.take(` — none are bare. Verified
   by reading all six call sites. `episodicEvents` should NOT be in the D-11 allowlist either.
3. **`registeredHooks` and `supabaseHealth` are MISSING.** Both are growth-shaped by schema
   (time-ish indexes exist for both — confirmed by the schema parse) and both have real
   bare-collect hits: `registeredHooks` at `alerts.ts:344` and `registry.ts:750,1108` (3 hits);
   `supabaseHealth` at `alerts.ts:391` and `supabase.ts:27` (2 hits). Neither appears in D-11's
   named list.

Net effect: the corrected "other N growth-shaped bare collects to allowlist" population (i.e.
everything except `events`, which this phase fixes) is **9 tables, 14 hit sites** —
`anomalyEvents` (`anomalyDetection.ts:148`), `dockerContainers` (`systemResources.ts:31`,
`alerts.ts:365`), `ideationFindings` (`ideation.ts:45`), `prompts` (`galdr.ts:151,209`),
`registeredHooks` (`alerts.ts:344`, `registry.ts:750,1108`), `subagentJobs`
(`subagentJobs.ts:88`), `supabaseHealth` (`alerts.ts:391`, `supabase.ts:27`), `swarmTasks`
(`swarmTasks.ts:116`), `tasks` (`tasks.ts:8`) — not the 9-named/"10"-claimed set in D-11. D-11
itself is a locked decision (allowlist with reasons, don't fix) — this finding doesn't change
that decision, only the literal file:line contents of the allowlist the plan will write.

**Why the regex and AST counts disagree (not fully root-caused, not blocking):** the most
likely explanation for the skillCategories.ts gap is that the original regex scan matched a
`.collect()` occurrence on a line where a DIFFERENT, already-indexed query chain also appeared
nearby (a multi-query handler), inflating its per-file tally without correctly attributing
each `.collect()` to its own chain — exactly the "spans lines, string/formatting sensitive"
failure mode D-09's rationale predicts for regex scanning. This is not worth chasing further;
the AST numbers are the ones to build the ratchet against, since D-09 already decided AST over
regex for exactly this reason.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typescript` | `^6.0.3` (installed: 6.0.3) `[VERIFIED: package.json + node_modules]` | Compiler API for the AST-based ratchet (D-09) | Already a devDependency; used identically by `src/pages/Analytics.structuralGuard.test.ts` and `src/tokenSweep.ratchet.test.ts` |
| `convex` | `^1.42.0` (installed: 1.42.1) `[VERIFIED: package.json + node_modules]` | Backend query/action runtime; exports `FunctionReturnType` from `convex/server` for D-04's type-derived guard | `node_modules/convex/dist/esm-types/server/api.d.ts:238` defines `export type FunctionReturnType<FuncRef extends AnyFunctionReference> = FuncRef["_returnType"]`, re-exported from `convex/server` at `index.d.ts:72` |
| `vitest` | `^4.1.9` | Test runner for both the new ratchet signature and the recorded-query test | Existing project standard; `unit` project glob `convex/**/*.test.ts` already covers both new files |

No new packages are needed for this phase — no `npm install` required. `slopcheck`/package-legitimacy audit is therefore N/A (see below).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `FunctionReturnType<typeof api.metrics.dashboardSummary>` | Hand-write a matching TS interface for `executeTool`'s expectations | Hand-written types silently drift the moment the query's return shape changes — exactly the class of bug F-2 is. `FunctionReturnType` is derived, so it can't drift. |
| AST-based ratchet scan | Extend the existing regex (`RANGE_IN_FILTER`) with a second pattern for bare `.collect()` | Explicitly rejected by D-09: a bare-collect chain routinely spans multiple lines (see `skillCategories.ts:127` above, `.query(...).collect().then(...)` split differently elsewhere), and a regex's negative result is "a claim about the probe," which is the exact failure mode this phase exists to close. |
| `ctx.runQuery(api.analytics.tokenSunburst)` for cost figures | A new `internalQuery` in `metrics.ts` that reads `aggregates` directly | New export would need a caller in the same commit (CLAUDE.md §Dead Surface) or land on the 40-entry `dead-surface-baseline.json` as debt. Reusing the existing, already-called `tokenSunburst` avoids both. |

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** No `npm install` step exists in any
locked decision; `typescript` and `convex` are pre-existing devDependencies/dependencies
already verified present at the pinned versions above. The Package Legitimacy Gate protocol
is not applicable.

## Architecture Patterns

### System Architecture Diagram

```
insightsChat.ask (action)                     metrics.dashboardSummary (query)
  │  LLM tool-call loop                          │
  │  toolName === "cost_summary"                 │
  ▼                                               │
executeTool(ctx, "cost_summary")                  │
  │  ctx.runQuery(api.metrics.dashboardSummary) ──┤
  │      returns { eventsLastHour, activeSessions,│
  │                uniqueTools, truncated,        │
  │                rowsRead }        (bounded:    │
  │                by_timestamp2 range + take;    │
  │                TOOLS_COUNT_CAP take)          │
  │                                                ▼
  │                                          convex/schema.ts
  │  ctx.runQuery(api.analytics.tokenSunburst) ──► aggregates table
  │      returns { tree, totalCost, totalTokens } (by_type_period_bucket
  │      (already bounded, already called          index range, existing
  │       from TokenSunburst.tsx)                  Phase 88/121 rollup)
  ▼
{ totalCost, tokenCount, totalEvents, ... }
  → returned to LLM as a tool result
  → LLM states the figure to the operator
```

Static-analysis side (dev-time only, not runtime):

```
npm test  ──►  vitest run --project unit (sequential, then --project browser)
                 │
                 ├─ convex/boundedReads.ratchet.test.ts
                 │    signature 1: range-in-post-read-filter (existing)
                 │    signature 2: bare .collect() on a high-volume table (NEW, D-08/D-09)
                 │         │
                 │         ├─ AST walk: ctx.db.query(TABLE) chains,
                 │         │  flag if no withIndex/take/first/unique/paginate
                 │         ├─ filter to TABLE ∈ high-volume list
                 │         │    (schema-derived time-ish-index tables ∪ explicit additions)
                 │         └─ allowlist with per-entry reason (9 tables, 14 sites — corrected)
                 │
                 └─ convex/metricsDashboardBounded.test.ts (NEW, D-13)
                      makeRecordingDb (shared helper, D-14) records index+bounds+limit
                      per TABLE (must support 2 independent tables — events AND
                      discoveredTools — in one test run)
```

### Recommended Project Structure
No new directories. Two files change, two files are new, all inside `convex/`:
```
convex/
├── metrics.ts                      # MODIFIED: bound events + discoveredTools reads (D-05/D-06/D-07)
├── heroStats.ts                    # MODIFIED (1 line): export TOOLS_COUNT_CAP (D-06)
├── insightsChat.ts                 # MODIFIED: cost_summary reads real totalCost/totalTokens (D-03/D-04)
├── boundedReads.ratchet.test.ts    # MODIFIED: new AST-based signature 2 + header update (D-08/D-09/D-12)
├── metricsDashboardBounded.test.ts # NEW: recorded-query assertions for both reads (D-13)
└── testHelpers/                    # NEW (suggested location) or convex/ root:
    └── makeRecordingDb.ts          # NEW: shared helper (D-14), imported (not copied) by the new test only
```

### Pattern 1: Bound a range-based read to a window (D-05 analog)
**What:** Range the index scan to only the time window actually needed, then `.take()` a cap
as a second line of defense against the 4,096-read limit.
**When to use:** Any "recent activity" count/aggregate over a monotonically-growing table.
**Example (verbatim from the repo, the pattern to replicate for `metrics.ts:19`):**
```typescript
// Source: convex/heroStats.ts:43-51 (existing, in-repo)
const recentEvents = await ctx.db
  .query("events")
  .withIndex("by_timestamp2", (q) => q.gte("timestamp", oneHourAgo))
  .order("desc")
  .take(500);
const hourEvents = recentEvents.filter((e) => e.timestamp >= oneHourAgo);
```
Note the comment at `heroStats.ts:31-39` records the actual measurement backing this shape
(unbounded `take(500)` times out; range-bounded `take(500)` returns cheaply) — cite it rather
than re-deriving from scratch.

### Pattern 2: Cap an unindexable full-table count (D-06 analog)
**What:** When no field is available to index a count by (a genuinely unfiltered count), bound
the read with `.take(CAP)` rather than `.collect()`, and document that the count saturates
rather than blanks past the cap.
**Example (verbatim, the pattern to replicate for `metrics.ts:24`, cap shared via D-06 export):**
```typescript
// Source: convex/heroStats.ts:89-102 (existing, in-repo)
const tools = await ctx.db.query("discoveredTools").take(TOOLS_COUNT_CAP);
```

### Pattern 3: Truncation reporting (D-07 analog)
**What:** When a cap is hit, report it explicitly rather than silently under-counting.
**Example (verbatim, adapt the boundary check `>=` not `>`):**
```typescript
// Source: convex/llm.ts:260-280 (existing, in-repo)
const rows = await ctx.db.query("...").order("desc").take(ROLLUP_READ_CAP);
const truncated = rows.length >= ROLLUP_READ_CAP;
if (truncated) {
  console.warn(`[metrics.dashboardSummary] hit the ${CAP}-row cap ...`);
}
return { ..., rowsRead: rows.length, truncated };
```

### Pattern 4: Recorded-query test double (D-13/D-14 — see full comparison below)
**What:** A fake `ctx.db` whose `.withIndex()`/`.take()`/`.collect()` methods RECORD what was
called, rather than a fake that just returns fixture rows. Assertions run against the
recording, never against returned row counts (a surviving `.collect()` returns correct counts
on a tiny fixture — only the recorded shape discriminates).
**Example (the strongest of the 7 existing copies — `heroStats.test.ts`'s per-table variant,
the one D-14's shared helper should be modeled on, NOT the flat single-array variant used by 5
of the 7):**
```typescript
// Source: convex/heroStats.test.ts (existing, in-repo) — per-TABLE fixtures
function makeRecordingDb(rowsByTable: Record<string, unknown[]> = {}) {
  const uses: IndexUse[] = [];
  return {
    uses,
    query(table: string) {
      const rows = rowsByTable[table] ?? [];
      const use: IndexUse = { table, index: "", bounds: [], limit: null };
      const chain = {
        withIndex(index: string, cb?: (q: unknown) => unknown) { /* records use.index, use.bounds */ return chain; },
        order() { return chain; },
        async take(n: number) { use.limit = n; uses.push(use); return rows.slice(0, n); },
        async collect() { uses.push(use); return rows; }, // limit stays null — the tell
      };
      return chain;
    },
  };
}
```

### Anti-Patterns to Avoid
- **Flat single-`rows`-array fake DB for a two-table test:** 5 of the 7 existing
  `makeRecordingDb` copies (`alertsCountBounded`, `automationCronSummaryBounded`,
  `bifrostListBounded`, `messageRoutesBounded`, `inbox.test.ts`) take a single `rows: unknown[]`
  fixture shared across every table the handler queries. `metricsDashboardBounded.test.ts`
  needs to assert independently on `events` AND `discoveredTools` in the same handler call — a
  flat-array fake cannot express "return these 3 rows for `events` and these 5000 rows for
  `discoveredTools`" in one test. **The D-14 shared helper must use the `rowsByTable` shape**
  (`heroStats.test.ts` / `briefingsDigestBounded.test.ts`'s pattern), not the majority shape.
- **`bifrostListBounded.test.ts`'s `withIndex()` swallowing its arguments:** that copy's
  `withIndex() { return chain; }` takes no parameters and records neither index name nor
  bounds — it can only ever discriminate take-vs-collect, never which index or range was used.
  Do not model the shared helper on this variant; it is the weakest of the 7.
- **Asserting on `dead-surface-baseline.json` counts as a proxy for "safe to add an export":**
  `check-dead-surface.mjs` fails on ANY newly-dead export, staged or not — if D-03's rollup
  reuse turns into a new exported helper instead of reusing `api.analytics.tokenSunburst`
  directly, its caller (`insightsChat.ts`) must land in the SAME commit, per CLAUDE.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cost/token aggregation for `cost_summary` | A new bounded scan over `llmMetrics` or a new `aggregates` reader | `api.analytics.tokenSunburst` → `sunburstFromAggregates` (`convex/analyticsRollupQueries.ts:142-189`) | Already returns exactly `{ totalCost, totalTokens }` (plus an unused `tree`) from a 30-day, index-bounded `aggregates` read; already has a live caller (`TokenSunburst.tsx`), so reuse adds zero new dead-surface risk |
| Bounded-read regression testing | A hand-rolled mock per test file (the current 7-copy state) | The `heroStats.test.ts`-style `makeRecordingDb`, extracted (D-14) | 7 independent copies have already diverged in three material ways (row-storage model, boundedness signal shape, `.filter()` tracking) — a shared helper stops an 8th divergence |
| TS-AST call-chain detection | A smarter multi-line regex | `ts.createSourceFile` + `ts.forEachChild` walk | The compiler API is already a project dependency, already used for two other structural guards (`Analytics.structuralGuard.test.ts`, `tokenSweep.ratchet.test.ts`), and is immune to the line-span/formatting/comment failure modes a regex has |

**Key insight:** every piece of this phase except the AST scanner itself already has a working,
tested analog sitting in the repo. The main risk is copying the WEAK variant of an existing
pattern (the flat-array `makeRecordingDb`, or a hand-written return-type interface) rather than
the strong one.

## Common Pitfalls

### Pitfall 1: Regex-derived scope numbers don't survive an AST re-derivation
**What goes wrong:** Building the ratchet's allowlist (D-11) directly off CONTEXT.md's F-3/F-4
regex numbers ships an allowlist that references a `sessions` violation and an `episodicEvents`
violation that don't exist, while missing two that do (`registeredHooks`, `supabaseHealth`).
**Why it happens:** A regex scan over `.collect()` occurrences can misattribute a hit to the
wrong nearby query when a handler runs multiple `ctx.db.query(...)` chains in sequence — one
indexed, one not — and the file-level talley doesn't discriminate.
**How to avoid:** Use this document's AST-derived hit list (9 tables, 14 sites, all cited above
with exact `file:line`) as the allowlist source, not CONTEXT.md's F-3/F-4 prose.
**Warning signs:** `boundedReads.ratchet.test.ts`'s own "the allowlist does not over-claim"
control (pattern at line 152-166 of the existing file) will fail immediately if an allowlisted
table has zero real hits — this is exactly the kind of stale-allowlist bug that control exists
to catch, so trust that test's own red/green over any prose count.

### Pitfall 2: `.order()` alone does not bound anything
**What goes wrong:** `ctx.db.query("registeredHooks").order("desc").collect()`
(`registry.ts:750`) LOOKS bounded because of the `.order()` call, but `.order()` with no
preceding `.withIndex()` range and no trailing `.take()` still reads and sorts the ENTIRE
table.
**Why it happens:** `.order("desc")` is visually similar to the correctly-bounded
`.withIndex(...).order("desc").take(N)` idiom used everywhere else in the codebase (127 correct
instances per the existing ratchet header), so a reviewer's eye slides past it.
**How to avoid:** The AST scanner (Q2 below) must NOT treat `.order(` as a bounding call — only
`.withIndex(`, `.take(`, `.first(`, `.unique(`, `.paginate(` count.
**Warning signs:** A table appears in the bare-collect hit list even though its chain contains
`.order(...)`.

### Pitfall 3: A field can be "time-ish" by name without being "time-ish" for this heuristic
**What goes wrong:** `discoveredTools` has both `discoveredAt` and `lastUsedAt` fields (schema
`convex/schema.ts:175-187`), which pattern-match a naive "time-ish field name" heuristic — but
NEITHER is used in any of its three indexes (`by_name`, `by_source`, `by_usage`). A heuristic
that scans field NAMES instead of INDEX field lists would misclassify `discoveredTools` as
growth-shaped and silently drop it from D-10's "needs an explicit addition" list — even though
the addition would then be redundant, not wrong, this is exactly the kind of silent scope
change that should be a documented decision, not an accident of heuristic wording.
**Why it happens:** "Time-ish" is ambiguous between "has a timestamp field" (true for almost
every table) and "has a timestamp field IN AN INDEX" (true only for tables an index-range scan
can actually bound cheaply) — D-10 means the second.
**How to avoid:** Parse `.index("name", [...fields])` call arguments specifically, not the
table's `defineTable({...})` field list. See Q3 for the exact AST shape.
**Warning signs:** The growth-shaped count balloons far past the ~101/148 this scan found, or
`discoveredTools` stops needing D-10's explicit-addition entry.

### Pitfall 4: `executeTool` in `insightsChat.ts` is not exported
**What goes wrong:** D-04's value test ("unit test asserting `cost_summary` returns
non-placeholder values against a fixture with known cost") cannot import `executeTool` — it is
a bare, unexported `async function` at `convex/insightsChat.ts:71`. Writing the test against
the exported `ask` action instead means mocking the LLM tool-call loop, which is much heavier
than necessary.
**Why it happens:** `executeTool` was written as an internal implementation detail of `ask`
when the file was authored (Phase 3 Plan 06 per the file's own header comment).
**How to avoid:** Export `executeTool` (or extract just the `cost_summary` case into its own
exported function) so it can be unit-tested directly with a fake `ctx = { runQuery: vi.fn(...) }`
— this repo already has the exact analog for that shape at `convex/evalScores.test.ts:882-892`
(`DetectRegressionsCtx`, a hand-built ctx object with a `vi.fn()` `runQuery`/`runMutation`).
Exporting `executeTool` from `insightsChat.ts` and importing it in a new
`insightsChat.test.ts` does NOT trip the dead-surface ratchet — `check-dead-surface.mjs` only
tracks Convex-registered exports (`query`/`mutation`/`action`/etc, matched by its `DECL` regex
at line 30), and `executeTool` is a plain function, not one of those.
**Warning signs:** No test file exists yet at `convex/insightsChat.test.ts` — this is a Wave 0
gap (see Validation Architecture below).

### Pitfall 5: `convex-test` is not installed — don't reach for it
**What goes wrong:** A plan step that assumes `convex-test` (the official Convex testing
library) is available for isolating `ctx.db`/`ctx.runQuery` will fail at `npm install` time or
silently import nothing.
**Why it happens:** It's the "obvious" tool for testing Convex functions, and many tutorials
assume it.
**How to avoid:** This repo's own established pattern (noted explicitly at
`convex/runtimeIngest.test.ts:9` and `convex/evalScores.test.ts:12`) is plain `vitest` +
hand-built fake `ctx` objects. Follow that, not `convex-test`.
**Warning signs:** An `import` from `"convex-test"` anywhere in a new test file.

## Code Examples

### The two defects to fix, verbatim (current state)
```typescript
// Source: convex/metrics.ts:16-34 (current, unbounded)
export const dashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();              // :19 — UNBOUNDED
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();                                                        // :20-23 — bounded, NOT in scope
    const tools = await ctx.db.query("discoveredTools").collect();       // :24 — UNBOUNDED
    const uniqueToolNames = new Set(tools.map((t) => t.name));
    return {
      totalEvents: events.length,
      activeSessions: sessions.length,
      uniqueTools: uniqueToolNames.size,
    };
  },
});
```
```typescript
// Source: convex/insightsChat.ts:71-80 (current, F-2's field mismatch)
async function executeTool(ctx: any, toolName: string): Promise<ToolResult> {
  switch (toolName) {
    case "cost_summary": {
      const metrics = await ctx.runQuery(api.metrics.dashboardSummary);
      return {
        totalCost: metrics?.totalCost ?? 0,      // dashboardSummary NEVER returns totalCost
        tokenCount: metrics?.totalTokens ?? 0,    // dashboardSummary NEVER returns totalTokens
        totalEvents: metrics?.totalEvents ?? 0,
      };
    }
```

### The D-03 reuse target, verbatim
```typescript
// Source: convex/analytics.ts:57-86 + convex/analyticsRollupQueries.ts:142-189
export const tokenSunburst = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const costBuckets = await ctx.db.query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", "hourly").gte("bucket_start", cutoff))
      .collect();
    const tokenBuckets = await ctx.db.query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "tokens").eq("period", "hourly").gte("bucket_start", cutoff))
      .collect();
    return sunburstFromAggregates(costBuckets, tokenBuckets); // { tree, totalCost, totalTokens }
  },
});
```
Calling this from `executeTool` is `await ctx.runQuery(api.analytics.tokenSunburst)` — no new
export, no dead-surface risk, satisfies D-03's "do not invent a new scan."

### D-04's type-derived guard — exact API surface
```typescript
// Verified against node_modules/convex/dist/esm-types/server/api.d.ts:238 and index.d.ts:72
import { FunctionReturnType } from "convex/server";
import { api } from "./_generated/api";

type DashboardSummary = FunctionReturnType<typeof api.metrics.dashboardSummary>;
// This resolves the query's INFERRED return type (metrics.ts has no explicit `returns:`
// validator, so the type is inferred from the handler's `return {...}` shape — confirmed by
// reading convex/metrics.ts, which has no `returns:` key). Renaming a field in the handler's
// return object, or removing one, becomes a tsc error anywhere DashboardSummary's fields are
// destructured with the OLD name.
```
No in-repo file currently imports `FunctionReturnType` — grepped `convex/` and `src/` for it,
zero hits. This will be a first-in-repo pattern; it is a documented, stable public export of
the installed `convex` package (not a private/internal API), so the risk is low, but flag it
in the plan as "new pattern, no in-repo precedent to copy from" rather than implying it mirrors
an existing usage.

### D-04's value-test analog (existing ctx-mock pattern to copy)
```typescript
// Source: convex/evalScores.test.ts:882-892 (existing, in-repo — the shape to copy for insightsChat.test.ts)
const runQuery = vi.fn(async (_fn: any, _args: any) => { /* return canned data by fn identity */ });
const runMutation = vi.fn(async () => {});
const ctx: DetectRegressionsCtx = { runQuery, runMutation, scheduler: { runAfter } };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `analytics.ts`'s 4 heavy queries scanning `events`/`llmMetrics` directly | Reading the `aggregates` rollup via `by_type_period_bucket` index range | Phase 88 Plan 04 (per `analytics.ts:9-14` header comment) | Established the exact reuse target for D-03; this phase is applying the same pattern to a 5th query (`cost_summary`) rather than inventing a 6th approach |
| `llmMetrics`/`cacheStats` bounded with silent caps | Bounded with `truncated`/`rowsRead` + `console.warn` on cap hit | Phase 121 (AR-01..03, per the folded todo's own re-derivation section) | The D-07 contract this phase's `metrics.ts` change should match |
| Regex-only `boundedReads.ratchet.test.ts` (range-in-filter signature only) | Gaining a second, AST-based signature (bare `.collect()` on a high-volume table) | This phase (D-08/D-09) | First AST-based ratchet signature in this file; the file's two existing structural guards elsewhere in the repo (`Analytics.structuralGuard.test.ts`, `tokenSweep.ratchet.test.ts`) are the process analogs, not code to import from |

**Deprecated/outdated:** None — no library version changes, no removed APIs. This phase is
entirely internal-pattern reuse.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A 1-hour window (matching heroStats) is sufficient for the Insights LLM's `cost_summary`/event-count use case, rather than 24h | Pattern 1 / Primary recommendation | Low — this is explicitly Claude's discretion per CONTEXT.md, and the fallback (use the `aggregates` rollup instead of widening the raw scan) is already specified if 1h proves too narrow |
| A2 | The root cause of the regex-vs-AST count disagreement (skillCategories.ts 14 vs 10) is multi-query misattribution, not a bug in this session's AST scanner | Disagreements section | Low — the AST scanner's own controls (non-zero `.withIndex(` count, zero dynamic-table hits, hand-verified `events`/`discoveredTools` exact match against CONTEXT's own numbers) give confidence the AST side is correct; the regex's mechanism was not independently re-run to confirm, since the regex script itself isn't preserved in the repo |
| A3 | `executeTool` can be exported from `insightsChat.ts` without tripping `check-dead-surface.mjs` | Pitfall 4 | Low — verified by reading the ratchet's own `DECL` regex (`scripts/check-dead-surface.mjs:30`), which only matches `export const NAME = (query\|mutation\|action\|internal*)(` — a plain exported function does not match this pattern regardless of export status |

## Open Questions

1. **Where should the extracted `makeRecordingDb` shared helper live?**
   - What we know: D-14 says "extract to a shared test helper," used only by the new test; none
     of the 7 existing copies currently import from a shared location (each is a private
     top-level function in its own `*.test.ts` file).
   - What's unclear: file location/name (`convex/testHelpers/makeRecordingDb.ts` vs
     `convex/testHelpers.ts` vs colocated with `metricsDashboardBounded.test.ts` and exported
     for the migration-deferred future to import later).
   - Recommendation: `convex/testHelpers/makeRecordingDb.ts`, using the `rowsByTable` shape
     (Pattern 4 above), so a later migration of the other 7 copies (explicitly deferred, but
     filed as a todo per CONTEXT.md) has a single clear import target.

2. **`graphSnapshots` classifies as config-shaped under D-10's heuristic — is that right?**
   - What we know: `graphSnapshots.ts` has 3 bare-collect hits (`:464,615,838`) and the table
     has a `generatedAt` field per a schema comment near line 2625, but this scan's
     index-based heuristic found no time-ish INDEX on it, so it falls into the 62
     config-shaped-bare-collect population this phase deliberately does not triage.
   - What's unclear: whether `graphSnapshots` grows unboundedly at a rate that would make it a
     candidate for a future D-10-style explicit addition (like `discoveredTools`/
     `forgeLogChunks`), or whether it's genuinely bounded by a small snapshot-retention policy
     elsewhere.
   - Recommendation: Out of scope for Phase 129 (matches the deferred "triage the other ~75 by
     row count" item) — flagging only so a future triage phase doesn't have to re-derive it.

## Environment Availability

Code/config-only phase — no external services, no new packages. Confirmed present:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm test`, AST scan | ✓ | v22.23.2 | — |
| npm | `npm test` | ✓ | 10.9.8 | — |
| `typescript` (devDependency) | D-09's AST scanner | ✓ | 6.0.3 | — |
| `convex` (dependency) | `FunctionReturnType` (D-04) | ✓ | 1.42.1 | — |
| `vitest` (devDependency) | test execution | ✓ | 4.1.9 (per package.json) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

**Shared-checkout hazard, reconfirmed live at research time:** `git status --porcelain` shows
`convex/_generated/api.d.ts` currently modified in the working tree (not by this research
session — no edits were made to that file here). This matches CONTEXT.md's noted concurrent
astridr-repo Phase 197 session. Executors on this phase must stage by explicit path
(`git add convex/metrics.ts convex/heroStats.ts ...`, never `git add -A`/`git add convex/`) and
must NOT run `npx convex deploy` or `npx convex codegen` unless they intend to pick up and
commit the concurrent session's pending schema changes too — check `git diff --stat` against
the intended edit size before staging, per CLAUDE.md's dead-surface/formatter-hook lesson.
`scripts/check-dead-surface.mjs` itself is confirmed already committed (`b08ac322`, clean in
`git status`), so CONTEXT.md's "currently MODIFIED" note about that specific file is now stale
— read the committed version, not a working-tree diff.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9, `jsdom` environment for `unit` project, real headless Chromium for `browser` project (not relevant to this phase — no `.browser.test.tsx` files touched) |
| Config file | `vitest.config.ts` (project-based; `unit` project globs `src/**/*.test.{ts,tsx}`, `convex/**/*.test.ts`, `hooks/**/*.test.mjs`) |
| Quick run command | `npx vitest run --project unit convex/boundedReads.ratchet.test.ts convex/metricsDashboardBounded.test.ts` (or add `convex/insightsChat.test.ts` once created) |
| Full suite command | `npm test` (runs `vitest run --project unit && vitest run --project browser`, sequentially — CLAUDE.md and `vitest.config.ts:29-53`'s own comment both confirm this is load-bearing, not optional) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 (bound `events`) | `metrics.ts:19` reads via `by_timestamp2` range + `.take()`, records a non-null limit | unit (recorded-query) | `npx vitest run --project unit convex/metricsDashboardBounded.test.ts -t events` | ❌ Wave 0 — new file |
| FIX-01 (bound `discoveredTools`) | `metrics.ts:24` reads via `TOOLS_COUNT_CAP` `.take()`, records a non-null limit | unit (recorded-query) | `npx vitest run --project unit convex/metricsDashboardBounded.test.ts -t discoveredTools` | ❌ Wave 0 — new file |
| FIX-01 (D-07 truncation) | `truncated`/`rowsRead` reported correctly on both sides of the cap boundary | unit | same file, boundary-case tests (pattern from `alertsCountBounded.test.ts:127-141`) | ❌ Wave 0 |
| FIX-01 (F-2 field fix) | `cost_summary` returns non-placeholder `totalCost`/`totalTokens` for a fixture with known cost | unit (value test) | `npx vitest run --project unit convex/insightsChat.test.ts` | ❌ Wave 0 — new file, AND `executeTool` needs exporting first (Pitfall 4) |
| FIX-01 (D-04 type guard) | A field rename/removal on `dashboardSummary`'s return shape is a compile error in `insightsChat.ts` | static (compiler) | `npx tsc --noEmit` | ✅ existing command, no new file — but the `FunctionReturnType` usage itself is new code to add |
| FIX-02 (D-08/D-09 AST signature) | A bare `ctx.db.query(highVolumeTable).collect()` with no index/take/first/unique/paginate fails the ratchet | unit (static-analysis-on-source-text) | `npx vitest run --project unit convex/boundedReads.ratchet.test.ts` | ⚠ File exists, needs the new `describe` block added (not a Wave-0 gap — extending an existing file per D-12) |
| FIX-02 (D-08 table-scoping) | Config-shaped tables (the 62 other bare-collect sites) do NOT fail the ratchet | unit | same file, a negative-control test asserting a known config-shaped hit (e.g. `skills`) is NOT flagged | ⚠ Same file, new assertion |
| FIX-02 (mutation-proof, success criterion 3) | Reverting `metrics.ts:19`/`:24` to the unbounded form makes the ratchet fail | manual mutation test (documented procedure) OR `--self-test`-style harness | See "Guard proof" below | ❌ Wave 0 — needs a decision (Q in additional_context, Claude's discretion per CONTEXT.md) |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit convex/metrics.test.ts convex/boundedReads.ratchet.test.ts convex/metricsDashboardBounded.test.ts convex/insightsChat.test.ts` (scoped to touched files)
- **Per wave merge:** `npm test` (full sequential unit+browser run — required because `vitest.config.ts`'s own comment warns a root-level change can silently stop selecting an entire project)
- **Phase gate:** `npm test` green, PLUS `npx tsc --noEmit` green (for the D-04 type guard to actually be proven, not just written), before `/gsd:verify-work`

### Guard Proof (success criterion 3 — mandatory, per CONTEXT.md)
Two options, compared:

| Approach | How it works | Pros | Cons |
|---|---|---|---|
| Mutation test against real `metrics.ts` | A test temporarily/permanently keeps a copy of the OLD unbounded `metrics.ts` source (e.g. inline string or a fixture file) and asserts the ratchet's scan function flags it | Directly exercises the exact defect shape this phase fixes; no new script surface | Needs a fixture that must be kept in sync with what "the old shape" looked like — slight duplication risk |
| `--self-test`-flag style (à la `check-dead-surface.mjs`) | Add a synthetic/sentinel violation the scanner is asserted to catch, built at runtime (not a literal string, per that script's own documented self-inflicted bug at lines 152-166) | Matches an existing, already-battle-tested pattern in this repo; the runtime-construction lesson is already documented and avoidable | Requires adding a `--self-test` CLI mode to a `*.test.ts` file's logic, which doesn't fit vitest's execution model as cleanly as it fits a standalone `.mjs` script — `boundedReads.ratchet.test.ts` is not currently structured as an invokable script |

**Recommendation:** Mutation test against real `metrics.ts`, structured as a same-file `it()`
block that constructs a small synthetic source string reproducing the OLD unbounded shape
(`ctx.db.query("events").collect()`, no `withIndex`) and asserts the AST scan function
(extracted so it's independently callable, not just embedded in the top-level `scan()`)
returns a violation for it — this mirrors `boundedReads.ratchet.test.ts`'s EXISTING control
pattern at lines 107-113 ("its regex actually matches the defect shape (control)"), which
already does exactly this for signature 1. Building the same style of control for signature 2
is the lower-risk, more idiomatic choice for THIS file, even though `check-dead-surface.mjs`'s
`--self-test` flag is the newer overall pattern in the repo.

### Wave 0 Gaps
- [ ] `convex/metricsDashboardBounded.test.ts` — covers FIX-01's recorded-query assertions
- [ ] `convex/insightsChat.test.ts` — covers FIX-01's D-04 value test (requires exporting
      `executeTool` from `insightsChat.ts` first, or extracting a `costSummaryTool` helper)
- [ ] `convex/testHelpers/makeRecordingDb.ts` (or equivalent shared-helper file) — needed by
      `metricsDashboardBounded.test.ts` per D-14
- [ ] A same-file mutation-proof control inside `boundedReads.ratchet.test.ts`'s new
      `describe` block — needed to satisfy success criterion 3
- Framework install: none — `vitest`, `typescript`, `convex` already present at the versions
  audited above

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so treated as enabled per
default. This phase introduces no new external input surface, no new authentication/session
logic, and no new mutation — it bounds two existing reads and repoints one internal action's
data source to an already-bounded, already-called query. The project's own decided security
posture (CLAUDE.md §"Self-Hosted Convex — Operational Rules": tailnet is the auth boundary,
Clerk gates UI only, per SEED-008) is unaffected — `dashboardSummary` and `tokenSunburst` are
both still public `query()` functions reachable the same way they are today; bounding their
reads changes cost/DoS-resilience characteristics, not the auth boundary.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth logic touched |
| V3 Session Management | No | No session logic touched |
| V4 Access Control | No | No access-control logic touched; both queries remain public, unchanged from today's posture |
| V5 Input Validation | No | `dashboardSummary` and `tokenSunburst` take `args: {}` — no new input surface added |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unbounded `.collect()` as an app-wide DoS vector (the exact class this phase fixes) | Denial of Service | Bound every read with an index range and/or `.take()` cap, per the D-05/D-06 patterns above; `alertsCountBounded.test.ts`'s own header states this precisely for `countBySeverity`, which runs on every route |

## Sources

### Primary (HIGH confidence — read directly from live code/installed packages this session)
- `convex/metrics.ts` (full file, 34 lines) — the two defects
- `convex/insightsChat.ts:1-110` — `executeTool`, `TOOLS`, F-2's field mismatch
- `convex/heroStats.ts` (full file, 138 lines) — D-05/D-06 analog with measurement comments
- `convex/boundedReads.ratchet.test.ts` (full file, 167 lines) — existing ratchet, allowlist mechanism, control pattern
- `convex/alertsCountBounded.test.ts` (full file, 153 lines) — D-13's canonical recorded-query pattern
- `convex/analytics.ts:1-120`, `convex/analyticsRollupQueries.ts:100-190` — D-03's reuse target
- `convex/schema.ts` — `aggregates` (:969-995), `discoveredTools` (:175-187), `events` indexes (:5-44) — exact line numbers reconfirmed
- `convex/heroStats.test.ts`, `convex/automationCronSummaryBounded.test.ts`, `convex/bifrostListBounded.test.ts`, `convex/briefingsDigestBounded.test.ts`, `convex/messageRoutesBounded.test.ts`, `convex/inbox.test.ts` — all 7 `makeRecordingDb` copies, compared
- `convex/llm.ts` (grepped sections) — D-07's `truncated`/`rowsRead`/`console.warn` contract
- `convex/evalScores.test.ts:1-40,882-892` — `convex-test` NOT installed note; `DetectRegressionsCtx` fake-ctx analog
- `scripts/check-dead-surface.mjs` (full file, 206 lines) — D-15 wiring, `DECL` regex scope, `--self-test` mechanism
- `scripts/hooks/pre-commit` — confirms pre-commit is dead-surface-only (D-15)
- `node_modules/convex/dist/esm-types/server/api.d.ts:238`, `index.d.ts:72` — `FunctionReturnType` export, installed convex@1.42.1
- `package.json`, `vitest.config.ts` (full files) — test script sequencing, project globs, typescript@6.0.3
- This session's own AST scan (`typescript` compiler API, `ts.createSourceFile`/`ts.forEachChild`) against every `convex/*.ts` file at HEAD — the F-3/F-4 re-derivation
- `.planning/phases/129-dashboard-unbounded-read-ratchet-coverage/129-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 129, `.planning/STATE.md`, `.planning/todos/pending/unbounded-analytics-scans-timeout.md`, `CLAUDE.md`

### Secondary (MEDIUM confidence)
None — no external web sources were needed for this phase; it is entirely in-repo pattern reuse.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all versions confirmed against installed `node_modules` and `package.json`
- Architecture: HIGH — every pattern cited is read verbatim from live, currently-shipping code
- Pitfalls: HIGH — each pitfall is backed by a direct grep/read that either confirms or contradicts a CONTEXT.md claim
- AST re-derivation (F-3/F-4): HIGH for the numbers produced (own scan, with non-zero controls and hand-verified spot checks); MEDIUM for WHY the regex disagrees (not root-caused, not blocking)

**Research date:** 2026-08-28
**Valid until:** 14 days (this is a fast-moving shared checkout with a concurrent session
actively modifying `convex/` — re-verify `convex/metrics.ts`, `convex/insightsChat.ts`, and the
allowlist tables against HEAD immediately before planning if more than a few days have passed)
