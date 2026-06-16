---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Forge Integration
status: ready_to_plan
stopped_at: Phase 80 complete (4/4) — ready to discuss Phase 081
last_updated: 2026-06-16T17:25:40.356Z
last_activity: 2026-06-16
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it. v7.0 extends "drive its coding agents" to **Forge** — one application for all coding-agent work.
**Current focus:** Phase 081 — live log streaming
**Last completed:** Phase 80 — Command Bridge (launch + stop), 4/4 plans, verified live 2026-06-16 (bridge round-trip: launch + stop). Code on `forge-command-bridge` (CodePulse) + `feat/command-bridge-daemon` (Forge repo).

## Current Position

Phase: 081
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-16

**Progress bar:** [██████░░░░] 60% (3/5 phases shipped; 80 verified live)

## Milestone Status (2026-06-16)

**v7.0 Forge Integration — ACTIVE.** Promoted 2026-06-13 from backlog 999.1, activated 2026-06-16. 5 phases (78-82), Surface-Substrate fold-in of Forge into CodePulse. Forge engine stays LOCAL; cloud-frontend ↔ local-daemon bridge via Convex ingest (up) + command queue (down).

| Phase | Name | Status |
|-------|------|--------|
| 78 | Forge Emitter + Convex Schema | ✅ Shipped (2026-06-13) |
| 79 | Forge UI Tab (read-only) | ✅ Shipped — PR #20 (2026-06-15) |
| 80 | Command Bridge (launch + stop) | ✅ Complete (4/4, verified live 2026-06-16) — FI-06/07/08 |
| 81 | Live Log Streaming | 📋 Active (next) — design locked, 081-SPEC.md — FI-09/10/11 |
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

**Phase 80 implementation notes (carried):**

- 80-03 (B2): optimistic "Queued" row owned by ForgePage-local `pendingLocal` useState (NOT `withOptimisticUpdate`) — a Convex optimistic write keyed by `{hostId}` would land in a different cache entry than ForgePage's `listForgeCommands({})` subscription, so the row would not paint until the round-trip. Modal reports the row up via `onLaunched`/`onLaunchFailed`; a reconciliation effect drops it once `resolvedForgeJobId` appears in `jobs`.
- 80-03 (W2): `useUser()` throws outside a `<ClerkProvider/>`, and `main.tsx` omits the provider when Clerk is unconfigured. ForgePage calls `useUser` only inside `ClerkAuthProbe`, mounted exclusively when `VITE_CLERK_PUBLISHABLE_KEY` is set (mirrors `AuthGuard`); `isAuthenticated` defaults to `false` (fail-closed, never crashes).
- 80-03 (D-06/D-07): ForgeLaunchModal port drops dangerous-mode and inline workspace creation entirely; capabilities never include `dangerous`.
- 80-03: relative Convex API import from `src/components/forge/` is `../../../convex/_generated/api` (three levels), not `../../`.
- 80-04 (D-03): Stop is a two-step shadcn `AlertDialog` confirm (`ForgeStopConfirmDialog`) — trigger → dialog → "Yes, stop the job"; copy surfaces `taskkill /T /F` hard-kill + work-discard + irreversibility verbatim from the UI-SPEC. No one-click stop.
- 80-04 (D-04 / Pitfall 2): `isStoppingLocal` lives on the Stop BUTTON only (`useState` in `ForgeJobDetail`). The `forgeJobs` status badge NEVER flips optimistically — there is NO `setQuery` terminal patch. It stays `Stopping…` until a `useEffect` keyed on `job.status` clears it when the reactive query delivers a non-running status. Mutation error resets it + `sonner` toast.
- 80-04: Stop button rendered ONLY when `job.status === "running"` (hidden on all terminal states); `commandId` via `crypto.randomUUID()`. Added a pending/expired/failed command-row detail pane (D-10/D-11) — branches on a status sentinel + "no real metadata" guard since `ForgeJobRow` has no `_type` discriminant.

### Pending Todos

- **Phase 80 (verify):** all 4 plans executed (80-01 backend, 80-02 daemon, 80-03 launch UI, 80-04 stop UI). Run phase verification / `gsd-phase-complete 80` (cross-check the SDK counters against git ground truth — known double-count issue). FI-06/07/08 implementation complete.
- **Phase 81:** `/gsd-discuss-phase 81` — 081-SPEC.md is the authoritative scope; formalize the Convex log-ingest receiver + retention test, then the cross-repo `makeLogSink` finalization (closes Forge `08-HUMAN-UAT.md`).
- **Cross-repo:** the Forge-side log sink (`src/emit/log-forwarder.ts makeLogSink`) is a dormant `TODO(P81)` no-op gated on `FORGE_LOG_INGEST_URL` — lit up in Phase 81.

### Blockers/Concerns

- **v6.0 parked phases** — 75 (Agent Console) blocked on Ástríðr M1.P0 + M1.P3; 77 (CI/Prod Hardening) 2/3 plans, 77-03 remaining. Not blockers for v7.0.
- **v6.0 traceability** is stale (71-76 marked Pending in REQUIREMENTS.md though shipped light-mode) — reconcile under the parked QA-01 when v6.0 resumes; out of scope for v7.0.

## Session Continuity

Last session: 2026-06-16T15:24:20.062Z
Stopped at: Phase 80 COMPLETE — all 4 plans executed + code-review findings fixed (CR-01/02, WR-01/02) + live bridge round-trip verified (launch + stop). Caught/fixed a real daemon auth bug (forge 737845e). SDK phase.complete miscounted; STATE/ROADMAP counters reconciled to git ground truth by hand.
Next action: `/gsd-discuss-phase 81` (or `/gsd-plan-phase 81` — 081-SPEC.md is the locked authoritative scope). Phase 80 work lives on `forge-command-bridge` (CodePulse, unmerged) + `feat/command-bridge-daemon` (Forge repo, unpushed) — both need PRs/merge.
Resume file: None
