---
status: passed
phase: 120-polish-verified-defects
source: [120-VERIFICATION.md]
started: 2026-08-17T23:20:00.000Z
updated: 2026-08-17T23:55:00.000Z
verified_by: instrumented browser session (Playwright + Chromium) against dev:noauth on 5181
---

## Current Test

[complete — both tests executed 2026-08-17]

## How these were run, and what that is worth

Both tests were executed by driving a real Chromium against the keyless dev server
(`VITE_CLERK_PUBLISHABLE_KEY= npm run dev:noauth`, port 5181, `--host 127.0.0.1`). Every claim
below is a measurement of **rendered output** — computed styles rasterised to true pixels, plus
screenshots that were actually looked at. The Clerk gate was never up; the app rendered.

This is far stronger than the jsdom evidence the plans had, and for the parts that are numeric
(contrast ratios, colour distance, auto-dismiss timing) it is stronger than an eyeball. It is
**not** a substitute for human aesthetic judgement — "does this look right" remains open, and is
not what these two tests asked.

Screenshots and raw JSON: session scratchpad `uat/` (`c-dialog.png`, `b-badges-*.png`,
`d-control-*.png`, `results-*.json`).

## Tests

### 1. The two new confirm dialogs render themed, not as a native browser modal (POLISH-03)

result: **PASSED**

Executed against the live `/tasks` board. Opened the real task card ("Stale session detected —
active but idle for 30+ minutes"), used the `MOVE TO` select to choose `running` (an ACTION
column), and captured the dialog that appeared.

Measured:

- `role="alertdialog"` — a real in-DOM node. A `window.confirm` cannot be queried or
  screenshotted at all, and Playwright's `dialog` event **never fired** at any point in the
  session, which is the direct control for "not native".
- background `#040405`, border `#1e1e24`, radius `8px`, font `Geist`, `--card` token `#0a0a0c`
  — all app theme values, matching the documented stack (Geist body font, 0.5rem radius, zinc
  neutrals). Buttons: `Cancel` / `Confirm`, with Confirm in the active theme's cyan.
- **No auto-dismiss.** The defect being fixed was a toast that vanished after 5 seconds. The
  dialog was left untouched for **8 seconds** and re-asserted still visible — `true`. This is
  the direct observable for the POLISH-03 defect, not a proxy.
- `Cancel` closed the dialog and destroyed nothing.

NOT directly verified: the **War Room** delete dialog. War Room currently holds zero rooms
("No rooms yet. Launch a new room to bring agents together."), so its delete path is
unreachable without creating a live room, which would spin up LiveKit agents — a real side
effect, not appropriate for a UI check. What is established instead: it composes the same
shadcn `AlertDialog` primitive from `src/components/ui/alert-dialog.tsx` as the Tasks dialog
verified above, `window.confirm` measures 0 across `src/`, and its own unit tests (proven
load-bearing by a break-and-refail control) cover its gating behaviour. Appearance is inferred
from the shared primitive, not seen. Recorded as such rather than claimed.

### 2. Badge colours are visually distinct after the quiet-badge law (POLISH-05)

result: **PASSED**, with one pre-existing finding routed to Phase 122/123

Rendered the exact class strings from `ForgeStatusBadge.tsx` and `StatusBadge.tsx` into the live
page, so the real built stylesheet and real theme tokens applied, across all five themes.

**Distinctness — `auth_failed` vs `failed` separate on four independent channels:**

- text colour distance **245** (default/cyan/emerald) and **205** (readable/aubergine) — red
  `rgb(239,68,68)` vs amber `rgb(234,179,8)`. Far above any "same hue" threshold.
- fill alpha delta **0.60** — `failed` carries a real fill (`oklab(0.396 … / 0.6)`),
  `auth_failed` is `rgba(0,0,0,0)`.
- composited surface distance **272**.
- different icons (`XCircle` vs `KeyRound`), so the distinction survives colour-blindness.

Confirmed by eye on the screenshots as well: red-on-dark-red fill, amber outline, cyan outline.

**Legibility — the quiet law substantially IMPROVED contrast.** A before/after control was run
using the pre-phase class strings from git `87ffe54f` against current HEAD, in the same page and
themes (WCAG AA small text = 4.5:1):

| badge | before | after | delta |
|---|---|---|---|
| StatusBadge `ok` | 2.43:1 | **8.29:1** | +5.87 — now meets AA |
| StatusBadge `warn` | 1.92:1 | **10.50:1** | +8.58 — now meets AA |
| StatusBadge `info` | 3.68:1 | **5.47:1** | +1.80 — now meets AA |
| Forge `auth_failed` | 7.14:1 | **10.50:1** | +3.36 |
| Forge `completed`→`Succeeded` | 8.29:1 | 8.29:1 | 0.00 |
| Forge `failed` | 3.92:1 | 3.92:1 | 0.00 — **below AA** |

`readable` and `aubergine` are higher again (ok 10.47, warn 12.06, info 7.92, failed 5.33).

**FINDING — `failed` sits at 3.92:1 on the dark themes, below AA.** Its class string
(`bg-red-900/60 text-[var(--status-error)]`) is byte-identical before and after this phase, so
this is **pre-existing and not a regression** — it is the one badge the quiet law deliberately
exempted from going quiet, and the filled treatment is what costs it the contrast. Token changes
are explicitly forbidden in Phase 120 (D-01/D-05) and owned by Phase 122's TOKEN-02 and Phase
123's accessibility remediation. Recorded here as input to those phases rather than fixed.

Worth flagging to whoever picks it up: the single badge left below AA is the **highest-severity**
one, which is the worst place in the set to have the weakest contrast.

Measurement caveat, stated so the numbers can be weighed: contrast was computed against the page
background `rgb(3,7,18)`. Badges usually render on a card surface (`--card` `#0a0a0c`), a slightly
different dark tone, so these are accurate to within that difference rather than exact per-surface
values. An earlier run of this same probe produced badly wrong figures by scraping numbers out of
computed CSS colour strings — Tailwind v4 emits `oklch()` and the scrape read the hue angle as the
blue channel, betrayed by an impossible page background of `rgb(0,0,262)`. The numbers above come
from rasterising each colour and reading true pixels via `getImageData`.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- No gaps. One pre-existing finding recorded (Forge `failed` at 3.92:1, below AA, unchanged by
     this phase, owned by Phase 122/123). One sub-item established structurally rather than
     observed: the War Room delete dialog's appearance, unreachable because no rooms exist. -->

## Note on the earlier approval

The Phase 120 attended checkpoint (plan 120-07, task 4) was answered with the bare signal
`approved` and no reported observations, and is recorded throughout the phase artifacts as
APPROVED-WITHOUT-DETAIL. These two tests were the items that approval did not actually cover;
they are now covered by the instrumented session above.

The substantive proof for POLISH-02 (E-Stop geometry) and POLISH-06 (the 900px collision) never
depended on that approval: both rest on in-page Playwright measurements across five viewport
widths and a revert-and-refail control that reproduces 256.5px of overflow when the fix is removed.
