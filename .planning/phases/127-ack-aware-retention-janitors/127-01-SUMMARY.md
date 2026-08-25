---
phase: 127-ack-aware-retention-janitors
plan: 01
subsystem: convex-retention
tags: [retention, cursor, schema, indexes]
dependency-graph:
  requires: []
  provides:
    - "partitionBatchForPrune: optional cursor-field extractor + lastCursorValue"
    - "inbox.closedAt field + by_closedAt index"
    - "ideationFindings.by_dismissed widened + by_dismissedAt index"
  affects:
    - "127-02 (inbox auto-close/prune janitor) — consumes by_closedAt + lastCursorValue"
    - "127-03 (ideationFindings auto-dismiss janitor) — consumes by_dismissedAt + lastCursorValue"
    - "127-08 (blocking schema push) — deploys the index changes made here"
tech-stack:
  added: []
  patterns:
    - "Cursor-advance helper generalized to application fields via an optional extractor, mirroring the existing _creationTime default"
key-files:
  created: []
  modified:
    - convex/retentionCursor.ts
    - convex/retentionCursor.test.ts
    - convex/schema.ts
decisions:
  - "closedAt is a NEW field, never ackedAt (R-02) — ackedAt stays the sole read/unread signal for Inbox.tsx and IntelligenceFeedPanel.tsx"
  - "closedAt and ideationFindings timestamps are epoch SECONDS, not the milliseconds media.ts's TRASH_GRACE_MS template uses"
  - "by_dismissed widened rather than replaced — audited non-breaking against all 4 live callers"
  - "No by_ackedAt index added (superseded D-06 proposal stays out)"
metrics:
  duration: "~25 min"
  completed: 2026-08-25
---

# Phase 127 Plan 01: Cursor-Advance Foundation + Schema Groundwork Summary

One-liner: Generalized `partitionBatchForPrune`'s cursor-advance guarantee from
`_creationTime`-only to any application field via an optional extractor, and added the
`inbox.closedAt` / `by_closedAt` / widened `by_dismissed` / new `by_dismissedAt` schema pieces
both upcoming ack-aware janitors (127-02, 127-03) will read from.

## What Was Built

**Task 1 — `partitionBatchForPrune` cursor-field extractor** (`convex/retentionCursor.ts`,
`convex/retentionCursor.test.ts`): Added an optional third parameter `cursorField?: (doc: T) =>
number` and a new return key `lastCursorValue: number | null`, computed in the same loop from
every iterated doc (deleted or skipped) — mirroring the existing `lastCreationTime` treatment
that is this module's whole reason for existing (D-08's "a skipped row still advances the
cursor" guarantee). When no extractor is supplied, `lastCursorValue` falls back to
`doc._creationTime`, so it equals `lastCreationTime` for the existing default path. The
production call site at `convex/retention.ts:352` needed no edit — confirmed by an empty `git
diff convex/retention.ts` at both task-level and plan-level verification.

Added a new `describe` block (`partitionBatchForPrune — Phase 127 optional cursor-field
extractor`) covering: the default-path regression control (concrete values asserted, not just
"defined"); the all-skipped default-path control; the empty-batch default-path control; the
extractor path where `lastCursorValue` and `lastCreationTime` are independently correct; the
D-08 trap (all-skipped batch with an extractor still reports a non-null `lastCursorValue`); and
the empty-batch-with-extractor case (`null`).

**Task 2 — Schema groundwork** (`convex/schema.ts`):
- `inbox` gains `closedAt: v.optional(v.float64())`, commented with its three load-bearing
  facts: sole writer is the not-yet-built `internal.inbox.autoCloseAndPrune` (plan 127-02);
  deliberately NOT `ackedAt` per R-02, because `ackedAt` alone drives read/unread state in
  `src/pages/Inbox.tsx:130` and `src/components/control-center/IntelligenceFeedPanel.tsx:64`;
  and it is epoch SECONDS, matching every other timestamp in this table.
- `inbox` gains `.index("by_closedAt", ["closedAt", "createdAt"])`, serving both the future
  auto-close scan (`.eq("closedAt", undefined)` ordered by `createdAt`) and the delete step's
  range read (`.gte/.lt` on `closedAt`) off one index.
- `ideationFindings.by_dismissed` widened from `["dismissed"]` to `["dismissed", "createdAt"]`.
- `ideationFindings` gains `.index("by_dismissedAt", ["dismissedAt"])` for the future
  auto-dismiss janitor's delete step.
- No `closedAt` field or `by_ackedAt` index added anywhere — both superseded-decision
  guardrails hold.

## Caller Audit (required by the plan, recorded here)

`grep -rn "by_dismissed" convex/ src/` returns exactly 5 hits: the index definition itself
(`schema.ts:907`, post-edit) plus 4 production callers —
`convex/briefings.ts:196`, `convex/ideation.ts:48`, `convex/ideation.ts:60`,
`convex/ideationFindings.ts:52`. All four call `.withIndex("by_dismissed", (q) =>
q.eq("dismissed", ...))` with no second predicate and no dependence on the index's single-field
shape (one caller chains `.order("desc")` after, which is unaffected by an index widening).
Widening to `["dismissed", "createdAt"]` is confirmed non-breaking.

## Schema Push Status

**The schema is NOT yet pushed to the self-hosted backend.** `npx tsc --noEmit` passes because
Convex's TypeScript types are generated from `schema.ts` directly, not read back from the live
database — a green typecheck here is not evidence the `by_closedAt` / widened `by_dismissed` /
`by_dismissedAt` indexes exist on the running instance. The push is plan 127-08's blocking human
task, per this project's CLAUDE.md self-hosted operational rules (no `convex deploy` from an
unattended agent context, and index changes on the live single-node SQLite backend are
deliberately gated behind a human-reviewed step).

## Verification

- `npx vitest run convex/retentionCursor.test.ts convex/retention.test.ts
  convex/retentionCoverage.test.ts` — 60/60 passed (3 test files).
- `npx tsc --noEmit` — no errors, both after Task 1 and after Task 2.
- `git diff convex/retention.ts` — empty at plan-level verification; the existing nightly-prune
  call site is byte-unchanged.
- `grep -n "partitionBatchForPrune(batch, PRUNE_PREDICATES\[table\])" convex/retention.ts` —
  exactly one line.
- `grep -c "lastCursorValue" convex/retentionCursor.ts` — 6 (>= 3 required).
- `grep -n "closedAt" convex/schema.ts` — 5 hits, all inside the `inbox` table block
  (lines 2185-2205); zero hits inside the `ideationFindings` table block. Comments in the
  `ideationFindings` block were deliberately worded to avoid the literal string `closedAt` so
  this grep stays discriminating.
- `grep -n 'index("by_dismissed"' convex/schema.ts` — shows `["dismissed", "createdAt"]`.
- `grep -n 'index("by_dismissedAt"' convex/schema.ts` — one line.
- `grep -n 'index("by_ackedAt"' convex/schema.ts` — zero hits (control: the `by_closedAt` grep
  above returns real hits, so this zero is discriminating, not a broken pattern).

## Deviations from Plan

**1. [Rule 1 - bug avoidance, caught during self-review] Reworded `ideationFindings` index
comments to avoid the literal string `closedAt`.** The plan's own acceptance criterion requires
`grep -n "closedAt" convex/schema.ts` to show nothing inside the `ideationFindings` table. My
first draft of the `by_dismissedAt` comment referenced "the `by_closedAt` pattern above" and
"a `closedAt` field" for cross-referencing context, which would have made that grep non-zero
inside the wrong table and silently defeated the acceptance check's discriminating power. Fixed
by rewording to describe the relationship without repeating the literal field/index name (`convex/schema.ts:908-911`).
Re-verified: the `closedAt` grep now returns only the 5 expected hits, all inside `inbox`.

No other deviations. Plan executed as written; both janitor-consumer schema shapes match
`127-CONTEXT.md`'s R-02 text (`by_closedAt: ["closedAt", "createdAt"]`) exactly.

## Commits

- `bf3bc4e9` — feat(127-01): widen partitionBatchForPrune with an optional cursor-field extractor
- `2290229b` — feat(127-01): schema — inbox.closedAt + by_closedAt; widen by_dismissed; add by_dismissedAt

## Self-Check

- `convex/retentionCursor.ts` — FOUND, modified in `bf3bc4e9`.
- `convex/retentionCursor.test.ts` — FOUND, modified in `bf3bc4e9`.
- `convex/schema.ts` — FOUND, modified in `2290229b`.
- Commit `bf3bc4e9` — FOUND in `git log --oneline`.
- Commit `2290229b` — FOUND in `git log --oneline`.

## Self-Check: PASSED
