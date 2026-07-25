---
phase: 99-skill-launch-dispatch
verified: 2026-07-23T23:00:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 99: Skill Launch / Dispatch Verification Report

**Phase Goal:** A real "Run" dispatches a skill to Chat (auto-send), a Forge agent, or Ástríðr — not just a prefilled-and-waiting composer. Launches are recorded honestly (D-12: `useCount` reflects real runs only; recorded exactly once, only on a genuinely successful send/enqueue). Dead recording paths (copy-records-launch, passive `/chat?skill=` open-in-chat) are retired (D-13).

**Verified:** 2026-07-23
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC1/LAUNCH-01) Chat Run target results in a real `chat.send`, never a prefilled-and-waiting composer | VERIFIED | `Chat.tsx:271-310` auto-send effect calls `sendMessage(handoff.text, ...)`; `RunChatPopover.tsx` never calls send itself (comment confirms), only `Chat.tsx` post-navigate does |
| 2 | (SC2/LAUNCH-02) Forge Run target opens the real `ForgeLaunchModal` (agent/workspace/mode picker) and reuses `enqueueLaunch` | VERIFIED | `SkillLaunchProvider.launchForge` → prefilled modal; `ForgeLaunchModal.handleSubmit` calls `await launch({...})` (the `enqueueLaunch` mutation), unchanged auth gate |
| 3 | (SC3/LAUNCH-03) Ástríðr Run target dispatches with a chosen persona and executes | VERIFIED | `RunAstridrPopover` persona segmented control (`PROFILES`) → `submitAstridr(text, profile)` → `navigate('/chat', {state:{autoSend:{..., profile}}})` → `Chat.tsx` → `sendMessage(text, {profile})` → spread onto `chat.send` (`useAstridrChat.ts:125`) |
| 4 | (SC4/LAUNCH-04) One Run affordance lets the user pick Chat/Forge/Ástríðr at launch time, remembering the last pick | VERIFIED | `RunTargetChooser.tsx` `TARGET_ITEMS` (3 targets) + `useRunLaunch`/`pick()`; `lastTarget` persisted via `skillRun.ts` localStorage helpers, rendered with a check icon in `RunTargetItems` |
| 5 | (LAUNCH-04/D-12) Every real launch bumps `useCount`/`lastUsedAt` via `recordSkillLaunch` | VERIFIED | Chat/Ástríðr: `Chat.tsx:288`; Forge: `SkillLaunchProvider.handleLaunchConfirmed:91-93` — both call `api.registry.recordSkillLaunch` |
| 6 | (CR-01 fix) A failed/rejected/guard-dropped Chat/Ástríðr send does NOT record a launch | VERIFIED | `useAstridrChat.sendMessage` returns `Promise<boolean>`, `false` on early guard (L104), rejected ack (L139), network catch (L167), `true` only after `setStreaming(true)` (L155); `Chat.tsx:287-291` gates `recordSkillLaunch` on `if (sent)`, else `toast.error`. Test: `Chat.test.tsx:158-168` "does NOT record the launch when the underlying send resolves false" — PASSES (independently re-run) |
| 7 | (CR-02 fix) A Forge enqueue that rejects does NOT record a launch | VERIFIED | `ForgeLaunchModal.tsx:224` — new `onLaunchConfirmed?.()` fired only inside the `try` block, immediately after `await launch(...)` resolves, never in the `catch`; `SkillLaunchProvider.tsx` wires `recordSkillLaunch` to `handleLaunchConfirmed` (the new callback), NOT the optimistic `handleLaunched` (now a no-op). Tests in `ForgeLaunchModal.test.tsx` / `SkillLaunchProvider.test.tsx` exercise pending/resolved/rejected `mockLaunch` — PASS (independently re-run) |
| 8 | (D-13) Clipboard copy no longer records a launch anywhere | VERIFIED | `QuickDeck.tsx handleCopy` (L31-45, explicit "D-13: copy no longer records a launch" comment, no `recordSkillLaunch` call), `SkillRow.tsx handleCopy` (L67, no record call), `SkillCommandPalette.tsx handleCopy` (L85-97, no record call) — grepped all three, zero `recordSkillLaunch`/`recordLaunch` matches |
| 9 | (D-13) Passive `/chat?skill=` open-in-chat dead-end is fully retired | VERIFIED | `Skills.tsx` has no `handleOpenInChat`, no `navigate('/chat?skill=')`, no `?skill=` string anywhere in the reviewed surface; `SkillLifecycleMenu`/`QuickDeck`/`SkillCommandPalette` all confirmed with zero references |
| 10 | (WR-02 fold-in) `recordSkillLaunch` rejection does not strand router state | VERIFIED | `Chat.tsx:282-299` wraps the auto-send body in `try/catch/finally`, `navigate(...)` (state clear) always runs in `finally` |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/skillRun.ts` | `RunTarget`/`AutoSendHandoff` contract + last-pick localStorage helpers | ✓ VERIFIED | Exists, substantive, imported by `RunTargetChooser.tsx`, `SkillLaunchProvider.tsx` |
| `src/lib/profiles.ts` | Hoisted `PROFILES`/`ProfileId`, single source | ✓ VERIFIED | Exists; `Reminders.tsx` re-exports (`export { PROFILES }` L30), confirmed no drifted second copy |
| `src/hooks/useAstridrChat.ts` | `sendMessage` returns `Promise<boolean>`, profile passthrough | ✓ VERIFIED | L99 signature, L104/139/155/167 explicit boolean returns, L125 `...(opts?.profile ? {profile: opts.profile} : {})` |
| `src/pages/Chat.tsx` | Auto-send effect, gated recording, honest toast on failure | ✓ VERIFIED | L271-310, StrictMode-guarded via `firedRef`, disconnected-status honest toast at L301-304 |
| `src/components/forge/ForgeLaunchModal.tsx` | `initialPrompt` prefill, `onLaunchConfirmed` post-await callback | ✓ VERIFIED | L221-224 confirmed-post-await callback, `agy` disabled (L306), `codex`/`claude` mapped |
| `src/components/skills/SkillLaunchProvider.tsx` | Context: `lastTarget`, `launchForge`, Forge recording wired to confirmed callback | ✓ VERIFIED | L91-93 `handleLaunchConfirmed`, L85 optimistic `handleLaunched` now a no-op |
| `src/components/skills/RunTargetChooser.tsx` | `useRunLaunch` hook, `RunTargetItems`, standalone chooser | ✓ VERIFIED | 3-target list, `pick()` branches by target, builds `AutoSendHandoff` |
| `src/components/skills/RunChatPopover.tsx` | Pre-send capture, Enter/Send fires, Escape = zero side effects | ✓ VERIFIED | Never calls send/navigate/record itself (by design, documented in header) |
| `src/components/skills/RunAstridrPopover.tsx` | Same shell + persona picker (`PROFILES`), no persona-answered claim | ✓ VERIFIED | `PersonaSwitch` from `PROFILES`, copy stays "Send" (honesty guard documented + upheld) |
| `src/components/skills/SkillLifecycleMenu.tsx` | Run submenu (`RunTargetItems`) as first item, always rendered | ✓ VERIFIED | L237-244, above the scope-gated Archive/Restore/Move/Delete branch, never disabled |
| `src/components/skills/QuickDeck.tsx` | Primary tile click = Run; copy demoted to secondary, non-recording | ✓ VERIFIED | L70-88 `RunTargetChooser` wraps the primary button; L90-97 secondary copy icon, no record |
| `src/components/skills/SkillCommandPalette.tsx` | Unchanged — copy only, no Run item added | ✓ VERIFIED | No `RunTargetChooser`/`useRunLaunch` import; header comment explicitly documents D-02 |
| `src/components/skills/ColdStorageView.tsx` / `AllSkillsOverview.tsx` / `SkillsInCategory.tsx` | Route through `SkillRow` (which hosts `SkillLifecycleMenu`) | ✓ VERIFIED | All three import and render `SkillRow`; no separate dead-path wiring |
| `src/pages/Skills.tsx` | Wraps skills UI in `SkillLaunchProvider` (QuickDeck + all 3 list views) | ✓ VERIFIED | L251/L406 provider boundary encloses `QuickDeck` (L260) and `ColdStorageView`/`AllSkillsOverview`/`SkillsInCategory` (L360-378) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `Chat.tsx` auto-send effect | `useAstridrChat().sendMessage` | `await sendMessage(...)` | WIRED | Confirmed boolean gate, `if (sent)` |
| `Chat.tsx` auto-send effect | `api.registry.recordSkillLaunch` | Called only when `sent === true` | WIRED | L287-288 |
| `ForgeLaunchModal` | `SkillLaunchProvider` | `onLaunchConfirmed` prop, fired post-`await launch()` | WIRED | L224 fire site, L114 wiring in provider JSX |
| `RunTargetChooser`/`SkillLifecycleMenu` | `RunChatPopover`/`RunAstridrPopover` | `useRunLaunch` open-state + `onSubmit` | WIRED | Both consumers render both popovers anchored to the trigger |
| `useRunLaunch.submitChat`/`submitAstridr` | `Chat.tsx` | `navigate('/chat', {state:{autoSend}})` | WIRED | Payload shape matches `AutoSendHandoff` consumed at `Chat.tsx:267` |
| `QuickDeck` primary chip | `RunTargetChooser` | Component composition | WIRED | L70-88 |
| `Skills.tsx` | `SkillLaunchProvider` | JSX wrap | WIRED | Encloses QuickDeck + all 3 list surfaces |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Honesty-invariant unit suite (7 files: `useAstridrChat.test.ts`, `Chat.test.tsx`, `ForgeLaunchModal.test.tsx`, `SkillLaunchProvider.test.tsx`, `RunTargetChooser.test.tsx`, `QuickDeck.test.tsx`, `SkillLifecycleMenu.test.tsx`) | `npx vitest run <7 files>` | 85 passed, 0 failed (independently re-run by verifier, not taken from SUMMARY) | ✓ PASS |
| Type check | `npx tsc --noEmit` | Clean, zero errors | ✓ PASS |
| Debt-marker scan (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) across all 17 phase-touched files | `grep -nE` per file | Zero matches | ✓ PASS |
| Gap-closure commits exist and match claimed content | `git show --stat 2f86f49/1cfb715/6d364ed` | All 3 commits present, messages match SUMMARY claims (RED test / CR-01 GREEN / CR-02 GREEN) | ✓ PASS |
| CR-03 pre-existing-not-phase-99 claim | `git log -L189,191:src/hooks/useAstridrChat.ts` | Line originates from commit `1900944` ("Ástríðr full-presence Chat page"), predates Phase 99 | ✓ PASS |

### Probe Execution

N/A — Phase 99 is a UI/frontend feature phase (React components + Convex mutations), not a migration/CLI/tooling phase. No `scripts/*/tests/probe-*.sh` declared in any PLAN/SUMMARY and none found under `scripts/`. Skipped per Step 7c criteria.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAUNCH-01 | 99-01, 99-02, 99-03 | Run a skill directly in Chat via real `chat.send` | ✓ SATISFIED | Truths #1, #6, #10 |
| LAUNCH-02 | 99-01, 99-04 | Launch a skill as a Forge agent run via `enqueueLaunch` | ✓ SATISFIED | Truths #2, #7 |
| LAUNCH-03 | 99-01, 99-02, 99-03 | Dispatch a skill to Ástríðr / a chosen persona | ✓ SATISFIED | Truths #3, #6 |
| LAUNCH-04 | 99-04, 99-05, 99-06 | Run target chooser + honest usage recording | ✓ SATISFIED | Truths #4, #5, #8, #9 |

All 4 requirement IDs declared across the 6 plans' `requirements:` frontmatter are accounted for; no orphaned Phase-99 requirement IDs found in REQUIREMENTS.md beyond LAUNCH-01..04.

**Note (documentation lag, non-blocking):** `.planning/REQUIREMENTS.md` still shows LAUNCH-01..04 as unchecked (`- [ ]`) and "Pending" in the traceability table (lines 29-32, 82-85). This is a doc-sync gap only — the underlying code evidence (above) satisfies all four. Per this agent's scope, `.planning/REQUIREMENTS.md`/`ROADMAP.md`/`STATE.md` are not edited by the verifier; flagging for the orchestrator to update at phase close.

### Anti-Patterns Found

None. Scanned all 17 phase-touched files (`skillRun.ts`, `profiles.ts`, `useAstridrChat.ts`, `Chat.tsx`, `Skills.tsx`, `SkillLaunchProvider.tsx`, `RunTargetChooser.tsx`, `RunChatPopover.tsx`, `RunAstridrPopover.tsx`, `SkillLifecycleMenu.tsx`, `QuickDeck.tsx`, `SkillRow.tsx`, `SkillCommandPalette.tsx`, `ColdStorageView.tsx`, `AllSkillsOverview.tsx`, `SkillsInCategory.tsx`, `ForgeLaunchModal.tsx`) for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/"not yet implemented"/"coming soon" — zero matches.

### Deferred / Documented Follow-Ups (not gaps)

- **CR-03 (WR-01 in 99-REVIEW.md):** `useAstridrChat.ts:194-197` (`setIsStreaming(false)` in the `run.text` done branch bypasses the `setStreaming` ref-sync wrapper). Confirmed via `git log -L` that this line originates from commit `1900944` (2026-07-20, "Ástríðr full-presence Chat page"), predating Phase 99 entirely. 99-REVIEW.md and 99-07-SUMMARY.md both correctly classify this as a pre-existing issue outside the D-12 honesty-invariant scope of this phase, recommending a live-trace-based fix rather than a blind one (per the user's own global lesson on voice-timing fixes: instrument, don't guess). This is **not a Phase-99 regression** and does not block phase completion. No formal issue/backlog number references it yet — recommend the orchestrator open a tracked follow-up item (this is informational, not a phase-99 gap).
- **New Ástríðr per-turn persona-override endpoint (D-09):** Not needed — research (D-14a) confirmed the existing `chat.send` `profile` param scopes `SecurityContext.profile_id` sufficiently for this phase's persona-dispatch scope; no astridr-side endpoint work was required, so nothing was actually deferred to a paired phase.

### Human Verification Required

None. No `<human-check>` blocks were found deferred in any of the 6 PLAN.md files (only automated `<verify>` blocks), and the honesty-invariant behavior (the primary risk area per code review) is covered by deterministic unit tests exercising the exact success/failure/guard paths (mocked `sendCommand`/`launch`), independently re-run by this verifier with 85/85 passing. No visual-only, external-service, or real-time-timing claims in this phase's must-haves that couldn't be verified via source + test inspection.

### Gaps Summary

No gaps. Both BLOCKER findings from `99-REVIEW.md` (CR-01: Chat/Ástríðr auto-send recording on failed send; CR-02: Forge enqueue recording on optimistic pre-await paint) were verified fixed directly in the live source (`useAstridrChat.ts`, `Chat.tsx`, `ForgeLaunchModal.tsx`, `SkillLaunchProvider.tsx`) — not merely claimed in `99-07-SUMMARY.md`. The three cited fix commits (`2f86f49`, `1cfb715`, `6d364ed`) exist in git history with matching diffs and messages. The targeted test suite for all Phase 99 launch-path files (85 tests, 7 files) was independently re-executed by this verifier and passes in full, including the two new regression tests that directly assert the CR-01/CR-02 fixes ("does NOT record the launch when the underlying send resolves false", ForgeLaunchModal's rejected-`mockLaunch` case). `tsc --noEmit` is clean. All 4 requirement IDs (LAUNCH-01..04) and all 4 roadmap Success Criteria are satisfied by live, wired, tested code. The one open item (CR-03/WR-01) is confirmed pre-existing (predates this phase by 3 days per `git log -L`) and is correctly out of scope per the phase's own review/summary documentation — not a Phase-99 regression, and not a blocker.

---

*Verified: 2026-07-23*
*Verifier: Claude (gsd-verifier)*
