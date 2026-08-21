---
status: partial
phase: 124-shell-information-architecture
source: [124-VERIFICATION.md]
started: 2026-08-21T18:10:00Z
updated: 2026-08-21T18:10:00Z
---

## Current Test

[awaiting human testing]

Phase 124 is NOT marked complete. `124-VERIFICATION.md` returned `human_needed`
on the two items below. The phase stays pending until this file's tests are
resolved and verification re-runs as `passed`.

## Tests

### 1. Visit the three moved routes the checkpoint did not cover

expected: Each page loads the page you expect, at the same address it always
had, with a correct "Domain / Page" breadcrumb.

Item 8 of the 124-11 operator checkpoint named five routes that changed domain
in the regroup. The operator visited two — Automation (`/automation`, breadcrumb
`System / Automation`) and Tool Galaxy (`/tool-galaxy`, breadcrumb
`System / Tool Galaxy`) — and both loaded correctly at their old addresses.
These three were never opened and are recorded in `124-CHECKPOINT.md` as
NOT VERIFIED BY THE OPERATOR:

- `/briefings` — Briefings
- `/config` — Config
- `/workspace-map` — Workspace Map

Note on why the automated guard does not close this: 124-01's golden route-set
fixture (`src/lib/__tests__/navRegistry.routes.test.ts`, 44 entries, green,
mutation-proven) guarantees the **address** did not move for any of the 44 nav
items. It says nothing about whether the **page renders correctly**. Automation
and Tool Galaxy both passed the address check and both turned out to have
page-body defects — which is precisely why the address guard cannot substitute
for opening the page.

result: [pending]

### 2. Rule on the Criterion-1 letter-vs-intent gap

expected: An explicit ruling, recorded in ROADMAP.md, on whether Criterion 1 is
satisfied.

ROADMAP.md:839 states Criterion 1 as: *"A 48px 3-zone header (breadcrumb /
command bar / system-chip + E-Stop + overflow menu) renders on every route,
replacing today's header everywhere."*

The phase shipped a **56px** header (`min-h-14 flex-wrap gap-y-1`,
`DashboardLayout.tsx:840`), not 48px. This was a ruled, measured deviation, not
an oversight: plan 124-10 owned D-06's geometry and measured the three header
zones' combined min-content against available width, finding the zones exceed
the space at both breakpoints, so it took the documented wrap branch and
explicitly did not adopt `h-12`.

The verifier re-derived this independently rather than trusting the plan's
figures, and in doing so found a methodology defect worth carrying (see
"Carried finding" below). Its settled measurements: **375px — sum 366.2 vs 327
available (39px over); 900px — sum 720.8 vs 620 available (101px over).**

Criterion 1's letter is NOT MET. Its intent — one calm, shared 3-zone header on
every route, replacing the old unbounded 10-control row — WAS achieved:
`App.tsx:124` wraps all 54 routes in a single `DashboardLayout`, and the right
zone went from 10 elements to 6 visible plus a verified 4-item `⋯` menu.

Recommended ruling: amend ROADMAP.md's Criterion 1 to record the measured 56px
and the wrap branch, the same way REQUIREMENTS.md's SHELL-01 row was already
amended at `286c2d51` when D-07 struck the Help control. Alternative: keep the
criterion at 48px and record the phase as permanently not meeting it.

result: [pending]

## Carried finding — geometry spec measures a cold page

Not a test for the operator; a defect in a spec that will be re-run later, and
it should go into the follow-up phase alongside WR-01.

`e2e/polish-geometry.spec.ts` measures header zone min-content immediately after
`page.goto()`. `SystemChip` and `BrainHeaderBadge` render `null` until their
Convex subscriptions resolve, so a cold measurement **undercounts zone 3**. The
verifier's first pass read 375px: 268 vs 327 available — i.e. *under* budget,
which would have inverted D-06's conclusion — and 900px: 623 vs 620, barely
over. After a 3s settle both figures moved decisively over budget (366.2 and
720.8).

The spec's pass/fail is unaffected, because its actual assertion is
`culprits.length === 0` (no descendant clips), not the sum. But any future run
that reads those recorded sums as evidence will read undercounts, and at 375px
the cold number points the opposite way from the settled one. The spec needs an
explicit settle (or a wait on those two components) before it is used as a
measurement source again.
