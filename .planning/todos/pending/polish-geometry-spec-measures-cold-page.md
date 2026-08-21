---
id: TODO-polish-geometry-spec-measures-cold-page
status: pending
planted: 2026-08-21
planted_during: Phase 124 — found by gsd-verifier while independently re-deriving 124-10's D-06 header measurement instead of trusting the plan's figures
trigger_when: BEFORE e2e/polish-geometry.spec.ts is used as a measurement source again — i.e. any phase that re-opens header or sidebar geometry. It is not urgent as a test (it passes correctly today); it is urgent as EVIDENCE.
scope: Trivial (one task) — add an explicit settle or wait on the two components
source: e2e/polish-geometry.spec.ts; src/layouts/DashboardLayout.tsx (SystemChip, BrainHeaderBadge)
resolves_phase: null
last_reviewed: 2026-08-21
---

# `polish-geometry.spec.ts` measures a cold page and undercounts zone 3

## What was observed (2026-08-21)

The spec measures the header's three-zone min-content immediately after `page.goto()`.
`SystemChip` and `BrainHeaderBadge` render `null` until their Convex subscriptions
resolve, so a cold measurement **does not include them** — it undercounts zone 3.

The verifier's two passes on the same build:

| Viewport | Cold (immediately after goto) | After 3s settle | Available |
|---|---|---|---|
| 375px | **268** (UNDER budget) | **366.2** (39px over) | 327 |
| 900px | 623 (barely over) | **720.8** (101px over) | 620 |

At 375px the cold reading points the **opposite way** from the settled one. Read cold,
the evidence says the zones fit in 48px; read settled, it says they overflow by 39px.
D-06's entire branch decision turns on that comparison.

## Pass/fail is NOT affected — this is an evidence defect, not a test failure

The spec's actual assertion is `culprits.length === 0` (no descendant clips), not the
sum. So the test passes correctly today and will keep passing. What is wrong is that the
**numbers it records are undercounts**, and anyone who later reads those recorded sums as
evidence — which is exactly what a geometry spec exists to provide — will read figures
that can invert the conclusion they are being used to support.

124-10's own recorded figures (351.55 at 375px, 706.16 at 900px) sit between the cold and
settled values, i.e. that run was itself only partially settled. Its **conclusion holds**
at settled state at both breakpoints, and the phase's ruling is sound. But the margin at
375px is entirely dependent on settle state, and nothing in the spec says so.

## Fix

Add an explicit settle before measuring — preferably a wait on the two components
actually rendering (`SystemChip`, `BrainHeaderBadge`) rather than a bare timeout, so the
spec is deterministic rather than racing a fixed delay.

## Verification when fixed

Run it twice — cold and warm — and assert the two measurements now **agree**. A single
passing run cannot distinguish "the race is fixed" from "the race did not fire this
time." That agreement between the two runs IS the test.
