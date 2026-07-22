---
phase: 98
slug: skill-lifecycle-mutations-archive-restore-move-delete
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-21
validated: 2026-07-22
---

# Phase 98 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (codepulse) / vitest (C:/Users/mandr/forge) |
| **Config file** | vite.config / vitest config per repo |
| **Quick run command** | `npx vitest run <changed test file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <changed test file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-1 | 98-01 | 1 | LIFE-01..06 | T-98-01/05 | isSafeSkillName rejects traversal; schema migration-free | unit | `npx vitest run convex/forge.test.ts -t "isSafeSkillName"` (codepulse) | ✅ forge.test.ts | ✅ green |
| 01-2 | 98-01 | 1 | LIFE-01..06 | T-98-02/05/06 | Clerk fail-closed + pre-flight shadow/collision/cold-only refusals | unit | `npx vitest run convex/forge.test.ts -t "enqueueLifecycle"` | ✅ forge.test.ts | ✅ green |
| 01-3 | 98-01 | 1 | LIFE-05/06 | T-98-06 | lifecycle-refused adapter → house copy; scoped list query | unit | `npx vitest run convex/forge.test.ts -t "lifecycle"` | ✅ forge.test.ts | ✅ green |
| 02-1 | 98-02 | 1 | LIFE-01..05, DAEMON-02 | T-98-01/02/03/04 | native fs move, cross-volume fallback, cold-only delete, reparse scan | unit | `npx vitest run src/process/lifecycle-exec.test.ts` (forge) | ✅ lifecycle-exec.test.ts | ✅ green |
| 02-2 | 98-02 | 1 | DAEMON-02, LIFE-06 | T-98-03 | executeLifecycle ack+rescan on done only; per-name mutex | unit | `npx vitest run src/emit/command-poller.test.ts` (forge) | ✅ command-poller.test.ts | ✅ green |
| 02-3 | 98-02 | 1 | LIFE-03, DAEMON-02 | T-98-01 | lifecycleFn wired, supportedTypes advertised, fresh workspace list | typecheck | `npx tsc --noEmit` (forge) | n/a | ✅ green |
| 03-1 | 98-03 | 2 | LIFE-06 | T-98-SC | dropdown-menu from first-party radix-ui; useLifecycle status model | unit | `npx vitest run src/hooks/useLifecycle.test.ts` | ✅ useLifecycle.test.ts | ✅ green |
| 03-2 | 98-03 | 2 | LIFE-03 | — | workspace picker, no class filter, move enqueue | unit | `npx vitest run src/components/skills/MoveToProjectDialog.test.tsx` | ✅ MoveToProjectDialog.test.tsx | ✅ green |
| 03-3 | 98-03 | 2 | LIFE-04 | T-98-07 | type-to-confirm gate, case-sensitive, no pre-fill | unit | `npx vitest run src/components/skills/DeleteSkillDialog.test.tsx` | ✅ DeleteSkillDialog.test.tsx | ✅ green |
| 04-1 | 98-04 | 3 | LIFE-01/02/03/04/05/06 | T-98-08/09 | scope-gating, shadow-disabled Restore, multi-scope guard, badge | unit | `npx vitest run src/components/skills/SkillLifecycleMenu.test.tsx` | ✅ SkillLifecycleMenu.test.tsx | ✅ green |
| 04-2 | 98-04 | 3 | LIFE-01/02/04 | — | always-visible trigger; Cold Storage copy refresh | unit | `npx vitest run src/components/skills/SkillRow.test.tsx src/components/skills/ColdStorageView.test.tsx` | ✅ both exist | ✅ green |
| 05-1 | 98-05 | 4 | LIFE-03/04, DAEMON-02/03 | T-98-10 | buildSkillSnapshot declares scannedOrigins manifest; unreachable root declared nowhere | unit | `npx vitest run src/emit/skill-rescan.test.ts` (forge) | ✅ skill-rescan.test.ts | ✅ green |
| 05-2 | 98-05 | 4 | LIFE-03/04, DAEMON-03 | T-98-11 | computeSkillPrunes prunes declared-but-empty origins; legacy no-manifest path byte-identical; empty snapshot cannot wipe registry | unit | `npx vitest run convex/__tests__/skillSync.test.ts` (codepulse) | ✅ skillSync.test.ts | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `C:/Users/mandr/forge/src/process/lifecycle-exec.test.ts` — new module + test (path resolution, collision/shadow re-check, cross-volume fallback via injected fake renameFn, cold-only delete) — Plan 98-02 Task 1
- [x] `src/hooks/useLifecycle.test.ts` — new hook test (mapLifecycleStatus, adapter, per-skill lookup) — Plan 98-03 Task 1
- [x] `src/components/skills/MoveToProjectDialog.test.tsx` — new — Plan 98-03 Task 2
- [x] `src/components/skills/DeleteSkillDialog.test.tsx` — new — Plan 98-03 Task 3
- [x] `src/components/skills/SkillLifecycleMenu.test.tsx` — new — Plan 98-04 Task 1
- [x] `src/components/skills/ColdStorageView.test.tsx` — new (did not exist at draft time) — Plan 98-04 Task 2
- Existing coverage reused: convex/forge.test.ts, forge command-poller.test.ts, src/lib/skills.test.ts (isShadowing/isDormant), IntakeStatusBadge.test.tsx (badge states), SkillRow.test.tsx

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real cross-volume move (C: global/cold ↔ G:\ project workspace) | LIFE-03 | The copy+delete fallback vs Google Drive virtual FS cannot be proven by a same-host unit test (fake renameFn covers the branch; the real Drive mount interaction needs a live check) | Move a skill to a synced project workspace and back; confirm the dir relocated on disk and the Skills page lane changed after rescan |
| Archive/restore/delete round-trip live | LIFE-01/02/04, DAEMON-02 | Requires a running daemon + live rescan | Archive a global skill (moves to skills-available, lane flips), restore it, then permanently delete a cold row (type-to-confirm); confirm host filesystem + Skills page agree |
| Offline-daemon expiry | LIFE-06 | Requires stopping the daemon and watching TTL | With the daemon stopped, issue an archive; confirm the row shows queued/will-expire and never a false success |
| Menu scope-gating live | LIFE-05, D-07 | Visual/interaction | Verify ⋯ items per row type: active (Archive + one Move), dormant (Restore + Delete), shadowed (Restore disabled + tooltip), multi-scope (Archive/Move disabled + reason) |
| Stale-origin prune live re-run of the original UAT repro | LIFE-03/04, DAEMON-03 | Requires a live Forge daemon + live Google Drive mount (Plan 98-05 gap closure) | Delete the residual `uat-ws-placeholder` skill from the G: workspace, trigger a rescan, confirm the stale `claude-code:project:<key>` row disappears from the Skills page |
| Unreachable-mount prune safety valve (negative check) | DAEMON-03, T-98-10 | Requires pausing the live G: mount mid-scan | With the G: mount paused/unavailable, trigger a rescan; confirm the workspace's origin is NOT declared in scannedOrigins and its rows are NOT pruned |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-22 (retroactive audit via /gsd-validate-phase)

---

## Validation Audit 2026-07-22

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Audit run (State A — existing VALIDATION.md, all statuses pending at audit start):

- **codepulse:** `npx vitest run` over the 8 mapped files (forge.test.ts, skillSync.test.ts, useLifecycle, MoveToProjectDialog, DeleteSkillDialog, SkillLifecycleMenu, SkillRow, ColdStorageView) — **8 files, 262 passed, 0 failed** (21 `it.todo` stubs in forge.test.ts are all pre-Phase-98 launch/intake integration items requiring a live Convex runtime; none map to LIFE-01..06 or DAEMON-02/03)
- **forge:** `npx vitest run` over lifecycle-exec.test.ts, command-poller.test.ts, skill-rescan.test.ts — **3 files, 83 passed, 0 failed**; `npx tsc --noEmit` clean
- All six Wave 0 test files were created during execution as planned; no test generation needed
- Map amended: added rows 05-1/05-2 for Plan 98-05 (stale-origin prune gap closure, landed after this file was drafted) and its two outstanding live manual checks to Manual-Only
