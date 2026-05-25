---
status: complete
phase: 70-external-integrations-call-graph
source: [70-01-SUMMARY.md, 70-02-SUMMARY.md, 70-03-SUMMARY.md, 70-04-SUMMARY.md]
started: 2026-05-25T00:00:00Z
updated: 2026-05-25T10:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Call Graph Panel on Infrastructure Page
expected: Navigate to Infrastructure page, scroll past GitHub Actions. "AGENT CALL GRAPH" section appears with legend (Healthy/Errored/Pending dots). Shows "No call graph data" empty state if no edges, or renders top-down node layout if edges exist.
result: pass

### 2. Email Digest Config on Settings Page
expected: Navigate to Settings page. "EMAIL DIGEST" section appears with schedule dropdown (Daily/Weekly/Both), a "Send email digest" toggle, and a "Save Digest Settings" button. Toggling and saving shows "Digest settings saved." toast.
result: pass

### 3. Delivery History on Settings Page
expected: On Settings page, "DELIVERY HISTORY" section appears with Email and PagerDuty tabs. When no delivery logs exist, shows "No deliveries yet" empty state in both tabs.
result: pass

### 4. PagerDuty Section in Alert Rule Form
expected: Create or edit a custom alert rule. A collapsible "PagerDuty" section appears below conditions. Expanding shows a "Send PagerDuty incident" toggle, a password-masked routing key input, and a severity override dropdown. Fields show/hide based on toggle state.
result: pass

### 5. PagerDuty Routing Key Validation
expected: In the alert rule form, enable PagerDuty toggle but leave routing key empty. Click Save. A toast error "PagerDuty routing key is required when PagerDuty is enabled." appears and the save is blocked.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
