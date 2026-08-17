---
phase: 112-telemetry-coverage-closure
plan: 03
subsystem: database
tags: [convex, internalMutation, telemetry, CR-01]

# Dependency graph
requires:
  - phase: 112-telemetry-coverage-closure (plan 02)
    provides: governorDecisions + messageRoutes domain tables in convex/schema.ts, both retention-bounded
provides:
  - "governorDecisions.ts: internalMutation record + bounded query listRecent (GOVERNOR_DECISION_CAP=50)"
  - "governorDecisionsFilters.ts: dependency-free GOVERNOR_DECISION_CAP export for browser import"
  - "messageRoutes.ts: internalMutation record + bounded query listRecent (MESSAGE_ROUTE_CAP=50, declared in-file)"
  - "governorDecisions.test.ts + messageRoutes.test.ts: CR-01 guard, bounded-read guard, live-validator args-shape assertions"
  - "convex/_generated/api.d.ts regenerated to name governorDecisions/governorDecisionsFilters/messageRoutes"
affects: [112-04, 112-05, 112-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CR-01: write path declared internalMutation, never mutation, closing the client-callable api. namespace"
    - "dependency-free filters module split only when a browser consumer needs the constant this phase (governorDecisions has one via plan 05; messageRoutes does not, per 112-PATTERNS.md seam 3)"
    - "live-validator assertions via record.exportArgs() rather than hand-typed literals (108-07 gap-closure precedent)"

key-files:
  created:
    - "convex/governorDecisionsFilters.ts"
    - "convex/governorDecisions.ts"
    - "convex/governorDecisions.test.ts"
    - "convex/messageRoutes.ts"
    - "convex/messageRoutes.test.ts"
  modified:
    - "convex/_generated/api.d.ts"

key-decisions:
  - "Both record mutations implemented exactly per the plan's <decided_shapes> (Claude's Discretion already resolved at plan time) — no re-litigation."
  - "No ingest wiring, no UI — explicitly out of scope for 112-03 per the plan's Output section (plans 04/05)."
  - "codegen invoked bare (npx convex codegen) after --env-file was rejected as an unknown option on this subcommand; api.js needed no edit since it re-exports via anyApi."

requirements-completed: [TELE-03]

# Metrics
duration: ~20min
completed: 2026-08-12
---

# Phase 112 Plan 03: Governor-Decision + Message-Route Domain Modules Summary

**Built the Convex-side write/read modules for both Phase 112 tables — `governorDecisions.ts` and `messageRoutes.ts`, each an `internalMutation` `record` + a capped `query` `listRecent` — with source-level CR-01/bounded-read guard tests, one mutation-proven live (RED then GREEN), and regenerated Convex API types, with no deploy run.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files created:** 5 (`convex/governorDecisionsFilters.ts`, `convex/governorDecisions.ts`, `convex/governorDecisions.test.ts`, `convex/messageRoutes.ts`, `convex/messageRoutes.test.ts`)
- **Files modified:** 1 (`convex/_generated/api.d.ts`)

## Accomplishments

- `governorDecisions.ts` — `record` (`internalMutation`, append-only insert, args match `schema.ts`'s `governorDecisions` table field-for-field including `heldReason: v.optional(v.string())`) and `listRecent` (`query`, no args, `.withIndex("by_timestamp").order("desc").take(GOVERNOR_DECISION_CAP)`). `GOVERNOR_DECISION_CAP = 50` lives in the sibling dependency-free `governorDecisionsFilters.ts` (zero import statements — verified directly), following the `controlVerbSwapsFilters.ts` precedent from the 108-06 client-bundle defect, so plan 05's component can import the cap without pulling in the Convex server runtime.
- `messageRoutes.ts` — same `record`/`listRecent` shape; `MESSAGE_ROUTE_CAP = 50` declared **in this file**, not split into a filters module, per `<decided_shapes>`: no browser code imports it this phase (D-13, deliberately unsurfaced). The file's D-13 rationale is recorded in a docstring and asserted present in-source by its test file. `listRecent` is kept — not dead code — as the read-only probe plan 07's live post-deploy verification will call.
- Both `record` mutations are `internalMutation`, never `mutation` — closes the client-callable `api.` namespace entirely, per CR-01 and this repo's SEED-008 standing rule that every public Convex function is callable with no credential by anything that can route to the host.
- Neither module contains `.collect(` anywhere — both reads are `.take()`-bounded over the `by_timestamp` index created in plan 02.
- `governorDecisions.test.ts` (12 tests) and `messageRoutes.test.ts` (12 tests) — 24/24 passing. Each carries: a CR-01 guard (with the raw-file vacuity control proving the negative assertion is non-vacuous), a bounded-read guard, and live-validator args-shape assertions read through `record.exportArgs()` (the real Convex runtime API), not a hand-typed literal. `governorDecisions.test.ts` additionally asserts `heldReason.optional === true` (the field plan 04's D-14 null-normalization depends on) and that `GOVERNOR_DECISION_CAP` is imported from `./governorDecisionsFilters`, not re-declared. `messageRoutes.test.ts` asserts the opposite shape — `MESSAGE_ROUTE_CAP` declared in-file — and that no sibling `messageRoutesFilters.ts` exists.
- `convex/_generated/api.d.ts` regenerated via bare `npx convex codegen` (see Codegen Invocation below); +6 lines, alphabetically correct, naming all three new modules. `convex/_generated/api.js` required no edit — it re-exports via `anyApi`/`componentsGeneric()` and has no per-module entries to add.
- Full `convex/` suite: 79 files (77 baseline + 2 new) | 2 skipped, 1476 tests (1452 baseline + 24 new) | 98 todo, 0 failed. No regression.

## Task Commits

Each task was committed atomically, named paths only:

1. **Task 1: Create governorDecisionsFilters.ts and governorDecisions.ts** — `4649ec93` (feat)
2. **Task 2: Create messageRoutes.ts** — `dd64983d` (feat)
3. **Task 3: Guard tests for both modules, and regenerate the Convex API types** — `947908fa` (test)

**Plan metadata:** recorded below (this SUMMARY.md + STATE.md + ROADMAP.md), committed separately per the sequential-executor instructions.

Each commit's `git show --stat HEAD` was read immediately after committing and confirmed to touch exactly the intended file(s) — no foreign files were swept in from the concurrent Phase 115 session (which had 6 untracked `115-0N-PLAN.md` files present in `git status --short` throughout this plan's execution, all correctly left untouched).

## Files Created/Modified

- `convex/governorDecisionsFilters.ts` — new, dependency-free, exports `GOVERNOR_DECISION_CAP = 50`. Zero `import` statements (verified: `grep -c "^import" convex/governorDecisionsFilters.ts` → `0`).
- `convex/governorDecisions.ts` — new, exports `record` (`internalMutation`) and `listRecent` (`query`), imports `GOVERNOR_DECISION_CAP` from the filters module.
- `convex/governorDecisions.test.ts` — new, 12 tests: record-args-shape (live validator), CR-01 guard + vacuity control, bounded-read guard (import-not-redeclare + cap value), listRecent shape/registration guard, filters-module dependency-free guard.
- `convex/messageRoutes.ts` — new, exports `MESSAGE_ROUTE_CAP = 50` (in-file), `record` (`internalMutation`), `listRecent` (`query`). D-13 rationale recorded in a file-level docstring.
- `convex/messageRoutes.test.ts` — new, 12 tests: record-args-shape (live validator), CR-01 guard + vacuity control, bounded-read guard (in-file declaration + no sibling filters module + cap value), listRecent shape/registration guard, D-13 string-presence guard.
- `convex/_generated/api.d.ts` — regenerated by `npx convex codegen`; added 3 alphabetically-sorted import lines (`governorDecisions`, `governorDecisionsFilters`, `messageRoutes`) and 3 matching module-map entries. `git diff --stat`: 6 insertions, 0 deletions, single file. No other generated file changed.

## Codegen Invocation

Per the plan's ordered fallback: `npx convex codegen --env-file "C:\Users\mandr\convex-selfhost\selfhosted.envfile"` was tried first and rejected with `error: unknown option '--env-file'`. Retried as bare `npx convex codegen`, which succeeded (exit 0). **The bare form is the one that worked.**

`npx convex codegen --help` output confirms this command is read-only with respect to the live deployment: *"This doesn't modify the code running on the deployment."* The command's own progress log includes a `Downloading current deployment state...` / `Uploading functions to Convex...` step (bundling for typecheck purposes, per the CLI's documented behavior) — this is NOT a deploy. No `deploy`, `--push`, `--prod`, or `--yes` flag was used anywhere in this plan's execution.

## Task 3 Evidence — CR-01 Mutation Proof (RED then GREEN, verbatim)

**Setup:** backed up `convex/governorDecisions.ts` to the scratchpad before mutating.

**Mutation:** changed `export const record = internalMutation({` to `export const record = mutation({` (and added `mutation` to the `./_generated/server` import so the module still loads at runtime — a bare rename without the import would crash on an unrelated `ReferenceError`, not on the CR-01 guard itself).

**RED run** — `npx vitest run convex/governorDecisions.test.ts` against the mutated file:

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 ❯ convex/governorDecisions.test.ts (12 tests | 2 failed) 9ms
     × declares record with internalMutation, never with a public mutation builder 3ms
     × is registered with query(, not internalMutation/mutation — record stays the file's only internalMutation( (CR-01 regression guard) 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  convex/governorDecisions.test.ts > CR-01 — record authorization boundary (source-level guard) > declares record with internalMutation, never with a public mutation builder
AssertionError: expected 'import { internalMutation, mutation, …' to match /record\s*=\s*internalMutation\(/

 FAIL  convex/governorDecisions.test.ts > listRecent — declared as query({ args: {}, ... }), takes no arguments > is registered with query(, not internalMutation/mutation — record stays the file's only internalMutation( (CR-01 regression guard)
AssertionError: expected +0 to be 1 // Object.is equality

 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)
```

Exactly the two CR-01-related assertions failed (the direct guard and the "record is the file's only internalMutation" cross-check); all 10 other tests in the file — including the record-args-shape block that still reads real validators off the (now-public) mutation — stayed green, confirming the failure is specific to the authorization boundary, not a harness-wide break.

**Restore:** copied the backed-up file back over `convex/governorDecisions.ts`; `git diff --stat convex/governorDecisions.ts` returned empty output (exit 0, no lines), confirming the restored file is byte-identical to Task 1's commit (`4649ec93`).

**GREEN run** — `npx vitest run convex/governorDecisions.test.ts convex/messageRoutes.test.ts` after restore:

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 Test Files  2 passed (2)
      Tests  24 passed (24)
```

24/24 passed (12 governorDecisions + 12 messageRoutes). A green that was never observed going red is not a guard — this one was.

## Verification (plan's `<verification>` block, all 5 checks)

1. `npx vitest run convex/governorDecisions.test.ts convex/messageRoutes.test.ts` — 24/24 passed (final state, after mutation-proof restore).
2. `npx tsc --noEmit` — exit 0 (run after each task; all clean).
3. Neither new module contains `.collect(` (`grep -c ".collect(" convex/governorDecisions.ts convex/messageRoutes.ts` → `0`/`0`); both `record` functions are `internalMutation` (`grep -E "record\s*=\s*internalMutation\("` matched in both files).
4. `convex/_generated/api.d.ts` names `governorDecisions`, `governorDecisionsFilters` and `messageRoutes` — `grep -c "governorDecisions" convex/_generated/api.d.ts` → `4`; `grep -c "messageRoutes" convex/_generated/api.d.ts` → `2`.
5. The CR-01 mutation proof (red then green) is quoted verbatim above.

**Additional sanity check (not required by the plan, run as insurance):** `npx vitest run convex/` — full convex test directory, 79 files (77 baseline + 2 new) | 2 skipped, 1476 tests (1452 baseline + 24 new) | 98 todo, 0 failed. No regression introduced by the new modules or the regenerated API types.

## Decisions Made

- Implemented `governorDecisions.ts`/`governorDecisionsFilters.ts`/`messageRoutes.ts` exactly per the plan's `<decided_shapes>` section (naming/cap-sizing/split-vs-no-split were already resolved as Claude's Discretion at plan time — this execution did not re-choose them).
- No ingest routing, no UI component were added — explicitly out of scope per the plan's Output section, deferred to plans 04/05.
- Codegen ran bare (`npx convex codegen`, no `--env-file`) after the plan's documented fallback path fired; recorded per the plan's explicit instruction to note which form worked.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria were met without any Rule 1-4 auto-fix or architectural escalation. The `--env-file` rejection was an anticipated fallback path explicitly written into the plan, not a deviation.

## Issues Encountered

None.

## Threat Flags

None. This plan's surface (two `internalMutation` write paths, two capped `query` reads) is fully covered by the plan's own `<threat_model>` (T-112-01 through T-112-14, T-112-SC) — no new trust boundary, network endpoint, auth path, or schema change outside that register was introduced.

## Known Stubs

None. Both modules are complete for their stated scope (write path + bounded read); `messageRoutes.listRecent` has no UI consumer this phase, but that is the plan's own deliberate D-13 decision, documented in-source and in this SUMMARY, not a stub standing in for missing functionality.

## User Setup Required

None — no external service configuration required. No `npx convex deploy` was run (operator-gated, reserved for plan 112-07 per the plan's explicit prohibition and this execution's standing verification-discipline instructions). Both domain modules are committed but NOT deployed — this is the correct end state for this plan.

## Next Phase Readiness

- Both domain modules exist with an internal-only write path and a capped read, ready for plan 112-04 (ingest routing: the `governor_decision` and `message_routed` dispatch cases in `convex/runtimeIngest.ts`, including D-14's `heldReason` null-normalization that `governorDecisions.test.ts`'s optionality assertion now guards).
- `convex/_generated/api.d.ts` names `api.governorDecisions.listRecent`, unblocking plan 112-05's UI component to typecheck against it.
- `messageRoutes.listRecent` is ready as plan 112-07's live post-deploy read-only probe target.
- No deploy was run; `npx convex deploy` remains reserved for plan 112-07 (`autonomous: false`, operator-gated, live proof).

---
*Phase: 112-telemetry-coverage-closure*
*Completed: 2026-08-12*

## Self-Check: PASSED

- `convex/governorDecisionsFilters.ts` — FOUND, exports `GOVERNOR_DECISION_CAP = 50`, zero import statements.
- `convex/governorDecisions.ts` — FOUND, `record = internalMutation(`, `listRecent = query(`, `.take(GOVERNOR_DECISION_CAP)`, no `.collect(`.
- `convex/governorDecisions.test.ts` — FOUND, 12/12 tests passing.
- `convex/messageRoutes.ts` — FOUND, `record = internalMutation(`, `MESSAGE_ROUTE_CAP = 50` declared in-file, `.take(MESSAGE_ROUTE_CAP)`, no `.collect(`, contains `D-13`.
- `convex/messageRoutes.test.ts` — FOUND, 12/12 tests passing.
- `convex/_generated/api.d.ts` — FOUND, names `governorDecisions`, `governorDecisionsFilters`, `messageRoutes` (4/2 grep counts as reported above).
- Commit `4649ec93` — FOUND in `git log --oneline -6`.
- Commit `dd64983d` — FOUND in `git log --oneline -6`.
- Commit `947908fa` — FOUND in `git log --oneline -6`.
- `.planning/phases/112-telemetry-coverage-closure/112-03-SUMMARY.md` — FOUND (this file).
