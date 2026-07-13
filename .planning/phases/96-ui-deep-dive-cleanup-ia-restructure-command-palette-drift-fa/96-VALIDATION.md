---
phase: 96
slug: ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-13
updated: 2026-07-13
---

# Phase 96 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + `@testing-library/react` 16.3.2, jsdom 29.1.1 |
| **Config file** | `vite.config.ts` (Vitest config colocated with Vite config) |
| **Quick run command** | `npx vitest run src/<path>/<File>.test.tsx` |
| **Full suite command** | `npm test` (Vitest); Playwright `npm run test:e2e` is separate and not required per-task |
| **Estimated runtime** | ~60 seconds (full Vitest suite) |

---

## Sampling Rate

- **After every task commit:** Run targeted `npx vitest run <file>` for the file(s) touched
- **After every plan wave:** Run `npm test` (full Vitest suite)
- **Before `/gsd:verify-work`:** Full suite green + `npx tsc --noEmit` clean (this phase touches `anyApi`/`as any` typing, so a clean type-check is a meaningful gate)
- **Max feedback latency:** 90 seconds

---

## Wave-0 Handling (Nyquist)

There is **no separate Wave-0 gate** in this phase. Every MISSING test file is created **inline** as the RED half of a RED/GREEN task pair inside the plan that owns the surface, so no test creation is deferred:

- `Chat.test.tsx` — 96-03 Task 1 (RED)
- `Tasks.test.tsx` — 96-04 Task 1 (RED)
- `Security.test.tsx` + `Automation.test.tsx` — 96-06 Task 1 (RED)
- `MeetingBot.test.tsx` — 96-08 Task 1 (RED)
- `PageHeader.test.tsx` — 96-01 Task 1 (new component + its contract test)
- `FactsTable.test.tsx` — 96-07 Task 1 (RED)

`wave_0_complete: true` therefore means "wave-0 coverage is fully accounted for (folded into the RED tasks above); no test creation is left as a dangling prerequisite." Existing test files (`CommandPalette.test.tsx`, `DashboardLayout.test.tsx`, `Inbox.test.tsx`) are extended, not created. The 96-10 additions (KG/ToolGalaxy header migration, BuildProgress typing) are mechanical/type-level and gated by `npx tsc --noEmit` + grep assertions rather than a new RED test — no dangling prerequisite is introduced.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 96-01-T1 | 96-01 | 1 | F7 | — | N/A | unit | `npx vitest run src/components/__tests__/PageHeader.test.tsx` | 🆕 created inline | ⬜ pending |
| 96-02-T2 | 96-02 | 1 | F3 | T-96-02-01 | Header SYS/LAT render real data or nothing — never a fabricated number | unit | `npx vitest run src/layouts/__tests__/DashboardLayout.test.tsx` | ✅ (extend) | ⬜ pending |
| 96-03-T1 | 96-03 | 2 | F6 | T-96-03-03 | Chat sends `{type:"approval.respond", request_id_target, decision}` (NOT `{requestId, approved}`); ack error surfaces a toast | unit | `npx vitest run src/pages/__tests__/Chat.test.tsx` | 🆕 created inline (RED) | ⬜ pending |
| 96-03-T2 | 96-03 | 2 | F6 | T-96-03-03 | Shared approval component behaves identically from Chat and Inbox call sites | unit | `npx vitest run src/pages/__tests__/Chat.test.tsx src/pages/__tests__/Inbox.test.tsx` | ✅/🆕 | ⬜ pending |
| 96-04-T1 | 96-04 | 2 | F1/D-01/D-02 | — | N/A | unit | `npx vitest run src/pages/__tests__/Tasks.test.tsx` | 🆕 created inline (RED) | ⬜ pending |
| 96-04-T3 | 96-04 | 2 | F5 | — | N/A | build | `npx tsc --noEmit` + existing router tests | ✅ | ⬜ pending |
| 96-05-T1 | 96-05 | 2 | F2 | — | N/A | unit | `npx vitest run src/components/__tests__/CommandPalette.test.tsx` | ✅ (extend) | ⬜ pending |
| 96-06-T1/T2 | 96-06 | 2 | F4 / F9 / D-10 | T-96-06-01 | No fabricated "Valid" badge; Automation shows computed `CRON_SCHEDULES.length`; Infra unused vars gone | unit | `npx vitest run src/pages/__tests__/Security.test.tsx src/pages/__tests__/Automation.test.tsx` | 🆕 created inline (RED) | ⬜ pending |
| 96-07-T1 | 96-07 | 2 | F9 / D-09 / D-10 | — | N/A | unit | `npx vitest run src/components/__tests__/FactsTable.test.tsx` | 🆕 created inline (RED) | ⬜ pending |
| 96-08-T1 | 96-08 | 2 | F9 / D-10 | — | N/A | unit | `npx vitest run src/pages/__tests__/MeetingBot.test.tsx` | 🆕 created inline (RED) | ⬜ pending |
| 96-10-T1 | 96-10 | 2 | F10 / F7 | T-96-10-01/02 | KG + ToolGalaxy migrate to `<PageHeader>` (no bespoke h1, icon+tooltip preserved); DocComments tokenized + header; ThemeSwitcher gains `aria-label` | build | `npx tsc --noEmit` + Task-1 grep gates (`! grep 'text-2xl font-bold flex items-center gap-2'` on KG/ToolGalaxy; `grep PageHeader` on both) | ✅ | ⬜ pending |
| 96-10-T3 | 96-10 | 2 | F10 | T-96-10-03 | BuildProgress passes typed Convex props — no `as any`/`: any` escape hatch | build | `npx tsc --noEmit` + `! grep -qE 'as any\|: any' src/pages/BuildProgress.tsx` | ✅ | ⬜ pending |
| 96-11 / 96-12 | 96-11, 96-12 | 2 | F7 | — | N/A | build | `npx tsc --noEmit` (mechanical `<PageHeader>` sweep; typography contract owned by 96-01-T1) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · File Exists: ✅ present/extend · 🆕 created this phase*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat approval round-trip against live Ástríðr WS | F6 | Requires running astridr backend; jsdom mocks the WS layer | Start astridr + CodePulse dev, trigger an approval from Chat, confirm decision lands server-side (no 300s timeout) |
| F8 mobile master-detail collapse (ForgePage / WarRoom) | F8 | Responsive breakpoint behavior at 320px viewport not reliably assertable in jsdom | Resize to 320px; confirm the detail pane is usable (stacked or toggleable master) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or inline RED/GREEN wave-0 creation
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (folded into RED tasks; see Wave-0 Handling)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
</content>
