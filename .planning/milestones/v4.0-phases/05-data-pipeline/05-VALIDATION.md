---
phase: 5
slug: data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run convex/ src/hooks/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/aggregates.test.ts convex/archival.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DP-01 | — | N/A | unit | `npx vitest run convex/aggregates.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DP-01 | — | N/A | unit | `npx vitest run convex/aggregates.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | DP-03 | T-05-01 | Retention clamped 1-365 days | unit | `npx vitest run convex/archival.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | DP-03 | T-05-02 | Retention clamped 1-365 days | unit | `npx vitest run convex/archival.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 3 | DP-02 | — | N/A | unit | `npx vitest run convex/aggregates.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 4 | DP-04 | — | N/A | unit | `npx vitest run src/hooks/useRecentEvents.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/aggregates.test.ts` — stubs for DP-01, DP-02 (computeHourly, rollupDaily, aggregate queries)
- [ ] `convex/archival.test.ts` — stubs for DP-03 (markStaleArchived, retention config)
- [ ] `src/hooks/useRecentEvents.test.ts` — stubs for DP-04 (paginated hook shape)

*Existing test infrastructure (Vitest) is already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cron jobs appear in Convex dashboard | DP-01 | Requires deployed Convex backend | Check Convex dashboard → Cron Jobs tab after deploy |
| Infinite scroll UX on list pages | DP-04 | Visual interaction test | Load any list page, scroll to bottom, verify "Load more" appears and loads next batch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
