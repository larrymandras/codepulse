# Phase 5: Data Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 05-data-pipeline
**Areas discussed:** Aggregation strategy, Retention & archival, Pagination approach, Migration path

---

## Aggregation Strategy

### Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Core three | LLM cost, event counts, and error rates — matches DP-01 exactly | ✓ |
| Core three + token usage | Add per-model token consumption as fourth aggregate | |
| Broad rollups | Aggregate everything queryable: cost, tokens, events, errors, sessions, latency | |

**User's choice:** Core three (Recommended)
**Notes:** Matches requirements exactly. Token usage can be added later if Phase 7 needs it.

### Table Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single unified table | One `aggregates` table with metric_type, period, bucket_start, value, dimensions | ✓ |
| Separate table per metric | costAggregates, eventCountAggregates, errorRateAggregates | |
| Single table, two granularities | One table with daily rows computed from hourly rows (roll-up) | |

**User's choice:** Single unified table (Recommended)
**Notes:** Simpler schema, one cron per period.

### Cron Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Hourly + daily | Hourly scans raw, daily rolls up hourly rows | ✓ |
| Hourly only | Only hourly aggregates, daily views sum at query time | |
| Event-driven | Aggregate on every ingest mutation | |

**User's choice:** Hourly + daily (Recommended)

### Dimensions

| Option | Description | Selected |
|--------|-------------|----------|
| Key breakdowns | Cost by provider+model, events by type, errors by category | ✓ |
| Totals only | Just total per time bucket | |
| You decide | Claude determines dimension depth | |

**User's choice:** Key breakdowns (Recommended)

---

## Retention & Archival

### Archive Method

| Option | Description | Selected |
|--------|-------------|----------|
| Soft delete with flag | Add `archived: true` field, filter in queries | ✓ |
| Move to archive table | Copy to separate table, delete from primary | |
| Hard delete | Delete events older than threshold | |

**User's choice:** Soft delete with flag (Recommended)

### Table Scope

| Option | Description | Selected |
|--------|-------------|----------|
| High-volume tables | events, runtime_events, llmMetrics, toolExecutions | ✓ |
| All event-type tables | Every timestamped table including security, selfHealing, fileOps, etc. | |
| You decide | Claude determines based on row counts | |

**User's choice:** High-volume tables (Recommended)

### Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page control | Dashboard-configurable, stored in Convex config table | ✓ |
| Environment variable only | Set via env var on deploy | |
| Hardcoded default | 30-day hardcoded, dashboard config later | |

**User's choice:** Settings page control (Recommended)

---

## Pagination Approach

### Style

| Option | Description | Selected |
|--------|-------------|----------|
| Cursor-based infinite scroll | Convex index-based cursors with Load more | ✓ |
| Numbered pages | Traditional page 1, 2, 3 navigation | |
| You decide | Claude picks per page | |

**User's choice:** Cursor-based infinite scroll (Recommended)

### Priority

| Option | Description | Selected |
|--------|-------------|----------|
| All list views | Events, sessions, agents, executions, alerts, LLM calls, security | ✓ |
| Highest-volume only | Just events, runtime_events, llmMetrics | |
| Analytics + Events only | Two pages pulling most data | |

**User's choice:** All list views (Recommended)

### Page Size

| Option | Description | Selected |
|--------|-------------|----------|
| 25 items | Balances density with load speed | ✓ |
| 50 items | Denser, matches current .take(50) pattern | |
| You decide | Claude optimizes per list view | |

**User's choice:** 25 items (Recommended)

---

## Migration Path

### Transition Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Incremental swap | Add aggregates first, swap queries one at a time | ✓ |
| Big bang cutover | Build all infrastructure, rewrite all queries at once | |
| Dual-read with toggle | Queries auto-detect aggregate availability | |

**User's choice:** Incremental swap (Recommended)

### Historical Data

| Option | Description | Selected |
|--------|-------------|----------|
| Start fresh | Aggregates begin from cron start, older data falls back to raw queries | ✓ |
| One-time backfill | Migration script computes aggregates from existing data | |
| Backfill last 30 days | Only backfill retention window | |

**User's choice:** Start fresh (Recommended)

---

## Claude's Discretion

- Exact schema for unified aggregates table (field names, index design)
- Archival cron scheduling details
- Convex cursor implementation details
- Order of Analytics page query swaps
- Whether to create shared usePaginatedQuery hook

## Deferred Ideas

None — discussion stayed within phase scope.
