---
phase: 88
slug: analytics-rollup-table-durable-fix-for-convex-16-mib-read-li
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-23
validated: 2026-06-26
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
| Idempotency: `events.ingest` twice w/ same `idempotencyKey` → exactly 1 event row + 1 rollup increment | AR-02 | unit | `npx vitest run convex/analyticsRollup.test.ts` | ✅ | ✅ green |
| No-key events always counted: `events.ingest` twice w/o key → 2 event rows + 2 increments (D-05, no lossy hash) | AR-02 | unit | `npx vitest run convex/analyticsRollup.test.ts` | ✅ | ✅ green |
| Rollup count == raw count after `backfillHistorical` over N seeded events | AR-02 | integration | `npx vitest run convex/analyticsRollup.test.ts` | ✅ | ✅ green |
| Cron-removal non-double-count: `computeHourly` over an hour with ingest-time buckets leaves values unchanged (D-02) | AR-01 | unit | `npx vitest run convex/aggregates.test.ts` | ✅ | ✅ green |
| `purgeOldTelemetryEvents` never deletes/modifies `aggregates` rows (D-12) | AR-02 | unit | `npx vitest run convex/aggregates.test.ts` | ✅ | ✅ green |
| heatmap derivation: known hourly buckets → correct day-of-week × hour mapping (D-07) | AR-03 | unit | `npx vitest run convex/analytics.test.ts` | ✅ | ✅ green |
| errorRateTrend missing-hour = 0: 24 slots always returned, absent error buckets → `errors: 0` (D-08) | AR-03 | unit | `npx vitest run convex/analytics.test.ts` | ✅ | ✅ green |
| Reads stay well under 16 MiB: rollup-backed analytics queries read index-bounded `aggregates` buckets (D-03); count-caps removed from heatmap/errorRateTrend/sankey/sunburst | AR-01, AR-03 | unit/source | `npx vitest run convex/analytics.test.ts` (bucket-read assertions) + source grep | ✅ | ✅ green¹ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> ¹ Two `.take()` caps remain by design and are **documented in-scope exceptions** (not D-03 violations): `analytics.ts:118` `.take(200)` (sessionDurations — raw-read distribution, bounded sample) and `analytics.ts:158` `.take(30000)` (tokenWaterfall — defensive cap on a non-rollup raw path). The four rollup-backed queries (heatmap, errorRateTrend, sankey, sunburst) are cap-free and read index-bounded `aggregates` buckets.

---

## Wave 0 Requirements

- [x] `convex/analyticsRollup.test.ts` — idempotency, no-key-counted, backfill count-equality invariants — 12 tests green
- [x] `convex/analytics.test.ts` — heatmap mapping, errorRateTrend missing-hour=0, bucket-read assertions — 11 tests green
- [x] `convex/aggregates.test.ts` — cron-removal non-double-count, dataRetention-leaves-aggregates invariants — 24 tests green

*Convex mutation-ctx mock fixtures are present and reused by the above (no missing harness).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production backfill correctness at real volume | AR-02 | Backfill runs against the live Convex deployment over all historical events; not reproducible in unit env at scale | After deploy, trigger `backfillHistorical` action; spot-check a sample of `aggregates` bucket values against raw counts for a few hours; confirm action completes without 16 MiB read error |
| Live 16 MiB headroom post-deploy | AR-01 | Read-byte ceiling only observable against the real dataset | After deploy, open each analytics view; confirm no Convex read-limit error in dashboard/logs at current event volume |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 test files above — all present)
- [x] No watch-mode flags (`vitest run`)
- [x] Feedback latency < 20s (full convex rollup suite ~1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-06-26 — all 8 Nyquist invariants covered by green tests, no gaps.

---

## Validation Audit 2026-06-26

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Result:** Phase 88 is **Nyquist-compliant**. All 8 invariants (AR-01/AR-02/AR-03) have automated verification that runs green.

| Suite | Result | Runtime |
|-------|--------|---------|
| `npx vitest run convex/analyticsRollup.test.ts convex/analytics.test.ts convex/aggregates.test.ts` | 47/47 passed | ~1s |

All 3 Wave 0 deliverables were created during phase execution; the draft's `❌ W0` / `⬜ pending` markers are now resolved to `✅`. The 2 Manual-Only items (live backfill correctness, 16 MiB headroom at prod volume) remain genuinely deploy-only and were operator-confirmed at prod (131k events, full-fidelity widget output) per 88-04-SUMMARY.md.

**Note:** Phase 88 has no `88-VERIFICATION.md` (it was never run through `/gsd-verify-work`). This validation pass confirms automated test coverage is complete and green, but a formal goal-backward verification of the phase was never produced — flagged in `v9.0-MILESTONE-AUDIT.md` as a separate tech-debt item.
