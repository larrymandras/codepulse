---
phase: 83
slug: graph-snapshot-receiver
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-18
---

# Phase 83 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) — Convex functions tested via `convex-test` / direct unit tests under `convex/**/*.test.ts` |
| **Config file** | `vitest.config.ts` (existing); `src/test/setup.ts` mocks heavy externals |
| **Quick run command** | `npx vitest run convex/graphSnapshots.test.ts` |
| **Full suite command** | `npm test` |
| **Type check** | `npx tsc --noEmit` |
| **Estimated runtime** | ~30–60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched module + `npx tsc --noEmit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite green + `npx tsc --noEmit` clean
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Populated by the planner / gsd-nyquist-auditor from the PLAN.md task list. Each row maps a task to its automated proof.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 83-XX-XX | XX | N | GH-01 | T-83-01 / — | bearer-auth required on ingest; no Clerk on reads | unit | `npx vitest run convex/graphSnapshots.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/graphSnapshots.test.ts` — unit tests for the versioned-write mutation, idempotent full-replacement, retention-sweep selection helper, and read queries
- [ ] Fixture: a faithfully-shaped `graph_snapshot` payload (the exact producer envelope from RESEARCH.md) for ingest/round-trip tests

*Existing Vitest infrastructure covers the framework; only the new test file + fixture are net-new.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `graph_snapshot` lands rows + is returned by `getProjectGraph` | GH-01 | Requires a live POST to `/runtime-ingest` (or waiting for Ástríðr's nightly cron `15 0 * * *`) | POST the fixture payload with a valid `Bearer` ingest key to `/runtime-ingest`; confirm rows in the Convex dashboard + `getProjectGraph` returns the active version's `{nodes,links}`; re-POST same `snapshotId` → no duplicate active rows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
