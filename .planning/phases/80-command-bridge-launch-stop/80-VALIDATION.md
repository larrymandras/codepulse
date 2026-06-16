---
phase: 80
slug: command-bridge-launch-stop
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-16
---

# Phase 80 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `80-RESEARCH.md` §Validation Architecture + §Security Domain.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 (jsdom) |
| **Config file** | `vite.config.ts` (Vitest embedded) + `src/test/setup.ts` |
| **Quick run command** | `npx vitest run convex/ src/components/forge/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~quick: a few seconds; full: under a minute |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/ src/components/forge/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** < 30 seconds (quick run)

---

## Per-Task Verification Map

> Mapped by requirement (exact task IDs assigned by the planner). Threat refs from `80-RESEARCH.md` §Security Domain.

| Plan/Task | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| enqueueLaunch insert | 80-01 T2 | FI-06 | — | Inserts `forgeCommands` row with correct fields | unit | `npx vitest run convex/forge.test.ts` | ❌ W0 | ⬜ pending |
| claimAndUpsertHost | 80-01 T2 | FI-06 | Double-claim race (Tampering) | Atomically claims queued commands + upserts host liveness in one mutation | unit | `npx vitest run convex/forge.test.ts` | ❌ W0 | ⬜ pending |
| expireStaleCommands | 80-01 T2 | FI-06 | Stale command replay (Tampering) | Marks queued commands past `expiresAt` as expired | unit | `npx vitest run convex/forge.test.ts` | ❌ W0 | ⬜ pending |
| ackCommand | 80-01 T2 | FI-06 | — | Sets `resolvedForgeJobId` on done command (optimistic-row reconcile) | unit | `npx vitest run convex/forge.test.ts` | ❌ W0 | ⬜ pending |
| ForgeLaunchModal render | 80-03 T2 | FI-07 | — | Renders host picker + trimmed fields (no dangerous-mode/inline-create) | unit | `npx vitest run src/components/forge/ForgeLaunchModal.test.tsx` | ❌ W0 | ⬜ pending |
| ForgeStopConfirmDialog | 80-04 T1 | FI-07 | — | Confirm required before stop mutation fires (work-discarded warning) | unit | `npx vitest run src/components/forge/ForgeStopConfirmDialog.test.tsx` | ❌ W0 | ⬜ pending |
| ForgeStatusBadge Stopping… | 80-03 T1 | FI-07 | — | Renders `Stopping…`/`Queued`/`Failed` pending states | unit | `npx vitest run src/components/forge/ForgeStatusBadge.test.tsx` | ✅ extend | ⬜ pending |
| ForgeJobList gating + reconcile + failure flip | 80-03 T3 | FI-07/FI-08 | Silent command disappearance (Repudiation) | Launch button gated on isAuthenticated; reconciled pending row not duplicated; failed row shows destructive border + error (D-10/D-11) | unit | `npx vitest run src/components/forge/ForgeJobList.test.tsx` | ❌ W0 | ⬜ pending |
| enqueueLaunch auth gate | 80-01 T2 | FI-08 | Unauthenticated launch (Elevation of Privilege) | Throws when `getUserIdentity()` returns null (fail-closed, D-13) | unit | `npx vitest run convex/forge.test.ts` | ❌ W0 | ⬜ pending |
| enqueueStop auth gate | 80-01 T2 | FI-08 | Unauthenticated stop (Elevation of Privilege) | Throws when `getUserIdentity()` returns null (fail-closed, D-13) | unit | `npx vitest run convex/forge.test.ts` | ❌ W0 | ⬜ pending |
| Dangerous-mode strip | 80-01 T2 | FI-06 | Dangerous-mode injection (Tampering) | `capabilities.dangerous` stripped in `enqueueLaunch` | unit | `npx vitest run convex/forge.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/forge.test.ts` — covers FI-06 (enqueueLaunch, claimAndUpsertHost, expireStaleCommands, ackCommand, dangerous-strip) + FI-08 (auth fail-closed on enqueueLaunch/enqueueStop)
- [ ] `src/components/forge/ForgeLaunchModal.test.tsx` — covers FI-07 (modal fields, host picker, trimmed form)
- [ ] `src/components/forge/ForgeStopConfirmDialog.test.tsx` — covers FI-07 (confirm gate, work-discarded warning, Stopping… state) [80-04 T1]
- [ ] `src/components/forge/ForgeJobList.test.tsx` — covers FI-07/FI-08 (Launch button gated on isAuthenticated; pending-row reconciliation; failure flip) [80-03 T3, B3]
- [ ] `convex/crons.ts` — cron **entry** `expire-stale-forge-commands` @1min wiring `internal.forge.expireStaleCommands` (D-12). Correction to RESEARCH A1: crons.ts ALREADY EXISTS (14 crons) — only a new entry is added, not a new file [80-01 T1]

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real launch round-trip: enqueue → daemon claims via poll → Forge `POST /jobs` runs → job reflects back into `forgeJobs` | FI-06/07 | Requires the live Forge daemon (cross-repo, `C:\Users\mandr\forge`) on a real host | Start daemon with command-poller against the Convex deployment; launch from `/forge`; observe Queued → running job row |
| Real stop: Stop+confirm → daemon `taskkill /T /F` → job reflects `stopped` | FI-07 | Requires live daemon + a running job to kill | Launch a long job; Stop from UI; confirm; observe `Stopping…` → `stopped`, temp workspace not promoted |
| Host picker "online" default reflects daemon liveness | FI-07 | Requires a real daemon polling to update `lastSeenAt` | With daemon running, open launch modal; verify online host pre-selected; stop daemon, verify host shows stale/disabled |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (B1 — 80-01 T3 now re-runs `npx vitest run convex/forge.test.ts` after tsc, so no two consecutive tasks rely on tsc/grep alone)
- [x] Wave 0 covers all MISSING references (`convex/forge.test.ts`, `ForgeLaunchModal.test.tsx`, `ForgeStopConfirmDialog.test.tsx`, `ForgeJobList.test.tsx`; `convex/crons.ts` entry — file pre-exists)
- [x] No watch-mode flags (use `vitest run`, not `vitest`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (revision pass — B1/B2/B3 + W1/W2 resolved)
