---
phase: 66
slug: gateway-compatibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 66 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `vite.config.ts` (vitest block) |
| **Quick run command** | `npx vitest run convex/__tests__/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/__tests__/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green (minus 12 pre-existing skills test failures)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 66-01-01 | 01 | 0 | GW-01 | T-66-01 | OTel default uses "unknown" not "anthropic" | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ W0 | ⬜ pending |
| 66-01-02 | 01 | 0 | GW-01 | — | `toolExecutions.insert` accepts optional `provider` field | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ❌ W0 | ⬜ pending |
| 66-02-01 | 02 | 1 | GW-02 | T-66-02 | `gateway.task_completed` routes to `toolExecutions` not `events` | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ W0 | ⬜ pending |
| 66-02-02 | 02 | 1 | GW-02 | — | `gateway.task_failed` routes to `toolExecutions` with success=false | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ W0 | ⬜ pending |
| 66-03-01 | 03 | 2 | GW-03 | — | `providerHealth.latest` returns records for all 4 gateway providers | unit | `npx vitest run convex/__tests__/providerRegistry.test.ts` | ❌ W0 | ⬜ pending |
| 66-04-01 | 04 | 1 | GW-04 | — | Existing `tool_result` and `api_request` routes continue correctly | unit | `npx vitest run convex/__tests__/otelLogs.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/__tests__/otelLogs.test.ts` — stubs for GW-01 default fix, GW-02 gateway routing, GW-04 regression
- [ ] `convex/__tests__/providerRegistry.test.ts` — stubs for provider registry shape, GW-01 provider field on toolExecutions, GW-03 dynamic query

*Existing vitest infrastructure covers all needs. No framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ProviderHealthPanel shows all 4 providers | GW-03 | Visual UI rendering requires browser | Start dev server, navigate to health panel, confirm 4 cards render |
| CLIGatewayTool telemetry emission (Astridr-side) | GW-02 | Cross-repo integration requires running gateway | Route a task through gateway, check CodePulse ingest receives event |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
