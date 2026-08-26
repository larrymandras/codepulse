# 123-04: App-Shell Contrast Fix — Before/After

Measures `src/layouts/DashboardLayout.tsx`'s nine `text-*/NN` opacity-modifier deletions
(commit `3ccc43ad`) against the live 20-cell axe matrix (`e2e/theme-contrast.spec.ts`),
run against the pre-existing keyless `dev:noauth` server on `http://localhost:5181`
(reused per the executor's environment instructions — not started fresh).

Every count below is **re-derived by parsing `violations[].nodes.length` from the raw
capture JSON and bucketing by `id`/`target`**, never by grepping `"id"` — a naive
`grep -c '"id"'` over-counts because every per-node `any`/`all`/`none` check object also
carries an `"id"` field, which is why that approach returns 225 against a 209-node corpus.

## Command run

```bash
mkdir -p .planning/phases/123-accessibility-remediation/a11y-shell-fix
A11Y_MEASURE_ONLY=1 \
A11Y_CAPTURE_DIR=.planning/phases/123-accessibility-remediation/a11y-shell-fix \
PW_BASE_URL=http://localhost:5181 \
node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --reporter=list
```

Result: **20 passed, 0 failed, 0 skipped** (exit 0). Zero skipped cells confirms the run
hit the keyless server, not the Clerk-gated one (a skip would mean the sign-in screen was
scanned instead of the app — see `e2e/theme-contrast.spec.ts:63-78`). Per D-14, a green
`A11Y_MEASURE_ONLY=1` exit is today's correct, non-informative-by-design behaviour — plan
123-03 (wave 1, not yet executed) is what makes this mode assert something. 20 capture
JSON files were written to `a11y-shell-fix/`.

## Pre-123 control (re-derived this session, unit: objects / nodes)

Source: `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/*.json`
(the same 20 files the plan's control aggregate cites).

| Metric | Value |
|---|---|
| Total violation **objects** | 24 |
| Total violation **nodes** | 209 |
| `color-contrast` **objects** | 20 |
| `color-contrast` **nodes** | 205 |
| `aria-prohibited-attr` **objects** | 4 |
| `aria-prohibited-attr` **nodes** | 4 |

Confirms the plan's cited control aggregate (`24 objects / 209 nodes`) exactly.

## Post-123 result (this run, unit: objects / nodes)

| Metric | Value |
|---|---|
| Total violation **objects** | 9 |
| Total violation **nodes** | 9 |
| `color-contrast` **objects** | 5 |
| `color-contrast` **nodes** | 5 |
| `aria-prohibited-attr` **objects** | 4 |
| `aria-prohibited-attr` **nodes** | 4 |

**Must-differ control satisfied:** `aria-prohibited-attr` is unchanged at 4 objects / 4
nodes, pre and post. A probe that reported 0 for everything (i.e. one that couldn't
distinguish "the shell fix worked" from "the harness is broken") would have failed this
check. It didn't — the ARIA family plan 123-06 owns is untouched by this plan, exactly as
intended.

## Per-theme, per-page table (unit: `color-contrast` objects / nodes)

| Theme | Page | Pre-123 objects | Pre-123 nodes | Post-123 objects | Post-123 nodes |
|---|---|---|---|---|---|
| cyan | Dashboard | 1 | 3 | 0 | 0 |
| cyan | LiveRun | 1 | 4 | 1 | 1 |
| cyan | Analytics | 1 | 3 | 0 | 0 |
| cyan | Forge | 1 | 3 | 0 | 0 |
| cyan | Graphs | 1 | 4 | 1 | 1 |
| emerald | Dashboard | 1 | 3 | 0 | 0 |
| emerald | LiveRun | 1 | 4 | 1 | 1 |
| emerald | Analytics | 1 | 3 | 0 | 0 |
| emerald | Forge | 1 | 3 | 0 | 0 |
| emerald | Graphs | 1 | 4 | 1 | 1 |
| readable | Dashboard | 1 | 16 | 0 | 0 |
| readable | LiveRun | 1 | 15 | 0 | 0 |
| readable | Analytics | 1 | 16 | 0 | 0 |
| readable | Forge | 1 | 15 | 0 | 0 |
| readable | Graphs | 1 | 15 | 0 | 0 |
| aubergine | Dashboard | 1 | 19 | 0 | 0 |
| aubergine | LiveRun | 1 | 19 | 0 | 0 |
| aubergine | Analytics | 1 | 19 | 0 | 0 |
| aubergine | Forge | 1 | 18 | 0 | 0 |
| aubergine | Graphs | 1 | 19 | 1 | 1 |
| **Total** | | **20** | **205** | **5** | **5** |

Per-theme pre-123 `color-contrast` node totals: cyan 17, emerald 17, readable 77,
aubergine 94 (sums to 205). `readable` carried 77 of the 205 pre-123 color-contrast
nodes — close to, not identical to, the 78-of-209 figure quoted in STATE.md's narrative,
because that figure was counted against the 209-node ALL-violation-types total, not the
205-node color-contrast-only total re-derived here; both are correct, they answer
slightly different questions, and the unit is stated so neither is mistaken for the
other.

## App-shell `color-contrast` node count: 0

Bucketing the 5 surviving `color-contrast` nodes by `target` selector:

| Target selector | Node count | Source |
|---|---|---|
| `.text-primary\/70.text-base` | 3 (cyan, emerald, aubergine — all on `/graphs`) | `src/components/graph/CodeVaultGraph.tsx:892` |
| `.text-\(--muted-foreground\)` | 2 (cyan, emerald — both on `/live-run`) | `src/components/RunTimeline.tsx:81` |

Neither selector matches any DashboardLayout shell class (`NavGroup`, `SidebarContent`,
the header cluster, or the SYS:/LAT: badge). **App-shell `color-contrast` nodes: 0**,
across all 20 cells, all four themes. D-01/D-04's objective for this plan is met.

## SYS:/LAT: badge — measured node count in this run: 0, ex-badge column retired

`DashboardLayout.tsx:606-621`'s SYS:/LAT: runtime badge (`text-primary/60` container,
`text-primary/80` on the Cpu and Server icons) is one of the nine sites this plan's
Task 1 deleted the opacity modifier from. Its measured `color-contrast` node count in
this run is **0** — it does not appear in the target-selector bucket table above, on any
of the 20 cells.

`122-CONTRAST-BASELINE.md` carried a dedicated **ex-badge column** because the badge's
node count swung 5→26 across four independent Phase 122 capture sessions with zero code
change (gated on `showSys || showLat`, both of which depend on live backend data —
`systemResources` query results and WS round-trip latency — arriving before the axe scan
runs). That column existed to stop a live-data timing race from being misread as a
regression, because 122 was comparing *deltas* between captures.

**That column is retired as of this plan.** 123's target is zero, not a delta: a cell
either has `color-contrast` violations or it does not, and now that the badge's own
opacity modifiers are gone, a rendered badge and an unrendered badge both contribute
zero nodes — full-opacity `text-primary` clears AA whether or not the query resolved in
time for the scan to see it. The confound is dissolved by the fix, not excluded by a
bookkeeping column. Reproducibility of the badge's render timing no longer matters to
this phase's pass/fail criterion.

## D-15's residual rule (verbatim, applied)

> Any OTHER intermittently-failing cell is a real finding, never written off as noise.

One applies here, and it is reported rather than absorbed:

**The measured residual (5 nodes) is one node short of the 6 nodes 123-05-PLAN.md
predicts it will own** (`cyan`/`emerald`/`aubergine` × 2 selectors = 6; this run measured
`cyan`/`emerald` × 2 selectors + `aubergine` × 1 selector = 5). The missing node is
`aubergine__LiveRun`'s `.text-\(--muted-foreground\)` (`RunTimeline.tsx:81`, the
"Thinking..." indicator). Reading `RunTimeline.tsx:78-85`, that `<div>` is gated on
`showThinking = streaming && blocks.length === 0` — it only renders while a run is
actively streaming with no blocks yet, a live/timing-dependent condition, not a
theme-dependent one. In this run it rendered during the `cyan` and `emerald` `/live-run`
captures and did not render during the `readable` and `aubergine` `/live-run` captures
(confirmed via each capture's `violations[].nodes[].html`, which shows the exact
`Thinking...` markup for the two cells that flagged it). This is the same class of
render-timing non-determinism the ex-badge column existed to name, applied to a
different element that plan 123-05 (not this plan) owns fixing. It is recorded here so
123-05 measures its own before-fixing baseline live rather than trusting either this
run's 5 or its own plan text's 6 — both are one-shot captures of a timing-dependent
element, and the actual population it must clear is "whenever `showThinking` is true,"
not a fixed per-theme count.

No other residual `color-contrast` nodes were found; the ARIA family (D-06, plan 123-06)
is confirmed unchanged at 4/4.

## D-10's bar: one AA threshold, all four themes, no carve-out

| Theme | Pre-123 shell-attributable nodes (of 205 total) | Post-123 shell-attributable nodes |
|---|---|---|
| cyan | 17 | 0 |
| emerald | 17 | 0 |
| readable | 77 | 0 |
| aubergine | 94 | 0 |

`readable` — the theme this phase holds to the same AA bar as the other three, with no
AAA carve-out and no separate pass/fail rule — reaches 0 app-shell `color-contrast`
nodes in this run, identically to `cyan`, `emerald` and `aubergine`. `readable` also
carries zero instances of either residual (123-05-owned) violator, so its total across
all five pages in this run is 0/0, not merely 0-shell-plus-some-residual like the other
three.
