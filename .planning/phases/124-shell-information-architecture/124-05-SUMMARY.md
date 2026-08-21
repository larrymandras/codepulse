---
phase: 124-shell-information-architecture
plan: 05
subsystem: ui
tags: [react, tailwind, radix-collapsible, sidebar, localStorage, vitest]

requires:
  - phase: 124-shell-information-architecture (plan 04)
    provides: navGroups rewritten to 4 sentence-case domains (Command 11, Observe 13, Agents 11, System 9 = 44 items)
provides:
  - Per-domain Collapsible sidebar (232px expanded) with persisted open/closed state
  - Eyebrow domain header + sentence-case 13px nav labels, weight budget held at 400/600
  - 2px --primary active rail + 6% tint replacing the old text-primary bg-primary/10 treatment
  - Real vitest assertions for D-14/D-15/D-17, replacing two of six abandoned test.todo stubs
affects: [124-06, 124-10]

tech-stack:
  added: []
  patterns:
    - "Per-domain persisted UI state lifted to the layout component and passed as props to sibling instances (desktop + mobile sidebar), rather than each instance reading localStorage independently — keeps concurrently-mounted instances from disagreeing."
    - "Tailwind v4 arbitrary before: pseudo-element variant for a 2px active-state rail (before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-(--primary)), verified against the actual compiled CSS rather than assumed."

key-files:
  created: []
  modified:
    - src/layouts/DashboardLayout.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx

key-decisions:
  - "Domain open/closed state is lifted to DashboardLayout (not read independently inside each SidebarContent instance), so the desktop <aside> and the mobile drawer <aside> — both mounted simultaneously — never disagree about which domains are open."
  - "The rail is a Tailwind before: pseudo-element, not a <span> fallback — verified by running `npx vite build` and grepping the emitted CSS for the compiled ::before rules before committing to the choice."
  - "codepulse-nav-domains key string is repeated literally at the read and write call sites (not hoisted to a shared constant), matching the existing codepulse-sidebar-collapsed idiom exactly rather than a DRYer refactor."

requirements-completed: [SHELL-02]

duration: ~45min
completed: 2026-08-21
---

# Phase 124 Plan 05: Sidebar Structure & Typography Summary

**Rebuilt the sidebar as a 232px-wide, four-domain Collapsible tree with persisted per-domain
state, an eyebrow header, sentence-case 13px nav labels, and a 2px `--primary` active rail + 6%
tint — replacing text-primary/drop-shadow treatment and two of six abandoned `test.todo` stubs
with real assertions.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3/3 completed
- **Files modified:** 2

## Accomplishments

- Each of the four `navGroups` domains (Command, Observe, Agents, System) now renders as its own
  Radix `Collapsible`, independently open/closed and persisted to
  `localStorage["codepulse-nav-domains"]` as four booleans, all `true` by default.
- The existing 48px whole-sidebar rail collapse still overrides per-domain state (D-14): at 48px,
  domain headers render as icon dividers and every item renders regardless of its domain's
  boolean — nothing is reset by collapsing/expanding the rail.
- Sidebar width: `w-60` (240px) → `w-[232px]` on both the desktop `<aside>` and the mobile drawer
  `<aside>` (D-17).
- Domain header restyled to the eyebrow role (11px/`font-mono`/`font-semibold`/uppercase/
  `tracking-[0.08em]`/`text-muted-foreground`), dot span and glow removed.
- Nav item labels restyled to 13px/`leading-[1.4]`/`font-normal` sentence case, `font-mono
  tracking-wider` and both drop-shadow glows removed.
- Active item now reads via a 2px `--primary` left rail (`before:` pseudo-element) plus a 6% tint
  background (`color-mix(in oklab, var(--primary) 6%, transparent)`) — no weight step, matching
  the UI-SPEC's 400/600 weight budget. `aria-current="page"` verified still set by `NavLink`'s
  default (no override added).
- Two of the six abandoned `DashboardLayout.test.tsx` `test.todo` stubs replaced with real,
  passing assertions (width, four-domain rendering); four new tests added beyond the plan's
  minimum (all-open-by-default, aria-current, persistence-survives-remount, shared-state sync
  between the desktop and mobile instances). Four `test.todo`s (icons, count badges, collapsed
  tooltips, collapsed aria-label) intentionally left untouched — other plans'/phases' scope.

## Task Commits

1. **Task 1: Per-domain Collapsible with persisted state and rail override** - `bd2dc2b7` (feat)
2. **Task 2: Eyebrow header, sentence-case labels, 2px active rail + 6% tint** - `6d00d77b` (feat)
3. **Task 3: Replace the abandoned test.todo stubs with real sidebar assertions** - `2e5ea7fc` (test)

_No separate plan-metadata commit — this SUMMARY.md is committed alongside itself per the
sequential-executor protocol (write → commit → narrate)._

## Files Created/Modified

- `src/layouts/DashboardLayout.tsx` — `NavGroup` rewritten around `Collapsible`/
  `CollapsibleTrigger`/`CollapsibleContent`; domain open/closed state lifted into
  `DashboardLayout` and threaded through `SidebarContent` to both `<aside>` instances; both
  `<aside>` widths changed `w-60` → `w-[232px]`; nav-item and domain-header classNames restyled
  per the UI-SPEC Typography/Color contract.
- `src/layouts/__tests__/DashboardLayout.test.tsx` — added the per-file `ResizeObserver`
  polyfill; extended `renderLayout()` to accept `initialEntries`; replaced two `test.todo`s with
  six real tests (one more than a 1:1 replacement — see "Additional tests" below); updated the
  file's own docstring and an in-test comment that had inadvertently used the literal string
  `test.todo` in prose, which was inflating the acceptance-criteria grep count.

## Decisions Made

- **Shared vs. independent domain state (Task 1's open decision):** chose lifted/shared state
  (one `useState` in `DashboardLayout`, passed as props to both `SidebarContent` instances) over
  each instance reading `localStorage` independently. This guarantees the desktop and mobile
  sidebars can never disagree mid-session (no need to wait for a remount to see the other
  instance's toggle) and is directly asserted by Task 3's "shared-lifted-state sync" test.
- **`::before` rail vs. `<span>` fallback (Task 2's conditional):** the plan flagged this repo had
  zero prior `before:` Tailwind usage and told the implementer not to guess. Ran `npx vite build`
  and grepped the emitted CSS — confirmed Tailwind's arbitrary `before:` variant and the
  `bg-(--primary)`/`color-mix(...)` arbitrary values all compile to real, working CSS rules
  (`.before\:bg-\(--primary\)\:before{content:var(--tw-content);background-color:var(--primary)}`
  and the matching `color-mix(in oklab,var(--primary) 6%,transparent)` background rule). Shipped
  the `::before` pseudo-element; the `<span>` fallback was not needed.
- **Literal key string, not a shared constant:** initially wrote a `NAV_DOMAINS_STORAGE_KEY`
  constant referenced by name at both the read and write call sites — this satisfied the design
  intent but failed Task 1's own acceptance criterion (`grep -c "codepulse-nav-domains" ... >= 2`,
  which counts literal occurrences of the string, not references to a constant holding it).
  Reverted to the literal string at both sites, matching the `codepulse-sidebar-collapsed` idiom
  exactly, per the plan's explicit "copy the idiom verbatim" instruction.

## Additional tests beyond the plan's five named behaviours

The plan's `<behavior>` block names five cases; the implementation added a sixth
("toggling a domain in one sidebar instance keeps the desktop and mobile instances in sync")
because Task 1's own text required it: *"assert in a test that toggling in one does not leave the
other stale if you chose shared state"* — the plan's own conditional requirement, triggered by the
shared-state decision above, not a scope expansion.

## Deviations from Plan

None outside the two documented above (both Rule-1-shaped: fixing the acceptance-criteria grep
mismatch, and following the plan's own conditional test requirement) — no unplanned architecture,
no scope creep, no auto-fixes needed beyond matching the plan's own stated idioms.

## Verification Evidence

**Task 1 acceptance criteria (run after commit `bd2dc2b7`):**
```
codepulse-nav-domains: 2   (>= 2 required)
CollapsibleTrigger: 3      (>= 1 required)
CollapsibleContent: 2      (>= 1 required)
aria-expanded: 0           (== 0 required)
w-60: 0                    (== 0 required)
w-[232px]: 2               (== 2 required)
to="/settings": 1, at line 296, inside the footer block below <nav> (unmoved, D-04)
npx tsc --noEmit: exit 0
```

**Task 2 acceptance criteria (run after commit `6d00d77b`):**
```
drop-shadow (whole file): 2 remaining
  - line 243: a historical comment (D-03/Phase 120, pre-existing, unrelated to NavGroup)
  - line 301: footer-pinned Settings icon's drop-shadow — explicitly out of scope (D-04),
    left untouched by design
  -> both hits accounted for; 0 within NavGroup's domain-header/nav-item blocks (pre-edit: 3
     within NavGroup at the old lines 91/117/120; post-edit: 0)
tracking-[0.08em]: 1        (>= 1 required)
color-mix(in_oklab,var(--primary)_6%,transparent): 1   (>= 1 required)
literal hex introduced: 0   (grep -ciE '#[0-9a-f]{3,8}\b' — pre-existing 0, post-edit 0)
font-medium|font-bold|font-[500]|font-[700] within NavGroup: 0 (all remaining hits are
  pre-existing, unrelated to NavGroup — avatar block, page title, CrtToggle, SYS/LAT spans,
  command bar button)
"text-primary font-mono font-bold": 0   (== 0 required)
npx tsc --noEmit: exit 0
Rail implementation: ::before pseudo-element (not a <span>), verified via `npx vite build` +
  grepping the emitted CSS for the compiled rule (see Decisions above).
```

**Task 3 acceptance criteria (run after commit `2e5ea7fc`):**
```
npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx: 12 passed | 4 todo (16), 0 failed
  — includes the 3 pre-existing header-telemetry tests and the 3 keyboard-shortcut tests, all
  still passing.
test.todo count: 4   (== 4 required, after removing two stray prose mentions of the literal
  string "test.todo" that were inflating the count from 4 to 6)
232 count: 3          (>= 1 required)
aria-current count: 2 (>= 1 required)
codepulse-nav-domains count: 2 (>= 1 required)
ResizeObserver count: 3 (>= 1 required)
git diff --exit-code -- src/test/setup.ts: exit 0
```

**Mutation test (w-60 revert-and-refail, D-17):**
```
1. Backed up DashboardLayout.tsx to the scratchpad directory.
2. Edited the desktop <aside> back to w-60.
3. `npx vitest run ... -t "w-\[232px\]"` -> 1 FAILED:
     AssertionError: expected 'hidden md:flex w-60 flex-shrink-0 bg-…' to contain 'w-[232px]'
4. Restored from the scratchpad backup.
5. `git diff --stat -- src/layouts/DashboardLayout.tsx` -> empty (byte-identical to HEAD).
6. `npx tsc --noEmit` -> exit 0; full suite -> 12 passed | 4 todo (16), 0 failed.
```

**Full-plan verification (after all three commits):**
```
npx tsc --noEmit: exit 0
npm test: 349 passed | 17 skipped (366 files); 4905 passed | 2 skipped | 195 todo (5102 tests);
  0 failures. (The "ResizeObserver loop" console noise and "getContext not implemented" lines
  are pre-existing WebGL/canvas-test environment noise, unrelated to this plan's changes.)
npx vitest run src/lib/__tests__/navRegistry.routes.test.ts: 4 passed (the golden route-set
  guard from 124-01 — untouched, still green).
git diff <base>..HEAD -- src/layouts/DashboardLayout.tsx | grep -c '^[-+].*min-h-14': 0
  (header height untouched, per the scope fence)
git diff <base>..HEAD -- src/layouts/DashboardLayout.tsx | grep -cE '^\+.*#[0-9a-fA-F]{3,8}\b': 0
  (zero hardcoded hex added across the whole plan)
git diff <base>..HEAD -- src/lib/__tests__/navRegistry.routes.test.ts: empty
git diff <base>..HEAD --stat -- src/components/voice/: empty
git diff <base>..HEAD --stat: only src/layouts/DashboardLayout.tsx and
  src/layouts/__tests__/DashboardLayout.test.tsx changed across all three commits — no other
  file was swept in from the concurrent Phase 193 session.
```

## Shared Checkout Notes

Ran `git show --stat HEAD` after each of the three commits — each commit contained exactly one
file, matching the task's own scope. No files from the concurrent Phase 193 (voice-avatar) session
were swept in at any point; `src/components/voice/` was never touched.

## Issues Encountered

None beyond the two acceptance-criteria/idiom corrections documented under Decisions Made — both
were caught and fixed before committing, not after.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Sidebar structure, persistence, and typography are complete and tested. Ready for 124-06 (count
  badges, error boundaries) to compose against this structure — `NavGroup`'s `itemList` is a
  stable target for adding badges per nav item without touching the Collapsible wiring this plan
  built.
- Header geometry (D-06's measurement-gated `h-12` adoption) is untouched by this plan, as scoped
  — that work belongs to 124-07 through 124-10, which can proceed independently since the header
  and sidebar are structurally decoupled in this file.
- No blockers.

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
