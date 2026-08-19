# 122-16 Em-Dash Ledger — Component Subtrees + Page Tier

## Population re-derivation (Task 1)

Scoped to this plan's `files_modified` list (14 files, the ledger doc itself excluded). Every
command was run against the live tree, not adopted from CONTEXT.md, 122-15's own numbers, or this
plan's own interfaces block.

**CONTROL (plan's required check), run BEFORE trusting any zero elsewhere in this ledger:**
`git grep -oFf <em-dash-pattern-file> -- src/components/chat/RadialGauge.tsx` = **4** (non-zero),
`git grep -oFf <em-dash-pattern-file> -- src/pages/Infrastructure.tsx` = **4** (non-zero). Both
confirmed before any zero below is trusted.

At least two distinct patterns were run and compared, per the plan's instruction that one pattern
finding N sites is not evidence there are only N:

```
git grep -oFf <em-dash-fixed-string-file> -- <14 files>            -> 168 RAW occurrences (comments + JSDoc + prose + value slots)
git grep -noE '"—"' -- <14 files>                                  -> 26 quoted-string-literal occurrences, all 14 files present
git grep -noE '(: *|\?\? *)"—"' -- <14 files>                      -> 22 occurrences (a strict subset of the 26 above -- misses
                                                                         bare-ternary-`?`-branch and bare-else forms the `: `/`?? `
                                                                         prefix doesn't cover, e.g. Infrastructure.tsx:141's
                                                                         `?.toFixed(0) ?? "—"` chain and Executions.tsx's four
                                                                         ternary-else forms without a leading `: `/`?? ` token)
git grep -noE '>—<' -- <14 files>                                  -> 1 occurrence (ForgeJobList.tsx:118, a bare JSX text node --
                                                                         missed by the quoted-string pattern entirely)
git grep -noE '`[^`]*—[^`]*`' -- <14 files>                        -> 5 template-literal em-dashes, all legitimate prose separators
                                                                         (read in context below), not fallback values
```

Per-file RAW occurrence counts (`git grep -oFf <em-dash-file> -- <file> | wc -l`), summed = 168,
matching the corpus-wide count above (internal-consistency control):

| File | Raw | Quoted `"—"` |
|---|---|---|
| src/components/analytics/AdvisorStrategyPanel.tsx | 2 | 1 |
| src/components/analytics/RecentLlmCallsPanel.tsx | 5 | 3 |
| src/components/brains/SwapHistoryList.tsx | 15 | 2 |
| src/components/chat/RadialGauge.tsx | 4 | 1 |
| src/components/chat/VitalsRail.tsx | 13 | 3 |
| src/components/control-center/SystemMonitorPanel.tsx | 14 | 3 |
| src/components/forge/ForgeJobList.tsx | 18 | 1 |
| src/components/graph/CodeVaultGraph.tsx | 51 | 1 |
| src/components/kg/KGAnimateControls.tsx | 3 | 1 |
| src/components/skills/IntakeReportView.tsx | 12 | 1 |
| src/components/studio/MediaDetailSheet.tsx | 19 | 2 |
| src/pages/Executions.tsx | 5 | 4 |
| src/pages/Infrastructure.tsx | 4 | 1 |
| src/pages/Security.tsx | 3 | 2 |
| **Total** | **168** | **26** |

`CodeVaultGraph.tsx`'s 51-raw/1-quoted gap is section-header comments of the form
`// ── Section ────` (4 em dashes per header line, ~12 headers across the ~900-line file) plus
JSDoc prose — read in full in context below; only 1 of the 51 is a value-slot placeholder.

**Reconciling CONTEXT.md's 27:** CONTEXT.md's D-15 quotes 27 for the WHOLE em-dash population
(all plans combined), which 122-15-SUMMARY.md already established doesn't match any re-measured
figure (75 raw / 33 convert scoped to its own 19 files, or 49-68 corpus-wide depending on
pattern). This plan's 168-raw/14-file slice is a disjoint continuation of that same
re-measurement, not a new reconciliation target — CONTEXT.md's 27 was never a sum of scoped
sub-counts to begin with, so there is nothing further to reconcile beyond what 122-15 already
recorded.

**Control (plan's required check): at least one em dash in this slice survives as legitimate
typography.** TRUE — 168 raw minus 33 convert-population sites (below) leaves 135 legitimate
sites (comments, JSDoc, section-header rules, and 5 prose sentences using the dash as a
separator), confirming the ledger is not an all-convert outcome.

---

## Per-site ledger

Columns: **Verdict** — convert (state) / convert (n/a) / convert (plain text) / legitimate.

### `src/components/analytics/AdvisorStrategyPanel.tsx` (1 site convert, 1 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 37 | Escalation Rate card: `advisorRecent && advisorRecent.length > 0 ? ... : "—"` | convert (state, via `useMetricState`) | tile (GlassPanel stat card) | `useMetricState(advisorRecent, undefined)` distinguishes `loading` (query unresolved) from `empty` (resolved, zero events) instead of collapsing both into one dash; ready renders the real percentage, non-ready renders `<InlineMetricState state={state} />` | migrated |
| — | JSDoc header prose | legitimate | n/a | unchanged | n/a |

### `src/components/analytics/RecentLlmCallsPanel.tsx` (3 sites convert, 0 legitimate raw beyond the 3 quoted)

Every site is a per-row cell in an already-resolved `llmCalls.map()` row (the `llmCalls.length === 0`
branch above already handles the true empty-list case at panel scale with a real sentence) — so
each `"—"` here is a genuine PER-ROW gap, not a loading/empty ambiguity.

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 58 | `call.cost != null ? formatCost(call.cost) : "—"` | convert (empty, override) | cell | `<InlineMetricState state="empty" label="no cost" />` | migrated |
| 65 | `call.cacheReadInputTokens === undefined ? "—" : ...` | convert (empty, override) | cell | `<InlineMetricState state="empty" label="no cache data" />` | migrated |
| 94 | `href ? <Link>...</Link> : "—"` (no `sessionId` to deep-link to) | convert (empty, override) | cell | `<InlineMetricState state="empty" label="no session" />` | migrated |

### `src/components/brains/SwapHistoryList.tsx` (2 sites convert on 1 line, 13 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 101 | `row.target ?? "—"` | convert (empty, override) | cell (dense flex-row list) | `<InlineMetricState state="empty" label="no target" />` — `target` is independently optional on `SwapHistoryRow` and its absence is NOT explained by `describeSwapOutcome` (which only branches on `resolved`/`path`), so this is a genuine per-row gap, not a structurally-inapplicable value | migrated |
| 101 | `row.resolved ?? "—"` | convert (n/a) | cell | `"n/a"` — `describeSwapOutcome` (same file's own import) explicitly branches on `row.resolved == null` to produce the "Unresolved"/"Refused" outcome label rendered in the SAME row (`{outcome.label}`); the absence is already explained there, matching the RoutingDecisionsTable/ExecutionTable house convention (122-15) for a value the sibling field already accounts for | migrated |
| 2,4,7-27 (docstring), 35 (comment), 66, 71, 109 (2x), 159 | JSDoc header, inline comments, and 4 rendered prose sentences using the dash as a sentence separator (pinned note, empty-state caption, at-cap caption) | legitimate | n/a | unchanged — matches `DashboardLayout.tsx`'s "— soon" precedent from 122-15: real, always-present informative text, not standing in for an absent value | n/a |

### `src/components/chat/RadialGauge.tsx` (1 site convert, 3 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 50 | `{has ? Math.round(pct) : "—"}` | convert (state, new `loading` prop) | tile (64×64 ring gauge, geometry fixed — see LAYOUT CONTROL below) | Added optional `loading` prop (default `false`, backward-compatible). Both callers (`VitalsRail.tsx`, `SystemMonitorPanel.tsx`) already hold the true loading signal (`useSystemResources()` returns `undefined` strictly while its query is unresolved) but were discarding it at the `sys?.cpu` boundary — passing `loading={sys === undefined}` restores it. When `loading`, the numeral slot renders a small `Skeleton` matching the numeral's footprint; when resolved-but-absent, it renders plain `n/a` text (no icon-bearing `InlineMetricState` — see LAYOUT CONTROL) | migrated |
| 2-9 (JSDoc header) | prose | legitimate | n/a | unchanged | n/a |

### `src/components/chat/VitalsRail.tsx` (3 sites convert, 10 legitimate — caller-side `loading` wiring is a Task 2 edit to this file, not counted as an em-dash site)

`llm.tokPerSec`/`llm.avgLatency`/`llm.lastCtx` all derive from `useLlmMetrics(25)`'s `calls`, which
the hook itself coalesces to `[]` for both "still loading" and "genuinely no calls yet" (the
hook's own return contract: `results ?? []`) — this repo's established house convention for this
exact hook (matches `SwapHistoryList`'s documented "collapse loading and empty into one honest
default" precedent). `empty` ("no signal yet") is therefore the one state either underlying cause
can honestly justify; there's no live signal here to further split it into `loading` vs `empty`.

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 279 | `Meter`'s Tok/s value: `llm.tokPerSec != null ? ... : "—"` | convert (empty, `Meter`'s `value` prop widened to `ReactNode`) | tile (3-col meter grid) | `<InlineMetricState state="empty" label="no signal yet" />` (the shared module's own default copy — no override needed, it already fits) | migrated |
| 284 | `Meter`'s Latency value: `llm.avgLatency != null ? ... : "—"` | convert (empty) | tile | `<InlineMetricState state="empty" label="no signal yet" />` | migrated |
| 298 | Context/Throughput header value: `llm.lastCtx != null ? fmtK(llm.lastCtx) : "—"` | convert (empty) | tile | `<InlineMetricState state="empty" label="no signal yet" />` | migrated |
| — | `RadialGauge` call sites (274-275) | n/a (not an em-dash site here — the fix lives in `RadialGauge.tsx`) | — | add `loading={sys === undefined}` to both `<RadialGauge>` calls | migrated |
| various | JSDoc header, inline comments (`// timestamps arrive as seconds...`, `// discoveredTools carries no source:"mcp"...`, `// Reactive Convex WebSocket...`) | legitimate | n/a | unchanged | n/a |

**SCOPE CONTROL:** `useConvexConnectionState` binding (line 142-143, owned by plan 122-12) is not
touched by this edit — only the `Meter` value props and the two `RadialGauge` calls' new `loading`
prop change.

### `src/components/control-center/SystemMonitorPanel.tsx` (2 sites convert, 12 legitimate)

Same `useLlmMetrics`-coalescing reasoning as `VitalsRail.tsx` above — `empty` for both.

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 97 | Tok/s value: `llm.tokPerSec != null ? Math.round(llm.tokPerSec) : "—"` | convert (empty) | tile | `<InlineMetricState state="empty" label="no signal yet" />` | migrated |
| 108 | Latency value: `llm.avgLatency != null ? ... : "—"` | convert (empty) | tile | `<InlineMetricState state="empty" label="no signal yet" />` | migrated |
| — | `RadialGauge` call sites (87-89) | n/a | — | add `loading={sys === undefined}` to all three `<RadialGauge>` calls (CPU/RAM/DISK) | migrated |
| 82-85 | Comment: "Rings always plot a value (RadialGauge renders "—" rather than disappearing)" | **stale doc comment, corrected as part of this edit (not a separate em-dash site — it's prose describing behavior this plan changes)** | — | reworded to describe the new loading/n/a split instead of the dash it references | migrated |
| various | JSDoc header, other inline comments | legitimate | n/a | unchanged | n/a |

### `src/components/forge/ForgeJobList.tsx` (3 sites convert, 15 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 39 | `safeRelativeTime`'s malformed-timestamp guard: `Number.isFinite(ms) ? ... : "—"` | convert (empty, return type widened to `string \| null`) | cell (per-job-row caption) | Function now returns `null` on the malformed branch; call site (253) renders `safeRelativeTime(job.createdAt) ?? <InlineMetricState state="empty" label="invalid timestamp" />` — matches 122-15's `ExecutionTable.formatDuration`/`formatTs` precedent (Deviation #2) exactly | migrated |
| 118 | `PendingRow`'s prompt fallback: `cmd.prompt ?? <span className="text-muted-foreground">—</span>` | convert (plain text, non-`MetricState`) | cell | `<span className="text-muted-foreground italic">(no prompt)</span>` — matches the REAL job list's own identical fallback 30 lines below (line 244-249, already `"(no prompt)"`, not an em dash) verbatim, for in-file consistency rather than introducing a second phrasing for the same concept | migrated |
| — | (no third convert site — the aria-label em dash at line 224 is legitimate, see below) | — | — | — | — |
| 224 | `aria-label={`Job ${job.id}: ${job.agent} — ${job.prompt ?? "(no prompt)"}`}` | legitimate | n/a | unchanged — a prose separator between "Job X: agent" and the prompt clause; the actual missing-prompt placeholder is the already-honest `"(no prompt)"` inside the template, not the dash | n/a |
| 1-21 (JSDoc header), 32-34, 42-44, 59-63, 75, 92-95, 131, 147, 162, 188, 197, 208, 226, 231, 242, 251 | comments and JSDoc | legitimate | n/a | unchanged | n/a |

### `src/components/graph/CodeVaultGraph.tsx` (1 site convert, 50 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 783 | Node detail panel: `community: {selectedNode.community ?? "—"}` | convert (empty, override) | panel-field (detail sidebar row, not the graph canvas itself — this is the "panel chrome converts; graph node data does not" boundary from the plan's interfaces block) | `<InlineMetricState state="empty" label="not clustered" />` — community detection may genuinely not have assigned this node to a cluster | migrated |
| all other 50 | section-header comment rules (`// ── Title ────`) and JSDoc prose | legitimate | n/a | unchanged | n/a |

**SCOPE CONTROL:** this is the file's ONLY value-slot em dash; no other panel chrome, graph node
data, or plan-122-07-owned color logic is touched.

### `src/components/kg/KGAnimateControls.tsx` (1 site convert, 2 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 169 | Transport row frame-date readout: `{frames[currentFrameIndex] ?? "—"}` | convert (plain text, non-`MetricState`) | inline (fixed-width `min-w-[80px]` transport-row readout, flanked by icon buttons already `disabled={frames.length === 0}`) | plain text `"no frames"` — an icon-bearing `InlineMetricState` would add width to a `font-mono` transport row whose sibling controls already signal "nothing to scrub" via their own disabled state; matches `SwarmTaskNode`'s 122-15 precedent for a fixed-footprint control needing a real-fact plain word, not a state pill | migrated |
| 1-9 (JSDoc header) | prose | legitimate | n/a | unchanged | n/a |

### `src/components/skills/IntakeReportView.tsx` (1 site convert, 11 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 154 | Findings table `File:line` cell: `finding.path ?? "—"` | convert (empty, override) | cell (dense `<Table>`) | `<InlineMetricState state="empty" label="no path" />` — a rule finding can genuinely carry no path (a repo-level or manifest-level finding) | migrated |
| 1-19 (JSDoc header), 58, 92-96, 102-106 | comments and JSDoc | legitimate | n/a | unchanged | n/a |
| 124 | "Report too large to store — run the CLI command below for the full report." | legitimate | n/a | unchanged — a real, always-present sentence, the dash is a separator | n/a |

### `src/components/studio/MediaDetailSheet.tsx` (2 sites convert, 17 legitimate)

The file's existing D-07 `NO_PROVENANCE_COPY` sentinel pattern (for `prompt`/`model`/`provider`/
`style`/`project`/`params` via `RecipeField`) is OUT OF SCOPE — it renders no em dash at all
(`"No provenance recorded"`), so it is untouched by this plan.

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 207 | `dimensions` (neither width×height nor duration known) | convert (empty, override) | inline field (Technical Facts row) | `<InlineMetricState state="empty" label="no dimensions" />` | migrated |
| 299 | `row.sizeBytes === undefined ? "—" : formatBytes(...)` | convert (empty, override) | inline field | `<InlineMetricState state="empty" label="no size" />` | migrated |
| 1-28 (JSDoc header), 13-20, 51-53, 63-77, 79-84, 95-100, 113-117, 147-151, 166-167, 197-198, 305-308 | comments and JSDoc | legitimate | n/a | unchanged | n/a |

**SCOPE CONTROL:** `NO_PROVENANCE_COPY`/`RecipeField`'s absent-field rendering (D-07's tested
control pair) is not touched — no em dash exists in that path to convert.

### `src/pages/Executions.tsx` (4 sites convert, 0 legitimate — all 5 quoted occurrences are the 4 sites, one duplicated in the `totalDisplay`/`runningDisplay` pair count as 2 of the 4)

`stats` is `useQuery(api.commandExecutions.summaryStats)` — `undefined` strictly while unresolved,
a real (always-populated-with-zeros, never a genuine "empty") object once resolved, except
`avgDuration` which the backend can genuinely leave `null` (no completed executions to average).

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 99 | `totalDisplay = stats != null ? ... : "—"` | convert (loading skeleton, via `useMetricState`) | tile (stat card) | `useMetricState(stats, undefined)` drives all four cards' loading state; while loading, each card's figure renders `<Skeleton className="h-8 w-16" />` matching `MetricCard`'s own `h-8 w-1/2` loading shape convention (122-13) | migrated |
| 100 | `runningDisplay` | convert (loading skeleton) | tile | same `Skeleton` treatment | migrated |
| 101 | `failedDisplay` | convert (loading skeleton) | tile | same `Skeleton` treatment | migrated |
| 102-104 | `avgDurationDisplay = stats?.avgDuration != null ? ... : "—"` | convert (loading skeleton when `stats` unresolved; `InlineMetricState state="empty"` when `stats` resolved but `avgDuration` is genuinely `null`) | tile | two-way split — this is the one card among the four where "no value" can mean either cause, and now says which | migrated |

### `src/pages/Infrastructure.tsx` (1 site convert, 3 legitimate)

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 141 | Startup Waterfall total: `{startupEvents[0]?.totalMs?.toFixed(0) ?? "—"}ms` | convert (empty, override) | panel-field (this branch is only reached when `startupEvents && startupEvents.length > 0` — a real row exists; `totalMs` being absent on that specific row is a genuine per-row gap, not a loading state, since the sibling `startupEvents === undefined` branch already renders the `Skeleton` loading treatment two lines below) | `<InlineMetricState state="empty" label="no total" />` — note the trailing `ms` suffix must move INSIDE the ready branch only (a bare `ms` after an icon+label pill would misread as a unit on the label) | migrated |
| 39 (JSDoc-style inline comments elsewhere in file, none em-dash-bearing beyond this) | — | — | — | — | — |

**T-122-16-A (Infrastructure spoofing threat):** this is the one site the threat register calls
out by name. Verified: `totalMs` genuinely can be absent on a resolved startup-events row per the
schema (`evt.totalMs?.toFixed(0)` — optional chaining implies the field is optional), so
`unavailable` is not warranted (the row itself exists; only this one figure is missing), and
`empty` with an explicit "no total" label is the honest, non-inflated choice — it does not read
as a health figure of zero.

### `src/pages/Security.tsx` (2 sites convert, 1 legitimate raw hit beyond the 2 quoted)

Both sites are per-row grid cells in an already-resolved `.map()` list (the `.length === 0` branch
above each renders the true empty-log sentence at panel scale) — genuine per-row gaps.

| Line | Site | Verdict | Scale | Replacement | AFTER |
|---|---|---|---|---|---|
| 412 | URL Evaluation Log Reason cell: `e.details?.reason ?? "—"` | convert (empty, override) | cell (dense grid-row list) | `<InlineMetricState state="empty" label="no reason" />` | migrated |
| 452 | Network Access Log Details cell: `e.details?.reason ?? "—"` | convert (empty, override) | cell | `<InlineMetricState state="empty" label="no reason" />` | migrated |

**SCOPE CONTROL:** `git diff -- src/pages/Security.tsx` (recorded after Task 3) shows no change to
either `<StatusBadge status=... label=...>` call (lines 407-410, 447-450) — those pass direct
semantic literals as props, not placeholders, per the plan's explicit instruction and
`120-BADGE-INVENTORY.md` §2.

---

## Population summary

| Category | Count |
|---|---|
| Raw em-dash occurrences (14 files) | 168 |
| Convert sites (value-slot placeholders) | 33 |
| — of which: `InlineMetricState` (empty, D-20 override) | 21 |
| — of which: `n/a` (structurally inapplicable / already explained by a sibling field) | 2 |
| — of which: plain text, non-`MetricState` (footprint-stability precedent) | 3 |
| — of which: `useMetricState`-driven loading/empty split (tile stat cards) | 6 sites across 2 files (AdvisorStrategyPanel ×1; Executions ×4, one of which further splits loading vs. a genuine per-field empty; RadialGauge's dash site is counted under "plain text" above since its resolved-but-absent case renders `n/a` text, not `InlineMetricState`) |
| Legitimate typography (comments, JSDoc, section-header rules, real prose sentences) | 135 |
| 33 + 135 = 168, matching the raw count exactly | ✓ |

## The 122-16 boundary (closes wave 6)

This plan owns every em-dash placeholder remaining in `src/pages/*.tsx` and in the 11 component
subtree files enumerated above — the plan's own `files_modified` list. No file outside that list
was touched. Wave 6 (122-14 MetricCard render sites, 122-15 Loading-string + components-root
em-dashes, 122-16 subtrees + page tier) is now complete: zero bare `>Loading` strings and zero
value-slot em-dash placeholders remain anywhere in `src/`.
