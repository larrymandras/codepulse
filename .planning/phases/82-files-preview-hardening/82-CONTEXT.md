# Phase 82: Files + Artifact Preview + Hardening - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Browse a terminal Forge job's workspace files and preview text/code/HTML and image artifacts in the cloud `/forge` UI. File metadata + capped artifact bytes flow daemon → Convex → cloud over the same Surface-Substrate bridge used for logs in Phase 81 (no `http://localhost`, no mixed-content). Plus end-to-end Clerk/auth correctness across the launch→run→logs→artifacts path, OPS-01 production CORS + deploy checklist, and empty/loading/error polish. Final phase of v7.0 Forge Integration. Closes FI-12 / FI-13 / FI-14.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `82-SPEC.md` for full requirements, boundaries, constraints, and acceptance criteria (17 pass/fail checks).

Downstream agents MUST read `82-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- New Convex table(s) for per-job file metadata + capped artifact bytes, with a bearer-authed ingest endpoint and read query/accessor
- Retention sweep coverage for the new file/artifact records
- `FileBrowser` + `ArtifactPreview` ported from the `forge` repo, re-skinned to CodePulse tokens, reading from Convex (not localhost)
- Inline preview for text/code/HTML (sandboxed iframe + Source toggle) and images, each ≤ 1 MB
- A third **Files** tab in `ForgeJobDetail`
- Files visible after a job reaches a terminal state; running jobs show an empty state
- End-to-end auth audit + artifact-serve security invariants
- OPS-01: `CODEPULSE_ALLOWED_ORIGIN` set + a deploy checklist documenting Forge ingest env vars
- Empty/loading/error polish + CodePulse-token styling
- Cross-repo: `forge` daemon file enumeration + bounded ingest (mirrors Phase 81 `makeLogSink`)

**Out of scope (from SPEC.md):**
- Local-HTTPS loopback reachability — rejected (same-machine only)
- Reverse-tunnel / relay reachability — rejected (most new infra)
- Inline preview of video / audio / PDF / binary in the cloud — download / open-locally fallback only
- Chunked large-artifact preview (reassembling files > 1 MB across multiple docs)
- Live mid-run file updates (files refresh only at terminal state)
- Editing / writing / deleting workspace files from the cloud (read-only)
- Full recursive workspace-tree navigation chrome (folder-drill UI)
- Guaranteed "open locally" / VS Code links across machines (best-effort, same-machine hints)
- Reviving other parked v6.0 work (only OPS-01 pulled forward)

</spec_lock>

<decisions>
## Implementation Decisions

These are HOW-only decisions made during discussion (requirements stay locked in 82-SPEC.md).

### Artifact byte delivery
- **D-01: Eager push at terminal state.** When a job reaches a terminal state (`completed`/`failed`/`stopped`), the daemon enumerates + classifies files and POSTs the file listing AND the bytes of previewable files (within caps) in one shot. No on-demand request path; the cloud opens any previewable file instantly from the reactive query. No use/extension of the `forgeCommands` queue for byte fetching. Bounded by per-file + per-job caps + retention (see D-05).

### Byte storage mechanism (Convex)
- **D-02: Hybrid — text/HTML in docs, images via Convex File Storage.**
  - Text/code/HTML artifact content → stored as a **plain string** inside a `forgeArtifacts` doc (≤ ~1 MB; read via reactive query). NOT base64 (base64 of a true-1MB file ~1.37 MB would exceed the Convex per-document value limit).
  - Image artifact bytes → stored via **Convex File Storage** (`ctx.storage.store` → `storageId`; `ctx.storage.getUrl` → `<img src>`). Avoids base64 bloat; allows true ≤1 MB images.
- **D-02a (flagged tradeoff for the FI-14 security audit, Req 9):** Convex File Storage URLs are **unauthenticated** (unguessable, but public). Accepted for image bytes behind the AuthGuard'd UI. Researcher/planner should confirm Convex storage URL access semantics and whether a short-lived/served-via-function path is warranted; the sandboxed-iframe model (no `allow-same-origin`) and "no executable content from a public URL" invariant must hold. Text/HTML stay out of File Storage specifically to keep Source/Preview content behind the reactive query and under CSP control.

### File enumeration scope
- **D-03: Recursive workspace tree + ignore rules + count cap.** The daemon lists ALL files in the job's workspace recursively (relative paths, kind, size) with ignore rules (`.git`, `node_modules`, common build/dist dirs) and a file-count cap to stay bounded — full FileBrowser parity with Forge web. Bytes are pushed only for previewable files within the per-file + per-job caps (most files are metadata-only rows). Exact ignore list + file-count cap set at plan time.

### Read auth + fallback affordance
- **D-04: Public graceful-skip reads.** File/artifact READ queries stay public graceful-skip, consistent with `listJobs` / `listJobLogs` (the whole `/forge` surface is already behind `AuthGuard`; the ingest WRITE path is bearer-authed and the launch/stop mutations are Clerk fail-closed). Do NOT add Clerk gating to the read path — that would diverge from the established Forge read model.
- **D-04a: Always show the local-path fallback.** For >1 MB or non-previewable kinds, always render the local `rootPath` text + an "Open in VS Code" deep link, clearly labeled best-effort (same-machine only). Not gated on host-online detection.

### Retention (extends Phase 81 sweep)
- **D-05: Retention must cover BOTH the docs AND File Storage blobs.** The new file/artifact records get TTL + per-job cap coverage consistent with `sweepForgeLogChunks` (7-day TTL + per-job cap, drop-oldest). **Critical:** the sweep must call `ctx.storage.delete(storageId)` for image blobs — deleting only the doc rows would leak File Storage. Cleanup test required (SPEC Req 3 / acceptance).

### Claude's Discretion
- Exact per-file byte cap accounting, per-job total-byte/file-count caps, ignore-rule list, sweep cadence, and `listJobFiles` take-limit — pick sensible values at plan/implementation time, consistent with the ~1 MB-per-file ceiling and the Phase 81 retention shape.
- File-kind classifier location: reuse the Forge web classifier on the **daemon** side (it has the files) — classify before sending; UI consumes `kind` from the listing.
- Exact ingest envelope/message shape for the file listing + bytes (mirror the `forge-log-ingest` envelope conventions).
- Deploy-checklist doc location/format (OPS-01) — a markdown doc in the repo listing `CODEPULSE_ALLOWED_ORIGIN` + every Forge ingest env var.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked scope
- `.planning/phases/82-files-preview-hardening/82-SPEC.md` — Locked requirements (12), boundaries, constraints, 17 acceptance criteria. **MUST read before planning.**

### CodePulse bridge patterns to mirror (Phase 78/81)
- `convex/forgeLogIngest.ts` — httpAction handler shape to mirror for the file/artifact ingest endpoint (auth → OPTIONS/CORS → parse → validate → dispatch to internalMutation → JSON response)
- `convex/forgeIngest.ts` — original job-state ingest handler (workspace sync pattern reference)
- `convex/forge.ts` — `appendLogChunk` (idempotent internalMutation), `listJobLogs` (bounded reactive query), `sweepForgeLogChunks` + pure helpers (`chunkByteSize`, `selectTtlDeletes`, `selectCapDeletes`); add `listJobFiles` + the file/artifact internalMutation + extend/clone the sweep here
- `convex/schema.ts` (~L1464 `forgeJobs`, `forgeLogChunks` ~L1490) — table/index conventions to mirror for `forgeFiles` / `forgeArtifacts`
- `convex/http.ts` (~L72) — POST + OPTIONS route registration pattern
- `convex/ingestAuth.ts` — `validateForgeIngestAuth` + `getCorsHeaders`, **reuse verbatim** (same `FORGE_INGEST_API_KEY`, D-3 precedent)
- `convex/crons.ts` — `expire-stale-forge-commands` / Phase 81 daily sweep cron pattern (offset hours to avoid scheduler contention)
- `convex/forgeLogIngest.test.ts` — contract test to mirror for the file/artifact ingest test

### CodePulse UI integration (Phase 79/80/81)
- `src/components/forge/ForgeJobDetail.tsx` — host for the new **Files** tab (extend the local `useState` tab strip from two-state to three-state: Details | Logs | Files)
- `src/components/forge/ForgeLogPane.tsx` — Phase 81 pane pattern (loading/empty/scroll handling) to mirror for the Files surface
- `src/components/forge/ForgeMetadataPanel.tsx` — `artifactCount` field + token styling reference
- `src/hooks/useForge.ts` — add `useForgeJobFiles` (+ artifact accessor) hook; mirror `useForgeJobLogs`; memoize for referential stability (Phase 80 lesson)
- `src/pages/ForgePage.tsx` — `ClerkAuthProbe` / `AuthGuard` fail-closed wiring (FI-08 / FI-14 audit reference)
- `src/components/SectionErrorBoundary` (per CLAUDE.md) — wrap the Files surface (Req 11)

### Convex File Storage (D-02 — researcher: confirm current API + URL semantics)
- Convex docs: File Storage (`ctx.storage.store`, `ctx.storage.getUrl`, `ctx.storage.delete`) — verify via Context7 / Convex docs; URL access/expiry semantics drive D-02a

### Forge source components to port (cross-repo)
- `C:\Users\mandr\forge\web\src\components\FileBrowser.tsx` — kind-grouped list, VS Code links, empty state, filenames-as-text (port + re-skin)
- `C:\Users\mandr\forge\web\src\components\ArtifactPreview.tsx` — sandboxed iframe (NO `allow-same-origin`) + Preview/Source toggle, `<img>`, download fallback; adapt to read from Convex, not `http://127.0.0.1`
- `C:\Users\mandr\forge\web\src\config.ts` — the `window.__FORGE_CONFIG__` inject pattern being REPLACED by the Convex path (reference for what NOT to carry over)

### Forge daemon (cross-repo, D-01/D-03 — mirrors Phase 81 makeLogSink handoff)
- `C:\Users\mandr\forge\src\emit\codepulse-emitter.ts` — emitter (fire-and-forget, gated, no-op when env unset) to extend with file/artifact push
- `C:\Users\mandr\forge\src\http\routes\artifact.ts` — existing path-traversal + symlink-escape guards + kind classification to reuse on the enumeration side (Req 9)
- `C:\Users\mandr\forge\src\http\artifact-server.ts` — local loopback artifact origin (being bypassed for the cloud path; guard logic is the reusable part)

### Prior-phase context (carried decisions)
- `.planning/phases/81-live-log-streaming/81-CONTEXT.md` + `81-SPEC.md` — the bridge pattern this phase clones
- `.planning/REQUIREMENTS.md` — FI-12/13/14 + OPS-01 (parked v6.0 Phase 77, pulled forward into Req 10)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `validateForgeIngestAuth` + `getCorsHeaders` (`convex/ingestAuth.ts`) — reuse verbatim; same bearer (D-3).
- `forgeLogIngest` httpAction + `appendLogChunk` + `listJobLogs` + `sweepForgeLogChunks` — the exact templates for the file/artifact receiver, query, and retention.
- Phase 81 `ForgeLogPane` + `useForgeJobLogs` + the `ForgeJobDetail` tab strip — extend to a third Files tab.
- Forge daemon `codepulse-emitter` (gated, fire-and-forget, no-op-when-unset) + `artifact.ts` path/symlink guards + kind classifier — reuse for enumeration + bounded push.

### Established Patterns
- Bearer-authed httpAction → `internalMutation` (no Clerk identity) → reactive read query = the Surface-Substrate bridge; reads are public graceful-skip, control mutations are Clerk fail-closed.
- Idempotent insert keyed on a tuple (logs use `(hostId, forgeJobId, seq)`; files key on `(hostId, forgeJobId, path)`).
- Retention via scheduled mutation (daily cron, offset hour); pure helper functions exported for testability without a Convex runtime.
- Hook referential stability: memoize `raw.map(...)` so reactive queries don't churn React render loops.
- Convex reactivity is the live update channel — no SSE/WS transport.
- Filenames/paths and text source rendered as React text nodes — never `innerHTML`/`dangerouslySetInnerHTML`; preview iframe sandbox MUST omit `allow-same-origin`.

### Integration Points
- New file/artifact ingest POST+OPTIONS routes in `convex/http.ts`; new `FORGE_*_INGEST_URL` daemon gate (reuse `FORGE_INGEST_API_KEY`).
- New `forgeFiles` (+ `forgeArtifacts`) table(s) near `forgeLogChunks` in `convex/schema.ts`; image bytes via Convex File Storage `storageId`.
- Files tab + FileBrowser + ArtifactPreview mounted in `ForgeJobDetail`; new `useForgeJobFiles` hook in `useForge.ts`.
- Retention sweep extended to delete File Storage blobs (`ctx.storage.delete`) in addition to doc rows.
- `CODEPULSE_ALLOWED_ORIGIN` set in the Convex cloud deployment + deploy-checklist doc (OPS-01).

</code_context>

<specifics>
## Specific Ideas

- FileBrowser/ArtifactPreview should feel like the Forge web originals (kind-grouped list, sandboxed Preview/Source toggle for HTML, inline image) but sourced from Convex instead of the loopback artifact server.
- Eager-push timing intentionally aligns with the "Files appear after the job completes" empty-state copy already in the Forge FileBrowser.
- Per-file ceiling anchored at ~1 MB (Convex doc-value limit for text; true ≤1 MB images via File Storage); per-job/total caps + ignore rules mirror the Phase 81 ~1 MB/job retention spirit.

</specifics>

<deferred>
## Deferred Ideas

- Inline cloud preview of video / audio / PDF / binary (currently download/open-locally fallback) — future enhancement if operators need it.
- Chunked large-artifact (>1 MB) preview / reassembly — explicitly rejected for MVP; revisit only if the 1 MB ceiling proves too tight.
- Live mid-run file updates (reactive listing during a running job) — terminal-state-only for now.
- Lazy on-demand byte fetch via the command queue — not needed under eager push; reconsider only if eager-push payloads/storage become a problem.
- Full folder-navigation chrome in FileBrowser (drill-down UI) — flat recursive listing with relative paths covers MVP.

None of the above are scope creep into this phase — they are noted so future phases/backlog don't lose them.

</deferred>

---

*Phase: 82-files-preview-hardening*
*Context gathered: 2026-06-17*
