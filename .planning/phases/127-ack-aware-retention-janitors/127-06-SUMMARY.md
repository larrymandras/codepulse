---
phase: 127-ack-aware-retention-janitors
plan: 06
subsystem: convex-retention-coverage
tags: [retention, janitor, crons, coverage, inbox, ideation]
dependency-graph:
  requires:
    - "127-02: internal.inbox.autoCloseAndPrune"
    - "127-03: internal.ideation.autoCloseAndPrune"
  provides:
    - "convex/crons.ts: inbox-janitor (08:20 UTC), ideation-findings-janitor (08:35 UTC) — live, uncommented crons.daily() registrations"
    - "convex/retentionCoverage.ts: inbox and ideationFindings moved into COVERAGE_BOUNDED_BY_CRON, machine-checked against comment-stripped crons.ts"
  affects:
    - "127-08 (blocking human deploy — pushes schema/indexes these janitors read, and the only place source registration becomes an actually-firing cron)"
tech-stack:
  added: []
  patterns:
    - "D-09 bucket move: a table's bounding mechanism must live in COVERAGE_BOUNDED_BY_CRON, which retentionCoverage.test.ts checks against COMMENT-STRIPPED crons.ts source, so a future comment-out is caught rather than silently reproducing the 2026-08-21 graphSnapshots failure"
key-files:
  created: []
  modified:
    - convex/crons.ts
    - convex/retentionCoverage.ts
decisions:
  - "R-04 slots (08:20/08:35 UTC), not D-07's original 08:00/08:15 proposal — 08:00 UTC is claimed by sweep-graph-snapshot-versions' hourly crons.interval, so the offset avoids scheduler contention outright rather than judging collision unlikely"
  - "The plan's own action text names the inbox field as 'ackedAt' in prose, but its acceptance criteria demands zero literal ackedAt hits in retentionCoverage.ts — resolved by describing the field as 'the separate acknowledgement timestamp field' instead of using the literal token, satisfying both the content requirement and the grep control"
metrics:
  duration: "~25 min"
  completed: 2026-08-25
---

# Phase 127 Plan 06: Wire Janitors Into Live Crons + Coverage Bucket Summary

One-liner: Registered `inbox-janitor` (08:20 UTC) and `ideation-findings-janitor` (08:35 UTC)
as live `crons.daily()` entries in `convex/crons.ts`, and moved both `inbox` and
`ideationFindings` from `COVERAGE_PRUNE_PROPOSED` into `COVERAGE_BOUNDED_BY_CRON` in
`convex/retentionCoverage.ts`, retiring the stale `ackedAt`-keyed prescription note.

## What Was Built

**Task 1** (`convex/crons.ts`, commit `c6223302`) — two new `crons.daily()` registrations
appended before `export default crons;`:
- `"inbox-janitor"` at `{ hourUTC: 8, minuteUTC: 20 }` → `internal.inbox.autoCloseAndPrune`,
  args `{}` (four-argument form matching `studio-trash-prune`'s convention).
- `"ideation-findings-janitor"` at `{ hourUTC: 8, minuteUTC: 35 }` →
  `internal.ideation.autoCloseAndPrune`, args `{}`.
- Both entries carry file-style prose comments: the `inbox-janitor` comment states this cron
  is the ONLY thing bounding `inbox`, that it is batch-capped/cursor-seeked, and that the
  first run drains a known ~2,450-row backlog in roughly 13 batches. The
  `ideation-findings-janitor` comment states the cron is inert by design until roughly
  2026-11-16 (180-day auto-dismiss window against a table whose oldest row was 94 days old on
  2026-08-21) and that it logs unconditionally on every invocation, including zero-work runs,
  so a long inert stretch reads as attributable rather than broken.
- Both comments explain the 08:20/08:35 slot choice explicitly: 08:00 UTC is not an empty
  slot even though no `crons.daily` claims it — `sweep-graph-snapshot-versions` is
  `crons.interval({ hours: 1 })` and therefore also fires at 08:00 UTC (R-04).
- Neither entry is commented out. `convex/retention.ts` was not touched — `git diff
  convex/retention.ts` is empty, and neither table was added to `RETENTION_DAYS`.

**Task 2** (`convex/retentionCoverage.ts`, commit `a1b4f107`) — the coverage bucket move:
- Deleted the `inbox` and `ideationFindings` entries from `COVERAGE_PRUNE_PROPOSED`.
- Added `inbox: "internal.inbox.autoCloseAndPrune"` and
  `ideationFindings: "internal.ideation.autoCloseAndPrune"` to `COVERAGE_BOUNDED_BY_CRON`,
  with a comment above the two new entries stating what each mechanism keys on: `inbox` keys
  on a dedicated `closedAt` lifecycle field — not the separate acknowledgement timestamp
  field, which two frontend surfaces render read/unread state from and which this janitor
  only ever reads, never writes; `ideationFindings` keys on its existing
  `dismissed`/`dismissedAt`. Both are noted as auto-close-then-delete janitors rather than
  calendar prunes, which is why they belong in this bucket rather than `RETENTION_DAYS`.
- This deletion is what retires the stale note that cited a drifted `schema.ts:2112` line
  number and prescribed an ack-timestamp-keyed janitor design R-02 superseded — the note no
  longer exists anywhere in the file.
- No other bucket entry was touched. `COVERAGE_PRUNED` is unchanged and still matches
  `RETENTION_DAYS` exactly.

## Verification

- `npx tsc --noEmit` — clean after Task 1 (confirms both `internal.inbox.autoCloseAndPrune`
  and `internal.ideation.autoCloseAndPrune` resolve from `./_generated/api`).
- `grep -n "inbox-janitor\|ideation-findings-janitor" convex/crons.ts` — exactly two lines,
  neither beginning with `//` (the janitor names also had to be scrubbed from surrounding
  comment prose to keep this grep exact — see Deviations).
- `grep -n "minuteUTC: 20\|minuteUTC: 35" convex/crons.ts` — the two new entries, confirmed.
- `grep -n "internal.inbox.autoCloseAndPrune\|internal.ideation.autoCloseAndPrune"
  convex/crons.ts` — exactly two lines.
- `git diff convex/retention.ts` — empty.
- `grep -n "ackedAt" convex/retentionCoverage.ts` — zero hits (grep exit code 1). Control:
  `grep -c "closedAt" convex/retentionCoverage.ts` — 1, confirming the pattern discriminates
  and the zero is real.
- `grep -n "inbox:" convex/retentionCoverage.ts` — exactly one line, inside
  `COVERAGE_BOUNDED_BY_CRON`. Same for `ideationFindings:`.
- `npx vitest run convex/retentionCoverage.test.ts` — 11/11 passed after Task 1 alone (the
  exactly-one-bucket and BOUNDED_BY_CRON-liveness checks don't fail with the tables still in
  `COVERAGE_PRUNE_PROPOSED`), and again after Task 2's move.
- `npx vitest run convex/retentionCoverage.test.ts convex/retention.test.ts` — 27/27 passed
  after Task 2.
- `npm test` — full suite green: 364 test files passed, 17 skipped; 5128 tests passed, 4
  skipped, 195 todo. No failures. (Console noise about `ResizeObserver` loops and
  `HTMLCanvasElement.getContext` is pre-existing jsdom/browser-mode chatter, unrelated to this
  plan's files.)
- `git diff --stat convex/` across both commits together — only `crons.ts` and
  `retentionCoverage.ts` changed.
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` — empty after each commit; no accidental
  deletions.

## What This Plan Does NOT Establish

Per the plan's own `<verification>` section: this plan's checks read the repository, not the
live backend. A green `retentionCoverage.test.ts` and clean `git diff` prove the two crons are
registered in source and that the coverage map is internally consistent — they do **not** prove
either cron has ever fired, or that the `by_closedAt` / widened `by_dismissed` / `by_dismissedAt`
indexes these janitors depend on exist on the live self-hosted backend yet. Per
`127-02-SUMMARY.md` and `127-03-SUMMARY.md`, those indexes are not yet pushed. Plan 127-08's
Verification F (the blocking human deploy) is the only step that can establish actual firing.
No `npx convex deploy` or any deploy command was run by this plan.

## Deviations from Plan

**1. [Rule 1 - bug in plan's own acceptance criteria interaction] Removed literal janitor-name
strings from prose comments in `crons.ts`.** The plan's Task 1 acceptance criteria required
`grep -n "inbox-janitor\|ideation-findings-janitor" convex/crons.ts` to return exactly two
lines. My first draft of the explanatory comments referenced the sibling janitor by name in
prose ("...to avoid the sibling ideation-findings-janitor below..." and "...offset 15 minutes
from inbox-janitor above..."), which added two extra grep matches. Reworded both to describe
the sibling janitor without repeating its literal cron-name string ("its sibling findings
janitor below" / "its sibling inbox janitor above"). No content was lost — both comments still
explain the offset rationale — this was purely making the acceptance grep exact.

**2. [Rule 1 - bug in plan's own acceptance criteria interaction] Described the inbox
acknowledgement field without the literal string "ackedAt" in `retentionCoverage.ts`.** The
plan's Task 2 `<action>` text explicitly asks for a comment saying `inbox` keys on `closedAt`
"— **not** `ackedAt`, which two frontend surfaces render read/unread state from." But the same
task's acceptance criteria requires `grep -n "ackedAt" convex/retentionCoverage.ts` to return
NOTHING. Writing the action text verbatim would have failed the plan's own acceptance check.
Resolved by describing the field as "the separate acknowledgement timestamp field" — same
factual content (inbox's janitor keys on `closedAt`, not the acknowledgement field, which two
frontend surfaces render read/unread state from), zero literal `ackedAt` occurrences. Verified
with the discriminating control pair specified in the plan (`ackedAt` zero hits, `closedAt`
non-zero).

No other deviations. Both tasks match the plan's `<action>` and `must_haves.truths` exactly.

## Commits

- `c6223302` — feat(127-06): register inbox and ideation-findings janitors on live daily crons
- `a1b4f107` — feat(127-06): move inbox and ideationFindings into COVERAGE_BOUNDED_BY_CRON

## Self-Check

- `convex/crons.ts` — FOUND, modified in `c6223302`.
- `convex/retentionCoverage.ts` — FOUND, modified in `a1b4f107`.
- Commit `c6223302` — FOUND in `git log --oneline`.
- Commit `a1b4f107` — FOUND in `git log --oneline`.
- `internal.inbox.autoCloseAndPrune` and `internal.ideation.autoCloseAndPrune` resolve in
  `crons.ts` — confirmed by a clean `npx tsc --noEmit`.

## Self-Check: PASSED
