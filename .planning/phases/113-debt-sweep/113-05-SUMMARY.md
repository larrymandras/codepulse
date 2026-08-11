---
phase: 113-debt-sweep
plan: 05
subsystem: test-instrumentation, tooling
tags: [vitest, testing-library, flake-diagnostics, soak-runner]
dependency-graph:
  requires: []
  provides: [captureBrainPillDom-instrumentation, soak-vitest-runner]
  affects: [113-06]
tech-stack:
  added: []
  patterns:
    - "synchronous query-site DOM capture attached via expect()'s message argument, never a post-hoc global hook"
    - "append-only per-iteration soak log with early-stop-and-capture on first failure"
key-files:
  created:
    - scripts/soak-vitest.mjs
    - .planning/phases/113-debt-sweep/113-FLAKE-INSTRUMENTATION.md
  modified:
    - src/pages/Chat.test.tsx
decisions:
  - "Refreshed the Task-2 restore-point backup AFTER Task 1's instrumentation was committed, not before (see Deviations) — the plan's Task 2 restore logic only makes sense against a backup that already includes the instrumentation"
  - "requirements.mark-complete NOT run for DEBT-06 — it spans this plan and 113-06; 113-06 has not run, so DEBT-06 stays Pending in REQUIREMENTS.md"
metrics:
  duration: "~25 minutes"
  completed: 2026-08-11
---

# Phase 113 Plan 05: Chat.test.tsx flake instrumentation + soak runner Summary

Query-site DOM capture (`captureBrainPillDom()`) attached to the three brain-pill label
assertions in `Chat.test.tsx`, proven non-empty by a deliberate control, plus a dependency-free,
control-proven per-iteration soak runner (`scripts/soak-vitest.mjs`) that plan 113-06 will drive
against the full suite.

## What Was Built

### Task 1 — Query-site DOM capture (D-08 amended, D-11)

Added a module-scope helper `captureBrainPillDom(): string` inside the `describe("Chat —
composer brain pill ...")` block in `src/pages/Chat.test.tsx` (next to the existing
`renderPlainChat()` helper, not inside any `it`). It calls the non-throwing
`screen.queryAllByTestId("chat-brain-pill-label")` — so the capture itself can never turn a real
assertion failure into a different error (`TestingLibraryElementError`) — and returns a
multi-line string with: the match count; each match's index, `textContent`, and `outerHTML`
(truncated at 400 chars, with a marker when truncated); whether
`chat-brain-pill-pending` is present; and `document.body.innerHTML.length` (the field that
distinguishes "genuinely empty DOM at query time" from "captured after cleanup").

Attached the helper's return value as `expect()`'s message argument at all three of the target
`it`'s label assertions (now `Chat.test.tsx:622-623`, `:637-638`, `:650-651` — the file shifted
because the helper's definition sits above them), evaluated into a local const on the line
immediately before each assertion so it runs synchronously, before any `afterEach`.

Nothing else in the target `it` changed:
- `await screen.findByTestId("chat-brain-pill-label")` — untouched, no `waitFor` wrapper, no
  timeout, no added retry, no `act()` wrapper added.
- The matcher stays `.toBe("anthropic-sonnet-5")` on rendered `.textContent`. Final line of the
  first assertion, quoted verbatim:
  ```
  expect(labelBefore, domAtLabelBefore).toBe("anthropic-sonnet-5");
  ```
- `src/test/setup.ts` untouched (`git diff -- src/test/setup.ts` empty, `onTestFailed` count 0).
- The `beforeEach` at the top of the `describe` block untouched.
- `waitFor` count in the file: **23 before the edit, 23 after** (grep-verified, D-11's prohibition
  asserted rather than asserted-about).

Committed `f4756bf1`.

### Task 2 — Deliberate control proving the capture is non-empty (D-08 acceptance bar)

Took a working-tree backup of the (now Task-1-instrumented, committed) file, temporarily changed
only the expected string on the `:623` assertion to a unique control token
(`DELIBERATE_CONTROL_MISMATCH_113_05_9x7q2`), ran just that test, and captured the complete
failure output verbatim into `.planning/phases/113-debt-sweep/113-FLAKE-INSTRUMENTATION.md`.

Result — the instrumentation's message argument rides directly inside the printed
`AssertionError`:
```
AssertionError: chat-brain-pill-label match count: 1
  [0] textContent="anthropic-sonnet-5" outerHTML="<span data-testid=\"chat-brain-pill-label\">anthropic-sonnet-5</span>"
chat-brain-pill-pending present: false
document.body.innerHTML length: 23387: expected 'anthropic-sonnet-5' to be 'DELIBERATE_CONTROL_MISMATCH_113_05_9x…'

Expected: "DELIBERATE_CONTROL_MISMATCH_113_05_9x7q2"
Received: "anthropic-sonnet-5"
```
- Match count 1 (≥1: PASS).
- Non-empty `outerHTML` (PASS).
- `document.body.innerHTML` length 23387 (>0, proves the capture ran before cleanup: PASS).
- `Received:` shows the real rendered label, `"anthropic-sonnet-5"` (assertion mechanism intact:
  PASS).

Restored via `cp` (never `git checkout --`), proved byte-exact with `diff` (exit 0) **before**
deleting the backup, confirmed `git status --porcelain src/pages/Chat.test.tsx.113-05.bak`
returned nothing, and re-ran `npx vitest run src/pages/Chat.test.tsx` green (48/48). Full verbatim
transcript, procedure, and the acceptance-bar checklist are in
`113-FLAKE-INSTRUMENTATION.md`.

Committed `7bcfb1c1`.

### Task 3 — Per-iteration soak runner with control-proven failure path (D-09 harness)

Created `scripts/soak-vitest.mjs` — a dependency-free Node ESM script (`git diff --
package.json package-lock.json` empty). Contract for 113-06 (verified against
`113-06-PLAN.md` Tasks 1-2 before writing the format):

```
node scripts/soak-vitest.mjs --iterations <n> --log <path> [--command "<cmd>"] [--label <text>]
```
- Default `--command` is `npx vitest run` (the full suite). The script refuses at startup if the
  resolved command names `vitest` without the `run` subcommand — a bare `vitest` enters watch
  mode and would hang the soak forever (T-113-22).
- Appends a header line before iteration 1 (ISO timestamp, resolved command, iteration budget,
  label); never truncates an existing log.
- Per iteration: spawns the command, captures stdout+stderr, measures wall clock, and appends
  exactly one line, flushed to disk before the next iteration starts:
  `<iso> label=<label> iteration=<i>/<n> status=PASS|FAIL exit=<code> duration_ms=<ms>`
- On a non-zero exit: writes the full captured stdout+stderr to `<log>.iteration-<i>.txt`, prints
  the path, and stops immediately — the remaining iterations are not run.
- Mirrors each line to the console with the repo's existing `ok()`-style PASS/FAIL prefix
  (mirroring `scripts/verify-skills-page.mjs:26-42`'s idiom).
- Exits 1 if any iteration failed, 0 otherwise; final line
  `iterations_run=<n> passed=<n> failed=<n>` derived from the real per-iteration outcomes
  recorded this run (not a single aggregate boolean).

**Control A (PASS-recording is real)** — 3 iterations against
`npx vitest run src/lib/skills.test.ts`:
```
# 2026-08-11T19:34:17.668Z soak-start label=control-a iterations=3 command="npx vitest run src/lib/skills.test.ts"
2026-08-11T19:34:19.405Z label=control-a iteration=1/3 status=PASS exit=0 duration_ms=1736
2026-08-11T19:34:21.124Z label=control-a iteration=2/3 status=PASS exit=0 duration_ms=1718
2026-08-11T19:34:22.812Z label=control-a iteration=3/3 status=PASS exit=0 duration_ms=1687
```
Exactly 3 lines, `1/3`/`2/3`/`3/3`, all `status=PASS`, script exit 0.

**Append-only proof** — ran the script a *second* time against the same log
(`--iterations 2 --label control-a-again`): line count grew from 4 lines (1 header + 3 iterations)
to 7 lines (2 headers + 5 iterations); the original 4 lines were untouched. This is what proves a
failure at iteration 23 of 30 cannot be overwritten by iteration 30's success.

**Control B (the failure path is real)** — created a throwaway
`src/lib/__soak-control-b-throwaway.test.ts` with a single `expect(1).toBe(2)`, ran 3 iterations
against it:
```
# 2026-08-11T19:34:43.995Z soak-start label=control-b iterations=3 command="npx vitest run src/lib/__soak-control-b-throwaway.test.ts"
2026-08-11T19:34:45.672Z label=control-b iteration=1/3 status=FAIL exit=1 duration_ms=1676
```
- `iteration=1/3 status=FAIL` with `exit=1` (non-zero): PASS.
- No `iteration=2/3` line ever written (grep count 0): the runner stopped: PASS.
- `.../113-soak-control-b.log.iteration-1.txt` exists, 1049 bytes, containing the full
  `AssertionError: expected 1 to be 2` output: PASS.
- Script process exit code 1: PASS.

Deleted the throwaway test file and both control log artifacts afterward;
`git status --porcelain src/lib/` shows no residue.

Committed `4e49cbb7`.

## Mutation Proof

Per this phase's adversarial-gate lesson (a proxy one level upstream of the observable is the
recurring defect shape), the proof required for each new mechanism:

1. **The instrumentation actually discriminates real failures, not just the harness invoking it**
   — Task 2's Control 1 mutation *is* the mutation proof: the guarded line
   (`expect(labelBefore, domAtLabelBefore).toBe("anthropic-sonnet-5")`) was mutated to expect a
   deliberately wrong value; the test FAILED, and the failure output shows the REAL captured DOM
   state (match count 1, real `outerHTML`, real `Received:` value) rather than a static or
   memoized string — proving the capture reflects live DOM state at query time, not a cached
   placeholder. Reverted via `cp` restore, re-confirmed green (48/48).
2. **The soak runner's FAIL path is not dead code** — Control B mutated the *target* (a
   deliberately failing assertion) rather than the runner itself, which is the correct control for
   a harness: it proves the runner's failure-detection, capture-file-write, and early-stop logic
   all fire on a genuine non-zero exit, not merely that the runner always prints "PASS". Confirmed
   by the absence of any `iteration=2/3` line — an early-stop that never fires would have produced
   3 lines instead of 1.
3. **The soak runner's PASS path is not vacuous** — Control A plus the append-only re-run proves
   the log genuinely accumulates distinct, individually-verifiable lines rather than a single
   overwritten summary; this is what makes "iteration 23 of 30" durable in 113-06's real run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan authoring] Task 2's backup-restore point had to be taken AFTER Task
1's edits, not before, for Task 2's own logic to be internally consistent**
- **Found during:** Task 2, before making the temporary control edit.
- **Issue:** Task 1's action text says to take `src/pages/Chat.test.tsx.113-05.bak` "before
  editing" (i.e., before Task 1's own instrumentation edits). Task 2's action text then says to
  confirm that same backup is "byte-identical to the current file" and later to restore FROM it
  after making only a *temporary* one-line control-value edit — but Task 2's `read_first` also
  says the file at that point is "the instrumented `it` from Task 1." Those two statements are
  only both true if the backup reflects the file's state AFTER Task 1's instrumentation (so that
  restoring from it undoes only Task 2's temporary control mutation, not Task 1's real,
  supposed-to-persist deliverable). Taking the backup strictly "before Task 1's editing" as
  literally written would have meant Task 2's restore step deleted the entire captureBrainPillDom
  instrumentation — destroying Task 1's committed work.
- **Fix:** Confirmed the working tree was clean and matched `HEAD` (Task 1's commit `f4756bf1`)
  before Task 2 began, then refreshed `src/pages/Chat.test.tsx.113-05.bak` to the current
  (post-Task-1, committed) file at the *start* of Task 2, before making the temporary control
  edit. This makes both of Task 2's stated checks true simultaneously: the backup is
  byte-identical to the current (instrumented) file at confirmation time, and restoring from it
  after the temporary control mutation correctly returns the file to the committed instrumented
  state rather than wiping Task 1's work.
- **Files modified:** `src/pages/Chat.test.tsx.113-05.bak` (working-tree scratch file, never
  committed — deleted at the end of Task 2 per the plan).
- **Commit:** N/A (the backup file itself was never staged or committed; the restored
  `src/pages/Chat.test.tsx` after this fix is byte-identical to commit `f4756bf1`, verified by
  `git diff --stat` showing no changes).

No other deviations — Tasks 1 and 3 executed as written.

## Requirement Status (honest, not rounded up)

`DEBT-06` spans this plan (113-05, instrumentation + soak harness) and 113-06 (running the soak
and recording the disposition — reproduced-and-fixed, or GUARDED). **113-06 has not run.**
`REQUIREMENTS.md`'s DEBT-06 line is left exactly as-is (`- [ ] **DEBT-06**`, status `Pending`) —
`requirements.mark-complete DEBT-06` was deliberately NOT run here. This plan delivers the
instrumentation and the harness 113-06 needs; it does not itself close the requirement.

## Verification

- `npx vitest run src/pages/Chat.test.tsx` — 48/48 passed, both immediately after Task 1's edit
  and again after Task 2's restore.
- `npx vitest run` (full suite) — **304 files passed | 17 skipped (321)**,
  **4038 tests passed | 193 todo (4231)**, **0 failures**, 35.55s. (Research's same-day baseline
  was 298/3958/37.98s; the higher counts reflect ongoing concurrent-session commits landing in
  this shared checkout during the day — consistent with the drift `113-RESEARCH.md` already notes
  as expected, not a regression. Zero failures is the number that matters here.)
- `npx tsc --noEmit` — exit 0.
- `git diff -- src/test/setup.ts package.json package-lock.json` — empty.
- `grep -c 'queryAllByTestId("chat-brain-pill-label")' src/pages/Chat.test.tsx` — 1.
- `grep -c 'captureBrainPillDom' src/pages/Chat.test.tsx` — 4.
- `grep -c 'waitFor' src/pages/Chat.test.tsx` — 23 (unchanged from pre-edit).
- `grep -c 'vitest run' scripts/soak-vitest.mjs` — 3 (≥1).
- `grep -cE '"npx vitest"|npx vitest(?! run)' scripts/soak-vitest.mjs` — 0.

## Threat Flags

No new threat surface beyond what `113-05-PLAN.md`'s own threat model already registers
(T-113-20 through T-113-23, T-113-SC). T-113-20's mandatory pre-commit review of
`113-FLAKE-INSTRUMENTATION.md`'s captured output was performed: the transcript contains only
jsdom test noise (a mocked `getUserMedia` error, a benign `js-yaml` empty-document warning from an
unrelated hook, the brain-pill's own model-id string `anthropic-sonnet-5`, and local absolute
repo paths already pervasive throughout this repo's planning docs) — no API keys, tokens, or
`VITE_`/`ASTRIDR_`/`CONVEX_`-prefixed values.

## Self-Check

```
FOUND: scripts/soak-vitest.mjs
FOUND: .planning/phases/113-debt-sweep/113-FLAKE-INSTRUMENTATION.md
FOUND: src/pages/Chat.test.tsx (contains captureBrainPillDom, 4 occurrences)
FOUND commit: f4756bf1
FOUND commit: 7bcfb1c1
FOUND commit: 4e49cbb7
```

## Self-Check: PASSED

## STATE.md

Deliberately **not touched** — `.planning/STATE.md` is dirty with a concurrent session's
in-progress work per this execution's sequential-executor instructions. `ROADMAP.md` was updated
via `roadmap.update-plan-progress 113` instead (scoped, diffed before commit).
