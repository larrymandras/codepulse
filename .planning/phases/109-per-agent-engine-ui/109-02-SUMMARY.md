---
phase: 109-per-agent-engine-ui
plan: 02
subsystem: database
tags: [convex, telemetry, swap-history, brain-swap]

# Dependency graph
requires:
  - phase: 108-per-profile-engine-telemetry-astridr-backend
    provides: "controlVerbSwaps table, listByScope query, record internalMutation, isBrainSwap/SWAP_HISTORY_CAP in controlVerbSwapsFilters.ts"
provides:
  - "listGlobal — bounded Convex query returning global (absent-scope) swap-history rows"
  - "mergeSwapHistory — dependency-free pure helper combining scoped + global swap rows, capped, with true pre-truncation count"
  - "103-CONTRACT.md sections 3, 8, 9 corrected in place for Phase 109's resolutions"
affects: [109-08-settings-swap-history-host]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex index-on-undefined for absent-field matching: q.eq(field, undefined) matches missing keys; q.eq(field, null) matches zero rows silently"
    - "Pure merge helper on the WR-02 browser-safe side (controlVerbSwapsFilters.ts) — no _generated/server, no convex/values import"
    - "Return { rows, totalCount } from a capped merge so the UI can render a true pre-truncation count alongside a bounded list"

key-files:
  created:
    - convex/controlVerbSwapsFilters.test.ts
  modified:
    - convex/controlVerbSwaps.ts
    - convex/controlVerbSwaps.test.ts
    - convex/controlVerbSwapsFilters.ts
    - .planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md

key-decisions:
  - "listGlobal matches on q.eq(\"scope\", undefined), never null — D-11's decision text literally said 'scope: null', which is wrong and would silently return zero rows forever; corrected per 109-RESEARCH.md D.10 and verified by mutation test"
  - "mergeSwapHistory re-caps the combined scoped+global list at SWAP_HISTORY_CAP and returns the true pre-truncation totalCount, per this repo's bound-every-read-and-state-truncation-on-screen rule"
  - "103-CONTRACT.md's literal grep -c \"_generated\" == 0 acceptance criterion was already false on the untouched pre-existing file (2 hits, explanatory prose) — documented as a plan-draft correction rather than chased; the real WR-02 intent (no import of _generated/server or convex/values) is verified by a comment-stripped source-level test, matching this repo's established raw/stripped sanity-check idiom"

requirements-completed: [TELE-02]

# Metrics
duration: 6min
completed: 2026-08-09
---

# Phase 109 Plan 02: Swap-History Data Layer Summary

**Bounded `listGlobal` Convex query matching absent-scope swap rows on `undefined` (never `null`), plus a dependency-free `mergeSwapHistory` helper that combines it with `listByScope` into a capped, deterministically-ordered list for TELE-02's future Settings-hosted readout.**

## Performance

- **Duration:** 6 min (08:48:36 → 08:51:44, task commits only)
- **Started:** 2026-08-09T08:47:00-04:00 (approx, first Read call)
- **Completed:** 2026-08-09T08:51:44-04:00
- **Tasks:** 3/3 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `listGlobal` — new bounded, argument-free `query` reading the `by_scope` index at `q.eq("scope", undefined)`, capped at `SWAP_HISTORY_CAP`, guarded by a mutation-proven test (temporarily flipped `undefined` → `null`, confirmed RED, reverted, confirmed GREEN again).
- `mergeSwapHistory` — new pure, generic, dependency-free helper in `convex/controlVerbSwapsFilters.ts` combining scoped + global rows, tagging each with an `origin: "scoped" | "global"` discriminant, sorted descending by timestamp with a deterministic `_id` tie-break, capped at `SWAP_HISTORY_CAP` with a true pre-truncation `totalCount`.
- `103-CONTRACT.md` sections 3, 8, 9 corrected in place following Phase 108's D-08 precedent (dated inline correction notes, superseded text kept and labeled, not silently rewritten) — including confirming `default_profile_id` is now live on the `swap.catalogue` ack (verified against astridr-repo's real implementation, not just the plan's claim).

## Task Commits

Each task was committed atomically:

1. **Task 1: listGlobal bounded query matching absent-scope rows** - `cf0e0676` (feat)
2. **Task 2: mergeSwapHistory pure helper on the browser-safe side of WR-02** - `f554b99d` (feat)
3. **Task 3: Correct 103-CONTRACT.md sections 3, 8 and 9 in place** - `b42e038e` (docs)

_No plan-metadata commit yet — pending final `docs(109-02): complete plan` commit after this SUMMARY and STATE.md/ROADMAP.md updates._

## Files Created/Modified

- `convex/controlVerbSwaps.ts` — added `listGlobal` query beneath `listByScope`, with a load-bearing doc-comment explaining why `undefined` (not `null`) is correct.
- `convex/controlVerbSwaps.test.ts` — added `listGlobal` describe block: empty-args validator shape, `listByScope` signature unchanged, `q.eq("scope", undefined)` source guard (and zero `q.eq("scope", null)`), CR-01 regression guard (still exactly one `internalMutation(`), `.take(SWAP_HISTORY_CAP)` / no `.collect()`.
- `convex/controlVerbSwapsFilters.ts` — added `mergeSwapHistory<T>` beside `isBrainSwap`, with a docstring citing the WR-02 constraint, D-11's rationale, and the Phase 105 bound-and-truncate rule.
- `convex/controlVerbSwapsFilters.test.ts` — new file: descending order across interleaved timestamps, origin tagging, 25+25→20-rows/totalCount-50 cap test, deterministic tie-break (both same-array and cross-array orderings), empty/empty case, WR-02 dependency-free source guard (comment-stripped, with a raw/stripped sanity check mirroring `controlVerbSwaps.test.ts`'s CR-01 idiom).
- `.planning/milestones/v13.0-phases/103-brain-swap-control-surface/103-CONTRACT.md` — sections 3, 8, 9 corrected in place; remaining stale "Phase 184.1" references within those three sections corrected to neutral phrasing.

## Decisions Made

- **D-11's literal text is wrong; implemented the corrected version.** The decision text says "reading the same `by_scope` index at `scope: null`" — a literal implementation would return zero rows forever, silently, because `runtimeIngest.ts`'s `normalizeOptional()` strips every incoming `null` to `undefined` before `record` is called, and Convex's `v.optional(...)` rejects an explicit `null` outright. A stored global-swap row's `scope` key is simply absent. Implemented `q.eq("scope", undefined)` instead, per `109-RESEARCH.md` section D.10's own correction, and added an explicit load-bearing comment in the source plus a mutation-proven regression test so a future "fix" back to `null` fails loudly.
- **`mergeSwapHistory` re-caps rather than trusting the inputs' individual caps.** Each of `listByScope`/`listGlobal` is independently capped at `SWAP_HISTORY_CAP` (20), so a naive concatenation could render up to 40 rows. The merge slices to 20 after sorting and separately reports the true pre-truncation `totalCount`, so a future Settings UI (plan 109-08) can show both a bounded list and an honest "(showing 20 of 37)"-style caption.
- **Task 3's `_generated` acceptance criterion was already unattainable on the pre-existing file** (verified via `git show HEAD:convex/controlVerbSwapsFilters.ts | grep -c "_generated"` → 2, before this plan touched the file at all — the file's own docstring legitimately explains the WR-02 constraint in prose). Treated as a plan-draft inaccuracy (see `<plan_text_is_a_draft>`): the real intent — no *value-import* of `_generated/server` or `convex/values` — is verified instead via a comment-stripped source-level test, matching the raw/stripped sanity-check pattern already established in `controlVerbSwaps.test.ts`'s CR-01 block. Confirmed zero `import` statements of any kind exist in `controlVerbSwapsFilters.ts`.
- **Verified `default_profile_id` is genuinely live in astridr-repo before writing the 103-CONTRACT.md §3 correction**, rather than transcribing the plan task's claim as fact: `grep -rn "default_profile_id" astridr/api/ws_commands.py` shows `_handle_swap_catalogue` returning it at line 1258, sourced from `config.profiles[0].id` in `astridr/engine/bootstrap/core.py:1298`, with a labeled test `tests/unit/engine/test_ws_commands.py:2034-2086` ("Phase 109 D-03"). The contract correction cites these real line numbers rather than restating the plan's unverified prose.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in own draft test] Fixed `require()`-based test that would not resolve under vitest ESM**
- **Found during:** Task 1, drafting the `listByScope` signature-unchanged assertion
- **Issue:** Initial draft used `require("./controlVerbSwaps")` inside the ESM test module, which is fragile/non-idiomatic in this codebase's vitest+ESM setup
- **Fix:** Imported `listByScope` directly alongside `record`/`listGlobal` at the top of the test file and referenced it by name
- **Files modified:** convex/controlVerbSwaps.test.ts
- **Verification:** `npx vitest run convex/controlVerbSwaps.test.ts` — 18/18 pass
- **Committed in:** cf0e0676 (Task 1 commit)

**2. [Rule 1 - Bug in own draft test] Fixed a self-defeating source-level guard in the new test file**
- **Found during:** Task 2, first test run
- **Issue:** The WR-02 "no `_generated`/`convex/values` import" guard test initially did a raw (non-comment-stripped) substring match against the whole file, which failed against `mergeSwapHistory`'s own docstring (legitimately explaining the constraint in prose) — a false positive on my own new code
- **Fix:** Added `stripCommentLines()` (copied verbatim from `controlVerbSwaps.test.ts`) and a raw/stripped sanity check proving the strings genuinely appear in prose before asserting they're absent from code
- **Files modified:** convex/controlVerbSwapsFilters.test.ts
- **Verification:** `npx vitest run convex/controlVerbSwapsFilters.test.ts` — 9/9 pass
- **Committed in:** f554b99d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both self-contained within this plan's own new test code, neither touching plan-specified production code)
**Impact on plan:** No scope creep. Both fixes were corrections to my own first-draft test code discovered while running the tests the plan itself specified.

## Issues Encountered

None beyond the two self-fixed test-authoring issues above. All acceptance criteria from the plan verified directly (see below), except one literal grep count in Task 3's acceptance criteria that was already false on the pre-existing file — documented above as a plan-draft correction, not chased.

### Mutation proof (Task 1, run and reported as run, per acceptance criteria)

Temporarily changed `q.eq("scope", undefined)` to `q.eq("scope", null)` in `convex/controlVerbSwaps.ts`, ran `npx vitest run convex/controlVerbSwaps.test.ts`:

```
❯ convex/controlVerbSwaps.test.ts:224:20
    222|   it("matches on q.eq('scope', undefined), never q.eq('scope', null) (…
    223|     const source = stripCommentLines(readFileSync(controlVerbSwapsPath…
    224|     expect(source).toMatch(/q\.eq\(\s*"scope"\s*,\s*undefined\s*\)/);
       |                    ^
Test Files  1 failed (1)
     Tests  1 failed | 17 passed (18)
```

Reverted, re-ran: `Test Files 1 passed (1)`, `Tests 18 passed (18)`.

### Raw `grep -rn "184\.1"` output for 103-CONTRACT.md (Task 3, pasted verbatim per acceptance criteria)

```
4:in place. This document originally attributed the per-profile backend to "Ástríðr Phase 184.1" — corrected: no such phase exists (`grep -rn "184\.1"` across astridr's `.planning/` returns nothing; `.planning/REQUIREMENTS.md`'s "Scoping evidence" table, gathered 2026-08-06, records the check) — and specified a `gateway.model.set` command that was never built and is now formally superseded (D-05). The axis is delivered by **CodePulse Phase 108** on astridr branch `feature/brain-swap`, via the **scoped `swap.set`** command, not a new one. Corrected loudly rather than quietly: a contract documenting behaviour that does not exist is the same defect class TELE-01 exists to fix one repo over. Superseded text is kept, explicitly labelled, rather than deleted — see each section for what changed and why.
210:live emitter today. corrected 2026-08-07: the originally-cited "Phase 184.1" does not exist; CodePulse Phase 108 extended this existing payload (profileId/model/mode, D-11/D-12) — it did not invent a new event.
322:this validation before dispatch, and referenced an "eventual Phase 184.1 implementation" — corrected
414:corrected 2026-08-07: the line originally here named "Phase 184.1's implementer" — no such phase exists (see the amendment note at the top of this document). CodePulse Phase 108 built the per-profile backend from the corrected §1/§2/§4/§6/§7 above, on astridr branch `feature/brain-swap`, without needing any CodePulse source beyond this document.
```

This is a non-zero result, but every hit is inside a dated historical-correction note (top-of-document amendment, and sections 4/7/10 — none of which are 3/8/9) explicitly labeling the prior "Phase 184.1" attribution as a documented past error, not a live claim. Sections 3, 8, and 9 (this task's scope) now contain zero surviving "184.1" references — verified by re-running the same grep and confirming no hits fall within those three sections' line ranges.

## User Setup Required

None - no external service configuration required. No `npx convex deploy` was run (out of scope for this plan per the self-hosted Convex operational rules).

## Next Phase Readiness

- `listGlobal` and `mergeSwapHistory` are built, tested, and ready for plan 109-08 to consume when it hosts the combined swap history on Settings' per-profile engine rows (D-10).
- `103-CONTRACT.md` no longer misattributes the per-profile axis's remaining open items to a nonexistent phase within sections 3, 8, 9.
- No blockers for downstream plans in this phase — this plan was deliberately file-disjoint from every other wave-1/wave-2 plan and touched no `src/` files.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*
