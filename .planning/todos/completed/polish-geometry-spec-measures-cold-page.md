---
id: TODO-polish-geometry-spec-measures-cold-page
status: closed
planted: 2026-08-21
planted_during: Phase 124 — found by gsd-verifier while independently re-deriving 124-10's D-06 header measurement instead of trusting the plan's figures
trigger_when: BEFORE e2e/polish-geometry.spec.ts is used as a measurement source again — i.e. any phase that re-opens header or sidebar geometry. It is not urgent as a test (it passes correctly today); it is urgent as EVIDENCE.
scope: Trivial (one task) — add an explicit settle or wait on the two components
source: e2e/polish-geometry.spec.ts; src/layouts/DashboardLayout.tsx (SystemChip, BrainHeaderBadge)
resolves_phase: 132
closed: 2026-08-27
closed_by: 128-02
last_reviewed: 2026-08-27
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

## Re-derivation (Phase 128, 2026-08-27)

Re-checked against `HEAD` in this worktree, per D-04/D-06. This todo's own prescribed fix
and its own prescribed verification method are both now implemented in
`e2e/polish-geometry.spec.ts`, landed by Phase 126-04 (SWEEP-07):

- `e2e/polish-geometry.spec.ts:365-379` — before measuring, the spec now
  `await expect(page.getByTestId('system-chip')).toBeVisible({ timeout: 15000 })` and the
  same for `brain-header-badge`, and **throws** (fails, does not skip) if either fails to
  render within 15s. The comment at this site names the exact defect this todo describes
  ("A measurement taken before these async children render undercounts zone 3") as the
  reason the wait exists.
- `e2e/polish-geometry.spec.ts:404-425` — the exact remedy this todo's own "Verification
  when fixed" section asked for: two readings, `HEADER_ZONE_SETTLE_POLL_MS` (500ms) apart,
  taken in a bounded polling loop, with the test's own comment explaining why a single
  fixed timeout was tried and rejected (measured flaky under worker contention: FAIL, FAIL,
  PASS across three consecutive full-file runs). The assertion at `:447-455` requires the
  two readings to **agree** within 1px before the test can pass — "that agreement... IS the
  test," verbatim the remedy this todo prescribed.

**Verdict: ALREADY FIXED.** Full ledger entry:
`.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md`, Verdict 4.

## Resolution (128-02, 2026-08-27)

Closed on re-derivation, not on new work performed by this plan (128-02 fixes no defects —
D-06/D-07). The fix landed in Phase 126; this session found and recorded that it had
already closed the gap this todo described. `resolves_phase` in the frontmatter is left at
132 (its filed value, confirmed correct against `.planning/REQUIREMENTS.md:252`'s
`FIX-09 | Phase 132 | Pending` row) for traceability — Phase 132 should verify this closure
and flip `FIX-09` to Complete, since REQUIREMENTS.md itself was found stale on this point
(see the ledger's D-05 Finding 3).
