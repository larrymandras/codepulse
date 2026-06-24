---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Readability & Experience
status: executing
stopped_at: Phase 88 COMPLETE — analytics rollup + read-path rewrite + token fidelity (4/4 plans, AR-01/02/03 satisfied, verified on prod)
last_updated: "2026-06-24T00:00:00.000Z"
last_activity: 2026-06-24
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it.
**Current focus:** Phase 88 — analytics-rollup-table-durable-fix-for-convex-16-mib-read-li

## Current Position

Phase: 88 (analytics-rollup-table-durable-fix-for-convex-16-mib-read-li) — COMPLETE
Plan: 4 of 4 (all complete)
Status: Phase 88 COMPLETE. All 4 plans done + 2 gap-closures (backfillHistorical read-amplification rewrite; token-fidelity rollup). AR-01/02/03 satisfied. Verified on prod tidy-whale-981: the 4 analytics queries read aggregates buckets with no 16 MiB error; backfill rebuilt cleanly (130,834 events); token sunburst shows 240,305,124 tokens.
Last activity: 2026-06-24 -- Phase 88 closed out (88-04 SUMMARY written, requirements reconciled)

Progress: [██████████] 100%

## v9.0 Roadmap

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 88 | Analytics Rollup | AR-01, AR-02, AR-03 | ✅ Complete (4/4 plans) |
| 89 | Readable Themes & Editorial Skin Toggle | TH-01..TH-06 | Not started |
| 90 | Agent Room / War Room | ROOM-01..ROOM-04 | Not started |
| 91 | 3D Memory Galaxy | G3D-01, G3D-02 | Not started |

**Execution order:** 88 → 89 → 90 → 91. Phase 89 TH-01 (`useThemeColors()`) gates Phase 91 (hard dependency). Phase 90 requires cross-repo Ástríðr audit before planning.

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

**v9.0 scoping decisions (2026-06-23):**

- **Reverse "3D out of scope"** — opt-in mode on `CodeVaultGraph` only (not a new page); `react-force-graph-3d` not R3F (near-identical prop API, manages own WebGLRenderer).
- **Phase 89 sub-sequence** — token cleanup (77 hex sites) → no-flash script → key consolidation → Aubergine tokens → WCAG-AA axe audit. `class="dark"` stays permanent (all v9.0 themes are dark variants).
- **Phase 90 cross-repo gate** — confirm `POST /api/war-room` ingest path and `warRooms` Convex population before writing any ROOM code. If Join isn't feasible, ship observer mode with honest label.
- **Phase 88 quick-unblock** — `.take()` caps deployed `edb614c` are fragile; this phase replaces them with ingest-time rollups in `convex/analyticsRollup.ts` (new file) + wired from `ingest.ts` / `runtimeIngest.ts`.

**Phase 88 Plan 01 decisions (2026-06-24, Wave 0):**

- **Classifier extracted VERBATIM** into shared `convex/lib/sankeyClassify.ts` (sole source of `categoryOf`/`outcomeOf`, read+write paths; `payload` param dropped per OQ-2). The plan's `<behavior>` examples assumed case-INSENSITIVE `outcomeOf` (`"ToolError"→"Error"`); the real code is case-SENSITIVE (`.includes("error")`), so capitalized forms classify as `"Success"`. Kept the classifier byte-identical (T-88-01) and corrected the TEST expectations instead (`tool_error`/`tool_fail`→`"Error"`).
- **Cross-plan RED-scaffold pattern** — not-yet-built Convex modules are loaded behind a non-literal `@vite-ignore` dynamic import + a loose local module type, so dependent tests RED cleanly without breaking Vite transform or `tsc --noEmit`. Used for the Plan-02 (`incrementEventBucket`/dedup) and Plan-04 (aggregates-backed queries) targets.
- **AR-01/02/03 NOT marked complete** — they are phase-level and only complete at Plan 04; Plan 01 is scaffolding + extraction only.

**Phase 88 Plan 02 decisions (2026-06-24, Wave 1):**

- **Rollup WRITE PATH landed atomically.** `events.ingest` now dedups on `by_idempotencyKey` (early return) and, on a fresh insert, increments the `"events"` + two `"sankey_edge"` buckets — all in ONE OCC mutation (D-01/D-04). Un-keyed events always counted (D-05). The 4 write-path RED tests from Plan 01 (idempotency / no-key-counted / patch-or-insert / backfill-count-equality) are now GREEN.
- **`computeHourly` event-count + error-count branches DELETED (D-02)** in the same wave that adds ingest-time increments — Convex per-deploy atomicity means co-locating them is the only way to avoid a double-count transition tick (Pitfall 1 / T-88-04). Cost read replaced unbounded `.collect()` with a paginated cursor loop (`LLM_PAGE_SIZE 500`, D-03/T-88-05, 16 MiB-safe).
- **`incrementBatch` is `internalMutation`, never public** (T-88-03 — a public increment endpoint = unauthenticated tampering). `backfillHistorical` action exists but is NOT run here (run = Plan 03, operator-gated). `idempotencyKey = body/d.idempotencyKey ?? event_id` wired through both httpActions; neither writes `ctx.db` rollups.
- **Ran `npx convex codegen` (offline, NOT a deploy)** to regenerate `_generated/api.d.ts` for the new `analyticsRollup` module; annotated `backfillHistorical`'s runQuery result as `PaginationResult<Doc<"events">>` to break a tsc TS7022 inference cycle (events↔rollup cross-import).
- **2 remaining RED tests** in `analytics.test.ts` are the Plan-04 read-path targets (`activityHeatmapFromAggregates`/`errorRateTrendFromAggregates`), documented RED-pending Plan 04 — NOT regressions from Plan 02.

### Pending Todos

- **Phase 90 pre-work:** Read `astridr-repo/war_room_routes.py` and `convex/warRoomIngest.ts` to confirm the `warRooms` ingest path before planning. Do NOT start ROOM code without confirming `POST /api/war-room` exists and populates Convex rooms.
- **Archive-name collision:** Before `/gsd-complete-milestone`, rename `milestones/v9.0-*.md` etc. (stale archives from a different Astridhr track) to `astridhr-adversarial-v9.0-*` so the completion step doesn't clobber them.

### Blockers/Concerns

- **Phase 90 cross-repo dependency (ROOM-03):** Real operator Join requires extending the Ástríðr participant-join/voice surface. If not ready, observer mode is the fallback. Must audit before Phase 90 plan.
- **Phase 91 FPS at 4,038 nodes:** No controlled benchmark yet. FPS ≥30 is a blocking acceptance criterion — validate against the live `graphSnapshots` snapshot before shipping.

## Session Continuity

Last session: 2026-06-24
Stopped at: 88-04-PLAN.md Tasks 1-2 DONE (commit 3077b76 — read-path rewrite: the 4 analytics queries read aggregates buckets via by_type_period_bucket, all quick-unblock .take caps removed, tokenWaterfall/sessionDurations untouched; tsc clean, full convex/ suite green incl. the 2 formerly-RED *FromAggregates tests). 88-03 (backfill, Wave 2) already complete. Plan 88-04 is NOT yet complete — Task 3 (checkpoint:human-verify) is pending operator: deploy + visually verify the live Analytics page (heatmap/sankey/error-trend/sunburst render full-fidelity, no 16 MiB read-limit error).
Next action: Operator completes 88-04 Task 3 UI verification (deploy + eyeball Analytics), then the orchestrator finalizes 88-04-SUMMARY.md and marks the plan/phase complete.
Resume file: None
