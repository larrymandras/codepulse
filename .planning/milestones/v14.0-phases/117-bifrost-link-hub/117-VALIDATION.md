---
phase: 117-bifrost-link-hub
type: validation
authored: 2026-08-26
retroactive: true
---

# Phase 117 — Validation Strategy (RETROACTIVE)

**Written 2026-08-26, after the fact.** Phase 117 shipped via `/gsd-quick` and produced no
`PLAN.md` files — which is *why* it has no VALIDATION.md, not an oversight. Quick phases skip
the planning artifacts by design. This document reconstructs the coverage map from what was
actually built and what tests actually exist, and records the gaps honestly rather than
back-filling paperwork that says everything was covered.

Every ✅/❌ below was re-derived from the repo on 2026-08-26, not read off the summary.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`unit` project, jsdom) + Playwright for e2e |
| **Config file** | `vitest.config.ts` — `unit` project covers `src/**/*.test.{ts,tsx}` and `convex/**/*.test.ts` |
| **Quick run command** | `npx vitest run src/pages/Bifrost.test.tsx` |
| **Full suite command** | `npm test` (now sequential: `--project unit` then `--project browser`) |
| **Measured** | `src/pages/Bifrost.test.tsx` — **7 passed**, re-run 2026-08-26 |

## What phase 117 shipped

- `convex/schema.ts` — `links` table (+ `by_category`, `by_order` indexes)
- `convex/bifrost.ts` — domain module, including the `list` query that runs on EVERY route
- `src/pages/Bifrost.tsx` — categorised grid, pinned row, quick-add, liveness dots
- Command-palette link entries with collision-safe cmdk values

## Coverage Map

| # | Behavior | Test Type | Command / Location | Status |
|---|----------|-----------|--------------------|--------|
| 1 | `/bifrost` page renders its library, categories, pinned row | unit | `npx vitest run src/pages/Bifrost.test.tsx` (7 tests) | ✅ COVERED |
| 2 | `/bifrost` is reachable and the nav registry entry is a real link | e2e | `e2e/navigation.spec.ts` (9/9, click-through) | ✅ COVERED — and unit tests could not show this |
| 3 | Command-palette jump opens the target | e2e | `e2e/bifrost.spec.ts` — asserts on the POPUP's URL containing `8181`, not on clickability | ✅ COVERED (asserted on the outcome, not a proxy) |
| 4 | `links` table + indexes exist live | manual / deploy output | `117-VERIFICATION.md` clause 1 — deploy printed `[+] links.by_category`, `[+] links.by_order`; `bifrost:list` returned `[]` then 2 rows | ✅ VERIFIED LIVE |
| 5 | Container-name liveness dot reflects `dockerContainers.status` | — | none found | ❌ **GAP — untested** |
| 6 | **`bifrost:list` stays BOUNDED** (`LINK_LIST_SCAN_CAP`) | unit | `npx vitest run convex/bifrostListBounded.test.ts` (5 tests) | ✅ **CLOSED 2026-08-26** — gap found by this audit and fixed in the same pass |

## The gap that mattered: an unguarded bound on an every-route query (now closed)

`convex/bifrost.ts:85` reads `.take(LINK_LIST_SCAN_CAP + 1)`, and its own comment at `:66`
records that this query "runs on EVERY ROUTE" and "was an unbounded `.collect()` that read
every row". That bound is the fix for an app-wide read-cost defect.

**Nothing tested it, and that is what this audit found.** `grep -rln "LINK_LIST_SCAN_CAP" convex src` returns exactly two files —
`convex/bifrost.ts` and `convex/schema.ts` — and no test file. (Control: the same grep for
`ALERT_COUNT_SCAN_CAP` finds `convex/alertsCountBounded.test.ts`, so the check discriminates
between "bound with a guard" and "bound without one".)

This is the identical shape `convex/alertsCountBounded.test.ts` exists to guard for
`alerts:countBySeverity`, and its docstring states the reason plainly: an unbounded read on a
query the shell subscribes to everywhere is an app-wide DoS risk, and **a surviving
`.collect()` still returns correct counts on a small table** — only the recorded query shape
distinguishes bounded from unbounded. A behavioural test cannot catch a regression here.

**CLOSED 2026-08-26.** `convex/bifrostListBounded.test.ts` added, modelled on
`alertsCountBounded.test.ts`: it asserts on the RECORDED query (was a numeric limit passed
at all, and is it `CAP + 1` so truncation stays detectable), plus both sides of the
truncation boundary and a control that the handler still returns real, archived-filtered
links.

**Mutation-proven.** Swapping `.take(LINK_LIST_SCAN_CAP + 1)` back to `.collect()` fails 2
of the 5 with genuine assertions (`expected null not to be null`, `expected null to be
2001`). The other 3 stay GREEN under that mutation — which is the whole argument:
truncation and filtering behave identically on a small fixture, so only the recorded limit
discriminates a bounded read from an unbounded one.

## Nyquist verdict

**PARTIAL, improved.** The user-visible surface (page render, navigation, palette jump) is covered by
unit + e2e, and the live data path was verified against a real deploy. Of the two non-visual invariants, the read bound —
the one that protects every route — is now guarded and mutation-proven. The remaining gap
is the liveness-dot join (`links.containerName` → `dockerContainers.status`), which is
cosmetic: a wrong dot misinforms, it does not cost reads or break a page.
