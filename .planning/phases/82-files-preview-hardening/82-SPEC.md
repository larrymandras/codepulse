# Phase 82: Files + Artifact Preview + Hardening — Specification

**Created:** 2026-06-17
**Ambiguity score:** 0.15 (gate: ≤ 0.20)
**Requirements:** 12 locked
**Milestone:** v7.0 Forge Integration (final phase, 82 of 78–82)
**Cross-repo:** CodePulse (this repo) + `forge` repo (`C:\Users\mandr\forge`) — daemon-side enumeration/ingest lands in `forge`, mirroring the Phase 81 `makeLogSink` handoff.

## Goal

An operator can, from the cloud `/forge` UI, browse a terminal job's workspace files and preview its text/code/HTML and image artifacts inline — with file metadata and capped artifact bytes flowing daemon → Convex → cloud (the same Surface-Substrate bridge used for logs in Phase 81), so nothing depends on the cloud page reaching `http://localhost`. The full launch→run→logs→artifacts path is auth-correct and production-ready.

## Background

The Forge surface in CodePulse is built through Phase 81: a master-detail `/forge` page (`src/pages/ForgePage.tsx`), a `ForgeJobDetail` with a **Details | Logs** tab strip, live log streaming via append-only `forgeLogChunks` + reactive `forge.listJobLogs` (`convex/forge.ts`), and Clerk fail-closed launch/stop mutations.

What does **not** exist yet:
- **No FileBrowser or ArtifactPreview component** in CodePulse. Source versions exist in the `forge` repo (`web/src/components/FileBrowser.tsx`, `web/src/components/ArtifactPreview.tsx`) but they fetch artifacts from `http://127.0.0.1:${artifactPort}/art/...` — a loopback origin the **cloud** UI cannot reach (mixed-content; exactly the path Phase 78 rejected).
- **No file/artifact data in Convex.** `forgeWorkspaces` (`convex/schema.ts`) carries workspace metadata only (`class`, `name`, `rootPath`) — no file enumeration, no artifact bytes. `forgeJobs.artifactCount` is the only file-related field and it is display-only.
- **No Files tab** in `ForgeJobDetail` (only Details + Logs).

This phase closes FI-12 (files/preview), FI-13 (artifact reachability), and FI-14 (hardening) — the last phase of v7.0.

## Requirements

1. **File-listing bridge**: A terminal job's workspace file metadata reaches Convex and is queryable by the cloud UI.
   - Current: No file metadata exists in Convex; `forgeWorkspaces` carries workspace-level fields only
   - Target: A new Convex table (e.g. `forgeFiles`) stores per-file metadata `{hostId, forgeJobId, path, kind, sizeBytes, ...}`; a bearer-authed ingest endpoint accepts a job's file listing from the daemon (idempotent per `(hostId, forgeJobId, path)`); a `forge.listJobFiles({hostId, forgeJobId})` query returns it
   - Acceptance: POSTing a known file listing for a job inserts rows; re-POSTing the same listing is idempotent (no duplicate rows); `listJobFiles` returns every file in the listing with correct `path`/`kind`/`sizeBytes`

2. **Capped artifact-byte bridge**: Previewable artifacts ≤ 1 MB have their bytes available in Convex; larger files do not.
   - Current: No artifact content path to the cloud exists
   - Target: For text/code/HTML and image files ≤ 1 MB, the daemon ships the bytes to Convex (per-job/per-path, idempotent); a query/accessor returns them to the cloud UI. Files > 1 MB OR of a non-previewable kind ship metadata only (no bytes)
   - Acceptance: A ≤1 MB text file and a ≤1 MB image are retrievable as content from Convex and render in the UI; a >1 MB file has a listing row but no retrievable bytes; per-Convex-doc value stays ≤ ~1 MB (no oversized-document write errors)

3. **Retention bounding for file/artifact records**: File and artifact storage in Convex is bounded, not unbounded.
   - Current: `forgeLogChunks` already has a 7-day TTL + per-job byte cap sweep (`sweepForgeLogChunks`, Phase 81); file/artifact tables would have none
   - Target: The retention sweep is extended (or a sibling sweep added) so `forgeFiles`/artifact-byte records are pruned by a TTL and/or per-job cap consistent with the Phase 81 policy
   - Acceptance: A cleanup test demonstrates file/artifact records past the TTL (and/or over the per-job cap) are deleted while in-window records survive

4. **FileBrowser port**: A job's files render as a navigable/kind-grouped list in CodePulse.
   - Current: No FileBrowser component in `src/components/forge/`
   - Target: `FileBrowser` ported from the `forge` repo, re-skinned to CodePulse tokens, consuming `listJobFiles`. **Every file is listed regardless of size or kind.** Kind-grouped ordering (text → image → video → audio → pdf → binary). Filenames rendered as React text nodes (no HTML interpolation)
   - Acceptance: For a job with mixed file kinds, all files appear grouped by kind; an empty job shows the empty-state copy; selecting a file row drives the preview pane (Req 5)

5. **ArtifactPreview port (text + image inline; sandboxed; above-cap fallback)**: Selecting a file previews it according to kind and size.
   - Current: No ArtifactPreview component in `src/components/forge/`
   - Target: `ArtifactPreview` ported and adapted to read bytes from Convex (NOT `http://127.0.0.1`):
     - text/code/HTML (≤1 MB) → sandboxed iframe (`sandbox` WITHOUT `allow-same-origin`) with a Preview/Source toggle; Source renders as a React text node (`<pre>{source}</pre>`, no `innerHTML`)
     - image (≤1 MB) → inline `<img>`
     - >1 MB OR video/audio/pdf/binary → file stays listed; preview pane shows "Not previewable in cloud (N MB / <kind>)" plus the local `rootPath` and a best-effort "Open in VS Code" deep link
   - Acceptance: A ≤1 MB HTML file previews in a sandboxed iframe and toggles to escaped source; a ≤1 MB image renders inline; a >1 MB or video/pdf/binary file shows the not-previewable-in-cloud message with local path + VS Code link and no inline render

6. **Files tab**: The Files/Artifacts UI is a third tab in `ForgeJobDetail`.
   - Current: `ForgeJobDetail` has a two-state **Details | Logs** tab strip (Phase 81)
   - Target: A third **Files** tab is added alongside Details and Logs; it hosts FileBrowser (list) + ArtifactPreview (pane). Default tab behavior (Details) is preserved
   - Acceptance: `ForgeJobDetail` shows three tabs; switching to Files renders the browser + preview; Details and Logs continue to work unchanged

7. **Terminal-state visibility**: Files appear once the job has finished, not during the run.
   - Current: N/A (no files surfaced at all)
   - Target: Files + previewable artifacts are present for jobs in a terminal state (`completed` / `failed` / `stopped`). A running (non-terminal) job's Files tab shows an empty-state ("Files appear after the job completes")
   - Acceptance: A running job's Files tab shows the empty-state copy; the same job after reaching a terminal state shows the full listing + previews

8. **End-to-end auth gating audit**: The full launch→run→logs→artifacts path is auth-consistent with the established model; the new file/artifact ingest path introduces no unauthenticated write.
   - Current: Phase 80/81 model — `/forge` route behind `AuthGuard`; launch/stop mutations Clerk fail-closed; ingest httpActions bearer-authed (`FORGE_INGEST_API_KEY`); read queries graceful-skip
   - Target: The new file/artifact ingest endpoint is bearer-authed (401 on bad/missing bearer, 400 on malformed body, CORS preflight handled), consistent with `/forge-ingest` and `/forge-log-ingest`; no new unauthenticated mutation or write path is added; the bearer key is never exposed to the browser
   - Acceptance: file/artifact ingest returns 401 on bad bearer, 400 on bad body, serves CORS preflight; a grep/audit confirms no browser-side reference to the ingest bearer key and no unauthenticated mutation in the file/artifact path

9. **Artifact-serve security invariants**: Artifact rendering cannot execute against the parent origin or smuggle markup.
   - Current: The Forge source enforces these locally (sandboxed iframe sans `allow-same-origin`, text-node source, path/symlink guards, CSP)
   - Target: Carry the invariants into the cloud path — sandboxed iframe MUST NOT include `allow-same-origin`; text source rendered as an escaped React text node (no `innerHTML`/`dangerouslySetInnerHTML`); daemon-side enumeration applies path-traversal + symlink-escape guards before listing/shipping; filenames/paths rendered as text
   - Acceptance: a stored artifact containing `<script>`/markup renders inert (escaped in Source, sandboxed in Preview); a path-traversal/symlink entry is rejected by the daemon enumeration test; code review confirms no `dangerouslySetInnerHTML` and no `allow-same-origin` on the preview iframe

10. **OPS-01: production CORS + deploy checklist**: Production origin config is set and documented.
    - Current: `CODEPULSE_ALLOWED_ORIGIN` is unset/undocumented (OPS-01 was parked under v6.0 Phase 77); no deploy checklist for the Forge ingest env
    - Target: `CODEPULSE_ALLOWED_ORIGIN` is set in the Convex cloud deployment and documented; a deploy checklist documents all Forge ingest env vars (existing `FORGE_INGEST_API_KEY` / `CONVEX_FORGE_INGEST_URL` / `FORGE_LOG_INGEST_URL` plus the new file/artifact ingest URL gate)
    - Acceptance: a deploy checklist doc exists listing `CODEPULSE_ALLOWED_ORIGIN` + every Forge ingest env var with its purpose; production CORS resolves for a non-local origin (no wildcard-only fallback for the Forge endpoints)

11. **Empty / loading / error polish**: The Files surface degrades gracefully.
    - Current: N/A (surface does not exist)
    - Target: Files tab has an empty state (no files / running job), a loading state (query `undefined`), and is wrapped so a render failure does not take down the page (consistent with `SectionErrorBoundary` usage); styling uses CodePulse tokens (Matrix Emerald dark skin), Lucide icons only
    - Acceptance: Files tab renders without error at 0 files, while loading, and when a preview fails; visual review confirms token-consistent styling and Lucide-only icons

12. **Cross-repo daemon enumeration + ingest** (`forge` repo): The local daemon produces the file listing and capped bytes.
    - Current: The `forge` daemon emits job state, workspaces, and logs; it does NOT enumerate per-job files or ship them to CodePulse. The local artifact server (`src/http/artifact-server.ts`) serves loopback-only and is not reachable from the cloud
    - Target: On a job reaching a terminal state, the daemon enumerates the job's output files (kind classification reused from the Forge web classifier), applies path/symlink guards, and POSTs the listing + ≤1 MB previewable bytes to the new CodePulse ingest endpoint (gated on a `FORGE_*_INGEST_URL` env, no-op when unset, best-effort like the existing emitter). Reuses `FORGE_INGEST_API_KEY` (D-3 precedent)
    - Acceptance: with the env gate set, completing a job in the `forge` repo results in that job's files + capped artifacts appearing in CodePulse's `/forge` Files tab (live round-trip); with the env gate unset, the daemon is a no-op (no crash, no calls)

## Boundaries

**In scope:**
- New Convex table(s) for per-job file metadata + capped artifact bytes, with a bearer-authed ingest endpoint and read query/accessor
- Retention sweep coverage for the new file/artifact records
- `FileBrowser` + `ArtifactPreview` ported from the `forge` repo, re-skinned to CodePulse tokens, reading from Convex (not localhost)
- Inline preview for **text/code/HTML (sandboxed iframe + Source toggle) and images**, each ≤ 1 MB
- A third **Files** tab in `ForgeJobDetail`
- Files visible **after a job reaches a terminal state**; running jobs show an empty state
- End-to-end auth audit + artifact-serve security invariants
- OPS-01: `CODEPULSE_ALLOWED_ORIGIN` set + a deploy checklist documenting Forge ingest env vars
- Empty/loading/error polish + CodePulse-token styling
- Cross-repo: `forge` daemon file enumeration + bounded ingest (forge-repo work, mirrors Phase 81 `makeLogSink`)

**Out of scope:**
- **Local-HTTPS loopback** reachability (`https://127.0.0.1`) — rejected; requires browser + daemon on the same machine
- **Reverse-tunnel / relay** reachability — rejected; most new infrastructure, wrong fit for a hardening phase
- **Inline preview of video / audio / PDF / binary in the cloud** — download / open-locally fallback only (MVP scope, round 1)
- **Chunked large-artifact preview** (reassembling files > 1 MB across multiple Convex docs) — rejected in round 2 against the MVP slice
- **Live mid-run file updates** — files refresh only at terminal state, not reactively during the run
- **Editing, writing, or deleting workspace files from the cloud** — read-only surface
- **Full recursive workspace-tree navigation chrome** — a job's output file listing (with relative paths) is shown; deep folder navigation UI is not required for MVP
- **Guaranteed "open locally" / VS Code links across machines** — these are best-effort, same-machine-only hints, not a correctness requirement
- Reviving other parked v6.0 work (75 Agent Console, the rest of 77) — only OPS-01 is pulled forward

## Constraints

- **Convex single-document value limit (~1 MB)** is the hard reason artifact bytes are capped at ≤ 1 MB per file; the schema/accessor must keep any single stored value under that limit (no oversized-document writes).
- **Reachability is Convex-only** — no code path may depend on the cloud page reaching `http://localhost` / `http://127.0.0.1` (the Phase 78 mixed-content prohibition).
- **Reuse the Surface-Substrate pattern** established by logs (Phase 81): bearer-authed ingest httpAction → idempotent upsert → reactive read query. Idempotency keyed on `(hostId, forgeJobId, path)`. No new client→server transport (SSE/WS) is built.
- **Bearer key** reuses `FORGE_INGEST_API_KEY` (D-3 precedent); a separate `FORGE_*_INGEST_URL` env gate enables/disables the daemon emitter; the key is never present in browser code.
- **Sandbox invariant (carried from Forge WSP-03):** the preview iframe `sandbox` attribute MUST NOT include `allow-same-origin`; text source is an escaped React text node — never `innerHTML`/`dangerouslySetInnerHTML`.
- **Text-artifact scrubbing** follows the same posture as logs (lines/bytes are expected pre-scrubbed by the daemon); this phase does not build a new scrubber but must not weaken it.
- **Styling:** CodePulse Matrix Emerald dark skin tokens, shadcn/ui primitives, Lucide icons only, Geist/JetBrains Mono — per project CLAUDE.md.

## Acceptance Criteria

- [ ] A bearer-authed file/artifact ingest endpoint accepts a job's listing + ≤1 MB previewable bytes; 401 on bad bearer, 400 on bad body, CORS preflight handled
- [ ] Ingest is idempotent per `(hostId, forgeJobId, path)` — re-POSTing the same listing creates no duplicate rows
- [ ] `forge.listJobFiles({hostId, forgeJobId})` returns every file with correct `path` / `kind` / `sizeBytes`
- [ ] A ≤1 MB text/HTML artifact previews in a sandboxed iframe (no `allow-same-origin`) and toggles to escaped source
- [ ] A ≤1 MB image artifact renders inline via `<img>`
- [ ] A >1 MB or video/audio/pdf/binary file is listed but shows "Not previewable in cloud" + local path + VS Code link (no inline render)
- [ ] No stored artifact value exceeds the Convex per-document limit (no oversized-write errors)
- [ ] `ForgeJobDetail` shows a third **Files** tab; Details and Logs still work
- [ ] A running job's Files tab shows the empty-state; the same job after terminal state shows the full listing + previews
- [ ] A retention/cleanup test deletes file/artifact records past the TTL and/or per-job cap while keeping in-window records
- [ ] No browser-side reference to the ingest bearer key; no new unauthenticated mutation in the file/artifact path
- [ ] No `dangerouslySetInnerHTML` and no `allow-same-origin` on the preview iframe (code review + test)
- [ ] Daemon enumeration rejects path-traversal / symlink-escape entries (test)
- [ ] `CODEPULSE_ALLOWED_ORIGIN` is set in prod + a deploy checklist documents every Forge ingest env var
- [ ] Files tab renders without error at 0 files, while loading, and on preview failure
- [ ] Live round-trip: completing a job in the `forge` repo (env gate set) surfaces its files + capped artifacts in CodePulse's Files tab; gate unset → daemon no-op

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Reachability + preview scope locked                          |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit out-of-scope (https/tunnel/chunking/live/video etc.)|
| Constraint Clarity | 0.78  | 0.65 | ✓      | 1 MB cap tied to Convex doc limit; bearer/sandbox invariants |
| Acceptance Criteria| 0.82  | 0.70 | ✓      | 17 pass/fail criteria                                        |
| **Ambiguity**      | 0.15  | ≤0.20| ✓      |                                                              |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective       | Question summary                                  | Decision locked                                                                 |
|-------|-------------------|--------------------------------------------------|---------------------------------------------------------------------------------|
| 1     | Researcher        | How does file/artifact content reach the cloud?  | **Convex bounded-ingest bridge** (daemon → Convex → cloud); reject https/tunnel |
| 1     | Simplifier        | Irreducible preview scope?                        | **Text/code/HTML (sandboxed) + image inline**; rest = download/open-locally     |
| 1     | Boundary Keeper   | What's in FI-14 hardening?                         | All four: e2e Clerk audit + artifact-serve security + **OPS-01** + UX polish    |
| 2     | Failure Analyst   | Size cap + above-cap behavior (off-machine risk)? | **1 MB cap**; above cap/unsupported → listed + "not previewable in cloud" + path|
| 2     | Boundary Keeper   | When do files become visible?                     | **After terminal state**; running job shows empty-state copy                     |
| 2     | Simplifier        | Where does the Files UI live?                     | **New third "Files" tab** in `ForgeJobDetail`                                    |

---

*Phase: 82-files-preview-hardening*
*Spec created: 2026-06-17*
*Next step: /gsd:discuss-phase 82 — implementation decisions (table shape, ingest message format, eager-vs-lazy byte push, port adaptation details)*
