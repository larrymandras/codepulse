---
phase: 95
slug: hardening-security-audit-key-rotation-dependency-majors
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 95 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (jsdom environment) |
| **Config file** | `vitest.config.ts` (`environment: 'jsdom'`, line 13) |
| **Quick run command** | `npx vitest run <file>` (single file) |
| **Full suite command** | `npx vitest run` (184 test files) |
| **Type gate** | `npx tsc --noEmit` |
| **Build gate** | `npm run build` (vite/Rolldown) |
| **Estimated runtime** | ~90 seconds (full suite + tsc + build) |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit` + the affected `npx vitest run <file>`
- **After every plan wave / per dependency bump (D-09/D-10):** Run `npx tsc --noEmit && npx vitest run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green AND `/cso` verdict = ship
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 95-XX-XX | TS6 | — | HARD-03 | — | Type-check green on TS 6.0.3 | type-check | `npx tsc --noEmit` | ✅ (0 errors on 5.9.3) | ⬜ pending |
| 95-XX-XX | TS6 | — | HARD-03 | — | Full unit suite green on TS 6 + jsdom 29 | unit | `npx vitest run` | ✅ existing 184 files | ⬜ pending |
| 95-XX-XX | TS6 | — | HARD-03 | — | Prod build succeeds | build | `npm run build` | ✅ | ⬜ pending |
| 95-XX-XX | day-picker | — | HARD-04 | — | No `react-day-picker` references remain | grep + build | `grep -r react-day-picker src convex` (expect none) + `npx tsc --noEmit` | ✅ deletion-verified | ⬜ pending |
| 95-XX-XX | majors | — | HARD-03 (D-10) | — | `react-easy-crop@6` UI intact | manual | mount `AvatarUploader.tsx` cropper surface | ⚠️ manual | ⬜ pending |
| 95-XX-XX | audit | — | HARD-01 | — | 0 dependency CVEs | audit | `npm audit` | ✅ already 0 | ⬜ pending |
| 95-XX-XX | audit | — | HARD-01 | T-95-01 | `convex/ingestAuth.ts` fail-closed / no confirmed open findings | source + audit | `/cso` verdict + inspect `ingestAuth.ts` | ✅ | ⬜ pending |
| 95-XX-XX | key-rotation | — | HARD-02 | — | Fresh rows from real emitters land in prod Convex | manual/integration | inspect prod Convex (`tidy-whale-981`) tables post-emit | ⚠️ manual live (D-02) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* The existing 184-file Vitest suite + `tsc --noEmit` + `npm run build` cover the automated green bar. No new test files are required — HARD-03/04 are verified by the existing suite passing after the changes. The only non-automatable checks are the `react-easy-crop` UI mount (D-10) and the HARD-02 live round trip (D-02), both inherently manual.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `react-easy-crop@6` cropper renders + interacts | HARD-03 (D-10) | No automated harness mounts the avatar cropper UI surface | Mount `AvatarUploader.tsx`, load an image, confirm crop/zoom/drag work and output is produced |
| Live ingest round trip from real emitters | HARD-02 (D-02) | Requires the Forge daemon + Ástríðr running as real emitters POSTing to prod Convex | Start Forge daemon + Ástríðr; each POSTs organically with its configured key; confirm fresh rows land in prod Convex tables on `tidy-whale-981` (`.convex.site` host). Also confirm the Forge **daemon's** local env key matches. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none — existing infra covers)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
