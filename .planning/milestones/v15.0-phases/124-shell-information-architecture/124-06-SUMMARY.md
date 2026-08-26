---
phase: 124-shell-information-architecture
plan: 06
subsystem: ui
tags: [react, convex, error-boundary, badges, accessibility, sidebar]

requires:
  - phase: 124-02
    provides: "useAlertCounts() returns raw undefined instead of a fabricated zeroed shape"
  - phase: 124-03
    provides: "alerts.countBySeverity bounded (ALERT_COUNT_SCAN_CAP=2000) with a truncated flag"
  - phase: 124-05
    provides: "per-domain Collapsible sidebar, NavGroup/SidebarContent structure this plan builds on"
provides:
  - "SectionErrorBoundary optional fallback prop, additive across 41 existing call sites"
  - "Inbox and Alerts sidebar count badges honoring D-12's four-state render law"
  - "Per-subscription error boundaries proven load-bearing by a boundary-removed run"
affects: [124-07, 124-09, 124-10]

tech-stack:
  added: []
  patterns:
    - "Dedicated badge components (not inline useQuery in the parent) so a per-query SectionErrorBoundary can actually catch that query's throw"
    - "Data-typography override via a data-slot=badge attribute selector, for styling a composed child component (StatusBadge) whose own classes share CSS specificity with any wrapper override"

key-files:
  created: []
  modified:
    - src/components/SectionErrorBoundary.tsx
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx

key-decisions:
  - "Boundaries were built together with the badges in Task 2's commit, not deferred to Task 3 — a query without its boundary is an unmitigated instance of T-124-06-01 even for one commit"
  - "InboxCountBadge/AlertsCountBadge are dedicated child components rather than useQuery calls inline in SidebarContent, so each query's own SectionErrorBoundary sits between the failing hook and the rest of the sidebar"
  - "D-12's undefined-guard also treats the test suite's mocked null as unresolved (== null), per the plan's own note that Convex only ever returns undefined while loading but this repo's mocks use null"

requirements-completed: [SHELL-02]

duration: ~45min
completed: 2026-08-21
---

# Phase 124 Plan 06: Sidebar Count Badges & Shell Error Boundaries Summary

**Inbox/Alerts sidebar badges backed by `listHeldUnacked`/`countBySeverity`, each in its own `SectionErrorBoundary`, with the boundary's necessity proven by a deliberate boundary-removed test run.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `SectionErrorBoundary` gained an optional `fallback?: ReactNode` prop, additive across all 41 existing call sites (160 opening-tag usages) — confirmed unaffected by a full `npm test` run.
- Inbox and Alerts sidebar badges render honestly under D-12's four-state law: nothing while unresolved, nothing at zero, the number with a domain-naming `aria-label` when `>0`, and a dimmed neutral dot with a `"{Domain} count unavailable"` label when the query throws.
- Alerts badge honors `truncated: true` (124-03's scan cap) by rendering `{n}+` and an "at least" accessible label rather than a complete-looking integer.
- Each badge subscription sits inside its own `SectionErrorBoundary` — proven load-bearing, not just present, by temporarily removing both wrappers and re-running the throwing test (recorded below).

## Task Commits

1. **Task 1: Give SectionErrorBoundary an optional fallback** — `edf41bd9` (feat)
2. **Task 2: Render the Inbox and Alerts count badges under the D-12 render law** — `f42f4f1d` (feat) — includes the boundary wrapping (see Deviations)
3. **Task 3: Own boundary per subscription, and assert all four states** — `9bcfe16f` (test)

**Plan metadata:** committed alongside this SUMMARY (see below).

## Files Created/Modified

- `src/components/SectionErrorBoundary.tsx` — additive `fallback?: ReactNode` prop, rendered in place of the default card when supplied and `hasError` is true.
- `src/layouts/DashboardLayout.tsx` — `BADGE_DATA_TYPE` constant, `BadgeUnavailableDot`, `InboxCountBadge`, `AlertsCountBadge` components; `NavGroup` gained a `badges?: Record<string, ReactNode>` prop rendered beside the item label; `SidebarContent` builds the `navBadges` map (each entry pre-wrapped in its own `SectionErrorBoundary`) and passes it to every `NavGroup`.
- `src/layouts/__tests__/DashboardLayout.test.tsx` — added `inbox`/`alerts` entries to the `api` mock, and a new `describe` block with 6 cases covering all four D-12 states plus the truncated-count case and the boundary-containment control.

## Decisions Made

- **Boundaries shipped with the badges, not deferred to a later task.** The plan's task split put badge rendering in Task 2 and boundary wrapping in Task 3. Since a `SectionErrorBoundary` only catches a throw from its own descendant tree, and `InboxCountBadge`/`AlertsCountBadge` had to exist as separate components for the boundary to work at all (see next decision), building them without their boundary — even for one intermediate commit — would ship exactly the DoS surface the threat model's T-124-06-01 requires mitigated. Both are in Task 2's commit; Task 3's commit is the test file plus the manual boundary-removed proof below.
- **Dedicated child components, not inline `useQuery` calls in `SidebarContent`.** The plan's draft said to subscribe directly inside `SidebarContent`'s body. A throw during `SidebarContent`'s own render bubbles past any boundary that wraps only a piece of its returned JSX — the boundary has to wrap the component that actually calls the failing hook. `InboxCountBadge`/`AlertsCountBadge` mirror the existing `BrainHeaderBadge` precedent (`DashboardLayout.tsx:817`, wrapped by `<SectionErrorBoundary name="Active Brain">`) already in this file.
- **`== null` instead of `=== undefined` for the D-12 unresolved check.** The plan's own Task 2 action text says the existing test suite mocks `useQuery` as `null` for "not yet resolved" and to treat that as unresolved too. Both badge components use `== null`, which catches Convex's real `undefined` and the test suite's mocked `null` identically, with a comment explaining why.
- **StatusBadge's typography overridden via a `data-slot=badge` attribute selector, not a new component.** The UI-SPEC's Component Reuse Map mandates composing `StatusBadge` for severity-bearing badges, not hand-rolling one, but `StatusBadge`'s own `text-sm font-medium` classes live on the same element a wrapping `<span className="...">` cannot out-specificity via plain inheritance. `[&_[data-slot=badge]]:font-mono [&_[data-slot=badge]]:text-xs [&_[data-slot=badge]]:font-semibold [&_[data-slot=badge]]:tabular-nums` on the aria-labelled wrapper targets `Badge`'s own `data-slot="badge"` attribute (`ui/badge.tsx:40`) to apply the Data typography role (12px mono, weight 600, tabular-nums) without touching `StatusBadge.tsx` (not in this plan's `files_modified`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment literally spelling the banned `listByProfile` symbol tripped Task 2's own acceptance grep**
- **Found during:** Task 2 verification
- **Issue:** `InboxCountBadge`'s explanatory comment named `listByProfile` verbatim ("NOT listByProfile...") to document why it wasn't used, which made `grep -cF "listByProfile" src/layouts/DashboardLayout.tsx` return 1 instead of the required 0.
- **Fix:** Reworded the comment to describe the rejected query generically ("the per-profile inbox read") without spelling the symbol.
- **Files modified:** `src/layouts/DashboardLayout.tsx`
- **Verification:** `grep -cF "listByProfile" src/layouts/DashboardLayout.tsx` → `0`
- **Committed in:** `f42f4f1d` (Task 2 commit — caught and fixed before committing)

**2. [Rule 1 - Bug] Plan's own Task 2 verify command could not pass without Task 3's test-file mock update**
- **Found during:** Task 2 verification
- **Issue:** The plan's Task 2 `<verify>` runs `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx`, but the existing `api` mock in that file had no `inbox`/`alerts` entries. `api.inbox` was `undefined`, so `InboxCountBadge`'s `useQuery(api.inbox.listHeldUnacked)` threw `Cannot read properties of undefined` before ever reaching the D-12 guard — not a graceful "unresolved" state, an actual crash that also broke the pre-existing `aria-current` test (its accessible-name computation walked into the crashing subtree).
- **Fix:** Did Task 3's mock/test work (api mock entries, mockImplementation dispatch, 6 new cases) before running Task 2's own verify command, then split the resulting diff into Task 2's (DashboardLayout.tsx) and Task 3's (test file) commits as originally scoped.
- **Files modified:** `src/layouts/__tests__/DashboardLayout.test.tsx`
- **Verification:** Full `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` — 18 passed, 4 todo.
- **Committed in:** `9bcfe16f` (Task 3 commit)

**3. [Rule 1 - Bug] `getByLabelText` found 2 matches per badge, not 1**
- **Found during:** Task 3, first test run
- **Issue:** Desktop `<aside>` and the mobile drawer `<aside>` both mount their own `SidebarContent` instance (existing, pre-124-06 shape — see the "shared lifted state" test already in this file), so every badge query subscribes twice and every `getByLabelText` assertion threw "Found multiple elements."
- **Fix:** Switched the 4 count-bearing assertions to `getAllByLabelText(...).length === 2`, asserting both instances render identically.
- **Files modified:** `src/layouts/__tests__/DashboardLayout.test.tsx`
- **Verification:** All 4 affected tests pass.
- **Committed in:** `9bcfe16f` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs found during verification, not scope changes)
**Impact on plan:** No scope creep. All three were required to make the plan's own verify commands pass as written.

## Issues Encountered

None beyond the deviations above.

## Call-Site Enumeration (Task 1 acceptance criterion)

`grep -rlc "SectionErrorBoundary" src --include=*.tsx | wc -l` → **55** (files matching the string anywhere — imports, comments, and usages).

Actual `<SectionErrorBoundary` opening-tag usages (excludes imports/comments), for the "confirmed unaffected" claim:

- **41 files**, **160** opening-tag call sites total (2 of which are this plan's new Inbox/Alerts badges; 1 is the pre-existing `Active Brain` wrapper this plan's badges sit beside).
- Per-file counts: `GlobalSwapModal.tsx`(1), `VitalsRail.tsx`(1), `FactsTable.tsx`(1), `ForgeJobDetail.tsx`(1), `CodeVaultGraph.tsx`(2), `KGDetailsPanel.tsx`(3), `DashboardLayout.tsx`(3), `Analytics.tsx`(31), `Automation.tsx`(6), `Bifrost.tsx`(1), `Briefings.tsx`(1), `Capabilities.tsx`(1), `Chat.tsx`(7), `Dashboard.tsx`(12), `Dreaming.tsx`(3), `Executions.tsx`(1), `ForgePage.tsx`(2), `Galdr.tsx`(1), `GraphsHub.tsx`(7), `HivePage.tsx`(3), `hr/AgentAnalytics.tsx`(5), `Ideation.tsx`(2), `Infrastructure.tsx`(9), `KnowledgeGraph.tsx`(5), `Loom.tsx`(1), `McpInventory.tsx`(1), `MeetingBot.tsx`(4), `Memory.tsx`(4), `Quality.tsx`(1), `QualityDetail.tsx`(3), `Reminders.tsx`(2), `Security.tsx`(3), `SelfHealing.tsx`(1), `SessionDetail.tsx`(1), `Settings.tsx`(20), `Studio.tsx`(1), `Tasks.tsx`(1), `ToolGalaxy.tsx`(3), `Tools.tsx`(2), `WarRoom.tsx`(1), `WorkspaceMap.tsx`(2).
- **Confirmed unaffected:** every existing call site passes only `{ children, name? }`, none passes `fallback`, and the full `npm test` run (349 test files, 4911 tests, all passing) covers every one of these files' own test suites with zero regressions.

## Boundary-Removed Proof (D-13, Task 3 acceptance criterion)

Run manually during execution (not committed as dead code — the plan asks for the proof to be recorded, not shipped as a permanent code path).

**Removed** (`navBadges["/inbox"]`/`navBadges["/alerts"]` changed from `<SectionErrorBoundary fallback={...}><XCountBadge/></SectionErrorBoundary>` to bare `<XCountBadge/>`), then ran:

```
npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx -t "contains an Alerts-query throw"
```

Result: **1 failed**. Not merely an assertion failure — the thrown error propagated all the way up with no boundary to catch it, so the entire render failed and nothing mounted:

```
FAIL src/layouts/__tests__/DashboardLayout.test.tsx > DashboardLayout sidebar count badges (D-10/D-12/D-13, Phase 124 Plan 06) > contains an Alerts-query throw...
Error: simulated countBySeverity failure
 ❯ AlertsCountBadge src/layouts/DashboardLayout.tsx:153:18
 ❯ ...react-dom-client.development.js (render pipeline, no boundary to catch it)
```

The containment-control assertion (`screen.getAllByText("Command").length`) never even executed — the whole test crashed before reaching it, which is the strongest possible demonstration that the boundary is load-bearing: without it, a single query failure does not degrade gracefully, it takes down the render entirely.

**Restored** the two `SectionErrorBoundary` wrappers, re-ran the full file:

```
npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx
 Test Files  1 passed (1)
      Tests  18 passed | 4 todo (22)
```

Green. The permanent test suite asserts the same containment via the "known-present sidebar element still renders" control, without needing to remove the wrappers again.

## 48px Collapsed-Rail Decision

No badges render when the sidebar rail is collapsed to 48px. This is structural, not a separate conditional: `NavGroup`'s item render only emits the label `<span>` and the badge together inside the existing `{!collapsed && (...)}` block (`DashboardLayout.tsx`), which already governed the label before this plan. Collapsing the rail was never a state the badges needed their own guard for — the surrounding block already excludes both.

## Verification

- `npx tsc --noEmit` — exits 0 (run after every task).
- `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` — 18 passed, 4 todo (final state).
- `npm test` (full suite) — **349 test files passed, 17 skipped (366)**; **4911 tests passed, 2 skipped, 195 todo (5108)**. Zero failures.
- Hex-literal check: `grep -ciE '#[0-9a-f]{3,8}\b'` on both modified source files — **0 before, 0 after** (checked against the pre-plan commit `8dfc96ed` and the current state).
- Scope fence: `git diff -- src/layouts/DashboardLayout.tsx | grep -c '^[-+].*min-h-14'` → **0** (D-06 header geometry untouched). `git diff -- src/lib/__tests__/navRegistry.routes.test.ts` → empty (not touched).
- Task-level acceptance greps (all passing): `fallback` count 4, `console.error` count 1 (unchanged), `listHeldUnacked` count 2, `listByProfile` count 0, `inbox.listAll` count 0, `truncated` count 3, Inbox `aria-label` present, `aria-live` count 0, `SectionErrorBoundary` count 8 in `DashboardLayout.tsx` (3 opening tags × ~2.67 lines/tag incl. closing tags and the import), `count unavailable` count 2, `countBySeverity`/`listHeldUnacked` present in the test file.
- No modifications to `.planning/STATE.md`, `.planning/ROADMAP.md`, or `src/components/voice/` — confirmed via `git show --stat` on each commit (only the 3 planned files touched across all 3 commits).

## Shared Checkout

No files outside this plan's scope were swept into any commit — `git show --stat HEAD` after each of the 3 commits showed exactly the one intended file. No conflicts with the concurrent Phase 193 voice-avatar session were observed.

## Known Stubs

None. All rendered states (badge present, badge absent, fallback dot) are backed by real queries or a real thrown error in tests — nothing renders mock/placeholder data in production code.

## Threat Flags

None beyond what the plan's own `<threat_model>` already names and disposes (T-124-06-01 through T-124-06-SC, all `mitigate`/`accept` as written — no new surface introduced beyond the plan's own scope).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 124-07 (header system chip) can reuse `alerts.countBySeverity` for its worst-severity logic — same subscription, Convex dedupes client-side, exactly as this plan's Alerts badge already does.
- The `SectionErrorBoundary` `fallback` prop is now available for 124-07's own shell-level subscriptions (system chip) without further changes to `SectionErrorBoundary.tsx`.
- No blockers.

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
