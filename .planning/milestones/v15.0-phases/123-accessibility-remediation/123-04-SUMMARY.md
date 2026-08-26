---
phase: 123-accessibility-remediation
plan: 04
subsystem: ui
tags: [accessibility, wcag, contrast, dashboard-layout, app-shell]

requires: []
provides:
  - "App-shell text-*/NN opacity modifiers all deleted: DashboardLayout.tsx's nine sites (nav group header, disabled placeholder item, soon pill, desktop nav label, operator sub-line, footer Settings label, SYS:/LAT: badge + its two icons) now render at full token opacity"
  - "123-SHELL-FIX.md: per-theme/per-page before/after color-contrast node counts, the app-shell-node-count-is-zero proof, the ex-badge column retirement, and the D-15 residual finding for 123-05"
affects: [123-05, 123-06]

tech-stack:
  added: []
  patterns:
    - "Non-text-colour dim for a disabled affordance: opacity-50 on the whole row (icon + label + soon pill together) rather than a text-colour alpha, matching this repo's existing disabled-state convention (ChatInput.tsx disabled:opacity-40/50, Alerts.tsx opacity-50 for acked/muted rows) -- D-04 forbids reintroducing text-colour alpha as the fix for a hierarchy break"
    - "Parse violations[].nodes.length and bucket by target selector to re-derive axe counts, never grep \"id\" -- a naive grep over-counts because every per-node any/all/none check object also carries an id field (225 against a 209-node corpus is the known false reading)"

key-files:
  created:
    - .planning/phases/123-accessibility-remediation/123-SHELL-FIX.md
    - .planning/phases/123-accessibility-remediation/a11y-shell-fix/ (20 capture JSONs)
  modified:
    - src/layouts/DashboardLayout.tsx

key-decisions:
  - ":111's disabled placeholder item keeps text-muted-foreground at full opacity (not the alpha-free text-muted alternative considered and rejected): --muted is a surface/background token paired with --muted-foreground for text-on-that-surface, not a quieter text tier, and it is UNDEFINED per-theme for emerald and amber (verified via src/index.css -- only :root, [data-theme=cyan] (shared with .dark), readable and aubergine declare --muted/--muted-foreground; emerald/amber elements carry the .dark class and would silently inherit cyan's #1e1e24/#94a3b8 values), the same off-theme colour-leak shape Phase 122 fixed for --card. The disabled-vs-enabled visual distinction is instead preserved with opacity-50 on the whole row, a non-text-colour mechanism D-04 explicitly allows."
  - "That site (src/lib/navRegistry.ts's placeholder:true branch) currently has zero live callers -- no nav item in the registry sets placeholder:true -- so it never rendered in any Phase 122 capture and this plan's own 20-cell run cannot exercise it either. The fix is correctness-forward, not live-measured; documented rather than silently assumed equivalent to the eight measured sites."
  - "Plan-text inconsistency corrected: 123-04-PLAN.md's own <interfaces> comment attributes the 4 aria-prohibited-attr objects to plan 123-06, while Task 2's action text says 123-05. Verified against both plan files' frontmatter: 123-06-PLAN.md's objective explicitly clears ForgeJobList.tsx's aria-busy sites (D-06); 123-05-PLAN.md's files_modified is CodeVaultGraph.tsx/RunTimeline.tsx only, with no ARIA scope at all. 123-SHELL-FIX.md uses the correct 123-06 attribution."

requirements-completed: []
# A11Y-02 is NOT completed by this plan -- it spans 12 of Phase 123's 13 plans and closes
# only once the remaining sweep plans (123-05, 06, 07, 08, 10, 11, 12) and the widened
# axe scan land. This plan clears the single highest-leverage site (184 of 205 pre-123
# measured color-contrast nodes) but the phase-level requirement stays open.

duration: 28min
completed: 2026-08-20
---

# Phase 123 Plan 04: App-shell opacity-modifier fix (D-01/D-04/D-15) Summary

**Deletes all nine `text-*/NN` opacity modifiers in `DashboardLayout.tsx` — the shared app-shell chrome that owned 184 of the 205 pre-123 measured `color-contrast` nodes — and measures the result at 0 app-shell nodes across all 20 axe cells in all four themes, with the SYS:/LAT: badge's node-count noise (122's "ex-badge column") retired outright rather than tracked.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-20T10:52:00-04:00 (first file read)
- **Completed:** 2026-08-20T11:20:00-04:00
- **Tasks:** 2
- **Files modified:** 1 source file + 1 new doc + 20 new capture JSONs

## Accomplishments

- All nine `text-primary/NN`, `text-muted-foreground/NN` sites in `DashboardLayout.tsx` deleted to full token opacity: nav group header (`:91`), disabled placeholder item + its "soon" pill (`:111`/`:117`), desktop nav label (`:148`), operator sub-line (`:253`), footer Settings label (`:287`, a separately-indented copy of the same ternary as `:148`), and the SYS:/LAT: badge container + its two icons (`:607`/`:610`/`:616`).
- All nine occurrences were confirmed line-for-line against the plan's `<interfaces>` block (re-derived live 2026-08-20 by the planner) before editing — no line-number rot found.
- `:111`'s disabled-vs-enabled tension resolved per D-04: `text-muted` rejected as the "quieter token" (surface/background token, undefined per-theme for emerald/amber, an off-theme colour leak); kept `text-muted-foreground` and added `opacity-50` to the whole row instead, matching the repo's existing disabled-state convention.
- Ran the 20-cell axe matrix (`A11Y_MEASURE_ONLY=1`) against the pre-existing keyless `dev:noauth` server on `:5181` (reused per dispatch instructions — probed `localhost`/`127.0.0.1` both 200, control port `5182` 000, never started a second server). 20 passed, 0 skipped — zero skips confirms the keyless server was actually hit, not the Clerk-gated one.
- Re-derived the pre-123 control aggregate from `122-.../a11y-after/*.json` by parsing `violations[].nodes.length`, never grepping `"id"`: **24 objects / 209 nodes total, 20 objects / 205 nodes `color-contrast`, 4/4 `aria-prohibited-attr`** — matches the plan's cited figure exactly.
- Post-fix measurement: **0 of 5 surviving `color-contrast` nodes match any `DashboardLayout` selector** (down from 205). `aria-prohibited-attr` unchanged at 4/4 — the must-differ control a probe reporting 0-for-everything would fail. `readable` theme reaches 0/0 `color-contrast` across all five pages, the same AA bar as the other three (D-10).
- SYS:/LAT: badge's own measured node count in this run is 0. The `122-CONTRAST-BASELINE.md` ex-badge column (which tracked a 5→26 node swing across captures with zero code change, gated on live backend data arriving before the axe scan) is retired: a rendered and an unrendered badge both now contribute zero nodes, so the confound is dissolved by the fix rather than excluded by bookkeeping.
- `bg-primary/NN` + `border-primary/NN` occurrence count in `DashboardLayout.tsx`: **22 before, 22 after** (verified against `git show HEAD:` pre-edit and the working tree post-edit) — confirms the sweep touched only the nine intended `text-*` sites. Hex count unchanged at 0. `npx tsc --noEmit` exits 0. `npm test -- src/layouts` (`DashboardLayout.test.tsx`): 6 passed, 6 todo.

## Task Commits

1. **Task 1: Delete the nine opacity modifiers in the app shell** — `3ccc43ad` (feat)
2. **Task 2: Measure the shell fix across all four themes and retire the ex-badge column** — `8b7008c6` (docs)

## Files Created/Modified

- `src/layouts/DashboardLayout.tsx` — 9 lines changed, all `text-*/NN` → `text-*` deletions plus one `opacity-50` addition on the disabled-placeholder row. No `bg-*`, `border-*`, `drop-shadow` alpha touched.
- `.planning/phases/123-accessibility-remediation/123-SHELL-FIX.md` — New. Full before/after evidence: pre/post control aggregates, per-theme/per-page table, target-selector bucketing proving 0 shell nodes, the ex-badge retirement statement, and the D-15 residual finding below.
- `.planning/phases/123-accessibility-remediation/a11y-shell-fix/*.json` — New, 20 files. Raw per-cell axe capture output, committed per the Phase 122 precedent (`a11y-after/` was committed, not gitignored).

## Decisions Made

See `key-decisions` in frontmatter. Summarized: `text-muted` rejected for `:111` (surface token, undefined per-theme, off-theme leak risk) in favor of `opacity-50` on the row; that site is currently dead code (no live `placeholder:true` nav items) so the choice is forward-looking, not live-measured; the plan's own `<interfaces>`-vs-Task-2 inconsistency over which plan (123-05 vs 123-06) owns the 4 `aria-prohibited-attr` objects resolved in favor of 123-06, verified against both plan files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan-text inconsistency: 123-05 vs 123-06 attribution for the 4 `aria-prohibited-attr` objects**
- **Found during:** Task 2, writing `123-SHELL-FIX.md`
- **Issue:** `123-04-PLAN.md`'s `<interfaces>` comment (line 71) says the 4 `aria-prohibited-attr` objects "are plan 123-06's, not this plan's," while Task 2's own action text (line 173) says they "belong to plan 123-05."
- **Fix:** Read both `123-05-PLAN.md` and `123-06-PLAN.md`. `123-06-PLAN.md`'s objective explicitly states "Clear the 4 `aria-prohibited-attr` violation objects — one per theme, all on `/forge`"; its `files_modified` is `ForgeJobList.tsx`/`ForgePage.tsx`. `123-05-PLAN.md`'s `files_modified` is `CodeVaultGraph.tsx`/`RunTimeline.tsx` only, with no ARIA scope. `123-SHELL-FIX.md` cites 123-06.
- **Files modified:** `.planning/phases/123-accessibility-remediation/123-SHELL-FIX.md` (written correctly from the start, not corrected after the fact)
- **Verification:** Direct read of both plan files' frontmatter and objective sections.
- **Committed in:** `8b7008c6` (Task 2 commit)

**Impact on plan:** Doc-accuracy only; no code or test behavior affected.

### Findings Reported, Not Absorbed (D-15)

**The measured residual is 5 `color-contrast` nodes, one short of `123-05-PLAN.md`'s predicted 6** (`cyan`/`emerald`/`aubergine` × 2 selectors = 6 predicted; this run measured `cyan`/`emerald` × 2 selectors + `aubergine` × 1 selector = 5 actual). The missing node is `aubergine__LiveRun`'s `.text-\(--muted-foreground\)` (`RunTimeline.tsx:81`, the "Thinking..." indicator). That element is gated on `showThinking = streaming && blocks.length === 0` (`RunTimeline.tsx:78`) — a live/timing-dependent condition, not a theme-dependent one — confirmed by reading each violation's own `node.html`, which shows the literal `Thinking...` markup only in the `cyan` and `emerald` captures. This is reported in `123-SHELL-FIX.md` for plan 123-05 to measure its own baseline live, per D-15's rule that an intermittently-failing cell is a real finding, never written off as noise. Not fixed here — `RunTimeline.tsx` is out of this plan's `files_modified` and squarely 123-05's scope.

## Issues Encountered

None beyond the two documented above (both resolved/reported, neither blocking).

## User Setup Required

None. All measurement ran against the pre-existing `dev:noauth` server already provided in the execution environment.

## Next Phase Readiness

- The app-shell `color-contrast` population is closed at 0/205 measured nodes; no further work needed on `DashboardLayout.tsx` for A11Y-02's shell portion.
- 123-05 has a corrected, live-measured residual figure (5, not 6) and the specific timing-dependent element (`RunTimeline.tsx:81`'s `showThinking` gate) named for it to account for in its own before-fixing baseline.
- 123-06 has the corrected plan attribution for the 4 `aria-prohibited-attr` objects (already matched its own plan file; only 123-04's cross-reference was wrong).
- 123-08's widened 47-route × 4-theme scan (once 123-03 lands D-16) will re-measure this same shell across the other 42 routes — this plan's fix should clear those too since the shell is shared chrome, but that is 123-08's measurement to make, not asserted here.
- No blockers.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*

## Self-Check: PASSED

Files confirmed present on disk: `src/layouts/DashboardLayout.tsx` (modified, present), `.planning/phases/123-accessibility-remediation/123-SHELL-FIX.md` (YES), `.planning/phases/123-accessibility-remediation/a11y-shell-fix/` (20 JSON files, YES). Both task commit hashes (`3ccc43ad`, `8b7008c6`) confirmed present via `git log --oneline --all | grep`. No missing items.
