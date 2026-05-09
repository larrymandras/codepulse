---
phase: 2
slug: email-template-manager-crud-ui-for-email-layouts-content-tem
status: draft
nyquist_compliant: true
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
| 02-00-T1 | 02-00 | 0 | D-04, D-13 | T-02-00a | List endpoint does not expose service keys | backend | `python -c "from astridr.api.template_routes import router"` | Yes (astridr-repo) | pending |
| 02-00-T2 | 02-00 | 0 | D-04, D-13 | — | Test stubs exist for critical behaviors | unit | `npx vitest run src/lib/emailTemplateUtils.test.ts` | Yes | pending |
| 02-01-T1 | 02-01 | 1 | D-10, D-11 | T-02-01, T-02-02 | uploadEmailAsset no Content-Type; variable utils tested | unit+tdd | `npx vitest run src/lib/emailTemplateUtils.test.ts` | Yes | pending |
| 02-01-T2 | 02-01 | 1 | D-01 | T-02-03 | Hook error messages generic | unit | `npx tsc --noEmit` | Yes | pending |
| 02-02-T1 | 02-02 | 1 | D-01 | T-02-04 | — | compile | `npx tsc --noEmit src/pages/EmailTemplates.tsx` | Yes | pending |
| 02-02-T2 | 02-02 | 1 | D-01 | — | — | compile | `npx tsc --noEmit` | Yes | pending |
| 02-03-T1 | 02-03 | 2 | D-12, D-13, D-14 | T-02-05, T-02-06 | File validation 5MB + image types; no Content-Type on upload | compile | `npx tsc --noEmit src/components/email/AssetDropzone.tsx` | Yes | pending |
| 02-03-T2 | 02-03 | 2 | D-02, D-05, D-08 | T-02-07, T-02-08 | Generic error toasts; user HTML not rendered in DOM | compile | `npx tsc --noEmit src/components/email/LayoutSheet.tsx` | Yes | pending |
| 02-03-T3 | 02-03 | 2 | D-04, D-13 | — | — | compile | `npx tsc --noEmit src/pages/EmailTemplates.tsx` | Yes | pending |
| 02-04-T1 | 02-04 | 2 | D-06, D-07, D-09, D-10, D-11 | T-02-09, T-02-10, T-02-11, T-02-12 | iframe srcdoc+sandbox; variable name regex; generic error; debounce | compile | `npx tsc --noEmit src/components/email/VariableSchemaTable.tsx src/components/email/EmailPreviewPane.tsx` | Yes | pending |
| 02-04-T2 | 02-04 | 2 | D-02, D-05, D-07, D-09 | T-02-09 | iframe srcdoc; no allow-scripts | compile | `npx tsc --noEmit src/components/email/TemplateSheet.tsx` | Yes | pending |
| 02-05-T1 | 02-05 | 3 | D-03, D-14 | T-02-13, T-02-14 | Generic error toasts; avatar URLs from trusted storage | compile | `npx tsc --noEmit src/components/email/AgentDefaultSheet.tsx src/pages/EmailTemplates.tsx` | Yes | pending |
| 02-05-T2 | 02-05 | 3 | — | — | Visual verification | manual | Human checkpoint | — | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `src/lib/emailTemplateUtils.test.ts` — variable schema utility test stubs (Plan 02-00)
- [x] `src/lib/astridrApi.test.ts` — uploadEmailAsset auth header test stubs (Plan 02-00)
- [x] `src/hooks/useEmailLayouts.test.ts` — is_active filter test stubs (Plan 02-00)
- [x] `src/components/email/__tests__/AssetDropzone.test.tsx` — file validation test stubs (Plan 02-00)
- [x] `src/components/email/__tests__/EmailPreviewPane.test.tsx` — create-mode placeholder test stubs (Plan 02-00)
- [x] Backend: `GET /api/email-assets` list endpoint in template_routes.py (Plan 02-00)
- [ ] Verify Astríðr API connectivity (`GET /api/email-layouts` returns 200) (Plan 02-00)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Monaco Editor renders in Sheet | D-05 | Browser-only rendering engine | Open template editor, verify syntax highlighting |
| Live preview iframe updates | D-09, D-10 | Requires running Astríðr backend | Edit template HTML, confirm iframe updates after debounce |
| Asset upload drag-and-drop | D-12 | Browser drag events | Drag image file onto dropzone, verify upload |
| Split layout responsive behavior | D-09 | Visual layout verification | Resize browser, verify Sheet accommodates split panels |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (post-revision)
