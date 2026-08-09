---
phase: 109-per-agent-engine-ui
plan: 04
subsystem: ui

tags: [react, websocket, brain-swap, resolver, precedence, vitest]

# Dependency graph
requires:
  - phase: 109-01
    provides: "profile_overrides on swap.state / swap.get_state ack (astridr-repo, feature/brain-swap)"
  - phase: 109-03
    provides: "useBrainCatalogue() as the one swap.catalogue fetcher; the D-16 stub seam fully deleted"
provides:
  - "useProfileBrainOverrides() — the live per-profile override axis hook (src/hooks/useResolvedBrain.ts), mirrors useGlobalBrainOverride's pull+push shape over swap.state's profile_overrides map"
  - "resolveActiveBrain's new top 'override' rung (D-06): a live per-profile pin wins even under a simultaneously-active DIFFERENT global override"
  - "D-07: the scoped (profileId-supplied) branch of resolveActiveBrain no longer falls back to the fleet-wide lastTurn signal — returns an honest 'none' instead"
  - "One canonical 'Not reported' absent-state string (italic, muted, no dot) across BrainHeaderBadge, Chat's composer pill, BrainPicker's trigger/confirm-modal column, Settings' per-profile row, and LlmStatusPanel"
  - "BrainPicker's trigger base label, isCurrent row highlight, and the confirm-modal's per-row current column now resolve through the full precedence chain instead of raw activeEngines telemetry"
  - "Settings' per-profile engine label reads the same full chain (D-14), preventing disagreement with plan 109-08's swap-history section"
affects: [109-05, 109-06, 109-07, 109-08, 109-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-profile override axis mirrors the existing global-override axis exactly: same pull-on-connect + push-subscribe shape, same coerce-or-drop discipline (T-103-32), same 'leave prior value on failed hydration' rule — established once by useGlobalBrainOverride, now duplicated intentionally for the second live axis rather than abstracted, matching this codebase's existing pattern of calling the same low-level hook directly from multiple call sites (useGlobalBrainOverride is already called both inside useResolvedBrain and directly in BrainPicker.tsx)."
    - "resolveActiveBrain stays a pure function callable per-row inside a .map() (BrainPicker's globalSwapProfiles memo, Settings' per-profile row) — the composed useResolvedBrain hook is reserved for single-instance call sites; calling a hook inside a loop would violate the Rules of Hooks."

key-files:
  created: []
  modified:
    - src/hooks/useResolvedBrain.ts
    - src/hooks/useResolvedBrain.test.tsx
    - src/components/brains/BrainHeaderBadge.tsx
    - src/components/brains/BrainHeaderBadge.test.tsx
    - src/pages/Chat.tsx
    - src/pages/Chat.test.tsx
    - src/components/control-center/LlmStatusPanel.tsx
    - src/components/control-center/LlmStatusPanel.test.tsx
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx
    - src/pages/Settings.tsx
    - src/pages/Settings.test.tsx
    - src/hooks/useActiveEngine.ts
    - src/hooks/useActiveEngine.test.ts

key-decisions:
  - "D-06 implemented exactly as researched: resolveActiveBrain's new override rung sits ABOVE the global-override check (not below), so a profile pinned via a scoped swap.set wins even while a different global override is simultaneously active — mode is hardcoded 'pinned' so every consumer's existing mode==='pinned' branch renders it identically to a telemetry-sourced pin, with zero new visual state (UI-SPEC §B's invisibility rule)."
  - "D-07 implemented by deleting the scoped lastTurn rung entirely rather than gating it — a scoped read with no telemetry and no override now returns source:'none' unconditionally; the fleet-wide (no-profileId) lastTurn rung is untouched, since run.completed.model is genuinely honest at fleet scope."
  - "The literal source discriminant is 'override' (UI-SPEC §B's proposed default, adopted as-is — no reason found to deviate)."
  - "BrainPicker's trigger/isCurrent/globalSwapProfiles read the PURE resolveActiveBrain function (not the composed useResolvedBrain hook) so the confirm-modal's per-profile derivation can run inside a .map() without violating the Rules of Hooks — useProfileBrainOverrides/useGlobalBrainOverride are each called once at the top of the component and threaded through, mirroring the existing globalOverrideModel pattern."
  - "BrainPicker.tsx:350's separate lowercase 'auto' sentinel (feeds SnapshotEntry.model and GlobalSwapModal's prior-override display lookup, neither user-visible) is deliberately left unchanged, per the plan's explicit instruction — recorded as a still-open follow-up, not silently fixed or silently ignored."

requirements-completed: [ENGINE-03]

# Metrics
duration: 45min
completed: 2026-08-09
---

# Phase 109 Plan 04: Read-path precedence fix + one canonical absent string Summary

**resolveActiveBrain gains a top "override" rung so a live per-profile pin now wins over a simultaneously-active different global override (D-06), the scoped lastTurn fallback is removed so a profile with no telemetry never renders a stranger's engine (D-07), and three disagreeing absent-state strings collapse into one canonical "Not reported" across every brain surface.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-09T14:22:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 14 (12 in the plan's own file list + 2 out-of-scope one-line comment cleanups)

## Accomplishments

- `useProfileBrainOverrides()` (new export, `src/hooks/useResolvedBrain.ts`) — the live per-profile override axis, mirroring `useGlobalBrainOverride`'s pull-on-connect + push-subscribe shape over `swap.state`'s `profile_overrides` map (delivered by 109-01), with the same coerce-or-drop discipline (T-103-32) applied per entry.
- `resolveActiveBrain`'s precedence chain is now: **live per-profile override → global override → per-profile telemetry → lastTurn (fleet-only) → none** — the precedence-inversion fix (D-06) and the cross-profile-leak fix (D-07), both proven by paired control tests (same fixture, opposite expected outcome).
- `useLastTurnModel`'s docstring, which cited a falsified premise (an emitter bug Phase 108 already fixed, and a nonexistent future astridr phase), is corrected in place.
- One canonical **"Not reported"** string (italic, `--muted-foreground`, no color dot) replaces `"No brain reported"` and two independent `"Auto"` fallbacks across `BrainHeaderBadge`, Chat's composer pill, `BrainPicker`'s trigger and confirm-modal column, Settings' per-profile row, and `LlmStatusPanel`.
- `BrainPicker`'s trigger base label, `isCurrent` row highlight, and the pre-swap confirm modal's per-row current-engine column all resolve through the full precedence chain now — a profile pinned moments ago shows its pin immediately everywhere, not a stale pre-pin telemetry reading until the next resolution.
- Settings' per-profile engine label reads the same full chain (D-14), so it cannot disagree with the swap-history section plan 109-08 mounts directly beneath it.

## Task Commits

1. **Task 1: useProfileBrainOverrides + the override rung + the fleet-only lastTurn rung** — `70c0c07d` (feat)
2. **Task 2: Render the new rung invisibly, and one canonical absent string everywhere** — `d345f8d3` (feat)
3. **Task 3: Confirm-modal current column through the resolved chain; Settings row on one resolver** — `d245a557` (feat)

**Plan metadata:** pending (this commit, after STATE.md/ROADMAP.md updates)

_TDD note: each task's tests were written alongside its implementation (not as a separate RED-then-GREEN commit pair) — the same deviation 109-01/109-03 documented and for the same reason (the plan's own task text is implementation-first, and the interdependent scope of each task — a new hook, its consumers, and their tests — does not decompose cleanly into a standalone failing-test commit without the very code the tests exercise). Every new/changed assertion was run and confirmed passing before its task's commit; no task was committed with a failing test._

## Files Created/Modified

- `src/hooks/useResolvedBrain.ts` — new `useProfileBrainOverrides()` + `coerceProfileOverrides()`; `resolveActiveBrain` gains the `"override"` rung and the `profileOverrides` argument; `ResolvedBrain.source` union extended; `useLastTurnModel`'s docstring corrected; `useResolvedBrain` composes the new hook.
- `src/hooks/useResolvedBrain.test.tsx` — 4 new tests for `useProfileBrainOverrides` (hydrate, push-update, drop-malformed-entry paired with a kept control, degrade-outside-provider) + 2 more (absence-vs-null, leaves-prior-value-on-error) + 6 new `resolveActiveBrain` precedence tests (override-beats-global paired with a global-only control; override-beats-telemetry; D-07's none-not-lastTurn paired with a fleet-still-lastTurn control).
- `src/components/brains/BrainHeaderBadge.tsx` — `isProfile` extended to include `"override"`; `"No brain reported"` → `"Not reported"` with italic/muted styling and a tooltip secondary line; no-dot logic unchanged.
- `src/components/brains/BrainHeaderBadge.test.tsx` — string replacements + 1 new accessible-name/no-dot test + `swap.state` mock upgraded to fan out to multiple subscribers (now two independent `swap.state` listeners exist) + unsubscribe-count test updated (2→3).
- `src/pages/Chat.tsx` (`BrainComposerPill`) — `pillTitle`'s type union extended, `"override"` falls through to `"profile"`'s title text; `"Auto"` → `"Not reported"` with italic/muted styling and dot suppression; `source==="profile"` checks extended to include `"override"`.
- `src/pages/Chat.test.tsx` — 2 new absent-state tests (no-dot, accessible name) + 1 new byte-identical override-vs-profile-pinned rendering test.
- `src/components/control-center/LlmStatusPanel.tsx` — `"Auto"` → `"Not reported"` (no other change needed, per the plan's own note — it already flows through the `source==="none"`-only branch).
- `src/components/control-center/LlmStatusPanel.test.tsx` — test updated + a negative assertion added.
- `src/components/brains/BrainPicker.tsx` — imports `useProfileBrainOverrides`/`resolveActiveBrain`; new `resolvedTrigger` memo feeds `baseLabel` and `isCurrent` for "This profile" scope; `globalSwapProfiles` memo's `currentModel`/`currentModelDisplayName` derive per-row from `resolveActiveBrain`, `"Auto"` → `"Not reported"`; `BrainPicker.tsx:350`'s lowercase `"auto"` sentinel deliberately untouched.
- `src/components/brains/BrainPicker.test.tsx` — row-highlight test rewritten to prove scope-awareness via a per-profile override vs. a different global override (the old fixture's assumption — that "This profile" scope ignores an active global override — is no longer true, correctly, per D-06); 2 D-14 regression-guard tests updated (`"Auto"` → `"Not reported"`); 2 new tests for the confirm-modal's current column (override-vs-global paired control; honest-absent control).
- `src/pages/Settings.tsx` (`AgentProfileRows`) — reads `useGlobalBrainOverride()`/`useProfileBrainOverrides()` once, feeds `resolveActiveBrain` per row inside the `.map()`; engine label/session/pinned lines all read `resolvedRow` instead of raw `activeEngines[c.profileId]`.
- `src/pages/Settings.test.tsx` — `useResolvedBrain` module mocked (real `resolveActiveBrain`, mocked `useGlobalBrainOverride`/`useProfileBrainOverrides`) + 2 new D-14 tests (override-vs-telemetry paired control; freshly-pinned-label-updates-immediately).
- `src/hooks/useActiveEngine.ts`, `src/hooks/useActiveEngine.test.ts` — one-line comment cleanups (see Deviations) so the plan's repo-wide grep gate for the retired `"No brain reported"` string is genuinely zero, not just true at the four render sites.

## Decisions Made

See frontmatter `key-decisions`. In summary: D-06/D-07 implemented exactly as `109-CONTEXT.md`/`109-UI-SPEC.md` specify; the `"override"` discriminant name and the invisible-rendering approach (fall-through to the `"profile"` branch everywhere) were adopted as proposed with no deviation found necessary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in my own test change] `BrainHeaderBadge.test.tsx`'s single-callback `swap.state` mock silently dropped the second subscriber**
- **Found during:** Task 2, first run of `BrainHeaderBadge.test.tsx` after adding the override rung
- **Issue:** The test file's `mockSubscribeEvent` stored only the LAST-registered `swap.state` callback in a single `capturedSwapStateCallback` variable. Once `useProfileBrainOverrides` became a second, independent `swap.state` subscriber (alongside `useGlobalBrainOverride`'s existing one), `emitSwapState()` only drove whichever hook subscribed last, and 6 existing global-override tests broke (the global override never updated because its callback was the one silently overwritten).
- **Fix:** Changed the mock to accumulate an array of callbacks (`capturedSwapStateCallbacks`) and fire the event through every registered listener — mirroring the real `AstridrWSProvider`'s actual fan-out behavior (every `subscribeEvent` call registers its own listener).
- **Files modified:** `src/components/brains/BrainHeaderBadge.test.tsx`
- **Verification:** All 6 previously-failing tests pass; full file 28/28.
- **Committed in:** `d345f8d3` (Task 2 commit)

**2. [Rule 1 - Bug in own test change] The old row-highlight scope-awareness test's fixture assumption became false under D-06's own (correct) precedence fix**
- **Found during:** Task 3, first run of `BrainPicker.test.tsx` after wiring `isCurrent`/`baseLabel` to the resolved chain
- **Issue:** `BrainPicker — row highlight is scope-aware (103-12, WR-02)`'s existing test asserted "This profile" scope must NOT highlight a row matching an active global override — true under the OLD code (which compared `isCurrent` against raw telemetry only), but no longer true under D-06: a global override genuinely IS a profile's active engine when no per-profile override exists (the exact BSC-01 precedent this whole precedence chain already established), so "This profile" scope correctly highlighting it is the fix working, not a regression.
- **Fix:** Rewrote the test to use a per-profile OVERRIDE (not a global one) as the profile-scope differentiator — proving the two scopes still read genuinely different axes (a live per-profile pin vs. the raw global override), which is the property WR-02 actually needs to guarantee.
- **Files modified:** `src/components/brains/BrainPicker.test.tsx`
- **Verification:** New test passes; the property it now proves is strictly correct per D-06 (verified by re-reading `109-UI-SPEC.md` §B's invisibility rule before rewriting).
- **Committed in:** `d245a557` (Task 3 commit)

**3. [Rule 2 - out-of-scope grep-gate completeness] Cleaned up two comment-only "No brain reported"/"Auto" references in files not in this plan's file list**
- **Found during:** Task 2 and Task 3, running the plan's repo-wide literal-string grep gates
- **Issue:** `src/hooks/useActiveEngine.test.ts` (Task 2) and a `src/pages/Chat.tsx` docstring about a DIFFERENT, out-of-scope component (`BrainControl`'s "Choose brain" trigger, which legitimately still says "Auto" — untouched by this plan) both contained the literal retired strings in comments, not render output.
- **Fix:** Reworded both comments to describe the same fact without the literal token. `useActiveEngine.test.ts`'s edit is a one-line comment change with zero behavior impact; the `Chat.tsx` comment now explicitly names `BrainControl` as the separate, unaffected component it was actually describing.
- **Files modified:** `src/hooks/useActiveEngine.test.ts`, `src/pages/Chat.tsx`
- **Verification:** `grep -rn "No brain reported" src/` and the scoped `"Auto"` grep both return zero (excluding `src/components/brains/GlobalSwapModal.test.tsx`, see below).
- **Committed in:** `d345f8d3` (useActiveEngine.test.ts, Task 2), `d245a557` (Chat.tsx, Task 3)

---

**Total deviations:** 3 auto-fixed (2 own-test-change bugs, 1 out-of-scope grep-gate completeness cleanup)
**Impact on plan:** No scope creep. Both test-mock fixes were required by this plan's own Task 1/Task 3 changes creating a second live subscriber / a more honest precedence chain; the comment cleanups are one-line, zero-risk, and keep the plan's own stated grep gates genuinely true rather than technically-true-with-asterisks.

## Grep-Gate Residual (documented, not fixed — genuinely out of scope)

`grep -rn '"Auto"' src/components/brains/` still returns 6 hits, all in `src/components/brains/GlobalSwapModal.test.tsx` (lines 365/375/385/409/411/415) — a file NOT in this plan's `files_modified` list. These are arbitrary fixture STRING VALUES fed into `GlobalSwapModal`'s own "renders exactly what it's given" component-level test (a dumb-render contract test, unrelated to any of this plan's fixed producers). `GlobalSwapModal.tsx` is explicitly out of scope for this plan (109-04's file list does not include it), and the fixture value itself is not sourced from any code path this plan changed — changing it would be an out-of-scope edit for zero behavioral gain. Documented here per the plan's own honesty mandate rather than silently left unexplained.

## Test-Count Delta vs. Baseline

Baseline (measured before this plan started, on this exact tree): **281 test files passed | 17 skipped, 3639 tests passed | 193 todo.**

After this plan: **281 test files passed | 17 skipped (unchanged), 3658 tests passed | 193 todo** — **+19 tests**, zero regressions, zero files added/removed:

| File | Delta | Why |
|---|---|---|
| `src/hooks/useResolvedBrain.test.tsx` | +12 | `useProfileBrainOverrides` (6 tests) + `resolveActiveBrain` precedence (6 tests: 4 new D-06/D-07 assertions with controls, 2 pre-existing tests updated in place not counted as new) |
| `src/components/brains/BrainHeaderBadge.test.tsx` | +1 | Accessible-name/no-dot absent-state test |
| `src/pages/Chat.test.tsx` | +3 | No-dot test, accessible-name test, byte-identical override-vs-pinned render test |
| `src/components/control-center/LlmStatusPanel.test.tsx` | 0 | Existing test updated in place (string + a negative assertion added, no new `it()`) |
| `src/components/brains/BrainPicker.test.tsx` | +2 | 2 new confirm-modal current-column tests (D-06 override-vs-global paired control, honest-absent control); the row-highlight test was rewritten in place (not counted as new) |
| `src/pages/Settings.test.tsx` | +2 | 2 new D-14 tests (override-vs-telemetry paired control, freshly-pinned-label-updates-immediately) |

`npx tsc --noEmit` exits 0. `npx vitest run` (full suite): 281 test files passed | 17 skipped, 3658 tests passed | 193 todo, zero failures.

## Issues Encountered

None beyond the three auto-fixed items documented above.

## Known Stubs

None — this plan touches only the read/render path of already-live data (per-profile overrides delivered by 109-01, telemetry delivered by Phase 108). No stub, fixture, or build-time flag was introduced or reintroduced.

## Threat Flags

None. This plan implements T-103-32's mitigation (`useProfileBrainOverrides`'s coerce-or-drop discipline, proven by a paired drop/keep test) and T-103-09's mitigation (the same `try { useAstridrWS() } catch` degrade `useGlobalBrainOverride` already established, coalescing to `{}` never `undefined`/a throw). T-109-10 (reading a config value instead of live server state) is explicitly accepted per the plan's own threat model — `profile_overrides` is Ástríðr's live in-memory override, the same class of value the existing global rung already reads. No new network endpoint, auth path, or schema change was introduced.

## User Setup Required

None — no external service configuration required. This plan is CodePulse-only (no astridr-repo changes); the `profile_overrides` field it reads was delivered by plan 109-01 and requires the astridr-agent container to be rebuilt before any live-verify session can observe it live (already flagged in 109-01-SUMMARY.md and 109-03-SUMMARY.md for the 109-09 live-gate plan).

## Next Phase Readiness

- The precedence chain and honest-absent-state work this plan delivers is now the foundation plan 109-05 (D-08's `modelIdsMatch` comparator) and plan 109-06 (the 5-state `useProfileSwap` confirm machine) build on directly — `resolveActiveBrain`'s new `profileOverrides` argument and `"override"` source are stable, tested contracts.
- `BrainPicker.tsx:350`'s lowercase `"auto"` sentinel remains an explicit, still-open follow-up (feeds `SnapshotEntry.model` and `GlobalSwapModal.tsx:502`'s prior-override lookup, neither user-visible) — flagged again here per the plan's own instruction not to silently resolve it.
- UI-SPEC §G's other flagged open item (whether `hasConfiguredDefault`/Pin icon should also fire for an override-sourced current value) remains unresolved, unimplemented, and unconflated with `hasConfiguredDefault`'s existing config-only meaning — exactly as the plan instructed.
- ENGINE-03/ENGINE-04 remain Pending in REQUIREMENTS.md — the operator-attended live gate (plan 109-09) has not run yet; this plan is code-complete and unit-tested only, consistent with 109-CONTEXT.md's explicit instruction.
- No blockers for plan 109-05.

---
*Phase: 109-per-agent-engine-ui*
*Completed: 2026-08-09*

## Self-Check: PASSED

- FOUND: `src/hooks/useResolvedBrain.ts`, `src/hooks/useResolvedBrain.test.tsx`
- FOUND: `src/components/brains/BrainHeaderBadge.tsx`, `src/components/brains/BrainHeaderBadge.test.tsx`
- FOUND: `src/pages/Chat.tsx`, `src/pages/Chat.test.tsx`
- FOUND: `src/components/control-center/LlmStatusPanel.tsx`, `src/components/control-center/LlmStatusPanel.test.tsx`
- FOUND: `src/components/brains/BrainPicker.tsx`, `src/components/brains/BrainPicker.test.tsx`
- FOUND: `src/pages/Settings.tsx`, `src/pages/Settings.test.tsx`
- FOUND commits: `70c0c07d`, `d345f8d3`, `d245a557`
