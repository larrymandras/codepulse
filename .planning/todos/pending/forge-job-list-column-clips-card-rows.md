---
id: TODO-forge-job-list-column-clips-card-rows
status: pending
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — surfaced by the operator at the D-28 token-layer checkpoint ("forge page needs work"), investigated and ruled out as a Phase 122 regression
trigger_when: Next Forge- or page-layout-touching phase in v15.0. Not urgent — the page is usable and the clipped text is metadata, not the job prompt. Do NOT fold into a token/sweep phase; this is page layout, not what a surface reads from.
scope: Small (one plan — the card header row inside a fixed-width master column)
source: Observed live 2026-08-19 at http://localhost:5173/forge, 1920px viewport; src/pages/ForgePage.tsx:175
resolves_phase: 131
last_reviewed: 2026-08-19
---

# Forge job-list column clips its card header rows

## What was observed (evidence, 2026-08-19)

On `/forge` at a 1920px viewport, every job card's header row is cut off hard at the right edge of
the job-list column. The status badge survives; the workspace chip renders as `LMOFFICE…` and the
engine name as `Cod…` / `Clau…`, truncated mid-word against the container edge rather than
degrading gracefully.

## What it is NOT

**Not a Phase 122 regression.** Waves 0–2 of Phase 122 changed exactly one file:

```
git diff --name-only 001c1e73..HEAD -- src/   ->   src/index.css
```

No component file was touched. `w-[280px]` is present in `ForgePage.tsx` in the pre-phase blob
`001c1e73` as well, so the geometry predates the phase.

**Not a broken responsive override, and not accidental width.** `src/pages/ForgePage.tsx:175`:

```
fixed inset-y-0 left-0 z-50 w-[280px] bg-background border-r border-border overflow-hidden
transform transition-transform duration-200
md:static md:z-auto md:translate-x-0 md:w-[280px] md:shrink-0 md:bg-transparent
```

Measured live at 1920px, the element computes to `position: static; width: 280px` — the `md:`
half IS applying, and `md:w-[280px]` sets the same 280px deliberately. A 280px master column
beside a detail pane is the intended master–detail layout.

**Not column-level overflow.** On that same element, `scrollWidth` 279 == `clientWidth` 279, so
nothing is overflowing the column itself. The clipping happens inside individual card rows, whose
badge + chip + engine-name row is wider than 280px and is cut by the column's `overflow-hidden`.

## The actual defect

The card header row has no wrapping or truncation strategy for a 280px container. It needs one of:
a `min-w-0` + `truncate` on the flexible children, wrapping to a second line, or dropping the
lowest-value chip below a width threshold.

## Related, found in the same investigation

`ForgeStatusBadge.tsx:59` carries `bg-red-900/60 text-[var(--status-error)]` — a raw palette fill.
Phase 122's plan **122-10** owns re-pointing it at the AA-clearing
`--status-error-fill` / `--status-error-on-fill` pair that 122-03 defined. That is in Phase 122's
scope and is NOT part of this todo; noted only so the two are not conflated.

Also found, and VERIFIED as a live gap in Phase 122's own sweep population: `index.html:18` is
`<body class="bg-gray-950 text-gray-100 font-geist subpixel-antialiased">` — hardcoded palette
classes on the document body, the widest-scope surface in the app. `index.html` is named in **0**
of the five sweep plans (`122-04`..`122-08`). Control proving that probe discriminates:
`src/components/AlertBanner.tsx` is named in exactly 1. The sweep population was scoped to 143
files under `src/`, and `index.html` is not under `src/`, so it was never a candidate.

This is tracked separately from this todo's layout defect — raised to the operator during Phase
122 wave 3 for a scope call, since it falls inside the phase's stated goal (sweep raw palette
classes) but outside its measured population.
