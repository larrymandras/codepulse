---
phase: 2
slug: email-template-manager-crud-ui-for-email-layouts-content-tem
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *To be filled during planning* | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/pages/EmailTemplates.test.tsx` — page-level rendering tests
- [ ] `src/hooks/useEmailTemplates.test.ts` — API hook tests with mocked fetch
- [ ] Verify Ástríðr API connectivity (`GET /api/email-layouts` returns 200)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Monaco Editor renders in Sheet | D-05 | Browser-only rendering engine | Open template editor, verify syntax highlighting |
| Live preview iframe updates | D-09, D-10 | Requires running Ástríðr backend | Edit template HTML, confirm iframe updates after debounce |
| Asset upload drag-and-drop | D-12 | Browser drag events | Drag image file onto dropzone, verify upload |
| Split layout responsive behavior | D-09 | Visual layout verification | Resize browser, verify Sheet accommodates split panels |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
