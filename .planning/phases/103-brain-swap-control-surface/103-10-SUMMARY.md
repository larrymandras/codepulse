---
phase: 103-brain-swap-control-surface
plan: 10
subsystem: api
tags: [convex, authorization, internalMutation, security, gap-closure]

# Dependency graph
requires:
  - phase: 103-brain-swap-control-surface (Plan 02)
    provides: convex/activeEngine.ts (activeEngineSnapshots table, recordRouting mutation, runtimeIngest model_routing case)
provides:
  - recordRouting declared as internalMutation, removed from the client-callable api. namespace
  - runtimeIngest.ts model_routing case rewired onto internal.activeEngine.recordRouting
  - source-level CR-01 regression guard test proven to fail on revert
affects: [103-11, 103-12, 103-13, astridr-Phase-184.1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "internalMutation for server-only write paths, matching convex/gatewayQuota.ts's insertSnapshot precedent"
    - "source-level (readFileSync + comment-stripped regex) regression guards for authorization boundaries that can't be caught by a runtime unit test in the vitest/jsdom harness"

key-files:
  created: []
  modified:
    - convex/activeEngine.ts
    - convex/runtimeIngest.ts
    - convex/activeEngine.test.ts

key-decisions:
  - "recordRouting converted from public mutation to internalMutation with zero handler/args changes — this is purely an authorization change, not a behavior change, matching CR-01's fix exactly."
  - "Sibling-exposure audit performed and recorded (see below): no other public mutation( declaration exists in either modified file; runtimeIngest.ts's runtimeIngest httpAction is the reviewed-and-accepted public ingest endpoint, out of scope by design."
  - "Guard test strips comment lines before matching, so the file's own docstrings (which legitimately say 'mutation' and 'recordRouting' in prose) cannot produce a false pass; a companion test asserts the raw file DOES contain the word 'mutation' so the stripping assertion isn't vacuous."
  - "Mutation check performed for real: reverted internalMutation -> mutation in convex/activeEngine.ts, re-ran the test file, confirmed 1 failed / 7 passed, then restored from a scratchpad backup and re-verified 8/8 passing plus tsc clean."
  - "Function-only deploy (npx convex deploy --yes) landed the change on the self-hosted instance at http://127.0.0.1:3210; 'No indexes are deleted by this push' confirmed additive-only; live activeEngine:latestByProfile call confirmed the function resolves and the table remains empty (no stray data from prior incidents)."

patterns-established:
  - "For a Convex authorization defect (public builder that should be internal), the source-level readFileSync guard test is the correct regression-proof pattern when no live-Convex test harness exists in this repo — verified by an explicit revert-and-confirm-fail mutation check, not just a green run."

requirements-completed: [BSC-01, BSC-04]

# Metrics
duration: 8min
completed: 2026-07-29
---

# Phase 103 Plan 10: Close CR-01 — recordRouting Authorization Boundary Summary

**`recordRouting` converted from a public Convex `mutation` to an `internalMutation`, closing the devtools-forgeable write path into `BrainHeaderBadge`'s confirmed-live trust signal, deployed live to the self-hosted instance, and regression-guarded by a source-level test proven to fail on revert.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-29T09:11:28-04:00 (immediately following Plan 09's completion commit)
- **Completed:** 2026-07-29T09:17:20-04:00
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments

- Closed CR-01 (code-review finding) and the underlying BSC-01/BSC-04 gap: `api.activeEngine.recordRouting` no longer exists — only `internal.activeEngine.recordRouting` does, matching the `convex/gatewayQuota.ts` `insertSnapshot` precedent the file's own docstring already cited but had deviated from.
- Deployed the function-only change to the live self-hosted Convex instance (`http://127.0.0.1:3210`), confirmed additive-only (no index deletions), and confirmed `latestByProfile` still resolves live and returns `[]` (clean state, no stray rows).
- Added a source-level regression guard (`convex/activeEngine.test.ts`) that reads both modified files from disk, strips comment lines, and asserts the authorization boundary — proven for real to fail when the fix is reverted (not just asserted to work).
- Performed the sibling-exposure audit required by the plan: enumerated every non-comment `mutation(`/`internalMutation(`/`httpAction(` export in both phase-surface files; found none exposed beyond the intended `latestByProfile` (public, read-only, accepted per threat register) and `runtimeIngest`'s `httpAction` (the reviewed-and-accepted public HTTP ingest endpoint).

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert recordRouting to internalMutation and rewire the ingest call (103-10-T1)** - `3555db7c` (fix)
2. **Task 2: Lock the authorization boundary with a test (103-10-T2)** - `416ed2b0` (test)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `convex/activeEngine.ts` — `recordRouting` changed from `mutation` to `internalMutation`; import updated; D-14 docstring extended to state the rule is now builder-enforced, citing `gatewayQuota.ts` as the matched precedent. `latestByProfile` left untouched as a public `query`.
- `convex/runtimeIngest.ts` — `case "model_routing"` now calls `ctx.runMutation(internal.activeEngine.recordRouting, {...})` instead of `api.activeEngine.recordRouting`. The dual snake/camelCase coalescing (`d.profileId ?? d.profile_id`, etc.) is byte-unchanged. `internal` was already imported at the top of the file — no import changes needed here.
- `convex/activeEngine.test.ts` — added a `CR-01 — recordRouting authorization boundary` describe block: (1) asserts `activeEngine.ts` declares `recordRouting = internalMutation(` and contains no `= mutation(` after comment-stripping; (2) asserts the raw (unstripped) file still contains the word "mutation" in prose, so the stripping assertion is non-vacuous; (3) asserts `runtimeIngest.ts` contains `internal.activeEngine.recordRouting` and not `api.activeEngine.recordRouting`. Existing `deduplicateByProfile` tests untouched.

## Sibling-Exposure Audit (Task 1 requirement)

Every non-comment `mutation(`/`internalMutation(`/`httpAction(` declaration in the two files this plan modified:

| File | Export | Builder | Disposition |
|------|--------|---------|--------------|
| `convex/activeEngine.ts` | `latestByProfile` | `query` (public) | Accepted — read-only, bounded `.take(200)`, no PII, required by the browser (T-103-38 in the plan's threat register). |
| `convex/activeEngine.ts` | `recordRouting` | `internalMutation` (this plan's fix) | Fixed — no longer client-callable. |
| `convex/runtimeIngest.ts` | `runtimeIngest` | `httpAction` (public) | Reviewed and accepted — this is the astridr `/runtime-ingest` HTTP ingest endpoint, the intended public entry point per `103-CONTRACT.md` §4. Named explicitly here per the plan's requirement, not left unmentioned. |

No other `mutation(` declaration exists in either file (`grep -v '^\s*[*/]' convex/activeEngine.ts | grep -c "= mutation("` → 0; `grep -n "= mutation(" convex/runtimeIngest.ts` → 0 matches).

## Verification Evidence

- `grep -v '^\s*[*/]' convex/activeEngine.ts | grep -c "= mutation("` → `0`
- `grep -v '^\s*[*/]' convex/activeEngine.ts | grep -c "internalMutation"` → `2` (import + declaration)
- `grep -c "internal.activeEngine.recordRouting" convex/runtimeIngest.ts` → `1`
- `grep -c "api.activeEngine.recordRouting" convex/runtimeIngest.ts` → `0`
- `grep -rc "BRAINS_STUB" convex/` → all `0` (anti-stub-masking proof: this defect and its fix are entirely server-side, stub-independent)
- `npx tsc --noEmit` → exit 0, no output (proves `internal.activeEngine.recordRouting` genuinely resolves in the regenerated Convex API types)
- `npx vitest run convex/activeEngine.test.ts` → 8/8 passing (5 pre-existing + 3 new CR-01 guard tests)
- `npx convex deploy --yes` → completed: `✔ No indexes are deleted by this push` / `✔ Deployed Convex functions to http://127.0.0.1:3210`. No `--replace-all` used; no table bulk-deleted or bulk-patched.
- `npx convex run activeEngine:latestByProfile` (live, post-deploy) → `[]` (function resolves live; table remains clean)
- **Mutation check (performed live, not just described):** backed up `convex/activeEngine.ts` to the session scratchpad, reverted `internalMutation` → `mutation` in place, re-ran `npx vitest run convex/activeEngine.test.ts` → **1 failed / 7 passed** (the new guard test failed exactly as expected, with a diff showing the reverted source), then restored the file from the backup and re-verified `npx vitest run convex/activeEngine.test.ts` → 8/8 passing and `npx tsc --noEmit` clean.
- Full project suite after both tasks: `npm test -- --run` → **2830/2830 tests passing** (236 test files passed, 17 skipped by design — unrelated to this plan), 0 failures. Baseline was 2827 (Plan 09); +3 matches the 3 new CR-01 guard tests added here.

## Decisions Made

See frontmatter `key-decisions`. No architectural decisions required — this was a pure authorization-tier fix following an explicit in-repo precedent (`gatewayQuota.ts`).

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the change was a clean namespace/builder swap with no ripple into other call sites (confirmed via the sibling-exposure audit and the unchanged coalescing logic).

## Issues Encountered

None. The only notable event was the mandatory, deliberate, and reverted mutation check on `convex/activeEngine.ts` — this was planned verification activity, not an incident.

## User Setup Required

None — the deploy step (`npx convex deploy --yes`) was performed by this executor per the plan's explicit instruction ("run the repo's documented deploy... This is a function-only deploy"), consistent with CLAUDE.md's Self-Hosted Convex operational rules (function-only deploys are safe; no `--replace-all`, no bulk delete/patch was used).

## Next Phase Readiness

- CR-01 is closed. `api.activeEngine.recordRouting` no longer exists; the honesty-critical write path for the per-profile active-engine axis is server-only, matching D-14's stated intent for real now, not just in prose.
- `103-11` (CommandItem.onSelect / CR-02, keyboard-only picker selection) and this plan were both wave-1, file-disjoint — no conflict expected, `103-11` remains open.
- `103-12` (wave 2, GlobalSwapModal axis/lifecycle fix) and `103-13` (wave 3, operator-attended live re-verification, BSC-05) are unaffected by this plan and remain the next steps in the gap-closure cycle.
- BSC-01/BSC-04 requirement checkboxes in `REQUIREMENTS.md` are intentionally NOT flipped by this plan alone — per this gap-closure cycle's established pattern (see Plan 09's summary), the overall re-mark happens after the full gap-closure cycle and `103-13`'s live re-verification, not per-plan.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: `.planning/phases/103-brain-swap-control-surface/103-10-SUMMARY.md`
- FOUND: commit `3555db7c` (Task 1)
- FOUND: commit `416ed2b0` (Task 2)
