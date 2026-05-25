---
phase: 70-external-integrations-call-graph
plan: "01"
subsystem: external-integrations
tags: [email, pagerduty, call-graph, react-email, resend, schema, test-stubs]
dependency_graph:
  requires: []
  provides:
    - emailDeliveryLog.alertId optional (digest emails can log without alert)
    - DigestEmailTemplate React Email component
    - Wave 0 test stubs for all Phase 70 modules
  affects:
    - convex/deliveryLogs.ts
    - convex/schema.ts
tech_stack:
  added:
    - resend@6.12.3
    - "@react-email/components@1.0.12"
    - "@react-email/render@2.0.8"
  patterns:
    - React Email JSX components in convex/emailTemplates/
    - Optional Convex validator for nullable foreign keys
key_files:
  created:
    - convex/emailTemplates/DigestEmailTemplate.tsx
    - convex/emailDigest.test.ts
    - convex/pagerdutyDelivery.test.ts
    - src/components/CallGraphPanel.test.tsx
    - src/components/EmailDigestConfig.test.tsx
  modified:
    - convex/schema.ts
    - convex/deliveryLogs.ts
    - package.json
    - package-lock.json
decisions:
  - "alertId made optional (v.optional) rather than using a sentinel record — cleaner schema for digest emails that have no associated alert"
  - "@react-email/components installed at deprecated 1.0.12 (latest available) — still functional, React Email v2 consolidation is cosmetic not breaking"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-24"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 70 Plan 01: Foundation — Packages, Schema Patch, Test Stubs Summary

**One-liner:** Installed Resend + React Email SDK, patched emailDeliveryLog.alertId to optional for digest sends, created DigestEmailTemplate dark-themed component, and scaffolded four Wave 0 test stub files with 4 passing PagerDuty payload construction tests.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Install npm packages + patch schema | f544624 | package.json, convex/schema.ts, convex/deliveryLogs.ts |
| 2 | Create DigestEmailTemplate | 6fca922 | convex/emailTemplates/DigestEmailTemplate.tsx |
| 3 | Create Wave 0 test stubs | 28db8a0 | 4 test files |

## Verification Results

- `npx tsc --noEmit`: Passes for all new/modified files. Two pre-existing errors in `src/components/ObsidianGraph.tsx` and `src/lib/obsidian.ts` are unrelated to this plan (out of scope).
- `npx vitest run` on all 4 stub files: 4 passing (pagerduty payload construction), 33 todos, 0 failures.
- `package.json`: Contains `resend`, `@react-email/components`, `@react-email/render`.
- Schema: `emailDeliveryLog.alertId` is now `v.optional(v.id("alerts"))`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The four test files are intentionally stub-only. They will be implemented in subsequent plans:
- `convex/emailDigest.test.ts` — implemented in Plan 02 (email digest action)
- `convex/pagerdutyDelivery.test.ts` — implemented in Plan 02 (PagerDuty delivery action)
- `src/components/CallGraphPanel.test.tsx` — implemented in Plan 03 (call graph visualization)
- `src/components/EmailDigestConfig.test.tsx` — implemented in Plan 04 (email digest settings UI)

These stubs are intentional Wave 0 scaffolding — they satisfy Nyquist verification gates for downstream plans. The plan's goal (unblocking subsequent plans) is fully achieved.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-70-01, T-70-02).

## Self-Check: PASSED

- [x] `convex/emailTemplates/DigestEmailTemplate.tsx` exists and exports `DigestEmailTemplate`
- [x] `convex/emailDigest.test.ts` exists and contains `describe("emailDigest"`
- [x] `convex/pagerdutyDelivery.test.ts` exists and contains `describe("pagerdutyDelivery"`
- [x] `src/components/CallGraphPanel.test.tsx` exists and contains `describe("CallGraphPanel"`
- [x] `src/components/EmailDigestConfig.test.tsx` exists and contains `describe("EmailDigestConfig"`
- [x] Commit f544624 exists (Task 1)
- [x] Commit 6fca922 exists (Task 2)
- [x] Commit 28db8a0 exists (Task 3)
