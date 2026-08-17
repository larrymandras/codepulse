---
phase: 112-telemetry-coverage-closure
plan: 06
subsystem: database
tags: [convex, telemetry, drift-guard, mutation-testing, TELE-03]

# Dependency graph
requires:
  - phase: 112-telemetry-coverage-closure (plan 04)
    provides: "governor_decision + message_routed dispatch cases live in convex/runtimeIngest.ts, so this plan's guard could cross-check the record against real code"
  - phase: 112-telemetry-coverage-closure (plan 02)
    provides: "governorDecisions + messageRoutes tables in convex/schema.ts, so this plan's guard could cross-check routed entries' table names against real schema"
provides:
  - "convex/telemetryDispositions.ts: GROUP_B_DISPOSITIONS, a zero-import const recording all 7 remaining Group B kinds' dispositions (D-10/D-11), with D-01's bar, D-02's re-measurement recipe, D-03's scope caveat, D-05's resolved gate and D-12's deferral recorded in the file's own docstring"
  - "convex/telemetryDispositions.test.ts: a three-layer drift guard (harness liveness, per-kind assertions cross-checked against runtimeIngest.ts/schema.ts, source-text reason/date assertions), mutation-proven against 3 distinct drift classes"
affects: [112-07, 112-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GROUP_B_DISPOSITIONS follows RETENTION_DAYS's precedent exactly: a plain exported const with the drift-guard rationale documented in its own header comment, read by a source-parsing test rather than a hand-copied policy"
    - "Three-layer drift guard (harness liveness -> per-kind cross-checked assertions -> source-text negative assertions) generalizes retention.test.ts's two-layer pattern by adding a reason-text enforcement layer, needed here because this record's payload is prose (a reason string), not just a number"
    - "A rule's own explanatory prose must avoid the literal substrings its own negative-assertion test forbids — GROUP_B_DISPOSITIONS' docstring explains the D-03 caveat without ever writing the three banned phrases verbatim, so the guard doesn't trip on the file describing the guard"

key-files:
  created:
    - "convex/telemetryDispositions.ts"
    - "convex/telemetryDispositions.test.ts"
  modified: []

key-decisions:
  - "Wrote the D-03 caveat explanation in telemetryDispositions.ts's docstring using paraphrases ('was not emitted', 'does not fire', 'lacks any emitter') rather than the exact banned phrases ('never emitted', 'never fires', 'no emitter') the Layer 3 test forbids — otherwise the docstring explaining the rule would itself trip the rule's own negative-source-text assertion."
  - "Extracted dispatchedCases from runtimeIngest.ts with a single whole-file regex rather than isolating the switch block, after confirming there is exactly one `switch` statement in the file (verified via grep before writing the test) — a whole-file scan cannot pick up a stray case label from an unrelated switch because none exists."

requirements-completed: [TELE-03]

# Metrics
duration: ~25min
completed: 2026-08-12
---

# Phase 112 Plan 06: TELE-03 Disposition Record + Three-Layer Drift Guard Summary

**`convex/telemetryDispositions.ts`'s `GROUP_B_DISPOSITIONS` const records all 7 remaining Group B event kinds' dispositions (3 routed, 4 generic-table-by-design) with D-01's bar, D-02's re-measurement recipe, D-03's scope caveat, D-05's resolved gate and D-12's deferral recorded in-source, guarded by a three-layer test mutation-proven against 3 distinct drift classes.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files created:** 2 (`convex/telemetryDispositions.ts`, `convex/telemetryDispositions.test.ts`)
- **Files modified:** 0 (Task 3's `runtimeIngest.ts` edits were all temporary, mutated then restored — no net change)

## Accomplishments

- `convex/telemetryDispositions.ts` exports `GROUP_B_DISPOSITIONS`, a zero-`import` plain const (matching `controlVerbSwapsFilters.ts`'s dependency-free precedent, so both the Convex server bundle and any future browser consumer can import it safely) with exactly 7 keys spelled identically to `runtimeIngest.ts`'s dispatch switch and the live data: `governor_decision`, `control_verb_swap`, `message_routed` (all `disposition: "routed"`, naming `governorDecisions`/`controlVerbSwaps`/`messageRoutes` respectively) and `prompt_assembly`, `structured_output_exhausted`, `vision.capture` (dot, not underscore), `control_verb_focus` (all `disposition: "generic-table-by-design"`).
- The file's docstring records, in place rather than only in planning documents: D-01's bar (live arrival inside the 14-day `runtime_events` window, established by a control-paired probe); D-02's re-measurement recipe (`events:listByType` bounded `.take()` via `--env-file`, never `events:countByType`, paired against `llm_call` known-present [1,261 rows] / `definitely_not_a_real_kind_9x7q2` known-absent [0 rows]); D-03's scope caveat that "no row in the 14-day window" means not-in-window, never never-emitted; D-05's resolved low-volume gate for `message_routed`; and D-12's deliberate deferral of an astridr-repo-side emitter probe to Deferred Ideas rather than dropping it.
- `convex/telemetryDispositions.test.ts` implements the plan's three-layer guard exactly as specified: **Layer 1** (harness liveness) asserts both the `runtimeIngest.ts` case-label parser and the `schema.ts` table-name parser found more than 20 members, with a known-present control (`llm_call`, `alerts`) and a known-absent control (`definitely_not_a_real_kind_9x7q2`) checked before anything downstream runs. **Layer 2** declares the canonical seven kinds independently of the const under test, asserts two-directional set equality, gives each kind its own explicitly-named assertion block (never a loop over the object's own keys — a loop cannot notice an entry that's absent), and cross-checks every "routed" kind against a real `case "<kind>":` in `runtimeIngest.ts` and a real table in `schema.ts`, and every "generic-table-by-design" kind against having NO case in `runtimeIngest.ts`. **Layer 3** reads `telemetryDispositions.ts`'s own source and asserts the measurement date and D-12 deferral are recorded, and that none of the three banned overstatement phrases appear anywhere in the file — plus an in-memory check that every entry's `measured` field is a real ISO date and every generic-by-design `reason` cites the scope-caveat phrase.
- 16/16 tests pass. Full repo suite: 4112 passed / 193 todo / 0 failed (baseline 4096, exactly +16 — this plan's new tests, no regression elsewhere).

## Task Commits

Each task was committed atomically, named paths only:

1. **Task 1: convex/telemetryDispositions.ts (D-10, D-11, D-01, D-03, D-05, D-12)** — `5420f694` (feat)
2. **Task 2: three-layer drift guard test** — `f8d27799` (test)
3. **Task 3: mutation-prove the guard** — no commit (working-tree-only mutations, all three fully restored to Task 1/2's committed byte-for-byte state; the evidence is this SUMMARY)

**Plan metadata:** recorded below (this SUMMARY.md + STATE.md + ROADMAP.md), committed separately per the sequential-executor instructions.

## Files Created/Modified

- `convex/telemetryDispositions.ts` — new. `GROUP_B_DISPOSITIONS` const + `Disposition`/`DispositionEntry` types, 142 lines, zero imports.
- `convex/telemetryDispositions.test.ts` — new. 195 lines, 16 tests across three `describe` blocks matching the three layers.
- `convex/_generated/api.d.ts` — regenerated automatically by a live `convex dev` codegen watcher (adds the `telemetryDispositions` module to the generated API surface; the module exports no `query`/`mutation`/`action`, so this is purely a type-listing addition, not a new callable endpoint). See "Shared-Checkout Note" below for why this file's 2-line diff is not in either of this plan's own commits.

## Task 3 Evidence — Mutation Proof (3× RED then GREEN, verbatim)

**Setup:** backed up `convex/telemetryDispositions.ts` and `convex/runtimeIngest.ts` to the scratchpad (both already-committed states) before any mutation.

### Mutation A — deletion (targets D-10/T-112-20)

**Mutation:** deleted the entire `governor_decision` entry from `GROUP_B_DISPOSITIONS`.

**RED run:**

```
 ❯ convex/telemetryDispositions.test.ts (16 tests | 2 failed) 9ms
     × the recorded keys are exactly the seven canonical Group B kinds - no missing kind, no extra kind
     × governor_decision: routed to governorDecisions

 FAIL  ... > the recorded keys are exactly the seven canonical Group B kinds - no missing kind, no extra kind
AssertionError: expected [ 'control_verb_focus', …(5) ] to deeply equal [ 'control_verb_focus', …(6) ]
- Expected
+ Received
  [
    "control_verb_focus",
    "control_verb_swap",
-   "governor_decision",
    "message_routed",
    "prompt_assembly",
    "structured_output_exhausted",
    "vision.capture",
  ]

 FAIL  ... > governor_decision: routed to governorDecisions
AssertionError: expected undefined to be defined
 ❯ convex/telemetryDispositions.test.ts:103:52

 Test Files  1 failed (1)
      Tests  2 failed | 14 passed (16)
```

Failed exactly the set-equality assertion and the per-kind `governor_decision` assertion — the plan's required signal (Mutation A must be caught by the set-equality/per-kind assertions, not a type error).

**Restore:** `cp` the scratchpad backup back over the file; `diff` against the backup returned no output (exit 0).

**GREEN run:**

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

### Mutation B — the D-03 scope caveat (targets D-11/T-112-21)

**Mutation:** rewrote `prompt_assembly`'s reason from `"Emitter exists in astridr, no row in the 14-day window as of 2026-08-12. Fails D-01's bar..."` to `"MUTATION-PROOF: never emitted. Fails D-01's bar..."`.

**RED run:**

```
 ❯ convex/telemetryDispositions.test.ts (16 tests | 2 failed) 10ms

 FAIL  ... > D-03's scope caveat is enforced, not trusted: no reason string claims a silent kind lacks an emitter, was not emitted, or does not fire
 ❯ convex/telemetryDispositions.test.ts:178:36
    176|     // Mutation B target: rewriting a generic-by-design reason to overstate the
    177|     // evidence fails here.
    178|     expect(dispositionsSource).not.toContain("never emitted");
       |                                    ^

 FAIL  ... > every generic-table-by-design entry's reason cites the 14-day-window scope caveat
AssertionError: prompt_assembly.reason: expected 'MUTATION-PROOF: never emitted. Fails …' to contain 'no row in the 14-day window'
Expected: "no row in the 14-day window"
Received: "MUTATION-PROOF: never emitted. Fails D-01's bar, so a dedicated table would be built purely for switch-coverage symmetry, which REQUIREMENTS.md:57 forbids."

 Test Files  1 failed (1)
      Tests  2 failed | 14 passed (16)
```

Failed exactly the Layer 3 negative source-text assertion (`.not.toContain("never emitted")`) — the plan's required signal — plus a corroborating failure on the caveat-citation check.

**Restore:** `cp` the scratchpad backup back over the file; `diff` against the backup returned no output.

**GREEN run:**

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

### Mutation C — the record/reality cross-check (targets D-10/T-112-22)

**Mutation:** changed `message_routed`'s `disposition` from `"routed"` to `"generic-table-by-design"`, leaving its live `case "message_routed":` in `convex/runtimeIngest.ts` completely untouched.

**RED run:**

```
 ❯ convex/telemetryDispositions.test.ts (16 tests | 3 failed) 10ms
     × message_routed: routed to messageRoutes
     × every generic-table-by-design kind has NO case in runtimeIngest.ts - catches someone routing a kind without updating the record
     × every generic-table-by-design entry's reason cites the 14-day-window scope caveat

 FAIL  ... > message_routed: routed to messageRoutes
AssertionError: expected 'generic-table-by-design' to be 'routed'

 FAIL  ... > every generic-table-by-design kind has NO case in runtimeIngest.ts - catches someone routing a kind without updating the record
AssertionError: message_routed is recorded generic-table-by-design but has a live case in runtimeIngest.ts: expected true to be false
 ❯ convex/telemetryDispositions.test.ts:164:9

 FAIL  ... > every generic-table-by-design entry's reason cites the 14-day-window scope caveat
AssertionError: message_routed.reason: expected 'Clears D-01\'s bar and D-05\'s volume…' to contain 'no row in the 14-day window'

 Test Files  1 failed (1)
      Tests  3 failed | 13 passed (16)
```

Failed the generic-kinds-have-no-case cross-check — the plan's required signal — plus two corroborating failures.

**Restore:** `cp` the scratchpad backup back over `telemetryDispositions.ts`; `diff` against the backup returned no output. `runtimeIngest.ts` was never actually edited during Mutation C (only `telemetryDispositions.ts`'s disposition field was changed), confirmed by `diff` against its own pre-mutation scratchpad backup returning no output throughout all three mutations.

**GREEN run:**

```
 Test Files  1 passed (1)
      Tests  16 passed (16)
```

### Post-mutation-testing verification (all required checks)

- `git diff convex/telemetryDispositions.ts` — empty (byte-identical to the Task 1/2 committed state).
- `git diff convex/runtimeIngest.ts` — empty (never touched by any of the three mutations).
- `git status --short` — clean, confirming no residue from any mutation was left in the working tree.
- `npx tsc --noEmit` — exit 0.
- `npm test` (full suite) — **4112 passed | 193 todo | 0 failed** (309 test files passed, 17 skipped). Baseline before this plan: 4096 passed / 193 todo. Delta: +16, exactly this plan's new test count — no regression anywhere else in the repo.

## Decisions Made

- Wrote the D-03 caveat explanation in `telemetryDispositions.ts`'s own docstring using paraphrases (`"was not emitted"`, `"does not fire"`, `"lacks any emitter"`) instead of the exact banned phrases (`"never emitted"`, `"never fires"`, `"no emitter"`). Caught during Task 1 verification: the docstring initially quoted the banned phrases verbatim to explain the rule, which would have made the file's own explanation of the rule trip the Layer 3 negative-source-text assertion the plan requires. Fixed before the first commit — not a deviation from the plan's intent, a necessary precision to satisfy it.
- Extracted `dispatchedCases` from `runtimeIngest.ts` with one whole-file regex (`/case "([a-zA-Z0-9_.]+)":/g`) rather than isolating the dispatch switch's body first. Verified via `grep -n "switch ("` that the file contains exactly one `switch` statement before relying on this — a whole-file scan cannot accidentally pick up a case label from an unrelated switch because none exists in this file.
- Implemented `GROUP_B_DISPOSITIONS`/`telemetryDispositions.test.ts` exactly per the plan's `<decided_shapes>` (file layout, seven exact reason strings, the three-layer test structure) — no re-litigation of Claude's-Discretion items already resolved at plan time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — self-caught during verification, before first commit] Docstring initially quoted the exact banned phrases it was explaining, which would have made the guard's own negative-source-text assertion trip on the disposition file itself.**
- **Found during:** Task 1, running the manual acceptance-criteria check for "no reason string contains `never emitted`, `never fires` or `no emitter`" against the whole file (not just reason strings) before committing.
- **Issue:** The original docstring paragraph explaining D-03's scope caveat read `... No reason string here may say "never fires", "never emitted", "no emitter" or equivalent ...` — spelling out the exact forbidden phrases to describe the rule. Layer 3's test (written in Task 2, but the acceptance criterion is stated in Task 1) asserts these phrases are absent from the *whole file*, not just from reason fields, so this would have been a self-inflicted permanent RED.
- **Fix:** Rewrote the explanatory sentence to paraphrase without using the literal banned substrings (`"lacks any emitter, was not emitted, or does not fire"`), verified via a direct Node string-search that all three substrings are absent from the file before proceeding.
- **Files affected:** `convex/telemetryDispositions.ts` (caught and fixed before any commit — not present in the committed history at all).
- **Verification:** `node -e` string search confirmed zero occurrences of all three phrases; `npx vitest run` on the finished Task 2 test file confirmed the Layer 3 assertion passes.
- **Committed in:** `5420f694` (Task 1 commit — the fix is baked into the file as committed, not a separate correction commit).

---

**Total deviations:** 1 self-caught fix, before any commit (not a post-hoc correction).
**Impact on plan:** None on scope or shape — the fix is a wording precision required to satisfy the plan's own stated acceptance criteria, not a functional change.

## Shared-Checkout Note (not a deviation — a concurrent-session artifact)

A live `convex dev` codegen watcher (already running in this shared checkout, not started by this session) automatically regenerated `convex/_generated/api.d.ts` to list the new `telemetryDispositions` module shortly after Task 1's commit — a routine +2-line addition (`import type * as telemetryDispositions ...` and its entry in `fullApi`), reflecting only the new file's presence, not any new callable endpoint (the module exports no `query`/`mutation`/`action`).

This session staged that file (`git add convex/_generated/api.d.ts`) intending a small standalone commit, but the concurrent Phase 115 session's own commit (`1391104f`, "docs(115): begin phase execution, repair state.begin-phase counter clobber") landed in the same instant and swept the staged file into their commit instead — confirmed via `git show --stat 1391104f`, which lists both `.planning/STATE.md` (their file) and `convex/_generated/api.d.ts` (this plan's staged file). This is the shared-git-index race this project's standing concurrent-session protocol documents (staging is a shared index; another session's `git commit` sweeps in anything currently staged, regardless of who staged it).

**Not corrected via history rewrite** — this project's destructive-git-operation prohibition (no `git commit --amend`, no rewriting a commit once another session may have built on it) applies. The content is correct and complete (`git diff HEAD -- convex/_generated/api.d.ts` is empty; the file is exactly as it should be); only the commit attribution is off. Documented here and in `STATE.md` per the concurrent-session protocol's "report it and continue" instruction.

## Issues Encountered

None beyond the self-caught wording issue documented above.

## Threat Flags

None. This plan added zero new network endpoints, auth paths, file-access patterns, or schema changes. `GROUP_B_DISPOSITIONS` is a plain data const with no runtime import surface; `telemetryDispositions.test.ts` reads only files already read by other tests in this repo (`runtimeIngest.ts`, `schema.ts`) via the same `readFileSync` pattern `retention.test.ts` already established. All three STRIDE register entries this plan's own `<threat_model>` names (T-112-19..22) are the drift-guard itself, fully covered by the mutation-proof above; T-112-23 (recipe disclosure) is satisfied by design — no credential or URL secret appears in the file, only the read-only `events:listByType`/`--env-file` recipe name.

## Known Stubs

None. `GROUP_B_DISPOSITIONS` is complete for its stated scope — all 7 remaining Group B kinds have a full, justified entry; nothing is a placeholder pending a future plan.

## User Setup Required

None — no external service configuration required. No `npx convex deploy` was run (operator-gated, reserved for plan 112-07 per this project's explicit prohibition and this execution's standing verification-discipline instructions).

## Next Phase Readiness

- TELE-03's disposition record and drift guard are complete and mutation-proven. Plan 112-08 (gap-closure, confirmed live `tool_executed.round` null drop) and plan 112-07 (`autonomous: false`, operator-gated deploy + live proof) are both unblocked to proceed.
- `112-CONTEXT.md`'s decision-coverage requirement for D-01, D-02, D-03, D-05, D-10, D-11, D-12, D-13 is now satisfied in checked-in code, not only in planning prose — a future reader (or a future gap-closure plan) can read the disposition and its justification directly from `convex/telemetryDispositions.ts` rather than re-deriving it from `112-CONTEXT.md`.
- STATE.md and ROADMAP.md updated to reflect Phase 112 is 8 plans, not 7 (112-08 was added mid-execution as a wave-4 gap-closure plan after this plan's own wave started), and that 112-06 is complete (6/8).
- No deploy was run; `npx convex deploy` remains reserved for plan 112-07.

---
*Phase: 112-telemetry-coverage-closure*
*Completed: 2026-08-12*

## Self-Check: PASSED

- `convex/telemetryDispositions.ts` — FOUND, exports `GROUP_B_DISPOSITIONS` with exactly 7 keys (`governor_decision`, `control_verb_swap`, `message_routed`, `prompt_assembly`, `structured_output_exhausted`, `vision.capture`, `control_verb_focus`), zero `import` statements, contains D-01/D-02/D-03/D-05/D-10/D-11/D-12/D-13.
- `convex/telemetryDispositions.test.ts` — FOUND, 16/16 tests passing.
- Commit `5420f694` — FOUND in `git log --oneline -10`.
- Commit `f8d27799` — FOUND in `git log --oneline -10`.
- `git diff convex/telemetryDispositions.ts convex/runtimeIngest.ts` — confirmed empty (both byte-identical to committed state after all three mutations were restored).
- `npx tsc --noEmit` — confirmed exit 0.
- `npm test` — confirmed 4112 passed / 193 todo / 0 failed, no regression from the 4096-passing baseline.
- `.planning/phases/112-telemetry-coverage-closure/112-06-SUMMARY.md` — FOUND (this file).

## Self-Check: PASSED (final)

- `[ -f "convex/telemetryDispositions.ts" ]` → FOUND
- `[ -f "convex/telemetryDispositions.test.ts" ]` → FOUND
- `[ -f ".planning/phases/112-telemetry-coverage-closure/112-06-SUMMARY.md" ]` → FOUND
- `git log --oneline --all | grep 5420f694` → FOUND
- `git log --oneline --all | grep f8d27799` → FOUND
