---
phase: 103-brain-swap-control-surface
plan: 07
subsystem: ui
tags: [react, chat, settings, sonner, brain-swap, honesty, stale-read-removal]

# Dependency graph
requires:
  - phase: 103-03
    provides: "src/hooks/useActiveEngine.ts (useActiveEngine + deriveMixedState), src/components/brains/BrainPickerRow.tsx"
  - phase: 103-05
    provides: "src/components/brains/BrainPicker.tsx — including its 103-06-added composition API (trigger/open/onOpenChange/onPendingChange props)"
provides:
  - "src/pages/Settings.tsx — Agent Profiles rows rebuilt on the real, populated profileConfigs source with a live-engine read (D-06); the stale `p.model` synced-config read is deleted, not supplemented"
  - "src/pages/Chat.tsx — composer brain pill (new row above the composer input), scoped to the contract's default_profile_id"
  - "src/components/brains/BrainFallbackNotice.tsx — useBrainFallbackNotice() hook, honest CLI-to-API text-mode fallback toast (D-04)"
affects: [103-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AgentProfileRows extracted as its own component (not inlined in Settings()) purely so useActiveEngine()'s call site is a real render descendant of <SectionErrorBoundary name=\"Agent Profiles\"> — a throwing/undefined query degrades to one boundary fallback instead of blanking the whole Settings page."
    - "BrainPicker's 103-06 composition API (trigger + onPendingChange) reused a third time (Chat composer pill, Settings Swap button) — every per-profile brain surface in the app now composes the SAME picker instance via this API rather than any surface hand-rolling its own Popover or DOM-relaying clicks into a hidden picker."

key-files:
  created:
    - src/pages/Settings.test.tsx
    - src/components/brains/BrainFallbackNotice.tsx
    - src/components/brains/BrainFallbackNotice.test.tsx
  modified:
    - src/pages/Settings.tsx
    - src/pages/Chat.tsx
    - src/pages/Chat.test.tsx

key-decisions:
  - "AgentProfileRows iterates useProfileConfigs() (real, populated) and only optionally joins agentProfiles (confirmed empty in production, convex/profiles.ts:113) for displayName/avatarId/the Edit button's metadata target — never the other way around. The Edit button's onClick passes the joined agentProfiles row (or null) unchanged; a profileConfigs row with no matching agentProfiles row renders with an Edit button that currently no-ops (Sheet gates on editingProfile !== null) — a pre-existing gap in agentProfiles population, not something this plan's scope (the stale-read removal) is responsible for fixing."
  - "BrainPicker.tsx is NOT in this plan's files_modified, so the Settings row's Swap button cannot hard-lock or hide BrainPicker's This-profile/All-profiles scope selector as UI-SPEC §9's literal wording asks for. The picker still defaults to 'This profile' on open (D-08's normal behavior) — the practical intent holds — but a user could still manually toggle to 'All profiles' from a per-row Swap click. Documented as a known, accepted UX nuance, matching the identical file-scope precedent already recorded in 103-05-SUMMARY.md for BrainPickerRow.tsx's scope-unaware needsConfirm gate."
  - "Both AgentProfileRows and BrainComposerPill fetch brainsApi.getCatalogue() independently (rather than sharing a hook) to resolve the provider-identity dot color, mirroring BrainHeaderBadge.tsx's identical one-time-fetch-on-mount pattern (103-06) rather than introducing a new shared catalogue-cache hook outside this plan's file scope."
  - "formatTtl/formatBrainTtl duplicated locally in Settings.tsx and Chat.tsx (a third copy of BrainHeaderBadge.tsx's existing helper) rather than extracted to a shared lib — no new shared module file is in this plan's files_modified, and the function is ~5 lines with zero external dependencies."
  - "BrainFallbackNotice's toast fires via sonner's native toast.warning(...), matching the Color contract's explicit '--status-warn, not --status-error — graceful degrade, not a failure' rule (UI-SPEC §12) verbatim in the API choice, not just the CSS class."
  - "Settings.test.tsx tests AgentProfileRows directly (exported specifically for this) rather than mounting the full Settings page, which also pulls in Privacy/Ambient contexts, Tabs, the avatar uploader, LLM provider config, and notification settings — all orthogonal to this task and no existing Settings.test.tsx precedent existed to extend."
  - "1 Rule-1 auto-fix: a doc comment in Settings.tsx quoted the literal substring 'p.model' (explaining the removed stale read), which the plan's own zero-hit acceptance grep (grep -cE 'p\\.model' src/pages/Settings.tsx) would have failed — same failure class as 103-01's and 103-03's prior doc-comment-vs-grep-gate deviations. Reworded to paraphrase around the literal string; re-verified 0 hits."
  - "BSC-01 and BSC-02 marked COMPLETE — this is the plan that lands the LAST two of the three surfaces (composer pill, Settings row; the header badge landed in 103-06) and removes the stale read. See REQUIREMENTS.md update below."

patterns-established:
  - "Extract-a-subcomponent-for-boundary-isolation: when a page-level SectionErrorBoundary needs to wrap a query hook's throw surface but the hook's result also needs to reach sibling JSX outside that boundary's visual section, pull the hook call into its own child component mounted INSIDE the boundary rather than calling the hook at the parent's top level."

requirements-completed: [BSC-01, BSC-02]

# Metrics
duration: ~35min
completed: 2026-07-28
---

# Phase 103 Plan 07: Composer Pill, Settings Row, CLI Fallback Notice Summary

**Wired the picker into its two remaining hosts and deleted the last live instance of the v9.0 VitalsRail stale-read trap — Chat.tsx's new composer brain pill and Settings.tsx's rebuilt Agent Profiles rows both read exclusively through `useActiveEngine()`, and a new `useBrainFallbackNotice()` hook surfaces a silent CLI-to-API text-mode fallback as an honest warn-toned toast.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-28 (session continuation from Plan 06)
- **Completed:** 2026-07-28
- **Tasks:** 3/3 completed
- **Files modified:** 3 created, 3 modified

## Accomplishments

- **Task 1 (D-06):** `src/pages/Settings.tsx`'s Agent Profiles section rebuilt in place. The new `AgentProfileRows` component sources its row list from `useProfileConfigs()` (the real, populated `profileConfigs` table) instead of the legacy `agentProfiles` table (confirmed zero rows in production, `convex/profiles.ts:113`) — `agentProfiles` is now consulted only as an optional join for `displayName`/`avatarId`/the Edit button's target. The line-663 `{p.profileId} {p.model ? \`/ ${p.model}\` : ""}` stale synced-config read is genuinely deleted (`grep -cE 'p\.model' src/pages/Settings.tsx` returns 0), replaced by a live lookup into `useActiveEngine()`'s map: session-override (`Clock`/TTL) vs pinned-default (`Pin`) secondary line (D-02, never both), a pending suffix while a swap is in flight, the dashed `STUB` chip (D-16), and a `Swap` button (opening `BrainPicker` via its 103-06 `trigger`/`onPendingChange` composition API) kept visually and functionally distinct from the pre-existing `Edit` button.
- **Task 2 (D-05, corrected host):** `src/pages/Chat.tsx` gains a new composer brain pill row directly above the existing input row — the textarea, send button, and the pre-existing `swap.get_state`/`swap.state` global-axis wiring (lines ~171-238) are byte-unchanged. The pill scopes to the contract's `default_profile_id` via `brainsApi.getDefaultProfileId()` (103-CONTRACT.md §3), never an invented CodePulse-side active-profile mechanism. Label sourced exclusively from `useActiveEngine()` (D-14); pending overlay never touches the base label and drops cleanly with no error styling on the pill itself (D-15); provider-color dot (not the `Brain` icon `BrainControl` already uses on this page) keeps the pill visually distinct from the coexisting live global-axis badge (T-103-29).
- **Task 3 (D-04):** New `src/components/brains/BrainFallbackNotice.tsx` exports `useBrainFallbackNotice()`, subscribing to the contract's `brain.fallback` WS event (103-CONTRACT.md §5) via the exact `subscribeEvent`/cleanup idiom `Chat.tsx` already established for `"swap.state"`. Fires a warn-toned (`toast.warning`, never `toast.error`) `sonner` toast with an `ArrowRightLeft` icon and the Copywriting Contract's exact copy. A payload missing `cli_model`/`fallback_model` fires no half-formed toast (T-103-27). Mounted once in `Chat.tsx` alongside the pill. No `ChatBubble` changes (UI-SPEC §12's explicit carve-out).
- 39/39 new tests (11 Settings + 8 new Chat.tsx tests, 22 total in that file + 6 BrainFallbackNotice), `tsc --noEmit` clean, `npm run build` clean, full suite 2794/2794 passing (0 failures, no regression vs. the 2760 baseline — the +34 delta includes new tests from both this plan and the concurrently-active unrelated Phase-187 session).

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the stale Settings per-profile rows in place** — `8148c9d0` (feat)
2. **Task 2: Chat composer brain pill** — `4e3875f7` (feat)
3. **Task 3: CLI-to-API text-mode fallback notice** — `8c8b8240` (feat)

_No plan-metadata commit issued separately — this SUMMARY + STATE/ROADMAP updates are committed together per the final_commit step below._

## Files Created/Modified

- `src/pages/Settings.tsx` — `AgentProfileRows` (new, exported), `formatTtl` (new, local); Agent Profiles section rewired to it
- `src/pages/Settings.test.tsx` — 11 tests: live-engine-wins-over-config (2), row-source-is-profileConfigs (1), empty-state (1), session/pinned line (2), Swap-vs-Edit distinct controls (3), STUB chip on/off (2)
- `src/pages/Chat.tsx` — `BrainComposerPill` (new, local), `formatBrainTtl` (new, local), `brainDefaultProfileId` state/effect; new pill row above the input row; `useBrainFallbackNotice()` mounted
- `src/pages/Chat.test.tsx` — 8 new tests (composer pill: row placement, profile scoping, live label, trigger composition, pending/error honesty, session line, pinned line, STUB chip) added to the existing 14
- `src/components/brains/BrainFallbackNotice.tsx` — `useBrainFallbackNotice`
- `src/components/brains/BrainFallbackNotice.test.tsx` — 6 tests: fires-one-warn-toast, never-error-toned, unsubscribe-on-unmount, 3 malformed-payload guards (missing fallback_model / missing cli_model / no data)

## Decisions Made

- **`AgentProfileRows` sources its row list from `profileConfigs`, joins `agentProfiles` only optionally.** `agentProfiles` is confirmed empty in production — treating it as the primary source (as the old code implicitly did via `useAgentProfiles()`) would have kept the section showing "No custom agent profiles registered." even after the fix. The Edit button now targets whatever `agentProfiles` row (if any) matches the row's `profileId`; a row with no match gets a functionally inert Edit click (Sheet gates on `editingProfile !== null`) — this is a pre-existing `agentProfiles`-population gap, not something this plan's stale-read-removal scope is responsible for closing.
- **`BrainPicker.tsx` out-of-file-scope means the Settings row's scope selector cannot be hard-locked.** UI-SPEC §9 literally asks for "the scope selector hidden/locked" on the Settings row's Swap button. `BrainPicker.tsx` is not in this plan's `files_modified`, and it exposes no such prop. The picker still resets to "This profile" by default on every open (D-08's normal behavior), which satisfies the practical intent — a user could still manually flip to "All profiles" from a per-row Swap click. This is the identical class of accepted, documented nuance 103-05-SUMMARY.md already recorded for `BrainPickerRow.tsx`'s scope-unaware `needsConfirm` gate under the same file-scope constraint.
- **Both new surfaces fetch `brainsApi.getCatalogue()` independently** for the provider-identity dot color, mirroring `BrainHeaderBadge.tsx`'s (103-06) identical one-time-fetch-on-mount pattern rather than introducing a new shared catalogue-cache hook, which would have required a new file outside this plan's scope.
- **`formatTtl`/`formatBrainTtl` duplicated locally** in `Settings.tsx` and `Chat.tsx` (now three near-identical copies alongside `BrainHeaderBadge.tsx`'s original) rather than extracted to a shared util — no new shared module file is in this plan's `files_modified`, and the helper is five lines with zero external dependencies.
- **`BrainFallbackNotice` uses sonner's native `toast.warning(...)`**, not `toast(...)` with a manual `--status-warn` class — matches UI-SPEC's "graceful degrade, not a failure" framing in the actual toast API, not just styling.
- **`Settings.test.tsx` tests the exported `AgentProfileRows` component directly**, not the full `Settings` page (which also pulls in Privacy/Ambient contexts, Tabs, avatar upload, LLM provider config, notification channels — all orthogonal). No existing `Settings.test.tsx` precedent existed to extend; this file is new.
- **1 Rule-1 auto-fix:** a doc comment in `Settings.tsx` explaining the removed stale read quoted the literal substring `p.model`, which the plan's own zero-hit acceptance grep (`grep -cE 'p\.model' src/pages/Settings.tsx`) would have failed — the same failure class as 103-01's and 103-03's prior doc-comment-vs-grep-gate deviations. Reworded to paraphrase around the literal string ("the removed synced-config-field read this file's old line 663 used to render"); re-verified 0 hits, `tsc --noEmit` and both test suites still green.
- **BSC-01 and BSC-02 marked Complete in REQUIREMENTS.md.** BSC-01 ("no stale-config-as-live-state read anywhere in the brain-swap surface") is now genuinely true dashboard-wide — this plan removed the last live instance. BSC-02 ("the picker is reachable from every surface the design calls for") is complete now that all three hosts (header badge — 103-06; composer pill and Settings row — this plan) mount the same `BrainPicker`.
- **`STATE.md`/`ROADMAP.md` updated by hand, not via `gsd-sdk state.*`/`roadmap.update-plan-progress`** — per this project's established anti-clobber workaround, consistent with every prior Phase-103 plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Doc comment in Settings.tsx quoted the literal `p.model` substring the plan's own acceptance grep checks for zero hits of**
- **Found during:** Task 1, first acceptance-criteria grep pass after implementation
- **Issue:** A doc comment explaining the removed stale read wrote `\`p.model\` config read (this file's old line 663)`, which is itself a literal match for `grep -cE 'p\.model' src/pages/Settings.tsx` — the same gate meant to confirm the stale read is gone would report 1, not 0.
- **Fix:** Reworded to "the removed synced-config-field read this file's old line 663 used to render", preserving the explanation without the literal substring.
- **Files modified:** `src/pages/Settings.tsx`
- **Verification:** `grep -cE 'p\.model' src/pages/Settings.tsx` → 0; `tsc --noEmit` clean; `npx vitest run src/pages/Settings.test.tsx` still 11/11.
- **Committed in:** `8148c9d0` (Task 1's commit — caught and fixed before committing).

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Doc-comment-only fix; no production code path or test behavior affected. No scope creep.

## Issues Encountered

None beyond the deviation above. All three tasks' automated verification (`tsc --noEmit`, `npx vitest run`) passed after the one fix; `npm run build` clean; no auth gates, no checkpoints in this plan.

**Shared-checkout note:** per the session's explicit warning, another Claude session was actively working on unrelated Phase-187 `KnowledgeGraph` work in this same checkout throughout this plan. Verified before and after every commit (`git branch --show-current` = `master`, `git diff --cached --name-only` and `git show --stat HEAD` each confirmed to contain only this plan's own files) — no cross-contamination occurred; `src/pages/KnowledgeGraph.tsx`/`.test.tsx`, `src/components/kg/*`, `src/hooks/useKnowledgeGraph.ts`, `src/hooks/useSavedViews.ts(.test.ts)`, `src/lib/kgApi.ts(.test.ts)` were never touched by any of this plan's three commits. The full-suite run at the end of this plan (2794/2794, 0 failures) includes tests landed by that other session between this plan's commits, which is expected and out of this plan's scope.

## User Setup Required

None — no external service configuration required. This plan's stub-backed per-profile axis remains stub-backed (`VITE_BRAINS_STUB` unset defaults to the live adapter, which honestly no-ops with an error ack until Ástríðr Phase 184.1 ships — no change to that boundary in this plan).

## Next Phase Readiness

- All three of D-05's control-placement hosts (header badge — 103-06; composer pill and Settings row — this plan) now mount the same `BrainPicker` instance via its 103-06 composition API. No surface in the app hand-rolls a second picker.
- BSC-01 and BSC-02 marked Complete in `REQUIREMENTS.md`. BSC-03/BSC-04's pending/scope halves were already substantially covered by 103-04/103-05; BSC-05 remains reframed per axis (`103-CONTEXT.md`'s `<blocker_reframing>`) — global-axis live verification is 103-08's blocking checkpoint (Wave 5).
- Wave 4 of 5 is now fully complete (103-06 + 103-07). Next: `/gsd-execute-phase 103` resumes at Plan 08/8 (Wave 5, the blocking live-stack global-axis verification checkpoint).

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-28*

## Self-Check: PASSED

- FOUND: `src/pages/Settings.tsx`
- FOUND: `src/pages/Settings.test.tsx`
- FOUND: `src/pages/Chat.tsx`
- FOUND: `src/pages/Chat.test.tsx`
- FOUND: `src/components/brains/BrainFallbackNotice.tsx`
- FOUND: `src/components/brains/BrainFallbackNotice.test.tsx`
- FOUND commit `8148c9d0` in `git log --oneline --all`
- FOUND commit `4e3875f7` in `git log --oneline --all`
- FOUND commit `8c8b8240` in `git log --oneline --all`
- Full suite: 234 test files passed / 17 skipped (251), 2794 tests passed / 193 todo (2987), 0 failures — no regression vs. the 2760 baseline; `tsc --noEmit` clean; `npm run build` clean.
