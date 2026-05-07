---
phase: 1
slug: design-studio-sandboxed-design-preview-artifact-storage-temp
status: active
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-07
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-T1 | 00 | 0 | D-07 | T-01-00 | Dockerfile uses official base image, no secrets | file-check | `test -f open-design/Dockerfile && grep -q "node:24-alpine" open-design/Dockerfile && echo PASS` | N/A | pending |
| 00-T2 | 00 | 0 | D-04,D-05,D-06,D-08,D-11 | — | N/A | stub | `npx vitest run src/pages/DesignStudio.test.tsx src/lib/openDesignApi.test.ts src/components/design-studio/StreamingPreview.test.tsx src/components/design-studio/ExportPanel.test.tsx convex/designProjects.test.ts convex/designTemplates.test.ts` | Wave 0 creates | pending |
| 01-T1 | 01 | 1 | D-01,D-06 | T-01-01,T-01-04 | No auth needed (localhost); health check timeout 3s | unit | `npx vitest run src/lib/openDesignApi.test.ts` | Wave 0 stub -> concrete | pending |
| 01-T2 | 01 | 1 | D-07,D-08,D-09 | T-01-02,T-01-03 | Convex validators on upsert; no secrets in compose | tsc+unit | `npx tsc --noEmit && npx vitest run src/lib/openDesignApi.test.ts` | Wave 0 stub -> concrete | pending |
| 02-T1 | 02 | 2 | D-02,D-04 | T-01-05,T-01-06 | iframe sandbox attrs; health check timeout | tsc | `npx tsc --noEmit` | N/A | pending |
| 02-T2 | 02 | 2 | D-02,D-04,D-05 | T-01-07 | iframe src is localhost only | smoke+tsc | `npx vitest run src/pages/DesignStudio.test.tsx && npx tsc --noEmit` | Wave 0 stub -> concrete | pending |
| 03-T1 | 03 | 2 | D-03,D-10 | T-01-08,T-01-09,T-01-10 | Brief rendered as text node; pagination at 50 | behavioral | `npx vitest run src/components/design-studio/SkillPicker.test.tsx && npx tsc --noEmit` | Created in this task | pending |
| 03-T2 | 03 | 2 | D-03 | — | N/A | tsc | `npx tsc --noEmit` | N/A | pending |
| 04-T1 | 04 | 3 | D-03,D-05,D-11 | T-01-11,T-01-12,T-01-14 | srcdoc sandbox=allow-scripts only; AbortController cleanup | behavioral | `npx vitest run src/components/design-studio/StreamingPreview.test.tsx src/components/design-studio/ExportPanel.test.tsx && npx tsc --noEmit` | Wave 0 stub -> concrete | pending |
| 04-T2 | 04 | 3 | D-03 | T-01-15 | JSON.parse in try/catch; directions display-only | tsc | `npx tsc --noEmit` | N/A | pending |
| 05-T1 | 05 | 4 | D-08,D-09,D-10,D-12 | T-01-15,T-01-16 | ZIP accept=.zip; delete guarded by AlertDialog | behavioral | `npx vitest run src/components/design-studio/ZipImport.test.tsx convex/designProjects.test.ts convex/designTemplates.test.ts && npx tsc --noEmit` | Wave 0 stub -> concrete + new | pending |
| 05-T2 | 05 | 4 | D-08,D-10 | T-01-17,T-01-18 | Sync once on mount (not polling); useCallback stable dep | smoke+tsc | `npx vitest run src/pages/DesignStudio.test.tsx && npx tsc --noEmit` | Wave 0 stub -> concrete | pending |
| 05-T3 | 05 | 4 | — | — | N/A | checkpoint | Manual human verification (15 steps) | N/A | pending |

*Status: pending -- all tasks awaiting execution*

---

## Nyquist Sampling Continuity

Checking for no 3 consecutive tasks without behavioral automated verify:

| Sequence | Task IDs | Has Behavioral Test? | Compliant? |
|----------|----------|---------------------|------------|
| Wave 0 | 00-T1, 00-T2 | T2: vitest stubs (todo) | yes (stubs run) |
| Wave 1 | 01-T1, 01-T2 | T1: vitest unit | yes |
| Wave 2 (start) | 02-T1 | tsc only | -- |
| Wave 2 (mid) | 02-T2 | vitest smoke | yes (breaks chain) |
| Wave 2 (end) | 03-T1 | vitest behavioral (SkillPicker) | yes (breaks chain) |
| Wave 2->3 | 03-T2, 04-T1 | T2: tsc only, T1: vitest behavioral | yes (chain = 1) |
| Wave 3 | 04-T2 | tsc only | -- |
| Wave 4 (start) | 05-T1 | vitest behavioral | yes (breaks chain) |
| Wave 4 (mid) | 05-T2 | vitest smoke | yes |

**Max consecutive tsc-only tasks: 2** (02-T1, then broken by 02-T2; or 03-T2 + 04-T2 non-consecutive across waves with 04-T1 behavioral in between). Compliant with Nyquist 8c (max 2, threshold is 3).

---

## Wave 0 Requirements

- [x] Plan 00 creates 6 test stub files (DesignStudio, openDesignApi, StreamingPreview, ExportPanel, designProjects, designTemplates)
- [x] Plan 00 creates Dockerfile for Open Design daemon
- [x] All stubs use `it.todo()` pattern for tests requiring implementation code
- [x] Subsequent plans convert `it.todo()` to concrete `it()` tests

*Wave 0 plan (01-00-PLAN.md) exists and covers all test infrastructure.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iframe embed loads Open Design UI | D-04 | Requires running Docker sidecar | Start sidecar, navigate to /design-studio, verify iframe content |
| Native UI streaming display | D-03 | SSE streaming requires live daemon | Start daemon, create project, verify progressive token display |
| Export downloads | D-11 | File download requires browser | Trigger each export format, verify file downloads |
| Full page visual correctness | D-02 | Visual layout verification | Plan 05 checkpoint: 15-step manual verification |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution
