---
phase: 59
slug: schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run convex/callGraphEdges.test.ts convex/deliveryLogs.test.ts convex/llm.test.ts convex/alertRuleCustom.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/callGraphEdges.test.ts convex/deliveryLogs.test.ts convex/llm.test.ts convex/alertRuleCustom.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 59-01-01 | 01 | 0 | SCH-01 | — | N/A | unit | `npx vitest run convex/callGraphEdges.test.ts -x` | ❌ W0 | ⬜ pending |
| 59-01-02 | 01 | 0 | SCH-02 | — | N/A | unit | `npx vitest run convex/llm.test.ts -x` | ❌ W0 | ⬜ pending |
| 59-01-03 | 01 | 0 | SCH-03 | — | N/A | unit | `npx vitest run convex/alertRuleCustom.test.ts -x` | ❌ W0 | ⬜ pending |
| 59-01-04 | 01 | 0 | SCH-04 | — | N/A | unit | `npx vitest run convex/deliveryLogs.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/callGraphEdges.test.ts` — stubs for SCH-01 upsert logic
- [ ] `convex/deliveryLogs.test.ts` — stubs for SCH-04 insert arg shapes
- [ ] `convex/llm.test.ts` — stubs for SCH-02 optional field + backfill batch logic
- [ ] `convex/alertRuleCustom.test.ts` — stubs for SCH-03 new validator args

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backfill mutation completes on historical data | SCH-02 (D-12) | Requires live Convex database with historical rows | Run `npx convex run llm:backfillAgentId` repeatedly until `{ processed: 0 }` |
| Schema deploys without errors | All | Requires Convex deployment | Run `npx convex dev` and verify no schema errors in dashboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
