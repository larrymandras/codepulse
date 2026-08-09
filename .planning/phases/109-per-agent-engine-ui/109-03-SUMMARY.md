---
phase: 109-per-agent-engine-ui
plan: 03
subsystem: ui

tags: [react, websocket, brain-swap, convex, vitest]

# Dependency graph
requires:
  - phase: 109-01
    provides: "profile_overrides on swap.state, default_profile_id on the swap.catalogue brain-target ack (astridr-repo, feature/brain-swap)"
provides:
  - "src/hooks/useBrainCatalogue.ts — the ONE swap.catalogue fetcher in the app (entries/defaultProfileId/error/refetch), consumed by every brain surface"
  - "Per-profile swap.set dispatch with profile_id (BrainPicker.tsx), bounded via PROFILE_SWAP_DISPATCH_TIMEOUT_MS, replacing the never-implemented gateway.model.set"
  - "default_profile_id (not Convex profileConfigs ordering) as the addressed profile on BrainHeaderBadge and Chat's composer pill"
  - "brainsApi.ts reduced to display-name helpers only (resolveModelDisplayName/buildModelNameMap/stripVendorPrefix/CatalogueEntry/ActiveEngine) — the D-16 stub/live adapter seam is fully deleted"
affects: [109-04, 109-05, 109-06, 109-07, 109-08, 109-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One canonical data-fetching hook per shared resource: useBrainCatalogue() replaces three independent fetch sites (per-profile stub catalogue, global-axis swap.catalogue read, default-profile-id read) with one hook every consumer calls directly."
    - "Bounded dispatch wrapper duplicated per dispatch site (BrainPicker's own dispatchBounded, mirroring GlobalSwapModal's) rather than factored into a shared utility — kept local per T-109-08's threat-model note, matches the existing GlobalSwapModal precedent exactly."

key-files:
  created:
    - src/hooks/useBrainCatalogue.ts
    - src/hooks/useBrainCatalogue.test.ts
  modified:
    - src/lib/brainsApi.ts
    - src/lib/brainsApi.test.ts
    - src/hooks/useResolvedBrain.ts
    - src/hooks/useResolvedBrain.test.tsx
    - src/App.tsx
    - playwright.config.ts
    - e2e/quick-commands-stop.spec.ts
    - src/components/brains/BrainPickerRow.test.tsx
    - src/components/brains/GlobalSwapModal.test.tsx
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/components/brains/BrainHeaderBadge.tsx
    - src/components/brains/BrainHeaderBadge.test.tsx
    - src/pages/Chat.tsx
    - src/pages/Chat.test.tsx
    - src/pages/Settings.tsx
    - src/pages/Settings.test.tsx

key-decisions:
  - "D-01/D-02/D-03 implemented as specified: the stub seam (adapter, fixtures, flag, registrar, five STUB chips) is fully deleted; one swap.catalogue fetcher serves both picker scopes; default_profile_id (Ástríðr's own resolved value) replaces the Convex profiles[0]?.profileId fallback everywhere it was read."
  - "e2e/brain-swap.spec.ts and its VITE_BRAINS_STUB webServer.env entry are both deleted, not rewritten or skipped — the plan's own reasoning (every assertion depends on stub-only fixture content, the harness has no astridr backend to exercise a live rewrite) held on inspection. Its one non-stub-dependent value (mouse-vs-keyboard activation parity) is already independently covered by BrainPicker.test.tsx's 103-11/CR-02 keyboard-activation describe block."
  - "BrainComposerPill (Chat.tsx) was changed from a profileId-prop-receiving component to a self-sufficient one that calls useBrainCatalogue() itself, computing profileId internally. This removes Chat()'s separate brainDefaultProfileId state/effect entirely (one hook call now serves both the catalogue and the default-profile-id needs that previously required two separate WS round trips)."
  - "D-02's flattening (every live catalogue entry normalizes to group:'api', costTier:'normal') now applies to BOTH picker scopes, not just the global one — this is an accepted, plan-documented consequence (CONTEXT.md D-09/D-13), not a new regression: only the API group and the no-confirm dispatch path are reachable through the picker's live catalogue until plan 109-07 restores real group/billing/cost-tier mapping. BrainPicker.test.tsx's docstring states this explicitly so a future reader does not mistake it for missed coverage."
  - "useGlobalModelNames (useResolvedBrain.ts) was reimplemented as a thin derivation over useBrainCatalogue()+buildModelNameMap per the plan's explicit instruction, preserving its external contract unchanged — every existing caller (BrainHeaderBadge, Chat) keeps calling it exactly as before."

requirements-completed: [ENGINE-03, ENGINE-04]

# Metrics
duration: 40min
completed: 2026-08-09
---

# Phase 109 Plan 03: Retire the D-16 stub seam; real per-profile swap.set + one live catalogue Summary

**Deleted the entire per-profile brain-swap stub/live adapter seam (validator, fixtures, build-time flag, registrar, five STUB render sites, two never-implemented WS commands) and replaced it with a single `useBrainCatalogue()` hook that every brain surface reads, dispatching the real `swap.set` with `profile_id` through the bounded sender the global axis already uses.**

## Performance

- **Duration:** ~40 min (09:00 → 09:41)
- **Completed:** 2026-08-09T13:41:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 23 (2 created, 17 modified, 4 deleted)

## Accomplishments

- `src/hooks/useBrainCatalogue.ts` — the one `{type:"swap.catalogue", target:"brain"}` fetcher in the app, exposing `entries`/`defaultProfileId`/`error`/`refetch` with honest-failure semantics (a non-ok ack or thrown error sets `error:true` and never fabricates an empty catalogue or a guessed default profile id).
- `BrainPicker.tsx` dispatches the real per-profile `swap.set` — `{type:"swap.set", target:"brain", value:entry.id, restore:false, profile_id:profileId}` — through `useCommandDispatch()`, wrapped in a bounded `dispatchBounded` (mirroring `GlobalSwapModal`'s own, `PROFILE_SWAP_DISPATCH_TIMEOUT_MS = 15000`) so a dispatch that never returns settles as an honest error instead of hanging the popover's pending state (T-109-08).
- One catalogue serves both picker scopes: toggling "This profile" ↔ "All profiles" no longer re-fetches, and the old scope-toggle race guard (`fetchGenRef`) is gone — the hook's own generation guard covers `refetch()` instead.
- `BrainHeaderBadge`, Chat's `BrainComposerPill`, and Settings' `AgentProfileRows` all read the catalogue and Ástríðr's own `default_profile_id` through `useBrainCatalogue()` — no component fetches its own copy anymore, and the `profiles[0]?.profileId` Convex-ordering fallback (D-03's explicitly rejected option) is deleted from `BrainHeaderBadge`.
- Every STUB chip/banner (trigger chip and popover banner on `BrainPicker`, the badge's stub chip, Chat's pill stub chip, Settings' row stub chip) is deleted with no replacement, along with `BRAINS_STUB_ACTIVE`, the `VITE_BRAINS_STUB` env read, `validateGatewayModelSet`, and `registerBrainsWsSender`/`liveSendCommand`.
- `e2e/brain-swap.spec.ts` and `playwright.config.ts`'s `VITE_BRAINS_STUB` `webServer.env` entry are deleted (not skipped or rewritten) with the reason recorded in this SUMMARY per the plan's mandate.

## Task Commits

1. **Task 1: Delete the seam; add useBrainCatalogue as the one swap.catalogue fetcher** — `cff6d866` (feat)
2. **Task 2: BrainPicker — one catalogue, real scoped dispatch, no STUB chrome** — `4ee74f99` (feat)
3. **Task 3: Header badge, Chat pill and Settings row off the seam and onto default_profile_id** (includes final grep-gate wording cleanup across Task 1/2 files, discovered while verifying this task's own acceptance criteria — see Deviations) — `b4b8ee0f` (feat)

**Plan metadata:** pending (this commit, after STATE.md/ROADMAP.md updates)

## Files Created/Modified

- `src/hooks/useBrainCatalogue.ts` — new. `useBrainCatalogue()`: one `swap.catalogue` fetch per `connected` transition plus an explicit `refetch()`, generation-guarded against stale in-flight responses.
- `src/hooks/useBrainCatalogue.test.ts` — new, 11 tests (fetch-on-connect, honest failure/malformed-payload handling, refetch supersedes a stale response, degrades outside `AstridrWSProvider`).
- `src/lib/brainsApi.ts` — deleted `validateGatewayModelSet`, `createStubBrainsAdapter`/`stubBrainsAdapter`, `createLiveBrainsAdapter`/`liveBrainsAdapter`, `BrainsAdapter`, `registerBrainsWsSender`/`liveSendCommand`, `BRAINS_STUB_ACTIVE`, the `VITE_BRAINS_STUB` read. Kept `stripVendorPrefix` (still module-private), `resolveModelDisplayName`, `buildModelNameMap`, `CatalogueEntry`, and — discovered mid-Task-1 to be a genuinely live, seam-unrelated telemetry type still needed by `useActiveEngine.ts` — `ActiveEngine` (see Deviations).
- `src/lib/brainsApi.test.ts` — rewritten as a module-shape guard (3 tests: only the display-name survivors are exported; the deleted seam's symbols are genuinely gone, not renamed).
- `src/lib/brainsFixtures.ts` — deleted.
- `src/components/brains/BrainsWsRegistrar.tsx` / `.test.tsx` — deleted; mount removed from `src/App.tsx`.
- `playwright.config.ts` — `webServer.env`'s `VITE_BRAINS_STUB` entry and its explanatory comment deleted.
- `e2e/brain-swap.spec.ts` — deleted.
- `src/hooks/useResolvedBrain.ts` — `useGlobalModelNames` reimplemented as `useMemo(() => buildModelNameMap(entries), [entries])` over `useBrainCatalogue()`, external contract unchanged.
- `src/components/brains/BrainPicker.tsx` — consumes `useBrainCatalogue()` for both scopes; `normalizeGlobalCatalogueEntry` renamed `normalizeCatalogueEntry`; `handleProfileDispatch` dispatches real `swap.set` with `profile_id` via a new local `dispatchBounded`; all STUB JSX and the scope-specific fetch-error copy deleted.
- `src/components/brains/BrainHeaderBadge.tsx` — `useBrainCatalogue()` replaces the local catalogue/default-profile-id effect; `profiles[0]?.profileId` fallback and STUB chip deleted; `isConfirmedLive` simplified to `!pendingLabel && (isGlobal || isProfile)`.
- `src/pages/Chat.tsx` — `BrainComposerPill` now calls `useBrainCatalogue()` itself (no longer takes a `profileId` prop); `Chat()`'s separate `brainDefaultProfileId` state/effect deleted; STUB chip deleted.
- `src/pages/Settings.tsx` — `AgentProfileRows` consumes `useBrainCatalogue()` for the provider-identity dot; engine label untouched (still raw `activeEngines[...]` telemetry, per this plan's explicit "do not touch Settings' D-14 label source" instruction); STUB chip deleted.
- Test files (`BrainPicker.test.tsx`, `BrainHeaderBadge.test.tsx`, `Chat.test.tsx`, `Settings.test.tsx`, `GlobalSwapModal.test.tsx`, `BrainPickerRow.test.tsx`, `useResolvedBrain.test.tsx`) — rewritten mocking seams (see Deviations) and updated/added assertions matching the new dispatch shape, catalogue source, and D-03 addressing rule.

## Decisions Made

See frontmatter `key-decisions`. In summary: D-01/D-02/D-03 implemented exactly as `109-CONTEXT.md` specifies. The e2e spec's fate (D-01's mandatory decision) was **deletion**, with the reasoning verified against the live harness (Playwright's `webServer` runs only `npm run dev`, never an astridr backend, so a live rewrite has nothing to connect to) rather than transcribed from the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in my own draft] Deleted `ActiveEngine` from `brainsApi.ts`, then had to restore it**
- **Found during:** Task 1, `npx tsc --noEmit` after the first `brainsApi.ts` rewrite
- **Issue:** The plan's "what survives" list (`stripVendorPrefix`, `resolveModelDisplayName`, `buildModelNameMap`, `CatalogueEntry`) does not mention `ActiveEngine` — a type describing `convex/activeEngine.ts`'s live telemetry snapshot shape, genuinely unrelated to the deleted stub/live adapter seam. My first-pass rewrite deleted it along with the seam, breaking `useActiveEngine.ts`, `useActiveEngine.test.ts`, and `useResolvedBrain.test.tsx` (all import it).
- **Fix:** Re-added `ActiveEngine` to `brainsApi.ts` with a docstring explaining it is telemetry, not part of the seam.
- **Files modified:** `src/lib/brainsApi.ts`
- **Verification:** `npx tsc --noEmit` exits 0; `useActiveEngine.test.ts`/`useResolvedBrain.test.tsx` pass.
- **Committed in:** `cff6d866` (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed two downstream test files that imported the deleted `brainsFixtures.ts` / mocked the deleted `BRAINS_STUB_ACTIVE`**
- **Found during:** Task 1, `npx tsc --noEmit` and full-suite run after the seam deletion
- **Issue:** `BrainPickerRow.test.tsx` (not in this plan's `files_modified`) imported `STUB_CATALOGUE` from the now-deleted `@/lib/brainsFixtures`. `GlobalSwapModal.test.tsx` (also not in `files_modified`) mocked `@/lib/brainsApi`'s `BRAINS_STUB_ACTIVE` getter and asserted a "never renders the BRAINS_STUB_ACTIVE chip" test that is now provably vacuous (the concept no longer exists anywhere in the codebase). Both would have left the suite red or the module graph broken.
- **Fix:** `BrainPickerRow.test.tsx` now owns a small local `TEST_CATALOGUE` fixture (id/name/vendor/group/billing/costTier/health entries covering the same branches the deleted fixture set covered) — `BrainPickerRow` itself is a pure presentational component with no dependency on the deleted seam. `GlobalSwapModal.test.tsx`'s `brainsApi` mock dropped the `BRAINS_STUB_ACTIVE` getter (kept only the `dispatchSwap` anti-fan-out proof surface, which the component's real code never calls), and the vacuous stub-chip test was deleted.
- **Files modified:** `src/components/brains/BrainPickerRow.test.tsx`, `src/components/brains/GlobalSwapModal.test.tsx`
- **Verification:** `npx vitest run src/components/brains/BrainPickerRow.test.tsx src/components/brains/GlobalSwapModal.test.tsx` — 58/58 pass.
- **Committed in:** `cff6d866` (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed a Vitest hang caused by combining `vi.useFakeTimers()` with `findByText`/`vi.waitFor`**
- **Found during:** Task 2, first run of `BrainPicker.test.tsx`'s new bounded-dispatch-timeout test
- **Issue:** My first draft called `vi.useFakeTimers()` before an `await screen.findByText(...)` — testing-library's async queries poll via real `setTimeout`, which fake timers freeze, hanging that test and (once the harness force-killed it past its own timeout) leaving fake timers active for every subsequent test in the file, cascading into 28 more spurious 5000ms timeouts.
- **Fix:** Reordered to open the popover and resolve `findByText` on REAL timers first, THEN switch to fake timers only around the dispatch-and-advance portion, wrapped in `act()` — mirrors `GlobalSwapModal.test.tsx`'s own working idiom for its analogous `GLOBAL_SWAP_DISPATCH_TIMEOUT_MS` test, which I read and copied after finding the hang.
- **Files modified:** `src/components/brains/BrainPicker.test.tsx`
- **Verification:** Full file: 39/39 pass, ~3s (was hanging past 120s before the fix).
- **Committed in:** `4ee74f99` (Task 2 commit)

**4. [Rule 3 - Blocking, deviation-warning-driven] Final grep-gate cleanup across Task 1/2 files, discovered while verifying Task 3's own acceptance criteria**
- **Found during:** Task 3, running the plan's combined literal-string grep gates (`VITE_BRAINS_STUB`, `BRAINS_STUB_ACTIVE`, `gateway.model.set`, `STUB`, `brainsFixtures`, `getDefaultProfileId`, `getCatalogue`, `profiles[0]?.profileId`) across the whole touched surface
- **Issue:** Several historical/explanatory comments I wrote in Tasks 1–2 (describing what used to exist, for future-reader context) contained the literal deleted-symbol strings as substrings, which the plan's acceptance criteria treat as hard zero-tolerance greps. Two cases were real regression-guard assertions (`GlobalSwapModal.test.tsx`'s `queryByText("STUB")`, `BrainPicker.test.tsx`'s equivalent) that needed the literal string to prove absence.
- **Fix:** Reworded the historical comments to describe the same facts without the literal tokens (e.g. "a build-time stub flag" instead of `BRAINS_STUB_ACTIVE`). For the two regression-guard assertions, replaced the literal-string check with a structural-completeness assertion (`trigger.children` has exactly the two designed children) that catches a broader class of regression than a single spelled-out string ever could, and dropped the now-provably-vacuous `GlobalSwapModal` stub-chip test outright (the component has no code path that could ever render it).
- **Files modified:** `src/components/brains/BrainHeaderBadge.tsx`, `.test.tsx`, `src/components/brains/BrainPicker.test.tsx`, `src/components/brains/BrainPickerRow.test.tsx`, `src/components/brains/GlobalSwapModal.test.tsx`, `src/hooks/useBrainCatalogue.ts`, `src/pages/Chat.test.tsx`, `src/pages/Settings.test.tsx`
- **Verification:** Combined grep gate returns zero hits across `src/ e2e/ convex/ *.ts *.config.ts` for all nine patterns, except one untouched pre-existing file (`src/lib/brainsDisplayNames.test.ts`, not in this plan's scope, describing the same historical fact — left alone).
- **Committed in:** `b4b8ee0f` (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (1 own-draft bug, 3 blocking-issue fixes — one of which cascaded across two files not in this plan's original `files_modified` list, per `<plan_text_is_a_draft>`'s "deletion exposes leftovers" warning)
**Impact on plan:** No scope creep beyond what the deletion itself required. The `BrainPickerRow.test.tsx`/`GlobalSwapModal.test.tsx` fixes were necessitated directly by Task 1's deletions (their `files_modified` omission was a plan-draft gap, not a deliberate exclusion — both files structurally could not have kept passing).

## Plan-Draft Corrections (not deviations — text the plan got wrong, corrected on sight per `<plan_text_is_a_draft>`)

- **`src/hooks/useResolvedBrain.ts` and `.test.tsx` are not in the plan's frontmatter `files_modified` list**, even though Task 1's own action text explicitly instructs "Re-implement `useGlobalModelNames`... as a thin derivation over `useBrainCatalogue()`" — a change that can only land in `useResolvedBrain.ts`. Edited as instructed; the omission from the file list is documented here rather than silently worked around.
- **The plan's acceptance-criteria greps (`grep -c "X" file` returning 0) are stated as absolute, but several are structurally impossible to satisfy while ALSO keeping a meaningful regression-guard test** (a test proving "STUB never renders" must contain the string "STUB" somewhere to assert against). Resolved per-case: where the assertion could be restated structurally without losing coverage, I did so (see Deviation 4); where a comment merely needed rewording, I reworded it; the one genuinely out-of-scope pre-existing file (`brainsDisplayNames.test.ts`) was left untouched.

## Test-Count Delta vs. Baseline (deletion-specific requirement)

Baseline (measured immediately before this plan started, on this exact tree): **281 test files passed | 17 skipped, 3649 tests passed | 193 todo.**

After this plan: **281 test files passed | 17 skipped, 3639 tests passed | 193 todo** — same file count (298 total both times, so no file silently stopped being collected), **10 fewer tests**, fully accounted for by diffing `it(` counts per touched test file against the pre-plan commit (`4970c7ed`):

| File | Before | After | Delta | Why |
|---|---|---|---|---|
| `src/lib/brainsApi.test.ts` | 15 | 3 | −12 | Deleted validator/stub/live-adapter test suites; replaced with a 3-test module-shape guard |
| `src/components/brains/BrainsWsRegistrar.test.tsx` | 4 | 0 | −4 | Whole file deleted (its subject was deleted) |
| `src/hooks/useBrainCatalogue.test.ts` | 0 | 11 | +11 | New hook, new tests |
| `src/components/brains/BrainPickerRow.test.tsx` | 20 | 20 | 0 | Fixture source swap only (see Deviation 2) |
| `src/components/brains/GlobalSwapModal.test.tsx` | 39 | 38 | −1 | Deleted the now-vacuous STUB-chip test (Deviation 2/4) |
| `src/components/brains/BrainPicker.test.tsx` | 44 | 39 | −5 | Net: removed the obsolete WR-01 staleness-race test, the 3-group-order test (D-02/D-13 makes only "API" reachable), 2 STUB-indicator tests, and the expensive/unknown-tier picker-level tests (now unreachable per D-02's flattening, covered directly in `BrainPickerRow.test.tsx` instead); added new bounded-timeout, no-additional-refetch-on-scope-toggle, and single-group tests |
| `src/components/brains/BrainHeaderBadge.test.tsx` | 25 | 26 | +1 | −1 (stub pulse-dot test) +2 (D-03 absent/control pair) |
| `src/pages/Chat.test.tsx` | 33 | 34 | +1 | −1 (stub chip test) +2 (D-03 absent-profile-id + real-scoping tests) |
| `src/pages/Settings.test.tsx` | 11 | 10 | −1 | −2 (stub tests) +1 (single no-stub-chrome test) |
| **Total** | | | **−10** | Matches the observed suite-wide delta exactly |

Every dropped test corresponds to a deliberately deleted code path (the stub seam) or a now-structurally-unreachable branch (D-02's cost-tier/group flattening applied to the picker's live catalogue); no test was dropped because a suite silently stopped being collected.

## Issues Encountered

None beyond the four auto-fixed items documented above. `npx tsc --noEmit` exits 0. `npm run build` succeeds. `npx playwright test --list` lists 38 tests across 8 files with no reference to the deleted `brain-swap.spec.ts`.

### Raw `grep -rn "184\.1" src/` output (Task 3 acceptance criterion, pasted verbatim)

```
src/components/brains/GlobalSwapModal.tsx:10: * commands (the astridr-Phase-184.1 axis, not yet built) and reported THEIR guaranteed
src/hooks/useResolvedBrain.test.tsx:275:  // than the Convex ingest expects (untracked "Astridr Phase 184.1" per 103-CONTRACT.md) — so in
src/hooks/useResolvedBrain.ts:174: * router.py, tracked separately as the still-unbuilt "Ástríðr Phase 184.1" per
```

Zero hits in the three files this plan's D-03 grep scope actually names (`BrainHeaderBadge.tsx`, `Chat.tsx`, `Settings.tsx`) — verified separately with `grep -n "184\.1" src/components/brains/BrainHeaderBadge.tsx src/pages/Chat.tsx src/pages/Settings.tsx` (no output). The three remaining hits are in files this plan did not touch (`GlobalSwapModal.tsx`'s own docstring, `useResolvedBrain.ts`/`.test.tsx`'s pre-existing `useLastTurnModel` prose) — out of scope for this plan (they belong to the `useLastTurnModel` fallback rung and the global-axis dispatch history, neither of which this plan's D-01/D-02/D-03 touch).

### What `src/pages/Settings.test.tsx` currently covers (Task 3's explicit read-first instruction)

`AgentProfileRows` (exported from `Settings.tsx` for isolated testing): live-engine-wins-over-stale-config (BSC-01/D-06, 4 tests), session-vs-pinned secondary line (D-02, 2 tests), Swap-affordance-distinct-from-Edit (103-07-T1, 3 tests), and (post this plan) no-stub-chrome (1 test). It does NOT cover D-10's swap-history section (not yet built — plan 109-08's job) or D-14's engine-label resolver change (plan 109-04's job, explicitly out of this plan's scope per its own "do not touch" instruction).

## Known Stubs

None — this plan's entire purpose was removing the last stub concept from the codebase. Confirmed via the combined grep gate (see above) and `brainsApi.test.ts`'s module-shape guard.

## Threat Flags

None. This plan implements T-103-03's mitigation (the flag/adapter/fixtures/render-sites are deleted, verified by grep) and T-109-08's mitigation (bounded dispatch, verified by the fake-timer test). T-109-07 (no client-side validator) is an accepted risk per the plan's own threat model, not a new surface. No new network endpoint, auth path, or schema change was introduced.

## User Setup Required

None — no external service configuration required. This plan is CodePulse-only (no astridr-repo changes); the two backend fields it depends on (`profile_overrides`, `default_profile_id`) were delivered by plan 109-01 and require the astridr-agent container to be rebuilt before any live-verify session can observe them (already flagged in 109-01-SUMMARY.md for the 109-09 live-gate plan).

## Next Phase Readiness

- The per-profile dispatch and catalogue paths this phase's remaining plans build on (109-04's precedence/absent-state work, 109-05's model-id normalization, 109-06's 5-state `useProfileSwap` machine, 109-07's real group/billing/cost-tier restoration) now have a real `swap.set`+`profile_id` dispatch and a single live catalogue to build against — no more stub seam to route around.
- `BrainPicker.tsx`'s D-14 success-toast effect and ad-hoc `pendingTarget` state are explicitly marked (inline comment) as the interim consumer plan 109-06 replaces — do not add a second implementation alongside it.
- D-02's cost-tier/group flattening (only "API" group, only `costTier:"normal"` reachable live) is a known, documented gap for plan 109-07 to close — `BrainPicker.test.tsx`'s own docstring states this so it is not mistaken for missed coverage in a future review.
- No blockers for plan 109-04.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*
