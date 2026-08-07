---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 02
subsystem: database
tags: [convex, telemetry, retention, control-verb-swap, per-profile]

# Dependency graph
requires:
  - phase: 108-01
    provides: model_routing telemetry now carries profileId/model/mode (refuse-to-emit + emit-on-change)
provides:
  - controlVerbSwaps Convex table (schema + internal-only write + bounded read)
  - RETENTION_DAYS entries for activeEngineSnapshots (D-10) and controlVerbSwaps (D-14), both bounded before either table can grow
affects: [108-03 (control_verb_swap ingest case), 108-06 (GlobalSwapModal swap-history readout)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Telemetry write paths are internalMutation-only, absent from api. namespace (CR-01 rule), guarded by a mutation-checked source-level regression test"
    - "Every read on an append-only table is .take()-bounded via a named exported cap constant, never .collect()"
    - "New tables get a RETENTION_DAYS entry in the same phase they are created, before they can grow"

key-files:
  created:
    - convex/controlVerbSwaps.ts
    - convex/controlVerbSwaps.test.ts
  modified:
    - convex/schema.ts
    - convex/retention.ts

key-decisions:
  - "D-13: every control_verb_swap emit (restore/unresolved/affinity-refused/success) is storable; scope column carries explicit profileId when scoped, absent when global"
  - "D-14: one table holds both swap_model and swap_voice rows, discriminated by verb; D-15 readout will filter to verb==='swap_model'"
  - "D-10/D-14: both activeEngineSnapshots and controlVerbSwaps bounded at 30 days in RETENTION_DAYS before either table starts growing"

patterns-established:
  - "SWAP_HISTORY_CAP named constant shared between the query's .take() call and (in 108-06) the UI's truncation caption, so they cannot drift apart"

requirements-completed: []
# TELE-02 remains Pending (see .planning/REQUIREMENTS.md:55,96) — this plan
# delivers only the "routed to a domain table" half (write path + bounded
# read query). The "and surfaced as per-profile swap history" half is
# plan 108-06 (GlobalSwapModal). Corrected 2026-08-07 (adversarial-gate gap
# closure); the original `[TELE-02]` here contradicted this SUMMARY's own
# prose and commit fba91493's message, both of which already stated TELE-02
# was left Pending.

# Metrics
duration: ~10min
completed: 2026-08-07
---

# Phase 108 Plan 02: CodePulse controlVerbSwaps Receiving Half Summary

**controlVerbSwaps Convex table + internal-only write mutation + bounded per-scope read query, with both new/newly-growing per-profile engine tables added to RETENTION_DAYS at 30 days.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-07T06:35:00-04:00 (approx.)
- **Completed:** 2026-08-07T06:42:45-04:00
- **Tasks:** 3/3 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `controlVerbSwaps` table added to `convex/schema.ts` with `by_scope`/`by_timestamp` indexes, accommodating all six live astridr emit-site payload shapes (restore/unresolved/affinity-refused/success for `swap_model`; restore/success-or-unresolved for `swap_voice`)
- `convex/controlVerbSwaps.ts` domain module: `record` (internalMutation, the only write path, absent from `api.*`) and `listByScope` (bounded `.take(SWAP_HISTORY_CAP=20)` query over the `by_scope` index)
- `activeEngineSnapshots` (D-10) and `controlVerbSwaps` (D-14) both added to `RETENTION_DAYS` at 30 days, riding the existing batch-capped cursor-seeked prune — no new prune code written
- `convex/controlVerbSwaps.test.ts`: CR-01 authorization-boundary guard, bounded-read guard, cap-consistency guard, `isBrainSwap` pure-helper tests — 10 tests, all passing, CR-01 guard mutation-checked (confirmed RED when downgraded)

## Task Commits

Each task was committed atomically:

1. **Task 1: controlVerbSwaps table + retention bounds for both engine-axis tables** - `974d5d05` (feat)
2. **Task 2: controlVerbSwaps domain module — internal-only write, bounded read** - `9a866849` (feat)
3. **Task 3: controlVerbSwaps.test.ts — authorization-boundary and bounded-read guards** - `b5b9de32` (test)

**Plan metadata:** (this commit, see below)

## Files Created/Modified
- `convex/schema.ts` - added `controlVerbSwaps` table (11 fields, `by_scope`/`by_timestamp` indexes)
- `convex/retention.ts` - added `activeEngineSnapshots: 30` and `controlVerbSwaps: 30` to `RETENTION_DAYS`
- `convex/controlVerbSwaps.ts` (new) - `record` internalMutation, `listByScope` bounded query, `isBrainSwap` pure helper, `SWAP_HISTORY_CAP` constant
- `convex/controlVerbSwaps.test.ts` (new) - CR-01 authorization guard, bounded-read guard, cap-consistency guard, `isBrainSwap` table-driven tests

## Decisions Made
None beyond what 108-CONTEXT.md already locked (D-13/D-14 followed verbatim; D-10's retention window and D-14's schema/table-name choices were both already specified in the plan and CONTEXT.md, not left to discretion this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2's own doc-comment collided with its own Task 3 acceptance-criteria grep**
- **Found during:** Task 2 (verifying `grep -c "\.collect()" convex/controlVerbSwaps.ts` returns `0`)
- **Issue:** The `listByScope` doc-comment originally read "never `.collect()` on this append-only table", which is the literal string the acceptance-criteria grep searches for — a raw `grep -c` doesn't distinguish code from prose, so the intentional-absence check would have failed on my own explanatory comment, not on an actual unbounded read.
- **Fix:** Reworded the comment to "never an unbounded collect on this append-only table" — same meaning, no longer matches the literal pattern.
- **Files modified:** `convex/controlVerbSwaps.ts`
- **Verification:** Re-ran `grep -c "\.collect()" convex/controlVerbSwaps.ts` → `0`; `npx tsc --noEmit` still clean.
- **Committed in:** `9a866849` (part of Task 2 commit — caught and fixed before committing)

---

**Total deviations:** 1 auto-fixed (1 bug — a self-referential comment defeating its own acceptance grep)
**Impact on plan:** Cosmetic only; no behavior change. No scope creep.

## Issues Encountered

**Mutation-check side effect (expected, not a defect):** Task 3's required mutation check (downgrade `internalMutation(` → `mutation(`, confirm RED, restore) caused the *entire* `controlVerbSwaps.test.ts` suite to fail to load — `ReferenceError: mutation is not defined` at module-import time — rather than a single assertion failing, because the test file does a real ESM `import { isBrainSwap, SWAP_HISTORY_CAP } from "./controlVerbSwaps"` (not pure `readFileSync` parsing) and Vitest evaluates the module at import time. This is the same behavior `activeEngine.test.ts` would exhibit under the identical mutation (it also does a real import of `deduplicateByProfile`). Confirmed RED (whole-suite failure, encompassing the CR-01 test), then restored via `Write` from a pre-mutation backup and re-verified byte-identical + 10/10 green.

## User Setup Required

None - no external service configuration required. This plan authors schema and functions only; it does not deploy (deployment is deferred to plan 108-07 per CLAUDE.md's self-hosted Convex operational rules — no `npx convex deploy` was run).

## Next Phase Readiness

- Plan 108-03 can now add the `case "control_verb_swap"` to `convex/runtimeIngest.ts`, calling `internal.controlVerbSwaps.record` — the write path exists and is authorization-guarded.
- Plan 108-06 can now add the D-15 swap-history section to `GlobalSwapModal.tsx`, reading `api.controlVerbSwaps.listByScope({ profileId })` — the bounded read path exists, capped at `SWAP_HISTORY_CAP` (20), with `isBrainSwap` available for filtering to brain-only rows.
- No blockers. Full test suite green (278 test files passed / 17 skipped, 3527 tests passed / 193 todo) after this plan's changes — verified via `npm test -- --run`, not a subset.
- `npx tsc --noEmit` clean across the whole project.

## Self-Check: PASSED

- FOUND: `C:\Users\mandr\codepulse\convex\controlVerbSwaps.ts`
- FOUND: `C:\Users\mandr\codepulse\convex\controlVerbSwaps.test.ts`
- FOUND: commit `974d5d05` in `git log --oneline --all`
- FOUND: commit `9a866849` in `git log --oneline --all`
- FOUND: commit `b5b9de32` in `git log --oneline --all`
- FOUND: `controlVerbSwaps` table definition in `convex/schema.ts` (2 occurrences: table decl + doc-comment reference)
- FOUND: `activeEngineSnapshots: 30` and `controlVerbSwaps: 30` in `convex/retention.ts` (non-comment grep, count 1 each)

## Threat Flags

None. This plan's only new surface (`controlVerbSwaps` table + `record`/`listByScope`) is fully covered by the plan's own `<threat_model>` (T-108-03, T-108-05, T-108-12, T-108-13) — no new network endpoints, auth paths, or trust-boundary-crossing surface was introduced beyond what the plan already registered.

## Post-execution gap closure (2026-08-07, same day)

An adversarial verification pass over this already-committed plan found three gaps. Production
behavior of `record`, `listByScope`, and the retention entries is unchanged — no fix in this
section touches them. Code/test commit: `e63ac2de` (`test(108-02): replace tautological
arg-shape tests and flag unconsumed index`).

### Gap 1 — false `requirements-completed: [TELE-02]` in this file's own frontmatter

The frontmatter claimed `TELE-02` complete, contradicting this SUMMARY's own prose ("D-15
readout... not yet surfaced (deferred, not dropped)"), commit `fba91493`'s message, and
`.planning/REQUIREMENTS.md` ground truth (line 55 unchecked, line 96 `Pending`). **Fixed:**
`requirements-completed` corrected to `[]` with an inline note explaining TELE-02 stays Pending
until plan 108-06 lands the readout half. `REQUIREMENTS.md` was not touched — it was already
correct.

### Gap 2 — tautological `record args shape` tests

`convex/controlVerbSwaps.test.ts`'s original `describe("record args shape", ...)` block built a
hand-typed plain-object literal and asserted `toHaveProperty`/`toBeUndefined` against that same
literal. The file didn't even import `record` — the block exercised nothing from the module
under test and would have passed unchanged if `record`'s real arg validators were deleted or
rewritten.

**Fix chosen: (a) — made it real, not deleted.** Convex's `internalMutation()`/`mutation()`
builders attach a real (if TS-untyped) `exportArgs()` method to the returned function object
(`node_modules/convex/dist/esm/server/impl/registration_impl.js`, `internalMutationGeneric`) that
serializes the function's actual `v.*` validator object to JSON — the same object `npx convex
deploy` reads for the deploy manifest. Verified this lives at the installed version (`convex@1.42.1`)
by probing it directly before relying on it: a throwaway script imported `record` and called
`(record as any).exportArgs()`, which returned
`{"type":"object","value":{"verb":{"fieldType":{"type":"string"},"optional":false},...}}` — a
real per-field `{fieldType, optional}` map, not a mock. The three replacement tests now assert
against `JSON.parse(record.exportArgs()).value` instead of a hand-typed literal.

**Mutation-check** (changed `providerAffinity: v.optional(v.string())` → `v.string()` (required)
in `convex/controlVerbSwaps.ts`, restored via backup-copy at
`<scratchpad>/controlVerbSwaps.ts.bak`, confirmed byte-identical via `git diff --stat` returning
empty before commit):

```
FAIL  convex/controlVerbSwaps.test.ts > record args shape (read from the live validator, not a
hand-typed literal) > declares target/resolved/providerAffinity/voiceId/reason/scope/sessionId as
optional
AssertionError: expected false to be true // Object.is equality
 ❯ convex/controlVerbSwaps.test.ts:66:36
```

Restored `controlVerbSwaps.ts` from backup; re-ran → 11/11 passed in the file (up from the
original 12 — 2 tautological tests removed, 3 real ones added, net +1).

*Not applied elsewhere:* `convex/activeEngine.test.ts:21-37` has the identical tautological
pattern (`describe("recordRouting args shape", ...)`), predating this plan (Phase 103). Left
untouched — out of scope for this gap-closure pass (108-02 only); flagging here so it isn't
mistaken for cleared.

### Gap 3 — `controlVerbSwaps.by_timestamp` index is currently unconsumed

Verified: no query in the repo reads `by_timestamp` — `controlVerbSwaps.ts`'s only query
(`listByScope`) uses `by_scope`, and the retention sweep (`convex/retention.ts:136`) uses the
built-in `by_creation_time`. This is a **plan defect, not an execution defect** —
`108-02-PLAN.md` explicitly specifies this index (lines 26, 116, 306), including as an acceptance
criterion, so silently removing it would break the plan's own stated gate. **Not removed.**
Added a comment directly above the index declaration in `convex/schema.ts` disclosing it is
unconsumed today and naming what would consume it (a future cross-profile "recent swaps across
all scopes" read), so the next reader doesn't assume it's load-bearing.

### Recorded, not fixed — inherent verification limits (deferred to 108-07)

Two boundaries the runtime prover hit are inherent to this plan's correct no-deploy scope, not
defects:

- **`record`'s internal-only boundary** is asserted by framework convention (CR-01 source-level
  guard: `record` is declared with `internalMutation(`, never `mutation(`), not proven live —
  this repo has no `convex-test` harness, and `convex/_generated/api.d.ts` has not been
  regenerated to even list `controlVerbSwaps`.
- **`listByScope`'s cap** was proven by static analysis (`.take(SWAP_HISTORY_CAP)` compiles to a
  backend `{limit:n}` operator in the query stream — confirmed via the same `exportArgs`-style
  runtime introspection used for Gap 2, not a client-side slice), but was never exercised with
  more than `SWAP_HISTORY_CAP` real rows.

Both are properly closed by deferred plan 108-07's live proof against the running backend.

### Test counts

- Targeted files: `convex/controlVerbSwaps.test.ts` → **11/11 passed**; `convex/retention.test.ts`
  → **5/5 passed** (both unchanged by this pass — retention.ts/`.test.ts` were not touched, run
  only to confirm no incidental breakage).
- Full suite, run in an **isolated git worktree pinned to commit `e63ac2de`** (per this session's
  concurrent-session-safety instructions — `node_modules` junctioned in, `npx vitest run` from
  the worktree, removed after): **277 passed / 1 failed / 17 skipped test files (295 total)**,
  **3524 passed / 7 failed / 193 todo tests (3724 total)**. The 1 failed file is
  `src/pages/__tests__/Chat.test.tsx` (7 failing assertions, all
  `getByText("Approve")`/`getElementError` in the same test). **Verified pre-existing and
  unrelated**: ran the identical file in a second isolated worktree pinned to the parent commit
  `1b0881e0` (before this pass's changes) — same 7 failures, byte-for-byte identical error
  output. This traces to already-committed concurrent-session work on plan 188.3-06
  (`useAstridrChat.ts`, commits `25d90314`/`e22198eb`, both ancestors of `e63ac2de`), not to
  anything in this gap-closure pass. Per this session's explicit scope boundary, it was reported
  and left untouched, not "fixed."

### Shared-checkout disclosure

This pass ran in the main `codepulse` checkout (not a worktree — `.git` is a directory, branch
`master`) while a concurrent session was actively doing TDD work on plan 188.3-06 with
uncommitted edits to `src/hooks/useAstridrChat.ts`. That file, and everything under
`src/hooks/`, `.planning/sketches/`, and `html-out/`, was never staged, read for editing, or
reverted by this pass. `git status --short` before each commit was checked for exactly the
intended paths; `git show --stat HEAD` after each commit confirmed only the intended files
landed. No `git stash`, `git checkout -- <file>`, `git clean`, or branch switch was used anywhere
in this pass; the one production-code mutation (Gap 2's mutation-check) was applied and reverted
via backup-copy (`cp file <scratchpad>/file.bak` → mutate → test → `cp <scratchpad>/file.bak
file`), confirmed byte-identical via `git diff --stat` returning empty before committing.

### Commits

- `e63ac2de` — `test(108-02): replace tautological arg-shape tests and flag unconsumed index`
  (`convex/controlVerbSwaps.test.ts`, `convex/schema.ts`)
- Docs commit recording this section + the Gap 1 frontmatter fix follows separately.

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Completed: 2026-08-07*
