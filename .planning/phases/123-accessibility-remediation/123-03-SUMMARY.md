---
phase: 123-accessibility-remediation
plan: 03
subsystem: test
tags: [accessibility, playwright, axe, e2e, vacuous-pass, route-table]

requires: [123-01]
provides:
  - "e2e/a11y-routes.ts: THEMES + a 47-route table (ALL_ROUTES) with per-route content-marker descriptors + the 5-route CRITERION_PAGES subset A11Y-02 is judged on"
  - "e2e/theme-contrast.spec.ts: marker-gated (D-13), widened-scan-not-criterion (D-16), non-green-on-measure-only (D-14), self-asserting population count (C5)"
affects: [123-08, 123-09, 123-10, 123-11, 123-12, 123-13]

tech-stack:
  added: []
  patterns:
    - "Route marker as a serializable DESCRIPTOR ({ kind: 'heading', level, name } | { kind: 'testid', value } | null), not a Locator instance, so the route table module can be imported by both the spec (which has a Playwright `page`) and any future tooling that doesn't."
    - "Playwright fullyParallel test declaration counting: increment a module-scope counter once per declared test() call inside the generating loop, then assert that counter (not a recomputed product) against themes.length * routes.length in a separate test -- catches a future edit that filters/slices the loop body without updating both together, unlike a tautological recomputation."

key-files:
  created:
    - e2e/a11y-routes.ts
  modified:
    - e2e/theme-contrast.spec.ts

key-decisions:
  - "All 47 markers resolved to a level-1 heading descriptor -- none needed marker: null. Verified by reading each of the 47 page components' render path (not assumed from PageHeader usage alone): only src/pages/hr/Roster.tsx has a loading/error branch ahead of its PageHeader, and it is gated on a live Ástríðr-fetch failure that will not trigger against a healthy dev:noauth server."
  - "/sessions/:id and /quality/:profileId use the literal placeholder param 'nonexistent' rather than a real id, since React Router does not 404 on a param mismatch. QualityDetail's title={profileId} renders unconditionally ahead of any query-loading gate, so the placeholder string itself becomes the heading text used as the marker -- verified by reading the component, not assumed."
  - "D-14's failure is a plain `throw new Error(...)` at the end of the cell body, after the capture write, rather than routed through `expect()`. Each matrix cell is an independent Playwright test function (fullyParallel), so this cannot short-circuit any other cell regardless of mechanism; a plain throw was chosen for the simplest possible code path to the exact required message."

requirements-completed: []
# A11Y-02/A11Y-03 are NOT completed by this plan alone -- it closes D-13, D-14, D-16's
# widening, and control C5. A11Y-02's remediation and A11Y-03's remaining operator-evidence
# half are owned by later plans (123-08 onward, 123-09/123-13 checkpoints).

duration: 70min
completed: 2026-08-20
---

# Phase 123 Plan 03: Close the remaining A11Y-03 vacuous-pass paths (D-13/D-14/D-16, control C5) Summary

**Builds a 47-route table with per-route content markers (`e2e/a11y-routes.ts`) and rewrites the contrast matrix (`e2e/theme-contrast.spec.ts`) so a cell can no longer pass by measuring the app shell instead of the page, a measurement run can no longer report green, and the suite proves its own scanned-route count rather than asserting it.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-08-20T12:35:00-04:00 (first file read)
- **Completed:** 2026-08-20T13:45:00-04:00
- **Tasks:** 2
- **Files modified:** 1 new file, 1 rewritten spec

## Accomplishments

- Re-derived the 47-route population live rather than trusting any prior figure: `ls src/pages/*.tsx | grep -v '\.test\.' | wc -l` = 42, `ls src/pages/hr/*.tsx | grep -v '\.test\.' | wc -l` = 5, `ls src/pages/*.tsx | wc -l` = 62 (the control, includes test files -- never propagated).
- Cross-checked all 47 page files against `src/App.tsx`'s `<Route>` table one-to-one; excluded the three redirect-only routes (`/profiles`, `/agents`, `/mission-control`), which have no corresponding page file.
- Read every one of the 47 page components' actual render path (PageHeader `title` prop or hand-rolled `<h1>`) rather than assuming the title text from the route name -- caught, e.g., that `GraphsHub.tsx`'s title is `"Graphs Hub"` (not `"Graphs"`) and `Chat.tsx` has no `PageHeader` at all, using a raw `<h1>ÁSTRÍÐR</h1>` instead.
- Systematically scanned all 47 files for an early-return gate ahead of their marker line (helper-function/effect-cleanup returns filtered out by function-boundary inspection); found exactly one genuine risk (`hr/Roster.tsx`'s network-error branch), judged non-triggering against a healthy `dev:noauth` server and left as the marker anyway.
- Built the route table (`e2e/a11y-routes.ts`): `THEMES` (moved verbatim from the spec), `ALL_ROUTES` (47 entries), `CRITERION_PAGES` (`ALL_ROUTES.filter(r => r.criterion)`, the 5 routes A11Y-01 measured).
- `grep -Fc "Main navigation" e2e/a11y-routes.ts` returns 0 (had to reword an explanatory comment once, since the acceptance criterion's literal grep does not distinguish a comment from a real marker entry -- the 2026-08-07 lesson on comments-as-claims).
- `npx tsc --noEmit` exits 0 after Task 1 and again after Task 2.
- Rewrote `e2e/theme-contrast.spec.ts`: matrix source is `CRITERION_PAGES` by default or `ALL_ROUTES` under `A11Y_SCAN_ALL=1`; D-13 marker wait (`await expect(marker).toBeVisible({ timeout: 20000 })`) placed after the unchanged Clerk-gate check and before `AxeBuilder`; D-14 measure-only branch now throws a fixed message after the capture write instead of returning early; C5 population-and-count test added.
- `node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --list` (env unset): **21** tests (20 matrix cells + C5). `A11Y_SCAN_ALL=1 ... --list`: **189** tests (188 + C5). Both exact matches to the plan's stated acceptance numbers.
- `grep -Fc "Main navigation" e2e/theme-contrast.spec.ts` = **1** (only the Clerk-gate `appShellNav` locator survives, unchanged). `grep -Fc "assertions suppressed: this is a measurement, not a verification" e2e/theme-contrast.spec.ts` = **1**.
- Live-verified against the pre-existing `dev:noauth` server on `:5181` (probed `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5181/` = 200, reused, never started a second instance): the C5 test alone passes (1 passed, 789ms); the cyan-theme 5-cell criterion slice passes (5 passed, 6.9s); the full default 21-test run passes (21 passed, 9.6s).
- **D-14 both-halves proof, live:** `A11Y_MEASURE_ONLY=1 A11Y_CAPTURE_DIR=/tmp/a11y-probe ... playwright test` run with output redirected to a file (not piped through `tail`, per the house rule that a masked pipe exit code is not evidence) -- real exit code **1**; `ls /tmp/a11y-probe/*.json | wc -l` = **20**, one capture per criterion cell despite every cell reporting failed.
- **Marker mutation proof, run twice by hand:** mutated `ALL_ROUTES`'s Dashboard entry to `name: "Dashboard-9x7q2"` (a string no page renders) -- `[cyan] Dashboard` cell reported **failed** with `getByRole('heading', { name: 'Dashboard-9x7q2', level: 1 }).first()` timing out, not skipped, not passed. Restored the marker -- cell **passed** again in 2.9s, and `git diff --stat e2e/a11y-routes.ts` returned empty, confirming the mutate/restore round-trip left the committed file byte-identical.
- **Corrected a known plan-text defect per the dispatch:** `123-03-PLAN.md:74` cites plan 123-05 for Forge's `PageHeader` `<h1>`; verified live that it is **123-06** (`src/pages/ForgePage.tsx:154` already reads `<PageHeader title="Forge" .../>`, landed before this plan ran) -- the marker locator text (`"Forge"`) is correct under either attribution, so this had no code impact, only a doc correction.
- **Found and fixed a pre-existing STATE.md defect, outside this plan's own file scope but inside the dispatch's "no wave N complete claim anywhere" mandate:** commit `4666dff4` (123-07's own follow-up) corrected the false "wave 1 complete" claim in STATE.md's `stopped_at` frontmatter field and its `Stopped at:` body copy only. It never touched the separate `last_activity` frontmatter/body pair or the `## Project Reference` "Current focus" paragraph, both of which still asserted a "Wave 1 ... now complete" claim after that commit landed. All three further copies corrected in this plan's STATE.md update to state only what is re-derivable from disk (which plans have a `*-SUMMARY.md`) -- no wave-completion claim is written anywhere, consistent with the wave numbering disagreement between ROADMAP.md's table and gsd-sdk's `depends_on` DAG.

## Task Commits

1. **Task 1: Build the 47-route table with per-route content markers** -- `1ebca498` (feat)
2. **Task 2: Marker-gate, widen, and make measure-only non-green** -- `6090a628` (feat)

## Files Created/Modified

- `e2e/a11y-routes.ts` -- New. `THEMES`, `ALL_ROUTES` (47), `CRITERION_PAGES` (5), `RouteMarker`/`RouteEntry` types.
- `e2e/theme-contrast.spec.ts` -- Imports from `a11y-routes.ts`; adds `buildMarkerLocator`, the D-13 marker-wait block, the D-14 non-green measure-only branch, and the C5 population/count test. Clerk-gate check block byte-for-byte unchanged.

## Decisions Made

See `key-decisions` in frontmatter. Summarized: no route needed a `null` marker (verified per-component, not assumed); dynamic-param routes use a literal `nonexistent` placeholder whose rendered text doubles as the marker; D-14's failure is a plain `throw`, chosen for the simplest path to the exact required message given fullyParallel already isolates each cell.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's own acceptance-criteria grep for "Main navigation" would have failed against an explanatory comment in `e2e/a11y-routes.ts`**
- **Found during:** Task 1, self-check before commit
- **Issue:** The route-table header comment originally quoted the literal descriptor shape `{ kind: "heading", name: "Main navigation" }` while explaining why it is forbidden as a marker. `grep -Fc "Main navigation" e2e/a11y-routes.ts` returned 1, not 0 -- a literal-string acceptance check cannot distinguish a comment mentioning the string from an actual table entry using it.
- **Fix:** Reworded the comment to describe the locator without quoting the literal string.
- **Files modified:** `e2e/a11y-routes.ts`
- **Verification:** `grep -Fc "Main navigation" e2e/a11y-routes.ts` = 0, re-checked after the edit.
- **Committed in:** `1ebca498`

**2. [Rule 1 - Bug] Pre-existing STATE.md defect: a false "Wave 1 ... complete" claim survived in two locations a prior fix commit did not reach**
- **Found during:** STATE.md update pass at the end of this plan, while checking for any stale wave-completion claim per the dispatch's explicit mandate
- **Issue:** Commit `4666dff4` fixed the `stopped_at` frontmatter field and its `Stopped at:` body mirror, but the file stores this narrative in **four** places, not two: the same commit left the `last_activity` frontmatter field, its `Last activity:` body mirror, and the unrelated `## Project Reference` "Current focus" paragraph all still asserting wave-1 completion.
- **Fix:** Corrected all three remaining copies to state only what is re-derivable from disk, with no wave-completion claim of any kind (per the dispatch's `wave_numbering_caution`).
- **Files modified:** `.planning/STATE.md`
- **Verification:** `grep -c "Wave 1 (123-03..123-07) now complete\." .planning/STATE.md` = 0 after the edit (was 2 before); `## Project Reference` paragraph re-read after edit.
- **Committed in:** see the docs commit recording this plan's completion.

**Impact on plan:** Both are scope-honest correctness fixes with no architectural change, no new files beyond the plan's own two, and no dependency added.

## Issues Encountered

None beyond the two documented above (both resolved, neither blocking).

## User Setup Required

None. All verification ran against the pre-existing `dev:noauth` server on `:5181`, already running per the dispatch; no new server was started.

## Next Phase Readiness

- `e2e/a11y-routes.ts` is now the single source of truth for "what routes exist" and "how do we know each one rendered" -- available to 123-08 through 123-13 for any further sweep or widened-scan work.
- The widened 188-cell `A11Y_SCAN_ALL=1` scan has been enumerated (`--list` = 189) but not yet run to completion end-to-end -- `123-VALIDATION.md`'s Sampling Rate section calls for that run "before `/gsd-verify-work`", not necessarily in this plan; left for whichever later plan or the phase-close checkpoint owns that measurement.
- No blockers.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*
