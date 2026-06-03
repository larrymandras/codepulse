---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Knowledge Graph Observability & Hardening
status: ready
last_updated: "2026-06-01T00:00:00.000Z"
last_activity: 2026-06-01
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-01)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard.
**Current focus:** v6.0 Knowledge Graph Observability & Hardening — roadmap complete, ready to plan Phase 71
**Last completed:** v5.0 milestone archived (2026-05-25)

## Current Position

Phase: 71 — CI & Production Hardening
Plan: —
Status: Ready to plan
Last activity: 2026-06-01 — v6.0 roadmap created (4 phases, 12 requirements mapped)

**Progress bar:** [░░░░░░░░░░] 0% (0/4 phases)

## Performance Metrics

**Velocity (v4.0 baseline):**

- Total plans completed: 63
- Phases: 8
- Timeline: 39 days (2026-03-06 → 2026-04-14)

**v4.0 By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 01 | 4 | Complete |
| 02 | 4 | Complete |
| 03 | 6 | Complete |
| 04 | 6 | Complete |
| 05 | 5 | Complete |
| 06 | 5 | Complete |
| 07 | 5 | Complete |
| 58 | 1 | Complete |

**v5.0 By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 59 | 2 | Complete |
| 60 | — | Complete (outside GSD) |
| 61 | — | Complete (outside GSD) |
| 62 | — | Schema only (delivery → Phase 70) |
| 63 | — | Infra only (viz → Phase 70) |
| 64 | — | Schema only (API → Phase 70) |
| 65 | — | Complete (outside GSD) |
| 66 | 4 | Complete |
| 67 | 4 | Complete |
| 68 | 4 | Complete |
| 69 | 4 | Complete |
| 70 | 4 | Complete |

**v6.0 By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 71 | TBD | Not started |
| 72 | TBD | Not started |
| 73 | TBD | Not started (ext. blocked) |
| 74 | TBD | Not started (ext. blocked) |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

**v5.0 key constraints:**

- D3.js (or Recharts) for sunburst/area charts — dagre already available from Phase 3 for call graph layout
- Resend for email delivery (consistent with existing Convex action pattern)
- PagerDuty Events API v2 (not REST API) — stable dedup_key pattern for trigger/resolve lifecycle
- GitHub PAT for Actions dispatch — GitHub App auth deferred to future requirement (EXT-03d2)

**Phase 66 decisions:**

- CLIGatewayTool telemetry uses local import pattern (inside branch) to avoid circular deps — matches schedule_wakeup.py analog
- Fire-and-forget `try/except Exception: pass` guard: telemetry must never break task execution (T-66-08)
- `session_id` sourced from `get_session_context()` context var, falls back to `task_id` when no active session
- `duration_ms = duration_seconds * 1000` — gateway returns seconds, CodePulse stores ms
- Phase 70: Resend email digest + PagerDuty trigger/resolve + call graph dagre visualization
- Phase 70: dagre graph created per-call inside computeLayout (not module scope) for deterministic layout
- Phase 70: PD routing key validation added (code review fix WR-06), "unknown" agent filtering added post-UAT

**v6.0 key decisions:**

- KG phases (73-74) are BLOCKED on Ástríðr Phase 125 (backfill) + Phase 126 (KG HTTP read API + kg_summary emitter). Do not start planning Phase 73 until both ship.
- ForceGraphCanvas extracted from ObsidianGraph.tsx as shared renderer — ObsidianGraph refactored to use it, keeping its tests green
- kgApi.ts and kg-graph.ts are separate modules: kgApi is the typed fetch layer, kg-graph is pure transform logic (testable without network)
- KG graph data is fetch-on-demand from Ástríðr (not mirrored into Convex) — only kgSummary is persisted in Convex for always-on cards
- Temporal state (asOf) is server-side: the asOf param triggers a re-fetch; client-side deriveView handles type/predicate/agent filtering only
- Literal-object triples are NOT graph nodes — they render as attributes in KGDetailsPanel only
- Design authority for all KG work: `docs/superpowers/specs/2026-06-01-astridr-kg-visualization-design.md`

### Pending Todos

- Run `/gsd-plan-phase 71` to begin Phase 71 planning
- Monitor Ástríðr repo for Phase 125 (backfill) and Phase 126 (KG read API) completion before starting Phase 73

### Blockers/Concerns

- Phases 73 and 74 are externally blocked on Ástríðr Phase 125 + Phase 126. Phases 71 and 72 are unblocked.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260603-or6 | Register Opus 4.8 in cost model + fix 3× Opus over-pricing (opus-4-5/4-6 were Opus-3 $15/$75 → corrected to $5/$25), add opus-4-8 to model dropdown | 2026-06-03 | 92c04e3 | [260603-or6-codepulse-register-opus-4-8-in-cost-mode](./quick/260603-or6-codepulse-register-opus-4-8-in-cost-mode/) |

## Session Continuity

Last session: 2026-06-01
Stopped at: v6.0 roadmap created
Resume file: None
