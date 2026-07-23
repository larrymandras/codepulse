---
phase: 101
slug: reminders-calendar-command-center
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-22
reconstructed: true
reconstructed_from: "7 PLAN + 7 SUMMARY artifacts (State B — no VALIDATION.md existed at execution time)"
---

# Phase 101 — Validation Strategy

> Per-phase validation contract, reconstructed retroactively on 2026-07-22 from the phase's PLAN/SUMMARY artifacts and verified against live test runs. All suites were executed and green at audit time.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (codepulse: convex + React/jsdom) · pytest (astridr-repo) |
| **Config file** | codepulse `vitest` via vite config + `src/test/setup.ts`; astridr-repo pytest defaults |
| **Quick run command** | `npx vitest run convex/reminders.test.ts convex/remindersIngest.test.ts src/pages/Reminders.test.tsx` (codepulse) · `python -m pytest tests/tools/test_reminders.py tests/automation/test_calendar_cache.py tests/automation/test_reminder_nudge.py -q` (astridr-repo) |
| **Full suite command** | `npx vitest run` (codepulse) · `python -m pytest tests/` (astridr-repo) |
| **Estimated runtime** | ~3 s (codepulse quick) · <1 s (astridr quick) |

---

## Sampling Rate

- **After every task commit:** Run the owning repo's quick command (per-file vitest/pytest, as specified in each task's `<verify><automated>` block — every task carried one)
- **After every plan wave:** Full suite in the owning repo (observed in SUMMARYs: 2100/2100 → 2118/2118 codepulse; 1026 → 1037 astridr)
- **Before `/gsd:verify-work`:** Full suite green (satisfied — see 101-VERIFICATION.md / 101-RETEST-UAT.md)
- **Max feedback latency:** ~5 s

---

## Per-Task Verification Map

Audit-time run (2026-07-22): codepulse 81/81 green across the three mapped files; astridr-repo 49/49 green (30 + 10 + 9).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 101-01-01 | 01 | 1 | REM-01 | — | N/A (schema + indexes) | typecheck | `npx convex codegen && npx tsc -p convex/tsconfig.json --noEmit` | ✅ | ✅ green |
| 101-01-02 | 01 | 1 | REM-04 | — | until-bounded recurrence terminates (no infinite spawn) | unit | `npx vitest run convex/reminders.test.ts` | ✅ | ✅ green |
| 101-01-03 | 01 | 1 | REM-01, REM-04 | — | source stored verbatim, never a write gate (D-09) | unit | `npx vitest run convex/reminders.test.ts` | ✅ | ✅ green |
| 101-02-01 | 02 | 2 | CAL-01 | — | read-only cache table (D-02/D-03) | typecheck | `npx convex codegen && npx tsc -p convex/tsconfig.json --noEmit` | ✅ | ✅ green |
| 101-02-02 | 02 | 2 | REM-02 | T-101-01, T-101-02 | fail-closed auth on /reminders-ingest + /reminders-read (401 on missing/blank/unset/wrong key) | unit (`._handler`) | `npx vitest run convex/remindersIngest.test.ts` | ✅ | ✅ green |
| 101-02-03 | 02 | 2 | CAL-01 | T-101-01, T-101-04 | prune scoped to (profileId, calendarAccount); no Google write path | unit | `npx vitest run convex/remindersIngest.test.ts` | ✅ | ✅ green |
| 101-03-01 | 03 | 3 | REM-03 | T-101-05, T-101-07 | authed POSTs only; no Google credential/action in tool | unit (mocked HTTP) | `python -m pytest tests/tools/test_reminders.py -q` | ✅ | ✅ green |
| 101-03-02 | 03 | 3 | REM-03 | — | manifest tool_id == RemindersTool.name (no silent de-registration) | unit | `python -m pytest tests/tools/test_reminders.py -q` | ✅ | ✅ green |
| 101-04-01 | 04 | 3 | CAL-01 | T-101-08, T-101-10 | list_events only (never create_event); per-profile failure isolation | unit (mocked tools) | `python -m pytest tests/automation/test_calendar_cache.py -q` | ✅ | ✅ green |
| 101-04-02 | 04 | 3 | CAL-01 | — | cron registered in real scheduler (cron_builders/cron_dispatcher), fail-closed dispatch | unit | `python -m pytest tests/automation/test_calendar_cache.py tests/unit/engine/bootstrap/test_cron_dispatcher.py -q` | ✅ | ✅ green |
| 101-05-01 | 05 | 3 | REM-05 | T-101-11, T-101-12 | one nudge per occurrence (notifiedAt dedupe); business never reaches personal channel | unit (mocked HTTP + messenger) | `python -m pytest tests/automation/test_reminder_nudge.py -q` | ✅ | ✅ green |
| 101-05-02 | 05 | 3 | REM-04 | — | recurring rolls forward via op:complete; one-off never auto-completed | unit | `python -m pytest tests/automation/test_reminder_nudge.py -q` | ✅ | ✅ green |
| 101-06-01 | 06 | 3 | UI-01 | — | N/A (route + nav registration) | typecheck + grep | `npx tsc --noEmit` | ✅ | ✅ green |
| 101-06-02 | 06 | 3 | UI-01, UI-02 | T-101-03 | reminder/agent text renders as React text nodes (runtime + source-scan injection guard) | component (jsdom) | `npx vitest run src/pages/Reminders.test.tsx` | ✅ | ✅ green |
| 101-06-03 | 06 | 3 | CAL-02 | T-101-03 | overlay strictly read-only — no Google-write handler (source-scan test) | component (jsdom) | `npx vitest run src/pages/Reminders.test.tsx` | ✅ | ✅ green |
| 101-07-01 | 07 | 4 | UI-02, CAL-02 | — | N/A (RED regression test — UAT test 8) | component (jsdom) | `npx vitest run src/pages/Reminders.test.tsx` | ✅ | ✅ green |
| 101-07-02 | 07 | 4 | UI-02, CAL-02 | — | N/A (day-filter exemption for undated rows) | component (jsdom) | `npx vitest run src/pages/Reminders.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement Coverage Rollup

| Requirement | Covering tests | Status |
|-------------|---------------|--------|
| REM-01 (Convex store, realtime) | `convex/reminders.test.ts` (23) + `src/pages/Reminders.test.tsx` realtime-query tests | COVERED |
| REM-02 (authed HTTP surface) | `convex/remindersIngest.test.ts` (44, incl. op:snooze/op:markNotified gap-closure block) | COVERED |
| REM-03 (Ástríðr tool) | astridr `tests/tools/test_reminders.py` (30, incl. real-snooze contract tests) | COVERED |
| REM-04 (recurrence, build + runtime) | `convex/reminders.test.ts` recurrence matrix + astridr `test_reminder_nudge.py` roll tests | COVERED |
| REM-05 (proactive nudge, deduped) | astridr `test_reminder_nudge.py` (9) + markNotified dispatch tests (codepulse) | COVERED |
| CAL-01 (calendar cache pipeline) | `convex/remindersIngest.test.ts` upsert+prune + astridr `test_calendar_cache.py` (10) | COVERED |
| CAL-02 (calendar overlay) | `src/pages/Reminders.test.tsx` (14) overlay/chip/read-only tests | COVERED |
| UI-01 (Reminders page, profile-segmented) | `src/pages/Reminders.test.tsx` profile-segmentation tests | COVERED |
| UI-02 (quick actions, optimistic, a11y) | `src/pages/Reminders.test.tsx` quick-action/optimistic/day-filter tests | COVERED |

Mid-phase contract gaps flagged in SUMMARYs (op:"snooze" missing from /reminders-ingest; notifiedAt not settable) were both closed and test-pinned: `convex/remindersIngest.test.ts` L193+ ("op:snooze + op:markNotified — Phase 101 gap closure") and astridr `test_reminders.py` real-snooze tests.

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. (vitest + the `._handler`/`*Handler` unit-test patterns in codepulse; pytest + mocked-HTTP/tool patterns in astridr-repo. No framework installs were needed.)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live calendar populate for all 3 profiles + stale-prune next cycle | CAL-01 | Needs live Google OAuth creds + deployed cron | Run `calendar_cache.refresh()` once against real Google + Convex; confirm `calendarEvents` rows for all three profiles; drop an event, confirm prune next cycle. Covered by UAT (101-UAT.md / 101-RETEST-UAT.md). |
| Live Telegram nudge on the correct profile channel, exactly once | REM-05 | Needs deployed astridr + live Telegram channels | Create a reminder due in 1 min via the tool; confirm one nudge on the right profile channel and `notifiedAt` set; recurring spawns next occurrence. Covered by UAT. |
| Live UI pass (accents per profile, realtime cross-surface appearance, reduced-motion) | UI-01, UI-02, CAL-02 | Visual/live-browser behavior | `npm run dev` + backend; switch all 3 profiles; create via Ástríðr and watch it appear without refresh; verify prefers-reduced-motion. Covered by UAT (9 passed + test 8 gap closed by plan 07, re-tested in 101-RETEST-UAT.md). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (17/17 tasks carried an `<automated>` block)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — no MISSING)
- [x] No watch-mode flags (all commands use `vitest run` / one-shot pytest)
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-22 (retroactive audit — 0 gaps found, 0 tests generated, all suites verified green at audit time)

---

## Validation Audit 2026-07-22

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State B reconstruction: no VALIDATION.md existed; this file was built from 101-01..07 PLAN/SUMMARY artifacts. Every requirement classified COVERED — no gsd-nyquist-auditor spawn was needed. Live verification: codepulse 81/81 (3 files), astridr-repo 49/49 (3 files), all green.
