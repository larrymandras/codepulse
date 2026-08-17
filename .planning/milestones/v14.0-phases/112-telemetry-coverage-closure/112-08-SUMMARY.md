---
phase: 112-telemetry-coverage-closure
plan: 08
subsystem: database
tags: [convex, ingest, telemetry, null-normalization, typescript, compiler-guard]

# Dependency graph
requires:
  - phase: 112-telemetry-coverage-closure (plan 04)
    provides: the repo-wide defect-class sweep in deferred-items.md that found this exact site (resolveToolExecutionRow's round/durationMs/traceId) as latent, and the isOptionalString/isOptionalNumber + normalizeOptional guard pair this plan reuses unmodified
provides:
  - "resolveToolExecutionRow (convex/runtimeIngest.ts) normalizes an explicit-null round to undefined via normalizeOptional before it reaches toolExecutions.round (v.optional(v.float64())) — the row is produced instead of silently dropped"
  - "convex/runtimeIngest.test.ts: 3 new tests (100 -> 103) covering round's three live wire shapes (numeric / explicit-null / absent), the explicit-null case mutation-proven RED then GREEN"
  - "noFallthroughCasesInSwitch enabled in both tsconfig.json and convex/tsconfig.json, proven to fire via a scratchpad control file whose flag-off/flag-on runs disagree (0 errors vs TS7029)"
affects: [112-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "normalizeOptional applied to a FIFTH forwarding site (round on tool_executed), same pattern as 108-07 (session_id) and 112-04 (held_reason; sender/session_id) — reused the existing guard pair verbatim, no new helper written"
    - "compiler-flag proof pattern: a scratchpad .ts file with a genuine fallthrough, compiled twice with --ignoreConfig (bypasses tsconfig auto-discovery so filenames-on-cli default options apply), once without and once with the flag under test, asserting the two runs disagree before trusting either"

key-files:
  created: []
  modified:
    - "convex/runtimeIngest.ts"
    - "convex/runtimeIngest.test.ts"
    - "tsconfig.json"
    - "convex/tsconfig.json"
    - ".planning/REQUIREMENTS.md"
    - ".planning/ROADMAP.md"

key-decisions:
  - "round normalized exactly as decided_shapes specified — round: d.round became round: normalizeOptional(d.round), reusing the existing guard pair at runtimeIngest.ts:207-268, no second guard pair written."
  - "durationMs/traceId deliberately left untouched, per decided_shapes: their existing `??` chains already resolve null to undefined because astridr's loop.py:2090-2097 sends only the camelCase key and never the snake_case alias, so `null ?? undefined` evaluates to undefined before the value ever reaches the validator. Verified by inspecting the emitter, not merely asserted — see Task 1 evidence below."
  - "TELE-03 marked Complete in REQUIREMENTS.md (was Pending despite 112-06's SUMMARY already claiming requirements-completed: [TELE-03] — the traceability table and checkbox had never actually been updated after 112-06). Attributed to both 112-06 (disposition record) and 112-08 (closing the one confirmed-live defect in that same disposition's routed set) since both plans' own frontmatter list TELE-03 as a requirement."

requirements-completed: [TELE-03]

# Metrics
duration: ~20min
completed: 2026-08-12
---

# Phase 112 Plan 08: Close the Confirmed-Live `tool_executed.round` Null-Drop + Enable Fallthrough Guard Summary

**Normalized `tool_executed`'s explicit-null `round` field so a tool call made outside a round context stores its `toolExecutions` row instead of silently losing it at Convex argument validation, and enabled `noFallthroughCasesInSwitch` in both tsconfigs after proving the flag actually fires against a discriminating scratchpad control.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 4 source (`convex/runtimeIngest.ts`, `convex/runtimeIngest.test.ts`, `tsconfig.json`, `convex/tsconfig.json`) + 2 planning docs (`REQUIREMENTS.md`, `ROADMAP.md`)

## Accomplishments

- **Task 1 — the fix.** Confirmed the premise live before editing: `round: d.round` was bare at `convex/runtimeIngest.ts:94`, and `toolExecutions.round` is `v.optional(v.float64())` (`convex/schema.ts:578`) — quoted verbatim below. Changed the line to `round: normalizeOptional(d.round)`, reusing the existing `isOptionalNumber`/`normalizeOptional` guard pair (`runtimeIngest.ts:207-268`) verbatim, with an in-code comment citing the emitter evidence (`astridr/agent/loop.py:2090-2097` sends `round` unconditionally; `astridr/engine/telemetry.py:683` declares `get_round_context() -> int | None`) and the contrast with `llm_call`'s guarded emitters. `durationMs`/`traceId` were left byte-identical — `git diff` shows only the `round` line and comments changed.
- **Task 2 — the tests.** Added a new `describe` block, `112-08 — tool_executed resolver: round three-wire-shape coverage (D-14)`, mirroring 112-04's `held_reason` block's structure and the `:null` serialization assertion. Three tests: numeric round resolves to that number (incl. a `0` control, since `0` is falsy but must not be treated as absent), explicit-null round resolves to a non-null result whose `round` is `undefined` with no `:null` in the serialized form, and an absent key resolves identically. Mutation-proven: reverted `normalizeOptional(d.round)` to a bare `d.round`, ran the suite, observed exactly the explicit-null test fail (99/100 passed), restored from a scratchpad backup, confirmed the restore byte-identical to the committed HEAD via an empty `git diff --stat`, re-ran and observed 100/100 green. Both runs quoted verbatim below.
- **Task 3 — the compiler guard.** Wrote a scratchpad `.ts` file with a switch whose first case has a statement and no `break` (a genuine fallthrough). Compiled it twice with `./node_modules/.bin/tsc --ignoreConfig --noEmit` (the `--ignoreConfig` flag bypasses tsconfig auto-discovery, so passing a bare filename compiles with default options rather than silently picking up this repo's tsconfig): flag-off exited 0 with no output; flag-on produced `error TS7029: Fallthrough case in switch.` and exited 2. The two runs disagreeing is what makes the control meaningful — a probe that produced the same result either way would have proven nothing. Added `"noFallthroughCasesInSwitch": true` to `compilerOptions` in both `tsconfig.json` and `convex/tsconfig.json` (single-line additions, confirmed via `git diff`). Both `./node_modules/.bin/tsc --noEmit -p tsconfig.json` and `-p convex/tsconfig.json` exited 0 — 0 TS7029 project-wide, matching the plan's measured pre-change baseline.

## Task Commits

Each task was committed atomically, named paths only:

1. **Task 1: Normalize the explicit-null round on tool_executed** — `13afcadf` (feat)
2. **Task 2: Three-wire-shape coverage for round, mutation-proven** — `05312b01` (test)
3. **Task 3: Enable noFallthroughCasesInSwitch, with a control proving the flag fires** — `3846a2d3` (feat)

**Plan metadata:** this SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md, committed separately per the sequential-executor instructions.

Each commit's `git show --stat HEAD` was read immediately after committing and confirmed to touch exactly the intended file(s) — no foreign files were swept in from the concurrent Phase 115 session (whose own commits, e.g. `c4cd72a7` (115-02), landed interleaved between mine in `git log`, and were left untouched).

## Files Created/Modified

- `convex/runtimeIngest.ts` — `resolveToolExecutionRow`'s `round: d.round` became `round: normalizeOptional(d.round)`, with a comment citing the emitter evidence and the `durationMs`/`traceId` exclusion reasoning. `git diff --numstat`: 17 insertions, 1 deletion.
- `convex/runtimeIngest.test.ts` — new `describe("112-08 — tool_executed resolver: round three-wire-shape coverage (D-14)")` block, 3 tests. `git diff --numstat`: 35 insertions, 0 deletions.
- `tsconfig.json` — added `"noFallthroughCasesInSwitch": true`. 1 insertion.
- `convex/tsconfig.json` — added `"noFallthroughCasesInSwitch": true`. 1 insertion.
- `.planning/REQUIREMENTS.md` — TELE-03 checkbox and traceability row moved to Complete.
- `.planning/ROADMAP.md` — 112-08's roadmap line checked off with commit hashes.

## Task 1 Evidence — Premise Confirmation (verbatim)

`convex/runtimeIngest.ts:87-98` before this plan's edit:

```ts
export function resolveToolExecutionRow(d: any, timestamp: number) {
  return {
    sessionId: d.sessionId ?? d.session_id ?? "unknown",
    toolName: d.toolName ?? d.tool_name ?? "unknown",
    success: d.success ?? true,
    durationMs: d.durationMs ?? d.duration_ms,
    traceId: d.traceId ?? d.trace_id,
    round: d.round,
    provider: ASTRIDR_TOOL_PROVIDER,
    timestamp,
  };
}
```

`convex/schema.ts:562-579` (`toolExecutions` table):

```ts
  toolExecutions: defineTable({
    sessionId: v.string(),
    toolName: v.string(),
    durationMs: v.optional(v.float64()),
    success: v.boolean(),
    decision: v.optional(v.string()),
    decisionSource: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    timestamp: v.float64(),
    archived: v.optional(v.boolean()),
    provider: v.optional(v.string()),
    traceId: v.optional(v.string()),
    round: v.optional(v.float64()),
  })
```

Premise confirmed: `round: d.round` was bare, and `round: v.optional(v.float64())` rejects an explicit JSON `null`. No STOP was required.

## Task 2 Evidence — Mutation Proof (RED then GREEN, verbatim)

**Setup:** backed up `convex/runtimeIngest.ts` to the scratchpad before mutating (Task 1, already-committed state).

**Mutation:** changed `round: normalizeOptional(d.round),` to `round: d.round as number | undefined, // MUTATION-PROOF: normalizeOptional( removed on purpose`.

**RED run** — `npx vitest run convex/runtimeIngest.test.ts` against the mutated file:

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 ❯ convex/runtimeIngest.test.ts (100 tests | 1 failed) 33ms
     × round: null (explicit JSON null, the confirmed live shape for a tool call outside a round context) resolves to a non-null result whose round is undefined, with no :null in the serialized form 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  convex/runtimeIngest.test.ts > 112-08 — tool_executed resolver: round three-wire-shape coverage (D-14) > round: null (explicit JSON null, the confirmed live shape for a tool call outside a round context) resolves to a non-null result whose round is undefined, with no :null in the serialized form
AssertionError: expected null to be undefined

- Expected:
undefined

+ Received:
null

 ❯ convex/runtimeIngest.test.ts:509:26
    507|     const result = resolveToolExecutionRow({ toolName: "web_search", r…
    508|     expect(result).not.toBeNull();
    509|     expect(result.round).toBeUndefined();

 Test Files  1 failed (1)
      Tests  1 failed | 99 passed (100)
```

Exactly the explicit-null test failed; every other assertion on the same resolver (numeric round, absent round, and all pre-existing `tool_executed` tests) stayed green.

**Restore:** copied the backed-up file back over `convex/runtimeIngest.ts`; `diff` against the backup returned no output (exit 0), and `git diff --stat -- convex/runtimeIngest.ts` returned empty — the restored file is byte-identical to the committed Task 1 state, not merely similar.

**GREEN run** — `npx vitest run convex/runtimeIngest.test.ts` after restore:

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 Test Files  1 passed (1)
      Tests  100 passed (100)
```

100/100 passed. A green that was never observed going red is not a guard — this one was.

## Task 3 Evidence — Compiler Flag Control (verbatim)

Scratchpad control file (`fallthrough-control.ts`, kept outside the repo per this project's scratchpad convention):

```ts
function pick(x: number): string {
  let out = "";
  switch (x) {
    case 1:
      out = "one";
    case 2:
      out = "two";
      break;
    default:
      out = "other";
  }
  return out;
}
pick(1);
```

**Flag-off run** — `./node_modules/.bin/tsc --ignoreConfig --noEmit <scratch-file>`:

```
(no output)
exit code: 0
```

**Flag-on run** — `./node_modules/.bin/tsc --ignoreConfig --noEmit --noFallthroughCasesInSwitch <scratch-file>`:

```
.../fallthrough-control.ts(6,5): error TS7029: Fallthrough case in switch.
exit code: 2
```

The two runs disagree — the probe carries information. `--ignoreConfig` (a real `tsc` flag, confirmed via `tsc --help`) was used specifically so this scratchpad file, which lives outside the repo tree, was compiled with default options rather than silently discovering and applying this repo's own tsconfig.

## Verification (plan's `<verification>` block, all 5 checks)

1. `resolveToolExecutionRow` normalizes an explicit-null `round`; `durationMs`/`traceId` byte-identical — confirmed by `git diff` showing only the `round` line and new comments changed.
2. Three wire shapes tested (numeric / explicit-null / absent); explicit-null test mutation-proven RED then GREEN, both quoted above.
3. Both `tsconfig.json` and `convex/tsconfig.json` carry `noFallthroughCasesInSwitch`, proven to fire via the discriminating control above.
4. `npx tsc --noEmit` exits 0 (confirmed after every task); full `npx vitest run convex/` — 80 files passed, 2 skipped, 1509 passed, 98 todo, 0 failed (baseline was 1506 = 1509 minus this plan's 3 new tests; no regression).
5. No deploy was run — `npx convex deploy` was never invoked; 112-07 (the next and final phase-112 plan, `autonomous: false`) owns it.

Additional sanity check (not required by the plan, run as insurance): full `npm test` — 310 files passed, 17 skipped, 4121 passed, 193 todo, 0 failed.

## Decisions Made

See `key-decisions` in the frontmatter above. All three tasks were implemented exactly per the plan's `<decided_shapes>` — no re-litigation. The one decision made during execution rather than pre-decided by the plan was how to record TELE-03's completion in `REQUIREMENTS.md`, since 112-06's own SUMMARY had already claimed `requirements-completed: [TELE-03]` while the traceability table still read "Pending" — resolved by attributing the requirement to both 112-06 and 112-08 in the traceability row, since both plans' frontmatter independently list `requirements: [TELE-03]`.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; the premise checks in Task 1 and the control-file check in Task 3 both passed on the first attempt with the plan's stated expected values (bare `round: d.round`, `v.optional(v.float64())`, 0 pre-existing TS7029 errors).

## Issues Encountered

None.

## Threat Flags

None. This plan's surface is a one-field normalization on an existing forwarding path (no new field, no new mutation target, no new trust boundary) and a stricter compiler setting (strictly narrows accepted code, cannot widen any existing surface).

## Known Stubs

None.

## User Setup Required

None — no external service configuration required. No `npx convex deploy` was run (operator-gated, reserved for plan 112-07 per this project's explicit prohibition and this execution's standing verification-discipline instructions). This plan's changes are committed but NOT deployed — that is the correct end state; 112-07 is the only remaining step that produces live evidence this fix works against the running self-hosted backend.

## Next Phase Readiness

- The one CONFIRMED live instance of D-14's defect class found during 112-04's adversarial verification is closed at the code level. The 5 other latent sites 112-04's sweep found (`kg_benchmark`'s `workflowRunUrl`, `task_quality`'s `idempotencyKey`, `parseToolPolicyEvent`'s several fields, and `resolveCommandExecutionToolRow`'s `durationMs`/`errorMessage`) remain in `deferred-items.md`, unchanged and out of this plan's scope — none has a confirmed live-null incident behind it.
- `noFallthroughCasesInSwitch` is now enforced project-wide at zero cost (0 TS7029 errors), closing the class 112-04's own mutation test proved invisible to both the test suite and the compiler.
- TELE-03 is now marked Complete in `REQUIREMENTS.md`. Phase 112 is now 7/8 plans complete; only 112-07 (`autonomous: false`, operator-gated deploy + live proof) remains.
- 112-07 should verify, as part of its live proof, that a `tool_executed` event with a `null` round now produces a stored `toolExecutions` row rather than a silent drop — this plan closes the code path but has not observed it against the live self-hosted backend, since no deploy was run.

---
*Phase: 112-telemetry-coverage-closure*
*Completed: 2026-08-12*

## Self-Check: PASSED

- `convex/runtimeIngest.ts` — FOUND, contains `round: normalizeOptional(d.round)`.
- `convex/runtimeIngest.test.ts` — FOUND, 100/100 tests passing (97 baseline + 3 new).
- `tsconfig.json` — FOUND, contains `"noFallthroughCasesInSwitch": true`.
- `convex/tsconfig.json` — FOUND, contains `"noFallthroughCasesInSwitch": true`.
- Commit `13afcadf` — FOUND in `git log --oneline -10`.
- Commit `05312b01` — FOUND in `git log --oneline -10`.
- Commit `3846a2d3` — FOUND in `git log --oneline -10`.
- `.planning/phases/112-telemetry-coverage-closure/112-08-SUMMARY.md` — FOUND (this file).
