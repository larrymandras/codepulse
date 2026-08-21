---
id: TODO-sidebar-4px-horizontal-overflow-separator
status: pending
planted: 2026-08-21
planted_during: Phase 124 — spotted by the orchestrator in the operator's own checkpoint screenshots (a horizontal scrollbar at the sidebar's bottom edge on all three routes), then measured
trigger_when: Any shell- or DashboardLayout-touching phase. Frontend-only, no deploy, one class.
scope: Trivial (one task) — but pick the remedy deliberately, see below
source: src/layouts/DashboardLayout.tsx:458,463
resolves_phase: null
last_reviewed: 2026-08-21
---

# Sidebar shows a horizontal scrollbar from a 4px overflow

## Measured, not inferred (2026-08-21, Playwright, 1512x900, 3s settle)

```
aside width      : 232.00   <- exactly right, D-17 holds
nav clientWidth  : 231
nav scrollWidth  : 235      <- 4px overflow
nav overflow-x   : auto     <- this is what draws the scrollbar
widest descendant: right = 235  (the domain <Separator>)
```

The `<aside>` is not too narrow. A child overhangs by 3px and the nav scrolls.

## Cause

`src/layouts/DashboardLayout.tsx:463`:

```tsx
{i > 0 && <Separator className="my-2 mx-3" />}
```

The shadcn `Separator` primitive carries `data-[orientation=horizontal]:w-full`. Inside
the nav's `px-2` content box (216px), `w-full` resolves to 215px, and `mx-3` then offsets
it 12px right — putting its right edge at 8 + 12 + 215 = **235px**.

The scrollbar appears because of a CSS rule that is easy to miss: **once `overflow-y` is
set to anything other than `visible`, the browser computes `overflow-x: visible` as
`auto`.** The nav at `:458` is `flex-1 overflow-y-auto py-2 px-2` — so it never had a
choice, and a 3px overhang is enough to produce a full-width horizontal scrollbar.

## NOT caused by Phase 124

`git log -S '<Separator className="my-2 mx-3" />' -- src/layouts/DashboardLayout.tsx`
returns `269458ac` (Phase 71's IA refactor into nav clusters), `2c7fc8af` (Phase 74) and
`ae56f64e` (Phase 63-03). **No Phase 124 commit.** Phase 124 rebuilt the sidebar around
four domains but kept the same separator-between-groups pattern, so the defect carried
through unchanged rather than being introduced.

## Remedy — pick one deliberately

The obvious `overflow-x-hidden` on the nav **hides the symptom and keeps the overhang**,
which will silently clip anything that legitimately needs the last 3px later. Prefer
fixing the width:

1. Drop `mx-3` and inset the separator with padding on its wrapper instead, or
2. `className="my-2 mx-3 w-auto"` so `w-full` stops fighting the margins.

Whichever is chosen, **re-measure** afterwards — assert `scrollWidth <= clientWidth` on
the nav, not merely that the scrollbar looks gone. And pair it with a control: confirm
the probe reports overflow correctly on the pre-fix markup, or a passing measurement
proves nothing.
