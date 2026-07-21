---
phase: 98
slug: skill-lifecycle-mutations-archive-restore-move-delete
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-21
---

# Phase 98 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (codepulse) / vitest (astridr-repo forge) |
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
| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-1 | 98-01 | 1 | LIFE-01..06 | T-98-01/05 | isSafeSkillName rejects traversal; schema migration-free | unit | `npx vitest run convex/forge.test.ts -t "isSafeSkillName"` (codepulse) | ✅ forge.test.ts | ⬜ pending |
| 01-2 | 98-01 | 1 | LIFE-01..06 | T-98-02/05/06 | Clerk fail-closed + pre-flight shadow/collision/cold-only refusals | unit | `npx vitest run convex/forge.test.ts -t "enqueueLifecycle"` | ✅ forge.test.ts | ⬜ pending |
| 01-3 | 98-01 | 1 | LIFE-05/06 | T-98-06 | lifecycle-refused adapter → house copy; scoped list query | unit | `npx vitest run convex/forge.test.ts -t "lifecycle"` | ✅ forge.test.ts | ⬜ pending |
| 02-1 | 98-02 | 1 | LIFE-01..05, DAEMON-02 | T-98-01/02/03/04 | native fs move, cross-volume fallback, cold-only delete, reparse scan | unit | `npx vitest run src/process/lifecycle-exec.test.ts` (forge) | ❌ Wave 0 (create) | ⬜ pending |
| 02-2 | 98-02 | 1 | DAEMON-02, LIFE-06 | T-98-03 | executeLifecycle ack+rescan on done only; per-name mutex | unit | `npx vitest run src/emit/command-poller.test.ts` (forge) | ✅ command-poller.test.ts | ⬜ pending |
| 02-3 | 98-02 | 1 | LIFE-03, DAEMON-02 | T-98-01 | lifecycleFn wired, supportedTypes advertised, fresh workspace list | typecheck | `npx tsc --noEmit` (forge) | n/a | ⬜ pending |
| 03-1 | 98-03 | 2 | LIFE-06 | T-98-SC | dropdown-menu from first-party radix-ui; useLifecycle status model | unit | `npx vitest run src/hooks/useLifecycle.test.ts` | ❌ Wave 0 (create) | ⬜ pending |
| 03-2 | 98-03 | 2 | LIFE-03 | — | workspace picker, no class filter, move enqueue | unit | `npx vitest run src/components/skills/MoveToProjectDialog.test.tsx` | ❌ Wave 0 (create) | ⬜ pending |
| 03-3 | 98-03 | 2 | LIFE-04 | T-98-07 | type-to-confirm gate, case-sensitive, no pre-fill | unit | `npx vitest run src/components/skills/DeleteSkillDialog.test.tsx` | ❌ Wave 0 (create) | ⬜ pending |
| 04-1 | 98-04 | 3 | LIFE-01/02/03/04/05/06 | T-98-08/09 | scope-gating, shadow-disabled Restore, multi-scope guard, badge | unit | `npx vitest run src/components/skills/SkillLifecycleMenu.test.tsx` | ❌ Wave 0 (create) | ⬜ pending |
| 04-2 | 98-04 | 3 | LIFE-01/02/04 | — | always-visible trigger; Cold Storage copy refresh | unit | `npx vitest run src/components/skills/SkillRow.test.tsx src/components/skills/ColdStorageView.test.tsx` | ⚠ SkillRow ✅ / ColdStorageView ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `C:/Users/mandr/forge/src/process/lifecycle-exec.test.ts` — new module + test (path resolution, collision/shadow re-check, cross-volume fallback via injected fake renameFn, cold-only delete) — Plan 98-02 Task 1
- [ ] `src/hooks/useLifecycle.test.ts` — new hook test (mapLifecycleStatus, adapter, per-skill lookup) — Plan 98-03 Task 1
- [ ] `src/components/skills/MoveToProjectDialog.test.tsx` — new — Plan 98-03 Task 2
- [ ] `src/components/skills/DeleteSkillDialog.test.tsx` — new — Plan 98-03 Task 3
- [ ] `src/components/skills/SkillLifecycleMenu.test.tsx` — new — Plan 98-04 Task 1
- [ ] `src/components/skills/ColdStorageView.test.tsx` — new (does not exist today) — Plan 98-04 Task 2
- Existing coverage reused: convex/forge.test.ts, forge command-poller.test.ts, src/lib/skills.test.ts (isShadowing/isDormant), IntakeStatusBadge.test.tsx (badge states), SkillRow.test.tsx

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real cross-volume move (C: global/cold ↔ G:\ project workspace) | LIFE-03 | The copy+delete fallback vs Google Drive virtual FS cannot be proven by a same-host unit test (fake renameFn covers the branch; the real Drive mount interaction needs a live check) | Move a skill to a synced project workspace and back; confirm the dir relocated on disk and the Skills page lane changed after rescan |
| Archive/restore/delete round-trip live | LIFE-01/02/04, DAEMON-02 | Requires a running daemon + live rescan | Archive a global skill (moves to skills-available, lane flips), restore it, then permanently delete a cold row (type-to-confirm); confirm host filesystem + Skills page agree |
| Offline-daemon expiry | LIFE-06 | Requires stopping the daemon and watching TTL | With the daemon stopped, issue an archive; confirm the row shows queued/will-expire and never a false success |
| Menu scope-gating live | LIFE-05, D-07 | Visual/interaction | Verify ⋯ items per row type: active (Archive + one Move), dormant (Restore + Delete), shadowed (Restore disabled + tooltip), multi-scope (Archive/Move disabled + reason) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
