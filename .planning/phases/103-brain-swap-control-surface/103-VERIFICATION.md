---
phase: 103-brain-swap-control-surface
verified: 2026-07-29T23:00:00Z
status: gaps_found
score: 2/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 1/5
  gaps_closed:
    - "6a/6b — BrainHeaderBadge + Chat composer pill never requested a swap.get_state snapshot on mount (three-surface disagreement) — closed by 103-09's shared useResolvedBrain/useGlobalBrainOverride resolution order, live-confirmed 103-VALIDATION.md OBS 2-4."
    - "CR-01 (activeEngine.recordRouting forgeable public mutation) — closed by 103-10, verified live in convex/activeEngine.ts:78 (internalMutation) and convex/runtimeIngest.ts:534 (internal.activeEngine.recordRouting)."
    - "CR-02 (BrainPicker CommandItem missing onSelect, keyboard selection non-functional) — closed by 103-11, verified live in source (BrainPicker.tsx:493,505 handleActivate wiring) and live-reverified 103-VALIDATION.md OBS 10 (keyboard search->arrow->Enter, zero mutating frames pre-confirm)."
    - "Defect #5 (GlobalSwapModal discards the real swap.set result, fans out the deferred per-profile axis for global scope, contract §8 violation) — closed by 103-12, verified live in source (GlobalSwapModal.tsx:256-296, no gateway.model.set fan-out for global scope) and live-reverified 103-VALIDATION.md OBS 5 (no union_tag_invalid rows, real outcome reported)."
    - "CR-03 (GlobalSwapModal unmounted by BrainPicker on Done, so a later Revert toast click fires a real command into a dead fiber) — closed by 103-12 (globalDialogOpen/globalTarget mount-vs-visibility split), live-reverified 103-VALIDATION.md OBS 6-7."
    - "WR-01/WR-02/WR-03 (first review cycle: catalogue-fetch staleness guard, scope-blind row highlight, nested-focusable health dot) — closed by 103-11/103-12, verified live in source."
    - "OBS 7 (GlobalSwapModal.runRevert cleared the override instead of restoring the prior one) — found live mid-checkpoint 2026-07-29, closed by 103-14, re-verified PASS in the same live session (103-VALIDATION.md OBS 7 second half)."
    - "Second-review-cycle CR-01 (GlobalSwapModal reused stale phase/outcome state on a same-brain reselect, silently breaking the retry path after a failed swap) — found by 103-REVIEW.md 2026-07-29, closed by 103-16 (selectionNonce reset guard), verified live in source (GlobalSwapModal.tsx:184-237, BrainPicker.tsx:202-204,322-336), via two live-performed mutation checks (both directions of the regression reintroduced and confirmed caught), AND independently re-verified against the running Astridr WS stack — 103-VALIDATION.md OBS 13 (the same reselect script that reproduced the defect at confirm=0/done=1 now measures confirm=1/cancel=1/done=0) and OBS 14 (CR-03 toast-revert still reopens a live instance and restores the prior engine, so both invariants hold at once). Live-proven except the failed-swap retry path, which is unit-covered only."
  gaps_remaining:
    - "OBS 8 — the D-11 pre-swap confirm modal (GlobalSwapModal, fed by BrainPicker.tsx's globalSwapProfiles) reads per-profile current/pinned state from activeEngineSnapshots (empty for real profiles) instead of the live, already-available profileConfigs.modelPreferences — unchanged, unfixed, confirmed present in current source at BrainPicker.tsx:375-387."
    - "Second-review-cycle WR-01 — the Chat composer pill's page-scoped BrainPicker/GlobalSwapModal instance does not survive route navigation, so a 'Revert global swap' toast clicked after leaving /chat fires a real swap.set with zero UI feedback — unchanged, unfixed, confirmed present in current source (Chat.tsx:154-159, GlobalSwapModal.tsx:270-297)."
  regressions: []
gaps:
  - truth: "BSC-01 / BSC-04 / BSC-05 — honest per-profile state shown to the operator before a global swap is dispatched (D-11 confirm modal)"
    status: failed
    reason: >
      The global-override axis's live read/write/readback/revert chain is now genuinely honest
      (103-13-T1 OBS 2-7, 12) — the three-surface disagreement that caused the prior verification's
      BSC-01 failure did not reproduce. But the confirm modal shown BEFORE a swap is dispatched
      still misrepresents live state: it derives each profile's "current" engine and pinned status
      from activeEngineSnapshots (the per-profile telemetry table, correctly empty because astridr
      Phase 184.1 hasn't shipped that ingest), when the honest source — profileConfigs.modelPreferences
      — is already live in the same Convex instance right now and is NOT part of the 184.1 deferral.
      Live-confirmed 2026-07-29 (103-VALIDATION.md OBS 8): profiles:listConfigs shows all 3 real
      profiles (consulting/business/personal) carry a real pinned modelPreferences.primary
      ("anthropic/claude-sonnet-5"), while activeEngine:latestByProfile returns exactly one row —
      {profileId:"unknown", model:"unknown"} — for none of them. The modal therefore shows "Auto"
      for all 3 profiles and pinnedCount=0, understating what a global swap actually overwrites.
      This directly contradicts BSC-01's "not a stale config read" clause and BSC-04's "honest ...
      status" clause for the pre-swap moment specifically (the post-swap dispatch/readback/revert
      leg IS honest). Confirmed still present by reading the current source (not just VALIDATION.md's
      citation) — Larry's explicit disposition per 103-15-SUMMARY.md and 103-VALIDATION.md was to
      leave this unfixed this cycle and track it as a defect, not to defer it as a per-profile-axis
      item.
    artifacts:
      - path: "src/components/brains/BrainPicker.tsx:375-387"
        issue: "globalSwapProfiles derives currentModel/currentModelDisplayName/mode from activeEngines (useActiveEngine() -> activeEngineSnapshots, empty for real profiles) instead of the live profileConfigs.modelPreferences already available via useProfileConfigs() (BrainPicker.tsx:219, imported and in scope in the same file)."
    missing:
      - "Rewire globalSwapProfiles (or GlobalSwapModal's snapshot construction) to read profileConfigs.modelPreferences.primary + pinned status per profile as the source of pre-swap 'current' state, falling back to activeEngineSnapshots only where a live per-profile telemetry row genuinely exists and disagrees (once astridr Phase 184.1 ships)."

  - truth: "BSC-04 — honest live status: no state-mutating command fires with zero visible operator feedback"
    status: failed
    reason: >
      A narrower recurrence of the exact CR-03 symptom this cycle already fixed once, gated on
      route-navigation timing instead of firing on every 'Done' click. CR-03 (103-12) keeps a
      GlobalSwapModal instance mounted past 'Done' so a later 'Revert global swap' toast click has
      a live component to update — but that guarantee only holds for the lifetime of the *hosting*
      BrainPicker. BrainHeaderBadge's BrainPicker is mounted once in DashboardLayout and never
      unmounts across route changes (fix is complete there), but the Chat composer pill
      (BrainComposerPill) mounts its own independent, page-scoped BrainPicker/GlobalSwapModal
      instance. If a user completes an 'All profiles' swap from the composer pill, clicks 'Done'
      (arming the revert toast), then navigates away from /chat before clicking Revert, React
      Router unmounts the composer's BrainPicker and its GlobalSwapModal. Clicking the still-visible
      sonner toast's 'Revert global swap' action invokes runRevert()'s closure on the now-unmounted
      component: dispatch({type:'swap.set', ...}) is a plain async call unrelated to the React tree
      and still executes for real (a genuine state-mutating command against the live global brain),
      but every setOutcome/setPhase call after it is a no-op — no dialog reopens, no follow-up toast
      reports success or failure. Identified by 103-REVIEW.md (2026-07-29) as WR-01 of the current
      review cycle; not addressed by any of 103-09 through 103-16 (confirmed absent from all 8
      gap-closure SUMMARY.md key-files lists) and confirmed still present by reading the current
      source directly.
    artifacts:
      - path: "src/components/brains/GlobalSwapModal.tsx:270-297"
        issue: "runRevert() dispatches the real swap.set command unconditionally; every subsequent setState call is a no-op if the hosting component has unmounted, but the dispatch itself is not gated on mount state."
      - path: "src/pages/Chat.tsx:154-159"
        issue: "BrainComposerPill mounts its own page-scoped <BrainPicker>, and therefore its own independent GlobalSwapModal instance, that does not survive navigating away from /chat."
    missing:
      - "Lift GlobalSwapModal's mount to an app-level singleton (mirroring BrainHeaderBadge's always-mounted DashboardLayout lifetime) so every entry point shares one instance that survives route changes, OR dispatch the toast's revert action through a route-independent store/effect instead of a component closure (103-REVIEW.md's own two suggested fixes)."

  - truth: "BSC-05 (integration gate) — astridr's brain-swap endpoints verified working end-to-end on the running stack before UI was built against them"
    status: failed
    reason: >
      Explicitly restated as NOT fully satisfied in REQUIREMENTS.md itself (2026-07-29, post-103-13-T1)
      and in 103-VALIDATION.md's own sign-off. The global axis's read (catalogue, 331 live engines),
      D-15 confirm gate, and — newly this cycle — the write -> readback -> revert leg are now ALL
      genuinely live-verified end-to-end (103-VALIDATION.md OBS 1-7, 9-12), closing the two defects
      that blocked this gate at the prior verification. It is still not a full pass for two reasons,
      neither of which is the (correctly, by-design) deferred per-profile axis: (1) OBS 8's D-11
      confirm-modal defect above means the operator is not shown honest pre-swap state; (2) the
      failed-swap retry path of the 103-16 reselect fix is unit-covered but was never live-observed,
      because no live swap failure was induced during the session.
      CORRECTION (applied by the orchestrator after this report was first written): the main body of
      103-16's fix WAS independently re-verified against the running Ástríðr stack in the same
      session — see 103-VALIDATION.md OBS 13 (the identical reselect script that reproduced the
      defect at confirm=0/done=1 now measures confirm=1/cancel=1/done=0) and OBS 14 (the CR-03
      toast-revert path re-run post-103-16, still reopening a live instance and restoring the prior
      engine). That evidence existed but was not supplied to the verifier, so the original report
      understated it. Only the failed-swap retry sub-case remains unit-covered-only.
    artifacts:
      - path: "103-VALIDATION.md (Gap-Closure Live Re-Verification, 103-13-T1)"
        issue: "OBS 8 recorded FAILED and explicitly not fixed this cycle. (OBS 13/14, appended after 103-16 landed, DO cover the second-review-cycle CR-01 fix live.)"
    missing:
      - "A live checkpoint that re-verifies OBS 8 once the confirm-modal data source is corrected."
      - "A live observation of the failed-swap retry path (induce a swap failure, then reselect the same brain and confirm the retry dispatches). Unit-covered by 103-16 but never live-observed."
deferred:
  - truth: "Per-profile axis of BSC-01/BSC-02/BSC-04/BSC-05 (list-engines + swap + read-current for 'This profile' scope; real gateway.model.set; per-profile active-engine telemetry into Convex; CLI-gateway reachability)"
    addressed_in: "astridr Phase 184.1 (external repo, explicitly out of CodePulse's Phase 103 scope)"
    evidence: "103-CONTRACT.md's entire per-profile section is written as a client contract FOR Phase 184.1. Confirmed live 2026-07-29 (103-VALIDATION.md): Ástríðr's entire accepted WS command union (read verbatim off a live validation error) does not contain models.catalog — the picker's 'This profile' scope genuinely cannot dispatch live yet, matching the deferral rather than contradicting it. Per this task's explicit instruction, NOT counted as a phase-103 defect or gap."
human_verification:
  - test: "FAILED-swap retry path only: induce a real swap.set failure, then reselect the same brain and confirm the retry actually dispatches."
    expected: "After a failed swap, reselecting the same brain re-dispatches rather than showing a frozen error with no retry path."
    why_human: "The successful-swap half of 103-16's reset fix IS already live-verified (103-VALIDATION.md OBS 13/14). Only the failure branch is unit-covered-only, because no live swap failure was induced during the 2026-07-29 session — inducing one requires either taking Ástríðr down mid-swap or dispatching a deliberately invalid engine id, neither of which was attempted against the operator's working stack."
  - test: "Composer pill placement on Chat.tsx at narrow width"
    expected: "Pill renders in the composer without displacing the send affordance"
    why_human: "Already independently live-verified once this cycle (103-VALIDATION.md OBS 9, 420x900 viewport, send button fully in-bounds) — carried forward only as a standard regression watch-item, not because it is currently in doubt."
---

# Phase 103: Brain-Swap Control Surface Verification Report

**Phase Goal:** Live current-engine view + on-the-fly swap (keyed API models + subscription CLIs), per-agent vs global scope, server-confirmed status
**Verified:** 2026-07-29
**Status:** gaps_found
**Re-verification:** Yes — post-gap-closure (Plans 103-09..103-16), after prior verification recorded gaps_found (1/5)

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|---|---|---|
| 1 | BSC-01 — current engine visible globally + per agent, reactive from Convex/telemetry, not a stale read | ✗ FAILED | Global-axis three-surface disagreement (the prior verification's headline failure) is CLOSED and live-reconfirmed: badge, Chat pill, and BrainControl all agree on the live override (103-VALIDATION.md OBS 3, `useResolvedBrain.ts`). But the D-11 confirm modal — also part of "current engine per agent" — reads the wrong live data source (`BrainPicker.tsx:375-387` uses empty `activeEngineSnapshots` instead of live `profileConfigs.modelPreferences`) and shows "Auto"/pinnedCount=0 for 3 profiles that genuinely have pinned models (OBS 8, unfixed). |
| 2 | BSC-02 — switch engine on the fly (keyed API + subscription CLIs) | ✓ VERIFIED | Global axis fully live-verified: 331 real engines load (`swap.catalogue`), mouse AND keyboard (search->arrow->Enter, `BrainPicker.tsx:493,505`) both dispatch through the same `handleActivate` path with zero mutating frames before explicit confirm (OBS 10). Per-profile ("subscription CLI") axis correctly deferred to astridr Phase 184.1 — confirmed live that `models.catalog` is absent from Ástríðr's accepted command union — not counted against this truth per task instruction. The reselect-same-brain path (103-16) is fixed, mutation-tested, AND live-re-verified (OBS 13: confirm=1/cancel=1/done=0 on the same script that previously measured confirm=0/done=1), with CR-03 confirmed still closed alongside it (OBS 14). Only the failed-swap retry sub-case is unit-covered-only — see Human Verification. |
| 3 | BSC-03 — explicit scope control, global swap requires deliberate confirm | ✓ VERIFIED | Unchanged from prior verification, re-confirmed live this cycle: keyboard-only selection in "All profiles" scope dispatched zero WS frames until the explicit confirm click (OBS 10, 0 mutating frames pre-confirm across the whole run). |
| 4 | BSC-04 — honest end-to-end status, server-confirmed, no optimistic "switched" state | ✗ FAILED | The dispatch -> readback -> revert leg (the prior verification's other headline failure) is now genuinely honest and live-verified: `GlobalSwapModal.tsx:256-296` awaits and reports the real `swap.set` ack + `swap.state` readback with no `gateway.model.set` fan-out for global scope (OBS 5); both revert paths (toast action, `BrainControl`'s independent button) render a real result and restore-to-prior correctly (OBS 6-7, 12). Still FAILED because (a) the pre-swap confirm modal is dishonest per OBS 8 above, and (b) `GlobalSwapModal.tsx:270-297`'s `runRevert` still fires a real command with zero UI feedback when its page-scoped host (`Chat.tsx:154-159`) has unmounted — a live, unfixed, current-review-cycle finding (103-REVIEW.md WR-01). |
| 5 | BSC-05 — brain-swap endpoints verified end-to-end on the running stack before UI built | ✗ FAILED | Explicitly restated as NOT fully satisfied in `REQUIREMENTS.md` (2026-07-29) and `103-VALIDATION.md`'s own sign-off. Read, confirm-gate, and now write/readback/revert are ALL live-verified (closing the prior verification's dispatch/readback/revert gap). Blocked from a full pass by OBS 8 (truth 1/4) and by 103-REVIEW.md WR-01 (truth 4) — neither of which is the correctly-deferred per-profile axis. 103-16's reselect fix is NOT a blocker: it was live-re-verified this session (OBS 13/14); only its failed-swap retry sub-case remains unit-covered-only. |

**Score:** 2/5 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | Per-profile axis of BSC-01/02/04/05 (list-engines + swap + read-current for "This profile" scope; real `gateway.model.set`; per-profile telemetry ingest; CLI-gateway reachability) | astridr Phase 184.1 (external repo) | `103-CONTRACT.md`'s per-profile section is a client contract written for that phase. Live-confirmed 2026-07-29: Ástríðr's accepted WS command union does not contain `models.catalog`. Per task instruction, not counted as a Phase 103 defect. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `convex/activeEngine.ts` (`recordRouting`) | Non-forgeable write path for the active-engine axis | ✓ VERIFIED | `recordRouting` is `internalMutation` (line 78), only reachable via `internal.activeEngine.recordRouting` from `convex/runtimeIngest.ts:534`. Closes prior verification's CR-01. |
| `src/hooks/useResolvedBrain.ts` | One shared "what brain is actually running" resolution order | ✓ VERIFIED | 195 lines. `useGlobalBrainOverride` snapshot-pulls `swap.get_state` on every `connected` transition (THE fix, lines 89-113) plus a live `swap.state` subscription (115-126). `resolveActiveBrain` implements the documented global-wins-over-per-profile precedence. Consumed by `BrainHeaderBadge.tsx:42,59` and `Chat.tsx:32,128,328`. Closes prior verification's defects 6a/6b. |
| `src/components/brains/BrainPicker.tsx` (`CommandItem.onSelect`) | Keyboard search->arrow->Enter dispatches | ✓ VERIFIED | `onSelect={() => handleActivate(entry)}` on the `CommandItem` (line 493); `handleActivate` (338-365) is the single activation entry point for both mouse and keyboard. Closes prior verification's CR-02. Live-reverified OBS 10. |
| `src/components/brains/GlobalSwapModal.tsx` (result reporting) | Reports the real `swap.set` outcome for global scope, no deferred-axis fan-out | ✓ VERIFIED | `runSwap()` (256-296) dispatches exactly one `swap.set`, awaits and reports its ack; no `Promise.allSettled`/`gateway.model.set` fan-out present anywhere in the file. Closes prior verification's defect #5. Live-reverified OBS 5. |
| `src/components/brains/GlobalSwapModal.tsx` (mount lifecycle) | Instance survives "Done" so a later Revert has a live target | ⚠️ VERIFIED-WITH-DEFECT | `BrainPicker.tsx:197-204,517-524` decouples `globalTarget` (mount) from `globalDialogOpen` (visibility) — closes prior verification's CR-03 for the dashboard-wide `BrainHeaderBadge` entry point (never unmounts). But the guarantee does NOT extend past the *hosting* `BrainPicker`'s own lifetime — see gap (BSC-04, WR-01-new) for the page-scoped Chat composer pill. |
| `src/components/brains/GlobalSwapModal.tsx` (reselect reset guard) | A fresh selection always gets a fresh confirm prompt, even a repeat brain | ✓ VERIFIED (source-level; live re-check pending) | `selectionNonce` prop (168), reset effect keyed on it not `target.id` (220-237); `BrainPicker.tsx` bumps `globalSelectionNonce` unconditionally in `handleSelect`'s global branch (202-204,322-336). Closes the current review cycle's CR-01. Two live-performed mutation checks (both directions) confirmed in 103-16-SUMMARY.md. Not yet independently re-verified against the running WS stack — see Human Verification. |
| `src/components/brains/BrainPicker.tsx` (`globalSwapProfiles`) | Honest per-profile current/pinned state for the D-11 confirm modal | ✗ STILL DEFECTIVE | Lines 375-387 derive `currentModel`/`currentModelDisplayName`/`mode` from `activeEngines` (empty `activeEngineSnapshots`) instead of live `profileConfigs.modelPreferences` (already available in the same file via `useProfileConfigs()`, line 219). OBS 8, unfixed. |
| `src/components/control-center/BrainControl.tsx` (restore-to-Auto) | Reachable, single-command, D-14-honest clear-to-Auto control | ✓ VERIFIED | "Restore usual brain" button (217-227), gated on `override` truthy, dispatches `{type:"swap.set", target:"brain", restore:true}`. Pre-existing since Phase 186-09 (not built by 103); 103-15 added regression-hardening tests only, zero-line source diff (confirmed: `BrainControl.tsx` untouched, only `BrainControl.test.tsx` modified). Live-reverified OBS 12. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `BrainHeaderBadge.tsx` | `useResolvedBrain` | shared resolution hook | ✓ WIRED | Confirmed import + call (`BrainHeaderBadge.tsx:42,59`). |
| `Chat.tsx` (`BrainComposerPill`) | `useResolvedBrain` / `useGlobalBrainOverride` | shared resolution hook | ✓ WIRED | Confirmed import + calls (`Chat.tsx:32,128,328`). |
| `runtimeIngest.ts` (`model_routing` case) | `internal.activeEngine.recordRouting` | internal-only mutation call | ✓ WIRED | `runtimeIngest.ts:534`. |
| `BrainPicker.tsx` | `GlobalSwapModal.tsx` | `globalTarget`/`globalDialogOpen`/`selectionNonce` props | ✓ WIRED | `BrainPicker.tsx:517-524`. |
| `GlobalSwapModal.tsx` (`runSwap`) | live `swap.set` | global-scope dispatch, ack awaited and reported | ✓ WIRED | `GlobalSwapModal.tsx:282-296`. |
| `GlobalSwapModal.tsx` (`runRevert`) | live `swap.set` (restore branch) | toast action closure | ⚠️ WIRED-BUT-UNSAFE | Dispatch genuinely works and honestly restores-to-prior when the host is still mounted (OBS 7); fires with zero feedback when the host (page-scoped Chat composer pill instance) has unmounted — see gap. |
| `BrainPicker.tsx` (`globalSwapProfiles`) | `useProfileConfigs()` (live `profileConfigs.modelPreferences`) | — | ✗ NOT WIRED | `useProfileConfigs()` is imported and called in the same file (line 219) for other purposes, but `globalSwapProfiles` (375-387) does not read from it — reads `activeEngines` instead. This is the OBS 8 defect's exact mechanism. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `BrainHeaderBadge` / Chat composer pill | `resolved.model` | `useResolvedBrain` -> `useGlobalBrainOverride` (`swap.get_state` snapshot + `swap.state` push) | Yes — live-confirmed OBS 2-4, correct engine name + "(global)" qualifier on both surfaces | ✓ FLOWING |
| `GlobalSwapModal` result rows (post-swap) | `outcome` | Real `swap.set` ack + `swap.state` readback (D-14 gate, `modelOverride === confirmTarget`) | Yes — live-confirmed OBS 5 (no fabricated success, no discarded-then-fake-failure) | ✓ FLOWING |
| `GlobalSwapModal` confirm-modal rows (pre-swap) | `globalSwapProfiles` / `snapshot` | `activeEngines` (`activeEngineSnapshots`, zero live rows for real profiles) | No — every profile renders "Auto"/pinnedCount=0 regardless of the real pinned `profileConfigs.modelPreferences` data that exists in the same Convex instance | ✗ DISCONNECTED — OBS 8 |

### Behavioral Spot-Checks

Not independently re-run this pass beyond the targeted `npx vitest run` re-run below — `103-VALIDATION.md`'s "Gap-Closure Live Re-Verification (103-13-T1)" section is the authoritative live evidence for this cycle per this task's explicit instruction, and its 12-observation table is reproduced in the Observable Truths section above. This pass independently re-read every cited file (`useResolvedBrain.ts`, `convex/activeEngine.ts`, `convex/runtimeIngest.ts`, `BrainPicker.tsx`, `GlobalSwapModal.tsx`, `Chat.tsx`, `BrainControl.tsx`) and confirms all closed-defect citations still match current source, and that OBS 8 / current-cycle WR-01 remain present unmodified.

`npx vitest run src/components/brains src/hooks/useResolvedBrain.test.tsx src/pages/Chat.test.tsx src/components/control-center/BrainControl.test.tsx convex/activeEngine.test.ts` — re-run independently this pass: **10 files, 171 tests, 0 failures.**

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention in this repo/phase; none declared in any of the 16 PLAN/SUMMARY files. Skipped — no runnable probe entry points for this phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| BSC-01 | 103-01..103-13 | Live current-engine view, per-agent + global | ⚠ PARTIAL | Matches `REQUIREMENTS.md`'s own 2026-07-29 restated marker. Global half genuinely satisfied; per-agent (D-11 confirm modal) half blocked by OBS 8. |
| BSC-02 | 103-01..103-13, 103-16 | Switch engine on the fly (keyed API + subscription CLI) | ✓ SATISFIED (global axis; caveat noted) | `REQUIREMENTS.md` marks global axis SATISFIED. Reselect-retry fix (103-16) sound but not yet live-re-verified — see human verification. |
| BSC-03 | 103-04, 103-05, 103-11 | Scope control, explicit global confirm | ✓ SATISFIED | Confirm gate re-confirmed live this cycle (OBS 10). |
| BSC-04 | 103-04, 103-08, 103-12, 103-14 | Honest live status, server-confirmed | ⚠ PARTIAL | Matches `REQUIREMENTS.md`'s restated marker. Dispatch/readback/revert leg genuinely honest; pre-swap (OBS 8) and page-scoped-revert (current-cycle WR-01) leaks remain. |
| BSC-05 | 103-08, 103-13 | Integration gate | ⚠ PARTIAL | Matches `REQUIREMENTS.md`'s restated marker — explicitly not a full pass; per-profile deferral correctly not counted. |

No orphaned requirements found — all 5 BSC-01..05 IDs are declared and mapped across the phase's plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `src/components/brains/BrainPicker.tsx` | 375-387 | `globalSwapProfiles` reads a known-empty data source (`activeEngineSnapshots`) instead of the live, in-scope `profileConfigs.modelPreferences` already available in the same file (OBS 8) | 🛑 Blocker | Confirm modal understates what a global swap shadows for every real profile. |
| `src/components/brains/GlobalSwapModal.tsx` | 270-297 | `runRevert` dispatches a real, state-mutating command with no mount-state guard; page-scoped host lifetime is not accounted for | ⚠️ Warning | Zero-feedback command execution only in the narrow window of navigating away from `/chat` with an armed revert toast; the dashboard-wide `BrainHeaderBadge` entry point is unaffected. |

No `TBD`/`FIXME`/`XXX` markers found in any file touched by this gap-closure cycle (`convex/activeEngine.ts`, `convex/runtimeIngest.ts`, `src/components/brains/*.tsx`, `src/hooks/useResolvedBrain.ts`, `src/pages/Chat.tsx`, `src/components/control-center/BrainControl.tsx`, and their test files — grepped directly this pass).

### Human Verification Required

#### 1. Live re-verification of 103-16's reselect fix

**Test:** Against the running Astridr stack (not stubbed): swap all profiles to brain X, confirm, click Done, then reselect brain X again from the picker. Separately: force a swap failure, then reselect the same brain to confirm the retry actually re-dispatches.
**Expected:** A fresh "Swap all profiles to X?" confirm dialog opens on reselection — never the previous swap's stale result screen. After a failure, reselecting the same brain triggers a genuine new dispatch, not a frozen error screen.
**Why human:** The source fix is sound (traced directly) and both live-performed mutation checks in `103-16-SUMMARY.md` caught the exact regression in both directions, but this task's own LIVE EVIDENCE STANDARD explicitly does not accept a green unit suite as proof of a live fix, and no live checkpoint has exercised this scenario since 103-16 landed.

#### 2. Composer pill placement at narrow width (regression watch only)

**Test:** Load `/chat` at a narrow viewport, confirm the pill renders without displacing the send affordance.
**Expected:** Pill fits without layout breakage.
**Why human:** Already live-verified once this cycle (103-VALIDATION.md OBS 9); carried forward as a standard regression watch-item since visual layout isn't assertable in jsdom, not because current evidence is in doubt.

### Gaps Summary

Phase 103's gap-closure cycle (16 plans total, 103-09..103-16) closed the two headline defects the prior verification failed on: the three-surface disagreement (badge/pill/BrainControl each reading a different "current brain") is gone, replaced by one shared `useResolvedBrain` resolution order, and `GlobalSwapModal` now genuinely reports the real `swap.set` outcome instead of discarding it in favor of a deferred axis's guaranteed failures. The dispatch -> readback -> revert leg for a global swap is now honestly live-verified end to end, including both independent revert affordances (`GlobalSwapModal`'s toast action and `BrainControl`'s "Restore usual brain"). A regression this cycle's own CR-03 fix introduced (stale result screen on a same-brain reselection) was caught by code review and closed the same day (103-16), with real mutation-test evidence.

Two concrete, unfixed defects remain, both narrower in scope than the prior cycle's failures but each still directly contradicting the wording of the roadmap success criteria they touch: (1) OBS 8 — the pre-swap confirm modal reads the wrong (empty) data source for per-profile current/pinned state, when the correct source is already live in the same Convex instance; this is not a per-profile-axis deferral, it's a wrong-table bug. (2) The current review cycle's WR-01 — a page-scoped revert-toast command can fire with zero UI feedback if the operator navigates away from `/chat` first, a narrower recurrence of the exact class of bug CR-03 already fixed once for the dashboard-wide entry point. Additionally, 103-16's own fix (closing a NEW regression found by code review, not one of the prior six defects) has correct logic and passing mutation checks but has not yet been exercised against the live running stack, which this task's own evidence standard requires before calling BSC-02/04/05 fully closed.

None of these three items block the substantial, real progress this cycle made, and none of them touch the correctly-deferred per-profile axis (astridr Phase 184.1). A focused follow-up — rewire `globalSwapProfiles` onto `profileConfigs.modelPreferences`, decide + implement a fix for the page-scoped revert-toast lifetime, and run one more live checkpoint covering both that fix and the 103-16 reselect scenario — would be sufficient to move BSC-01/02/04/05 from PARTIAL to fully satisfied and close BSC-05's integration gate.

---

_Verified: 2026-07-29_
_Verifier: Claude (gsd-verifier)_
