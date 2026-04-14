---
status: partial
phase: 05-data-pipeline
source: [05-VERIFICATION.md]
started: 2026-04-14T14:00:00Z
updated: 2026-04-14T14:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cron produces aggregate rows
expected: Invoke computeHourly and confirm rows appear in the aggregates table with correct metric_type, period, bucket_start, and value
result: [pending]

### 2. Archival marks old rows
expected: Insert a 31-day-old event row, invoke markStaleArchived, confirm archived=true
result: [pending]

### 3. Analytics page shows aggregate data
expected: Browser Network tab shows aggregates:costByPeriod query, not llm:costByProvider
result: [pending]

### 4. Load More button works
expected: With 25+ items, confirm initial 25-item render, button appearance, and append-on-click behavior
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
