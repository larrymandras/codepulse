---
phase: 108-per-profile-engine-telemetry-astridr-backend
plan: 06
subsystem: frontend
tags: [convex, react, hooks, ui, control-verb-swap, per-profile, telemetry]

# Dependency graph
requires:
  - phase: 108-02
    provides: controlVerbSwaps Convex table + internal-only write + bounded listByScope read query + SWAP_HISTORY_CAP + isBrainSwap
  - phase: 108-03
    provides: control_verb_swap ingest case actually filling the table from live astridr events
provides:
  - useControlVerbSwaps React hook (src/hooks/useControlVerbSwaps.ts) — honest-empty read wrapper + filterBrainSwaps + describeSwapOutcome pure helpers
  - GlobalSwapModal swap-history section (D-15's readout) — TELE-02's "and surfaced" half
affects: [108-07 (deploy gate — this section will render live data only after that plan deploys)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useQuery wrapper collapses loading + empty into one honest-empty default (useToolPolicyEvents.ts convention), never returns undefined to the caller"
    - "A pure outcome-presentation function (describeSwapOutcome) derives render vocabulary once so no render site can drift from another (mirrors policyKindPresentation)"
    - "A hook-level filter (filterBrainSwaps) delegates to the Convex module's own predicate (isBrainSwap) instead of re-testing the discriminant string, so ingest-side and UI-side 'what counts as X' definitions cannot diverge"
    - "Client-side .slice(0, CAP) on top of a server-side .take(CAP) read, so an on-screen truncation caption can never overstate what's actually rendered"

key-files:
  created:
    - src/hooks/useControlVerbSwaps.ts
    - src/hooks/useControlVerbSwaps.test.ts
  modified:
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx

key-decisions:
  - "D-15 applied to the real component: GlobalSwapModal has no single profileId (it is the ALL-PROFILES axis, 103-CONTRACT.md §8), so per the plan's own stated fallback the swap-history section always calls the hook with profileId:undefined and renders the same honest empty state a real scoped profile with zero rows would get — never a fabricated profile scope."
  - "Reused convex/controlVerbSwaps.ts's isBrainSwap predicate from the hook rather than duplicating a second verb === 'swap_model' check, closing the defect class 108-02 already warned about (two schemas/predicates for one concept drifting apart)."
  - "Corrected the plan's literal example empty-state copy ('No swap history for this profile yet') to 'No swap history to show yet.' — the literal string would misrepresent a genuinely global, no-profile-scope read as though it had a real profile."

requirements-completed: []
# TELE-02 remains Pending (.planning/REQUIREMENTS.md:55,96). This plan delivers the "surfaced as
# per-profile swap history" half of TELE-02's definition, but nothing is deployed this session —
# the self-hosted Convex backend does not yet have the controlVerbSwaps table/query, so
# useQuery(api.controlVerbSwaps.listByScope, ...) resolves to undefined -> [] at runtime, and the
# section always renders its honest-empty state in production today. TELE-02 closes only once
# 108-07 (deferred, NOT run this session) deploys and ENGINE-05's live proof runs.

# Metrics
duration: ~30min
completed: 2026-08-07
---

# Phase 108 Plan 06: CodePulse Swap-History Readout (D-15) Summary

**`useControlVerbSwaps` hook (honest-empty read + pure outcome/filter helpers) plus a new swap-history section inside the existing `GlobalSwapModal`, delivering TELE-02's "and surfaced" half — not yet deployed, so it renders its honest-empty state in production until 108-07.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-07 ~09:05 -04:00 (approx.)
- **Completed:** 2026-08-07T09:33:00-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `src/hooks/useControlVerbSwaps.ts`: `useControlVerbSwaps(profileId)` wraps `api.controlVerbSwaps.listByScope`, honest-empty `[]` default, skips the query (`"skip"`) rather than querying with a fabricated profile when `profileId` is `undefined`
- `filterBrainSwaps` — pure, delegates to `convex/controlVerbSwaps.ts`'s own `isBrainSwap` predicate instead of re-testing the verb string, so the ingest-side and UI-side definitions of "a brain swap" cannot drift apart
- `describeSwapOutcome` — pure, derives the restore/refused/unresolved/success outcome vocabulary once, tested against one fixture per real `swap_model.py` emit site (D-13: `:444` restore, `:472` unresolved, `:483` affinity-refused, `:495` success)
- Re-exports `SWAP_HISTORY_CAP` from `convex/controlVerbSwaps.ts` so the UI caption and the query's `.take()` cannot drift apart
- `GlobalSwapModal.tsx`'s confirm phase now renders a `SwapHistorySection`, wrapped in `SectionErrorBoundary` so a failing history read cannot take the confirm dialog down: a refusal renders distinctly (X / `--status-error`) from a success or restore (Check / `--status-ok`) or an unresolved outcome (AlertTriangle / `--status-warn`) — T-108-24's "a history that implies every swap worked" mitigation
- Honest empty state ("No swap history to show yet.") covers both a real profile with zero rows and this modal's genuinely-global scope identically — `GlobalSwapModal` is the ALL-PROFILES axis with no single `profileId`, so per the plan's own stated fallback it never invents one
- Client-side `.slice(0, SWAP_HISTORY_CAP)` on top of the server-side bound, so the on-screen "Showing the last N swaps" caption can never overstate what's rendered
- No new route, no nav entry, no third `ModalPhase` value; only the four files this plan owns were touched (`git diff --name-only` under `src/components/brains/` lists exactly `GlobalSwapModal.tsx` + `GlobalSwapModal.test.tsx`)

## Task Commits

Each task was committed atomically:

1. **Task 1: useControlVerbSwaps hook** - `d4ce94ad` (feat)
2. **Task 2: swap-history section inside GlobalSwapModal** - `1aa9cd68` (feat)

**Plan metadata:** (this commit, see below)

## Files Created/Modified

- `src/hooks/useControlVerbSwaps.ts` (new) — `useControlVerbSwaps`, `filterBrainSwaps`, `describeSwapOutcome`, re-exported `SWAP_HISTORY_CAP`
- `src/hooks/useControlVerbSwaps.test.ts` (new) — 11 pure-function tests (`filterBrainSwaps` × 3, `describeSwapOutcome` × 7, `SWAP_HISTORY_CAP` re-export equality × 1)
- `src/components/brains/GlobalSwapModal.tsx` — `SwapHistorySection` + `formatSwapTime` helper added, rendered inside the confirm-phase JSX wrapped in `SectionErrorBoundary`
- `src/components/brains/GlobalSwapModal.test.tsx` — 6 new tests: success+refusal rendering, honest empty state, truncation caption + cap enforcement, `swap_voice` filter guard, `profileId:undefined` call assertion, `SectionErrorBoundary` isolation

## Decisions Made

Beyond what 108-CONTEXT.md/108-06-PLAN.md already locked:

- **GlobalSwapModal's genuine global-only scope, resolved per the plan's own fallback clause.** The plan's task text assumed "the profile the modal is already operating on," but `GlobalSwapModal` (Phase 103, 103-CONTRACT.md §8) has no such prop — it is the single-command, ALL-PROFILES axis. The plan itself anticipated this ("if the modal's current scope is genuinely global... render the section's honest empty/absent state rather than inventing a profile to query") — that fallback is exactly what got implemented: `profileId={undefined}` at the one call site, which the hook turns into a skipped query and an honest `[]`. This means the section will render its empty state in every real invocation of this exact modal, today and after deploy — it is forward-compatible plumbing for a future scoped surface (Phase 109?) more than a currently-populatable one. Documented as a plan-vs-code correction, not a deviation, since the plan explicitly named this exact contingency and instruction.
- **Reused `isBrainSwap` from `convex/controlVerbSwaps.ts` instead of writing a second verb predicate.** 108-02 had already exported this pure helper "for direct unit testing and reused by a future D-15 readout" — using it directly (rather than the plan's literal suggestion of a from-scratch `filterBrainSwaps` re-implementing `verb === "swap_model"`) avoids the exact two-predicates-that-can-drift defect class this repo's own LESSONS records repeatedly.
- **Corrected the plan's example empty-state copy.** `"No swap history for this profile yet"` (the plan's literal suggested string) would misrepresent the genuinely-global case as though a real profile were being read. Used `"No swap history to show yet."` instead — true in both the empty-real-profile case and the no-profile-scope case, without claiming a profile scope that doesn't exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A doc-comment collided with its own acceptance-criteria grep**
- **Found during:** Task 1 verification (`grep -c "swap_voice" src/hooks/useControlVerbSwaps.ts` — required to return `0`)
- **Issue:** `filterBrainSwaps`'s own doc-comment named the `swap_voice` verb by string ("...rather than excluding `swap_voice` by name..."), which the literal acceptance grep can't distinguish from actual filter logic — same defect class 108-02-SUMMARY.md already recorded once (`.collect()` in a comment defeating its own grep).
- **Fix:** Reworded to "the voice verb" without the literal string; same meaning, no longer matches the pattern.
- **Files modified:** `src/hooks/useControlVerbSwaps.ts`
- **Verification:** Re-ran `grep -c "swap_voice" src/hooks/useControlVerbSwaps.ts` → `0`; tests still 11/11, `tsc --noEmit` clean.
- **Committed in:** `d4ce94ad` (part of Task 1 commit — caught and fixed before committing)

**2. [Rule 1 - Bug] Two test fixtures cast a partial object to the full `SwapHistoryRow` type**
- **Found during:** Task 1's `npx tsc --noEmit` verification pass
- **Issue:** Two `describeSwapOutcome` test fixtures used `{ ... } as SwapHistoryRow` on objects missing `_id`/`verb`/`channel`/`timestamp`, which TypeScript correctly rejected as an unsound cast (`neither type sufficiently overlaps`) rather than silently allowing it.
- **Fix:** `describeSwapOutcome`'s own parameter type only needs `{ path, resolved?, reason? }` — passed plain object literals matching that narrower type instead of casting to the full row shape.
- **Files modified:** `src/hooks/useControlVerbSwaps.test.ts`
- **Verification:** `npx tsc --noEmit` clean; 11/11 tests still passing.
- **Committed in:** `d4ce94ad`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — a self-referential comment and an unsound type cast, both cosmetic/type-level, no behavior change). No scope creep; no Rule 4 architectural questions arose.

## Issues Encountered

None beyond the two auto-fixed items above. No auth gates, no blocked tasks, no checkpoints — this plan was `autonomous: true` throughout with no `type="checkpoint:*"` tasks.

## Verification Evidence

- `npx vitest run src/hooks/useControlVerbSwaps.test.ts` → **11/11 passed**
- `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` → **34/34 passed** (28 pre-existing + 6 new)
- `npx tsc --noEmit` → clean, both after each task and at plan end
- **Full suite**, isolated git worktree (`git worktree add --detach`) pinned to this plan's final commit `1aa9cd68`, `node_modules` junctioned in via PowerShell `New-Item -ItemType Junction` (per this session's Windows-worktree guidance — `cmd /c mklink /J` was not attempted, per the established prior-session finding that it silently no-ops here), removed via `git worktree remove --force` immediately after:
  **279 passed / 17 skipped test files (296 total), 3568 passed / 193 todo tests (3761 total), 0 failed** — up from the stated baseline (278 files / 3551 tests) by exactly +1 file and +17 tests, matching this plan's 1 new test file (11 tests) + 6 new tests added to the existing `GlobalSwapModal.test.tsx`.
- `npm run build` → succeeded (`✓ built in 1.02s`); the only warnings are the repo's pre-existing >500 kB chunk-size warnings (DEBT-03, already tracked elsewhere in STATE.md), unrelated to this plan's two small new files.
- **Mutation checks** (both via backup-copy, restored and confirmed byte-identical with `diff` before committing):
  - `describeSwapOutcome`: removed the `path === "restore"` branch → `RESTORE_ROW` fixture mapped to `{kind: "success"}` instead of `{kind: "restore"}` → confirmed RED (`AssertionError: expected { kind: 'success', ... } to deeply equal { kind: 'restore', ... }`) → restored.
  - `SwapHistorySection`: removed the client-side `.slice(0, SWAP_HISTORY_CAP)` → the 25-row truncation-caption test failed (`expected [...] to have a length of 20 but got 25`) → confirmed RED → restored.
- **Acceptance-criteria greps**, run against the final committed state:
  - `grep -c "swap_voice" src/hooks/useControlVerbSwaps.ts` → `0`
  - `grep -c "useControlVerbSwaps" src/components/brains/GlobalSwapModal.tsx` → `4`
  - `grep -c "SWAP_HISTORY_CAP" src/components/brains/GlobalSwapModal.tsx` → `6`
  - `grep -cE ">20<|last 20" src/components/brains/GlobalSwapModal.tsx` → `0`
  - `git diff HEAD -- src/components/brains/GlobalSwapModal.tsx` filtered for `#[0-9a-fA-F]{6}` on added lines → no hits
  - `git diff HEAD -- src/components/brains/GlobalSwapModal.tsx` filtered for `ModalPhase` → no hits (the union type itself was never touched)
  - `git status --short src/components/brains/` after both commits → only `GlobalSwapModal.tsx` and `GlobalSwapModal.test.tsx`

## Requirements Discipline

**TELE-02 stays Pending.** This plan delivers the "surfaced as per-profile swap history" half of TELE-02's definition (`control_verb_swap is routed to a domain table and surfaced as per-profile swap history`), but the readout is genuinely inert in production today: the self-hosted Convex backend has not been redeployed with the `controlVerbSwaps` table/query (108-02 never deployed, by design — see its own SUMMARY), so `useQuery(api.controlVerbSwaps.listByScope, ...)` resolves to `undefined` → the hook's own `[]` default at runtime, and `SwapHistorySection` renders its honest-empty state regardless of what real swaps have occurred. TELE-02 closes only once 108-07 (deferred, explicitly NOT run this session) deploys and ENGINE-05's live proof (D-16) confirms a real scoped swap produces a real row a human can see. `requirements-completed: []` in this file's own frontmatter agrees with this prose — following the corrected precedent from 108-02's own gap closure (its frontmatter once falsely claimed `[TELE-02]` and was corrected) and this phase's ENGINE-01 revert, both cited in this plan's dispatch as exactly the mistake not to repeat.

## Shared-Checkout Disclosure

This plan ran sequentially in the main `codepulse` checkout (`.git` is a directory, branch `master`, no worktree used for the execution itself — only for full-suite verification, removed immediately after). A concurrent session's 188.3 work landed commits (`70f16112`, `a2990980`) before this plan started and is visible in `git log`; no conflicting concurrent commits landed during this plan's own execution window. Only the four files this plan owns were staged, by explicit path (`git add src/hooks/useControlVerbSwaps.ts src/hooks/useControlVerbSwaps.test.ts` for Task 1, `git add src/components/brains/GlobalSwapModal.tsx src/components/brains/GlobalSwapModal.test.tsx` for Task 2 — never `-A`/`.`); `git show --stat HEAD` after each commit confirmed exactly the intended files landed, with no swept-in files to disclose. `git diff .planning/STATE.md` was empty immediately before this plan's own STATE.md edit (no concurrent-session clobber pending). No `git stash`, `git checkout -- <file>`, `git clean`, `--amend`, or branch switch was used anywhere in this plan.

## User Setup Required

None — no external service configuration required. This plan authors frontend code only; it does not deploy (deployment is deferred to plan 108-07 per `CLAUDE.md`'s self-hosted-Convex operational rules and this plan's own explicit scope — no `npx convex deploy` / `npm run deploy` was run).

## Next Phase Readiness

- Plan 108-07 (ENGINE-05 live deploy gate, deferred, `autonomous: false`) can now deploy the self-hosted Convex backend with `controlVerbSwaps` live, and — separately — proceed to build a *scoped* swap surface if Phase 109 wants one; this plan's `SwapHistorySection`/`useControlVerbSwaps` accept a real `profileId` and are ready to render real data the moment one is supplied and the backend is deployed.
- No blockers. Full test suite green (verified in an isolated worktree, not just a subset).
- `npx tsc --noEmit` clean across the whole project.
- TELE-02 remains the one open item this plan touches — closes only when 108-07's D-16 live proof runs.

## Self-Check: PASSED

- FOUND: `C:\Users\mandr\codepulse\src\hooks\useControlVerbSwaps.ts`
- FOUND: `C:\Users\mandr\codepulse\src\hooks\useControlVerbSwaps.test.ts`
- FOUND: commit `d4ce94ad` in `git log --oneline --all`
- FOUND: commit `1aa9cd68` in `git log --oneline --all`
- FOUND: `SwapHistorySection` definition in `src/components/brains/GlobalSwapModal.tsx`
- FOUND: `SectionErrorBoundary` import and usage in `src/components/brains/GlobalSwapModal.tsx`

## Threat Flags

None. This plan's only new client-visible surface (the swap-history section, reading the already-registered public `api.controlVerbSwaps.listByScope` query) is fully covered by 108-06-PLAN.md's own `<threat_model>` (T-108-16, T-108-23, T-108-12, T-108-24, T-108-SC) — no new network endpoint, auth path, or trust-boundary-crossing surface was introduced beyond what the plan already registered. No `dangerouslySetInnerHTML` / `innerHTML` was added (verified by inspection — all row fields render as plain JSX text children).

## Post-execution gap closure (2026-08-07, adversarial gate)

An adversarial gate on this plan found a caption-honesty defect that the original 34-test suite
(and the plan's own mutation checks above) did not catch.

**Defect.** `SwapHistorySection`'s "Showing the last {SWAP_HISTORY_CAP} swaps" caption rendered
inside the `else` branch of `brainSwaps.length === 0` — i.e. **unconditionally** whenever
`length > 0`, not gated on the list actually being at the cap. With 2 rows the caption told the
operator 20 were being shown. This is a fabricated reading of the data: T-108-12's stated intent
("a truncated list is never mistaken for a complete one") delivered its exact inverse — a
*complete* list mistaken for a truncated one.

Confirmed empirically: a mutation test that changed the condition to
`brainSwaps.length >= SWAP_HISTORY_CAP` versus leaving the caption unconditional left all 45
existing tests (34 in this file + 11 in `useControlVerbSwaps.test.ts`) passing either way —
nothing guarded the sub-cap case at all.

**Fix.** `src/components/brains/GlobalSwapModal.tsx`: gated the caption on
`atCap = brainSwaps.length >= SWAP_HISTORY_CAP`. At-cap keeps the original "Showing the last N
swaps" wording; sub-cap now renders a truthful `"Showing N swap(s)"` count instead of stating a
number the UI is not actually showing. No `convex/` file, query signature, or server-side
`.take(SWAP_HISTORY_CAP)` bound was touched — purely a client-side render decision using data the
component already holds (`brainSwaps.length`, the already-imported `SWAP_HISTORY_CAP`), consistent
with the plan's original reasoning for a static caption over adding a truncation flag to the query.

**Test coverage added** (`GlobalSwapModal.test.tsx`, both asserting on real rendered DOM via
Testing Library, never a mock's call args):
- Sub-cap (2 rows): `"Showing the last 20 swaps"` asserted **absent**, `"Showing 2 swaps"` asserted
  present.
- At-cap (`SWAP_HISTORY_CAP` rows exactly): `"Showing the last 20 swaps"` asserted present.

**Mutation verification** (revert-and-confirm-RED, per this gap closure's own instructions):
reverted the caption JSX to the old unconditional form (backup-copied the fixed file first, never
`git checkout --`), ran only the new sub-cap test, confirmed RED, then restored the fix from the
backup copy and confirmed all 36 tests green again. RED output:

```
FAIL  src/components/brains/GlobalSwapModal.test.tsx > GlobalSwapModal swap-history section (D-15, TELE-02) > does NOT render the 'Showing the last N swaps' caption when the list is below the cap (gap closure)
Error: expect(element).not.toBeInTheDocument()

expected document not to contain element, found <p
  class="text-xs text-muted-foreground"
>
  Showing the last
  20
   swaps
</p> instead
 ❯ src/components/brains/GlobalSwapModal.test.tsx:1458:82

 Test Files  1 failed (1)
      Tests  1 failed | 35 skipped (36)
```

**Verification after restore:**
- `npx tsc --noEmit` → clean
- `npx vitest run src/components/brains/GlobalSwapModal.test.tsx` → **36/36 passed** (34 pre-existing
  + 2 new)
- No hardcoded hex colours introduced (`grep -n "#[0-9a-fA-F]{3,6}"` on the modified file → no hits)
- `git show --stat HEAD` after the fix commit → exactly `GlobalSwapModal.tsx` +
  `GlobalSwapModal.test.tsx`, no unintended sweep-in
- No `convex/` file touched; `listByScope`'s query signature and server-side
  `.take(SWAP_HISTORY_CAP)` bound are byte-unchanged

**Full-suite verification** (isolated git worktree, `--detach` pinned to `2c4906b5`, `node_modules`
junctioned via PowerShell `New-Item -ItemType Junction`, removed via `git worktree remove --force`
immediately after): **279 files passed / 17 skipped (296 total), 3570 tests passed / 193 todo (3763
total), 0 failed** — exactly the stated baseline (279/3568) + 2, matching this gap closure's 2 new
tests. No regressions elsewhere in the tree.

**Commit:** `2c4906b5` — `fix(108-06): show the truncation caption only when the list is actually
capped`

TELE-02 remains Pending as stated above — this gap closure is a client-side honesty fix within the
already-inert (undeployed) surface and does not itself close the requirement.

---
*Phase: 108-per-profile-engine-telemetry-astridr-backend*
*Completed: 2026-08-07*
