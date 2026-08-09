---
phase: 109-per-agent-engine-ui
plan: 06
subsystem: ui

tags: [react, websocket, brain-swap, outcome-machine, server-confirmed, vitest]

# Dependency graph
requires:
  - phase: 109-01
    provides: "profile_overrides on swap.state / swap.get_state ack (astridr-repo, feature/brain-swap) — the readback source this plan's confirm effect reads"
  - phase: 109-03
    provides: "the retired D-16 stub seam; useBrainCatalogue() as the one swap.catalogue fetcher"
  - phase: 109-04
    provides: "resolveActiveBrain's D-06 precedence chain and useProfileBrainOverrides() (src/hooks/useResolvedBrain.ts)"
  - phase: 109-05
    provides: "modelIdsMatch — not directly consumed by this plan's readback (raw === matches GlobalSwapModal's own override-slot comparison precedent), but the toast-gate site this plan's Task 2 retires was one of D-08's seven sites"
provides:
  - "useProfileSwap(profileId) (src/hooks/useProfileSwap.ts) — the one per-profile, server-confirmed five-state outcome machine (pending/confirming/confirmed/accepted/error), extracted from GlobalSwapModal's pattern"
  - "PROFILE_SWAP_CONFIRM_TIMEOUT_MS (4000) / PROFILE_SWAP_DISPATCH_TIMEOUT_MS (15000) — relocated from BrainPicker.tsx into the hook that now owns the dispatch"
  - "BrainPickerProps.onPendingChange's widened { label, kind: 'inflight' | 'uncertain' } | null contract — consumed identically by BrainHeaderBadge, Chat's composer pill, and Settings' per-profile row"
affects: [109-per-agent-engine-ui, any-future-per-profile-brain-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Outcome state machine extracted into a standalone hook (not a component) because the per-profile axis has four render surfaces and no modal to hold component-local state — GlobalSwapModal's inline pending/confirming/confirmed/accepted/error machine is the pattern, generalized to a reusable hook for the first time in this codebase."
    - "D-05 substitution as a documented, deliberate divergence from the pattern being copied: confirmation reads the swap.state OVERRIDE SLOT (profileOverrides[profileId]), never a resolved telemetry row — the current-engine DISPLAY reads telemetry instead (useActiveEngine), a different, also-honest question. Both call sites are inside the same hook, explicitly commented at the point of use."
    - "Epoch-guarded async dispatch continuation (not present in the GlobalSwapModal analog, since that component's dialog structurally prevents a second concurrent swap) — a Rule 2 addition, since the per-profile popover closes immediately on dispatch, making a second swapTo before the first settles a real, reachable race."

key-files:
  created:
    - src/hooks/useProfileSwap.ts
    - src/hooks/useProfileSwap.test.ts
  modified:
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/components/brains/BrainHeaderBadge.tsx
    - src/components/brains/BrainHeaderBadge.test.tsx
    - src/pages/Chat.tsx
    - src/pages/Chat.test.tsx
    - src/pages/Settings.tsx
    - src/pages/Settings.test.tsx

key-decisions:
  - "The confirm readback compares profileOverrides[profileId]?.model against the dispatched target with a raw === (not modelIdsMatch) — matching GlobalSwapModal's own override-slot readback (modelOverride === confirmTarget), which was NOT among D-08's seven converted sites. The override slot echoes back exactly what the client dispatched (no intervening telemetry-format resolution step), so the vendor-prefix mismatch class D-08 exists to fix cannot occur at this specific site — confirmed by removing (not converting) the pre-existing D-08-site-7 test that depended on the OLD telemetry-based confirm mechanism this plan retires."
  - "restore() is built and tested (confirms on absence of this profile's override entry, paired with a still-present control profile) but has no UI trigger in this plan — no per-profile restore affordance exists in BrainPicker/Settings/Chat today. The hook's public contract includes it per the plan's own must_haves.artifacts; a future plan wires the UI."
  - "Toast copy for restore (not specified anywhere in 109-UI-SPEC.md, which only defines per-profile swap-to copy) was authored by the executor with reasonable, consistent phrasing, since no consumer renders it this plan and no spec exists to deviate from."
  - "onPendingChange widened from string|null to {label,kind}|null (Rule 2 — required for the uncertain-vs-inflight distinction the plan's own §C mandates); all three consumers (badge/pill/row) render icon+text, never color alone, satisfying the readable-theme parity rule stated in 109-UI-SPEC.md's Design System table."
  - "BrainHeaderBadge gained a NEW dedicated in-flight status-info pulsing dot — before this plan it had no such element; it only ever suppressed the unrelated confirmed-live primary pulse while pending and relied on the still-visible provider-color dot plus text. Chat's composer pill and BrainPicker's own trigger already had this dot; the badge was the one surface missing it, so this plan adds it for cross-surface consistency, not just wiring the existing element to a new value."

requirements-completed: [ENGINE-04]

# Metrics
duration: ~55min
completed: 2026-08-09
---

# Phase 109 Plan 06: The Five-State, Server-Confirmed Per-Profile Outcome Machine Summary

**Extracted GlobalSwapModal's pending/confirming/confirmed/accepted/error outcome machine into `useProfileSwap`, a standalone hook that confirms per-profile swaps against the `swap.state` override slot (never telemetry) and drives one honest suffix across all four per-profile render surfaces — the picker trigger, header badge, composer pill, and Settings row.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-09T11:01:00-04:00
- **Completed:** 2026-08-09T11:20:29-04:00
- **Tasks:** 3/3 completed
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- `useProfileSwap(profileId)` (new hook) owns the entire per-profile swap lifecycle: dispatch (bounded at 15s), the ok/error ack branch, the 4s confirm-timeout race, the D-05 readback against `profileOverrides[profileId]` (the swap.state override slot — never a resolved telemetry row, per the plan's central D-05 substitution), and every toast (`confirmed`/`accepted`/`error`). One implementation; no component holds a second, competing copy.
- The readback correctly distinguishes a mismatched-model reading (stays `confirming`) from a matching one (`confirmed`), and a restore's confirmation is the ABSENCE of the profile's own override entry — proven with a paired control profile that stays present in the same payload, so an empty-map bug could never pass.
- Race-protected: an `epochRef` guard (a Rule 2 addition, not in the plan's task text) ensures a stale dispatch resolving after a newer `swapTo`/`restore` superseded it can never clobber the newer state — a real, reachable scenario since the popover closes immediately on dispatch.
- `BrainPicker.tsx` now holds zero swap state of its own: `handleProfileDispatch`, `pendingTarget`, the D-14 success-toast effect, and the local `dispatchBounded`/`PROFILE_SWAP_DISPATCH_TIMEOUT_MS` are all deleted in favor of one `useProfileSwap(profileId)` call.
- `onPendingChange` widened to `{ label, kind: "inflight" | "uncertain" }`, consumed identically by `BrainHeaderBadge`, Chat's `BrainComposerPill`, and Settings' `AgentProfileRows` — each renders a pulsing `--status-info` dot for "inflight" and a static `AlertTriangle` in `--status-warn` for "uncertain" (the bounded-timeout state), never a pulsing dot for the latter, so it cannot be mistaken for in-progress or success. Every state is icon+text, satisfying the `readable`-theme (glow-suppressed) parity rule.
- `BrainHeaderBadge` gained a genuinely new visual element (the in-flight status-info dot) it never had before this plan — previously the only pending signal on that surface was the *absence* of the (unrelated) confirmed-live pulse plus the text suffix.

## Task Commits

1. **Task 1: useProfileSwap — the five-state, server-confirmed outcome machine** — `230db6bc` (feat)
2. **Task 2: BrainPicker consumes the hook; the interim pending block is removed** — `03c5fd51` (feat)
3. **Task 3: Render the five-state suffix on the badge, composer pill, and Settings row** — `13deede2` (feat)
4. **Cleanup: reword remaining `pendingTarget` comment references so the grep gate is genuinely zero** — `3741ffdc` (docs)

**Plan metadata:** pending (this commit, after STATE.md/ROADMAP.md updates)

_TDD note: Task 1 was built test-alongside-implementation (not a separate RED-then-GREEN commit pair) — the plan's own task text is implementation-first for this hook (behavior/acceptance criteria describe the finished machine, not a red-first increment), and 109-01/109-03/109-04/109-05 all documented the same deviation for the same reason. Every test was run and confirmed passing before its task's commit; no task was committed with a failing test._

## Files Created/Modified

- `src/hooks/useProfileSwap.ts` — new: `useProfileSwap`, `ProfileSwapOutcome`, `PROFILE_SWAP_CONFIRM_TIMEOUT_MS`, `PROFILE_SWAP_DISPATCH_TIMEOUT_MS`.
- `src/hooks/useProfileSwap.test.ts` — new: 14 tests (constants, exhaustive-switch type guard, dispatch shape, mismatched-vs-matching readback with paired control, error-never-confirms, 15s dispatch bound, 4s confirm bound with single-fire toast, late confirm out of accepted, restore-on-absence with a still-present control, race protection, unmount timer cleanup).
- `src/components/brains/BrainPicker.tsx` — `handleProfileDispatch`/`pendingTarget`/the D-14 toast effect/local `dispatchBounded`/`PROFILE_SWAP_DISPATCH_TIMEOUT_MS` deleted; `useProfileSwap(profileId)` call added; `handleSelect`'s "This profile" branch now calls `swapTo`; default trigger renders the new `pendingInfo`-derived icon/suffix; `onPendingChange` type widened.
- `src/components/brains/BrainPicker.test.tsx` — 2 tests migrated/removed (D-08 site-7's telemetry-based mechanism no longer exists; documented removal note in place) + 1 composition-API test updated to the new shape + 2 new tests (uncertain-vs-inflight icon with paired control; onPendingChange/DOM identity across both states) + `sonner` mock extended with `toast.warning`.
- `src/components/brains/BrainHeaderBadge.tsx` — `pendingLabel` → `pending` (widened type); new in-flight/uncertain icon block; `isConfirmedLive` now also respects the uncertain state.
- `src/components/brains/BrainHeaderBadge.test.tsx` — mock widened to the new shape; 1 pre-existing test corrected (it was asserting total `.animate-pulse` absence while pending, which was only true by the very bug this plan fixes — a mismatched mock silently rendering neither icon; now scoped to the CONFIRMED-LIVE pulse specifically) + 2 new tests (uncertain-vs-inflight icon with paired control; isConfirmedLive false through uncertain).
- `src/pages/Chat.tsx` (`BrainComposerPill`) — same `pending` rename/widening; new in-flight/uncertain icon block.
- `src/pages/Chat.test.tsx` — mock widened; 1 test call site updated to the new shape + 1 new uncertain-vs-inflight test.
- `src/pages/Settings.tsx` (`AgentProfileRows`) — `pendingByProfile` widened to the new per-profile shape; new in-flight/uncertain icon block in the per-row pending span.
- `src/pages/Settings.test.tsx` — mock extended to capture `onPendingChange` per-profile (was previously uncaptured); 1 new uncertain-vs-inflight test with paired control.

## Decisions Made

See frontmatter `key-decisions`. In summary: the D-05 substitution and the raw-`===` readback both implemented exactly as the plan's interfaces section specifies (mirroring `GlobalSwapModal`'s own precedent, not D-08's telemetry-facing sites); `onPendingChange`'s widened shape and the new dedicated in-flight dot on `BrainHeaderBadge` were both required by 109-UI-SPEC.md §C and implemented as specified; the epoch race guard was the one addition not spelled out in the plan's task text, added per Rule 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — missing critical functionality] Race protection for a superseded in-flight dispatch**
- **Found during:** Task 1, while implementing `swapTo`/`restore`
- **Issue:** The popover closes immediately on dispatch (preserved, pre-existing behavior), so nothing prevents the operator from reopening it and starting a SECOND swap before the first dispatch's promise has settled. Without a guard, the first (now-stale) dispatch's eventual resolution — ok OR error — would call `setOutcome` for the SECOND (current) swap's state, potentially flipping a genuinely-confirming newer swap to a stale error.
- **Fix:** Added `epochRef`, bumped synchronously by every `swapTo`/`restore` call; the async continuation checks it is still the current epoch (and that the hook hasn't unmounted) before calling `setOutcome`.
- **Files modified:** `src/hooks/useProfileSwap.ts`
- **Verification:** New test "a stale error resolving after a newer swapTo already confirmed does not overwrite the newer state" — fails without the guard (verified during development by temporarily removing the epoch check).
- **Committed in:** `230db6bc` (Task 1 commit)

**2. [Rule 1 — bug in this plan's own test-infra assumption] `BrainHeaderBadge.test.tsx`'s pre-existing "no pulse while pending" test was passing for the wrong reason**
- **Found during:** Task 3, first run of `BrainHeaderBadge.test.tsx` after adding the new in-flight status-info dot
- **Issue:** Before this plan's mock fix (item 3 below), the test file's `mock-toggle-pending` button passed a raw STRING to `onPendingChange` even though `BrainHeaderBadge.tsx`'s real code already (from this plan's Task 3 edit) expected `{label, kind}`. `pending.kind` on a string is `undefined`, so NEITHER new icon rendered — the pre-existing "does not render the pulse dot while a swap is pending" test (checking `.animate-pulse` was totally absent) passed only because of this type mismatch, not because the feature was correct. Fixing the mock (item 3) would have made this test correctly START FAILING, since the new in-flight `--status-info` pulse legitimately renders while pending.
- **Fix:** Corrected the test's own claim — it now checks specifically for the CONFIRMED-LIVE (`bg-primary`) pulse's absence while pending, which is the property it always meant to guard, rather than "no `.animate-pulse` element at all."
- **Files modified:** `src/components/brains/BrainHeaderBadge.test.tsx`
- **Verification:** Test passes correctly against the real (now type-correct) mock; a control assertion (new tests, item below) proves the in-flight pulse genuinely does render.
- **Committed in:** `13deede2` (Task 3 commit)

**3. [Rule 1 — test infra] Three consumer test files' `BrainPicker` mocks needed widening for the new `onPendingChange` shape**
- **Found during:** Task 3, running `BrainHeaderBadge.test.tsx`/`Chat.test.tsx` after the type change
- **Issue:** Each file's mock of `@/components/brains/BrainPicker` typed and drove `onPendingChange` as a bare `string | null` — a direct consequence of Task 2's own type change to the real component, not a pre-existing defect.
- **Fix:** Widened each mock's type and call sites to `{ label, kind } | null`; `Settings.test.tsx`'s mock additionally needed to actually CAPTURE `onPendingChange` at all (it previously didn't wire it), since `AgentProfileRows` mounts one `BrainPicker` per profile row.
- **Files modified:** `src/components/brains/BrainHeaderBadge.test.tsx`, `src/pages/Chat.test.tsx`, `src/pages/Settings.test.tsx`
- **Verification:** All three files' full suites pass; new paired-control tests added per surface.
- **Committed in:** `13deede2` (Task 3 commit)

**4. [Rule 2 — grep-gate completeness] Two leftover `pendingTarget` comment references reworded**
- **Found during:** Post-Task-3, running the plan's own repo-wide `grep -rn "pendingTarget" src/` verification gate
- **Issue:** `useProfileSwap.ts` (x2) and `Chat.test.tsx` (x1) referenced the retired `pendingTarget` identifier descriptively in comments, not live code — but the plan's own verification gate greps for the literal string repo-wide.
- **Fix:** Reworded each comment to describe the same fact without the literal token, mirroring 109-04-SUMMARY.md's documented precedent for the identical situation.
- **Files modified:** `src/hooks/useProfileSwap.ts`, `src/pages/Chat.test.tsx`
- **Verification:** `grep -rn "pendingTarget" src/` returns zero.
- **Committed in:** `3741ffdc` (separate small commit, after Task 3)

### Plan-Text Corrections

**5. [Test migration, not a bug — decided deliberately per the plan's own `<read_first>` instruction]** `BrainPicker.test.tsx`'s D-08-site-7 describe block ("genuinely-landed toast tolerates a model-id vendor-prefix mismatch") tested the PRE-Plan-06 mechanism: a local effect comparing `activeEngine.model` (telemetry) against the dispatched target. Task 1's D-05 substitution moves the confirm source to `profileOverrides[profileId].model` (the `swap.state` OVERRIDE SLOT), which the server echoes back byte-identical to what was dispatched — the vendor-prefix mismatch class that test guarded against is structurally unreachable at the new confirm site (no telemetry-format resolution step happens there). Removed with the full reasoning recorded in the test file itself (not silently deleted); the equivalent guarantee (a readback naming a genuinely different model does not confirm, paired with a matching-readback control) now lives directly against the real confirm source in `useProfileSwap.test.ts`.

---

**Total deviations:** 2 auto-fixed (Rule 2 race guard, Rule 1 test-infra widening/correction across 3 files) + 1 grep-gate completeness cleanup + 1 deliberate test migration (not a defect)
**Impact on plan:** No scope creep. The race guard and test-infra fixes were both required by this plan's own changes (a genuinely reachable race the new architecture introduces; test mocks the type change itself broke). The test migration was explicitly flagged as a required decision point in the plan's own Task 2 `<read_first>` section.

## Test-Count Delta vs. Baseline

Baseline (measured before this plan started, on this exact tree): **281 test files passed | 17 skipped, 3681 tests passed | 193 todo.**

After this plan: **282 test files passed | 17 skipped (+1 new file), 3699 tests passed | 193 todo (+18 net)** — zero failures, zero regressions. Final per-file counts, measured directly (`npx vitest run <file>`):

| File | Final count | What changed |
|---|---|---|
| `src/hooks/useProfileSwap.test.ts` (new) | 14 | All 14 new (Task 1's full behavioral coverage) |
| `src/components/brains/BrainPicker.test.tsx` | 45 | 2 removed (D-08 site-7 describe block, mechanism retired — replaced with a documentation comment, not a test) + 2 added (uncertain-vs-inflight icon paired control; onPendingChange/DOM identity across both states) + 1 composition-API test updated in place (not a net add) |
| `src/components/brains/BrainHeaderBadge.test.tsx` | 31 | +2 (uncertain-vs-inflight icon paired control; isConfirmedLive false through uncertain) + 1 existing test corrected in place (not a net add) |
| `src/pages/Chat.test.tsx` | 40 | +1 (uncertain-vs-inflight icon paired control) + 1 existing call site updated in place (not a net add) |
| `src/pages/Settings.test.tsx` | 15 | +1 (uncertain-vs-inflight icon paired control, first pending-state coverage this file has ever had) |

`npx tsc --noEmit` exits 0. `npx vitest run` (full suite): 282 test files passed | 17 skipped, 3699 tests passed | 193 todo, zero failures.

## Issues Encountered

Two early attempts at the new Task 3 "uncertain state" tests in `BrainPicker.test.tsx` called `vi.useFakeTimers()` BEFORE `await screen.findByText("Codex CLI")`, which freezes testing-library's own `setTimeout`-based async-query polling and hangs the test indefinitely (the exact failure mode the pre-existing T-109-08 test's own comment already documents and works around). Fixed by reordering to open-and-locate-on-real-timers, THEN switch to fake timers — matching the established pattern in the same file.

## Known Stubs

None — this plan wires only the real dispatch/confirm/toast path (`swap.set` with `profile_id`, the `swap.state` readback) delivered by plans 109-01/109-04. No stub, fixture, or build-time flag was introduced or reintroduced.

## Threat Flags

None. This plan implements T-109-14's mitigation (`confirmed` reachable only from a real `swap.state` readback matching the dispatched target, never the ack alone — proven by a mismatched-vs-matching paired test), T-109-15's mitigation (`accepted` renders as a static warning icon, never a pulsing dot, and announces itself with a toast since the popover has already closed), and T-109-17's mitigation (both the 15s dispatch bound and the 4s confirm bound are real, tested, and every timer is cleared on unmount). No new network endpoint, auth path, or schema change was introduced — this plan is entirely CodePulse-side, reusing the `swap.set`/`swap.state` wire contract plans 109-01/109-04 already established.

## User Setup Required

None — no external service configuration required. This plan is CodePulse-only (no astridr-repo changes); the `profile_overrides` field its readback depends on was delivered by plan 109-01 and, per that plan's own SUMMARY, requires the astridr-agent container to be rebuilt before any live-verify session can observe it live (already flagged for the phase's live-gate plan).

## Next Phase Readiness

- `useProfileSwap` is now the stable, tested, single implementation of the per-profile outcome machine; any future per-profile brain surface should consume it rather than re-deriving swap state.
- `restore()` is built and tested but has no UI trigger anywhere in this codebase yet — a future plan that adds a per-profile restore affordance (e.g., a "restore to default" action in Settings or the picker) can wire directly to it with no hook-side work needed.
- ENGINE-04 remains Pending in REQUIREMENTS.md, consistent with 109-CONTEXT.md's explicit instruction and the precedent 109-04/109-05 already established for ENGINE-03 — this plan is code-complete and unit-tested only; the operator-attended live gate (a later plan in this phase) has not run yet and is what actually satisfies the requirement.
- No blockers for whatever plan comes next in this phase's wave sequence.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: `src/hooks/useProfileSwap.ts`, `src/hooks/useProfileSwap.test.ts`
- FOUND: `src/components/brains/BrainPicker.tsx`, `src/components/brains/BrainPicker.test.tsx`
- FOUND: `src/components/brains/BrainHeaderBadge.tsx`, `src/components/brains/BrainHeaderBadge.test.tsx`
- FOUND: `src/pages/Chat.tsx`, `src/pages/Chat.test.tsx`
- FOUND: `src/pages/Settings.tsx`, `src/pages/Settings.test.tsx`
- FOUND commits: `230db6bc`, `03c5fd51`, `13deede2`, `3741ffdc`
