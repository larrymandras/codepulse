---
phase: 103-brain-swap-control-surface
plan: 04
subsystem: ui
tags: [react, dialog, brain-swap, global-swap, revert, snapshot, sonner]

# Dependency graph
requires:
  - phase: 103-01
    provides: "src/lib/brainsApi.ts (BrainsAdapter/CatalogueEntry/GatewayModelSetCommand contract types, brainsApi seam, BRAINS_STUB_ACTIVE)"
provides:
  - "src/components/brains/GlobalSwapModal.tsx — GlobalSwapModal component: confirm row-list -> in-place result-state transition -> snapshot-backed revert, firing both the live swap.set global override and the per-profile gateway.model.set fan-out"
affects: [103-05, 103-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-axis dispatch from one confirm action — a live WS command (via useCommandDispatch, never stubbed) fired alongside an N-command Promise.allSettled fan-out through the D-16 adapter seam (brainsApi), each axis independently correlatable to command shape via toHaveBeenCalledWith"
    - "In-place Dialog phase transition (confirm -> result) via local component state rather than closing/reopening — avoids the 'toast can't hold N rows of detail' problem D-12 exists to prevent"
    - "A liveDisplay ledger (per-profile 'truth' independent of the in-flight dispatch) so a failed row's 'still on X' always reflects the last successful state, correct even across a swap-then-partial-revert sequence, not just the very first pre-swap snapshot"

key-files:
  created:
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx
  modified: []

key-decisions:
  - "Revert mode-mapping: a snapshot entry's mode drives the exact restore command — pinned -> mode:\"default\" with the snapshot model re-applied, session -> mode:\"session\" with the snapshot model re-applied, inherited -> restore:true/mode:\"default\" (clears the pinned default the fan-out set, model omitted) rather than re-pinning a model that was never pinned in the first place"
  - "Global swap.set is fired via useCommandDispatch (not brainsApi) since it is the live, shipped axis and must never be routed through the D-16 stub seam or receive the STUB indicator; the per-profile fan-out goes exclusively through brainsApi.dispatchSwap per D-16"
  - "dispatch(...) for the two swap.set calls is never passed a successMsg argument (D-14 — an 'ok' ack means accepted, not switched) and is wrapped in .catch(() => {}) since the real AstridrWSContext.sendCommand implementation REJECTS its promise on an error-status ack (confirmed by reading the file) while useCommandDispatch's own status-check branch assumes it resolves — fire-and-forget with a swallow avoids an unhandled rejection either way"
  - "showCloseButton={false} on DialogContent — forces dismissal through the explicit Cancel/Done buttons only, so the toast-with-revert-action always fires on every post-result dismissal path (an Escape/overlay-click bypass would silently skip it)"
  - "BSC-03/BSC-04 intentionally NOT marked complete in REQUIREMENTS.md — this plan ships the modal component only; nothing in the app renders/opens it yet (103-05's BrainPicker is the caller). Matches this project's established per-plan-vs-full-delivery precedent (Plans 103-01/02/03)."

patterns-established:
  - "Per-profile 'truth' ledger (liveDisplay) kept separate from the in-flight result map, so a failed dispatch never contaminates what the next dispatch attempt considers the row's real prior state"

requirements-completed: []  # BSC-03/BSC-04 intentionally NOT marked complete — see Decisions Made below

# Metrics
duration: ~25min
completed: 2026-07-28
---

# Phase 103 Plan 04: GlobalSwapModal Summary

**Built the global-swap ritual as a single Dialog component that transitions in place from an informational confirm row-list into an honest per-profile result, firing both the live `swap.set` global override and a `Promise.allSettled` per-profile `gateway.model.set` fan-out through the D-16 seam, backed by a client-held snapshot (model + mode) that a "Revert global swap" toast action can restore exactly.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-28 (session continuation from Plan 03)
- **Completed:** 2026-07-28
- **Tasks:** 2/2 completed
- **Files modified:** 2 created, 0 modified

## Accomplishments

- `src/components/brains/GlobalSwapModal.tsx` — a `Dialog`-based confirm-to-result ritual with no type-to-confirm input (D-09): the row list itself (`[ProfileName] [CurrentEngine] → [NewEngine]`, `Pin` icon on pinned rows) is the friction, plus computed pinned-default-count and expensive/unknown-tier cost warnings.
- Two-axis dispatch on confirm: the live, shipped `swap.set` global override (via `useCommandDispatch`, never stubbed) fired alongside an N-command `gateway.model.set` fan-out through `brainsApi.dispatchSwap` (D-16 seam), aggregated with `Promise.allSettled` for per-row honesty (D-12) with no all-or-nothing rollback.
- A client-held snapshot captures every profile's prior model AND mode before dispatch (D-11); "Revert global swap" (offered as a `sonner` toast action on dismiss, D-10) restores both — mapping pinned -> re-pin the old model, session -> restore the session override, inherited -> clear the pinned default the fan-out set (never re-pinning something that was never pinned).
- Failed rows always keep displaying the profile's real, unchanged engine — never the attempted target — sourced from a `liveDisplay` ledger that only updates on a successful dispatch, so it stays correct across a swap-then-partial-revert sequence, not just against the very first snapshot.
- 11 tests (exceeds the 8 required), all green; `tsc --noEmit` clean; full suite 2731/2731 passing (baseline 2720 + 11 new), no regression.

## Task Commits

Each task was committed atomically:

1. **Task 1: GlobalSwapModal — confirm, snapshot, fan-out, result, revert** - `ce6d084f` (feat)
2. **Task 2: GlobalSwapModal behavior tests against the partial-failure fixture** - `6e3ccc04` (test)

_No plan-metadata commit issued separately — this SUMMARY + STATE/ROADMAP updates are committed together per the final_commit step below._

## Files Created/Modified

- `src/components/brains/GlobalSwapModal.tsx` — `GlobalSwapModal`, `GlobalSwapProfile`, `GlobalSwapModalProps`, `GlobalSwapProfileMode` (exported types for 103-05's `BrainPicker` to construct props from)
- `src/components/brains/GlobalSwapModal.test.tsx` — 11 tests: 5 confirm-state (row rendering, pinned-count math on 3 different fixtures, cost-tier warning + no-second-surface, no-input), 4 dispatch (exact command shapes on both axes, partial-failure row rendering, target-name-never-on-failed-row, STUB chip), 2 dismiss/revert (toast action label + exact revert command shapes with mode preserved)

## Decisions Made

- **Revert mode-mapping is a three-way branch, not a two-way one**, even though the plan's fixtures/tests only exercise pinned vs inherited: `session`-mode profiles restore via `mode: "session"` with the snapshot model re-applied (the third value `ActiveEngine.mode`/`GlobalSwapProfile.mode` already carries elsewhere in this phase), keeping the component's mode vocabulary consistent with `useActiveEngine`'s `ActiveEngine.mode` type rather than degrading session state to "inherited" for convenience.
- **The live `swap.set` axis is dispatched via `useCommandDispatch`, and the per-profile axis exclusively via `brainsApi.dispatchSwap`** — two different call sites by design, not a shared dispatch function, so the D-16 stub indicator can never leak onto the global axis's outcome (T-103-16 mitigation) and so `grep`-based drift detection stays possible for future plans.
- **`dispatch(...)` calls for `swap.set` are fire-and-forget with `.catch(() => {})`**, discovered necessary by reading `AstridrWSContext.tsx`'s real `sendCommand` implementation: its `onmessage` handler calls `pending.reject(...)` (not `resolve`) when an ack's `status` is `"error"`, so `useCommandDispatch`'s own `if (result.status === "error")` branch is unreachable against the real transport (only reachable against a mock that resolves regardless of status, which is how `BrainControl.test.tsx`'s existing tests exercise it). This is pre-existing codebase behavior, not something this plan introduced or fixed — noting it here because it directly shaped the `.catch()` decision.
- **`DialogContent`'s default close (X) button is disabled** (`showCloseButton={false}`) so every dismissal path funnels through the explicit `Cancel` (pre-dispatch, no toast) or `Done` (post-result, fires the summary+revert toast) handlers — an Escape-key or overlay-click dismissal would otherwise bypass the revert offer entirely.
- **BSC-03/BSC-04 intentionally NOT marked complete in REQUIREMENTS.md.** This plan ships the modal component in isolation — nothing in the running app renders or opens `GlobalSwapModal` yet (103-05's `BrainPicker` is the caller that wires scope-selector "All profiles" + an expensive/unknown target into this component). Matches this project's established precedent (Plans 103-01/02/03's own BSC-02/BSC-05/BSC-01 deferrals) of deferring requirement completion to full end-to-end delivery, not per-plan code-completion. No `gsd-sdk requirements.mark-complete` call was made.
- **`STATE.md`/`ROADMAP.md` updated by hand, not via `gsd-sdk state.*`/`roadmap.update-plan-progress`** — per this project's own extensively documented anti-clobber workaround (see `STATE.md`'s HTML comment and the CLAUDE.md LESSONS entry on `gsd-sdk` state verbs miscounting/clobbering), consistent with every prior Phase-103 plan.

## Deviations from Plan

None — plan executed exactly as written. The revert mode-mapping design (pinned/session/inherited three-way branch) and the `dispatch().catch(() => {})` wrapping are both implementation details within the plan's own `<action>` text ("Fire the live global `swap.set`... Do NOT pass a `successMsg`...", "a per-profile fan-out restoring each snapshot entry's model with its snapshot mode preserved"), not deviations from it.

## Issues Encountered

None. Both tasks' automated verification passed on the first attempt (grep gates, `tsc --noEmit`, `npx vitest run`). No auth gates, no checkpoints in this plan.

**Shared-checkout note:** per the session's explicit warning, another Claude session was concurrently active on unrelated Phase-187 KnowledgeGraph work in this same checkout. Verified before and after every commit in this plan (`git branch --show-current` = `master`, `git diff --cached --name-only` and `git show --stat HEAD` both confirmed to contain only this plan's own two files) — no cross-contamination occurred. The other session's `24b9c1ad fix(187-05): ...` commit predates this plan's first commit and was not touched.

## Deferred / Out of Scope (unchanged from plan)

- Wiring `GlobalSwapModal` into an actual page/picker — 103-05 (`BrainPicker`)'s job, which constructs `GlobalSwapProfile[]` from `useActiveEngine()`/`useProfileConfigs()` and opens this modal when scope is "All profiles".
- Live per-profile BSC-05 verification — still gated on Ástríðr Phase 184.1, tracked in `astridr-repo`, not this phase.
- Live global-axis BSC-05 verification against the running stack — deferred to 103-08 (Wave 5, blocking checkpoint), per `103-CONTEXT.md`'s `<blocker_reframing>`.

## Next Steps

Wave 3 (103-05, `BrainPicker`) composes `BrainPickerRow` (103-03) for individual-profile swaps and `GlobalSwapModal` (this plan) for the "All profiles" scope branch, plus the `toggle-group.tsx` scope selector. Wave 4 (103-06/103-07) wires the header badge, composer pill, and Settings row. Wave 5 (103-08) closes the live global-axis BSC-05 gate and adds the Playwright stub round trip.

## Self-Check: PASSED

- FOUND: `src/components/brains/GlobalSwapModal.tsx`
- FOUND: `src/components/brains/GlobalSwapModal.test.tsx`
- FOUND commit `ce6d084f` in `git log --oneline --all`
- FOUND commit `6e3ccc04` in `git log --oneline --all`
