# 122 — A11Y-01 Contrast Baseline

Raw per-cell axe violation JSON committed alongside this file at `a11y-before/*.json` (20 files,
one per theme x page cell). This document is derived from those files; every number below was
re-computed from the committed JSON, not transcribed from a test log or from an earlier
measurement.

## BEFORE (control, measured 2026-08-18, git `7b74a7fe` -- pre-token-layer)

Measured against `dev:noauth` (`:5181`, Clerk gate disabled) via
`A11Y_CAPTURE_DIR=... A11Y_MEASURE_ONLY=1 PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts`,
issued from Git Bash. 20/20 cells measured, zero skipped.

**Unit: these are axe VIOLATION OBJECTS (one per distinct rule that fired on a page), not
violating ELEMENTS.** A single violation object commonly covers several DOM nodes -- e.g.
`[cyan] Dashboard`'s one `color-contrast` object covers 4 sidebar/header elements. Where an
element count is useful it is given separately below, labelled `nodes`, derived as the sum of
`violations[].nodes.length` per cell -- never added to the violation-object count.

### Violation objects per cell

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 1 | 1 | 1 | 2 | 1 | **6** |
| emerald | 1 | 1 | 1 | 2 | 1 | **6** |
| readable | 1 | 1 | 1 | 2 | 1 | **6** |
| aubergine | 1 | 1 | 1 | 2 | 1 | **6** |
| **column total** | **4** | **4** | **4** | **8** | **4** | **grand total: 24** |

Grand total re-derived independently two ways -- summing `violationCount` across the 20 committed
JSON files (`24`), and summing the two rule buckets in the breakdown below (`20 + 4 = 24`) -- both
agree.

### Affected elements (nodes), same cells, different unit

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 4 | ~ | ~ | ~ | ~ | see per-file JSON |
| all 20 cells, summed | | | | | | **218 nodes** |

`[cyan] Dashboard` alone: **4 nodes** across its 1 violation object. This is the same cell the
2026-08-10 sample in `SEED-006-wcag-contrast-remediation.md` reported at **234** -- same rule
(`color-contrast`), same `fgColor`/`bgColor` pair (`#067082` on `#060608`), same affected
component (the sidebar nav). The 234 figure was a NODE count taken before Phase 120's quiet-badge
and contrast work landed; this run's 4-node figure is the same measurement point, after. Addressed
explicitly per D-24's own instruction not to let this look like a coincidence: it is not a
coincidence, it is the same violation shrinking by two orders of magnitude, consistent with
`120-DESIGN-REVIEW-HANDOFF.md`'s independently-measured finding that "the quiet-badge law improved
contrast on every badge it touched." The grand total this run measures (24 violation objects / 218
nodes) is **not** "234" and should not be read as confirming or contradicting that figure --
they are different units from different points in time on different (though overlapping) surfaces.

## Rule breakdown (before)

Grouped by axe rule `id` across all 20 cells:

| rule id | impact | violation objects | affected nodes | what it is |
|---|---|---|---|---|
| `color-contrast` | serious | 20 | 214 | Foreground/background contrast below the WCAG AA threshold. Fires once per theme x page in all 20 cells; the sample element (sidebar nav labels, header pills) repeats across pages because it is shared app-shell chrome, not per-page content. |
| `aria-prohibited-attr` | serious | 4 | 4 | `[Forge]` only, all 4 themes. A loading-state `<div aria-busy="true" aria-label="Loading jobs">` -- `aria-label` is not a permitted attribute on a plain `div` with no ARIA role. Unrelated to the token/colour work; a markup fix (add a role or move the label), not a palette fix. |

Both rules are `impact: serious`; zero `critical`/`moderate`/`minor` violations were reported in
this run.

## Sampling limit (D-24)

A11Y-01's locked matrix measures **5 of 47** source page files in `src/pages/` (**5/47 ≈ 10.6%**).

**Re-derived a second time, at AFTER-measurement time (2026-08-19), rather than reused from plan
122-01:** `ls src/pages/*.tsx | grep -v '\.test\.' | wc -l` → 42 (unchanged), `ls
src/pages/*/*.tsx | grep -v '\.test\.' | wc -l` → 5 (unchanged), control glob including tests → 62
(unchanged, still not used). No page files were added or removed between the BEFORE and AFTER
captures, so the denominator, the 5 measured routes and the 42 unmeasured files enumerated below
are unchanged and not repeated as a second list — Phase 123's success criterion is still scoped to
exactly the 5 routes × 4 themes = 20 cells this matrix measured; the other 42 route files can hold
a WCAG-AA violation invisible to that criterion regardless of what Phase 123 reports.

Denominators originally derived live, same method as `122-CONTEXT.md`'s D-24 correction:
- `ls src/pages/*.tsx | grep -v '\.test\.' | wc -l` → **42** (top-level pages)
- `ls src/pages/*/*.tsx | grep -v '\.test\.' | wc -l` → **5** (`src/pages/hr/`; `src/pages/__tests__/`
  correctly excluded, it is a test directory)
- **42 + 5 = 47**, the unit is FILES.
- Control: the same top-level glob *including* test files returns **62** -- the figure D-18's own
  note warns against propagating. Not used here.

### The 5 measured routes (mapped from `e2e/theme-contrast.spec.ts` PAGES to their component file
via `src/App.tsx`'s route table)

| spec name | route | component file |
|---|---|---|
| Dashboard | `/` | `src/pages/Dashboard.tsx` |
| LiveRun | `/live-run` | `src/pages/LiveRun.tsx` |
| Analytics | `/analytics` | `src/pages/Analytics.tsx` |
| Forge | `/forge` | `src/pages/ForgePage.tsx` |
| Graphs | `/graphs` | `src/pages/GraphsHub.tsx` |

### The 42 unmeasured page files (named individually per D-24 -- no "and others")

Top-level (`src/pages/`, 37 of the 42 top-level files not already in the table above):

- src/pages/Alerts.tsx
- src/pages/Automation.tsx
- src/pages/Bifrost.tsx
- src/pages/Briefings.tsx
- src/pages/BuildProgress.tsx
- src/pages/Capabilities.tsx
- src/pages/Chat.tsx
- src/pages/ConfigPage.tsx
- src/pages/DocComments.tsx
- src/pages/Dreaming.tsx
- src/pages/Executions.tsx
- src/pages/Galdr.tsx
- src/pages/HivePage.tsx
- src/pages/Ideation.tsx
- src/pages/Inbox.tsx
- src/pages/Infrastructure.tsx
- src/pages/InsightsChat.tsx
- src/pages/KnowledgeGraph.tsx
- src/pages/Loom.tsx
- src/pages/McpInventory.tsx
- src/pages/MeetingBot.tsx
- src/pages/Memory.tsx
- src/pages/Quality.tsx
- src/pages/QualityDetail.tsx
- src/pages/Reminders.tsx
- src/pages/Security.tsx
- src/pages/SelfHealing.tsx
- src/pages/SessionDetail.tsx
- src/pages/Settings.tsx
- src/pages/Skills.tsx
- src/pages/Studio.tsx
- src/pages/Tasks.tsx
- src/pages/ToolGalaxy.tsx
- src/pages/Tools.tsx
- src/pages/WarRoom.tsx
- src/pages/WhatsApp.tsx
- src/pages/WorkspaceMap.tsx

Subdirectory (`src/pages/hr/`, all 5):

- src/pages/hr/AgentAnalytics.tsx
- src/pages/hr/Catalog.tsx
- src/pages/hr/Onboarding.tsx
- src/pages/hr/Roster.tsx
- src/pages/hr/Teams.tsx

37 + 5 = 42 unmeasured, + the 5 measured = 47 total. Any one of these 42 can hold a WCAG-AA
violation invisible to Phase 123's "zero violations across every cell A11Y-01 measured" success
criterion -- that criterion is honest about the 5 cells it covers and silent about the other 42.

`amber` (the 5th defined theme) is out of the matrix by D-04: it has no entry in `ThemeSwitcher`
and is unreachable from any rendered page, so it cannot be measured against one. This is a
themes-axis exclusion, orthogonal to the pages-axis sampling limit above -- even if all 47 pages
were measured, `amber` would still be absent because it is not a selectable theme, not because a
page was skipped.

## AFTER (measured 2026-08-19, `dev:noauth` :5181, post-aria-fix, current ramp)

**Re-captured 2026-08-19 by plan 122-22 against `156d5116 fix(122-22)`** (the `aria-label` fix on
`MetricCard`'s `role="button"` wrapper). Two prior AFTER captures are preserved as controls, both
unmodified:

- `.../a11y-after-preramp/*.json` (122-19/122-20's perceptually-flat, operator-rejected ramp)
- `.../a11y-after-prearia/*.json` (122-21's re-derived current ramp, **before** the aria-label fix
  — this is what "AFTER" held in this document until this run; 32 objects / 250 nodes)

Every figure below was re-derived from the 20 files at `a11y-after/*.json`, replaced in place this
run and now reflecting `156d5116`.

Measured identically to BEFORE and to the two prior AFTER captures:
`A11Y_CAPTURE_DIR=.../a11y-after A11Y_MEASURE_ONLY=1 PW_BASE_URL=http://localhost:5181 npx playwright test e2e/theme-contrast.spec.ts`,
issued from Git Bash against a freshly-started `dev:noauth`
(`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`), probed on both `localhost:5181` and
`127.0.0.1:5181` (200/200) before the matrix ran. 20/20 cells measured, zero skipped, filenames
identical to `a11y-before/` by name-level diff. Wall-clock: **12.2s** (Playwright's own reported
time; BEFORE 14.3s, preramp-AFTER 12.3s, prearia-AFTER 14.4s).

Guard control: the operator was actively using `:5173` throughout this session (confirmed live
before, during, and after — `200` on every probe). Re-running the Playwright guard cell against
that occupied server was attempted read-only and was blocked by this session's own permission
classifier before it could execute; **not run this time, stated plainly rather than claimed**.
`e2e/theme-contrast.spec.ts` was not touched by this plan (only `src/components/MetricCard.tsx` and
its test file changed in `156d5116`), so the `fee96b5d` guard annotation text is byte-identical to
every prior run by construction — verified present at `e2e/theme-contrast.spec.ts:66`, unchanged
since 122-01.

**Unit: axe VIOLATION OBJECTS**, same convention as BEFORE (one per distinct rule that fired on a
page; a violation object can cover several DOM nodes).

### Violation objects per cell

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 1 | 1 | 1 | 2 | 1 | **6** |
| emerald | 1 | 1 | 1 | 2 | 1 | **6** |
| readable | 1 | 1 | 1 | 2 | 1 | **6** |
| aubergine | 1 | 1 | 1 | 2 | 1 | **6** |
| **column total** | **4** | **4** | **4** | **8** | **4** | **grand total: 24** |

**Exact cell-by-cell match to the BEFORE table above** — every theme x page cell has the identical
object count it had before the Phase 122 token layer landed at all. Grand total re-derived two
ways — summing `violationCount` across the 20 committed `a11y-after/` JSON files (`24`), and
summing the two rule buckets in the AFTER rule breakdown below (`20 + 4 = 24`) — both agree.

### Affected elements (nodes), same cells, different unit

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 3 | 4 | 3 | 4 | 4 | **18** |
| emerald | 3 | 4 | 3 | 4 | 4 | **18** |
| readable | 16 | 15 | 16 | 16 | 15 | **78** |
| aubergine | 19 | 19 | 19 | 19 | 19 | **95** |
| **column total** | **41** | **42** | **41** | **43** | **42** | **grand total: 209** |

Grand total re-derived two ways: summing per-cell node counts above (`209`), and summing the AFTER
rule breakdown's node column below (`205 + 4 = 209`) — both agree.

## Rule breakdown (after)

| rule id | impact | violation objects | affected nodes | what it is |
|---|---|---|---|---|
| `color-contrast` | serious | 20 | 205 | Same rule as BEFORE, same 20-cell footprint (fires in every cell). Object count unchanged (20 → 20); node count 214 → 205 vs. BEFORE (see Delta below), 194 → 205 vs. the prearia capture (scan-timing noise, traced below — not a regression from the fix). |
| `aria-prohibited-attr` | serious | 4 | 4 | `[Forge]` only, all 4 themes. Unchanged from BEFORE, the preramp AFTER, and the prearia AFTER (4 → 4 objects, 4 → 4 nodes throughout) — the `<div aria-busy aria-label>` markup defect is still present, untouched by the token/ramp/aria-fix work. |
| `aria-command-name` | serious | **0** | **0** | **Confirmed absent.** Fired 8 objects / 52 nodes in the prearia capture (every `[Dashboard]`/`[Graphs]` cell in all 4 themes); zero occurrences in this run, across all 20 cells, verified by grepping the rule id out of every captured JSON file (0 hits). `156d5116`'s `aria-label={onClick ? label : undefined}` on `MetricCard.tsx:264` closes it. |

Zero `critical`/`moderate`/`minor` violations in this run either; the two surviving rules remain
`impact: serious`.

**`aria-command-name` confirmed absent — direct verification, not inferred from the total:**

```
$ grep -rl 'aria-command-name' a11y-after/*.json
(no output — 0 of 20 files)
```

For contrast, the same grep against the pre-fix `a11y-after-prearia/*.json` returns the 8 files
where it fired. A sample violating node from that preserved pre-fix capture (`[cyan] Dashboard`,
`aria-command-name`, `help: "ARIA commands must have an accessible name"`):

```html
<div data-testid="metric-card" class="bg-card/60 backdrop-..." role="button" tabindex="0" style="cursor: pointer;">
```

with `failureSummary`: "Element does not have text that is visible to screen readers / aria-label
attribute does not exist or is empty / aria-labelledby attribute does not exist... / Element has no
title attribute" — exactly the gap `156d5116`'s `aria-label` fills. No node with this shape appears
anywhere in the new `a11y-after/*.json` files.

## The 234 figure, addressed again for AFTER

The BEFORE section above already establishes that the 2026-08-10 234-node sample and BEFORE's
`[cyan] Dashboard` cell (4 nodes) are the same violation, measured pre/post Phase 120 — this AFTER
measurement does not re-litigate that. This run's grand total (24 objects / 209 nodes) is a
different figure from a different measurement point again, and is neither more nor less "234" than
BEFORE's total was; the 234 figure was retired as a comparison point in the BEFORE section and
stays retired here.

## READ THIS BEFORE QUOTING ANY NODE-LEVEL FIGURE (added 2026-08-19)

**The raw node totals are not reproducible, and the raw node-level delta is inside the noise.**

`DashboardLayout.tsx:607-620`'s `SYS:`/`LAT:` telemetry badge is gated on live Convex data arriving
before the scan. It is a `color-contrast` violator, it renders on EVERY page, and its node count
swings purely on data-arrival timing between independently-started `dev:noauth` sessions:

| capture | color-contrast nodes | of which SYS/LAT badge | **excluding badge** |
|---|---|---|---|
| `a11y-before/` (frozen control) | 214 | 26 | **188** |
| `a11y-after-preramp/` | 205 | 17 | **188** |
| `a11y-after-prearia/` | 194 | 5 | **189** |
| `a11y-after/` (current) | 205 | 15 | **190** |

The badge alone accounts for a **21-node swing** (5 to 26) with no code change. Any raw node delta
smaller than that is measuring scan timing, not the codebase.

**Consequence — a correction.** The raw BEFORE→AFTER contrast delta reads `214 → 205` (−9) and was
briefly described as an improvement. It is not. Excluding the badge the same delta is
**188 → 190 (+2)** — flat, marginally worse, and well inside run-to-run variance either way. Phase
122 did not measurably change the contrast node count, which is consistent with its scope: it never
set out to.

**What Phase 123 should plan against.** Use the **ex-badge** column. Across four independently
captured sessions it reads 188 / 188 / 189 / 190 — stable to within ±1 node, i.e. reproducible in
exactly the way the raw total is not. Excluding one known timing-gated element recovers
determinism without mocking the backend or rewriting the harness.

**Object-level totals are unaffected** by this confound and remain safe to quote: the badge changes
how many NODES a `color-contrast` object carries, never whether the rule fires. `color-contrast`
is 20 objects in every capture.

**Do not "fix" this by re-running until the numbers agree.** The variance is real and will recur on
every capture; the correct handling is to exclude the gated element and say so, or to seed the
backend state before scanning.

## Delta (AFTER vs. BEFORE)

Computed as **before − after**. A **positive** value means AFTER has fewer violations than BEFORE
(**improvement**); a **negative** value means AFTER has more (**regression**). This delta now spans
the full round trip: the Phase 122 token layer, the ramp re-derivation, the `aria-command-name`
regression it introduced, and `156d5116`'s fix for that regression.

### Per-cell delta, violation objects (before − after)

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs | row total |
|---|---|---|---|---|---|---|
| cyan | 0 | 0 | 0 | 0 | 0 | **0** |
| emerald | 0 | 0 | 0 | 0 | 0 | **0** |
| readable | 0 | 0 | 0 | 0 | 0 | **0** |
| aubergine | 0 | 0 | 0 | 0 | 0 | **0** |
| **column total** | **0** | **0** | **0** | **0** | **0** | **grand: 0** (24 → 24) |

**Zero cells regressed, zero cells improved at the object level — every one of the 20 cells is
back to its exact BEFORE object count.** The `aria-command-name` regression 122-21 measured (-8,
`[Dashboard]`/`[Graphs]` in all 4 themes) is fully closed by `156d5116`; no other rule moved.

### Per-rule delta

| rule id | objects before → after | Δ objects | nodes before → after | Δ nodes | direction |
|---|---|---|---|---|---|
| `color-contrast` | 20 → 20 | 0 | 214 → 205 | **+9 raw — NOT an improvement** | **flat.** The raw +9 is inside the SYS/LAT badge confound (that badge alone swings 5–26 nodes on scan timing). Excluding it: 188 → 190, i.e. **−2**, marginally worse and within variance. See the determinism caveat above the Delta section and use the ex-badge figure. |
| `aria-prohibited-attr` | 4 → 4 | 0 | 4 → 4 | 0 | unchanged |
| `aria-command-name` | 0 → 0 | 0 | 0 → 0 | 0 | **no longer regressed — closed** (was -8 objects / -52 nodes at the prearia checkpoint; see isolation section below) |

(Δ columns use the same before − after convention: positive = improvement, negative = regression.)

### Node-level delta, per cell (before − after)

| theme | Dashboard | LiveRun | Analytics | Forge | Graphs |
|---|---|---|---|---|---|
| cyan | +1 | +1 | +1 | +1 | 0 |
| emerald | +1 | +1 | +1 | +1 | 0 |
| readable | 0 | +1 | 0 | 0 | 0 |
| aubergine | +1 | 0 | 0 | 0 | -1 |

Grand total: BEFORE 218 → AFTER 209 nodes (**+9**, all within `color-contrast`; `aria-prohibited-attr`
flat). All figures re-derived directly from `a11y-before/*.json` and the current `a11y-after/*.json`.
**One regressed cell: `[aubergine] Graphs`, -1 node** — traced below in the isolation section (the
same Suspense-fallback text 122-21 flagged on `[aubergine] Graphs` as "not explained by the badge or
by axe selector-reordering," still present in this capture). Every other non-zero cell is flat or an
improvement.

## Delta isolating the aria fix (new AFTER vs. `a11y-after-prearia`)

**This is the figure that settles the dispatch's actual question** — 122-21's prearia capture holds
the ramp fixed and the aria bug present; this AFTER capture holds the ramp fixed and the aria bug
fixed. Comparing the two directly isolates `156d5116`'s effect from everything else in the phase.

### Object-level: exactly the predicted -8, all `aria-command-name`, zero elsewhere

| rule id | prearia objects | after objects | Δ | nodes prearia → after | Δ nodes |
|---|---|---|---|---|---|
| `color-contrast` | 20 | 20 | 0 | 194 → 205 | see below |
| `aria-prohibited-attr` | 4 | 4 | 0 | 4 → 4 | 0 |
| `aria-command-name` | 8 | **0** | **-8** | 52 → **0** | **-52** |

Per-cell object diff (prearia − after; positive = fixed): `[Dashboard]` and `[Graphs]` in all 4
themes each fell by exactly 1 object, all other 12 cells unchanged — the mirror image of 122-21's
regression table. **Zero new violations of any rule were introduced by the fix** (verified: every
rule present in `after/` was already present in `prearia/`, none appeared for the first time).

### Node-level: -41 raw, but only -1 is a real regression — the rest is the fix plus already-known scan noise

Grand total: prearia **250 nodes** → current-after **209 nodes** (**41 fewer**). Traced per element,
not just summed, the same way 122-21 traced the ramp:

**Component 1: the fix itself, -52 nodes, clean.** All 52 `aria-command-name` nodes (8 objects: 7
each on `[Dashboard]` cyan/emerald/readable/aubergine, 6 each on `[Graphs]` cyan/emerald/readable/
aubergine) are gone in every one of the 8 cells that had them, with no residue — grepping
`aria-command-name` across all 20 new files returns zero matches.

**Component 2: +10 nodes, the SAME data-gated header badge 122-21 already identified as scan noise,
not a fix side-effect.** `DashboardLayout.tsx:607-620`'s `SYS:`/`LAT:` telemetry pair
(`.lg\:flex > .gap-1\.5`) is present in this AFTER capture but was absent from the prearia capture
on 10 individual badge-node instances across 6 cells (`[cyan] LiveRun/Analytics/Forge/Graphs`,
`[emerald] Dashboard/LiveRun/Analytics/Forge/Graphs`, one badge span each) — traced by diffing exact
target selectors, not just counts. **Control, same technique 122-21 used:** `readable`'s five cells
show **zero** badge-node change between prearia and after (its Dashboard/Graphs deltas are 100%
`aria-command-name`, nothing else) — if this were something the fix or the ramp touched, `readable`
(identical markup, identical gating logic) would show it too, and it does not. This is ordinary
backend-data-arrival timing variance between two independently-started `dev:noauth` sessions
against a real Convex backend — the exact confound 122-21 named, recurring because every capture
session starts a fresh dev server and hits live data.

**Component 3: -1 node, genuinely new, not explained by either of the above.** `[aubergine] LiveRun`
gained one `color-contrast` node absent from prearia: `.text-\(--muted-foreground\)`, ratio
**4.48:1** (needs 4.5), `fgColor` `#877867` on `bgColor` `#120d18`. This is the *same element*
122-21's Root Cause 2 flagged on cyan/emerald LiveRun as "not fully root-caused... flagged for
Phase 123" (an intermediate semi-transparent layer between the text and the deepest opaque
ancestor) — here it appears on aubergine for the first time, at a hairsbreadth below the AA
threshold (0.02 short of 4.5). Not attributable to the badge (aubergine LiveRun's badge node is
present, unchanged, in both captures) and not attributable to `156d5116` (a colour-contrast ratio
cannot be moved by an `aria-label` string). Carried forward as the same open item 122-21 already
flagged for Phase 123, now with a second theme's data point.

**Arithmetic, verified exactly:** -52 (fix) + 10 (badge, cyan/emerald x5 cells) + 1 (new aubergine
LiveRun node) = **-41**, matching 250 → 209 exactly. Nothing left unaccounted.

### readable as a clean control for the whole isolation

`readable`'s five cells show a diff explained **100% by `aria-command-name`** (7 nodes off
`[Dashboard]`, 6 off `[Graphs]`, zero elsewhere) — no badge churn, no new near-miss node. This is
the cleanest read of the fix's isolated effect, uncontaminated by the two known noise sources that
affect the other three themes.

## Delta isolating the ramp (superseded preramp AFTER vs. `a11y-after-prearia`) — historical, unaffected by this run

122-21's ramp-isolation finding is unchanged by this plan (this run touched no `src/index.css` and
no ramp-related file) and both source captures it compared
(`a11y-after-preramp/` and `a11y-after-prearia/`) are frozen and untouched here. Full detail lives
in `122-21-REMATRIX.md`; summary: the ramp re-derivation's own node-level effect was net positive
(-11 nodes: 261 → 250), almost entirely the same `SYS:`/`LAT:` badge timing confound documented
above (net -12 badge instances that run, flipping in both directions), plus 4 genuinely
ramp-caused `color-contrast` value shifts (none crossing pass/fail) and one still-unexplained new
node on `[aubergine] Graphs` — not the aubergine LiveRun node found in this run, a different cell.
122-20's "both directions" keyword-count proxy was refuted with real per-node-traced numbers there;
this run does not re-litigate it.

## Named-pair ratios

Rasterised **pixel measurements** (canvas `getImageData`, never a regex over a
`getComputedStyle` string) — not axe results, and no computed colour string was parsed to
produce any figure below. Source: plan 122-18's `e2e/theme-rendered-result.spec.ts` (D-27),
cross-referenced against plan 122-10's `122-BADGE-LAW.md` §8. Both measured against `--card` per
D-06's instruction, not the page background.

### Forge `failed` badge vs. `--card` (D-06)

Shipped pairing `bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]`, composited
over `--card`:

| theme | composited bg | fg | ratio | AA (≥4.5:1)? |
|---|---|---|---|---|
| cyan | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| emerald | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| readable | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |
| aubergine | rgb(127,29,29) | rgb(255,255,255) | **10.020:1** | PASS |

Identical across themes because the fill is opaque — `--card` never enters the composite
(independently confirmed in 122-18 by matching the composited sample to the raw fill sample).

Old pairing (`bg-red-900/60 text-[var(--status-error)]`), same rasteriser, composited over each
theme's pre-phase `--card` (122-18, anchored on `PRE_PHASE_SHA` `2ddc80f5`):

| theme | composited bg | fg | ratio | AA? |
|---|---|---|---|---|
| cyan | rgb(82,19,23) | rgb(239,68,68) | **3.811:1** | FAIL |
| emerald | rgb(79,18,30) | rgb(239,68,68) | **3.881:1** | FAIL |
| readable | rgb(87,25,30) | rgb(248,113,113) | 4.857:1 | at/above |
| aubergine | rgb(88,21,30) | rgb(248,113,113) | 4.927:1 | at/above |

`122-BADGE-LAW.md` §8's own control table reports 3.834:1 / 3.834:1 / 4.857:1 / 4.927:1 for the
same pairing — the small cyan/emerald difference from the figures above is explained in both
documents: `122-BADGE-LAW.md` measured the old pairing against the CURRENT already-tokenised
`--card`, while 122-18 anchors on the pre-phase git SHA per D-27. Both independently confirm the
same FAIL / FAIL / at-or-above / at-or-above pattern.

### `--status-ok` vs. `--primary` separation (D-05)

Euclidean sRGB-byte distance, threshold 30, from 122-18 §3:

| theme | status-ok | primary | distance | passes (>30)? |
|---|---|---|---|---|
| cyan | rgb(52,211,153) | rgb(6,182,212) | **80.2** | yes |
| emerald | rgb(34,211,238) | rgb(16,185,129) | **113.5** | yes |
| readable | rgb(52,211,153) | rgb(94,234,212) | **76.0** | yes |
| aubergine | rgb(52,211,153) | rgb(192,132,252) | **188.8** | yes |

Pre-phase control (122-18 §3): cyan and emerald measured **0.0** distance (`--status-ok` and
`--primary` were the literal same hex value) before this phase; readable and aubergine were
already decoupled and stay decoupled. This is the automated half of D-05 — 122-18 notes the
operator judgement at Task 3 step 7 is the other half, and does not depend on this figure.

## Method

axe-core (`@axe-core/playwright` `4.12.1`, `wcag2a`/`wcag2aa` tags) resolves colour itself from the
live rendered DOM/CSSOM -- it never parses a `getComputedStyle` colour string, so it is immune to
the `oklch()`/`oklab()` hue-angle-read-as-blue-channel trap that produced Phase 120's withdrawn
numbers (`[[tailwind-v4-oklch-defeats-css-color-scraping]]`). No computed colour string was parsed
anywhere in producing this document; every figure above comes from `results.violations` as returned
by `AxeBuilder#analyze()`.

Invocation (from Git Bash, per `CLAUDE.md`'s PowerShell empty-env-var warning):

```
VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth
# separate terminal, once the above answers on :5181
A11Y_CAPTURE_DIR=.planning/phases/122-tokens-primitives-contrast-measurement/a11y-before \
A11Y_MEASURE_ONLY=1 \
PW_BASE_URL=http://localhost:5181 \
npx playwright test e2e/theme-contrast.spec.ts
```

`dev:noauth` = `vite --port 5181 --strictPort --host 127.0.0.1` (never drop `--host 127.0.0.1`
-- `vite.config.ts`'s `server.host:true` would otherwise bind this auth-disabled server to the
LAN/tailnet). Server probed on both `localhost:5181` and `127.0.0.1:5181` (200/200) before the
matrix ran, and stopped after. Wall-clock for the 20-cell matrix: **14.3s** (Playwright's own
reported run time).

Control proving the `fee96b5d` gate guard still fires: one cell (`[cyan] Dashboard`) re-run against
the gated `:5173` server reported Playwright status `skipped` with annotation
`"Clerk auth gate present — Dashboard never rendered..."` -- not passed, not failed. This proves
the 20 captures above came from a genuinely keyless server rather than from a guard that stopped
working.
