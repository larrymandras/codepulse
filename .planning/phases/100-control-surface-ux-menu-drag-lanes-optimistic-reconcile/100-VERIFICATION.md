---
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
verified: 2026-07-24T14:00:00Z
status: human_needed
score: 9/9 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Live Forge daemon drag round-trip: drag an active-global skill onto Cold (archive), an active-global skill onto Project (pick a workspace in the dialog), and a cold skill onto Global (restore)."
    expected: "Each drop enqueues the correct lifecycle command against a real daemon, paints the pending overlay immediately, and reconciles honestly to 'done' on success. Forcing a failure/expiry (e.g. disconnect the daemon mid-command) clears the pending overlay and surfaces the real refusal/expiry toast — never a false success."
    why_human: "Requires a live Forge daemon + real forgeCommands rows; the code path is fully unit/integration-tested with mocked enqueueLifecycle, but end-to-end daemon timing/reconciliation has not been exercised live. This is the same category of outstanding manual check documented for Phase 98/99 (98-HUMAN-UAT.md) and explicitly flagged as outstanding in 100-04-PLAN.md's <verification> section and ROADMAP.md line 480 ('manual live-Forge-daemon UAT outstanding')."
  - test: "Drag a shadowed-merged skill (dormant copy + active copy elsewhere) out of the Cold Storage view and drop it back onto the Cold Storage rail entry."
    expected: "No mutation fires (same-scope no-op) — must NOT archive the skill's live active copy."
    why_human: "This is the exact CR-02 regression scenario. It is covered by unit tests at every layer (SkillRow.onDragStart lane threading, SkillControlSurfaceProvider draggingLane propagation, ScopeRail cold-lane no-highlight, resolveScopeDrop lane='cold' matrix cell) but has not been exercised as a live end-to-end drag gesture in a running browser against real shadowed-origin data."
---

# Phase 100: Control-Surface UX (Menu, Drag Lanes, Optimistic Reconcile) Verification Report

**Phase Goal:** The Skills page becomes a complete, efficient control surface — every row exposes the right actions for its scope, drag-and-drop across lanes fires the right mutation, in-flight actions show honest optimistic state, and Cold Storage restore never sends the operator to a terminal.
**Verified:** 2026-07-24T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every skill row exposes an overflow (⋯) menu showing only the actions valid for its current scope, each wired to its mutation/launch (ROADMAP SC1 / UX-01) | ✓ VERIFIED | `SkillLifecycleMenu.tsx:141-142` derives scope state via `resolveLifecycleActions(skill, lane)`; branches render Restore/Delete (dormant), disabled Archive/Move+tooltip (multiScope), or Archive/Move (active) exactly per the shared predicate. Rendered unconditionally by `SkillRow.tsx:155` in every list surface (AllSkillsOverview, SkillsInCategory, ColdStorageView) — 100-05's audit found no gap, only missing test coverage which was added (`SkillsInCategory.test.tsx` created, `AllSkillsOverview.test.tsx` extended). |
| 2 | Global/Project/Cold Storage lanes accept drag targets; dragging fires the corresponding move/archive/restore command (ROADMAP SC2 / UX-02) | ✓ VERIFIED | `ScopeRail.tsx` renders 3 fixed always-visible entries; `Skills.tsx:174-219` `handleDropOnScope` dispatches through `resolveScopeDrop(skill, scope, draggingLane)` → `enqueueLifecycle` for archive/restore/move, opens `MoveToProjectDialog` for Project. Integration tests in `Skills.test.tsx` "Scope drag matrix" cover all 6 cases (enqueue×3, dialog, 2×invalid-noop). |
| 3 | A mutating action shows an optimistic/pending row state that reconciles to success, failure, or expiry (ROADMAP SC3 / UX-03) | ✓ VERIFIED | `usePendingLifecycleMoves.ts` — `beginPending` paints before await; reconcile `useEffect` (lines 81-104) correlates strictly by `commandId`, clears silently on `done`, clears+toasts on `failed`/`expired` (real refusal / literal expiry copy), leaves `queued`/`executing` alone. `SkillRow.tsx:94-103` renders the pending overlay (opacity-70 + pulsing `--status-info` bar), visually distinct from dormant (opacity-50) and active (`--primary`). |
| 4 | The Cold Storage view offers in-app Restore — the `/manage-skills` terminal dead-end is gone (ROADMAP SC4 / UX-04) | ✓ VERIFIED | `ColdStorageView.tsx` renders `SkillRow` with `lane="cold"` → `SkillLifecycleMenu`'s dormant branch offers a real `handleRestore` wired to `enqueueLifecycle`. `grep -rn "manage-skills" src/ --include=*.ts --include=*.tsx` (excluding tests) returns zero matches; the only surviving reference is the preserved negative assertion in `ColdStorageView.test.tsx:63`. |
| 5 | The ⋯ menu and the drag path derive their allowed actions from ONE shared function — cannot diverge (D-02, 100-01 must-have) | ✓ VERIFIED | `resolveLifecycleActions`/`resolveScopeDrop` in `src/lib/skills.ts` are the single source both `SkillLifecycleMenu.tsx` and `Skills.tsx`/`ScopeRail.tsx` consume. Exhaustive fixture-parity tests in `skills.test.ts` (activeGlobal/activeProject/dormant/multiScope/shadowedMerged/lane="cold") lock the guarantee in. |
| 6 | The drag matrix can never produce a delete action; no delete drop target exists (D-04, 100-01 must-have) | ✓ VERIFIED | `ScopeDropResult`'s `enqueue` variant's `action` union is `"archive" \| "restore" \| "move"` only (`skills.ts:79-83`) — no `"delete"` member exists in the type, so it is a compile-time guarantee, not just a runtime one. `ScopeRail`'s `SCOPE_ENTRIES` has exactly 3 entries (global/project/cold), no trash target. |
| 7 | CR-01 (stale `clearPending` deletes by skillName only) is fixed — a second in-flight drag's optimistic state can never be wiped by a stale rejection | ✓ VERIFIED | `clearPending(skillName, commandId?)` in `usePendingLifecycleMoves.ts:63-76` is match-gated: returns early if `commandId !== undefined && entry.commandId !== commandId`. `Skills.tsx:213-218`'s `.catch()` passes the locally-captured `commandId`. New regression tests in `usePendingLifecycleMoves.test.ts` (`5f688014`) cover both the stale-no-op and matching-clear cases — both pass. |
| 8 | CR-02 (drag origin lane never threaded — shadowed Cold Storage rows could resolve against the wrong branch and silently archive the live copy) is fixed | ✓ VERIFIED | `SkillRow.onDragStart` calls `setDraggingSkill(skill, lane ?? "active")` (`SkillRow.tsx:91`); `SkillControlSurfaceProvider` exposes `draggingLane`; `ScopeRail.tsx:61` and `Skills.tsx:185-189` both pass `draggingLane` into `resolveScopeDrop`. New regression tests cover: SkillRow threading `lane="cold"` through dragStart, the context defaulting/propagating the lane, and a ScopeRail test asserting a shadowed skill dragged with `draggingLane="cold"` shows NO valid-drop highlight over its own Cold Storage entry (the exact CR-02 scenario) — all pass. |
| 9 | Manual live-Forge-daemon drag verification (archive/move/restore round-trip + honest rollback on forced failure/expiry) | ? UNCERTAIN | Explicitly documented as outstanding in `100-04-PLAN.md`'s `<verification>` section and `ROADMAP.md` line 480 ("manual live-Forge-daemon UAT outstanding"). Same category as Phase 98's `98-HUMAN-UAT.md` precedent — code path is fully unit/integration tested with mocked `enqueueLifecycle`, but true end-to-end daemon timing has not been exercised live. |

**Score:** 8/9 truths code-verified; 1 requires human/live-daemon confirmation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/skills.ts` | `resolveLifecycleActions` + `resolveScopeDrop` pure helpers, lane-aware | ✓ VERIFIED | Both exported, lane param threaded, exhaustive matrix (noop/reject/dialog/enqueue), `enqueue.action` type excludes `"delete"` |
| `src/lib/skills.test.ts` | 5-fixture parity + drag-matrix cell tests | ✓ VERIFIED | `resolveLifecycleActions`/`resolveScopeDrop` describe blocks cover all named fixtures + lane="cold" override |
| `src/components/skills/SkillLifecycleMenu.tsx` | Consumes `resolveLifecycleActions` instead of inline block | ✓ VERIFIED | Line 142: `resolveLifecycleActions(skill, lane)` |
| `src/hooks/usePendingLifecycleMoves.ts` | commandId-correlated pending map + status-aware reconcile + provider/context | ✓ VERIFIED | `clearPending` match-gated by commandId; reconcile effect uses `.find((c) => c.commandId === move.commandId)`; `SkillControlSurfaceProvider` + `useDraggingSkill`/`usePendingMove` exported |
| `src/hooks/usePendingLifecycleMoves.test.ts` | Reconcile + LAYER-1 catch + CR-01/CR-02 regression coverage | ✓ VERIFIED | Includes new stale-vs-matching commandId tests and lane-threading provider test |
| `src/components/skills/ScopeRail.tsx` | 3 always-visible drop targets, valid/invalid/idle states, lane-aware | ✓ VERIFIED | `SCOPE_ENTRIES` fixed 3-entry; `resolveScopeDrop(draggingSkill, scope, draggingLane)` |
| `src/components/skills/ScopeRail.test.tsx` | Drop-state + hint + CR-02 lane regression coverage | ✓ VERIFIED | Includes the shadowed/cold-lane no-highlight regression test |
| `src/pages/Skills.tsx` | ScopeRail mount, dropTargetScope state, handleDropOnScope dispatch, provider wrap | ✓ VERIFIED | All present; `dropTargetScope` independent of category `dropTarget`; wrapped in `SkillControlSurfaceProvider` (default export) |
| `src/components/skills/MoveToProjectDialog.tsx` | `onMoved` widened to carry `commandId` | ✓ VERIFIED | `onMoved?: (commandId: string) => void`; called post-await at line 93 |
| `src/pages/__tests__/Skills.test.tsx` | Integration drop tests (enqueue/dialog/invalid no-op) | ✓ VERIFIED | 6 cases in "Scope drag matrix (Plan 100-04)" describe block, all passing |
| `src/components/skills/SkillRow.tsx` | Pending overlay + dragging-skill/lane reporting | ✓ VERIFIED | opacity-70 + `--status-info` pulsing bar; `setDraggingSkill(skill, lane ?? "active")` on dragStart |
| `src/components/skills/ColdStorageView.test.tsx` | Preserved no-`/manage-skills` assertion | ✓ VERIFIED | Assertion present and passing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SkillLifecycleMenu.tsx` | `src/lib/skills.ts` | `resolveLifecycleActions` import | ✓ WIRED | Imported and called at line 142 |
| `ScopeRail.tsx` | `src/lib/skills.ts` | `resolveScopeDrop` | ✓ WIRED | Imported, called with `draggingLane` at line 61 |
| `ScopeRail.tsx` | `usePendingLifecycleMoves.ts` | `useDraggingSkill` | ✓ WIRED | Line 47 |
| `Skills.tsx` | `ScopeRail.tsx` | Rendered below Categories | ✓ WIRED | Line 396-400 |
| `Skills.tsx` | `convex/forge.ts` | `enqueueLifecycle` mutation | ✓ WIRED | Line 205-218, real Convex mutation call |
| `Skills.tsx` | `src/lib/skills.ts` | `resolveScopeDrop` dispatch | ✓ WIRED | Line 185-189, lane-aware |
| `SkillRow.tsx` | `usePendingLifecycleMoves.ts` | `usePendingMove`/`useDraggingSkill` | ✓ WIRED | Lines 5, 57-58 |
| `MoveToProjectDialog.tsx` (onMoved) | `Skills.tsx` (beginPending) | commandId handoff | ✓ WIRED | `Skills.tsx:502-513` calls `beginPending` inside `onMoved` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|-------------|--------|----------|
| UX-01 | 100-01, 100-05 | Every skill row exposes scope-gated ⋯ menu (Move/Restore/Archive/Delete/Run) | ✓ SATISFIED | `SkillLifecycleMenu.tsx` + 100-05 completeness audit (no code gap found, test coverage extended) |
| UX-02 | 100-01, 100-03, 100-04 | Global/Project/Cold drag targets fire corresponding mutation | ✓ SATISFIED | `ScopeRail.tsx` + `Skills.tsx` `handleDropOnScope`, CR-02 lane-threading fix landed |
| UX-03 | 100-02, 100-04, 100-05 | Optimistic/pending state reconciles honestly | ✓ SATISFIED | `usePendingLifecycleMoves.ts`, CR-01 match-gated clearPending fix landed |
| UX-04 | 100-05 | In-app Cold Storage restore, no `/manage-skills` terminal dead-end | ✓ SATISFIED | `ColdStorageView.tsx` restore wired; grep confirms zero source references |

REQUIREMENTS.md already marks all four as "Complete" with no orphaned requirement IDs for Phase 100 (22/22 v1 requirements mapped, no orphans/duplicates per its own coverage line).

### Anti-Patterns Found

None. Scanned all 8 phase-touched files (`skills.ts`, `usePendingLifecycleMoves.ts`, `SkillLifecycleMenu.tsx`, `ScopeRail.tsx`, `SkillRow.tsx`, `MoveToProjectDialog.tsx`, `Skills.tsx`, `ColdStorageView.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|not yet implemented|not available|coming soon` — zero matches. `deferred-items.md` documents one legitimately out-of-scope discovery (a concurrent unrelated session's `Inbox.tsx` TS7006 errors, phase 186-01) — not a Phase 100 debt marker.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-scoped unit/integration suite | `npx vitest run src/lib/skills.test.ts src/hooks/usePendingLifecycleMoves.test.ts src/components/skills/ScopeRail.test.tsx src/components/skills/SkillRow.test.tsx src/components/skills/SkillLifecycleMenu.test.tsx src/pages/__tests__/Skills.test.tsx src/components/skills/ColdStorageView.test.tsx src/components/skills/AllSkillsOverview.test.tsx src/components/skills/SkillsInCategory.test.tsx src/components/skills/MoveToProjectDialog.test.tsx` | 10 files, 158 tests passed | ✓ PASS |
| Full repo type-check | `npx tsc --noEmit` | Exit 0, zero errors | ✓ PASS |
| Full repo test suite (regression check) | `npm test -- --run` | 216 files passed / 17 skipped, 2528 tests passed / 193 todo, 0 failures | ✓ PASS |
| CR-01/CR-02 regression tests present and green | `git show 5f688014 --stat` + re-run | New tests in `ScopeRail.test.tsx`, `SkillRow.test.tsx`, `usePendingLifecycleMoves.test.ts`; all pass | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention used by this project; none declared in PLAN/SUMMARY files. Skipped — no runnable probes for this phase.

### Human Verification Required

#### 1. Live Forge daemon drag round-trip

**Test:** Drag an active-global skill onto Cold (archive), an active-global skill onto Project (choose a workspace in the dialog, confirm), and a cold/dormant skill onto Global (restore) — against a real running Forge daemon.
**Expected:** Each drop paints the pending overlay immediately (before the daemon responds), and reconciles to a settled state once the daemon claims and completes the command. Forcing a failure or expiry (disconnect the daemon mid-command, or let a command time out) clears the pending overlay and shows the real refusal/expiry toast — never a false "success" look.
**Why human:** Requires a live daemon and real `forgeCommands` rows; the reconcile logic is fully unit-tested against a mocked `useLifecycleCommands()`, but true end-to-end timing has never been exercised. This is the same category of check left outstanding for Phase 98 (`98-HUMAN-UAT.md`) and is explicitly flagged as outstanding in `100-04-PLAN.md`'s own `<verification>` section and in `ROADMAP.md` line 480.

#### 2. Shadowed-row Cold Storage misdrag (CR-02 live confirmation)

**Test:** In the Cold Storage view, find (or create) a skill that is both dormant (cold copy) and active elsewhere (a shadowed-merged row). Drag it and drop it back onto the Cold Storage rail entry.
**Expected:** Nothing happens (same-scope no-op) — the skill's live active copy must NOT be archived.
**Why human:** This is the exact destructive scenario the CR-02 code review finding described. It is covered end-to-end by unit tests at every layer of the pipeline (drag-start lane capture, context propagation, ScopeRail's per-entry validity, the pure matrix function), but has not been exercised as a live browser drag gesture against real shadowed-origin registry data.

### Gaps Summary

No code-level gaps. Both CR-01 and CR-02 (the two Critical findings from `100-REVIEW.md`) are fixed in commit `5f688014` with targeted regression tests, all passing; IN-01 (Info) was also fixed. WR-01 was reviewed and accepted as-is with a documented rationale in `100-REVIEW.md` (the reconcile effect's `[lifecycleCommands]`-only dependency is safe by construction for the one call site where `beginPending` can run after its own command is already terminal, because that command is freshly enqueued and therefore still `queued`). `tsc --noEmit` is fully clean (0 errors) and the full 2528-test suite passes with 0 failures.

The phase is code-complete and all four ROADMAP success criteria plus all four requirement IDs (UX-01..04) are satisfied in the codebase. The only outstanding item is the manual live-Forge-daemon drag verification that this project has consistently deferred to end-of-phase human UAT for daemon-dependent phases (precedent: Phase 98's `98-HUMAN-UAT.md`), plus one live confirmation of the CR-02 fix's exact regression scenario. Status is `human_needed`, not `passed`, per that precedent and the verification workflow's rule that any genuine human-verification item overrides an otherwise-clean score.

---

_Verified: 2026-07-24T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
