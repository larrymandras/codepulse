# Phase 129: Dashboard Unbounded Read & Ratchet Coverage - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Two unbounded full-table reads in `convex/metrics.ts`'s `dashboardSummary` become bounded
reads with honest, stated semantics; its single caller stops reporting fields that do not
exist; and the static guard that structurally could not see that defect shape gains a
signature for it.

**In scope:** `convex/metrics.ts:19` (`events`) and `:24` (`discoveredTools`); the
`cost_summary` tool in `convex/insightsChat.ts`; a new signature in
`convex/boundedReads.ratchet.test.ts`; a new recorded-query test for the bounded reads; a
shared `makeRecordingDb` test helper; a dated correction to FIX-01 in
`.planning/REQUIREMENTS.md`.

**Out of scope:** the other ~88 bare-`.collect()` sites (allowlisted, not fixed); the
`activeSessions` read duplicated between `metrics.ts` and `heroStats.ts`; migrating the
existing 7 `makeRecordingDb` copies; any change to `heroStats.summary`'s behaviour.

</domain>

<findings>
## Measurements taken during discussion

These four were measured against live code at this session's HEAD, and they change what
this phase can honestly promise. They are recorded here rather than left to be discovered
at plan time. Per Phase 128's D-05, a re-derivation that disagrees with the scoping claim
is a FINDING, not an error to correct silently.

**F-1 — `/` (Dashboard) does not call this query; FIX-01 names the wrong surface.**
Ripgrep over `src/` for `api.metrics` returns *no matches*. `src/pages/Dashboard.tsx:26`
reads `useRecentEvents(100)` and WS topics instead. The only caller of
`metrics.dashboardSummary` anywhere in the repo is `convex/insightsChat.ts:74`. Control:
the same search for `dashboardSummary` returns exactly two hits — that call site and the
`export` at `convex/metrics.ts:16` — so the probe does find the symbol where it exists.
**The blast radius is the Insights chat's `cost_summary` tool, not a route.** Re-verified
after a concurrent session landed `ef05e541`/`6df7c745` mid-discussion: `metrics.ts` was
untouched by that purge and the caller count is unchanged.

**F-2 — that single caller reads two fields the query has never returned.**
`insightsChat.ts:75-76` reads `metrics?.totalCost` and `metrics?.totalTokens`;
`dashboardSummary` returns only `{ totalEvents, activeSessions, uniqueTools }`
(`metrics.ts:28-32`). So `cost_summary` hands the LLM `totalCost: 0, tokenCount: 0` on
every call — a confident zero of exactly the class recorded as trap #3 in
`.planning/todos/pending/unbounded-analytics-scans-timeout.md`. This is a second live
defect sitting on top of the unbounded scan, and it is why bounding the query alone would
leave the phase's user-visible effect unobservable.

**F-3 — a table-scoped ratchet signature is viable; a shape-only one is not.**
Regex scan over `convex/*.ts` (non-test, comments stripped): of **608** `ctx.db.query(...)`
chains, **90** terminate in `.collect()` with no `withIndex` at all — FIX-01's shape.
`events` accounts for exactly **1** of those 90 (`metrics.ts:19`); `discoveredTools` for 5;
`registry.ts` (24) and `skillCategories.ts` (14) dominate the rest, all on small config
tables. A shape-only signature therefore needs a 90-entry allowlist — the rubber-stamp
outcome `boundedReads.ratchet.test.ts:31-34` explicitly warns against. Table-scoped, the
population for `events` is one: the defect itself. **This measurement is an approximate
regex scan, not an AST parse** — the planner should re-derive it with the AST scanner D-09
calls for and treat any disagreement as a finding about the regex.

**F-4 — the schema-derived growth rule misses one of this phase's own two defects.**
Classifying those 90 sites by whether their table carries a time-ish index in `schema.ts`
(control: 146 tables parsed, so the scan is live): only **12** sit on growth-shaped tables
(`events`, `sessions`, `subagentJobs`, `swarmTasks`, `tasks`, `anomalyEvents`,
`episodicEvents`, `dockerContainers`, `prompts`, `ideationFindings`); **78** are
config-shaped. **`discoveredTools` classifies as config-shaped** — its indexes are
`by_name`/`by_source`/`by_usage`, no time field (`schema.ts:185-187`) — so a purely
schema-derived list would not flag `metrics.ts:24`. `forgeLogChunks` lands in the same
bucket, which also looks wrong for a log table. D-10 resolves this with an explicit
additions list; the gap is recorded here so the additions list reads as a known
compensation, not an oversight.

</findings>

<decisions>
## Implementation Decisions

### Scope of the fix — what this phase repairs

- **D-01: Bound the reads AND fix the caller.** Both `metrics.ts:19` and `:24` become
  bounded, and the `cost_summary` field mismatch (F-2) is resolved in the same phase —
  either `dashboardSummary` supplies real cost/token figures or `cost_summary` stops
  claiming them (D-03 settles which). Rationale: the phase's success criteria are
  unobservable otherwise, and a confident zero fed to an LLM is worse than an error.

- **D-02: Correct FIX-01 in `.planning/REQUIREMENTS.md` in place, with a dated note.**
  FIX-01 currently reads "`/` (Dashboard) no longer reads the whole `events` table", which
  names a surface that never calls the query (F-1). Rewrite it to name the real consumer,
  with a dated correction note in the same style as the v14.0 roadmap line corrected at
  v16.0 scoping. Rationale: REQUIREMENTS.md is the artifact that closes this phase; a
  known-false claim must not survive in it. **This is a phase deliverable for a plan to
  execute — it was deliberately NOT edited during discussion.**

- **D-03: `cost_summary`'s `totalCost` / `totalTokens` come from the bounded `aggregates`
  rollup**, not from widening `dashboardSummary`. `analytics:tokenSunburst`
  (`convex/analytics.ts:57-86`) already reads the rollup through an index range and
  produces exactly these two figures via `sunburstFromAggregates`
  (`convex/analyticsRollupQueries.ts:142-189`). Reuse that read (or a small shared helper
  over it); do not invent a new scan. Rationale: already bounded, already the established
  Phase 121 analog, no new read cost, and nothing else wants those fields on
  `dashboardSummary`.

- **D-04: Prove the caller fix both structurally and by value.** Derive `executeTool`'s
  shape from the query's real return type so a missing or renamed field is a `tsc` error,
  AND add a unit test asserting `cost_summary` returns non-placeholder values against a
  fixture with known cost. Rationale: the type guard catches the class at authoring time;
  the value test catches a `?? 0` fallback reintroduced past the types. Neither alone is
  sufficient — a `?? 0` type-checks fine, and a test alone does not stop the next rename.

### Count semantics — what the bounded figures MEAN

- **D-05: Window `totalEvents`, heroStats-style, and rename the field to say so.** Use a
  range-bounded `by_timestamp2` read plus a `.take()` cap — the exact form proved cheap on
  this backend at `convex/heroStats.ts:43-47`, whose comment records the measurement
  (unbounded `take(500)` fails, `take(50)` works, the range-bounded form returns the same
  rows cheaply). An exact all-time count over 155k+ rows is the one thing that cannot be
  made cheap: an index cannot speed an unfiltered count, so the read must shrink, which
  means the number's meaning changes. **The field name must change with it** — a field
  still called `totalEvents` that counts one window is the same honesty defect as F-2 in a
  new place.

- **D-06: Share `TOOLS_COUNT_CAP` from one place.** Export the cap currently private to
  `convex/heroStats.ts:8` and use it for `metrics.ts:24` as well, so the two tool counts
  cannot drift apart and the saturate-rather-than-blank rationale
  (`heroStats.ts:89-101`) is written once. This is the one deliberate touch of
  `heroStats.ts` in this phase — an export, not a behaviour change.

- **D-07: Report truncation.** Return `truncated` / `rowsRead` alongside the figures,
  matching `llm:costByModel`'s payload contract and Phase 121's `console.warn` on a cap
  hit. Rationale: `heroStats` stays silent on saturation and argues a wrong-but-large
  number beats an unmounted React tree — but *this* consumer is an LLM that will state the
  figure to the operator as fact, so it needs to know the number is a floor. The divergence
  from heroStats is deliberate and should be commented as such at the read site.

### Ratchet signature (FIX-02)

- **D-08: Table-scoped, not shape-only.** The new signature flags a bare `.collect()` only
  on tables from a declared high-volume list. Grounds: F-3 — shape-only means a 90-entry
  allowlist and a ratchet nobody keeps; table-scoped means a population of one for
  `events`. This choice is what makes the guard survivable, and the reasoning belongs in
  the test file header alongside the existing "127 bare index reads" argument.

- **D-09: Parse with the TypeScript AST.** Use the TS compiler API (already a dependency)
  and walk real call chains, rather than extending the existing line-by-line regex.
  Rationale: a bare-collect chain spans lines, and a regex probe's negative result is a
  claim about the probe — the very failure mode that let this defect class hide. The AST
  scan is immune to formatting, comments, and strings that look like code.

- **D-10: The high-volume list is schema-derived PLUS an explicit additions list.** Base:
  tables carrying a time-ish index in `convex/schema.ts` (append-only, grows without
  bound), so a newly added growing table is covered the day it lands with no human step.
  Additions: growth-shaped tables the schema cannot reveal — at minimum `discoveredTools`
  and `forgeLogChunks` (F-4) — each pinned with a one-line reason. The additions list is a
  documented compensation for a known blind spot in the derivation, not a convenience.

- **D-11: The other 10 growth-shaped bare collects are allowlisted with reasons, not
  fixed.** `sessions` (`migrations.ts:182`), `subagentJobs`, `swarmTasks`, `tasks`,
  `anomalyEvents`, `episodicEvents`, `dockerContainers`, `prompts`, `ideationFindings` —
  pin each with a one-line reason so the ratchet ships green, the debt is visible and
  countable, and the population cannot grow. Several are near-certainly fine at today's row
  counts. Rationale: triaging them by measured row count is the todo's own instruction but
  is materially larger than this phase's filed scope.

### Guard family — where the guards live

- **D-12: Extend `convex/boundedReads.ratchet.test.ts` in place.** One file owns "reads
  that are not bounded", carrying the range-in-post-read-filter signature and the
  bare-collect signature side by side, each with its own controls and allowlist. Its header
  already documents what it deliberately does not flag; this closes that gap where the next
  reader will look for it. **The header must be updated** — leaving the "deliberately does
  not flag" paragraph unqualified after adding the signature would misdescribe the file.

- **D-13: New `convex/metricsDashboardBounded.test.ts` for the recorded-query
  assertions.** Follows the established `*Bounded.test.ts` naming beside its five siblings.
  Asserts on the recorded index + range + limit for both reads and on the D-07 truncation
  flag on both sides of the cap boundary — never on returned rows, because a surviving
  `.collect()` returns identical results on a small fixture and only the recorded limit
  discriminates.

- **D-14: Extract `makeRecordingDb` to a shared test helper, and use it in the new test.**
  It is currently defined **7 separate times** (`heroStats.test.ts`, `alertsCountBounded`,
  `automationCronSummaryBounded`, `bifrostListBounded`, `briefingsDigestBounded`,
  `messageRoutesBounded`, `inbox.test.ts`) — `alertsCountBounded.test.ts:27-29` documents
  why ("that file does not export it, so this is a copy, not an import"). This phase would
  otherwise add the 8th. Seven fakes of the same `ctx.db` can disagree about what "bounded"
  records. **Migrating the existing 7 is explicitly deferred** — create the helper, use it
  for the new test, file the migration.

- **D-15: Wire to `npm test` + CI only, not the pre-commit hook.** Same wiring as every
  other ratchet in `convex/`. `scripts/hooks/pre-commit` stays a single-purpose,
  predictable dead-surface check. Note for the planner: `npm test` must run the `unit` and
  `browser` vitest projects **sequentially** — CI's second step is `--project unit`, not a
  bare `vitest run`.

### Claude's Discretion

- The exact window for D-05 (one hour, as `heroStats` uses, versus 24 hours) and the
  replacement field names were not settled. Pick names that state the window
  (`eventsLastHour` over `totalEvents`), and prefer matching `heroStats`' hour unless the
  Insights use case demonstrably needs longer — in which case use the `aggregates` rollup
  rather than widening the raw scan.
- Whether the D-03 rollup read is a direct call to the existing query or a small extracted
  helper is left to the planner, subject to the dead-surface rule below.
- How the new ratchet proves it can fail — `scripts/check-dead-surface.mjs`'s `--self-test`
  flag versus a red/green mutation against the real `metrics.ts` — is the planner's call,
  but one of them is mandatory; a guard that cannot be shown to fire is indistinguishable
  from one never violated.

### Folded Todos

- **`.planning/todos/pending/unbounded-analytics-scans-timeout.md`** — its own frontmatter
  reads `resolves_phase: 129`, and Phase 128 already re-derived it and narrowed it to
  exactly `convex/metrics.ts:19` and `:24` (the other four queries it named are fixed).
  Folded on that evidence rather than by a separate confirmation. Its "traps recorded while
  diagnosing" section is required reading for the planner: the 4,096-READ limit, reproduce
  from the CLI before blaming the frontend, and a tile showing `0` where the query failed
  being a separate honesty bug — which is F-2, filed a week before it was found in code.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The code this phase changes
- `convex/metrics.ts` — `dashboardSummary` at `:16-34`; the two unbounded reads at `:19`
  and `:24`; the already-bounded `sessions` read at `:20-23` that is NOT in scope.
- `convex/insightsChat.ts` §`executeTool` — the `cost_summary` case at `:73-80`, the only
  caller, and the site of the F-2 field mismatch.
- `convex/boundedReads.ratchet.test.ts` — the ratchet being extended. Its header
  (`:1-35`) states what it deliberately does not flag and why; D-12 requires updating it.

### The in-repo analogs to copy, not reinvent
- `convex/heroStats.ts` — `:43-47` the range-bounded `events` read with the measurement in
  its comment; `:8` and `:89-102` the `TOOLS_COUNT_CAP` treatment of `discoveredTools`
  including the 361-rows-at-2026-07-20 figure and the saturate-not-blank argument.
- `convex/alertsCountBounded.test.ts` — the recorded-query pattern D-13 follows; its
  header states why results cannot discriminate a bounded read from an unbounded one.
- `convex/analytics.ts:57-86` + `convex/analyticsRollupQueries.ts:142-189` — the bounded
  `aggregates` read and the pure function producing `totalCost` / `totalTokens` for D-03.
- `convex/schema.ts` — `aggregates` at `:969` (`metric_type: "cost" | "events" | "errors"`)
  with `by_type_period_bucket` at `:992`; `discoveredTools` at `:175-187`; `events` indexes
  incl. `by_timestamp2` at `:44`.
- `scripts/check-dead-surface.mjs` — landed 2026-08-28. The freshest ratchet pattern here:
  a baseline that cannot silently rot (it fails when an entry becomes live or is deleted)
  and a `--self-test` flag that proves the check can fail.

### Status sources
- `.planning/REQUIREMENTS.md` — FIX-01 and FIX-02 verbatim; FIX-01 is corrected by D-02.
- `.planning/ROADMAP.md` §"Phase 129" — goal and the three success criteria.
- `.planning/todos/pending/unbounded-analytics-scans-timeout.md` — the folded todo, its
  Phase 128 re-derivation, and its three recorded traps.

### Governing rules
- `CLAUDE.md` §"Convex & Frontend Lessons" — `.filter()` runs after the read; a
  bounded-read guard must assert on the recorded query; an index cannot speed an unfiltered
  count; the 4,096-READ limit; `npm test` must run `unit` and `browser` sequentially; a
  `grep -c` acceptance criterion is satisfiable by rewording a comment — assert on the
  construct.
- `CLAUDE.md` §"Dead Surface" — added 2026-08-28. **A new query/mutation lands in the same
  commit as the code that calls it, or it does not land.** Directly constrains D-03 if the
  planner chooses a new exported helper. `npm run check:dead-surface` runs in the
  pre-commit hook on any commit touching `convex/`.
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — never bulk-operate on the live
  instance; `npx convex deploy` needs `--env-file`; `convex run --inline-query` is
  read-only, so a write path cannot be proven live without deploying throwaway code.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `heroStats.summary`'s range-bounded `events` read and `TOOLS_COUNT_CAP` — the literal
  shape D-05/D-06 adopt, with the backend measurement already recorded in its comments.
- `sunburstFromAggregates` (`analyticsRollupQueries.ts:142`) — a pure function already
  returning `{ totalCost, totalTokens }` from bounded buckets; the D-03 source.
- `makeRecordingDb` — 7 existing copies; D-14 extracts one shared version.
- `scripts/check-dead-surface.mjs` — its baseline-rot detection and `--self-test` flag are
  the patterns to borrow for the D-08 allowlist and the ratchet's own failure proof.

### Established Patterns
- Bounded-read guards assert on the recorded query (index + range + limit), never on
  returned rows — five `*Bounded.test.ts` files already do this.
- Bounded reads that can saturate report `truncated` / `rowsRead` and `console.warn` on a
  cap hit (`llm:costByModel`, Phase 121).
- Ratchets carry an allowlist with a per-entry reason, plus controls that must be non-zero
  so a probe matching nothing is caught rather than read as a clean bill of health.

### Integration Points
- `insightsChat.executeTool` is the only consumer boundary; nothing in `src/` reads
  `api.metrics` at all, so no frontend change is implied by this phase.
- `heroStats.ts` is touched once, for the D-06 export only. It runs on every page via
  `useHeroStats`, and a throw there unmounts the whole React tree — treat any change to it
  as higher-risk than its diff size suggests.

### Shared-checkout hazard (live at time of writing)
A concurrent session (astridr-repo Phase 197, cross-repo) is committing into this checkout
and had `convex/missions.ts`, `convex/runtimeIngest.ts` and `convex/_generated/api.d.ts`
**staged in the shared index** during this discussion. Its declared paths for later waves
include `convex/schema.ts`, `convex/missions.test.ts`, `src/pages/Missions.tsx`,
`src/lib/navRegistry.ts` and `src/App.tsx` — none of which this phase touches, so there is
no overlap. But executors here must stage by explicit path and check `git diff --stat`
against the intended edit size before staging (a PostToolUse formatter hook reformats whole
files on Edit/Write), and must not run `npx convex deploy`, which ships the whole working
tree including another session's uncommitted work.

</code_context>

<specifics>
## Specific Ideas

- The correction to FIX-01 should name `insightsChat`'s `cost_summary` as the real
  consumer and carry a dated note, mirroring how the v14.0 roadmap line was corrected at
  v16.0 scoping — not a silent rewrite.
- The ratchet's new signature should read as a peer of the existing one in the same file,
  with its own control assertions, rather than as an appendix to it.
- D-07's divergence from `heroStats`' deliberate silence on saturation should be commented
  at the read site, so a future reader does not "fix" the inconsistency.

</specifics>

<deferred>
## Deferred Ideas

- **Deduplicate the `activeSessions` read.** `metrics.ts:20-23` and `heroStats.ts:17-20`
  are byte-for-byte the same query. Consolidating belongs in a later cleanup phase — doing
  it here would put the every-page query in this phase's blast radius.
- **Migrate the existing 7 `makeRecordingDb` copies** to the D-14 shared helper. File as a
  todo; a 7-file test refactor does not belong inside a defect-fix phase.
- **Triage the other ~78 config-shaped bare collects by measured row count.** The folded
  todo's own instruction ("the triage key is the row count of the table being scanned"),
  deliberately not executed here.
- **`forgeLogChunks` bare `.collect()` (`forge.ts:1136`)** — surfaced by F-4 as a probable
  growth-shaped table misclassified by the schema heuristic. It gets ratchet coverage via
  D-10's additions list but is NOT fixed in this phase.

### Reviewed Todos (not folded)
- `a11y-02-widened-scan-42-route-backlog.md` — matched on the generic keywords
  route/phase/plan. Belongs to Phases 133/134.
- `test-isolation-full-suite-only-failures.md` — matched on test/full/phase. Belongs to
  Phases 136/137.
- `kg-answer-sync-glxy02-test-flake.md` — matched on test/phase. Belongs to Phase 136.

</deferred>

---

*Phase: 129-dashboard-unbounded-read-ratchet-coverage*
*Context gathered: 2026-08-28*
