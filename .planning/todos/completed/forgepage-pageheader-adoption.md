---
id: TODO-forgepage-pageheader-adoption
status: closed
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement), plan 122-11 (PageHeader page-layer contract, D-17/D-18)
trigger_when: The next plan that touches src/pages/ForgePage.tsx's header region, or a dedicated small plan in v15.0. Not urgent -- the page renders correctly today via its hand-rolled h1; this is a consistency gap, not a defect.
scope: Small (one file, header block only -- src/pages/ForgePage.tsx:150-159)
source: .planning/phases/122-tokens-primitives-contrast-measurement/122-11-PLAN.md Task 3; investigated during 122-11 execution 2026-08-19
resolves_phase: null
last_reviewed: 2026-08-20
closed: 2026-08-20
closed_by: Phase 123 plan 123-06 Task 2 (D-09) -- ForgePage.tsx:154 now renders <PageHeader title="Forge" className="mb-0 shrink-0" actions={...}/>; KNOWN_EXEMPT entry deleted from tokenSweep.ratchet.test.ts, mutation-proven. Verified live 2026-08-20 while opening Phase 124; the todo had been completed but never moved out of pending/.
---

# ForgePage.tsx hand-rolls the page title instead of using PageHeader

## What was observed

`src/pages/ForgePage.tsx:150-159` hand-rolls a page title in the exact shape `PageHeader`
already produces -- its own comment even says so: `{/* Page header — standard CodePulse
pattern (BuildProgress.tsx:24) */}`.

```tsx
<div className="flex items-center justify-between shrink-0">
  <h1 className="text-2xl font-bold text-foreground">Forge</h1>
  {/* Mobile-only toggle to reveal the job list overlay (F8) */}
  <button type="button" onClick={() => setListOpen(true)} aria-label="Show job list" ...>
    <PanelLeft className="h-5 w-5" />
  </button>
</div>
```

This is convertible: `title="Forge"` maps directly, and the mobile toggle button maps to
`PageHeader`'s existing `actions` slot.

## Why it was NOT converted in plan 122-11

1. **No plan in Phase 122 wave 4 owns this edit.** `ForgePage.tsx` is not in 122-11's
   `files_modified`. Checked every remaining wave-4 plan's frontmatter (122-08, 122-12
   through 122-19): only 122-08 touches this file, and only a single motion-duration class at
   `:175` (`git show 7350d327 -- src/pages/ForgePage.tsx`) -- it never touches the header block
   at `:150-159`.
2. **Converting it changes the rendered spacing.** `PageHeader` bakes in `mb-4`
   (`src/components/PageHeader.tsx`). ForgePage's current header carries NO bottom margin --
   spacing between it and the body is handled entirely by the parent's
   `space-y-4` (`ForgePage.tsx:147`). A straight substitution would add an extra `mb-4` on top of
   the parent's own gap, doubling the vertical space above the master-detail body. Cancelling it
   via `className="mb-0"` is possible but needs a visual check this plan's scope does not include
   (122-11's `files_modified` has no Playwright/visual-diff step for ForgePage).
3. Unlike Analytics/BuildProgress (Task 2 of this plan), this is a second, undeclared edit to a
   file already touched once this wave by 122-08 -- exactly the shape 122-11's own plan text
   flags as "should be an explicit decision rather than a silent second edit."

## What to do

Replace the block above with:

```tsx
<PageHeader
  title="Forge"
  className="shrink-0 mb-0"
  actions={
    <button type="button" onClick={() => setListOpen(true)} aria-label="Show job list" ...>
      <PanelLeft className="h-5 w-5" />
    </button>
  }
/>
```

Verify at 375px/768px/1920px that the master-detail body's vertical position is unchanged
(screenshot or DOM `getBoundingClientRect` before/after). This is unrelated to the separately
filed `forge-job-list-column-clips-card-rows.md` todo (a horizontal-clipping defect in the job
list column, not the header).
