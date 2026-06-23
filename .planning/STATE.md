---
gsd_state_version: 1.0
milestone: v8.0
milestone_name: Graph/KG Consolidation
status: verifying
stopped_at: Phase 86 Plan 03 complete — KG-08 full-text Search lens shipped (gated; endpoint absent → SC#2 graceful-degrade confirmed)
last_updated: "2026-06-23T12:54:48.309Z"
last_activity: 2026-06-23
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 13
  completed_plans: 13
  percent: 57
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-18)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it. v8.0 unifies all of Ástríðr's graphs (KG, tool galaxy, MCP, code/vault) into one Graphs hub and deepens the KG explorer.
**Current focus:** Phase 86 — kg-full-text-search-clustering-layout
**Last completed:** Phase 85 — Cross-Graph Navigation (GH-04), 4/4 plans, 2026-06-22. Shared `src/lib/focus-url.ts` (`buildFocusUrl`, normalized-EXACT `focusKeysMatch`, same-origin `decodeFromParam` guard) + `src/hooks/useFocusParam.ts` one-shot focus hook; forward links + `?from` return chips wired into Tool Galaxy (tool→owning-agent), CodeVaultGraph (agent→KG entities), KnowledgeGraph (destination). Code review fixed CR-01 (`?from` double-decode), WR-01 (backslash guard), WR-03 (hops clamp), WR-02 (centering rAF-retry via `src/lib/graph-center.ts`), WR-04 (KG reactive hydration). UAT demonstrated live in Playwright on the real graph: `telegram_tool → "Owning agent: Hildr" → /graphs?focus=vault:Hildr&from=… → "Back to Tool Galaxy"` round-trip; SC#2 gate confirmed (41 KG entities for agent_id=astridr). **Ingest hardening (same session):** `/runtime-ingest` now summarizes `graph_snapshot` in legacy `runtime_events` (`convex/ingestSummary.ts` `legacyEventData`) — was rejecting >1 MiB graphs at the legacy insert and silently capping the production cron; **deployed to `tidy-whale-981`**, and the full ~4,038-node real snapshot (astridr-repo 1500 + codepulse 1500 + vault 1038) is now live via the Phase 83 receiver. **Prior:** Phase 84 — Graphs Hub + Code/Vault Render (GH-02, GH-03), 3/3 plans, 2026-06-22. **Prior:** Phase 83 — Graph Snapshot Receiver (GH-01), 3/3 plans, 2026-06-18. Three row-based Convex tables + `convex/graphSnapshots.ts` receiver (versioned-swap upsert, dangling-link drop D-05, retention cron keep-7 @ 04:30 UTC, public `getProjectGraph`/`listSnapshots`) + `case graph_snapshot` dispatch + 30 unit tests. **Live round-trip verified vs `tidy-whale-981`**: POST→200, storedNode=3/storedLink=2 (dangling dropped), community:null OK, re-POST→activeVersion 1→2 idempotent, unauth→401. Verifier ACHIEVED 7/7. `getProjectGraph` is the read API Phase 84 consumes.

## Current Position

Phase: 86 (kg-full-text-search-clustering-layout) — COMPLETE (3/3), code-verified 7/7; human UAT pending
Plan: 3 of 3 (all complete)
Next: Phase 87 (Saved Views + Temporal Diff, KG-10/KG-11) — the next `[ ]` phase. Run `/gsd-discuss-phase 87`. Before that, optionally run the 3 live-UI UAT checks for Phase 86 (see below).
Status: Phase 86 code-complete + automated verification PASS (7/7) + live UAT PASS (Playwright, 2026-06-23, auth-bypassed dev instance). UAT results: (1) ✅ community halos + spatial clustering render on `/graphs` CodeVault graph — 4038 real Convex nodes, multi-color COMMUNITY_PALETTE + halo rings; (2) ✅ Communities legend correctly absent on the KG Explorer (community-null entities); (3) ✅ Search lens degrades gracefully (amber "Could not reach the KG search API… Entity-name search still works" — network-unreachable variant, since Ástríðr was not running locally; the 404 "not-deployed" variant is code-verified). Two states remain dark by design until Ástríðr ships: fully-lit community halos on KG Explorer (needs Ástríðr to emit `community`, D-10) and live search results (needs SEED-008 `/api/kg/search`). Cross-repo handoff written: astridr-repo `.planning/seeds/SEED-008-kg-search-endpoint-for-codepulse.md`.
Last activity: 2026-06-23

Progress bar: `██████░░░░` 57% (4/7 v8.0 phases complete: 83, 84, 85, 86)

## Milestone v8.0 Roadmap (2026-06-18)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 83 | Graph Snapshot Receiver | GH-01 | ✅ Complete + verified (2026-06-18) |
| 84 | Graphs Hub + Code/Vault Render | GH-02, GH-03 | ✅ Complete + UAT passed (2026-06-22) |
| 85 | Cross-Graph Navigation | GH-04 | ✅ Complete (4/4, 2026-06-22) |
| 86 | KG Full-Text Search + Clustering Layout | KG-08, KG-09 | ✅ Complete (3/3, 2026-06-23) — KG-09 (community cluster renderer, Plans 01-02) + KG-08 (full-text Search lens, Plan 03, gated on Ástríðr /api/kg/search SEED) |
| 87 | Saved Views + Temporal Diff | KG-10, KG-11 | Not started |

**Key sequencing constraint:** Phase 83 (receiver) must land before any rendering phase. Phase 86 (full-text search) carries a cross-repo dependency on a net-new Ástríðr `/api/kg/search` endpoint — flag at plan time.

## Milestone Status (2026-06-18)

**v7.0 Forge Integration — COMPLETE (2026-06-17).** Promoted 2026-06-13 from backlog 999.1, activated 2026-06-16, all 5 phases (78-82) shipped + verified by 2026-06-17. Surface-Substrate fold-in of Forge into CodePulse. Forge engine stays LOCAL; cloud-frontend ↔ local-daemon bridge via Convex ingest (up) + command queue (down). Ready to close via `/gsd-complete-milestone`.

| Phase | Name | Status |
|-------|------|--------|
| 78 | Forge Emitter + Convex Schema | ✅ Shipped (2026-06-13) |
| 79 | Forge UI Tab (read-only) | ✅ Shipped — PR #20 (2026-06-15) |
| 80 | Command Bridge (launch + stop) | ✅ Complete (4/4, verified live 2026-06-16) — FI-06/07/08 |
| 81 | Live Log Streaming | ✅ Complete (4/4, verified live 2026-06-17) — FI-09/10/11 |
| 82 | Files + Artifact Preview + Hardening | ✅ Complete (4/4, 2026-06-17) — FI-12/13/14; listing bridge verified live; preview-bytes ACL fix applied (forge a31dca4 + dbfad91) but live preview round-trip pending operator verify; ingest key rotated; daemon auto-started |

**v6.0 Agentic OS Front-End — RESOLVED (closed 2026-06-18).** 71/72/73/74/76 shipped (light-mode); **77 (CI & Prod Hardening) ✅ complete (3/3, verified 2026-06-18 — OPS-01/02 done, OPS-03 N/A).** **75 (Agent Console) SUPERSEDED by v7.0 Forge (2026-06-18):** its gates — Ástríðr M1.P0 (scoped token) + M1.P3 (gateway browse) — cleared 2026-06-10, but the launch/stop + live-logs + file-preview capability was delivered through the Forge daemon + Convex bridge (v7.0 phases 80-82) instead of browser-direct-to-`:8200`. The two remaining cross-repo gateway deltas (CORS POST/DELETE + `TaskRequest.model`) are no longer needed. 6 planned Phase 75 plans retired — see `phases/75-agent-console/75-SUPERSEDED.md`. Requirements retained in REQUIREMENTS.md.

## Accumulated Context

### Roadmap Evolution

- Phase 88 added (2026-06-20): Analytics Rollup Table — durable fix for the Convex 16 MiB/exec read-limit hit by `analytics.ts` aggregation queries. Standalone observability hardening, independent of v8.0. Prod-impacting quick unblock (lowered `.take()` caps) shipped same day; this phase replaces it with ingest-time rollups.

### Decisions

See PROJECT.md Key Decisions table for full history.

**Phase 86 Plan 01 decisions (2026-06-23):**

- **KG-09 halo architecture** — drawn in `ForceGraphCanvas` shared `paint` wrapper via new `communityColorFn` prop, not in each caller's `paintNode`. Single implementation serves both KG and CodeVaultGraph without duplication.
- **COMMUNITY_PALETTE hex overlap** — slots 1/4/5 intentionally share values with ENTITY_TYPE_COLORS. The plan's "none present in ENTITY_TYPE_COLORS" behavior spec conflicted with the locked UI-SPEC hex values. Exact UI-SPEC values take precedence; semantic distinctness preserved by different visual roles (halo ring vs. node fill).

**Phase 86 Plan 02 decisions (2026-06-23):**

- **KG Explorer single halo path** — `communityColorFn` prop on `<ForceGraphCanvas>` used on the KG call site; the page's `paintNode` is not modified. Avoids double-stroke and keeps the halo implementation in one place (shared paint wrapper from Plan 01).
- **Communities legend auto-hide** — `presentCommunities.length > 0` conditional; no "no clusters" copy rendered when community-less (Q4-A). Mirrors the `legendTypes` useMemo pattern for consistency.

**Phase 86 Plan 03 decisions (2026-06-23):**

- **KG-08 search results in page-local state** — Hook manages only lens/filter plumbing; results live in `KnowledgeGraph.tsx` so `rawGraph` (used by the canvas) doesn't conflict with search hits.
- **searchQuery ephemeral** — Stripped from idb persist; `lens=search` not restored on hydration (stale query UX). RESEARCH Pitfall 6 / Open Q3.
- **D-01 gate in consumer (KnowledgeGraph.tsx)** — `kgApi.fetchSearch` / `kgGet` throws `AstridrApiError` on any non-2xx; the page inspects `e.status` for 404/501 → not-deployed informational copy vs red error banner.
- **subjectName verbatim** — No normalization between search hit's `subjectName` and `buildFocusUrl`. Exact-match is correct for `useFocusParam`; normalization would cause silent focus misses (RESEARCH Pitfall 4).
- **Results-only Search lens layout** — No mini subgraph in Search lens; click-to-ego via `buildFocusUrl` is the graph exploration path (RESEARCH Pattern 4).
- **Cross-repo SEED for Ástríðr** — `/api/kg/search` must include `subjectName` in each hit (A2); default GET with query params; 404/501 used as the endpoint-not-deployed signal.

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

- **Phase 82 preview round-trip:** PENDING OPERATOR VERIFICATION — see 82-04-SUMMARY.md § CHECKPOINT. Forge daemon preview-bytes ACL fix (dbfad91) applied but live verification not yet confirmed.
- **v8.0 Phase 84 (next):** Discuss + plan + execute Phase 84 — Graphs Hub + Code/Vault Render (GH-02, GH-03), consuming Phase 83's `getProjectGraph`. Run `/gsd-discuss-phase 84`.

### Blockers/Concerns

- **KG-08 cross-repo dependency:** Phase 86 requires a net-new Ástríðr `/api/kg/search` endpoint for full-text fact search. This is the one confirmed Ástríðr-side delta in v8.0. Must be flagged and coordinated at plan time.
- **Phase 82 preview verification (open):** Live end-to-end preview round-trip not yet confirmed by operator (per 82-04-SUMMARY § CHECKPOINT). Not a blocker for v8.0 but should close before declaring v7.0 fully done.

## Session Continuity

Last session: 2026-06-23T12:54:48.298Z
Stopped at: Phase 86 UI-SPEC approved + context gathered
Next action: Run `/gsd-discuss-phase 84` to begin Phase 84 — Graphs Hub + Code/Vault Render (GH-02, GH-03)
Resume file: None
