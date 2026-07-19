# Phase 101: Reminders & Calendar — UI Design Contract

**Status:** Ready for planning
**Applies to:** Plan 101-06 (`src/pages/Reminders.tsx` + supporting components)
**Design system:** CodePulse command-center aesthetic — DO NOT introduce a generic todo-app look.

## Design intent (Larry's words)
"Sleek and streamlined, well organized but at the same time kick ass with some great effects. Probably organized by profile."

## Non-negotiable house style
- **Type:** mono font, wide tracking for labels/headers (match nav + PageHeader).
- **Color:** oklch primary-glow accents; per-profile accent color. Reuse the nav's active-state treatment: `drop-shadow(0 0 8px oklch(from var(--primary) l c h / 0.8))` on active/emphasis, `0.5` on hover.
- **Theme:** respect the existing light/editorial + dark/CRT theme system (`PrivacyContext`/theme toggle) — style both; never hardcode a single background.
- **Chrome:** use the shared `PageHeader` component (F7 header convention from Phase 96); real counts, no placeholder numbers ("house honesty" rule — never show a fabricated badge count).
- **Components:** prefer existing `src/components/ui/*` (shadcn) primitives; do not add a new UI kit.

## Layout
1. **Profile organization (D-08 / UI-01).** A segmented control at the top — `Personal · Business · Consulting` (+ optional `All`) — each with its own accent. Default to the last-selected profile (persist in localStorage, mirroring existing per-page prefs). The selected profile's accent tints the page's glow.
2. **Two-pane split within the selected profile:**
   - **Left — Reminders list**, grouped **Overdue / Today / Upcoming / Done**, in that order. Overdue group first and visually loudest. Done collapsed by default.
   - **Right — Calendar overlay** (UI-02 / CAL-02): a month view (with a week toggle) showing read-only Google Calendar events for that profile's account **and** due-dated reminders rendered as chips on their due day. Reminder chips are visually distinct from Google events (e.g. accent-filled vs. outline) and carry priority color. Clicking a day filters/scrolls the left list to that day.
   - Responsive: below a breakpoint the calendar collapses under the list (single column); the page body must never scroll horizontally.
3. **Empty state** per group/profile: a quiet, on-brand empty message (not a blank void), e.g. "No overdue reminders — nice."

## Reminder row
- Title, due date/time (relative — "in 2h", "3d overdue"), priority pip (low/med/high color), recurrence icon if recurring, tags (if any), and a small origin marker (`dashboard`/`astridr` — subtle, e.g. an Ástríðr glyph for agent-created).
- **Quick actions (UI-02):** inline **complete** (satisfying check + row settle/fade to Done), **snooze** (quick menu: 1h / this evening / tomorrow / pick), and edit (opens an inline editor / sheet). All are optimistic against the Convex mutation, reconciling on server confirm.
- **Quick-add bar:** always-visible add input at the top of the list ("Add a reminder…", `⌘K`/`N` to focus), with lightweight inline controls for due date, priority, profile (defaults to the selected profile), and recurrence. Full NL parsing is NOT required here (Ástríðr owns conversational NL) — a date/time picker suffices.

## Effects (tasteful, earn their place)
- **Due-soon / overdue:** animated glow or slow pulse on overdue items using the profile accent; do not animate the entire list.
- **Count-up badges** for group counts (respect `prefers-reduced-motion`).
- **Status transition:** smooth complete→Done settle; snooze→group-move transition.
- **Profile switch:** quick accent/gradient cross-fade between profiles.
- Never sacrifice readability or performance for effect; all motion respects `prefers-reduced-motion`.

## Data wiring (contract with plans 01/02)
- Reminders via `useQuery(api.reminders.listByProfile, { profileId })` (realtime — cross-surface sync is automatic).
- Calendar via `useQuery(api.calendarEvents.listByProfile, { profileId })` (read-only cache).
- Mutations: `api.reminders.create/update/complete/snooze/remove` — optimistic.
- Profile IDs are exactly `"personal" | "business" | "consulting"`.

## Accessibility
- Keyboard: quick-add focus shortcut, arrow-navigate the list, Enter to complete-toggle. Calendar day cells focusable.
- ARIA labels on icon-only actions (complete/snooze/edit), matching the nav's `aria-label` convention.
- Color is never the ONLY signal for priority/overdue (pair with icon/text).

## Out of scope for this page (deferred)
Drag-to-reschedule on the calendar; writing events back to Google; multi-select bulk actions; a dedicated per-reminder detail route.

## Verification hooks (for plan 06 acceptance)
- The three profiles render with distinct accents; switching profiles swaps both panes.
- An `astridr`-sourced reminder (created via the tool / ingest) appears in the list without a manual refresh (realtime `useQuery`).
- An overdue due-dated reminder shows overdue styling in the list AND a chip on its day in the calendar.
- Complete/snooze update optimistically and persist (survive reload).
- `prefers-reduced-motion` disables the pulses/count-ups.
