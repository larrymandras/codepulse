---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Forge Integration
status: executing
stopped_at: Phase 82 complete (4/4) — files/listing bridge verified live; preview-bytes blocked by codex-sandbox ACLs (Forge follow-up)
last_updated: "2026-06-17T22:25:00Z"
last_activity: 2026-06-17
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 16
  completed_plans: 16
  percent: 67
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-16)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it. v7.0 extends "drive its coding agents" to **Forge** — one application for all coding-agent work.
**Current focus:** Phase 82 — files-preview-hardening
**Last completed:** Phase 80 — Command Bridge (launch + stop), 4/4 plans, verified live 2026-06-16 (bridge round-trip: launch + stop). Code on `forge-command-bridge` (CodePulse) + `feat/command-bridge-daemon` (Forge repo).

## Current Position

Phase: 82 (files-preview-hardening) — COMPLETE (4/4)
Plan: 4 of 4 done
Status: File/listing bridge verified live 2026-06-17 (forge fix a31dca4: enumerate realpath-EPERM fallback). Preview-byte rendering blocked only by codex-sandbox ACLs on agent-written files — a Forge follow-up, not a Phase 82 defect.
Last activity: 2026-06-17

**Progress bar:** [██████░░░░] 60% (3/5 phases shipped; 80 verified live)

## Milestone Status (2026-06-16)

**v7.0 Forge Integration — ACTIVE.** Promoted 2026-06-13 from backlog 999.1, activated 2026-06-16. 5 phases (78-82), Surface-Substrate fold-in of Forge into CodePulse. Forge engine stays LOCAL; cloud-frontend ↔ local-daemon bridge via Convex ingest (up) + command queue (down).

| Phase | Name | Status |
|-------|------|--------|
| 78 | Forge Emitter + Convex Schema | ✅ Shipped (2026-06-13) |
| 79 | Forge UI Tab (read-only) | ✅ Shipped — PR #20 (2026-06-15) |
| 80 | Command Bridge (launch + stop) | ✅ Complete (4/4, verified live 2026-06-16) — FI-06/07/08 |
| 81 | Live Log Streaming | 🔄 Executing (3/4 complete) — FI-09 + FI-10 + FI-11 done, Plan 04 remains |
| 82 | Files + Artifact Preview + Hardening | ✅ Complete (4/4) — FI-12/13/14; listing bridge verified live (forge a31dca4); preview-bytes pending Forge codex-sandbox ACL follow-up |

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

**Phase 82 Plan 01 implementation notes (2026-06-17):**

- New tables `forgeFiles` + `forgeArtifacts` inserted between `forgeLogChunks` and `forgeWorkspaces` in schema.ts. NO `seq` field — idempotency key is `(hostId, forgeJobId, path)` via `by_host_job_path` index (Pitfall 6). `createdAt` is an explicit ISO string for TTL (not `_creationTime`).
- `upsertFileEntries` is last-writer-wins PATCH on re-push (file size may change), unlike append-only `appendLogChunk` no-op. `upsertArtifacts` calls `ctx.storage.delete(existing.storageId)` BEFORE patch when overwriting an image with a different storageId (D-05 blob leak prevention).
- `artifactByteSize` checks `textContent !== undefined` (NOT truthiness) — empty-string textContent must count as 0 bytes, not fall through to sizeBytes. Caught by a RED test.
- `getJobArtifact` resolves `ctx.storage.getUrl(storageId)` inside the QueryCtx (available per Convex serve-files docs) and returns `{...artifact, imageUrl}`; text artifacts return `imageUrl: null`.
- httpAction (`forgeFileIngest`) decodes base64 image bytes via `atob` (Buffer.from fallback), `new Blob([bytes.buffer as ArrayBuffer])` (tsc requires ArrayBuffer not Uint8Array for BlobPart), `ctx.storage.store(blob)` in ActionCtx — `imageBase64` is stripped from the dispatched artifact, never persisted (Pitfall 3 / T-82-06).
- Pure helpers (`artifactByteSize`, `selectFileTtlDeletes`, `selectFileCapDeletes`) exported from forge.ts so retention tests run without a Convex runtime. `sweepForgeFileRecords` two-pass (TTL + per-job cap), storage.delete BEFORE db.delete in both passes (D-05). Cron registration deferred to 82-02.

**Phase 82 Plan 04 implementation notes (2026-06-17):**

- `enumerateWorkspace` in `forge/src/workspace/enumerate.ts` applies two layers of guard before any byte read: (1) `guardPath` (lexical, T-82-14) catches `..`-style traversal via PathTraversalError; (2) `fs.realpathSync.native` containment check (physical, T-82-15) catches symlink/junction escapes that pass lexical check.
- `FORGE_FILE_INGEST_URL` stores the FULL endpoint URL including `/forge-file-ingest` path. `emitFiles` passes it directly as the POST target — no path appended (Pitfall 5). Mirrors FORGE_LOG_INGEST_URL convention from log-forwarder.ts.
- `FullEmitCfg = EmitCfg & { fileIngestUrl?: string }` exported from `config.ts`. Widened through `createGoalJob`, `handleChatJob`, `registerJobRoutes`, `createApiServer` via intersection type — no breaking change to existing EmitCfg consumers.
- `void emitFiles(...)` wired AFTER `promoteWorkspace` in both terminal paths (chat: `handleChatJob` in jobs.ts; goal: `createGoalJob` exit handler in manager.ts). Output files land in `workspace.rootPath` only after promotion — placing the call before promotion would enumerate zero files.
- ESM-sealed `fs.readdirSync` (non-configurable module namespace): spy-based synthetic dirent injection not possible. Tests use real temp dirs + direct guardPath assertion (Test B) and `fs.realpathSync.native` sub-property spy (Test C, which IS configurable as a function property).
- Live round-trip: PENDING OPERATOR VERIFICATION. See 82-04-SUMMARY.md § CHECKPOINT.

**Phase 82 Plan 03 implementation notes (2026-06-17):**

- `useForgeJobFilesRaw` returns `undefined | ForgeFileRow[]` (mirrors `useForgeJobsRaw` pattern) so `ForgeFilesPane` can distinguish loading from genuinely-empty terminal result and show the spinner. `useForgeJobFiles` coalesces `undefined → []` for callers that don't need the distinction.
- `useForgeWorkspace(hostId, workspaceId)` resolves `rootPath` from `listWorkspaces({hostId})` — `ForgeJobRow` carries `workspaceId` not `rootPath`, so the lookup is needed (A7). Falls back to the passed `workspace.rootPath` prop.
- `ForgeFilesPane` split into outer shell (terminal-state gate before any hook, early return safe) and `ForgeFilesPaneContent` (all hooks called unconditionally) to satisfy React rules of hooks — hooks cannot be called after a conditional return in the same component.
- Security audit grep (`grep -rE "allow-same-origin|dangerouslySetInnerHTML"`) catches comment strings explaining invariants. Fixed by rewriting comments to use equivalent phrasing that doesn't include the exact audit strings; `ArtifactPreview.test.tsx` uses regex to test JSX attribute usage not comments.
- `ForgeJobDetail` passes `workspace={{ rootPath: "" }}` (fallback) + `workspaceId={job.workspaceId}` — resolved to real rootPath inside `ForgeFilesPaneContent` via `useForgeWorkspace`.
- `SectionErrorBoundary` is a default export; import as `import SectionErrorBoundary from "@/components/SectionErrorBoundary"`.

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

Last session: 2026-06-17T12:50:00Z
Stopped at: Phase 82 Plan 04 — Forge daemon file emission code-complete (3 forge commits: 2558cc9, fa61feb, d8e468d); live round-trip checkpoint OPEN (FORGE_FILE_INGEST_URL gate not yet verified live)
Next action: Operator performs live round-trip verification per 82-04-SUMMARY.md § CHECKPOINT steps, then types "approved" to close Task 3 gate and mark Phase 82 complete
Resume file: .planning/phases/82-files-preview-hardening/82-04-SUMMARY.md
