---
phase: 70
slug: external-integrations-call-graph
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 70 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/emailDigest.test.ts convex/pagerdutyDelivery.test.ts src/components/CallGraphPanel.test.tsx -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 70-01-01 | 01 | 0 | EXT-01 | — | N/A | unit | `npx vitest run convex/emailDigest.test.ts -x` | ❌ W0 | ⬜ pending |
| 70-01-02 | 01 | 0 | EXT-02 | — | N/A | unit | `npx vitest run convex/pagerdutyDelivery.test.ts -x` | ❌ W0 | ⬜ pending |
| 70-01-03 | 01 | 0 | VIZ-01 | — | N/A | unit | `npx vitest run src/components/CallGraphPanel.test.tsx -x` | ❌ W0 | ⬜ pending |
| 70-02-01 | 02 | 1 | EXT-01 | T-70-01 | Validate email format before Resend | unit | `npx vitest run convex/emailDigest.test.ts -x` | ❌ W0 | ⬜ pending |
| 70-02-02 | 02 | 1 | EXT-01 | — | Log failure when RESEND_API_KEY absent | unit | `npx vitest run convex/emailDigest.test.ts -x` | ❌ W0 | ⬜ pending |
| 70-03-01 | 03 | 1 | EXT-02 | T-70-02 | Hardcoded PD endpoint, no SSRF | unit | `npx vitest run convex/pagerdutyDelivery.test.ts -x` | ❌ W0 | ⬜ pending |
| 70-03-02 | 03 | 1 | EXT-02 | — | dedup_key matches trigger/resolve | unit | `npx vitest run convex/pagerdutyDelivery.test.ts -x` | ❌ W0 | ⬜ pending |
| 70-04-01 | 04 | 1 | VIZ-01 | — | N/A | unit | `npx vitest run src/components/CallGraphPanel.test.tsx -x` | ❌ W0 | ⬜ pending |
| 70-05-01 | 05 | 2 | EXT-01 | — | N/A | unit | `npx vitest run src/components/EmailDigestSettings.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/emailDigest.test.ts` — stubs for EXT-01 (template render, missing API key guard, log write shape)
- [ ] `convex/pagerdutyDelivery.test.ts` — stubs for EXT-02 (payload shape, dedup_key, resolve action, skip-when-disabled)
- [ ] `src/components/CallGraphPanel.test.tsx` — stubs for VIZ-01 (layout computation, node coloring, empty state)
- [ ] `src/components/EmailDigestSettings.test.tsx` — stubs for EXT-01 UI (save recipient, schedule select)
- [ ] `npm install resend @react-email/components @react-email/render` — before any email code compiles
- [ ] Schema patch: `emailDeliveryLog.alertId` → `v.optional(v.id("alerts"))` — before digest action logs to DB
- [ ] Check `convex/tsconfig.json` for JSX support — before importing DigestEmailTemplate from Convex action

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email renders correctly in email client | EXT-01 | HTML email rendering varies by client | Send test email, verify in Gmail/Outlook |
| PagerDuty incident appears in PD dashboard | EXT-02 | Requires live PagerDuty service | Trigger alert with PD enabled, check PD dashboard |
| Call graph updates in real time | VIZ-01 | Requires live Convex subscription | Insert edge via ingest, verify graph updates without refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
