---
phase: 100
slug: control-surface-ux-menu-drag-lanes-optimistic-reconcile
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 100 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `100-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + `@testing-library/react` + jsdom |
| **Config file** | `vitest.config.ts` (existing, unchanged) |
| **Quick run command** | `npx vitest run <touched test files>` |
| **Full suite command** | `npm test` (~2447 tests as of Phase 99 — must stay green) |
| **Estimated runtime** | Quick: ~5–15s per file · Full: ~60–90s |

`fireEvent.dragStart/dragOver/drop` is proven working in this exact jsdom setup (`SkillRow.test.tsx:100`). No framework install needed.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test files>`
- **After every plan wave:** Run `npm test` (full suite — must stay green)
- **Before `/gsd:verify-work`:** Full suite green + `npx tsc --noEmit` clean
- **Max feedback latency:** ~15 seconds (quick run)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner (`{N}-{plan}-{task}`). Rows below are the requirement→behavior→test contract each task must satisfy; the planner/executor binds them to concrete task IDs.

| Requirement | Behavior to Verify | Test Type | Automated Command | File Exists | Status |
|-------------|--------------------|-----------|-------------------|-------------|--------|
| UX-01 | ⋯ menu renders scope-gated identically across `AllSkillsOverview`, `SkillsInCategory`, `ColdStorageView`, reconciled with `QuickDeck` | unit (render per surface) | `npx vitest run src/components/skills/AllSkillsOverview.test.tsx src/components/skills/ColdStorageView.test.tsx` | ✅ (audit/extend) | ⬜ pending |
| UX-01 | Drag is additive — menu still works after drag matrix lands | unit (regression) | `npx vitest run src/components/skills/SkillLifecycleMenu.test.tsx` | ✅ | ⬜ pending |
| UX-02 | Drop on Global/Cold fires `enqueueLifecycle` with correct `action`/`sourceOrigin`/`destination`, no dialog | unit (`fireEvent.drop` + mock `dataTransfer`) | `npx vitest run src/components/skills/ScopeRail.test.tsx` | ❌ W0 | ⬜ pending |
| UX-02 | Drop on Project opens `MoveToProjectDialog`, does NOT call `enqueueLifecycle` directly | unit | new `ScopeRail.test.tsx` / `Skills.test.tsx` | ❌ W0 | ⬜ pending |
| UX-02 | Invalid drop (cold/dormant→Project, multi-scope→any, own-scope→same) fires zero mutations | unit | same file | ❌ W0 | ⬜ pending |
| UX-02 | Extracted `resolveLifecycleActions` output matches the menu's inline computation for all 5 fixtures (activeGlobal/activeProject/dormant/multiScope/shadowedMerged) | unit | `npx vitest run src/lib/skills.test.ts` | ✅ (extend) | ⬜ pending |
| UX-03 | Pending map sets a `commandId`-correlated entry on drop, before mutation resolves | unit | new `usePendingLifecycleMoves.test.ts` | ❌ W0 | ⬜ pending |
| UX-03 | Reconcile clears pending on `done`; leaves it on `queued`/`executing` | unit | same file | ❌ W0 | ⬜ pending |
| UX-03 | Reconcile clears + toasts on `failed` (real refusal copy) and `expired` (reused expiry copy) | unit | same file | ❌ W0 | ⬜ pending |
| UX-03 | Synchronous LAYER-1 rejection (no row created) clears pending + toasts via `.catch()`, not the reconcile-effect (Pitfall 3 regression) | unit | same file | ❌ W0 | ⬜ pending |
| UX-04 | No `/manage-skills` string in the Cold Storage restore path | unit (regression) | `npx vitest run src/components/skills/ColdStorageView.test.tsx` | ✅ (`:61-64`, do not weaken) | ⬜ pending |
| UX-04 | In-app restore works end-to-end | **manual** (live Forge daemon) | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/hooks/usePendingLifecycleMoves.test.ts` — UX-03 (new hook, no existing coverage)
- [ ] `src/components/skills/ScopeRail.test.tsx` (or executor's component name) — UX-02 drop-target/matrix behavior; first-ever integration-level drop test on the Skills surface
- [ ] Extend `src/lib/skills.test.ts` (CONFIRMED exists) — `resolveLifecycleActions` cases mirroring the 5 `SkillLifecycleMenu.test.tsx` fixtures
- [ ] Optional backfill: `src/pages/__tests__/Skills.test.tsx` currently has ZERO drag/drop tests — a good opportunity to also cover the pre-existing `handleDropOnCategory` (not required)
- Framework install: **none** — Vitest/RTL/jsdom fully configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-app Cold Storage restore succeeds against the live daemon | UX-04 | Requires a running Forge daemon executing `lifecycle-exec` + rescan; same category as Phase 98's outstanding manual checks | Start daemon; drag a cold skill onto Global (or use ⋯ Restore); confirm pending → done, row settles as Global, filesystem restored |
| Drag round-trip fires the real mutation end-to-end | UX-02/UX-03 | jsdom asserts the handler + optimistic paint; live daemon confirms the actual archive/move/restore + reconcile | Drag active→Cold, active-global→Project (pick workspace), cold→Global; confirm each reconciles to done and rolls back honestly on a forced failure/expiry |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (usePendingLifecycleMoves, ScopeRail, skills.test.ts extension)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
