---
phase: 113-debt-sweep
plan: 02
subsystem: database
tags: [convex, skills, prune-guard, coverage-declaration, tech-debt]

# Dependency graph
requires:
  - phase: 113-01
    provides: "hooks/scanner.mjs: /scan payload carries snapshot.scannedOrigins + snapshot.scannedOriginsComplete on a successful scan; both keys absent on an aborted scan"
provides:
  - "convex/skillSync.ts: sanitizeScannedOriginsComplete(value) — accepts only a literal boolean true"
  - "convex/skillSync.ts: computeSkillPrunes gains a 4th optional scannedOriginsComplete param — a third, RESTRICTIVE prune mode that limits pruning to exactly the declared origins when a producer asserts exhaustive coverage"
  - "convex/skillSync.ts: computePruneRefusals(existing, incoming, scannedOrigins?, scannedOriginsComplete?) — names, per origin, exactly the rows the legacy/additive rule would have deleted that the strict rule protects"
  - "convex/registry.ts: recordSkillPruneRefusals — shared alerts writer (source: skill-prune-guard) used by both syncInventory and syncFullInventory, with a 6-hour same-origin suppression window read via a bounded .take(20) indexed query"
affects: [113-03, 113-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A prune-authorizing manifest gets a companion exhaustiveness flag (scannedOriginsComplete) so RESTRICTIVE (declared-set-only) and PERMISSIVE (union-with-incoming) modes can coexist behind one sanitizer-guarded boolean, defaulting to the permissive/legacy behavior on any malformed shape"
    - "A refused destructive action writes an alerts row (source-tagged, severity warning) instead of console.warn, with a bounded-suppression window read via .take(N) on an existing index — never .collect() on a backend documented as memory-pressured"
    - "Two near-identical mutation call sites share one module-level async helper (recordSkillPruneRefusals) instead of hand-duplicated logic, so a future fix cannot land on only one side"

key-files:
  created: []
  modified:
    - convex/skillSync.ts
    - convex/registry.ts
    - convex/__tests__/skillSync.test.ts

key-decisions:
  - "The plan's action-text shorthand ('incoming carrying only the claude-code rows') for the REGRESSION/CONTROL fixture was read against the plan's own <behavior> section instead of literally: a fixture with zero claude-code:plugin entries in incoming can never produce a load-bearing control, because both the strict and legacy/additive paths already leave an origin absent from both incoming AND scannedOrigins untouched (that's the pre-existing GC-03 'undeclared origin' behavior, unchanged by this plan). The <behavior> section states the real gap explicitly: 'An origin present in incoming but NOT declared is not prunable — this is the plugin case and the whole point of the guard.' The REGRESSION/CONTROL fixture therefore includes one partial claude-code:plugin entry in incoming (simulating a scan that got 1 of 3 plugin skills before the read stopped), which is what makes the CONTROL genuinely prune 2 of the 3 plugin rows while the REGRESSION protects all 3 — satisfying the plan's own acceptance criterion that the two tests 'assert on the SAME _id values with opposite expectations.'"
  - "Task 3's required test coverage (the alert-payload-contract describe block asserting sorted output / exact keys / literal protectedCount / capped sampleNames, and the D-06 healthy-scan-produces-zero-refusals test) was written and committed as part of Task 1's commit rather than a separate one — both are pure-function tests against skillSync.ts exports authored in the same edit pass while building computePruneRefusals. No convex/registry.ts changes were needed for Task 3, and no additional test content remained to add after Task 1 landed; see 'Deviations from Plan' below."
  - "recordSkillPruneRefusals' by_source query and its .take(20) call are written on one line (rather than a multi-line fluent chain) specifically so a single grep line satisfies both the presence check and the bounded-read check — a readability/verification tradeoff, not a behavior change."

patterns-established:
  - "Exhaustive-coverage guard: a v.any() snapshot field can only WIDEN or NARROW deletion authority when validated through a sanitizer that accepts exactly one literal shape (=== true) and defaults to the least-permissive-for-safety fallback on everything else."

requirements-completed: []

# Metrics
duration: ~15min
completed: 2026-08-11
---

# Phase 113 Plan 02: Server-Side Prune Guard (Exhaustive-Coverage Refusal) Summary

**`computeSkillPrunes` gains a restrictive third mode gated on a producer's literal `scannedOriginsComplete: true` declaration, protecting undeclared origins (e.g. a partially-failed `claude-code:plugin` read) even when some of their rows leaked into `incoming`; every refusal is now named in a shared `alerts`-table writer wired into both `convex/registry.ts` prune call sites, suppressed for 6 hours per origin via a bounded indexed read.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-11T13:36:04-04:00 (baseline test run)
- **Completed:** 2026-08-11T13:51:25-04:00
- **Tasks:** 3 (Task 3's test content shipped inside Task 1's commit — see Deviations)
- **Files modified:** 3

## Accomplishments
- `convex/skillSync.ts`: `sanitizeScannedOriginsComplete` accepts only a literal `true`; `computeSkillPrunes` takes a 4th optional param that, when engaged, makes the prunable-origin set the declared `scannedOrigins` array ALONE (never seeded from `incoming`) — a RESTRICTIVE mode layered on top of the existing PERMISSIVE additive-manifest mode, which stays byte-identical when the new param is absent/false.
- `computePruneRefusals` computes the pure set difference between the legacy verdict and the strict verdict, grouped by origin, capped at 5 sample names, sorted by origin — `[]` whenever the strict path isn't engaged.
- `convex/registry.ts`: both `syncInventory` and `syncFullInventory` sanitize `snap.scannedOriginsComplete`, pass it through to `computeSkillPrunes`, and route any `computePruneRefusals(...)` output through one shared `recordSkillPruneRefusals` helper — verified identical between the two call sites except the `changedBy` string literal (`"scanner"` vs `"capability_sync"`).
- `recordSkillPruneRefusals` writes one `alerts` row per refused origin (`severity: "warning"`, `source: "skill-prune-guard"`, `status: "active"`), suppressed when a same-origin, non-resolved alert from that source was created within the last 6 hours — read via a bounded, indexed `.take(20)` (never `.collect()`), per CLAUDE.md's memory-pressure rule for this self-hosted backend. Nothing is written on a healthy scan: the writer is only called when `refusals.length > 0`.
- Test suite grew from 20 to 33 tests in `convex/__tests__/skillSync.test.ts` (13 new), including the mandated load-bearing control (REGRESSION and CONTROL assert opposite outcomes on the same `claude-code:plugin` row ids `["22","23"]`), an explicit `native`/`bridge` backward-compat test proving the legacy path is unchanged, a declared-but-empty-origin survival test, malformed-shape degradation across `"true"`/`1`/`{}`/`null`, and the D-05 alert-payload contract (literal `protectedCount` values `7`/`2`, `sampleNames` capped at 5/uncapped at 2, `toEqual([])` for the D-06 healthy-scan invariant).

## Task Commits

Each committed task's diff was verified with `git show --stat HEAD` immediately after committing (shared-checkout protocol) and contained only the intended files:

1. **Task 1: Coverage-declaration prune rule and pure refusal computation (D-03)** — `f05c1964` (feat). Includes Task 3's test content (see Deviations).
2. **Task 2: Wire the guard into BOTH prune call sites through one shared helper (D-01)** — `46719f3c` (feat).
3. **Task 3: Prove the refusal writer end to end against the pure inputs** — no separate commit; content shipped in `f05c1964` (see Deviations from Plan).

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified
- `convex/skillSync.ts` — `sanitizeScannedOriginsComplete`, `computeSkillPrunes`'s 4th param and rewritten 3-mode doc comment, `computePruneRefusals`
- `convex/registry.ts` — extended `./skillSync` import, `recordSkillPruneRefusals` module-level helper, both prune blocks (`syncInventory`, `syncFullInventory`) wired to compute and act on refusals
- `convex/__tests__/skillSync.test.ts` — 4 new `describe` blocks (33 tests total, was 20): `computeSkillPrunes — exhaustive-coverage guard (DEBT-05, D-03)`, `sanitizeScannedOriginsComplete (DEBT-05, D-03)`, `computePruneRefusals (DEBT-05, D-05)`, `computePruneRefusals — alert payload contract (D-05)`

## Decisions Made

See `key-decisions` in frontmatter for full rationale on: (1) the REGRESSION/CONTROL fixture design (a literal reading of the plan's action-text shorthand would have produced a non-load-bearing control — the plan's own `<behavior>` section and acceptance criterion took precedence), (2) Task 3's content shipping inside Task 1's commit, and (3) the single-line `by_source`/`.take(20)` query formatting to satisfy the exact-line grep acceptance check.

## Deviations from Plan

**1. [Clarification, not a Rule 1-4 deviation] Task 3's test content authored and committed alongside Task 1**

- **Found during:** Task 1, while writing `computePruneRefusals`'s test coverage per its own `<action>` spec (which already calls for testing `sampleNames` capped at 5 on a 7-row fixture).
- **Reasoning:** Task 3's `<action>` asks for a `describe("computePruneRefusals — alert payload contract (D-05)")` block plus a D-06 healthy-scan test — both are pure-function assertions against `skillSync.ts` exports with no dependency on `convex/registry.ts` (Task 2's file). Writing them in the same pass as Task 1's other `computePruneRefusals` tests was the natural, non-duplicative order; by the time Task 2 (registry wiring) was reached, Task 3's required assertions already existed and passed.
- **Verification:** All of Task 3's acceptance criteria are independently checked against the current file state: `npx vitest run convex/__tests__/skillSync.test.ts` exits 0 with 33 tests (was 20, strictly greater); the payload-contract test asserts literal `protectedCount` values (`toBe(7)`, `toBe(2)`), never `toBeGreaterThan`; the healthy-scan test asserts `toEqual([])`; `npx vitest run` (full suite) shows 0 failures.
- **Files modified:** `convex/__tests__/skillSync.test.ts` (already covered under Task 1's commit `f05c1964`).
- **Committed in:** `f05c1964` (Task 1's commit).

---

**Total deviations:** 1 (a task-boundary/commit-attribution clarification, not a functional deviation — no code behaves differently than the plan specified).
**Impact on plan:** None on scope or correctness. All of Task 3's acceptance criteria are met by content already present in `f05c1964`; this entry exists solely so the task→commit mapping is honest rather than implying a commit exists that doesn't.

## Issues Encountered

- The first `git commit -- <paths> -m "<message>"` invocation failed: `--` terminates option parsing for `git commit`, so putting `-m "<message>"` *after* the pathspec `--` caused git to treat `-m` and the message text as additional (nonexistent) pathspecs, erroring with no commit created. Recovered by writing the message to a scratch file and using `git commit -F <file> -- <paths>` for both task commits. Verified via `git status --short` before retrying that no partial commit had landed.
- `recordSkillPruneRefusals`'s `by_source` query initially spanned 4 lines (fluent chain), which satisfied the `query("alerts")` count criterion but not the "same line contains `.take(20)`" criterion literally. Collapsed to one line; re-verified with `grep -n 'query("alerts")' convex/registry.ts`.

## User Setup Required

None — no external service configuration required. No new packages installed. No deployment performed (per this plan's hard constraints); the code is committed but not pushed to the live self-hosted Convex instance.

## Next Phase Readiness

- The server-side half of DEBT-05's both-sides guard (D-01) is complete and independently defends against a producer we do not control (the astridr `native`/`bridge` producers, which send the legacy shape with no `scannedOrigins`/`scannedOriginsComplete` at all — proven untouched by the backward-compat test).
- `computeSkillPrunes` and `computePruneRefusals` are pure, fully unit-tested, and exported for reuse; `convex/registry.ts` now depends on both.
- **DEBT-05 is NOT closed by this plan.** Ground-truth check of `requirements:` frontmatter across `.planning/phases/113-debt-sweep/113-*-PLAN.md`: DEBT-05 is claimed by 113-01 (producer half, complete), 113-02 (this plan, server-side guard, complete), 113-03, and 113-04 — **not** 113-06, which is DEBT-06-only (its one "DEBT-05" text hit is a citation of the shared REQUIREMENTS.md block, not a requirements claim). This corrects the `<upstream_state>` framing this plan was dispatched with ("DEBT-05 spans plans 113-01/02/03/04/06"), which does not match the plans' own frontmatter. D-17's frontend origin-coupling fix (`Skills.tsx`, `src/lib/skills.ts`, `SkillLifecycleMenu.tsx`, `OriginBadge.tsx`) explicitly remains out of this plan's scope and is not yet shipped by any plan referenced in this session.
- No deployment has occurred — `npx convex deploy` was never run per this plan's hard constraints. The guard exists in code only until a future plan or explicit deploy step ships it to the live backend.

---
*Phase: 113-debt-sweep*
*Completed: 2026-08-11*

## Self-Check: PASSED

All claimed files and commit hashes verified present:
- FOUND: convex/skillSync.ts
- FOUND: convex/registry.ts
- FOUND: convex/__tests__/skillSync.test.ts
- FOUND: .planning/phases/113-debt-sweep/113-02-SUMMARY.md
- FOUND: f05c1964, 46719f3c
