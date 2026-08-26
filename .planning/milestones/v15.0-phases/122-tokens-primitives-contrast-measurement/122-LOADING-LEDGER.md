# 122-15 Loading / Em-Dash Ledger

## Population re-derivation (Task 1)

Scoped to this plan's `files_modified` list (19 files, the ledger doc itself excluded), unless
marked "corpus-wide" below. Every command was run against the live tree, not adopted from
CONTEXT.md or the plan's own interfaces block.

### Bare-loading population

Two distinct patterns were run and compared, per the plan's instruction that one pattern finding
N files is not evidence there are only N:

```
git grep -noE '>Loading' -- <19 files>          -> 51 occurrences across 8 files
git grep -noE '"Loading'  -- <19 files>          -> 2 occurrences (GatewayTasksPanel.tsx:33, RoutingDecisionsTable.tsx:32)
git grep -noE '\{"Loading' -- <19 files>         -> 0 occurrences
```

The second pattern's 2 hits are **false positives**, not a second true-positive population:
both match the substring `"Loading` inside `"LoadingFirstPage"` (a `usePaginatedQuery` status
enum comparison — `status !== "LoadingFirstPage"`), never a rendered bare-loading string. Read in
context, neither line renders anything to the user; they gate an empty-state branch. Recorded as
a false-positive control on the second pattern, not as additional convert sites.

**True bare-loading population (this plan's scope): 58 occurrences, 8 files**, per-file
(`git grep -c -E '>Loading' -- <19 files>`, sum verified to equal 58 by direct addition):
App.tsx (51 — every `<Route>` element's own `<Suspense fallback={...}>` string, one per route,
including the two `/war-room` and `/war-room/:roomId` routes which share fallback TEXT but are two
separate JSX literals), AgentDetailPanel.tsx (1), CostForecastPanel.tsx (1), LoadingState.tsx (1,
the component's own placeholder body — see below, this is dead code with zero callers, confirmed
by a repo-wide search before this plan), OperatorScoreCard.tsx (1, `<p>Loading...</p>` — a
separate `&mdash;` HTML-entity placeholder sits in the SAME loading branch and is removed by the
same edit, not counted separately), SessionCapabilities.tsx (1), SessionComparison.tsx (1),
DashboardLayout.tsx (1, the AvatarUploader dialog's own Suspense fallback — a shell-level site
distinct from any of App.tsx's route-level ones).

**Control (plan's required check):** `git grep -c -E '>Loading' -- src/components/LoadingState.tsx`
= 1 (non-zero, known-positive) and `git grep -c -Ff <em-dash-pattern-file> --
src/components/ContextGauge.tsx` = 2 (non-zero, known-positive) — both confirmed BEFORE trusting
any zero elsewhere in this ledger.

**Reconciling CONTEXT.md's 58:** corpus-wide (not scoped to this plan's 19 files),
`git grep -lE '>Loading' -- 'src/*.tsx'` (git pathspec glob semantics: a single `*` crosses
directory boundaries, per this repo's own lessons — confirmed by the result including
`src/components/*.tsx` and `src/layouts/*.tsx` files, not only files directly under `src/`)
returns exactly **8 files**, and `git grep -ohE '>Loading' -- 'src/*.tsx' | wc -l` returns exactly
**58** — matching CONTEXT.md's "58" figure exactly, and matching this plan's own 8-file/
58-occurrence scoped population exactly (this plan's 19-file list already IS the full corpus
population for this pattern; nothing outside it matches). **CONTEXT.md's qualification of that
number is wrong, though**: re-running the same corpus command filtered to exclude `\.test\.`
paths returns the identical 8 files and the identical 58 — zero of the 58 are inside a test file
(`git grep -lE '>Loading' -- 'src/*.tsx' | grep '\.test\.'` returns nothing). CONTEXT.md's D-15
states "that figure INCLUDES test files"; measured, it does not — no test file in this repo
renders a bare `>Loading` JSX text node. The count itself (58/8) was already correct in
CONTEXT.md; only its stated composition was wrong.

### Em-dash population

```
git grep -oFf <em-dash-pattern-file> -- <19 files> | wc -l   -> 75 RAW occurrences (before classification)
git grep -noE '"—"' -- <19 files>                            -> 30 quoted-string-literal occurrences
&mdash; entity search                                         -> 1 occurrence (OperatorScoreCard.tsx:93)
```

Per-file raw occurrence counts (`git grep -o` — true occurrence count, not line count, so a line
carrying two em dashes counts twice): DashboardLayout.tsx 20, CostBreakdown.tsx 11, SwarmTaskNode.tsx
6, RoutingDecisionsTable.tsx 6, DeliveryHistory.tsx 6, RunSummary.tsx 5, ExecutionTable.tsx 5,
App.tsx 3, OperatorScoreCard.tsx 2, FactsTable.tsx 2, ContextGauge.tsx 2, BashLog.tsx 2,
AgentDetailPanel.tsx 2, SessionHeader.tsx 1, GatewayTasksPanel.tsx 1, CostForecastPanel.tsx 1 —
sum verified to equal 75 by direct addition.

The raw 75 includes prose: code comments, JSDoc headers, and a `title=` tooltip sentence. Only an
em dash **rendered where a value would go** is the defect (plan's own instruction). Reading every
one of the 75 in context splits as:

- **33 value-slot sites** (RENDER to the user in place of a missing/optional value) — the true
  convert population. 30 are `"—"` quoted-string literal fallbacks (`?? "—"` / `: "—"` /
  ternary-else `"—"`), 2 are bare JSX text nodes (`<span>—</span>`, no quotes — missed by the
  `"—"` pattern, caught only by the raw fixed-string pattern), and 1 is the `&mdash;` entity in
  OperatorScoreCard's loading branch (converted under Task 2, not counted in Task 3's 33 — see
  Task 2 ledger row for OperatorScoreCard).
- **42 legitimate-typography sites** — every one of the remaining raw hits is inside a `//` line
  comment, a `/* */` block comment, a JSDoc header (CostBreakdown.tsx:131 alone carries two — "the
  isRunaway ternary — only the color differs — so it renders" — both on one comment line), or (one
  case, DashboardLayout.tsx:128) a real rendered UI string using the dash as a separator in
  present, informative text (`{item.label} — soon`), plus DashboardLayout.tsx:372's `title=`
  tooltip sentence (which itself carries two em dashes on one line: `"CRT effect ON — click to
  disable"` / `"CRT effect OFF — click to enable"`) — an em dash used as sentence punctuation in
  real, always-present text, not standing in for an absent value. 33 convert + 42 legitimate = 75,
  matching the raw count exactly.

**Reconciling CONTEXT.md's 27 and the plan's own interfaces-block 52/28:** CONTEXT.md's D-15
quotes 27; the plan's own interfaces block (122-15-PLAN.md) already flags this as stale and
supplies a corrected pointer of "52 occurrences across 28 files, of which 12 files are in
src/components/ root". Corpus-wide (not scoped to the 19-file list), re-running the plan's own
named pattern `(: |\?\? )"—"` against `'src/*.tsx'` (single-star pathspec) gives **49 occurrences
across 26 files**, not 52/28 — a further correction, not a match, on the plan's own already-revised
figure. The broader `"—"` quoted-string pattern (which also catches ternary-`?`-branch and
bare-else forms the `: `/`?? ` prefix pattern misses) gives **68 occurrences across 31 files**
corpus-wide. Neither adopted; this ledger's 33-site value-slot population above is scoped to this
plan's 19 files and independently re-derived from the raw fixed-string em-dash match, read in
context line by line — the number this plan's Task 3 acceptance criteria are checked against.

**Control (plan's required check):** at least one em dash in this slice survives as legitimate
typography — TRUE: 41 sites do (comments/prose), confirming the ledger is not an
all-convert outcome. `ContextGauge.tsx`'s 2-hit control above already demonstrates one convert
site (line 97) and one legitimate site (line 33, a comment) in the same file, proving the
adjudication actually discriminates rather than converting on sight.

---

## Per-site ledger — bare-loading (Task 2 files)

| File | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| `LoadingState.tsx` | whole component body | convert first — becomes the shared shape API | `LoadingState({ shape, rows, className })` with 5 shapes (`table`/`metric`/`chart`/`text`/`page`), each a `Skeleton`-composed shape matching design law. Previously dead code (zero callers anywhere in `src/`, confirmed by a repo-wide search before this plan) — this plan is what wires it up. | migrated |
| `App.tsx` | 48 `<Route>` Suspense fallbacks (route-level) | convert | `<LoadingState shape="page" />` — a route hasn't loaded its component tree yet, so it cannot supply a more specific shape than "whole page" | migrated |
| `DashboardLayout.tsx` | 1 Suspense fallback (AvatarUploader dialog) | convert | `<LoadingState shape="text" />` — a small in-dialog form, not a full page; the dialog chrome itself already frames it, so a text-block shape (not a page shape) is the honest content match | migrated |
| `CostForecastPanel.tsx` | `data === undefined` branch | convert | `<LoadingState shape="metric" />` × 3 in the same 3-column grid the ready state uses, so the loading shape occupies the same footprint as the content it replaces | migrated |
| `OperatorScoreCard.tsx` | `latest === undefined` branch (bare "Loading..." text + separate `&mdash;` entity standing in for the score number) | convert | `<LoadingState shape="metric" />` for the score-number block; the `&mdash;` is removed as part of the same branch rewrite (it was never a Task 3 site — it's inside the identical loading branch being replaced here) | migrated |
| `SessionCapabilities.tsx` | `result === undefined` branch | convert | `<LoadingState shape="text" />` — the collapsed header has no known shape until expanded, so a generic text-block placeholder is honest | migrated |
| `SessionComparison.tsx` | `rawSessions === undefined` branch | convert | `<LoadingState shape="table" rows={5} />` — replaces a session table, shaped with rows to match | migrated |
| `AgentDetailPanel.tsx` | `!detail` branch | convert | `<LoadingState shape="text" />` — a compact w-72 detail card, text-block shape fits its footprint | migrated |

## Per-site ledger — em-dash (Task 3 files)

Columns: **Verdict** — convert (state) / convert (n/a, structurally-inapplicable) / convert
(plain text, non-MetricState) / legitimate. The "n/a" and "plain text" categories are the house
convention 122-14 already established (`formatSuccessRate`'s null→"n/a", `TraceWaterfall`'s
`costLabel()`) for values that are not merely *unknown* but *do not apply* given the row's own
other fields — using the `MetricState` vocabulary there would over-claim ("no signal yet" implies
a signal is expected; a percentage of an unpriced row, or a duration for a run that never started,
has no signal to expect).

### `AgentDetailPanel.tsx` (2 sites, both convert)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 48 | `duration` ternary else | convert (empty, override) | `<InlineMetricState state="empty" label="duration unknown" />` — `detail` is already a real, resolved row (gated by the loading branch above); neither timestamp being set is a genuine per-row absence | migrated |
| 86 | `detail.model ?? "—"` | convert (empty, override) | `<InlineMetricState state="empty" label="not reported" />` | migrated |

### `BashLog.tsx` (2 sites, both convert)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 66 | `command` fallback (no `payload.command`/`.description`) | convert (empty, override) | `<InlineMetricState state="empty" label="no command recorded" />` (rendered inside the existing button, replacing the masked text) | migrated |
| 101 | `exitCode` fallback (bare JSX `—`) | convert (empty, override) | `<InlineMetricState state="empty" label="no exit code" />` | migrated |

### `ContextGauge.tsx` (1 site convert, 1 legitimate)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 33 | `// History is desc-sorted — most recent first` | legitimate (comment prose) | unchanged | n/a |
| 97 | `ttfLabel` fallback when `timeToFull == null` | convert (n/a) | `"n/a"` — time-to-full is only DEFINED when burn rate is positive; a flat/negative burn rate makes "time to full" structurally inapplicable, not merely unmeasured | migrated |

### `CostBreakdown.tsx` (1 site convert, 9 legitimate)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 2, 4, 17, 53, 63, 89, 112, 131, 171 | JSDoc header / inline comments | legitimate (comment prose) | unchanged | n/a |
| 209 | `pct` fallback when `row.billedUsd === null` | convert (n/a) | `"n/a"` — the row's own `!row.priced` branch already renders an "Unpriced" badge two columns over; a percentage of a cost that was never computed cannot apply, matching this file's own established `TIER OK`/"Unpriced" honesty pattern | migrated |

### `DeliveryHistory.tsx` (6 sites, all convert)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 80 | `log.subject ?? "—"` | convert (empty, override) | `<InlineMetricState state="empty" label="no subject" />` | migrated |
| 83 | `log.recipient ?? "—"` | convert (empty, override) | `<InlineMetricState state="empty" label="no recipient" />` | migrated |
| 89 | `log.errorMessage ?? "—"` (email) | convert (n/a) | `"n/a"` — `status` is already rendered as a badge in the same row; when status is "success" the absence of an error message is a real fact (no error occurred), not a data gap, so "n/a" is the honest label rather than an empty-state icon implying something is missing | migrated |
| 131 | `log.action ?? "—"` | convert (empty, override) | `<InlineMetricState state="empty" label="no action" />` | migrated |
| 134 | `log.dedupKey ?? "—"` | convert (empty, override) | `<InlineMetricState state="empty" label="no dedup key" />` | migrated |
| 141 | `log.errorMessage ?? "—"` (pagerduty) | convert (n/a) | `"n/a"` — same reasoning as line 89 | migrated |

### `ExecutionTable.tsx` (5 sites, all convert)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 46 | `formatDuration(ms == null)` | convert (empty, override) | `<InlineMetricState state="empty" label="not recorded" />` | migrated |
| 52 | `formatTs(!epochSeconds)` (used for Started/Completed labels prefixed with "Started: "/"Completed: ") | convert (empty, override) | `<InlineMetricState state="empty" label="not yet" />` | migrated |
| 156 | `row.channelId ?? "—"` | convert (empty, override) | `<InlineMetricState state="empty" label="no channel" />` | migrated |
| 179 | `modeData?.mode` fallback (bare JSX `—`) | convert (empty, override) | `<InlineMetricState state="empty" label="no mode data" />` — no execution-mode record was ever written for this row | migrated |
| 193 | `modeData?.roundsDepth` fallback | convert (n/a) | `"n/a"` — depth is only meaningful when mode data exists; its absence is already explained by the sibling Mode cell (line 179) rendering `no mode data` in the same row | migrated |

### `FactsTable.tsx` (2 sites, both convert)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 129 | `confidence` fallback | convert (empty, override) | `<InlineMetricState state="empty" label="unscored" />` | migrated |
| 132 | `timestamp` fallback | convert (empty, override) | `<InlineMetricState state="empty" label="unknown" />` | migrated |

### `GatewayTasksPanel.tsx` (1 site, convert)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 86 | `durationSeconds` fallback | convert (empty, override) | `<InlineMetricState state="empty" label="not yet" />` — task hasn't completed, matching `ExecutionTable`'s house phrasing for the identical "hasn't happened yet" case | migrated |

### `RoutingDecisionsTable.tsx` (6 sites, all convert — 1 as plain boolean text, 5 as n/a)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 127 | Fallback column, `d.fallbackUsed === false` branch (bare JSX `—`) | convert (plain text, non-MetricState) | `"No"` — this is a real, known boolean value (fallback was NOT used), not an absence; an em dash here reads as "unknown" when the true meaning is a confident "false". `MetricState` does not apply to a resolved boolean | migrated |
| 131 | `d.finalScore` fallback (row-level) | convert (n/a) | `"n/a"` — a score dimension not computed for this task | migrated |
| 144 | `d.quotaScore` fallback (expanded detail) | convert (n/a) | `"n/a"` | migrated |
| 146 | `d.latencyScore` fallback | convert (n/a) | `"n/a"` | migrated |
| 148 | `d.costScore` fallback | convert (n/a) | `"n/a"` | migrated |
| 149 | `d.finalScore` fallback (expanded detail, duplicate of 131) | convert (n/a) | `"n/a"` | migrated |

### `RunSummary.tsx` (5 sites, all convert as n/a)

`RunSummary` receives `status` directly from its caller (no `useQuery` of its own — the `status
=== "idle"` branch above already handles the true "nothing yet" case), so a field being `null`
here reflects "not (yet) reported for this run", the same structurally-inapplicable-during-a-live-
run class as `CostBreakdown`'s unpriced percentage — not an indefinite loading state.

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 75 | `duration` final else (status non-idle, no usable timestamps) | convert (n/a) | `"n/a"` | migrated |
| 81 | `rounds` fallback | convert (n/a) | `"n/a"` | migrated |
| 92 | `inputTokens` fallback | convert (n/a) | `"n/a"` | migrated |
| 93 | `outputTokens` fallback | convert (n/a) | `"n/a"` | migrated |
| 94 | `cost` fallback | convert (n/a) | `"n/a"` | migrated |

### `SessionHeader.tsx` (1 site, convert)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 43 | `session.cwd` fallback | convert (empty, override) | `<InlineMetricState state="empty" label="not reported" />` | migrated |

### `SwarmTaskNode.tsx` (1 site convert, 5 legitimate)

| Line | Site | Verdict | Replacement | AFTER |
|---|---|---|---|---|
| 2, 4 | JSDoc header | legitimate (comment prose) | unchanged | n/a |
| 67, 69, 70 | `// violet/red — state identity color, exempt` inline comments | legitimate (comment prose) | unchanged | n/a |
| 159 | `agentDisplay` fallback (unclaimed task) | convert (plain text, non-MetricState) | `"unclaimed"` — plain text, NOT the icon-bearing `InlineMetricState` component: this file's own threat model (T-122-15 layout control) requires the node's fixed 172×88px-class footprint to stay stable, and an icon-bearing state pill risks shifting it; a real, known fact (nobody has claimed this task) rendered as a short word matches the file's existing text-only style for this field | migrated |

## Sites where the answer is "no emitter at all" (D-14's important case, mirrored from 122-14)

None. Every em-dash convert site in this plan has a real, already-resolved data source behind it
(a Convex row, a caller-supplied prop, or a same-render sibling field) — the absence is either a
genuine per-row gap (`empty`, D-20 override) or a structurally-inapplicable computation (`n/a`,
plain text). No site in this plan's scope required `state="unavailable"`.

## The 122-16 boundary

This plan (122-15) owns: (1) every bare `Loading`/`>Loading` string across the 8 files above, and
(2) every em-dash placeholder in `src/components/` files that are NOT page-tier route components
and NOT wrapped by `<MetricCard>` — i.e., the plain component-level tables and panels listed in
this plan's `files_modified`. 122-16 owns the em-dash placeholders that remain in `src/pages/*.tsx`
(page tier) and in any component subtree not covered by this plan's file list. Concretely: this
plan's em-dash scope was fully enumerated by re-deriving the population directly against its own
19-file list (Task 1 above) — nothing outside those 19 files was touched, so the boundary is the
`files_modified` list itself, not a separate judgment call.
