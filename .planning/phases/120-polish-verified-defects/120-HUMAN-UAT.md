---
status: partial
phase: 120-polish-verified-defects
source: [120-VERIFICATION.md]
started: 2026-08-17T23:20:00.000Z
updated: 2026-08-17T23:20:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. The two new confirm dialogs render themed, not as a native browser modal (POLISH-03)

Phase 120 replaced two destructive confirmations that did not live in a dialog: a
move-to-action-column confirm in `Tasks.tsx` that was a toast auto-dismissing after 5 seconds,
and a raw `window.confirm` gating a real War Room delete. Both are now controlled shadcn
`AlertDialog`s.

The unit tests prove the GATING behaviour — they were shown load-bearing by a break-and-refail
control, and they assert the destructive callback does not fire on cancel and fires exactly once
on confirm. They cannot prove APPEARANCE, because jsdom does not lay out or paint. No one has
seen these dialogs rendered.

steps:
  1. From Git Bash (not PowerShell — PS 5.1 deletes an env var assigned an empty string and
     would silently leave the Clerk gate up):
     `VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`
  2. Open `http://localhost:5181/tasks` and trigger a move-to-action-column.
  3. Open `http://localhost:5181/warroom` and trigger a War Room delete.

expected: each shows a styled in-app dialog matching the current theme — not a grey native
browser confirm box, and not a toast. Cancel dismisses with nothing destroyed. The dialog does
not time out or auto-dismiss on its own while you wait.
result: [pending]

### 2. Badge colours are visually distinct after the quiet-badge law (POLISH-05)

Phase 120 made every status except `failed`/`error` a quiet text-plus-hairline chip instead of a
filled badge. The load-bearing constraint is SC#4: `auth_failed` must stay visually distinct from
`failed`. That is asserted in tests by a paired control on the CSS custom-property tokens
(`auth_failed` carries `--status-warn` and NOT `--status-error`; `failed` the reverse), which
proves the tokens DIFFER but cannot prove the rendered colours are distinguishable to an eye.

steps:
  1. With `dev:noauth` running, open a page rendering Forge job statuses and one rendering
     general status badges.
  2. Compare a `failed` badge against an `auth_failed` badge side by side.
  3. Check the quiet chips are still legible against the surface in the theme you use, and check
     one alternate theme — including `readable`, whose no-effects guarantee this phase
     deliberately protected.

expected: `auth_failed` and `failed` are obviously different at a glance, not merely different in
the stylesheet. Quiet chips remain readable rather than washing out. Only `failed`/`error`
appears filled.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

<!-- No gaps recorded. The two items above are unperformed verification, not known defects:
     each was honestly logged as NOT PERFORMED by its own executing plan for want of a browser,
     rather than claimed as passed. -->

## Note on the earlier approval

The Phase 120 attended checkpoint (plan 120-07, task 4) was answered with the bare signal
`approved` and no reported observations. That is recorded throughout the phase artifacts as
APPROVED-WITHOUT-DETAIL. It is a valid approval and it closed the checkpoint, but it is not
observational evidence, so it does not close the two items above — they were folded into that
same approval without ever being looked at by anyone.

The substantive proof for POLISH-02 (E-Stop geometry) and POLISH-06 (the 900px collision) does
NOT depend on that approval: both rest on in-page Playwright measurements across five viewport
widths and a revert-and-refail control that reproduces 256.5px of overflow when the fix is
removed.
