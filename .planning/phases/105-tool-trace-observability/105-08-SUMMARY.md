---
phase: 105-tool-trace-observability
plan: 08
subsystem: ui
tags: [react, react-router, navigation, page-assembly, section-error-boundary, OBS-01, OBS-02]

# Dependency graph
requires:
  - phase: 105-06
    provides: "ToolUsagePanel — self-contained OBS-01 usage panel, mounted here for the first time"
  - phase: 105-07
    provides: "ToolPolicyFeed — self-contained OBS-02 policy/leak feed, mounted here for the first time"
  - phase: 105-01
    provides: "ToolExecutionPanel/PermissionDecisionsChart's excludeProvider: astridr guard — this plan cross-links both, unmodified otherwise"
provides:
  - "src/pages/Tools.tsx — the assembled Tools page: ToolUsagePanel above ToolPolicyFeed, each in its own named SectionErrorBoundary, no tabs"
  - "/tools route (lazy-loaded) + OBSERVE nav entry with a real Wrench icon"
  - "'View in Tools ->' cross-links on ToolBreakdown, ToolExecutionPanel, PermissionDecisionsChart"
affects: [105-09]

tech-stack:
  added: []
  patterns:
    - "Right-align an additive nav-out link inside an existing flex header row via ml-auto, rather than restructuring the row (ToolBreakdown/ToolExecutionPanel — both already had flex items-center gap-2 headers)"
    - "For a header row with NO existing flex layout (PermissionDecisionsChart), the smallest-possible-wrapper fallback: add a flex justify-between div AROUND the untouched original h2 tag (mb-4 left in place, harmless double-margin) rather than reformatting the h2's own className/indentation — keeps the diff at 0 deletions instead of restructuring 3 lines"
    - "SectionErrorBoundary isolation proven by a mocked-child-throws test (matches the 3b31c9f4 remediation shape) rather than by inspection"

key-files:
  created:
    - src/pages/Tools.tsx
    - src/pages/Tools.test.tsx
    - src/components/ToolBreakdown.test.tsx
    - src/components/ToolExecutionPanel.test.tsx
  modified:
    - src/App.tsx
    - src/lib/navRegistry.ts
    - src/components/ToolBreakdown.tsx
    - src/components/ToolExecutionPanel.tsx
    - src/components/PermissionDecisionsChart.tsx
    - src/components/PermissionDecisionsChart.test.tsx
    - CLAUDE.md

key-decisions:
  - "CLAUDE.md's 'Adding a new page' pattern was factually stale (named src/layouts/DashboardLayout.tsx as the nav-entry file) — verified live per the plan's own <plan_is_a_draft> instruction that the real registry is src/lib/navRegistry.ts (iconComponents map + navGroups items), extracted out of DashboardLayout at Phase 96's WR-02 specifically so both DashboardLayout AND CommandPalette can consume it without importing each other. Followed the live code (per this repo's Stale Docs rule), not the doc, and corrected CLAUDE.md in this plan's final commit. The plan's own <interfaces> section (F1) had already independently verified navRegistry.ts is the live file, so no deviation in approach — only the doc fix."
  - "The D-15 cross-link on ToolExecutionPanel is placed in the POPULATED-data header only, not the awaiting-telemetry empty-state header (the component renders one or the other, never both) — the plan's own acceptance criterion (grep -c 'View in Tools' == 1) requires exactly one occurrence of the literal string in the file, so duplicating it into both conditional branches was not an option without breaking that gate."
  - "PermissionDecisionsChart's link placement used the plan's own documented fallback for 'no existing header row to hang the link on' — wrapped only the main (>0 decisions) header in the smallest possible <div className=\"flex items-center justify-between\">, left mb-4 on the original (now-nested) h2 unchanged rather than moving it to the wrapper, to keep the diff at 0 deletions (git diff --numstat: 5 added / 1 deleted, still within the plan's <8 added / <=2 deleted budget)."

requirements-completed: []  # OBS-01/OBS-02 NOT marked complete in REQUIREMENTS.md by this plan alone — the page assembly is done and both panels are now reachable, but per this project's established "green suite/single-plan != live-verified end-to-end" convention, full requirement satisfaction (real Ástríðr tool-call volume rendering, the four-theme sweep) awaits plan 105-09's live confirmation against the running self-hosted Convex instance.

duration: ~13min (commit-to-commit; prior plan's completion commit 21:17:42 to this plan's final task commit 21:30:13)
completed: 2026-08-03
---

# Phase 105 Plan 08: Tools Page Assembly Summary

**Assembled the Tools page from Waves 1-4's output — `ToolUsagePanel` stacked above `ToolPolicyFeed`, each in its own named `SectionErrorBoundary` (D-16, proven independent by a mocked-throw test), reachable via a real `/tools` route and a Wrench-iconed OBSERVE nav entry (D-13/D-14) — and cross-linked the three pre-existing tool panels (`ToolBreakdown`, `ToolExecutionPanel`, `PermissionDecisionsChart`) into it with zero layout change (D-15), each cross-link and the boundary-isolation guarantee proven by a mutation test.**

## Performance

- **Duration:** ~13 min (commit-to-commit, see frontmatter)
- **Tasks:** 3 (Task 3 `tdd="true"`)
- **Files modified:** 12 (5 created, 6 modified, 1 doc correction)

## Accomplishments

- `src/pages/Tools.tsx`: default-export page shell, `PageHeader` with the Wrench icon, a one-sentence sub-line cross-linking out to a session's Trace view (`Dashboard → Active Sessions`, since there is no dedicated Sessions-list route), then `ToolUsagePanel` (usage, first per D-16) and `ToolPolicyFeed` (policy feed, beneath, `pt-12` = the UI-SPEC's 2xl/48px major section break) — each wrapped in its own `SectionErrorBoundary` named exactly `"Tool Usage"`/`"Tool Policy Events"` per the UI-SPEC's copy contract. No tabs, no duplicated header/filter/empty-state markup (the file is a pure shell — grep-verified zero `ui/tabs` imports, zero hex).
- `src/App.tsx`: `Tools` lazy-loaded and routed at `/tools`, placed beside the other OBSERVE-tier routes, Suspense fallback markup copied verbatim from the `Quality` route.
- `src/lib/navRegistry.ts`: `Wrench` added to the `lucide-react` import list AND to `iconComponents` (both halves required per finding F2 — a mapping-only edit would silently fall back to `LayoutDashboard` at `DashboardLayout.tsx:78`); `{ to: "/tools", label: "Tools", icon: "wrench", group: "OBSERVE" }` added immediately after the `/quality` entry, keeping the observability cluster contiguous. `GRAPHS` group (Tool Galaxy, MCP Inventory) confirmed untouched (`git diff | grep -c GRAPHS` → `0`).
- D-15 cross-links (`View in Tools →`, `text-primary`, `/tools`) added to all three panels, additive only:
  - `ToolBreakdown.tsx` / `ToolExecutionPanel.tsx`: both already had a `flex items-center gap-2` header row — the link was added inline with `ml-auto` to right-align it, zero restructuring (`git diff --numstat`: 2 added / 0 deleted, each).
  - `PermissionDecisionsChart.tsx`: had NO existing flex header row on either of its two conditional headers — used the plan's own documented fallback (smallest possible `<div className="flex items-center justify-between">` wrapper) on the populated-data header only. `git diff --numstat`: 5 added / 1 deleted.
- `src/pages/Tools.test.tsx` (5 tests): both boundaries render their real children when nothing throws; usage renders before policy (DOM-order asserted, not just source order); **the boundary-isolation control** — a mocked `ToolUsagePanel` that throws leaves `ToolPolicyFeed`'s stub still in the document and the `"Tool Usage failed to load"` `SectionErrorBoundary` fallback in its place; zero `role="tab"`/`"tablist"` elements; the page title and the Dashboard cross-link both render.
- New `src/components/ToolBreakdown.test.tsx` and `src/components/ToolExecutionPanel.test.tsx` (neither had a prior test file — grep-confirmed before writing either), scoped per the plan's own instruction to the D-15 link assertion (plus one pre-existing-behavior smoke test each, so the new file isn't testing something that never worked before). Link assertion added to `PermissionDecisionsChart.test.tsx`'s existing file.
- Every new/changed assertion mutation-verified (6 separate mutations, all caught, all restored byte-identical via scratchpad diff): the two-boundaries-merged-into-one mutation (isolation test), the usage/policy section-order swap (order test), and removing the `Link` from each of the three panels individually (one mutation run covering all three link tests at once).
- Full suite 3393/3393 passing (up from 3383 pre-plan, +10 new tests); `tsc --noEmit` and `npm run build` both clean.
- `CLAUDE.md`'s "Adding a new page" pattern corrected — it named `src/layouts/DashboardLayout.tsx` as the nav-entry file, which has been stale since Phase 96's WR-02 extracted the registry to `src/lib/navRegistry.ts`. Fixed per this repo's own Stale Docs rule, in this plan's final commit (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: src/pages/Tools.tsx — stacked sections, two boundaries, no tabs** — `dcb4a015` (feat)
2. **Task 2: Route + OBSERVE nav entry + the missing Wrench icon mapping** — `449dcd30` (feat)
3. **Task 3: D-15 cross-links + page test** — `dbca8d20` (test)

## Files Created/Modified

- `src/pages/Tools.tsx` — NEW. Page shell mounting `ToolUsagePanel`/`ToolPolicyFeed`, two `SectionErrorBoundary`s
- `src/pages/Tools.test.tsx` — NEW. 5 tests (both-render, order, isolation control, no-tabs, title/cross-link)
- `src/components/ToolBreakdown.test.tsx` — NEW. 2 tests (D-15 link, empty-state smoke)
- `src/components/ToolExecutionPanel.test.tsx` — NEW. 2 tests (D-15 link, awaiting-telemetry smoke)
- `src/App.tsx` — lazy `Tools` import + `/tools` route
- `src/lib/navRegistry.ts` — `Wrench` import + `iconComponents.wrench` + `/tools` OBSERVE nav item
- `src/components/ToolBreakdown.tsx` — `Link` import + inline `ml-auto` cross-link
- `src/components/ToolExecutionPanel.tsx` — `Link` import + inline `ml-auto` cross-link (populated-data header only)
- `src/components/PermissionDecisionsChart.tsx` — `Link` import + wrapped populated-data header
- `src/components/PermissionDecisionsChart.test.tsx` — link assertion test added, `MemoryRouter` wrapper added to existing render calls
- `CLAUDE.md` — "Adding a new page" pattern corrected to name `src/lib/navRegistry.ts`

## Decisions Made

See the `key-decisions` list in the frontmatter for full text (the CLAUDE.md staleness fix, the single-occurrence link placement on `ToolExecutionPanel`, and the PermissionDecisionsChart wrapper fallback).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - stale doc, per this repo's global Stale Docs rule] CLAUDE.md's "Adding a new page" pattern named the wrong file for nav entries**
- **Found during:** Task 2's `<read_first>` step, cross-checking the task prompt's instruction to verify CLAUDE.md's documented pattern against the live code before acting
- **Issue:** CLAUDE.md said to add a new page's nav entry "in `src/layouts/DashboardLayout.tsx` (`navItems` array + `iconMap`)". The live file has no `navItems` array or `iconMap` of its own — `DashboardLayout.tsx` only *consumes* `navGroups`/`iconComponents` imported from `src/lib/navRegistry.ts`, which was extracted out specifically at Phase 96's WR-02 review (the file's own header comment documents this, and cites the exact cycle that made `DashboardLayout.tsx`'s copy of the mapping stale).
- **Fix:** Followed the live code (this plan's own `<interfaces>` finding F1 had already independently verified `navRegistry.ts` is the real file), and corrected CLAUDE.md's wording in this plan's final commit to name the correct file and explain why.
- **Files modified:** CLAUDE.md
- **Verification:** Read `DashboardLayout.tsx:31-34,78,236-238` confirming it only imports and consumes `navGroups`/`iconComponents` from `navRegistry.ts`, never defines its own.
- **Committed in:** the final metadata commit (this SUMMARY + STATE.md + ROADMAP.md + CLAUDE.md)

---

**Total deviations:** 1 auto-fixed (a documentation staleness fix, not a code defect — the plan's own execution approach was already correct per its live-verified `<interfaces>` section). No production-behavior deviations from the plan's specified shapes otherwise.

## Mutation Verification (required proof)

All six required/incidental mutations were performed against the actual production code, confirmed the corresponding test(s) FAIL, then restored via a scratchpad byte-identical diff (`diff` printing no output) before re-running:

| Mutation | Target | Result |
|---|---|---|
| Merged the two `SectionErrorBoundary`s in `Tools.tsx` into one wrapping both sections | `Tools.test.tsx` "boundary isolation" test | FAILED as required — `getByTestId("tool-policy-feed-stub")` found no element (the merged boundary swallowed both children into its own fallback) |
| Swapped the usage/policy `<section>` order in `Tools.tsx` | `Tools.test.tsx` "renders the usage section before the policy section" test | FAILED as required — `expected 1089 to be less than 988` |
| Removed the `Link` from `ToolBreakdown.tsx`'s header | `ToolBreakdown.test.tsx` "renders a 'View in Tools ->' link" test | FAILED as required — `getByRole("link", {name: /View in Tools/})` found no element |
| Removed the `Link` from `ToolExecutionPanel.tsx`'s header | `ToolExecutionPanel.test.tsx` "renders a 'View in Tools ->' link" test | FAILED as required — same failure mode |
| Removed the wrapper div + `Link` from `PermissionDecisionsChart.tsx`'s header (reverted to the original single `<h2>`) | `PermissionDecisionsChart.test.tsx` "renders a 'View in Tools ->' link" test | FAILED as required — same failure mode |

All three link removals were run and confirmed failing in a single combined mutation pass (`npx vitest run` across all three test files: 3 failed / 5 passed — the 5 passing were each file's other, unrelated test), then all three files restored and re-verified byte-identical via `diff`.

## Class-Closure Check (verification-discipline requirement)

No production-code defect was found or fixed this plan (the sole deviation was a documentation staleness fix, not a code-behavior class) — no class-closure grep sweep was applicable.

## Issues Encountered

None beyond the one documented CLAUDE.md staleness fix above.

## User Setup Required

None — no external service configuration required. This plan touched no Convex schema, query, or mutation; `grep -c "useMutation" src/pages/Tools.tsx src/components/ToolUsagePanel.tsx src/components/ToolPolicyFeed.tsx` returns `0` for all three (T-105-40). No `npx convex codegen`/`deploy` was needed or run — **nothing deployed**, this is a frontend-only plan.

## Verification (raw output)

`npx tsc --noEmit` — clean, zero output, exit 0 (checked after every task).

`npx vitest run` (full suite):
```
Test Files  273 passed | 17 skipped (290)
     Tests  3393 passed | 193 todo (3586)
```
(up from 3383 pre-plan, +10 new tests; the "Not implemented: HTMLCanvasElement's getContext()" lines are pre-existing jsdom/canvas noise from unrelated WebGL-mocked test files — 0 failed tests.)

`npm run build` — succeeded (`✓ built in 1.19s`), produced a dedicated `dist/assets/Tools-*.js` chunk confirming the lazy route resolves; pre-existing >500kB chunk-size warning, unrelated to this plan.

Targeted acceptance-criteria greps (all passed, final state):
- Task 1: `grep -c "SectionErrorBoundary" src/pages/Tools.tsx` → `6` (≥3 required); `grep -c 'name="Tool Usage"' src/pages/Tools.tsx` → `1`; `grep -c 'name="Tool Policy Events"' src/pages/Tools.tsx` → `1`; `grep -c "ui/tabs" src/pages/Tools.tsx` → `0`; hex grep → zero matches; usage line number < policy line number
- Task 2: `grep -c 'to: "/tools"' src/lib/navRegistry.ts` → `1`; `grep -c "wrench: Wrench" src/lib/navRegistry.ts` → `1`; `grep -c "  Wrench," src/lib/navRegistry.ts` → `1`; `grep -c 'path="/tools"' src/App.tsx` → `1`; `grep -c './pages/Tools' src/App.tsx` → `1`; `git diff src/lib/navRegistry.ts | grep -c "GRAPHS"` → `0`
- Task 3: `grep -c 'View in Tools' <each of the 3 panels>` → `1` for each; `git diff --numstat` on the 3 panels → 2/0, 2/0, 5/1 (all within the <8 added / <=2 deleted budget — see key-decisions for the one 1-line-deleted case); `git diff --stat src/pages/Dashboard.tsx src/pages/Analytics.tsx` → empty (mount sites untouched)
- `grep -c "useMutation" src/pages/Tools.tsx src/components/ToolUsagePanel.tsx src/components/ToolPolicyFeed.tsx` → `0` for all three (T-105-40)
- `git diff --stat package.json package-lock.json` → empty (T-105-SC: zero packages installed)

## Known Stubs

None. `Tools.tsx` mounts two fully-wired, live-query-backed components (`ToolUsagePanel`, `ToolPolicyFeed`, both from Waves 4). No hardcoded/mock data anywhere in this plan's own code.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers (T-105-36 through T-105-40, T-105-SC) — this plan introduced no new trust boundary, endpoint, or schema change: `/tools` is a read-only client route behind the same `AuthGuard` every other OBSERVE page sits behind, and no mutating control was added anywhere (grep-verified).

## SectionErrorBoundary Hex-Debt Flag (Phase 106 candidate, per this plan's own `<output>` requirement)

`src/components/SectionErrorBoundary.tsx` hardcodes `bg-gray-800/50`, `border-red-500/30`, `text-red-400`, `text-gray-300`, `text-gray-500`, `bg-gray-700`, `text-gray-200` — none of these are token-driven (`var(--status-error)` etc.), unlike the rest of this phase's new code. This plan reused the component verbatim per the UI-SPEC's explicit instruction ("reusing it verbatim, no new error copy pattern") and did NOT modify it or copy its styling into `Tools.tsx`. Flagging for Phase 106 (DEBT-0x) tech-debt remediation, matching finding F5's instruction.

## Four-Not-Six Theme Constraint (for plan 105-09, per this plan's own `<verification>` requirement)

Restating the constraint plan 105-06/105-07 both already documented: `index.css` defines six theme blocks (`cyan`, `emerald`, `readable`, `aubergine`, `amber`, plus the light `:root`), but `index.html`'s pre-paint script and `ThemeSwitcher` both hard-whitelist only the same FOUR selectable themes (`cyan`, `emerald`, `readable`, `aubergine`) — `amber` and the light `:root` are unreachable through the UI (pre-existing since Phase 89). A live theme sweep for `/tools` in plan 105-09 should cover exactly those four, not six.

## Next Phase Readiness

- `/tools` is a real, reachable route in the OBSERVE nav group. Both OBS-01 (`ToolUsagePanel`) and OBS-02 (`ToolPolicyFeed`) are now mounted and wrapped in independent `SectionErrorBoundary`s. The three pre-existing panels (`ToolBreakdown`, `ToolExecutionPanel`, `PermissionDecisionsChart`) each link into it with zero layout regression.
- Plan 105-09 owns: deployment of the whole phase's backend (105-02 through 105-04's astridr/Convex changes are still undeployed to the live self-hosted instance per every prior plan's SUMMARY), live verification of `/tools` against real Ástríðr tool-call volume and real induced policy events, the four-theme sweep, and marking OBS-01/OBS-02/OBS-03 satisfied in REQUIREMENTS.md.
- No blockers for 105-09.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 4 created key files confirmed present on disk (`src/pages/Tools.tsx`, `src/pages/Tools.test.tsx`,
`src/components/ToolBreakdown.test.tsx`, `src/components/ToolExecutionPanel.test.tsx`); all 3 task
commit hashes (`dcb4a015`, `449dcd30`, `dbca8d20`) confirmed present in `git log`.
