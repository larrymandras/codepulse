---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Readability & Experience — ACTIVE
status: executing
stopped_at: context exhaustion at 75% (2026-06-25)
last_updated: "2026-06-25T21:52:22.279Z"
last_activity: 2026-06-25
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 17
  completed_plans: 17
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it.
**Current focus:** Phase 92 — voice-activated-command-palette-jarvis-mode

## Current Position

Phase: 92 (voice-activated-command-palette-jarvis-mode) — EXECUTING
Plan: 2 of 6
Status: Ready to execute
Last activity: 2026-06-25

Progress: [██████████] 100%

## v9.0 Roadmap

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 88 | Analytics Rollup | AR-01, AR-02, AR-03 | ✅ Complete (4/4 plans) |
| 89 | Readable Themes & Editorial Skin Toggle | TH-01..TH-06 | ✅ Complete (7/7 plans) |
| 90 | Agent Room / War Room | ROOM-01..ROOM-04 | Not started |
| 91 | 3D Memory Galaxy | G3D-01, G3D-02 | Not started |
| 92 | Voice-Activated Command Palette (Jarvis Mode) | VOX-01..VOX-04 | ✅ Complete (5/5 plans) |

**Execution order:** 88 → 89 → 92 (done) → 90 → 91. Phase 90 requires cross-repo Ástríðr audit before planning (confirm `POST /api/war-room` ingest path). Phase 91 needs the FPS≥30 benchmark at ~4k nodes before shipping.

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

**Phase 89 Plan 01 decisions (2026-06-24, Wave 0):**

- **`@axe-core/playwright` operator-approved legitimacy gate** — installed at 4.12.1 after operator confirmed npmjs.com listing (Deque Systems `@axe-core` org, dequelabs/axe-core-npm, millions weekly downloads). Required for TH-06 WCAG-AA contrast audit.
- **`resolveThemeColors` exported module-level** (not inside hook) — shared by the lazy `useState` initializer and the MutationObserver callback; avoids creating a new closure on each render.
- **`waitFor()` required for MutationObserver test** — jsdom fires MutationObserver callbacks asynchronously; `act()` alone does not flush them. Added `await waitFor(() => expect(...))` in the re-resolve test.
- **ThemeSwitcher amber option removed; readable + aubergine added** — per PATTERNS.md §ThemeSwitcher changes; trigger width widened to `w-[160px]`.
- **e2e specs seeded RED-pending** — all 3 e2e specs (contrast, no-fouc, reduced-motion) are scaffolded with `RED-pending: <plan>` comments; they correctly fail until Plans 02-04 ship token blocks, inline script, and CSS suppression rules.
- [Phase ?]: AgentCard amber shadow preserved as status identity
- [Phase ?]: CategoryGrid COLOR_HEX map EXEMPT
- [Phase 89]: Canvas legibility, aubergine grain, vault-node violet, and no-flash classified as manual-only (axe cannot audit canvas/perceptual behaviors); T-89-15 repudiation mitigated — operator sign-off received 2026-06-24 — Per 89-VALIDATION §Manual-Only Verifications; five checks approved by operator; no axe exclusions applied across all 20 WCAG-AA contrast cases

### Pending Todos

- **Phase 90 pre-work:** Read `astridr-repo/war_room_routes.py` and `convex/warRoomIngest.ts` to confirm the `warRooms` ingest path before planning. Do NOT start ROOM code without confirming `POST /api/war-room` exists and populates Convex rooms.
- **Archive-name collision:** Before `/gsd-complete-milestone`, rename `milestones/v9.0-*.md` etc. (stale archives from a different Astridhr track) to `astridhr-adversarial-v9.0-*` so the completion step doesn't clobber them.

### Blockers/Concerns

- **Phase 90 cross-repo dependency (ROOM-03):** Real operator Join requires extending the Ástríðr participant-join/voice surface. If not ready, observer mode is the fallback. Must audit before Phase 90 plan.
- **Phase 91 FPS at 4,038 nodes:** No controlled benchmark yet. FPS ≥30 is a blocking acceptance criterion — validate against the live `graphSnapshots` snapshot before shipping.

## Session Continuity

Last session: 2026-06-25T21:52:22.272Z
Stopped at: context exhaustion at 75% (2026-06-25)
Next action: After operator approves checkpoint (or reports defects), continuation agent writes 89-07-SUMMARY.md and updates ROADMAP/STATE
Resume file: None
