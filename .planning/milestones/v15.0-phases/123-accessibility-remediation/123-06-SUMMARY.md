---
phase: 123-accessibility-remediation
plan: 06
subsystem: ui
tags: [aria, axe-core, accessibility, pageheader, react, tailwind]

requires:
  - phase: 123-accessibility-remediation
    provides: "plans 123-04/123-05 cleared color-contrast on /forge, leaving aria-prohibited-attr as the only remaining rule id on that route"
provides:
  - "Zero aria-prohibited-attr violations on /forge in all 4 themes (role=status on the loading div)"
  - "D-06's named ARIA floor (ForgeJobList.tsx + SkillReviewDrawer.tsx) measured and resolved"
  - "/forge adopts PageHeader (TOKEN-05's deferred partial, D-09), closing the file's ratchet exemption"
affects: [123-13]

tech-stack:
  added: []
  patterns:
    - "Isolated axe-core scans (minimal standalone HTML + AxeBuilder against a file:// URL) as a measurement technique when the real component can't easily be driven into the state under test (SkillReviewDrawer needs live skill-review data; not on a measured route)"

key-files:
  created: []
  modified:
    - src/components/forge/ForgeJobList.tsx
    - src/pages/ForgePage.tsx
    - src/tokenSweep.ratchet.test.ts

key-decisions:
  - "role=\"status\" fixes ForgeJobList.tsx's aria-prohibited-attr violation (axe's own message names aria-label, not aria-busy, as the prohibited attribute on a role-less div)"
  - "SkillReviewDrawer.tsx's aria-busy site needed no code change -- its <li> carries the implicit listitem role, which does not prohibit aria-busy, confirmed by an isolated axe-core scan of the exact markup"
  - "aria-selected on ForgeJobList.tsx:227 never fires -- confirmed by a full post-fix e2e axe capture against /forge (0 violations of any rule id), left unmodified"

requirements-completed: [A11Y-02]

duration: ~20min (task-commit span 11:55:38-11:58:59 -04:00; excludes measurement/research time before the first commit, which was not separately timestamped)
completed: 2026-08-20
---

# Phase 123 Plan 06: Forge ARIA Fixes + PageHeader Adoption Summary

**Added `role="status"` to clear the 4 `aria-prohibited-attr` objects on `/forge` and converted `ForgePage.tsx` to `PageHeader`, closing its ratchet exemption in the same change.**

## Performance

- **Duration:** ~20 min (see frontmatter note)
- **Completed:** 2026-08-20T15:58:59Z
- **Tasks:** 2/2
- **Files modified:** 3 (`ForgeJobList.tsx`, `ForgePage.tsx`, `tokenSweep.ratchet.test.ts`) + 4 new capture JSONs

## Accomplishments
- Cleared the entire non-contrast half of A11Y-02's violation matrix: `aria-prohibited-attr` went from 4 objects (1/theme) to 0, verified by a real post-fix e2e axe capture against `/forge` in all 4 themes.
- Resolved D-06's named ARIA floor by measurement rather than pattern-matching: the two sibling `aria-busy` sites needed different remedies, and forcing the same fix onto both would have been wrong.
- Closed TOKEN-05's deferred partial (D-09): `/forge` now renders through `PageHeader`, and the ratchet's `ForgePage.tsx` exemption is deleted, with a mutation proof showing the ratchet actually guards the file now.

## Task Commits

1. **Task 1: Fix the measured aria-prohibited-attr violation and the named ARIA floor** - `d7df647f` (fix)
2. **Task 2: Adopt PageHeader on /forge and remove its ratchet exemption** - `25fe59ba` (fix)

_No separate plan-metadata commit; this SUMMARY.md is committed on its own below._

## Files Created/Modified
- `src/components/forge/ForgeJobList.tsx` - added `role="status"` to the loading-state div (`:171-176`)
- `src/pages/ForgePage.tsx` - replaced the hand-rolled `<h1>`/button header with `<PageHeader title="Forge" className="mb-0 shrink-0" actions={...} />`
- `src/tokenSweep.ratchet.test.ts` - deleted the `ForgePage.tsx` `KNOWN_EXEMPT` entry (`pageheader` bucket)
- `.planning/phases/123-accessibility-remediation/a11y-aria/{cyan,emerald,aubergine,readable}__Forge.json` - post-fix capture evidence (Task 1)

## Measurement Record (required by plan `<output>`)

**Capture `message` string that chose the ARIA remedy** (from `.planning/phases/122-tokens-primitives-contrast-measurement/a11y-after/cyan__Forge.json`, the frozen pre-fix capture):

> "aria-label attribute cannot be used on a div with no valid role attribute."

`messageKey: "noRoleSingular"`, `prohibited: ["aria-label"]`. `aria-busy` was never the prohibited attribute — this ruled out remedy (b) (moving `aria-label` off the div) and confirmed remedy (a): give the div an explicit `role` that permits both attributes. Chose `role="status"` (a live-region role; also makes the skeleton announce to assistive tech, matching the loading semantics).

**Floor sites: did they need the same remedy or different ones?** Different. Confirmed by isolated `axe-core` (v4.12.1, same version the real e2e harness resolves) scans against minimal standalone documents reproducing each site's exact markup (constructed because `SkillReviewDrawer` isn't on a measured route and its review-queue state isn't trivially reachable without live skill data):

- `ForgeJobList.tsx` loading div (bare `<div>`, no implicit role) + `aria-busy` + `aria-label` → **violated** `aria-prohibited-attr` before the fix; adding `role="status"` → 0 violations.
- `SkillReviewDrawer.tsx` `<li aria-busy={...}>` inside a `<ul>` (implicit `listitem` role) → **0 violations**, with or without a fix. `listitem` is not one of the roles (`generic`, `presentation`, `code`, `paragraph`, etc.) that prohibits global ARIA states, so `aria-busy` alone is already legal there. No code change made. This is a measured result, not a guess: the scratch scan and its raw output are reproducible (script deleted after use; recipe recorded here — minimal HTML with `<html lang><head><title>` boilerplate + the exact `<ul class="flex flex-col gap-3"><li class="..." aria-busy="true">` markup, scanned with `AxeBuilder({page}).withTags(["wcag2a","wcag2aa"]).analyze()`).

**`aria-selected` outcome** (`ForgeJobList.tsx:227`, RESEARCH Assumption A2): resolved negative by measurement. Ran the real e2e capture —
```
PW_BASE_URL=http://localhost:5181 A11Y_MEASURE_ONLY=1 A11Y_CAPTURE_DIR=.planning/phases/123-accessibility-remediation/a11y-aria/ node_modules/.bin/playwright test e2e/theme-contrast.spec.ts --grep "Forge"
```
against the live `dev:noauth` server after the `role="status"` fix — all 4 theme captures report `violationCount: 0`, `violations: []`. `aria-selected` on the bare `<button>` never fired. Left unmodified, per the plan's explicit "either outcome is a result; guessing is not."

**Must-differ control:** the pre-fix `a11y-after/*__Forge.json` captures (Phase 122, frozen, never regenerated) show `aria-prohibited-attr` present (1 object/theme, 4 total) using the same axe engine — proving the probe detects the violation when it exists. In the *current* state, `color-contrast` is also 0 in both the pre- and post-fix Forge captures here, because plans 123-04 and 123-05 already cleared it before this plan ran. That is the observed state, not an assumption — recorded per the acceptance criteria's "state which state was observed."

**Ratchet mutation proof (Task 2):** with the `KNOWN_EXEMPT` entry deleted, reverted `ForgePage.tsx` to its pre-conversion content via `git checkout --` (backed up first) — `npm test -- src/tokenSweep.ratchet.test.ts` **failed** both `D-25` and `D-26`, each naming `["src/pages/ForgePage.tsx"]`. Restored the conversion from the backup — the same run **passed** (13 passed, 2 skipped; the 2 skips are `D-25`/`D-26`'s unrelated `dist/assets/*.css` duration-bucket half). Confirms the ratchet actually guards `ForgePage.tsx` now rather than merely no longer exempting it.

**`/forge` header spacing:** NOT verified here. `className="mb-0 shrink-0"` is applied by construction (`cn()`/twMerge makes the caller's `mb-0` win over `PageHeader`'s baked-in `mb-4`, same idiom as `LiveRun.tsx:209`), but per D-09's non-negotiable rider this is queued for D-18's operator checkpoint in plan `123-13`, not claimed as passed in this plan.

## Decisions Made
- `role="status"` over moving `aria-label` off the div: the capture's own message named `aria-label` (not the div's lack of a role generically, nor `aria-busy`) as the specific defect, and `role="status"` is the more semantically correct fix for a loading region (it also gets the skeleton announced to screen readers, which the original markup's `aria-live`-adjacent intent already implied via `aria-busy`).
- Left `SkillReviewDrawer.tsx` unmodified rather than pattern-matching the Forge fix onto it, after confirming via isolated axe scan that its `<li>` (implicit `listitem` role) does not trigger `aria-prohibited-attr` with `aria-busy` alone. Applying `role="status"` there anyway was considered and rejected: it would be an unmeasured cosmetic change outside D-06's "measurement-defined, no hand-census" discipline, and `<li>` already has a role (`role="status"` on an `<li>` inside a `<ul>` would itself remove the item from the list's accessible structure, a regression, not an improvement).
- No plan-metadata-only commit; this SUMMARY.md commits standalone per the sequential-executor's required order (Write → commit → narration).

## Deviations from Plan

**1. [Measurement, not a defect] SkillReviewDrawer.tsx required no code change**

- **Found during:** Task 1
- **Plan expectation:** `files_modified` frontmatter and the task's `<files>` list both name `SkillReviewDrawer.tsx` as a file to change; the plan's own text anticipated it "may" need a different remedy from Forge's, but did not anticipate "no remedy at all."
- **Measurement:** Isolated axe-core scan (recipe above) of the exact `<li aria-busy={...}>` markup inside a `<ul>` returned zero `aria-prohibited-attr` violations. `listitem` is a valid implicit role that does not prohibit `aria-busy`, unlike Forge's role-less `<div>`.
- **Resolution:** Left the file unchanged. This satisfies D-06's floor requirement ("fixed regardless of whether it renders during a scan") by proof of existing compliance rather than by mutation — the plan itself instructs "Do not pattern-match one onto the other," which extends to not inventing a fix where measurement shows none is needed.
- **Verification:** Isolated axe-core scan output (axe-core 4.12.1); `npm test -- src/components/skills` (13/13 tests in that dir, part of the 370 passing) confirms no behavioral regression from leaving the file untouched.
- **Committed in:** N/A — no diff to commit for this file.

---

**Total deviations:** 1, non-code (a planned file turned out to need no change, confirmed by direct measurement rather than assumption).
**Impact on plan:** None on scope or correctness — the plan's own decision text (D-06) explicitly subordinates its file list to what axe measures, and the acceptance criteria ("the floor is 2 sites in 2 files... both floor sites remedied per what axe actually objects to") are satisfied: 2 sites in 2 files, one needed a code fix, one needed none, both confirmed by measurement.

## Issues Encountered
None beyond the above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/forge`'s `aria-prohibited-attr` population is at 0 across all 4 themes; combined with 123-04/123-05's `color-contrast` clearance, `/forge` should now be clean under `e2e/theme-contrast.spec.ts`'s full (non-`A11Y_MEASURE_ONLY`) assertion — not re-run here since this plan's scope was the two named tasks, not the full-suite gate (that belongs to whichever plan runs A11Y-02's final closing verification).
- `/forge` header spacing is an explicit open item for D-18's operator checkpoint in plan `123-13` — flag this when that plan runs so the checkpoint actually inspects `/forge` by name, per the rider.
- The `tokenSweep.ratchet.test.ts` `pageheader` bucket now has exactly one exemption (`Chat.tsx`, a genuine design exemption) and zero deferrals; any future page hand-rolling a header will be caught by the ratchet rather than silently passing.

---
*Phase: 123-accessibility-remediation*
*Completed: 2026-08-20*
