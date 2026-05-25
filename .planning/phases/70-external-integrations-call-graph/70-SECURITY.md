---
phase: 70-external-integrations-call-graph
audited: 2026-05-25
threats_total: 12
threats_closed: 12
threats_open: 0
accepted_risks: 4
---

# Phase 70: Security Threat Verification

## Threat Register

| ID | Category | Component | Disposition | Status | Evidence |
|----|----------|-----------|-------------|--------|----------|
| T-70-01 | Information Disclosure | convex/emailTemplates/DigestEmailTemplate.tsx | mitigate | CLOSED | Template accepts only typed props (DigestEmailTemplateProps). No recipient field in props — recipient is read from profileConfigs DB at send time in emailDigest.ts:196 (`ctx.runQuery(internal.emailDigest.getRecipientEmail)`), never from form state or user input. |
| T-70-02 | Tampering | convex/schema.ts | accept | CLOSED | schema.ts:966 — `alertId: v.optional(v.id("alerts"))` confirmed. Relaxation intentional; field is audit-only, not access-control. Accepted risk documented below. |
| T-70-03 | Spoofing | convex/pagerdutyDelivery.ts | mitigate | CLOSED | pagerdutyDelivery.ts:6 — `const PAGERDUTY_ENDPOINT = "https://events.pagerduty.com/v2/enqueue"` hardcoded constant. Both `sendPagerdutyAlert` (line 58) and `sendPagerdutyResolve` (line 115) fetch only this constant. No user-controlled URL. No SSRF vector. |
| T-70-04 | Information Disclosure | convex/emailDigest.ts | mitigate | CLOSED | emailDigest.ts:174 — `const apiKey = process.env.RESEND_API_KEY` — read from env, never stored. Missing key path logs error string only (line 180: `"RESEND_API_KEY not configured"`), not the key value. Recipient from DB at send time (line 196), not from client input. |
| T-70-05 | Denial of Service | convex/crons.ts | accept | CLOSED | crons.ts:63-67 — `send-email-digest` fires once daily at 06:05 UTC. Alert evaluation cron fires every 2 min (line 36) but PagerDuty is gated by `pagerdutyConfig.enabled` and `createIfNew` deduplication. PD dedup_key ensures idempotent incident handling. Accepted risk documented below. |
| T-70-06 | Tampering | convex/alerts.ts | mitigate | CLOSED | alerts.ts:872 — PagerDuty scheduler call inside `if (newAlertId && customRule.pagerdutyConfig?.enabled)` guard. alerts.ts:868-878 — routing key originates from `getCustomRuleById` DB lookup, not from alert payload. pagerdutyDelivery.ts:31-32 — secondary check: `if (!rule?.pagerdutyConfig?.enabled) return` and `if (!rule.pagerdutyConfig.routingKey) return`. |
| T-70-07 | Information Disclosure | convex/pagerdutyDelivery.ts | accept | CLOSED | PD routing key stored plaintext in alertRuleCustom table. Intentional design per D-08 and Phase 70 RESEARCH.md — routing keys are service routing identifiers, not authentication secrets. Accepted risk documented below. |
| T-70-08 | Information Disclosure | src/components/CallGraphSVG.tsx | accept | CLOSED | CallGraphSVG renders agentId and toolName fields from callGraphEdges. Single-user dashboard; no multi-tenant exposure. Accepted risk documented below. |
| T-70-09 | Denial of Service | src/components/CallGraphSVG.tsx | mitigate | CLOSED | Three mitigations confirmed: (1) callGraphEdges.ts:62 — `listEdges` query capped at `.take(500)`; (2) CallGraphSVG.tsx:153 — `const layout = useMemo(() => computeLayout(edges), [edges])` prevents re-layout on every render; (3) CallGraphSVG.tsx:173 — `style={{ minHeight: "320px", maxHeight: "600px" }}` caps SVG container height. |
| T-70-10 | Tampering | src/components/AlertRuleForm.tsx | mitigate | CLOSED | AlertRuleForm.tsx:189 — `if (pdEnabled && !pdRoutingKey.trim())` validation guard with toast error before save. AlertRuleForm.tsx:206 — `routingKey: pdRoutingKey.trim()` strips whitespace. pagerdutyDelivery.ts:32 — server-side: `if (!rule.pagerdutyConfig.routingKey) return` silent skip. Convex `pagerdutyConfigValidator` enforces type shape at mutation boundary. |
| T-70-11 | Tampering | src/components/EmailDigestConfig.tsx | mitigate | CLOSED | EmailDigestConfig.tsx:19-23 — `schedule` state is only ever set via `SCHEDULE_OPTIONS` Select component with values `"daily"`, `"weekly"`, `"both"`. emailDigest.ts:192-193 — server-side: only `"weekly"` is special-cased; any unrecognized schedule value falls through to daily delivery (safe default, no crash). |
| T-70-12 | Information Disclosure | src/components/DeliveryHistory.tsx | accept | CLOSED | DeliveryHistory renders ruleId, status, timestamps, and recipient email address (operator-set). No third-party PII. Single-user operational audit data. Accepted risk documented below. |

## Accepted Risks

**T-70-02 — alertId optional (schema relaxation)**
Making `emailDeliveryLog.alertId` optional is intentional: digest emails have no associated alert. The field is used only for audit correlation, not for any access control or authorization decision. Risk: minimal. A null alertId in a delivery log row has no security consequence.

**T-70-05 — Email/PagerDuty delivery rate**
Email cron fires once daily (bounded). PagerDuty fires per alert evaluation cycle (every 2 min) but is gated by `pagerdutyConfig.enabled === true` and deduplicated by `createIfNew` (one incident per active alert, not per evaluation). PagerDuty dedup_key (`codepulse-{ruleId}`) makes duplicate trigger events idempotent server-side. Risk: low for a single-operator dashboard with a small fixed number of custom rules.

**T-70-07 — PagerDuty routing key stored plaintext**
Routing keys are PagerDuty Events API v2 service routing identifiers — they route events to a service but do not grant account access. PagerDuty's own documentation treats them as configuration values, not secrets (no rotation mechanism, visible in PagerDuty UI). Storing them in `alertRuleCustom` is consistent with how PagerDuty customers integrate the Events API. Risk: accepted; key exposure allows sending incidents to the configured service, not account takeover.

**T-70-08 — Call graph shows agent IDs and tool names**
This is a single-user operational dashboard. Agent IDs and tool names are Ástríðr internal identifiers with no external attack surface. No multi-tenant data isolation is required.

**T-70-12 — Delivery history shows recipient email**
The recipient email is operator-supplied (set by the operator in their own profile). DeliveryHistory displays it back to the same operator. No third-party PII. No access control gap.

## Unregistered Threat Flags

None. All SUMMARY.md `## Threat Flags` entries across Plans 01–04 explicitly state "No new threat surface beyond what is documented in the plan's threat model." No unregistered flags were raised during implementation.

## Audit Trail

### Security Audit 2026-05-25

| Metric | Count |
|--------|-------|
| Threats found | 12 |
| Closed | 12 |
| Open | 0 |
| Mitigated | 8 |
| Accepted | 4 |
| Transferred | 0 |

### Verification Method

Each `mitigate` threat was verified by grepping the cited implementation file for the specific mitigation pattern. Starting hypothesis: all mitigations absent. Evidence required: exact code match at correct location serving the correct entry point.

Files searched:
- `convex/emailTemplates/DigestEmailTemplate.tsx`
- `convex/schema.ts` (lines 960–978)
- `convex/pagerdutyDelivery.ts`
- `convex/emailDigest.ts`
- `convex/crons.ts`
- `convex/alerts.ts` (lines 860–910)
- `convex/callGraphEdges.ts`
- `src/components/CallGraphSVG.tsx`
- `src/components/AlertRuleForm.tsx`
- `src/components/EmailDigestConfig.tsx`
- `src/components/DeliveryHistory.tsx`

Each `accept` threat was verified as having its rationale documented in this file under Accepted Risks.
