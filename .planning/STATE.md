---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Forge Integration
status: "v7.0 active — 78/79 shipped; 80/81/82 in active roadmap"
stopped_at: "Milestone v7.0 activated; phases 80/81/82 brought into the active roadmap"
last_updated: "2026-06-16T00:00:00.000Z"
last_activity: "2026-06-16 -- v7.0 Forge Integration activated (78/79 shipped, 80/81/82 planning)"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
  percent: 40
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it. v7.0 extends "drive its coding agents" to **Forge** — one application for all coding-agent work.
**Current focus:** v7.0 Forge Integration — Phase 80 (Command Bridge) is next.
**Last completed:** Phase 79 — Forge UI Tab (read-only render), shipped PR #20 (2026-06-15).

## Current Position

Phase: 80 — Command Bridge (not started)
Plan: —
Status: v7.0 active; 78/79 shipped, 80/81/82 in the active roadmap (81 design locked in 081-SPEC)
Last activity: 2026-06-16 -- v7.0 Forge Integration activated

**Progress bar:** [████░░░░░░] 40% (2/5 phases)

## Milestone Status (2026-06-16)

**v7.0 Forge Integration — ACTIVE.** Promoted 2026-06-13 from backlog 999.1, activated 2026-06-16. 5 phases (78-82), Surface-Substrate fold-in of Forge into CodePulse. Forge engine stays LOCAL; cloud-frontend ↔ local-daemon bridge via Convex ingest (up) + command queue (down).

| Phase | Name | Status |
|-------|------|--------|
| 78 | Forge Emitter + Convex Schema | ✅ Shipped (2026-06-13) |
| 79 | Forge UI Tab (read-only) | ✅ Shipped — PR #20 (2026-06-15) |
| 80 | Command Bridge (launch + stop) | 📋 Active (next) — FI-06/07/08 |
| 81 | Live Log Streaming | 📋 Active — design locked, 081-SPEC.md — FI-09/10/11 |
| 82 | Files + Artifact Preview + Hardening | 📋 Active — FI-12/13/14 |

**v6.0 Agentic OS Front-End — PARKED.** 71/72/73/74/76 shipped (light-mode); **75 (Agent Console)** blocked on Ástríðr M1.P0 + M1.P3; **77 (CI & Prod Hardening)** is 2/3 plans (77-03 remaining). Re-activates after Forge Integration / once Ástríðr Surface-Substrate gates clear. Requirements retained in REQUIREMENTS.md.

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

**v7.0 Forge Integration decisions:**

- **Surface-Substrate bridge** — Forge runs as a local daemon; state goes UP via `/forge-ingest` httpAction, commands come DOWN via a Convex `forgeCommands` queue the daemon long-polls. Rejected: a cloud tab calling `http://localhost` directly (mixed-content blocked).
- **Read-only, one-way until Phase 80** — Forge is source of truth for job state; Convex is a replica. Idempotent upserts keyed by `(hostId, forgeJobId)`, last-writer-wins on `updatedAt` (D-05, Phase 78).
- **Shared bearer auth** — `FORGE_INGEST_API_KEY`, server-to-server only, never in the browser (D-03, Phase 78). Phase 81 log-ingest reuses the same key (081-SPEC D-3).
- **Phase 81 design locked (081-SPEC, 2026-06-15)** — supersedes the original HIGH-risk SSE/WebSocket spike. Logs: `POST /forge-log-ingest` → append-only `forgeLogChunks` (monotonic per-job `seq` for ordering + idempotency, D-1) → reactive `forge.listJobLogs` query. Convex reactivity IS the live tail (no transport to build). Retention: 7-day TTL cron + per-job byte cap, drop-oldest, with a test (D-2). Risk: HIGH → LOW.

**Phase 79 implementation notes (carried):**

- JobStatus/JobMode inline in useForge.ts for path isolation.
- ForgeStatusBadge uses Tailwind tokens; SC#4 amber≠red preserved.
- ForgeJobList card is a single button (delete-X stripped per D-01).
- ForgePage derives isLoading from `useForgeJobsRaw() === undefined`; detail renders from the loaded list row — no getJob round-trip.
- Flame icon for the Forge CONSOLE nav entry (no collision with hammer, D-06).

### Pending Todos

- **Phase 80 (next):** `/gsd-discuss-phase 80` — design the `forgeCommands` queue + daemon long-poll contract and the launch/stop UI (port NewJobModal). Pairs with a Forge-repo command-poll daemon.
- **Phase 81:** `/gsd-discuss-phase 81` — 081-SPEC.md is the authoritative scope; formalize the Convex log-ingest receiver + retention test, then the cross-repo `makeLogSink` finalization (closes Forge `08-HUMAN-UAT.md`).
- **Cross-repo:** the Forge-side log sink (`src/emit/log-forwarder.ts makeLogSink`) is a dormant `TODO(P81)` no-op gated on `FORGE_LOG_INGEST_URL` — lit up in Phase 81.

### Blockers/Concerns

- **v6.0 parked phases** — 75 (Agent Console) blocked on Ástríðr M1.P0 + M1.P3; 77 (CI/Prod Hardening) 2/3 plans, 77-03 remaining. Not blockers for v7.0.
- **v6.0 traceability** is stale (71-76 marked Pending in REQUIREMENTS.md though shipped light-mode) — reconcile under the parked QA-01 when v6.0 resumes; out of scope for v7.0.

## Session Continuity

Last session: 2026-06-16
Stopped at: v7.0 Forge Integration activated; PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md reconciled.
Next action: **`/gsd-discuss-phase 80`** — Command Bridge (launch + stop). Phase 81 has a locked SPEC ready when 80 lands.
Resume file: None
