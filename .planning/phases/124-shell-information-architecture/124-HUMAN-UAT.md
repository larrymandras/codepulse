---
status: resolved
phase: 124-shell-information-architecture
source: [124-VERIFICATION.md]
started: 2026-08-21T18:10:00Z
updated: 2026-08-21T18:40:00Z
---

## Current Test

[none - both tests resolved 2026-08-21T18:40:00Z]

Phase 124 IS now marked complete. Historical note: `124-VERIFICATION.md` returned
`human_needed` on the two items below, and the phase was held pending — not
marked complete, not recorded as passing — until the operator resolved both on
2026-08-21. Both results are recorded in place under each test.

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

result: **PASS** (2026-08-21). The operator supplied three screenshots against
`http://localhost:5181`. All three loaded at their pre-regroup addresses with
breadcrumbs matching D-16's registry lookup exactly:

| Route | Breadcrumb | Rendered |
|---|---|---|
| `/briefings` | Agents / Briefings | Session list + daily digest |
| `/config` | System / Config | Core Security Layers panel |
| `/workspace-map` | Observe / Workspace Map | Radial graph, 53/53 roots covered |

With Automation and Tool Galaxy from the original checkpoint, all five moved
routes are operator-confirmed. Checklist item 8 moves PARTIAL -> PASS.

Corroborating side observation: per-domain collapse state persisted across all
three navigations (COMMAND closed, OBSERVE open), independently confirming
124-05's persistence work outside the test that was written for it.

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

result: **RULED "AMEND"** (2026-08-21, operator). Both artifacts were amended:

- `ROADMAP.md` criterion 1 - "48px" struck, the measured 56px recorded with
  both breakpoint measurements, the wrap branch named, and the intent-achieved
  finding stated separately from the letter-not-met finding.
- `REQUIREMENTS.md` SHELL-01 - "48px" struck, marked `[x]`, traceability row
  Pending -> Complete, carrying a second dated amendment beside the existing
  D-07 Help-control one from `286c2d51`.

The deviation is recorded as ruled. It was never rounded up to a pass.

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

(Status: DEFERRED to the follow-up phase.) The spec's pass/fail is unaffected, because its actual assertion is
`culprits.length === 0` (no descendant clips), not the sum. But any future run
that reads those recorded sums as evidence will read undercounts, and at 375px
the cold number points the opposite way from the settled one. The spec needs an
explicit settle (or a wait on those two components) before it is used as a
measurement source again.

## Second carried finding - sidebar 4px horizontal overflow

Found by the orchestrator while closing test 1, from the operator's own
screenshots (a horizontal scrollbar visible at the sidebar's bottom edge in all
three). Measured rather than inferred, via Playwright at 1512x900 after a 3s
settle:

- `<aside>` width is exactly **232px** - D-17 holds, this is not a width bug.
- Its `<nav>` (`flex-1 overflow-y-auto py-2 px-2`) reports **clientWidth 231 /
  scrollWidth 235**, computed `overflow-x: auto`.
- Widest descendant reaches `right: 235` - 3px past the aside's edge. It is the
  domain `Separator`.

Cause: `<Separator className="my-2 mx-3" />` at `DashboardLayout.tsx:463`. The
primitive carries `data-[orientation=horizontal]:w-full`, so `mx-3` places its
right edge at 235px. The scrollbar then appears because CSS computes
`overflow-x: visible` -> `auto` once `overflow-y-auto` is set on the same box -
so a 3px child overhang is enough to produce a full-width scrollbar.

NOT caused by this phase: `git log -S '<Separator className="my-2 mx-3" />' --
src/layouts/DashboardLayout.tsx` returns `269458ac` (Phase 71's nav
clustering), `2c7fc8af` (Phase 74) and `ae56f64e` (Phase 63-03), with no Phase
124 commit. Phase 124 kept the same separator-between-groups pattern while
rebuilding the sidebar, so the defect carried through unchanged.

Status: DEFERRED to the follow-up phase by the operator's standing ruling on
pre-existing defects. Unlike the Convex items it is frontend-only, needs no
deploy, and is a one-class fix.
