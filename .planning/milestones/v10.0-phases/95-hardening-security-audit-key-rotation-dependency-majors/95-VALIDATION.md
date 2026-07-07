---
phase: 95
slug: hardening-security-audit-key-rotation-dependency-majors
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-07
finalized: 2026-07-07
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

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|--------|
| T-95-01-2 | 95-01 | 1 | HARD-03 | Type-check green on TS 6.0.3 | type-check | `npx tsc --noEmit` | ✅ green (0 errors) |
| T-95-01-3 | 95-01 | 1 | HARD-03 | Full unit suite green on TS 6 + jsdom 29 | unit | `npx vitest run` | ✅ green (164 files / 1644 tests) |
| T-95-01-3 | 95-01 | 1 | HARD-03 | Prod build succeeds | build | `npm run build` | ✅ green (exit 0) |
| T-95-01-1 | 95-01 | 1 | HARD-04 | No `react-day-picker` references remain | grep + build | `grep -rn react-day-picker src convex` (none) + `tsc --noEmit` | ✅ green (exit 1, deleted) |
| T-95-02-2 | 95-02 | 2 | HARD-03 (D-10) | `react-easy-crop@6` cropper UI intact | manual | mount `AvatarUploader.tsx` cropper surface | ✅ operator-verified ("cropper approved") |
| T-95-03-1 | 95-03 | 3 | HARD-01 | 0 dependency CVEs | audit | `npm audit` | ✅ green (0 vulnerabilities) |
| T-95-03-3 | 95-03 | 3 | HARD-01 | `convex/ingestAuth.ts` fail-closed / no open findings | source + audit | `/cso` verdict + `ingestAuth.ts` | ✅ SHIP; validateIngestAuth made fail-closed, 4/4 findings remediated |
| T-95-04-1 | 95-04 | 2 | HARD-02 | Fresh rows from real emitters land in prod Convex | manual/integration | inspect prod Convex (`tidy-whale-981`) `forgeJobs` post-emit | ✅ operator-verified (fresh `forgeJobs` row `01KWYJ2…` @ 15:10:18Z) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — all rows green as of 2026-07-07 finalization.*

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the two inherently-manual checks — D-10 cropper UI, D-02 live round-trip — were operator-completed)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing 184-file suite + tsc + build infra covers HARD-03/04; ingestAuth tests added for HARD-01)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** finalized 2026-07-07 — all automated gates green (tsc 0 / vitest 164 files-1644 tests / build 0 / npm audit 0), both manual checks operator-verified, cross-referenced by `95-VERIFICATION.md` (16/16 passed). Nyquist-compliant: the automatable surface is fully sampled; the non-automatable surface (D-02/D-10) is documented manual + operator-signed.
