---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Forge Integration
status: executing
stopped_at: Phase 82 UI-SPEC approved
last_updated: "2026-06-17T15:13:55.236Z"
last_activity: 2026-06-17 -- Phase 82 planning complete
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 16
  completed_plans: 12
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it. v7.0 extends "drive its coding agents" to **Forge** — one application for all coding-agent work.
**Current focus:** Phase 81 — live-log-streaming
**Last completed:** Phase 80 — Command Bridge (launch + stop), 4/4 plans, verified live 2026-06-16 (bridge round-trip: launch + stop). Code on `forge-command-bridge` (CodePulse) + `feat/command-bridge-daemon` (Forge repo).

## Current Position

Phase: 81 (live-log-streaming) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-06-17 -- Phase 82 planning complete

**Progress bar:** [██████░░░░] 60% (3/5 phases shipped; 80 verified live)

## Milestone Status (2026-06-16)

**v7.0 Forge Integration — ACTIVE.** Promoted 2026-06-13 from backlog 999.1, activated 2026-06-16. 5 phases (78-82), Surface-Substrate fold-in of Forge into CodePulse. Forge engine stays LOCAL; cloud-frontend ↔ local-daemon bridge via Convex ingest (up) + command queue (down).

| Phase | Name | Status |
|-------|------|--------|
| 78 | Forge Emitter + Convex Schema | ✅ Shipped (2026-06-13) |
| 79 | Forge UI Tab (read-only) | ✅ Shipped — PR #20 (2026-06-15) |
| 80 | Command Bridge (launch + stop) | ✅ Complete (4/4, verified live 2026-06-16) — FI-06/07/08 |
| 81 | Live Log Streaming | 🔄 Executing (3/4 complete) — FI-09 + FI-10 + FI-11 done, Plan 04 remains |
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

**Phase 81 Plan 01 implementation notes (2026-06-16):**

- `appendLogChunk` is `internalMutation` (not `mutation`) — httpActions have no Clerk identity (81-SPEC §Locked design 3). Same rule as `upsertJob`.
- `sentAt` uses `v.optional(v.string())` in both schema and mutation args. At the call site in `forgeLogIngest.ts`: `body.sentAt ?? undefined` (coerce absent/null → undefined to satisfy `v.optional`; never pass `null`).
- D-1 idempotency: `by_host_job_seq` three-field index + `.unique()` check before insert; existing `(hostId,forgeJobId,seq)` → `return` (no-op, no patch — append-only invariant preserved).
- `listJobLogs` orders `.order("asc")` — oldest chunk first (terminal top-to-bottom display), unlike `listJobs` desc.
- `LOG_CHUNK_LIMIT = 5000` placed near `JOB_LIST_LIMIT = 1000` per file convention (D-03: retention bounds real set to ~1 MB/job).

**Phase 81 Plan 02 implementation notes (2026-06-16):**

- `sweepForgeLogChunks` is `internalMutation` (same rule — cron scheduler, no Clerk identity). Two-pass: TTL first, then per-job byte cap.
- Pure helpers exported from `forge.ts` (`chunkByteSize`, `selectTtlDeletes`, `selectCapDeletes`) so the retention test can exercise deletion logic without a Convex runtime — mirrors the `simulateForgeLogIngestDispatch` pattern from plan 01.
- `LOG_BYTE_CAP_PER_JOB = 1_000_000` (~1 MB, D-01 discretion) and `SEVEN_DAYS_MS` defined as module-level consts in the Phase 81 section.
- `selectCapDeletes` iterates chunks in ascending seq order (oldest first) and accumulates deletes until `total <= capBytes` — newest chunks always survive by construction.
- `crons.daily` at `hourUTC:3 minuteUTC:30` — 30 min offset from `evaluate-memory-quality` (03:00) to avoid scheduler contention.

**Phase 81 Plan 03 implementation notes (2026-06-16):**

- `useForgeJobLogs` uses `useMemo([raw])` — referential stability prevents render-loop churn under live data (Phase 80 lesson applied).
- `isAutoScrollingRef` initialized to `true` — log pane is always live; no replay mode (unlike TranscriptPanel which uses a `live` prop).
- Scroll viewport is a plain `<div data-testid="forge-log-viewport" onScroll={handleScroll}>` — owned directly, not via ScrollArea, for jsdom testability and to match TranscriptPanel pattern.
- Tab strip uses local `useState<'details'|'logs'>` (not shadcn Tabs) — simpler two-state switch; default `'details'` preserves Phase 79/80 ForgeMetadataPanel behavior.
- `ForgeLogPane.test.tsx` simulates scroll via `Object.defineProperty` on `scrollHeight`/`clientHeight`/`scrollTop` — jsdom does not lay out, so real scrolling must be manually constructed.

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
- **Phase 81 Plan 02:** COMPLETE — `sweepForgeLogChunks` + daily cron + 14 retention tests (FI-11 / D-2). Commits: bd0221c (RED), 68a6a58 (GREEN).
- **Phase 81 Plan 03:** COMPLETE — `useForgeJobLogs` hook + `ForgeLogPane` tail pane + Details/Logs tab in `ForgeJobDetail` + 6 tests (FI-10). Commits: c30a0c9 (hook), 82ba3e3 (component + test + integration).
- **Phase 81 Plan 04 (next):** Cross-repo Forge `makeLogSink` finalization + live round-trip verification (FI-11 / closes Forge 08-HUMAN-UAT.md).
- **Cross-repo (Phase 81):** the Forge-side log sink (`src/emit/log-forwarder.ts makeLogSink`) is a dormant `TODO(P81)` no-op gated on `FORGE_LOG_INGEST_URL` — lit up in Plan 04.

### Blockers/Concerns

- **v6.0 parked phases** — 75 (Agent Console) blocked on Ástríðr M1.P0 + M1.P3; 77 (CI/Prod Hardening) 2/3 plans, 77-03 remaining. Not blockers for v7.0.
- **v6.0 traceability** is stale (71-76 marked Pending in REQUIREMENTS.md though shipped light-mode) — reconcile under the parked QA-01 when v6.0 resumes; out of scope for v7.0.

## Session Continuity

Last session: 2026-06-17T14:31:51.201Z
Stopped at: Phase 82 UI-SPEC approved
Next action: Execute Phase 81 Plan 04 — cross-repo Forge makeLogSink finalization + live round-trip verification
Resume file: .planning/phases/82-files-preview-hardening/82-UI-SPEC.md
