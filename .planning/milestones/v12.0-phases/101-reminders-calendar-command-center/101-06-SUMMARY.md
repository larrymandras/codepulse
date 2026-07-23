---
phase: 101-reminders-calendar-command-center
plan: 06
subsystem: frontend
tags: [react, convex-realtime, reminders, calendar, ui, shadcn]

# Dependency graph
requires:
  - phase: 101-reminders-calendar-command-center (plan 01)
    provides: "reminders Convex table + CRUD mutations/queries (api.reminders.create/update/complete/snooze/listByProfile) — consumed directly by this page's mutations"
  - phase: 101-reminders-calendar-command-center (plan 02)
    provides: "calendarEvents Convex table + api.calendarEvents.listByProfile (read-only cache) — consumed by CalendarOverlay"
provides:
  - "Lazy /reminders route registered in navRegistry's COMMAND cluster (D-08)"
  - "Profile-segmented (personal/business/consulting) reminders + calendar command-center page consuming the live Convex store in realtime"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-profile accent via existing semantic CSS tokens (--status-ok/--status-warn/--status-info) instead of new hex constants or new CSS variables — keeps three distinct, theme-aware accents with zero hardcoded hex and zero index.css changes, reusing the same 'oklch(from var(--x) l c h / a)' relative-color glow idiom already established in DashboardLayout.tsx"
    - "Hand-rolled month/week calendar grid using date-fns (already a dependency) instead of a calendar library — CalendarOverlay.tsx is ~240 lines, no new package"
    - "Optimistic mutation via a local `overrides: Record<id, Partial<Doc>>` map merged over the realtime query result, auto-pruned once the server row matches the override (ReminderList.tsx) — avoids a stuck-optimistic-forever bug without needing a manual settle/reconcile callback"

key-files:
  created:
    - src/pages/Reminders.tsx
    - src/pages/Reminders.test.tsx
    - src/components/reminders/ReminderList.tsx
    - src/components/reminders/QuickAdd.tsx
    - src/components/reminders/CalendarOverlay.tsx
  modified:
    - src/App.tsx
    - src/lib/navRegistry.ts

key-decisions:
  - "QuickAdd's keyboard shortcut is 'N' only, not the literal ⌘K/N the UI-SPEC wrote — DashboardLayout already owns Cmd/Ctrl+K globally for the CommandPalette (src/layouts/DashboardLayout.tsx ~L553); binding it again would double-fire (open the palette AND focus the quick-add input on the same keystroke). Documented in QuickAdd.tsx's header comment and memory [[cmdk-and-global-hotkey-gotchas]]."
  - "Profile accents reuse --status-ok/--status-warn/--status-info (green/amber/blue) rather than introducing new --profile-* CSS custom properties or chart-N tokens — chart-3/4/5 are grayscale in the cyan/emerald/amber dark themes (only chart-1/chart-2 are recolored per theme), so they couldn't guarantee three distinct accents; the status-* triad already carries three genuinely different hues in every one of the 5 data-theme variants and needed zero index.css changes (out of this plan's files_modified scope)."
  - "Task 1's route+nav commit necessarily left `npx tsc --noEmit` transiently red (App.tsx imports ./pages/Reminders before that file exists) — an inherent consequence of the plan splitting route-registration (Task 1) from the page component (Task 2) into separate atomic commits. Documented in the Task 1 commit message; full-tree tsc was verified clean after Task 2 and again after Task 3."
  - "CalendarOverlay.tsx was written in full during Task 2 (so Reminders.tsx's import would resolve and Task 2's tests could actually render the page) but was deliberately left unstaged/untracked until Task 3's commit — kept per-task git history accurate to the plan's own file-list split while still allowing every task's tests to run for real against working code, not a stub."

requirements-completed: [UI-01, UI-02, CAL-02]

# Metrics
duration: 8min
completed: 2026-07-19
---

# Phase 101 Plan 06: Reminders Command-Center UI Summary

**Profile-segmented (personal/business/consulting) Reminders page at `/reminders` — a realtime Overdue/Today/Upcoming/Done list with optimistic complete/snooze/edit, a quick-add bar, and a read-only Google Calendar month/week overlay showing due-dated reminders as priority-colored chips beside Google events, all built from shadcn primitives with zero hardcoded hex.**

## Performance

- **Duration:** 8 min (18:56:16 → 19:04:35)
- **Started:** 2026-07-19T18:56:16-04:00
- **Completed:** 2026-07-19T19:04:35-04:00
- **Tasks:** 3
- **Files modified:** 7 (2 modified, 5 created)

## Accomplishments
- `/reminders` is a lazy-loaded route in `App.tsx`, registered in `navRegistry.ts`'s COMMAND cluster (reuses the existing `clock` icon — no new icon import needed)
- Profile segmented control (Personal/Business/Consulting), last-selection persisted to `localStorage`, each tab tinted by its profile's accent (`--status-ok`/`--status-warn`/`--status-info`) via the same `oklch(from var(...) l c h / a)` glow idiom the nav already uses
- `ReminderList.tsx` groups reminders into Overdue (loudest, pulsing glow unless `prefers-reduced-motion`) / Today / Upcoming / Done (collapsed by default via shadcn `Collapsible`), each row showing relative due time (`in 2h` / `3d overdue`), a priority pip, a recurrence icon, an Ástríðr origin marker, and tags — all rendered as plain React text nodes, verified by both a runtime test (a markup-like title renders as literal text, never an injected `<img>`) and a source-scan test asserting no `dangerouslySetInnerHTML` string appears anywhere under `src/components/reminders/` or in `Reminders.tsx`
- Complete/snooze/edit are optimistic against `api.reminders.complete/snooze/update` via a local override map that self-prunes once the realtime query reflects the server row — no manual reconcile callback needed
- `QuickAdd.tsx` — always-visible add bar (title, due datetime, priority, recurrence), focused by "N" (not ⌘K — see Decisions)
- `CalendarOverlay.tsx` — hand-rolled month/week grid (date-fns) rendering `api.calendarEvents.listByProfile` events as outline chips and due-dated reminders as accent-filled, priority-colored chips on their day; clicking a day filters the reminder list; strictly read-only — no `calendarEvents` mutation import, no Google-write handler anywhere in the file (verified by a source-scan test)
- Both `useQuery` calls (reminders + calendar) are realtime and profile-keyed — switching profiles re-queries both panes together, verified by a test that swaps profile and asserts the old profile's reminder AND event both disappear while the new profile's both appear
- 10/10 new tests green; full suite 2118/2118 passing (baseline 2108 + 10), 0 regressions; `npx tsc --noEmit` clean; zero hardcoded hex in the 5 new/modified reminders files (verified by grep, see below)

## Task Commits

1. **Task 1: Route + nav registration** - `cd7e3df` (feat)
2. **Task 2: Profile-segmented page shell + reminder list** - `3b24226` (feat — Reminders.tsx, ReminderList.tsx, QuickAdd.tsx, Reminders.test.tsx)
3. **Task 3: Calendar overlay (read-only) with reminder chips** - `eae2209` (feat — CalendarOverlay.tsx, Reminders.test.tsx additions)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/App.tsx` - lazy `RemindersPage` import + `/reminders` Suspense route (mirrors the existing Tasks/Skills pattern exactly)
- `src/lib/navRegistry.ts` - `{ to: "/reminders", label: "Reminders", icon: "clock", group: "COMMAND" }` added to the COMMAND cluster
- `src/pages/Reminders.tsx` - page shell: `ProfileSwitch` segmented control, localStorage persistence, realtime `useQuery`/`useMutation` wiring, two-pane responsive grid (`grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]`)
- `src/components/reminders/ReminderList.tsx` - grouping (Overdue/Today/Upcoming/Done), row rendering, quick actions (complete/snooze-popover/edit-popover), `usePrefersReducedMotion` hook, `formatRelativeDue` helper
- `src/components/reminders/QuickAdd.tsx` - add bar with due/priority/recurrence controls, "N" focus shortcut
- `src/components/reminders/CalendarOverlay.tsx` - month/week grid, event/reminder chip rendering, day-click filter callback
- `src/pages/Reminders.test.tsx` - 10 tests across profile segmentation, quick actions, quick-add, calendar overlay, and the injection guard

## Decisions Made
- **"N" instead of ⌘K/N for quick-add focus** — DashboardLayout already owns Cmd/Ctrl+K globally for the CommandPalette; duplicating it would double-fire both handlers on the same keystroke (memory [[cmdk-and-global-hotkey-gotchas]]). Grepped `DashboardLayout.tsx`/`CommandPalette.tsx` before binding to confirm "n" (no modifier) was unclaimed.
- **Profile accents reuse `--status-ok`/`--status-warn`/`--status-info`** rather than adding new `--profile-*` tokens to `index.css` (out of this plan's `files_modified` scope) or reusing `--chart-N` (chart-3/4/5 are grayscale in 3 of the 5 dark themes, since those theme blocks only override chart-1/chart-2). The status-* triad is genuinely three-hue-distinct in every theme and needed zero CSS changes.
- **CalendarOverlay written during Task 2, committed in Task 3** — Reminders.tsx unconditionally imports and renders `CalendarOverlay`, so Task 2's own tests (and `tsc`) needed a real, working component in the working tree to resolve/render against. Wrote the full component early but kept it untracked/unstaged until Task 3's commit, preserving the plan's per-task file-list boundaries in git history while never testing against a stub.

## Deviations from Plan

**1. [Rule 1 - avoided a known bug] Quick-add focus shortcut is "N", not ⌘K/N as literally specified**
- **Found during:** Task 2, writing `QuickAdd.tsx`
- **Issue:** 101-UI-SPEC.md's "Accessibility" section specifies "quick-add focus shortcut" as `⌘K`/`N`. `DashboardLayout.tsx` already binds Cmd/Ctrl+K globally to open the `CommandPalette`.
- **Fix:** Bound only "N" (guarded against firing while typing in another input/textarea/contentEditable). ⌘K is left exclusively owned by the CommandPalette.
- **Files modified:** `src/components/reminders/QuickAdd.tsx`
- **Commit:** `3b24226`

**2. [Rule 1 - test-infra bug caught before it shipped] Docstring literally contained the string "dangerouslySetInnerHTML"**
- **Found during:** Task 2, first test run — the plan's own acceptance grep (`grep -rc "dangerouslySetInnerHTML" src/components/reminders src/pages/Reminders.tsx`) and my source-scan test both false-positive on prose, not just code usage.
- **Issue:** `ReminderList.tsx`'s header comment explained the no-injection guarantee using the literal API name in prose, which the substring-match grep can't distinguish from actual usage.
- **Fix:** Reworded the comment to describe the guarantee without using the literal string.
- **Files modified:** `src/components/reminders/ReminderList.tsx`
- **Commit:** `3b24226`

## Issues Encountered

- **Task 1 (route registration) left `tsc` transiently red within its own commit** — `App.tsx` importing `./pages/Reminders` before that file exists is an inherent consequence of the plan splitting route registration and page-component creation into two separate atomic-commit tasks. Not a bug; documented in the Task 1 commit message. Full-tree `npx tsc --noEmit` was verified clean after Task 2 (once `Reminders.tsx` landed) and again after Task 3.
- **Proxy `Symbol.toPrimitive` bug in the test's mock `api` object** — the hand-rolled `makeApiProxy()` helper in `Reminders.test.tsx` initially returned a nested Proxy object for every `get` trap call including implicit `Symbol.toPrimitive` lookups during `String(ref)`, causing `TypeError: object is not a function` on every test. Fixed by explicitly handling `Symbol.toPrimitive`/`"toString"` to return a real function, and returning `undefined` for all other symbol props. Caught and fixed within the first test run (Rule 3 — blocking issue in the task's own test infrastructure, not shipped code).

## User Setup Required

None. No new environment variables, no external service configuration. This plan only consumes the already-live `api.reminders.*` and `api.calendarEvents.listByProfile` Convex functions from plans 01/02.

## Next Phase Readiness

- `/reminders` is live, reachable from the COMMAND nav cluster, and consumes the full realtime store from plans 01/02 — an Ástríðr-created reminder (via `/reminders-ingest`) or a calendar-cron push (via `/calendar-ingest`) will appear on this page without a manual refresh, by construction of `useQuery`.
- **UI-01, UI-02, CAL-02 marked complete** in REQUIREMENTS.md — this plan is their sole implementer.
- **REM-01 is now genuinely complete** (not just the backend store from 101-01): this page is the first UI surface that reads/writes `api.reminders.*` directly, closing the loop the phase's dependency note called for.
- Live/manual verification (per the plan's own `<verification>` block — dev server, all-three-profile visual check, real create/reload persistence, agent-created-reminder realtime appearance) was **not** performed in this automated pass; `npx vitest run` (10/10 new, 2118/2118 total) and `npx tsc --noEmit` (clean) are the automated verification for this plan. Recommend a short manual pass (`npm run dev` + `npm run dev:backend`) before considering the phase fully closed.
- No blockers.

## Zero-Hardcoded-Hex Verification

```
$ grep -rEn "#[0-9a-fA-F]{3,8}\b" src/pages/Reminders.tsx src/components/reminders/*.tsx
NONE FOUND
```

## Injection-Guard Verification (T-101-03, plan's own acceptance grep)

```
$ grep -rc "dangerouslySetInnerHTML" src/components/reminders src/pages/Reminders.tsx
src/components/reminders/CalendarOverlay.tsx:0
src/components/reminders/QuickAdd.tsx:0
src/components/reminders/ReminderList.tsx:0
src/pages/Reminders.tsx:0
```

---
*Phase: 101-reminders-calendar-command-center*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: src/pages/Reminders.tsx
- FOUND: src/pages/Reminders.test.tsx
- FOUND: src/components/reminders/ReminderList.tsx
- FOUND: src/components/reminders/QuickAdd.tsx
- FOUND: src/components/reminders/CalendarOverlay.tsx
- FOUND: src/App.tsx (modified)
- FOUND: src/lib/navRegistry.ts (modified)
- FOUND commit: cd7e3df (feat — route + nav registration)
- FOUND commit: 3b24226 (feat — page shell + reminder list)
- FOUND commit: eae2209 (feat — calendar overlay)
