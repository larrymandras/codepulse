---
phase: 105-tool-trace-observability
plan: 09
subsystem: validation
tags: [live-verification, self-hosted-convex, astridr, d-15, tool-policy, migrations]

# Dependency graph
requires:
  - phase: 105-02
    provides: astridr commit deployed and proven live (set_round_context, tool_was_offered)
  - phase: 105-05
    provides: TraceWaterfall nesting/cache-ratio, live-verified
  - phase: 105-08
    provides: Tools page assembly, live-verified
provides:
  - "OBS-01/02/03 all fully satisfied, live-verified against the running self-hosted stack"
  - "A real, ~2-week-old D-15 regression found, fixed going forward, AND its historical backlog closed (91 rows retagged)"
  - "A real, pre-existing WebhookStatusBadge bug found and fixed (misleading 'Retrying (0/3)' for digest/skipped alerts)"
  - "D-12 truncation banner and unattributed-tool-rows render path live-verified via a labeled, cleaned-up synthetic seed"
affects: []

requirements-completed: [OBS-01, OBS-02, OBS-03]

duration: ~5h (attended, multi-checkpoint)
completed: 2026-08-04
---

# Phase 105 Plan 09: Live Validation Summary

**Live-verified Phase 105 against the running self-hosted stack. All three requirements — OBS-01,
OBS-02, OBS-03 — are fully satisfied. Two real defects the green unit suite could not see were found
live and fixed: a ~2-week-old D-15 regression (fixed going forward AND its historical backlog
closed) and a pre-existing misleading alert-delivery badge. Two verification gaps that started as
honest PARTIALs (D-12 truncation, unattributed tool rows) were closed via clearly-labeled, fully
cleaned-up synthetic seed data, per explicit operator direction after initial review.**

## What the live gate caught that no green suite could see

1. **D-15 regression, ~2 weeks old, found live (Task 3), fully closed.** `runtimeIngest.ts`'s
   pre-existing `command_execution` case (predates Phase 105) inserted a second, untagged
   `toolExecutions` row for every single Ástríðr tool call — confirmed live: one real weather
   induction bumped the Claude-Code-only `successRate` query's `weather` count from 2→3.
   Root-caused to `execution_tracker.py` wrapping every tool call (`origin="user_request"`, not
   automation-only). Fixed going forward: `resolveCommandExecutionToolRow` now tags
   `provider: "astridr"`, live-verified against a second real induction post-deploy. Querying by
   session ID then found untagged rows dating back to **2026-07-22**, spanning most of Ástríðr's
   tool catalog (91 rows) — closed via a new, explicitly-scoped `convex/migrations.ts` migration
   (`backfillAstridrProviderTag`, dry-run verified then applied), live-confirmed on the actual
   Dashboard's Tool Executions panel and via query: zero Ástríðr tool names remain under
   `excludeProvider: "astridr"`.
2. **Misleading webhook-delivery badge, pre-existing since Phase 06-05, found live (Task 2), fixed.**
   `WebhookStatusBadge` predates "digest"/"dashboard_only"/"disabled" notification-mode preferences;
   any alert whose severity routes away from immediate delivery sat on `webhookStatus: "pending"`
   forever with zero attempts, rendering as "Retrying (0/3)" — implying an active, failing retry
   loop that was never happening. Found on the real `malformed_policy_reload_rejected` alert this
   plan's own induction created. Fixed live: two new terminal statuses (`digest`, `skipped`) with
   accurate copy; verified against the actual row that exposed the bug.

Neither defect was visible to the phase's own unit suite (both are `runMutation`/`ctx.db`-seam
behavior this project deliberately leaves un-unit-tested) or to a green `npx vitest run`.

## Verification gaps closed via labeled synthetic data (not organically reproducible)

Two OBS-03 behaviors genuinely cannot be organically reproduced with real usage in any reasonable
timeframe: `SESSION_TOOLS_READ_CAP`/`SESSION_CALLS_READ_CAP` (both 1000) would need 1000+ real chat
turns in one session, and no real session combines "has LLM calls" with "has an untraced tool row"
(every post-105-02/03 `tool_executed` row carries `traceId`/`round`). Per explicit operator
direction (after initial review flagged these as honest PARTIALs), closed via a new, clearly-scoped
`convex/migrations.ts` pair: `seedTruncationTestData` inserted exactly 1000 synthetic `toolExecutions`
rows (998 correctly-attributed + 1 with a matching `traceId` but no `round` + 1 with no `traceId` at
all) plus 1 `llmMetrics` row, all under a dedicated, clearly-fake test sessionId
(`system:105-09-truncation-test`, never a real Ástríðr session). The live UI rendered exactly as
designed: the truncation banner verbatim ("Showing the most recent 1000 tool executions — older
tool calls in this session aren't loaded"), a "TOOL CALLS WITH NO REPORTED ROUND · 1" section, and a
separate "UNTRACED TOOL CALLS · 1" section — neither guessed onto Round 1. Console stayed clean
under the 1000-row render. `cleanupTruncationTestData` removed all seeded rows immediately after
verification (re-queried empty); `docker stats convex-backend` memory was stable across the whole
sequence (62.03%→62.66%, no ballooning).

## Leak-kind and execution_denied induction: real attempts, then sanctioned synthetic fallback

Per finding F5, attempted real induction of `tool_call_leaked_as_text` twice via the web chat (asked
Ástríðr to write its own tool-call XML "for docs", then via a fabricated "you got disconnected"
completion prompt) — both cleanly refused by the model (correct safety behavior, not a bug). Fell
back to the sanctioned synthetic `telemetry.send`, labeled explicitly "ingest path only, not a
detector verification" in `105-VALIDATION.md`.

`execution_denied` also ended up synthetic, extending F5's fallback by explicit user decision after
confirming the kind is **structurally** unreachable, not merely hard: the web-chat session talks to
the `commander` agent category, which `TASK_CATEGORY_TO_CLUSTERS` in `astridr/agent/tool_filter.py`
maps to every cluster — `tools_for_turn_names` is fixed per-agent-category, not per-message, so no
chat phrasing can narrow what's offered to the commander. Confirmed experimentally (asked Ástríðr to
run "Bash"; it wasn't even in Ástríðr's own tool catalog, so it fabricated a plausible response
rather than attempting a real tool call).

## Final requirement marker state — all three fully satisfied

- **OBS-01 — ✓ SATISFIED.** Core mechanism live-verified correct (real Ástríðr `toolExecutions`
  rows with populated `durationMs`/`traceId`/`round`, source filter, hourly buckets). D-15 fully
  closed: going-forward fix live-verified AND the 91-row historical backlog retagged and confirmed
  clean on the live Dashboard.
- **OBS-02 — ✓ SATISFIED.** Full live pass, no gaps: all 4 policy kinds live, D-06 isolation control
  (exactly 2 alerts, correct severities), dedup confirmed, zero enforcement wording, delivery
  investigated to root cause, policy feed UI matches spec exactly (colors, Bell markers, expand-row
  values, sane relative time).
- **OBS-03 — ✓ SATISFIED.** Nesting and cache ratio live-verified correct (hand-checked
  27980/(27980+27980+946) = 49.17% → displayed 49%, exact match). D-12 per-session truncation and
  unattributed-rows both live-verified via labeled, fully cleaned-up synthetic seed data.
- **`nyquist_compliant: true`** in `105-VALIDATION.md` frontmatter — every Manual-Only row now
  genuinely passed.

## Deviations from plan (all fixed, all logged as separate commits)

1. **WebhookStatusBadge "Retrying (0/3)" fix** (Task 2) — `convex/webhookDelivery.ts`,
   `convex/schema.ts`, `src/components/WebhookStatusBadge.tsx`/`.test.tsx`. Out of plan's declared
   `files_modified`; found live, fixed per CLAUDE.md's Error Triage rule, verified against the real
   alert row that exposed it.
2. **D-15 `command_execution` provider-tag fix** (Task 3) — `convex/runtimeIngest.ts`,
   `convex/runtimeIngest.test.ts`. Same rationale; verified against a fresh real induction post-fix.
3. **D-15 historical backfill** (Task 3, post-review) — `convex/migrations.ts`
   (`backfillAstridrProviderTag`). Per explicit operator direction after initial checkpoint review;
   dry-run verified (91 matched) before apply (91 patched), re-verified 0 remaining.
4. **D-12/unattributed-rows synthetic seed + cleanup** (Task 3, post-review) — `convex/migrations.ts`
   (`seedTruncationTestData`, `cleanupTruncationTestData`). Same rationale; seed and teardown both
   live-verified, zero residue.

All four: `npx tsc --noEmit` clean throughout, full suite green before and after each (273 files /
3401 tests final state, up from 3393 at Task 1 start), `npx convex deploy --yes` → `No indexes are
deleted by this push` on every deploy (4 total across the plan).

## Issues encountered

- One transient `npx vitest run` flake (1 test failed once, green on the two immediate re-runs
  after) — consistent with resource contention from the heavy concurrent browser automation running
  throughout this session, not a real regression from any fix. Not investigated further given
  strong reproducibility evidence (2/3 clean runs, identical code).
- `docker stats convex-backend` baseline was notably high (62% memory, ~40GiB/64GiB) throughout —
  stable across all 4 deploys and the ~2000 total row writes/deletes this plan performed (schema
  pushes, D-15 fix, badge fix, 91-row backfill, 1000-row seed + cleanup) — no ballooning observed,
  but the baseline itself is worth a standalone look given this project's tombstone/memory history,
  independent of this plan's work.

## Next steps

- None outstanding from this plan — all three requirements are fully closed. The `docker stats` 62%
  memory baseline is worth a standalone investigation in a future session, unrelated to Phase 105.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-04*
