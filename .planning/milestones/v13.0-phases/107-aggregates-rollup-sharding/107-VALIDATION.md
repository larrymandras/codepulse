---
phase: 107
slug: aggregates-rollup-sharding
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-05
---

# Phase 107 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `107-RESEARCH.md` § Validation Architecture, plus a live baseline
> measurement taken 2026-08-05 09:34 EDT (see § Live Baseline below).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.9 (jsdom; Convex tests use an in-memory fake `ctx.db` — see `analyticsRollup.test.ts:25-53` `makeStore()`) |
| **Config file** | `vitest.config.ts` (repo root — not modified by this phase) |
| **Quick run command** | `npx vitest run convex/analyticsRollup.test.ts convex/aggregates.test.ts convex/analytics.test.ts` |
| **Full suite command** | `npm test` |
| **Type check** | `npx tsc --noEmit` |
| **Estimated runtime** | ~60s quick / full suite ~2528 tests |

---

## Sampling Rate

- **After every task commit:** `npx vitest run convex/analyticsRollup.test.ts convex/aggregates.test.ts convex/analytics.test.ts`
- **After every plan wave:** `npm test` + `npx tsc --noEmit`
- **Before `/gsd-verify-work`:** full suite green, `tsc` clean, **AND** the D-05 live rate comparison below
- **Max feedback latency:** ~60 seconds

**The phase is NOT done on green tests alone.** OCC-01 names a live operational outcome; unit tests can prove correctness of the sharded read/write shape but cannot prove contention dropped.

---

## Live Baseline (measured 2026-08-05 09:34 EDT — read this before designing the D-05 task)

Measured directly, not inherited from CONTEXT.md:

| Metric | Value |
|--------|-------|
| `convex-backend` container started | 2026-08-05 08:45:21 EDT (recreated to clear the incident) |
| Uptime at measurement | 49 minutes |
| Total OCC/conflict/retry lines in available window | 526 |
| ...of which on the **`aggregates`** table | **510 (97%)** |
| ...on other tables (`discoveredTools`) | 16 — **out of scope per D-02**, noted only |
| **Normalized rate** | **~644/hour → ~15,457/24h projected** |
| Hottest single document | `td715ppk7vphadrtfxdfhs9mq98bw8y0` — 177 of 510 (35%) |

### ⚠ Two corrections to D-05's stated method — required for the comparison to be valid

D-05's *intent* (live before/after OCC-retry log comparison) is correct and unchanged. Its
stated *arithmetic* cannot work as literally written, for two independently sufficient reasons:

1. **`--since 24h` cannot return 24h of data.** The container was recreated 49 minutes before
   this measurement, and every prior incident was likewise "only cleared by a full container
   recreate" — which starts a new log stream. A nominal `--since 24h` silently returns only
   the uptime window. Running it before *and* after a deploy would compare a 49-minute window
   against a multi-hour one and report a dramatic "improvement" produced entirely by the
   window mismatch. **This is a false-green trap and must not be used as written.**
2. **The 1135/24h figure is not a like-for-like comparator.** 1135/24h implies ~47/hour. The
   live measured rate is ~644/hour — ~13.6x higher. Comparing a post-fix number against 1135
   would flatter the result regardless of whether the fix worked.

**Corrected method — compare normalized RATE over equal, explicitly-stated windows, scoped to the target table:**

```bash
# Both before and after, use the SAME window length W, and W must be <= container uptime.
# Scope to the aggregates table so the ~3% unrelated discoveredTools OCC noise doesn't dilute it.
docker logs convex-backend --since ${W} 2>&1 \
  | grep -Ei 'occ|conflict|retry' | grep -c '"aggregates" table'
```

Record, for **both** the before and after run: the window length W, the container's uptime at
measurement, the raw count, and the derived per-hour rate. A comparison missing any of those
four is not evidence. Also record ingest volume for each window (`events` rows in that window)
so a rate drop caused by *less traffic* can be distinguished from one caused by *the fix*.

---

## Per-Task Verification Map

Task IDs are placeholders until plans are written; the planner owns final numbering.

| Task | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|------|-------------|----------|-----------|-------------------|-------------|--------|
| schema | OCC-01 | `shard` present as optional field; deploy reports no index deletion | manual/CLI | `npx convex deploy` output asserted to contain `No indexes are deleted by this push` | n/a | ⬜ pending |
| write-01 | OCC-01 | Same shard → patches existing row; different shard → inserts a new row | unit | `npx vitest run convex/analyticsRollup.test.ts -t "shard"` | ❌ W0 (rewrite of `analyticsRollup.test.ts:193-208`) | ⬜ pending |
| write-02 | OCC-01 | Shard drawn once per `events.ingest` call and passed explicitly to both helpers (not drawn inside them) | unit | `npx vitest run convex/events.test.ts -t "shard"` | ❌ W0 | ⬜ pending |
| read-01 | OCC-01 | Multi-shard fixture sums to the FULL value in all four readers | unit | `npx vitest run convex/aggregates.test.ts convex/analytics.test.ts -t "shard"` | ❌ W0 | ⬜ pending |
| read-02 | OCC-01 | Row with missing/undefined `shard` (pre-existing history) participates in summing normally | unit | `npx vitest run convex/aggregates.test.ts -t "unsharded"` | ❌ W0 | ⬜ pending |
| live-01 | OCC-01 | OCC rate on `aggregates` drops vs. the corrected baseline above | **live only** | see § Live Baseline corrected method | n/a | ⬜ pending |
| live-02 | OCC-01 | Read totals still correct post-shard (guards a "fixed contention, broke the fold" merge) | **live spot-check** | compare one recent hour's `eventCountsByPeriod` total against a raw `events` count for that hour (technique from `88-03-PLAN.md:99`) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `convex/analyticsRollup.test.ts` — **rewrite** the existing patch-or-insert test (lines 193-208) to pass explicit `shard` values. If shard is drawn randomly inside the helper this test becomes genuinely flaky (7/8 failure chance), so this rewrite is a correctness prerequisite, not cleanup.
- [ ] `convex/analyticsRollup.test.ts` — **new**: two `incrementEventBucket` calls, same eventType/hour, *different* explicit shards → asserts **two** rows exist (proves the split actually happens).
- [ ] `convex/aggregates.test.ts` / `convex/analytics.test.ts` — **new**: seed 2+ rows with identical `dimensions` but different `shard`, assert `eventCountsByPeriod`, `heatmapFromAggregates`, `sankeyFromAggregates`, `errorRateTrendFromAggregates`, and `rollupDaily` each return the **full summed** value. This is the actual regression guard for the priority question.
- [ ] `convex/analytics.test.ts` — strengthen `errorRateTrendFromAggregates` (lines 181-193) with a second same-hour same-error-type row; it is the one fold whose existing test never exercises multi-row accumulation into one slot.
- [ ] No framework install needed — Vitest is fully wired.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OCC contention actually drops | OCC-01 | Emitted by the Convex **runtime**, not application code. `console.log` inside a UDF does not reach `docker logs` on self-hosted Convex (confirmed 2026-07-30) — an in-code counter cannot be the evidence and must not be added. | § Live Baseline corrected method, before and after deploy |
| Read totals unchanged post-shard | OCC-01 | Requires real production data spanning both sharded and unsharded rows | Compare a recent hour's `eventCountsByPeriod` total to a raw `events` row count for the same hour |
| Schema push is non-destructive | OCC-01 | Only observable from live deploy output against the self-hosted instance | Capture `npx convex deploy` output; assert it contains `No indexes are deleted by this push` |

**Explicitly excluded:** a synthetic concurrent-write load test. CONTEXT.md `<deferred>` rules it out for this phase; the live before/after comparison is the sole required contention evidence.

---

## Dangerous (False-Green) Assertions — do not accept these as proof

1. **`--since 24h` before/after across a container recreate.** Returns only the uptime window; manufactures an "improvement" from a window-length mismatch. See § Live Baseline.
2. **Comparing any post-fix number against the raw `1135` figure.** Different rate basis (~47/h vs the measured ~644/h). Compare rates, not totals.
3. **`aggregates.test.ts:255-278` (`rollupDaily` summing) and `:390-401` (`eventCountsByPeriod` grouping).** Both **re-implement the grouping algorithm inline in the test** instead of calling the real exported functions — they pass unconditionally even if production code regresses. Pre-existing weakness, not introduced here, but it means the shard-safety claim for those two readers rests on code review, not on these tests. The new Wave-0 tests must call the **real exported functions**.
4. **Any test asserting only on row *count* after a sharded write.** Count and correctness are orthogonal once a bucket spans multiple rows. Every shard test must assert the summed **value**.
5. **A lower OCC count alone.** It is possible to reduce contention while silently breaking a fold. D-05 evidence must be paired with the live read-total spot-check (`live-02`).
6. **A rate drop during a low-traffic window.** Record ingest volume alongside each measurement, or a quiet period reads as a fix.

---

## Validation Sign-Off

Checked items were independently re-evaluated against the six plans by `gsd-plan-checker`
(2026-08-05), not inferred from this file's own frontmatter flag.

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ MISSING references (107-01 write-path, 107-02 read-path)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter
- [ ] **Execution-time gate:** live baseline captured with window length + uptime + count + rate + traffic volume, **before** deploy — owned by `107-04-PLAN.md`, which `107-05` refuses to run without

**Approval:** approved 2026-08-05 for execution. The single unchecked box is an execution-time
gate, not a planning gap — it cannot be satisfied until the phase runs.
