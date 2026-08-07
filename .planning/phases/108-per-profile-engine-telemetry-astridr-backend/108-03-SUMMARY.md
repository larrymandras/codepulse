---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 03
subsystem: database
tags: [convex, telemetry, ingest, control-verb-swap, active-engine, per-profile]

# Dependency graph
requires:
  - phase: 108-02
    provides: controlVerbSwaps Convex table + internal-only record mutation + bounded listByScope query
provides:
  - "control_verb_swap ingest case: routes astridr swap-attempt events into the controlVerbSwaps domain table (TELE-02's write-half completion)"
  - "model_routing failed-status skip: a status:'failed' routing event never becomes a stored current-engine reading (ENGINE-01 correctness gap)"
  - "first-ever test coverage for both the model_routing and control_verb_swap ingest cases (previously zero)"
affects: [108-06 (GlobalSwapModal swap-history readout), 108-07 (deploy + live-backend proof)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Untestable httpAction-embedded switch cases get a LOCAL mirror function inside the test file (same convention as processSwarmTaskEvent), paired with a bounded comment-stripped static source check so the mirror cannot silently drift from the real case"
    - "New ingest case: dual snake/camel coalescing on every payload field, break-never-throw discipline, own domain table write plus the existing generic runtime_events row"

key-files:
  created: []
  modified:
    - convex/runtimeIngest.ts
    - convex/runtimeIngest.test.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "D-13 followed verbatim: control_verb_swap has no isUnresolvedRouting-equivalent guard — a refusal (affinity-refused, resolver failure) is a valid history row, proven by a dedicated regression test asserting the case body never calls isUnresolvedRouting"
  - "Failed-status guard placed ingest-side (runtimeIngest.ts), not astridr-side, because _emit_model_routing is one helper shared by four call sites including the failure path — branching there would complicate a function three other paths depend on (per plan rationale, followed verbatim)"

patterns-established:
  - "A case's own explanatory comment can contain the exact string a negative source-check test asserts against (e.g. this case's D-13 comment literally says 'isUnresolvedRouting') — always comment-strip before asserting on case-body text, confirmed live during this plan"

requirements-completed: [ENGINE-01]
# TELE-02 stays Pending, matching 108-02-SUMMARY's own corrected precedent:
# its full text is "routed to a domain table AND surfaced as per-profile
# swap history" — this plan (with 108-02) delivers the routing half, but
# the "surfaced" half is 108-06's GlobalSwapModal readout, not yet built.
# ENGINE-01 is now genuinely complete: 108-01 delivered the astridr-side
# emit + refuse-to-emit behavior (its own SUMMARY already declared this,
# though REQUIREMENTS.md's traceability table was never actually flipped —
# checked live before writing this line: still "Pending" as of this plan's
# start), and this plan closes the remaining correctness gap research Item
# 6 identified (a failed resolution rendering as a profile's live engine).

# Metrics
duration: ~35min
completed: 2026-08-07
---

# Phase 108 Plan 03: control_verb_swap Ingest Case + model_routing Failed-Status Guard Summary

**New `case "control_verb_swap"` routes astridr swap-attempt events into `controlVerbSwaps` via `internal.controlVerbSwaps.record`, and a new one-line guard stops a `status:"failed"` `model_routing` event from ever being stored as a profile's current engine — both previously untested, now with 14 new regression tests including three mutation-checked guards.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-07T08:05:00-04:00 (approx.)
- **Completed:** 2026-08-07T08:17:13-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 hand-written, 1 regenerated)

## Accomplishments
- `case "control_verb_swap"` added to `convex/runtimeIngest.ts`'s switch, immediately after `case "model_routing"`: dual snake/camelCase coalescing on every field, guards only on the schema's non-optional `verb`/`path` plus `channel`, calls `internal.controlVerbSwaps.record` (never `api.`), deliberately no `isUnresolvedRouting`-equivalent guard (D-13: refusals are valid rows), never throws
- `if (d.status === "failed") break;` added to `case "model_routing"`, before the existing `isUnresolvedRouting` check — closes research Item 6's correctness gap (`latestByProfile` has no status filter, so a failed resolution would otherwise render as the profile's live engine)
- `convex/_generated/api.d.ts` regenerated (`npx convex codegen`, local typegen only — no `deploy`) so `internal.controlVerbSwaps.record` typechecks; 2-line diff, additive only
- `convex/runtimeIngest.test.ts`: two new `describe` blocks, 14 new tests (plan required ≥7), pairing an executable local mirror function (same convention as the file's existing `processSwarmTaskEvent`) with bounded, comment-stripped static source checks — first-ever coverage for either case (verified zero hits before this plan)
- Three guards mutation-checked directly against `convex/runtimeIngest.ts` (not just the mirror): removing the failed-status skip, swapping `internal.`→`api.` on the new case, and swapping its `break` for a `throw` — all three went RED, each restored via backup-copy, then re-confirmed green (full RED transcripts below)

## Task Commits

Each task was committed atomically:

1. **Task 1: case "control_verb_swap" + the model_routing failed-status skip** - `97080141` (feat)
2. **Task 2: first test coverage for the model_routing and control_verb_swap ingest cases** - `9e705f2d` (test)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `convex/runtimeIngest.ts` - added `case "control_verb_swap"` (44 net new lines) and the `d.status === "failed"` skip inside `case "model_routing"`
- `convex/runtimeIngest.test.ts` - added `describe("runtimeIngest — model_routing case", ...)` (5 tests) and `describe("runtimeIngest — control_verb_swap case", ...)` (9 tests), plus a local `stripCommentLinesForIngestTests` helper and two mirror functions (`simulateModelRoutingCase`, `simulateControlVerbSwapCase`)
- `convex/_generated/api.d.ts` - regenerated via `npx convex codegen` (local typegen), 2-line additive diff adding `controlVerbSwaps` to the generated `internal.*` namespace

## Decisions Made
None beyond what 108-CONTEXT.md/108-03-PLAN.md already specified — D-13 (no refusal-guard on control_verb_swap) and the ingest-side placement of the failed-status guard were both already decided in the plan's `<interfaces>`/`<action>` blocks, not left to discretion this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's inline comment draft for the failed-status guard would have broken an existing, unrelated test**
- **Found during:** Task 1, immediately after adding the guard
- **Issue:** My first draft of the `d.status === "failed"` guard included a long explanatory comment block (research-Item-6 rationale). `convex/activeEngine.test.ts`'s pre-existing WR-06/168-06 regression test slices a **fixed 900-character window** from `case "model_routing"` (on comment-stripped source) and regex-matches for the `isUnresolvedRouting(` call inside that window. The long comment pushed the `isUnresolvedRouting(` call's offset in the STRIPPED source past 900 chars, which would have made that pre-existing test fail — a regression this plan's own files list (`runtimeIngest.ts`/`runtimeIngest.test.ts`) doesn't cover, since the failing test lives in `activeEngine.test.ts`.
- **Fix:** Trimmed the guard's comment to 4 lines (still names the research-Item-6 rationale and the WR-06/168-06 lesson, just tersely). Verified with a throwaway Node script mimicking the test's exact `stripCommentLines`+slice+regex logic that the stripped-source offset to `isUnresolvedRouting(` is 250 chars (well under 900) after the trim.
- **Files modified:** `convex/runtimeIngest.ts`
- **Verification:** Re-ran `npx vitest run convex/activeEngine.test.ts` → all passing (including the previously-at-risk WR-06/168-06 test); `npx tsc --noEmit` clean.
- **Committed in:** `97080141` (Task 1 commit — caught and fixed before committing, never landed in a broken state)

**2. [Rule 3 - Blocking] `internal.controlVerbSwaps.record` did not typecheck until `npx convex codegen` was run**
- **Found during:** Task 1, first `npx tsc --noEmit` after adding the case
- **Issue:** `convex/_generated/api.d.ts` had not been regenerated since plan 108-02 created `convex/controlVerbSwaps.ts`, so `internal.controlVerbSwaps` did not exist on the generated `internal` type — flagged in advance by this plan's own `<dependency_context>`.
- **Fix:** Ran `npx convex codegen` (local typegen only, exactly as pre-authorized by the plan's dependency context — did NOT run `npx convex deploy` or `npm run deploy`). Diff to `api.d.ts` is additive-only (2 lines).
- **Files modified:** `convex/_generated/api.d.ts`
- **Verification:** `npx tsc --noEmit` clean after regeneration; `git diff --stat convex/_generated/api.d.ts` shows a 2-line additive diff, no unrelated churn.
- **Committed in:** `97080141` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug — a plan-draft comment that would have broken a different file's pre-existing test; 1 blocking — pre-flagged codegen step)
**Impact on plan:** Both necessary for correctness/typechecking. No scope creep — neither touches production behavior beyond what the plan specified.

## Issues Encountered

**Comment text can satisfy or defeat a negative source-check assertion (discovered live, not merely anticipated by the plan).** The `control_verb_swap` case's own D-13 rationale comment explicitly says *"there is deliberately NO isUnresolvedRouting-equivalent guard here"* — the literal substring `isUnresolvedRouting` appears in that comment. A raw (non-comment-stripped) `expect(caseBody).not.toContain("isUnresolvedRouting")` would have failed on the plan's own required explanatory comment, not on an actual guard call. Caught before writing the test by first computing the case body with `stripCommentLinesForIngestTests` (mirroring the existing `activeEngine.test.ts`/`controlVerbSwaps.test.ts` convention) and asserting `not.toContain("isUnresolvedRouting(")` — the call-form, not the bare word — against stripped source. All 9 `control_verb_swap` tests and all 5 `model_routing` tests pass against the real, comment-intact file.

## User Setup Required

None - no external service configuration required. No deploy was run (deferred to plan 108-07 per CLAUDE.md's self-hosted Convex operational rules). `npx convex codegen` talks to the configured dev deployment to regenerate local TypeScript bindings only — it does not push functions to a production instance and is explicitly pre-authorized by this plan's dependency context.

## Next Phase Readiness

- Plan 108-06 (GlobalSwapModal swap-history readout) can now rely on live `controlVerbSwaps` rows actually arriving from astridr's `control_verb_swap` events — the full write path (ingest case → `internal.controlVerbSwaps.record` → table) is wired and tested. TELE-02 itself stays Pending until 108-06 lands the "surfaced as per-profile swap history" half of its own definition.
- ENGINE-01's "fabricated current-engine reading" gap (research Item 6) is closed: a failed routing resolution can no longer reach `activeEngineSnapshots`.
- No blockers for 108-06.
- Deploy is still deferred to 108-07 — the self-hosted backend has NOT received these function changes beyond what `npx convex codegen`'s local-bindings-only pull already touched.

## Verification Evidence

**Acceptance-criteria greps (Task 1):**
```
control_verb_swap case count: 1
internal.controlVerbSwaps.record count: 1
api.controlVerbSwaps count: 0
d.status === "failed" at line 732; isUnresolvedRouting( call at line 743 (732 < 743, correct order)
selectedModel count: 0
```

**Targeted test run:**
```
npx vitest run convex/runtimeIngest.test.ts convex/controlVerbSwaps.test.ts convex/activeEngine.test.ts
Test Files  3 passed (3)
     Tests  87 passed (87)
```
(64 in `runtimeIngest.test.ts` alone — 50 pre-existing + 14 new, well above the plan's ≥7 requirement; `grep -c "model_routing" convex/runtimeIngest.test.ts` and `grep -c "control_verb_swap" convex/runtimeIngest.test.ts` both went from 0 to several occurrences.)

**`npx tsc --noEmit`:** clean, no output, exit 0.

**Full suite (`npm test -- --run`), run in the main checkout (concurrent session 188.3-06 was active throughout — see disclosure below):**
```
Test Files  278 passed | 17 skipped (295)
     Tests  3547 passed | 193 todo (3740)
```
0 failed. This is the baseline (278 files / 3533 tests passed) plus exactly the 14 tests this plan added — no unrelated regressions, no unrelated failures.

## Mutation-Check Transcripts (Task 2 requirement + critical_correctness_rules)

All three mutations were applied directly to `convex/runtimeIngest.ts` via `Edit` (never via a throwaway copy the tests couldn't see), run against the real file, then restored via `cp <scratchpad>/runtimeIngest.ts.bak convex/runtimeIngest.ts` and re-verified with `git diff --stat convex/runtimeIngest.ts` returning empty before continuing. No `git checkout -- <file>` was used anywhere in this plan.

**Mutation 1 — removed `if (d.status === "failed") { break; }` from `case "model_routing"`:**
```
FAIL convex/runtimeIngest.test.ts > runtimeIngest — model_routing case >
d.status === 'failed' breaks before the isUnresolvedRouting( call, and the
case still preserves d.profileId ?? d.profile_id — static source check
AssertionError: expected -1 to be greater than -1
  827|     const failedIdx = caseBody.indexOf('d.status === "failed"');
  829|     expect(failedIdx).toBeGreaterThan(-1);
```
Restored; re-ran → 64/64 passed.

**Mutation 2 — swapped `internal.controlVerbSwaps.record` for `api.controlVerbSwaps.record`:**
```
FAIL convex/runtimeIngest.test.ts > runtimeIngest — control_verb_swap case >
the case body calls internal.controlVerbSwaps.record and never
api.controlVerbSwaps — static source check
AssertionError: expected 'case "control_verb_swap": { ... }' to contain
'internal.controlVerbSwaps.record'
```
Restored; re-ran → 64/64 passed.

**Mutation 3 — swapped the `control_verb_swap` guard's `break;` for `throw new Error("mutation-test");`:**
```
FAIL convex/runtimeIngest.test.ts > runtimeIngest — control_verb_swap case >
the case body contains no throw statement — static source check
AssertionError: expected 'case "control_verb_swap": { ... throw new
Error("mutation-test"); ... }' to not match /throw/
```
Restored; re-ran → 64/64 passed. `git diff --stat convex/runtimeIngest.ts` empty after final restore; `npx tsc --noEmit` clean.

## Defect-Class Sweep

After Task 1, swept the repo for other instances of the class this plan's own critical-correctness rules guard against:
- `grep -rn "api\.controlVerbSwaps" src/ convex/` → 2 hits, both prose (a doc-comment in `controlVerbSwaps.ts` explaining why the mutation must stay internal-only, and this plan's own new test asserting its absence) — no live `api.controlVerbSwaps` reference anywhere.
- `grep -rln "control_verb_swap"` → exactly the 4 files expected (`controlVerbSwaps.ts`, `runtimeIngest.ts`, `runtimeIngest.test.ts`, `schema.ts`); nothing stray in `src/`.

## Shared-Checkout Disclosure

This plan ran in the main `codepulse` checkout (`.git` is a directory, branch `master`), not a worktree, while a concurrent session was actively committing 188.3-06 TDD work (its commits `70f16112`/`a2990980` landed on `master` before this plan started and are visible in `git log`; no conflicting concurrent commits landed during this plan's own execution window). Only `convex/runtimeIngest.ts` (+ `convex/_generated/api.d.ts`) and `convex/runtimeIngest.test.ts` were staged, by explicit path, never `-A`/`.`; `git show --stat HEAD` after each commit confirmed exactly the intended files landed. `.planning/REQUIREMENTS.md` showed as ` M` throughout (the known CRLF stat artifact — confirmed via `git diff .planning/REQUIREMENTS.md` producing 0 lines of actual diff) and was left untouched, per this plan's explicit instruction. No `git stash`, `git checkout -- <file>`, `git clean`, `--amend`, or branch switch was used anywhere in this plan; all three mutation-check reversions used backup-copy (`cp`), confirmed byte-identical via `git diff --stat` returning empty before each subsequent step.

## Self-Check: PASSED

- FOUND: `C:\Users\mandr\codepulse\convex\runtimeIngest.ts` contains `case "control_verb_swap"`
- FOUND: `C:\Users\mandr\codepulse\convex\runtimeIngest.test.ts` contains `describe("runtimeIngest — control_verb_swap case"`
- FOUND: commit `97080141` in `git log --oneline --all`
- FOUND: commit `9e705f2d` in `git log --oneline --all`
- FOUND: `internal.controlVerbSwaps` in `convex/_generated/api.d.ts` (post-codegen)

## Threat Flags

None. This plan's only new surface (`case "control_verb_swap"`) is fully covered by the plan's own `<threat_model>` (T-108-14, T-108-15, T-108-03, T-108-16) — no new network endpoints, auth paths, or trust-boundary-crossing surface beyond what the plan already registered. The failed-status guard removes a fabrication surface (T-108-15) rather than adding one.

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Completed: 2026-08-07*
