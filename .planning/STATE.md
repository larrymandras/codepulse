---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Readability & Experience
status: executing
stopped_at: Phase 88 context gathered
last_updated: "2026-06-24T12:51:45.301Z"
last_activity: 2026-06-24
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it.
**Current focus:** Phase 88 — analytics-rollup-table-durable-fix-for-convex-16-mib-read-li

## Current Position

Phase: 88 (analytics-rollup-table-durable-fix-for-convex-16-mib-read-li) — EXECUTING
Plan: 2 of 4
Status: Plan 88-01 complete (classifier extraction + Nyquist test scaffolds) — Plan 88-02 ready
Last activity: 2026-06-24 -- Plan 88-01 executed (Wave 0)

Progress: [███░░░░░░░] 25%

## v9.0 Roadmap

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 88 | Analytics Rollup | AR-01, AR-02, AR-03 | In Progress (1/4 plans) |
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

### Pending Todos

- **Phase 90 pre-work:** Read `astridr-repo/war_room_routes.py` and `convex/warRoomIngest.ts` to confirm the `warRooms` ingest path before planning. Do NOT start ROOM code without confirming `POST /api/war-room` exists and populates Convex rooms.
- **Archive-name collision:** Before `/gsd-complete-milestone`, rename `milestones/v9.0-*.md` etc. (stale archives from a different Astridhr track) to `astridhr-adversarial-v9.0-*` so the completion step doesn't clobber them.

### Blockers/Concerns

- **Phase 90 cross-repo dependency (ROOM-03):** Real operator Join requires extending the Ástríðr participant-join/voice surface. If not ready, observer mode is the fallback. Must audit before Phase 90 plan.
- **Phase 91 FPS at 4,038 nodes:** No controlled benchmark yet. FPS ≥30 is a blocking acceptance criterion — validate against the live `graphSnapshots` snapshot before shipping.

## Session Continuity

Last session: 2026-06-24T12:51:37.938Z
Stopped at: Completed 88-01-PLAN.md (Wave 0 — classifier extraction + Nyquist test scaffolds)
Next action: Execute 88-02-PLAN.md (Wave 1 — ingest-time rollup write path: incrementEventBucket / incrementSankeyBuckets + events.ingest idempotencyKey dedup)
Resume file: None
