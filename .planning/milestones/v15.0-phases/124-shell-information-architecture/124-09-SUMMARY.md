---
phase: 124-shell-information-architecture
plan: 09
subsystem: ui
tags: [react-router, breadcrumb, navRegistry, dropdown-menu, accessibility, vitest]

# Dependency graph
requires:
  - phase: 124-shell-information-architecture (plans 01-08)
    provides: navGroups four-domain regroup (124-04), header right zone with the "..." overflow
      menu holding theme/privacy/CRT/ambient audio (124-07), the system chip (124-08)
provides:
  - "getBreadcrumbTrail(pathname) — a pure, registry-derived path-to-trail function"
  - "Zone 1 breadcrumb (>=md), hamburger unchanged (<md) — the deleted telemetry pill's replacement"
  - "SYS/LAT relocated into the overflow menu as non-interactive figures, real-or-hidden contract intact"
  - "Zone 2 command bar at 420px max-width"
  - "32x32px hit areas on the hamburger and mobile close-X"
affects: [124-10 (header height measurement), 125 (Signal Horizon attaches under this header)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Breadcrumb derivation reads navGroups directly rather than maintaining a second route->label map"
    - "DropdownMenuLabel (not DropdownMenuItem) for read-only figures inside a menu that must not gain a new control"

key-files:
  created:
    - src/lib/breadcrumbs.ts
    - src/lib/__tests__/breadcrumbs.test.ts
  modified:
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx

key-decisions:
  - "Corrected the UI-SPEC's /sessions/:id example from 'System / Executions' to 'Observe / Executions' — /executions is locked-map row 14, Observe, not System."
  - "Breadcrumb population check hardcodes the four domain names rather than deriving them from navGroups, so the check cannot become circular (a navGroups edit that adds a fifth domain must not silently add that domain to the check's own known set)."
  - "SYS/LAT render via DropdownMenuLabel, not DropdownMenuItem, so they stay non-interactive figures and the menu's control count (4) does not change."

patterns-established:
  - "Pure derivation module + population test iterating the live registry, proven to discriminate via a temporary fifth-domain mutation, reverted with a byte-identical git diff."

requirements-completed: [SHELL-01]

# Metrics
duration: ~35min
completed: 2026-08-21
---

# Phase 124 Plan 09: Breadcrumb + Header Zone 1/2 Cleanup Summary

**Registry-derived "Domain / Page" breadcrumb replaces the deleted telemetry pill; SYS/LAT relocate into the overflow menu as read-only figures under their original Phase-96 real-or-hidden gating; zone 2 widens to 420px.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files modified:** 4 (2 created, 2 modified), plus 1 follow-up fix to 1 already-modified file

## Accomplishments

- `src/lib/breadcrumbs.ts`: pure `getBreadcrumbTrail(pathname)` deriving `[Domain, Label]` from `navGroups` for the 44 mapped routes, plus a 7-entry `DETAIL_ROUTE_PARENTS` override table (the six param routes + `/settings`). Unmapped/unmatched paths return `[]` — never a guessed segment.
- Zone 1 (`>=md`) now renders the breadcrumb inside `<nav aria-label="Breadcrumb">`; the hamburger (`<md`) is unchanged in position and behavior. The "Astridr Runtime Telemetry" pill (decorative pulse dot + cyan-as-wallpaper, both POLISH-01 kill-list shapes) is deleted entirely.
- SYS/LAT moved into the existing `⋯` overflow menu as a `DropdownMenuLabel` block below a `DropdownMenuSeparator` — non-interactive, so the menu's control count stayed at 4. `showSys`/`showLat` gate them exactly as before (Phase 96 F3/D-04's real-or-hidden contract).
- Zone 2's command bar: `max-w-sm` (384px) → `max-w-[420px]` (sketch §7's design-law target); nothing else about it changed.
- Hamburger and mobile close-X bumped from 24×24px to 32×32px hit areas (WCAG 2.2 target) while this file was open for other reasons.
- Three Phase 96 telemetry tests repaired to open the `⋯` menu before asserting, proven (via a temporary gate-removal mutation) to still discriminate a broken gate from a working one. Four new breadcrumb test cases added.

## Task Commits

1. **Task 1: Breadcrumb derivation module** — `f423873e` (feat)
2. **Task 2: Wire zone 1, delete the pill, relocate SYS/LAT, retarget zone 2's width** — `8eee0086` (feat)
3. **Task 3: Repair and strengthen the SYS/LAT tests, and assert the breadcrumb on real routes** — `366404bb` (test)
4. **Follow-up fix (found by `npm test` after Task 3): reword a Task 2 comment that tripped the D-25 em-dash ratchet** — `9fe3a160` (fix)

## Files Created/Modified

- `src/lib/breadcrumbs.ts` — pure path→trail derivation, `DETAIL_ROUTE_PARENTS` override table
- `src/lib/__tests__/breadcrumbs.test.ts` — 9 tests incl. a population check iterating `navItems`
- `src/layouts/DashboardLayout.tsx` — zone 1 breadcrumb, pill deletion, SYS/LAT relocation, zone 2 width, hit-area bumps
- `src/layouts/__tests__/DashboardLayout.test.tsx` — 3 repaired telemetry tests + 4 new breadcrumb tests, hoisted `openOverflowMenu` to module scope

## Decisions Made

- **UI-SPEC correction:** an earlier draft of `124-UI-SPEC.md` showed `/sessions/:id` as `"System / Executions"`. The locked 44-row map in `124-CONTEXT.md` puts `/executions` in **Observe** (row 14), so the correct trail is `"Observe / Executions"`. `breadcrumbs.ts`'s `DETAIL_ROUTE_PARENTS` and its module docstring use the locked map; the UI-SPEC prose is stale on that one row and is not itself edited by this plan (out of this plan's `files_modified` scope).
- **Population check hardcodes the four domain names** (`Command`, `Observe`, `Agents`, `System`) rather than deriving them from `navGroups` — deriving them from `navGroups` would make the check circular: an edit that adds a fifth domain to `navGroups` would add that same domain to the check's own "known" set, and the check could never fail. Verified live (see Mutation Proofs below).
- **SYS/LAT render via `DropdownMenuLabel`, not `DropdownMenuItem`** — a `DropdownMenuLabel` is Radix's non-interactive text-slot primitive (no `role="menuitem"`, not focusable, not selectable), which keeps them read-only figures rather than a fifth/sixth control. Confirmed post-implementation: `grep -c "<DropdownMenuItem" src/layouts/DashboardLayout.tsx` returns **4** (theme, privacy, CRT, ambient audio — unchanged from 124-07), and no "Help" string exists anywhere in the file.

## Load-Bearing-Facts Verification

1. **Test-integrity (highest risk item).** All three SYS/LAT tests repaired, not deleted, not weakened. Mutation proof (both the inner `showSys` gate and the enclosing `(showSys || showLat)` gate had to be forced `true` together — the enclosing gate alone hides the inner one when `showLat` is also false in that test's mocks):
   - **Before revert (mutation applied), targeted run:**
     ```
     FAIL  src/layouts/__tests__/DashboardLayout.test.tsx > DashboardLayout header telemetry (F3/D-04 — honest, real-or-hidden) > hides SYS when systemResources.current returns null
     AssertionError: expected element to not be in the document ... <span ...>SYS: <span>0%</span></span> instead
     Test Files  1 failed (1)
          Tests  1 failed | 33 skipped (34)
     ```
   - **After revert** — `diff` against a pre-mutation backup of `DashboardLayout.tsx` returned **byte-identical**, and:
     ```
     Test Files  1 passed (1)
          Tests  30 passed | 4 todo (34)
     ```
   This is real proof, not a read of the test text: the repaired hidden-case test genuinely fails when the gate breaks and genuinely passes when it doesn't.

2. **Breadcrumb domain names** derived live from `navGroups`/`navItems` (Task 1's population check), not from memory — see the correction above for the one place a written artifact (the UI-SPEC) disagreed with the locked map.

3. **`/sessions/:id` correction** — recorded above and in `src/lib/breadcrumbs.ts`'s own module docstring and in `breadcrumbs.test.ts`'s test title.

4. **`/settings`** — handled explicitly: `getBreadcrumbTrail("/settings")` returns `["Settings"]` (single segment, no domain, per D-04). Covered by a dedicated unit test and a `DashboardLayout.test.tsx` mount-at-`/settings` case.

5. **`⋯` menu control count.** `grep -c "<DropdownMenuItem" src/layouts/DashboardLayout.tsx` = **4** (unchanged). SYS/LAT are a single `DropdownMenuLabel`, non-interactive. No "Help" entry exists (unchanged from 124-07; `grep -niE "help" src/layouts/DashboardLayout.tsx` returns 0 matches in this file's live code, confirmed by the existing `queryByText(/\bhelp\b/i)` test that still passes).

## Mutation Proofs (verbatim output)

### Task 1 — population check discriminates on a fifth domain

Mutation: temporarily inserted a `{ group: "Zebra", items: [{ to: "/__mutation-proof-fifth-domain", ... }] }` group at the front of `navGroups` in `src/lib/navRegistry.ts`.

```
 FAIL  src/lib/__tests__/breadcrumbs.test.ts > getBreadcrumbTrail > every registered nav item derives a two-segment trail whose first segment is one of the four known domains
AssertionError: unknown domain for /__mutation-proof-fifth-domain: Zebra: expected false to be true
 Test Files  1 failed (1)
      Tests  1 failed | 8 passed (9)
```

Reverted; re-run:

```
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

`git diff --exit-code -- src/lib/navRegistry.ts` → **exit 0** (byte-identical to HEAD before the mutation).

### Task 3 — showSys-gate-removed mutation (see Load-Bearing-Facts item 1 above for the full transcript)

Both mutation transcripts are reproduced above rather than duplicated; this section exists so the plan's separate "Mutation Proofs" and "verification" requirements both point at one place.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded a Task 2 comment that tripped `src/tokenSweep.ratchet.test.ts`'s D-25 em-dash ratchet**
- **Found during:** post-Task-3 `npm test` full-suite run (not caught by the plan's own scoped `npx vitest run` verify commands, which don't include this file)
- **Issue:** the SYS/LAT relocation comment in Task 2 quoted a literal em dash (`"—"`) on a JSX-comment continuation line that does not itself start with `//`, `/*`, or a JSDoc `*` — the ratchet's `isCommentLine` filter only recognizes those three markers, so the line read as a rendered value-slot placeholder rather than prose about one. This is the exact false-positive shape the ratchet's own design doc calls out for `RadialGauge.tsx`'s JSDoc, and my comment fell into a sibling trap (a plain indented JSX-comment continuation line, not a JSDoc one).
- **Fix:** reworded the two words ("placeholder dash", "fabricated zero") to drop the literal character; no behavior change.
- **Files modified:** `src/layouts/DashboardLayout.tsx`
- **Verification:** `npx vitest run src/tokenSweep.ratchet.test.ts` — 15/15 passing after the fix (was 13/15, both failures on the same em-dash bucket in different tests). Full `npm test` afterward: 350 files / 4938 tests passing, 0 failing.
- **Committed in:** `9fe3a160`

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1)
**Impact on plan:** No scope creep; the fix is a comment reword with no behavior change, caught by the plan's own required full-suite verification step.

## Verification

- `npx tsc --noEmit` — **exit 0**, both after Task 2 and again after the final fix.
- `npx vitest run src/lib/__tests__/breadcrumbs.test.ts src/layouts/__tests__/DashboardLayout.test.tsx` — **2 files passed, 43 tests passed, 4 todo** (the 4 pre-existing `test.todo` placeholders in the Sidebar describe block, unrelated to this plan).
- `npm test` (full suite, run after the D-25 fix) — **350 files passed | 17 skipped (367)**, **4938 tests passed | 195 todo (5133)**, **0 failing**.
- `git diff --name-only -- convex/ | wc -l` → **0**.
- `git diff -- src/layouts/DashboardLayout.tsx | grep -c '^[-+].*min-h-14'` → **0** (checked across the full plan range `af25b5e7..HEAD`, not just the last commit).
- `git diff --exit-code -- src/components/PageHeader.tsx` → **exit 0**.
- `git diff --exit-code -- src/lib/__tests__/navRegistry.routes.test.ts` → **exit 0**; that suite independently green (4/4).
- Zero hardcoded hex added: `git diff af25b5e7..HEAD -- <this plan's 4 files> | grep '^+' | grep -oE '#[0-9a-fA-F]{3,8}'` → **0 matches**.
- `git diff --name-only af25b5e7..HEAD -- src/components/voice/` → **0** (untouched, per the shared-checkout scope fence).
- `git diff --name-only af25b5e7..HEAD -- .planning/STATE.md .planning/ROADMAP.md` → **0** (untouched, orchestrator-owned).
- `showSys`/`showLat` grep counts in `DashboardLayout.tsx`: **3/3 before, 3/3 after** — unchanged (the gating logic moved location but the literal occurrence count is identical: one declaration + two usage sites each).
- `grep -c "SYS:"` in `DashboardLayout.test.tsx`: **2 before, 2 after** — unchanged (contract repaired, not deleted).

## Shared-Checkout Hygiene

Every commit's `git show --stat HEAD` was read immediately after committing; none showed an unexpected file. `git diff --cached --name-only` was checked before each `git add`/commit and matched exactly the intended file(s) each time. No `git add -A`, no `--amend`, no `git stash`, no `git reset --hard`, no touches to `src/components/voice/`.

## Issues Encountered

None beyond the D-25 ratchet false-positive documented above, which was found and fixed within this plan's own required verification steps.

## Next Phase Readiness

- Zone 1/2/3 of SHELL-01's header are now feature-complete under this plan's scope: breadcrumb, command bar, and the six-item right zone with SYS/LAT relocated. The one remaining open item for the header is D-06's own header-height re-measurement (48px vs. the current `min-h-14 flex-wrap` fallback), explicitly deferred to **124-10** — this plan did not touch header height classes, `<header>`'s own POLISH-06 comment, or `PageHeader.tsx`, per the scope fence.
- No blockers for 124-10. The breadcrumb's presence (rendered content on the left) is new input to that plan's combined min-content-width measurement, so 124-10 should measure with this plan's changes in place (it will — this commit range lands before 124-10 runs).

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
