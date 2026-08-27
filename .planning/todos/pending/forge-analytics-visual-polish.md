---
id: TODO-forge-analytics-visual-polish
status: pending
planted: 2026-08-19
planted_during: Phase 122 (Tokens, Primitives & Contrast Measurement) — raised by the operator at the 122-19 checkpoint ("page looks like shit" on /forge and /analytics), then traced and ruled out as a Phase 122 regression
trigger_when: The next Forge- or Analytics-touching phase in v15.0, or a dedicated visual-polish phase. Pairs naturally with the Forge column-clipping todo — same page, same sitting.
scope: Small-to-medium (two independent visual treatments; the chart one may be a charting-library config rather than a token change)
source: Operator screenshots 2026-08-19 under Matrix Emerald at 1920px; traced against the pre-phase blob 001c1e73
resolves_phase: 131
last_reviewed: 2026-08-27
---

# Forge selected-row and single-series charts read as saturated slabs

Two separate visual complaints from the same checkpoint. **Neither is caused by Phase 122** — both
were verified against the pre-phase tree — but the operator looked closely at these pages for the
first time during the phase's sign-off and both are worth fixing.

## 1. The Forge selected job row is a solid saturated block

Selecting a job in the Forge list paints the entire row in full-strength accent. Under Matrix
Emerald that is a large slab of `#059669` behind body text, which is what the operator reacted to.

`src/pages/../components/forge/ForgeJobList.tsx:225`:

```jsx
isSelected ? "bg-accent border-l-2 border-primary" : ""
```

**Verified NOT a Phase 122 regression, two ways:**
- That line is byte-identical to the pre-phase blob at `001c1e73:221`.
- `--accent` under `[data-theme="emerald"]` is `#059669` in **both** trees (`index.css` line 273 now,
  line 199 pre-phase). The token value never moved.

So this is long-standing behaviour. The likely correct treatment is a subtle tint plus the existing
left border — e.g. an accent at low alpha, or `--surface-2`/`--surface-3` once Phase 122's ramp
re-derivation (plan 122-20) makes those perceptibly distinct — rather than a full-strength fill.
**Worth re-checking after 122-20 lands**, since a wider ramp may make a surface-based selected
state viable where it previously would have been invisible.

## 2. A single-series chart fills its panel as one flat slab

On `/analytics`, "LLM BY PROVIDER" with only one provider (`claude-cli`) renders as a large solid
green rectangle occupying most of the panel, which reads as a fill rather than as a chart.

`src/components/LlmProviderPanel.tsx`'s only Phase 122 change was its panel wrapper,
`bg-gray-800/50` → `bg-card/50` — the opacity modifier is preserved, so the phase did not
strengthen any fill.

This is a data-shape presentation problem: with n=1 the bar occupies the full domain. Options
include a minimum/maximum bar thickness, a different presentation below some series count, or an
explicit "single provider" summary treatment. Decide by role, not by palette.

## Related

- `.planning/todos/pending/forge-job-list-column-clips-card-rows.md` — same page, the 280px master
  column clipping its card header rows.
- `.planning/todos/pending/forgepage-pageheader-adoption.md` — same page, the hand-rolled title at
  `ForgePage.tsx:151`.

All three are Forge-page work and should be scheduled together; fixing them one at a time means
three separate visual re-checks with the operator.

## Re-derivation (Phase 128, 2026-08-27)

Re-checked against `HEAD` in this worktree, per D-04/D-06/D-07. Both complaints are
rendered-appearance judgements ("reads as a slab", "occupies most of the panel") depending on
token color values, chart-library layout, and screen composition together — not determinable from
class strings or component code alone. Context only (not evidence of presence or absence):
`src/components/forge/ForgeJobList.tsx` still contains `isSelected ? "bg-accent border-l-2
border-primary" : ""` at the line this todo cites, and `LlmProviderPanel.tsx`'s wrapper is still
`bg-card/50`, both re-read this session — cited for continuity only, not as proof the visual
complaint is still live.

**REQUIRES LIVE MEASUREMENT — deferred to Phase 131.** Full ledger entry:
`.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md`, Verdict 9.
`resolves_phase: 131` confirmed against `.planning/REQUIREMENTS.md:251`
(`FIX-08 | Phase 131 | Pending`).
