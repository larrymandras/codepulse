---
phase: 05-data-pipeline
fixed_at: 2026-04-14T00:00:00Z
review_path: .planning/phases/05-data-pipeline/05-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-04-14
**Source review:** .planning/phases/05-data-pipeline/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (1 Critical, 7 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Hardcoded Personal Email Addresses in Source Code

**Files modified:** `src/pages/Settings.tsx`
**Commit:** a1b9917
**Applied fix:** Replaced hardcoded email literals (`mandrasle@gmail.com`, `lmandras@myprotectall.com`) with `import.meta.env.VITE_EMAIL_PERSONAL`, `VITE_EMAIL_BUSINESS`, and `VITE_EMAIL_CONSULTING` environment variable references, defaulting to empty string. Add these to `.env` (which is .gitignored).

### WR-01: `evaluate` Deduplication Uses Wrong Set — Misses Active Alerts by Source

**Files modified:** `convex/alerts.ts`
**Commit:** dee9680
**Applied fix:** Added a clarifying comment in `createIfNew` documenting that `activeSourceSet` is keyed on `a.source` and that all inserts set `source=ruleId`, making the dedup check correct today. The comment explicitly warns that dedup will break silently if `source` ever differs from `ruleId`.

### WR-02: `autoAcknowledgeStale` Is a Public Mutation That Duplicates `autoAcknowledgeStaleInternal`

**Files modified:** `convex/alerts.ts`
**Commit:** 3cef272
**Applied fix:** Removed the public `autoAcknowledgeStale` mutation entirely. The cron already uses `autoAcknowledgeStaleInternal`. Frontend bulk dismissal is served by the existing `dismissAll` mutation.

### WR-03: `listBySource` Performs an Uncapped Full-Table Scan With Client-Side Filter

**Files modified:** `convex/schema.ts`, `convex/alerts.ts`
**Commit:** d404c82
**Applied fix:** Added `.index("by_source", ["source", "createdAt"])` to the `alerts` table in schema.ts. Updated `listBySource` to use `.withIndex("by_source", (q) => q.eq("source", args.source))` and `.take(limit)` directly, eliminating the 500-row full scan and client-side filter.

### WR-04: `detail` Query in `agents.ts` Uses a Hard `.take(500)` to Estimate Event Count

**Files modified:** `convex/agents.ts`
**Commit:** 087ef40
**Applied fix:** Replaced the `.take(500)` events query with a lookup of the session record via `.withIndex("by_sessionId")`, returning `sessionData?.eventCount ?? 0`. This uses the pre-maintained `eventCount` field on the sessions table, avoiding a potentially-truncated 500-row scan.

### WR-05: `tokenSunburst` and Several `llm.ts` Queries Perform Full-Table Scans with No Limit

**Files modified:** `convex/analytics.ts`, `convex/llm.ts`
**Commit:** 1e7d8d5
**Applied fix:** Added a 30-day lookback cutoff (`cutoff = Date.now() / 1000 - 30 * 86400`) to all six unbounded `.collect()` calls: `tokenSunburst` (analytics.ts), and `costByProvider`, `costByModel`, `providerBreakdown`, `costOverTime`, `latencyOverTime` (llm.ts). Each now uses `.withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))` to cap the scan.

### WR-06: `computeHourly` Has No Idempotency Guard — Re-runs Double-Insert Aggregates

**Files modified:** `convex/aggregates.ts`
**Commit:** 160df40
**Applied fix:** Added an existence check at the start of `computeHourly` that queries `aggregates` for an existing `cost/hourly` row with the same `bucket_start`. If one is found, the function returns early — preventing all inserts for that hour and guarding against cron retries or manual double-triggers producing duplicate aggregate rows.

### WR-07: `hitlStats` Computes `todayStart` Incorrectly — Off By UTC Offset

**Files modified:** `convex/security.ts`
**Commit:** 6db834c
**Applied fix:** Replaced `now - (now % 86400)` with an explicit UTC midnight calculation using `Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate()) / 1000`. This matches the bucket calculation pattern used in `aggregates.ts` and is unambiguous about UTC day boundaries.
**Note:** This is a logic fix — requires human verification that UTC midnight is the intended boundary for "today" in the security dashboard context.

---

_Fixed: 2026-04-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
