---
phase: 105-tool-trace-observability
plan: 09
subsystem: validation
tags: [live-verification, self-hosted-convex, astridr, d-15, tool-policy]

# Dependency graph
requires:
  - phase: 105-02
    provides: astridr commit deployed and proven live (set_round_context, tool_was_offered)
  - phase: 105-05
    provides: TraceWaterfall nesting/cache-ratio, live-verified
  - phase: 105-08
    provides: Tools page assembly, live-verified
provides:
  - "OBS-02 fully satisfied: all 4 tool_policy_event kinds live, D-06 isolation control passes"
  - "A real, ~2-week-old D-15 regression found and fixed going forward (command_execution's untagged toolExecutions insert)"
  - "A real, pre-existing WebhookStatusBadge bug found and fixed (misleading 'Retrying (0/3)' for digest/skipped alerts)"
affects: []

requirements-completed: [OBS-02]

duration: ~4h (attended, multi-checkpoint)
completed: 2026-08-04
---

# Phase 105 Plan 09: Live Validation Summary

**Live-verified Phase 105 against the running self-hosted stack. OBS-02 fully passes. OBS-01 and
OBS-03 stay honestly PARTIAL — both have real, live-verified core functionality plus one genuine gap
each, found and either fixed (D-15) or correctly left unforced (D-12, unattributed rows). Two
defects the green unit suite could not see were found live and fixed: a ~2-week-old D-15 regression
and a pre-existing misleading alert-delivery badge.**

## What the live gate caught that no green suite could see

1. **D-15 regression, ~2 weeks old, found live (Task 3).** `runtimeIngest.ts`'s pre-existing
   `command_execution` case (predates Phase 105) inserted a second, untagged `toolExecutions` row
   for every single Ástríðr tool call — confirmed live: one real weather induction bumped the
   Claude-Code-only `successRate` query's `weather` count from 2→3. Root-caused to
   `execution_tracker.py` wrapping every tool call (`origin="user_request"`, not automation-only).
   Querying by session ID found untagged rows dating back to **2026-07-22**, spanning most of
   Ástríðr's tool catalog. Fixed going forward (`resolveCommandExecutionToolRow` now tags
   `provider: "astridr"`, live-verified against a second real induction post-deploy). The historical
   backlog is explicitly NOT retagged — CLAUDE.md forbids bulk-patching the live self-hosted
   instance — and is recorded as a follow-up.
2. **Misleading webhook-delivery badge, pre-existing since Phase 06-05, found live (Task 2).**
   `WebhookStatusBadge` predates "digest"/"dashboard_only"/"disabled" notification-mode preferences;
   any alert whose severity routes away from immediate delivery sat on `webhookStatus: "pending"`
   forever with zero attempts, rendering as "Retrying (0/3)" — implying an active, failing retry
   loop that was never happening. Found on the real `malformed_policy_reload_rejected` alert this
   plan's own induction created. Fixed live: two new terminal statuses (`digest`, `skipped`) with
   accurate copy; verified against the actual row that exposed the bug.

Neither defect was visible to the phase's own unit suite (both are `runMutation`/`ctx.db`-seam
behavior this project deliberately leaves un-unit-tested) or to a green `npx vitest run`.

## PARTIAL, and why

- **OBS-01: D-15 fixed going forward only.** See above — the ~2-week historical backlog stays.
- **OBS-03: D-12 per-session truncation not organically exercised.** `SESSION_TOOLS_READ_CAP`/
  `SESSION_CALLS_READ_CAP` are both 1000 — no live session remotely approaches that. Not forced
  synthetically, per this plan's own "a fixture that never hits it proves nothing" standard. (The
  SEPARATE `successRate`/`avgDuration` 4000-row/24h window cap, tagged "OBS-01 (D-12 extended)" in
  the verification map, DID trip for real and unplanned during this session's own heavy tool usage —
  genuine evidence the truncation mechanism itself works.)
- **OBS-03: "unattributed tool rows" render path has no live example.** Every session with real LLM
  calls (post-105-02/03 deploy) is fully attributed. The historical untagged rows (the OBS-01 D-15
  backlog) all sit under placeholder sessionIds with zero `llm` rows, so `TraceWaterfall` takes the
  "No LLM calls yet" empty state before ever reaching the untraced-render branch.

## Leak-kind induction: real attempts, then sanctioned synthetic fallback

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

## Final requirement marker state

- **OBS-02 — ✓ SATISFIED.** Full live pass, no gaps: all 4 policy kinds live, D-06 isolation control
  (exactly 2 alerts, correct severities), dedup confirmed, zero enforcement wording, delivery
  investigated to root cause, policy feed UI matches spec exactly (colors, Bell markers, expand-row
  values, sane relative time).
- **OBS-01 — ⚠ PARTIAL.** Core mechanism live-verified correct (real astridr `toolExecutions` rows,
  source filter, hourly buckets). D-15 fixed going forward; historical backlog open.
- **OBS-03 — ⚠ PARTIAL.** Nesting and cache ratio live-verified correct (hand-checked
  27980/(27980+27980+946) = 49.17% → displayed 49%, exact match). D-12 per-session cap and
  unattributed-rows render path both genuinely not exercisable with current live data.
- **`nyquist_compliant: false`** in `105-VALIDATION.md` frontmatter — per the plan's own rule, stays
  false because not every Manual-Only row passed cleanly. This is an honest PARTIAL, not a failure:
  every core deliverable that COULD be live-verified was, and both defects found live were fixed
  (not hidden) or correctly left unforced with the reason recorded.

## Deviations from plan (both fixed, both logged as separate commits)

1. **WebhookStatusBadge "Retrying (0/3)" fix** (Task 2) — `convex/webhookDelivery.ts`,
   `convex/schema.ts`, `src/components/WebhookStatusBadge.tsx`/`.test.tsx`. Out of plan's declared
   `files_modified`; found live, fixed per CLAUDE.md's Error Triage rule, verified against the real
   alert row that exposed it.
2. **D-15 `command_execution` provider-tag fix** (Task 3) — `convex/runtimeIngest.ts`,
   `convex/runtimeIngest.test.ts`. Same rationale; verified against a fresh real induction post-fix.

Both deviations: `npx tsc --noEmit` clean, full suite green before and after (273 files / 3401 tests
final state, up from 3393 at Task 1 start), `npx convex deploy --yes` → `No indexes are deleted by
this push` each time.

## Issues encountered

- One transient `npx vitest run` flake (1 test failed once, green on the two immediate re-runs
  after) — consistent with resource contention from the heavy concurrent browser automation running
  throughout this session, not a real regression from either fix. Not investigated further given
  strong reproducibility evidence (2/3 clean runs, identical code).
- `docker stats convex-backend` baseline was notably high (62% memory, 39.8GiB/64GiB) both before
  and after this plan's writes — stable across both `convex deploy` runs (no jump), so not implicated
  by this plan's work, but worth a future look given this project's tombstone/memory-ballooning
  history.

## Next steps

- A dedicated, batch-capped cleanup phase to retag or otherwise resolve the ~2-week D-15 historical
  backlog (untagged `toolExecutions` rows under `sessionId: "unknown"`/`"astridr"`).
- Revisit OBS-03's D-12/unattributed-rows PARTIALs once real usage naturally produces a session large
  enough to trip the per-session caps, or a genuinely untraced-but-attributed session exists.
- The `docker stats` 62% memory baseline is worth a standalone look given this project's tombstone
  history, independent of this plan.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-04*
