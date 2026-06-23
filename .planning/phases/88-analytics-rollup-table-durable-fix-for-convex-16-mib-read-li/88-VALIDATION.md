---
phase: 88
slug: analytics-rollup-table-durable-fix-for-convex-16-mib-read-li
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 88 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 88-RESEARCH.md "Validation Architecture" (HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (jsdom) — already in project |
| **Config file** | `vite.config.ts` (test block) / `src/test/setup.ts` |
| **Quick run command** | `npx vitest run convex/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10–20 seconds (convex unit tests) |

Convex tests live alongside source: `convex/**/*.test.ts`. Type check: `npx tsc --noEmit`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run convex/`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs are finalized by the planner. The rows below are the **Nyquist invariants**
> (the minimum testable set from research) the planner MUST map onto concrete tasks. Every
> AR requirement must trace to at least one automated invariant here.

| Invariant | Requirement | Test Type | Automated Command | File Exists | Status |
|-----------|-------------|-----------|-------------------|-------------|--------|
| Idempotency: `events.ingest` twice w/ same `idempotencyKey` → exactly 1 event row + 1 rollup increment | AR-02 | unit | `npx vitest run convex/analyticsRollup.test.ts` | ❌ W0 | ⬜ pending |
| No-key events always counted: `events.ingest` twice w/o key → 2 event rows + 2 increments (D-05, no lossy hash) | AR-02 | unit | `npx vitest run convex/analyticsRollup.test.ts` | ❌ W0 | ⬜ pending |
| Rollup count == raw count after `backfillHistorical` over N seeded events | AR-02 | integration | `npx vitest run convex/analyticsRollup.test.ts` | ❌ W0 | ⬜ pending |
| Cron-removal non-double-count: `computeHourly` over an hour with ingest-time buckets leaves values unchanged (D-02) | AR-01 | unit | `npx vitest run convex/aggregates.test.ts` | ❌ W0 | ⬜ pending |
| `purgeOldTelemetryEvents` never deletes/modifies `aggregates` rows (D-12) | AR-02 | unit | `npx vitest run convex/aggregates.test.ts` | ❌ W0 | ⬜ pending |
| heatmap derivation: known hourly buckets → correct day-of-week × hour mapping (D-07) | AR-03 | unit | `npx vitest run convex/analytics.test.ts` | ❌ W0 | ⬜ pending |
| errorRateTrend missing-hour = 0: 24 slots always returned, absent error buckets → `errors: 0` (D-08) | AR-03 | unit | `npx vitest run convex/analytics.test.ts` | ❌ W0 | ⬜ pending |
| Reads stay well under 16 MiB: analytics queries read index-bounded `aggregates`, no `.take()` caps remain (D-03) | AR-01, AR-03 | unit/source | grep asserts no `.take(` count-cap remains in `analytics.ts`; bucket-only reads | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/analyticsRollup.test.ts` — idempotency, no-key-counted, backfill count-equality invariants
- [ ] `convex/analytics.test.ts` — heatmap mapping, errorRateTrend missing-hour=0, `.take()`-cap-removed assertions
- [ ] `convex/aggregates.test.ts` — cron-removal non-double-count, dataRetention-leaves-aggregates invariants

*If a Convex test harness/ctx mock is not already present, Wave 0 also stands up the mutation-ctx mock fixtures used by the above.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production backfill correctness at real volume | AR-02 | Backfill runs against the live Convex deployment over all historical events; not reproducible in unit env at scale | After deploy, trigger `backfillHistorical` action; spot-check a sample of `aggregates` bucket values against raw counts for a few hours; confirm action completes without 16 MiB read error |
| Live 16 MiB headroom post-deploy | AR-01 | Read-byte ceiling only observable against the real dataset | After deploy, open each analytics view; confirm no Convex read-limit error in dashboard/logs at current event volume |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
