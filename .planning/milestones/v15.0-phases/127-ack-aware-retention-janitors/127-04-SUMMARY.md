---
phase: 127-ack-aware-retention-janitors
plan: 04
subsystem: testing
tags: [vitest, convex, retention, janitor, inbox, mutation-testing, mock-fixture]

# Dependency graph
requires:
  - phase: 127-02
    provides: "internal.inbox.autoCloseAndPrune — the two-step ack-aware janitor under test (autoCloseAndPruneHandler, shouldAutoClose, shouldDeleteClosed, and the five INBOX_* constants)"
provides:
  - "convex/inbox.test.ts: makeInboxJanitorMockCtx (mutable, bounds-threading mock ctx for inbox's two-field by_closedAt index)"
  - "Verification A (structural absent-closedAt exclusion) with its discriminating explicitly-0 control and stated limitation"
  - "R-02 regression guard (behavioral + source-level), never-patches-ackedAt"
  - "Unit-scale control (seconds vs milliseconds), with a live ms/sec mutation proof performed and restored"
  - "Verification B (carve-out): held unconditional exclusion, money's silent-closure asymmetry, acked-held"
  - "Verification C (cursor advances on skip, D-08) and Verification D (batch bound/reschedule/ceiling/transition)"
affects: ["127-07 (manual mutation-testing control on the two carve-out predicates)", "127-08 (blocking human deploy)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutable mock ctx.db table (patch/delete actually mutate the fixture array) so a two-phase drive (close now, delete after a simulated grace period) can be tested without a real clock"
    - "runChainToConvergence drives the handler using the ACTUAL scheduled args captured from the mock's ctx.scheduler.runAfter, not the handler's own return value (whose `step` field reports the step that just ran, not necessarily the next one)"

key-files:
  created: []
  modified:
    - convex/inbox.test.ts

key-decisions:
  - "R-02's source-level start marker corrected from the plan's literal text (\"the autoCloseAndPruneHandler declaration\") to the Phase 127 section comment, because the handler declaration sits AFTER runClosingStep's own `{ closedAt: nowSec }` patch call — starting there would make the plan's own required closedAt: control read zero, which is exactly the false-zero failure mode the control exists to catch."
  - "Verification B's 'closed AND deleted, in the SAME run' fixtures are driven via TWO handler drives at two different nowSec values (T and T+GRACE_SEC+1), not one — a row the closing step stamps at T cannot also be past the 14-day grace window at that same instant (RESCHEDULE_MS is 3 seconds); 'same run' is interpreted as same test/fixture, not same literal nowSec."
  - "Task 2's 4-test minimum was split as: held-vs-card pair, money-unacked-vs-normal-card pair, acked-money-vs-still-unacked-money pair, acked-held — each pair proven to discriminate a do-nothing handler by reading the fixture, not by inference."

patterns-established:
  - "Mock ctx.db fixtures for two-field range indexes should thread eq/gte/lt bounds into a real filter over a MUTABLE table, not a frozen array, when a test needs to observe the effect of one handler call on a later one."

requirements-completed: [JANITOR-01]

# Metrics
duration: ~50min
completed: 2026-08-25
---

# Phase 127 Plan 04: Inbox Janitor Test Suite Summary

**24 new vitest tests for `internal.inbox.autoCloseAndPrune` proving Verifications A-D and the R-02 `ackedAt` regression guard, each shaped to the actual strength of the guarantee it covers, plus a live ms/sec mutation proof.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3 (all committed as one commit — see Task Commits below)
- **Files modified:** 1 (`convex/inbox.test.ts`)

## Accomplishments

- Built `makeInboxJanitorMockCtx`, a mutable-table mock ctx adapted from `media.test.ts:513-560`'s `makeJanitorMockCtx`, widened for inbox's two-field `by_closedAt` index and its two-step closing/deleting chain.
- Verification A asserts on the raw query batch (not the outcome), with a discriminating control (a row with `closedAt` explicitly `0` under the same cutoff IS returned) and an explicit in-test comment stating the limitation from `127-VALIDATION.md`.
- R-02 guard passes both behaviorally (every `db.patch` call names only `closedAt`) and at the source level (zero `ackedAt:` in the janitor region, paired with a `closedAt:` control that IS found).
- Unit-scale control passes and was proven, live, to fail under a deliberate ms/sec mutation of the closing step's cutoff arithmetic — then the mutation was reverted (`git diff --stat convex/inbox.ts` clean).
- Verification B: 4 carve-out tests, each with a same-batch pairing that discriminates a do-nothing handler — held (unacked and acked), money's silent-closure asymmetry (unacked untouched vs. human-acked closed+deleted), and the non-money control.
- Verification C: an all-held full batch does zero patches but still strictly advances the cursor, with an explicit assertion that the rescheduled cursor is NOT the unchanged input cursor (the exact D-08 failure mode).
- Verification D: 5 tests — full-batch reschedule, short-batch no-reschedule (delete step), ceiling-already-reached (zero reads), ceiling-reached-this-invocation (still does the work, no further reschedule), and the closing→deleting transition asserting `batchesDone: 1` (carried, not reset) and `cursor: 0` as literal values.

## Task Commits

All three tasks were implemented as cumulative, purely-additive appends to the same single file (`convex/inbox.test.ts`) and verified together via the plan's `-t` selectors before any commit was made, so they landed as **one commit** rather than three separate ones — a deviation from the standard one-commit-per-task protocol, made because there was no natural per-task diff boundary to split retroactively without risking a `git add -p` error on hand-written test code. Each task's `-t` selector was independently run and confirmed passing before the commit (see Verification below).

1. **Tasks 1-3 combined: mock fixture + Verifications A-D + R-02 + unit-scale control** - `bfd1038e` (test)

**Plan metadata:** not yet committed — see Self-Check and orchestrator note below (STATE.md/ROADMAP.md updates are explicitly out of scope for this executor per the task instructions).

## Files Created/Modified
- `convex/inbox.test.ts` - Added `makeInboxJanitorMockCtx`, `runChainToConvergence`, `driveJanitorLifecycle`, and 13 new `describe` blocks (24 new `it`s) covering Verifications A, B, C, D, the R-02 guard, and a unit-scale control. Pre-existing SWEEP-01 blocks (`countHeldUnacked`, `listHeldUnackedHandler`) untouched — 30 tests total in the file.

## Decisions Made

See `key-decisions` in frontmatter. In short: (1) corrected the R-02 source-level start marker to the section comment rather than the function declaration named in the plan text, because the literal marker would have made the plan's own required control read a false zero; (2) drove Verification B's "closed and deleted in the same run" fixtures across two handler-call phases at two different `nowSec` values, since a single instant cannot exercise both the 30-day auto-close age and the 14-day post-close grace window on the same row; (3) organized Verification B into 4 discrete paired tests rather than 3, to hit the plan's explicit "at least 4" acceptance criterion while keeping each pairing legible.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan text] R-02 source-level region start marker corrected**
- **Found during:** Task 1
- **Issue:** `127-04-PLAN.md` names "the `autoCloseAndPruneHandler` declaration" as the start-of-region marker for the source-level `ackedAt:`/`closedAt:` grep-style assertion. But `runClosingStep` — which contains the one live `{ closedAt: nowSec }` patch call in the file — is declared BEFORE `autoCloseAndPruneHandler` (line 465 vs. line 575 in `convex/inbox.ts` as of this plan). Slicing from the handler declaration to EOF would exclude that patch call entirely, making the plan's own required `closedAt:` control read zero — indistinguishable from the broken-pattern failure mode the control exists to catch.
- **Fix:** Anchored the region start at the Phase 127 section's own header comment (`"Phase 127 (JANITOR-01, R-02) — ack-aware auto-close + prune janitor"`, line 331), which covers `runClosingStep` + `runDeletingStep` + `autoCloseAndPruneHandler` + the `internalMutation` wrapper — the entire new region this plan is testing.
- **Files modified:** `convex/inbox.test.ts` (test-file-only; no production code touched)
- **Verification:** `npx vitest run convex/inbox.test.ts -t "never patches ackedAt"` — 2/2 passed; manually confirmed via `grep -n "closedAt:|ackedAt:" convex/inbox.ts` that the one live `closedAt:` patch (line 487) and zero `ackedAt:` occurrences both fall within the corrected region.
- **Committed in:** `bfd1038e`

**2. [Rule 3 - blocking, test-design] Two-phase drive for Verification B's carve-out tests**
- **Found during:** Task 2
- **Issue:** The plan's action text says a `held`/`card` pair "is closed and then gone" and a money row "IS closed and IS deleted... Both in the SAME run." A single `nowSec` cannot make both true for the same row: the closing step always stamps `closedAt = nowSec` (the CURRENT instant), and the deleting step's cutoff is `nowSec - INBOX_CLOSED_GRACE_SEC` (14 days) — a row just closed at `nowSec` can never also satisfy `closedAt < nowSec - 14d` in that same `nowSec`. Driving the chain to convergence once, at one fixed `nowSec`, would close the row but never delete it in the same test.
- **Fix:** Built `driveJanitorLifecycle(mock, nowSec)`, which drives the handler to convergence twice against the SAME mutable fixture: once at `nowSec` (closes eligible rows) and once at `nowSec + INBOX_CLOSED_GRACE_SEC + 1` (simulates the grace period having elapsed by a later real invocation, deleting whatever phase 1 closed). This reads as "the same test/fixture," not "the same literal instant" — the latter is structurally impossible given the shipped 14-day grace constant, regardless of implementation correctness.
- **Files modified:** `convex/inbox.test.ts`
- **Verification:** All 4 carve-out tests pass; each asserts BOTH the closed-and-gone outcome for the eligible row AND the untouched outcome for its paired excluded row, in the same test.
- **Committed in:** `bfd1038e`

---

**Total deviations:** 2 auto-fixed (1 plan-text correction, 1 test-design clarification). Both are Rule 1/Rule 3 style fixes to the PLAN's own draft text, not to production code — `convex/inbox.ts` is byte-identical to the wave-3 base (`git diff --stat convex/inbox.ts` empty after the mutation proof was reverted).
**Impact on plan:** Both deviations were necessary for the plan's own acceptance criteria to be satisfiable as literally worded. No scope creep — `convex/inbox.ts` itself was never modified in the committed state.

## The ms/sec Mutation Proof (Task 1 acceptance criterion)

Performed live, in-place, and reverted before committing:

1. Edited `convex/inbox.ts`'s `runClosingStep` cutoff line from `const cutoff = nowSec - INBOX_AUTOCLOSE_AGE_SEC;` to `const cutoff = nowSec * 1000 - INBOX_AUTOCLOSE_AGE_SEC;` (a plausible ms/sec confusion bug — multiplying the seconds-scale `nowSec` by 1000 while leaving the seconds-scale constant unchanged).
2. Ran `npx vitest run convex/inbox.test.ts -t "unit-scale"`. The "a row created THIS INSTANT is NOT auto-closed" test turned RED with a genuine assertion failure: `AssertionError: expected 1800000000 to be undefined` — the mutation made every row (including one created at `nowSec` itself) appear far older than the cutoff, so the janitor incorrectly auto-closed a fresh row. This is an assertion failure, not a collection/import error, confirming the control actually exercises the unit boundary rather than passing vacuously.
3. Reverted the edit. Confirmed via `git diff --stat convex/inbox.ts` (empty output) that the file is byte-identical to its state before the mutation.
4. Re-ran `npx vitest run convex/inbox.test.ts` (all 24 pass) and `npx tsc --noEmit` (clean) to confirm the restore was complete.

## What Verification A Does NOT Prove (stated per 127-VALIDATION.md)

This repo has no `convex-test` runtime harness. Verification A's assertions run against `makeInboxJanitorMockCtx`, a hand-rolled mock that reimplements Convex's `undefined`-exclusion behavior in JavaScript (`.eq("closedAt", undefined)` matches only rows where the field is genuinely absent; a numeric `.gte()/.lt()` range on `closedAt` matches only rows whose `closedAt` IS a number). A green Verification A demonstrates that **the handler asks the `by_closedAt` index for the right range** — it does **not** demonstrate that Convex's real index actually excludes `undefined` from that range. That property rests on the docs citation at `convex/controlVerbSwaps.ts:105-109` and on two existing production call sites already depending on it (independently corroborated at `media.ts:733-736`), not on this test. This limitation is stated in-file as a comment directly on the Verification A `describe` block, not only in this summary.

## Per-Selector Test Counts (127-VALIDATION.md's per-task command map)

| Selector | Result |
|---|---|
| `npx vitest run convex/inbox.test.ts -t "structural"` | 2 passed \| 22 skipped |
| `npx vitest run convex/inbox.test.ts -t "never patches ackedAt"` | 2 passed \| 22 skipped |
| `npx vitest run convex/inbox.test.ts -t "carve-out"` | 4 passed \| 20 skipped |
| `npx vitest run convex/inbox.test.ts -t "cursor advances on skip"` | 1 passed \| 23 skipped |
| `npx vitest run convex/inbox.test.ts -t "batch"` | 9 passed \| 15 skipped (superset — includes the Verification C test, which also mentions "batch") |
| `npx vitest run convex/inbox.test.ts` (whole file) | 24 passed |
| `grep -n "closePredicate\|injectPredicate\|predicateOverride" convex/inbox.ts` | no hits (no test seam added) |
| `grep -c "shouldAutoClose" convex/inbox.ts` | 5 (non-zero control, confirms the grep itself works) |

## Issues Encountered

**`npm test` full-suite run surfaced one FAILING test file unrelated to this plan:** `src/components/voice/AvatarAura.browser.test.tsx` (`Failed to import test file ... TypeError: Cannot read properties of undefined (reading 'config')`, preceded by `HTMLCanvasElement's getContext()` "not implemented" jsdom warnings). Confirmed via `git log --oneline -1 -- <path>` that this file was introduced in commit `828a5b08` ("test(193): make the D-18.1 modulation guard actually discriminate", Phase 193) — pre-existing and out of scope per the SCOPE BOUNDARY rule. Logged to `.planning/phases/127-ack-aware-retention-janitors/deferred-items.md`, not fixed. `npm test` otherwise reports `5141 passed | 4 skipped | 195 todo`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `convex/inbox.test.ts` now has 30 total tests (6 pre-existing SWEEP-01 + 24 new), all green, `npx tsc --noEmit` clean.
- `convex/inbox.ts` itself is untouched by this plan — byte-identical to the wave-3 base commit.
- Plan 127-07's manual mutation-testing control (deleting the `itemType !== "held"` / `priority === "money"` guard lines and re-running the carve-out suite) can now run against a real, discriminating test suite — every carve-out test asserts BOTH the acted-on row and the excluded row in the same fixture, so a guard-removal control has something to actually flip.
- No blockers for 127-08 (the blocking human deploy) from this plan's work — `convex/schema.ts`'s `by_closedAt` index and `convex/inbox.ts`'s janitor code were both already in place before this plan (127-01/127-02); this plan added tests only.

## Self-Check

- `convex/inbox.test.ts` — FOUND.
- `.planning/phases/127-ack-aware-retention-janitors/127-04-SUMMARY.md` — FOUND.
- `.planning/phases/127-ack-aware-retention-janitors/deferred-items.md` — FOUND.
- Commit `bfd1038e` — FOUND in `git log --oneline --all`.

## Self-Check: PASSED

---
*Phase: 127-ack-aware-retention-janitors*
*Completed: 2026-08-25*
