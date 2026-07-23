---
phase: 99
slug: skill-launch-dispatch
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-23
---

# Phase 99 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 99-RESEARCH.md "Validation Architecture". Zero new dependencies — Vitest is already configured.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom), existing `src/test/setup.ts` mocks (Clerk, Recharts, Three.js, Globe, React Flow, Tone.js) |
| **Config file** | `vitest.config.ts` (existing — no install) |
| **Quick run command** | `npx vitest run <touched-file>.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60s full suite (204+ test files per Phase 98 precedent) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched-file>.test.tsx` for the touched component
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Plan | Wave | Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|----------|------------|-----------|-------------------|-------------|--------|
| 99-01 | 1 | LAUNCH-01/02/03 | `useAstridrChat.sendMessage` spreads `profile` onto `chat.send` only when present; `ForgeLaunchModal` prefills `initialPrompt`; shared `skillRun.ts` contract + last-pick localStorage | T-99-persona-escalation | unit | `npx vitest run src/hooks/useAstridrChat.test.ts src/components/forge/ForgeLaunchModal.test.tsx` | ✅ (extend existing) | ⬜ pending |
| 99-02 | 2 | LAUNCH-01/03 | Chat.tsx mount-triggered auto-send fires a real `chat.send` from the `AutoSendHandoff` router state, StrictMode-safe (no double-send), `recordSkillLaunch` on confirmed send only | — | unit | `npx vitest run src/pages/Chat.test.tsx` | ❌ W0 (new file) | ⬜ pending |
| 99-03 | 2 | LAUNCH-01/03 | RunChatPopover/RunAstridrPopover are pure captures — submit calls `onSubmit(text[, profile])`; Escape/outside-click discards with ZERO side effects; negative assertion: no "answered as {persona}" copy (D-14a honesty) | — | unit | `npx vitest run src/components/skills/RunChatPopover.test.tsx src/components/skills/RunAstridrPopover.test.tsx` | ❌ W0 (new files) | ⬜ pending |
| 99-04 | 3 | LAUNCH-02/04 | `SkillLaunchProvider` hosts one page-level `ForgeLaunchModal`; `enqueueLaunch` Clerk fail-closed gate untouched; `RunTargetChooser`/`useRunLaunch` remembers last pick; Forge launch records once | T-99-forge-auth-regress | unit | `npx vitest run src/components/skills/RunTargetChooser.test.tsx` | ❌ W0 (new file) | ⬜ pending |
| 99-05 | 4 | LAUNCH-04 | `SkillLifecycleMenu` gains Run submenu; QuickDeck primary-click = Run, copy = secondary icon; copy no longer calls `recordSkillLaunch` (D-13) | — | unit | `npx vitest run src/components/skills/QuickDeck.test.tsx` | ✅ (add copy-does-NOT-record case) | ⬜ pending |
| 99-06 | 5 | LAUNCH-04 | Skills.tsx wraps provider; copy-recording retired + `/chat?skill=` dead-end removed across SkillRow/palette/ColdStorageView/AllSkillsOverview/SkillsInCategory; full-suite tsc gate closes 99-05's transient gap | — | unit | `npm test` (full suite) | ✅ / ❌ W0 (Skills.test.tsx) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/pages/Chat.test.tsx` — new file for the auto-send-on-mount effect (LAUNCH-01/03)
- [ ] `src/components/skills/RunChatPopover.test.tsx` — new (LAUNCH-01)
- [ ] `src/components/skills/RunAstridrPopover.test.tsx` — new, incl. negative "answered as" assertion (LAUNCH-03)
- [ ] `src/components/skills/RunTargetChooser.test.tsx` — new (LAUNCH-04)
- [ ] `src/pages/Skills.test.tsx` — verify does not exist (`ls src/pages/*.test.tsx`) before assuming coverage for `handleRecordUse`/`handleOpenInChat` changes; create if absent (LAUNCH-04)
- [ ] `QuickDeck.test.tsx` / `SkillCommandPalette.test.tsx` — add "copy does NOT call recordSkillLaunch" regression cases (D-13)
- [ ] Framework install: **none** — Vitest already configured

*Existing infrastructure covers the framework; the gaps above are new/extended test files, not tooling.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Chat auto-send round-trip streams a live turn | LAUNCH-01 | jsdom cannot exercise a real WebSocket to a live astridr backend (97/98 precedent) | Dev server up; Run → Chat → type args → Enter; confirm the turn is actually sent and streams (composer never left prefilled-and-waiting) |
| Ástríðr persona-scoped send reaches the backend with the picked `profile` | LAUNCH-03 | Same WS limitation | Run → Ástríðr → pick persona → send; confirm `chat.send` carries the chosen `profile` (network/telemetry), and that copy never claims a different persona *answered* |
| Forge agent run enqueues and the daemon executes the skill | LAUNCH-02 | Requires a live Forge daemon + synced workspace | Run → Forge → pick agent/workspace/mode with `/skill …` prefilled → submit; confirm the run appears and executes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (all commands are `vitest run` / `npm test`, non-watch)
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-23
