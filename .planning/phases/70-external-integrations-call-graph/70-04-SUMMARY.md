---
phase: 70-external-integrations-call-graph
plan: "04"
subsystem: ui-integration
tags: [email-digest, pagerduty, call-graph, settings, infrastructure, alert-rules]
dependency_graph:
  requires:
    - 70-02 (emailDigest + deliveryLogs + pagerdutyDelivery Convex functions)
    - 70-03 (CallGraphPanel + CallGraphSVG components)
  provides:
    - EmailDigestConfig component wired to api.emailDigest
    - DeliveryHistory component wired to api.deliveryLogs
    - AlertRuleForm extended with PagerDuty collapsible section
    - Infrastructure page extended with CallGraphPanel
  affects:
    - src/pages/Settings.tsx
    - src/pages/Infrastructure.tsx
    - src/components/AlertRuleForm.tsx
tech_stack:
  added: []
  patterns:
    - SectionErrorBoundary wrapping every new widget (Infrastructure pattern)
    - Collapsible per-rule config section (AlertRuleForm pattern)
    - Tabs for multi-channel delivery log views (DeliveryHistory)
key_files:
  created:
    - src/components/EmailDigestConfig.tsx
    - src/components/DeliveryHistory.tsx
  modified:
    - src/pages/Settings.tsx
    - src/pages/Infrastructure.tsx
    - src/components/AlertRuleForm.tsx
    - src/components/EmailDigestConfig.test.tsx
decisions:
  - "EmailDigestConfig and DeliveryHistory placed in SectionErrorBoundary wrappers on Settings page — consistent with NotificationChannels and NotificationPreferences pattern"
  - "CallGraphPanel placed after GithubActionsPanel section per UI-SPEC layout contract (D-10)"
  - "PagerDuty collapsible defaults to closed; open state local to form sheet lifecycle"
  - "pdEnabled=false means pagerdutyConfig=undefined in mutation args — backend skips silently (T-70-10 mitigation)"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 3
---

# Phase 70 Plan 04: UI Integration Summary

**One-liner:** Wired EmailDigestConfig + DeliveryHistory into Settings page and PagerDuty collapsible section into AlertRuleForm, plus CallGraphPanel added to Infrastructure page — completing all three Phase 70 features end-to-end.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create EmailDigestConfig + DeliveryHistory + wire Settings page | a82eac0 | src/components/EmailDigestConfig.tsx, src/components/DeliveryHistory.tsx, src/pages/Settings.tsx, src/components/EmailDigestConfig.test.tsx, convex/_generated/api.d.ts |
| 2 | Add PagerDuty section to AlertRuleForm + CallGraphPanel to Infrastructure | bd04704 | src/components/AlertRuleForm.tsx, src/pages/Infrastructure.tsx |

## Verification Results

- `npx tsc --noEmit`: Passes (only pre-existing ObsidianGraph.tsx/obsidian.ts errors, confirmed pre-existing in Plans 02 and 03)
- `npx vitest run`: 75 test files passing, 562 tests passing, 0 failures, 150 todos

## Checkpoint: Visual Verification (Task 3)

**Status:** Awaiting human verification

Task 3 is a `checkpoint:human-verify` gate. The two auto tasks are complete. Visual verification is required before Phase 70 can be marked complete.

### Steps to verify

1. Start dev servers: `npm run dev` and `npm run dev:backend`

2. **Infrastructure page** (http://localhost:5173/infrastructure):
   - Scroll past GitHub Actions — verify "AGENT CALL GRAPH" section appears
   - If call graph edges exist in DB: nodes render with top-down layout
   - If no edges: verify "No call graph data" empty state appears
   - Verify legend shows "Healthy", "Errored", "Pending" with colored dots

3. **Settings page** (http://localhost:5173/settings):
   - Scroll to Notification Channels area
   - Verify "EMAIL DIGEST" section appears with schedule dropdown, toggle, and Save button
   - Test saving — toast should show "Digest settings saved."
   - Verify "DELIVERY HISTORY" section appears with Email / PagerDuty tabs
   - Verify empty state message shows when no delivery logs exist

4. **Alert Rule Form** (Alerts page → create or edit a custom rule):
   - Verify collapsible "PagerDuty" section appears after conditions
   - Expand it — verify toggle "Send PagerDuty incident", routing key input, severity override select
   - Toggle PagerDuty on — verify routing key and severity fields appear
   - Save the rule — verify no errors

5. TypeScript: `npx tsc --noEmit` passes
6. Tests: `npm test` passes

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All components are wired to live Convex queries and mutations.

## Threat Flags

No new threat surface beyond the plan's threat model:
- T-70-10 mitigated: `pagerdutyConfig` is only passed when `pdEnabled=true` and `pdRoutingKey` is non-empty (trim enforced at save). Convex `pagerdutyConfigValidator` enforces type shape server-side.
- T-70-11 mitigated: `schedule` constrained to Select component values (`"daily"`, `"weekly"`, `"both"`).
- T-70-12 accepted: DeliveryHistory shows operational audit data (status, timestamps, ruleId) — no PII beyond operator-set recipient address.

## Self-Check: PASSED

- [x] `src/components/EmailDigestConfig.tsx` exists and exports `EmailDigestConfig`
- [x] `src/components/EmailDigestConfig.tsx` contains `useQuery(api.emailDigest.getEmailDigestConfigPublic)`
- [x] `src/components/EmailDigestConfig.tsx` contains `useMutation(api.emailDigest.setEmailDigestConfig)`
- [x] `src/components/EmailDigestConfig.tsx` contains "EMAIL DIGEST" in SectionHeader
- [x] `src/components/EmailDigestConfig.tsx` contains "Save Digest Settings"
- [x] `src/components/EmailDigestConfig.tsx` contains "Send email digest"
- [x] `src/components/EmailDigestConfig.tsx` contains `toast.success("Digest settings saved.")`
- [x] `src/components/DeliveryHistory.tsx` exists and exports `DeliveryHistory`
- [x] `src/components/DeliveryHistory.tsx` contains `useQuery(api.deliveryLogs.listEmailLogs`
- [x] `src/components/DeliveryHistory.tsx` contains `useQuery(api.deliveryLogs.listPagerdutyLogs`
- [x] `src/components/DeliveryHistory.tsx` contains "No deliveries yet"
- [x] `src/pages/Settings.tsx` contains `import { EmailDigestConfig }` and `import { DeliveryHistory }`
- [x] `src/pages/Settings.tsx` contains `<EmailDigestConfig />` and `<DeliveryHistory />`
- [x] `src/components/AlertRuleForm.tsx` contains `pdEnabled`, `pdRoutingKey`, `pdSeverity` state variables
- [x] `src/components/AlertRuleForm.tsx` contains `<Collapsible>` with "PagerDuty" text
- [x] `src/components/AlertRuleForm.tsx` contains "Send PagerDuty incident" switch label
- [x] `src/components/AlertRuleForm.tsx` contains `type="password"` routing key input
- [x] `src/components/AlertRuleForm.tsx` contains `pagerdutyConfig:` in both createCustomRule and updateCustomRule calls
- [x] `src/pages/Infrastructure.tsx` contains `import CallGraphPanel from "../components/CallGraphPanel"`
- [x] `src/pages/Infrastructure.tsx` contains `<SectionErrorBoundary name="Agent Call Graph">`
- [x] `src/pages/Infrastructure.tsx` contains `<CallGraphPanel />`
- [x] Commit a82eac0 exists (Task 1)
- [x] Commit bd04704 exists (Task 2)
