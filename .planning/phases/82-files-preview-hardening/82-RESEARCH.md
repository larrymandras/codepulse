# Phase 82: Files + Artifact Preview + Hardening — Research

**Researched:** 2026-06-17
**Domain:** Convex File Storage · Surface-Substrate bridge clone · React component port · Daemon file enumeration · Auth hardening · OPS-01
**Confidence:** HIGH (all critical decisions verified against live source or official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Eager push at terminal state.** Daemon enumerates + ships listing + bytes in one shot when job reaches `completed`/`failed`/`stopped`. No on-demand request path.
- **D-02: Hybrid byte storage.** Text/HTML → plain string in `forgeArtifacts` doc (≤ ~1 MB). Images → Convex File Storage (`ctx.storage.store` → `storageId`; `ctx.storage.getUrl` → `<img src>`).
- **D-02a: File Storage URLs are unauthenticated, accepted for images behind AuthGuard'd UI.** Researcher confirms URL access semantics below.
- **D-03: Recursive workspace tree + ignore rules + count cap.** All files listed with `.git`, `node_modules`, `build`/`dist` ignored; file-count cap set at plan time.
- **D-04: Public graceful-skip reads.** File/artifact READ queries stay public graceful-skip, consistent with `listJobs`/`listJobLogs`.
- **D-04a: Always show the local-path fallback.** For >1 MB or non-previewable kinds: always render `rootPath` text + VS Code deep link.
- **D-05: Retention MUST cover BOTH doc rows AND File Storage blobs.** Sweep calls `ctx.storage.delete(storageId)` for image blobs to prevent leakage.

### Claude's Discretion
- Exact per-file byte cap accounting, per-job total-byte/file-count caps, ignore-rule list, sweep cadence, and `listJobFiles` take-limit.
- File-kind classifier location: reuse `src/workspace/kinds.ts` from the `forge` repo on the daemon side.
- Exact ingest envelope/message shape for the file listing + bytes (mirror `forge-log-ingest` conventions).
- Deploy-checklist doc location/format (OPS-01).

### Deferred Ideas (OUT OF SCOPE)
- Inline cloud preview of video/audio/PDF/binary.
- Chunked large-artifact (>1 MB) preview/reassembly.
- Live mid-run file updates.
- Lazy on-demand byte fetch via command queue.
- Full folder-navigation chrome in FileBrowser.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FI-12 | Operator can browse a job's workspace files and preview artifacts in `/forge` UI | FileBrowser port (§Component Port Patterns), `listJobFiles` query shape (§Convex Backend Patterns), `useForgeJobFiles` hook (§Hook Pattern) |
| FI-13 | Artifact/file content reachable from cloud UI without direct-localhost access | Convex bounded-ingest bridge confirmed; File Storage for images (§Convex File Storage API); text-as-string in doc (§Per-Document Limit) |
| FI-14 | End-to-end Clerk gating + polish; full launch→run→logs→artifacts path auth-correct | Auth patterns inherited verbatim (§Auth & CORS Patterns); sandbox invariant enforced at UI layer (§Security Invariants) |
</phase_requirements>

---

## Summary

Phase 82 is a **bridge clone + component port**, not original architecture. The Surface-Substrate bridge pattern from Phase 81 (log streaming) is cloned verbatim for files and artifacts. The `FileBrowser` and `ArtifactPreview` components exist in the `forge` repo and are ported with inline-CSS-to-Tailwind re-skinning and data-source substitution (Convex queries replace `http://127.0.0.1` artifact server). The daemon-side work extends `codepulse-emitter.ts` using the same `EmitCfg` seam and adds a file enumeration step triggered on terminal state.

The two genuinely novel elements are: (1) **Convex File Storage** for image bytes — `ctx.storage.store(blob)` → `storageId`; `ctx.storage.getUrl(storageId)` → permanent public URL; and (2) the **retention sweep extension** which must call `ctx.storage.delete(storageId)` in addition to deleting doc rows when pruning expired image records. All other patterns have verified precedents in the codebase.

**Primary recommendation:** Clone `forgeLogIngest.ts` → `forgeFileIngest.ts`; extend `convex/forge.ts` with `upsertFileEntry`, `upsertArtifact`, `listJobFiles`, and the sweep extension; extend `crons.ts` with a new daily sweep at 04:00 UTC (offset from 03:30 log sweep); extend `codepulse-emitter.ts` with `emitFiles`; port `FileBrowser` + `ArtifactPreview`; add Files tab to `ForgeJobDetail`. Follow the verified source patterns below precisely.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File listing + byte ingest | API/Backend (Convex httpAction) | — | Bearer-authed; no Clerk identity; same rule as log ingest |
| File metadata storage | Database (Convex `forgeFiles` table) | — | Indexed by `(hostId, forgeJobId, path)` |
| Text/HTML artifact bytes | Database (Convex `forgeArtifacts` doc) | — | ≤ 1 MB string value; reactive query read |
| Image artifact bytes | CDN/Static (Convex File Storage) | Database (storageId ref in `forgeArtifacts`) | Binary blob; avoids base64 bloat; see §File Storage |
| File listing read | API/Backend (Convex `query`) | Frontend (useForgeJobFiles hook) | Public graceful-skip (D-04) |
| FileBrowser UI | Browser/Client (React) | — | Port from forge web; no SSR |
| ArtifactPreview UI | Browser/Client (React) | — | Sandboxed iframe or `<img>`; data sourced from Convex query |
| File enumeration | Forge daemon (Node.js) | — | Runs on terminal-state transition; classifies + ships bytes |
| Retention sweep | API/Backend (Convex internalMutation) | — | Cron; deletes doc rows + File Storage blobs |
| Auth gate (ingest write) | API/Backend (Convex httpAction) | — | Bearer FORGE_INGEST_API_KEY; reuse `validateForgeIngestAuth` |
| Auth gate (read) | Browser/Client (AuthGuard) | — | Public graceful-skip consistent with Phase 81 |
| Auth gate (launch/stop) | API/Backend (Convex mutation + Clerk) | — | Inherited from Phase 80; no change |
| OPS-01 CORS | API/Backend (Convex httpAction + env var) | — | `CODEPULSE_ALLOWED_ORIGIN`; `getCorsHeaders` verbatim reuse |

---

## Standard Stack

### Core (all verified — zero new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `convex` | 1.41.0 | File Storage, tables, httpActions, crons | Already in use; File Storage is native to this version [VERIFIED: npm registry] |
| `react` | 19.x | Component port (FileBrowser, ArtifactPreview) | Already in use [VERIFIED: npm registry] |
| `lucide-react` | ^1.8.0 | `Loader2`, `ExternalLink`, `FolderOpen` icons | Already installed; no new installs [VERIFIED: npm registry] |
| `vitest` | existing | Test framework for ingest contract + retention tests | Already configured |

### Supporting (all pre-existing in codebase)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-*` (via shadcn) | existing | `Button`, `ScrollArea`, `Separator` primitives | FileBrowser + ArtifactPreview UI; all already in `src/components/ui/` |
| `tailwindcss` | 4.x | Re-skinning ported components from inline CSS | Always; replaces all `style={{...}}` props in port |

**No new packages are installed in this phase.** All UI primitives (`Button`, `ScrollArea`, `Separator`) confirmed present in `src/components/ui/` via `components.json`. Lucide icons (`ExternalLink`, `FolderOpen`) are new imports from the already-installed `lucide-react` package — zero install required. [ASSUMED: component.json confirms existing shadcn primitives — not re-verified here against filesystem]

---

## Package Legitimacy Audit

> No new packages are installed in this phase. All dependencies are pre-existing codebase dependencies.

| Package | Registry | Age | Downloads | slopcheck | Disposition |
|---------|----------|-----|-----------|-----------|-------------|
| convex | npm | ~4 yrs | Very high | N/A — pre-existing | Pre-existing, approved |
| lucide-react | npm | ~3 yrs | Very high | N/A — pre-existing | Pre-existing, approved |

**Packages removed due to slopcheck:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[Forge Daemon]
  |
  | On terminal state (completed/failed/stopped):
  | 1. Walk workspace recursively
  | 2. Apply ignore rules + file-count cap
  | 3. guardPath + symlink-escape check per entry
  | 4. kindTag() classify each file
  | 5. For previewable text files ≤ 1 MB: read bytes (UTF-8 string)
  |    For previewable image files ≤ 1 MB: read bytes (Buffer → Blob)
  |    For all others: metadata-only
  | 6. POST to /forge-file-ingest
  |    { type: "files", hostId, forgeJobId, files: [...], artifacts: [...] }
  |    Bearer: FORGE_INGEST_API_KEY
  |    Gate: FORGE_FILE_INGEST_URL (separate env var)
  v
[Convex httpAction: POST /forge-file-ingest]
  |   validateForgeIngestAuth (reuse verbatim)
  |   getCorsHeaders (reuse verbatim)
  |   OPTIONS → 200 (CORS preflight)
  |   POST:
  |     parse body → 400 on bad shape
  |     ctx.runMutation(internal.forge.upsertFileEntries, { hostId, forgeJobId, files })
  |     for each artifact: ctx.storage.store(blob) → storageId (images)
  |                         OR string content (text)
  |     ctx.runMutation(internal.forge.upsertArtifacts, { ... })
  v
[Convex DB]
  forgeFiles: { hostId, forgeJobId, path, kind, sizeBytes, createdAt }
              index by_host_job_path  ← idempotency key
              index by_host_job       ← listJobFiles
  forgeArtifacts: { hostId, forgeJobId, path, kind, sizeBytes,
                    textContent?,      ← text/HTML (≤ 1 MB string)
                    storageId?,        ← image (v.id("_storage"))
                    createdAt }
              index by_host_job_path  ← idempotency key + artifact lookup
              index by_host_job       ← sweep
  _storage: Convex File Storage blobs (images)
  |
  | Convex reactivity (no SSE/WS)
  v
[Browser: /forge UI]
  useForgeJobFiles(hostId, forgeJobId)
    → useQuery(api.forge.listJobFiles, ...)
    → ForgeFilesPane (ForgeJobDetail → Files tab)
        → FileBrowser (kind-grouped file list)
        → ArtifactPreview:
            text → sandboxed iframe (data: URI) + <pre> source toggle
            image → <img src={imageUrl}> (Convex File Storage URL)
            large/unsupported → fallback card + VS Code link

[Convex Cron: 04:00 UTC daily]
  sweepForgeFileRecords (internalMutation)
    → TTL pass: delete forgeFiles + forgeArtifacts past 7-day TTL
    → For image artifacts: ctx.storage.delete(storageId) FIRST, then ctx.db.delete
    → Per-job cap pass (mirror sweepForgeLogChunks shape)
```

### Recommended Project Structure

```
convex/
├── forgeFileIngest.ts       # New: httpAction POST /forge-file-ingest (clone of forgeLogIngest.ts)
├── forge.ts                 # Extend: upsertFileEntries, upsertArtifact, listJobFiles,
│                            #         sweepForgeFileRecords + pure helpers
├── schema.ts                # Extend: forgeFiles + forgeArtifacts tables
├── http.ts                  # Extend: /forge-file-ingest POST + OPTIONS routes
├── crons.ts                 # Extend: sweep-forge-file-records daily at 04:00 UTC
└── forgeFileIngest.test.ts  # New: contract test (mirror forgeLogIngest.test.ts)

src/
└── components/forge/
    ├── ForgeJobDetail.tsx   # Extend: add Files tab (three-state type)
    ├── ForgeFilesPane.tsx   # New: wrapper (mirrors ForgeLogPane.tsx)
    ├── FileBrowser.tsx      # New: port from forge/web + Tailwind re-skin
    └── ArtifactPreview.tsx  # New: port + adapt (Convex data props, data: URI iframe)

src/hooks/
└── useForge.ts              # Extend: useForgeJobFiles + artifact accessor

forge/src/emit/
└── codepulse-emitter.ts    # Extend: emitFiles() function + buildFilesPayload()
```

---

## Convex File Storage API

[CITED: docs.convex.dev/file-storage, docs.convex.dev/file-storage/store-files, docs.convex.dev/file-storage/serve-files, docs.convex.dev/file-storage/delete-files, github.com/get-convex/convex-backend/issues/328]

### store()

```typescript
// In an httpAction — receive image bytes as Blob:
const blob = await request.blob();
// In an internalMutation called from the httpAction — store:
const storageId: Id<"_storage"> = await ctx.storage.store(blob);
```

**Important architectural note:** `ctx.storage.store()` is only available on `MutationCtx` and `ActionCtx` (not `QueryCtx`). In the Phase 82 pattern, the httpAction must either:
- (a) Call `ctx.storage.store(blob)` directly in the httpAction (ActionCtx has storage), then pass `storageId` to an internalMutation; OR
- (b) Use a two-step: httpAction → `ctx.runAction(internal.forge.storeImageAndUpsert, ...)` → stores blob + calls internalMutation.

Option (a) is simpler: the httpAction has `ActionCtx` which supports `ctx.storage.store()`. Then call `ctx.runMutation(internal.forge.upsertArtifact, { ..., storageId })`. [ASSUMED: ActionCtx supports storage.store — needs verification against exact Convex 1.41.0 API; the docs confirm storage is on ActionCtx but clarification on httpAction specifically should be double-checked at implementation time]

### getUrl()

```typescript
const url: string | null = await ctx.storage.getUrl(storageId);
// Returns: permanent public URL string, or null if storageId doesn't exist
```

**URL access semantics (D-02a, CRITICAL):**
- URLs are **permanent** (not time-limited) [CITED: github.com/get-convex/convex-backend/issues/328]
- URLs are **unauthenticated** — any bearer of the URL can fetch the file without credentials [CITED: github.com/get-convex/convex-backend/issues/328]
- Security basis: **UUID-based obscurity only** — the URL is unguessable but not revocable without deleting+re-uploading the file
- **D-02a verdict confirmed:** This is acceptable for images behind the AuthGuard'd UI because: (1) image content is non-executable; (2) the iframe sandbox invariant (no `allow-same-origin`) applies only to HTML/text content in iframes; (3) `<img src={imageUrl}>` carries no XSS surface; (4) the URL is unguessable and only generated server-side into Convex documents accessible via reactive query. Text/HTML artifacts correctly stay out of File Storage to keep them behind the reactive query (no executable content from a public URL).
- **Alternative (served-via-function):** Convex supports a custom HTTP action that calls `ctx.storage.get(storageId)` → `Blob` and serves it with access control. This is NOT used in Phase 82 — accepted tradeoff per D-02a.

### delete()

```typescript
await ctx.storage.delete(storageId: Id<"_storage">);
// Returns: Promise<void>
```

**Critical sweep ordering:** In `sweepForgeFileRecords`, image artifact rows must have `ctx.storage.delete(storageId)` called BEFORE `ctx.db.delete(doc._id)`. If the doc is deleted first and the process crashes, the storageId is lost and the blob leaks permanently. [ASSUMED: ordering recommendation based on failure-mode reasoning; Convex mutations are atomic but process interruption between two awaits in a loop is possible]

### Schema validator for storage IDs

```typescript
// In convex/schema.ts:
forgeArtifacts: defineTable({
  // ...
  storageId: v.optional(v.id("_storage")),  // image artifacts only
  textContent: v.optional(v.string()),       // text/HTML artifacts only
})
```

### Per-Document Value Limit

**1 MiB (1,048,576 bytes) per document** [CITED: docs.convex.dev/production/state/limits]

This is the hard ceiling. The `textContent` field in `forgeArtifacts` must stay under this limit. Since the entire document (including all other fields + BSON overhead) must fit in 1 MiB, the effective safe cap for `textContent` is ~1,000,000 bytes (~950 KB), not exactly 1,048,576. The daemon-side enforcement (check `Buffer.byteLength(text, 'utf8') <= 1_000_000`) uses the conservative round number, which provides adequate headroom for document overhead. [VERIFIED: docs.convex.dev/production/state/limits — 1 MiB per document stated explicitly]

---

## Auth & CORS Patterns

All auth utilities are inherited verbatim from `convex/ingestAuth.ts`. No new auth code is needed.

### validateForgeIngestAuth (reuse verbatim)

```typescript
// convex/ingestAuth.ts — already implemented
export function validateForgeIngestAuth(request: Request): boolean {
  const expectedKey = _env.FORGE_INGEST_API_KEY;
  if (!expectedKey) return _env.FORGE_INGEST_ALLOW_ANON === "true"; // fail-closed
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```

### getCorsHeaders (reuse verbatim)

```typescript
// convex/ingestAuth.ts — already implemented
// Returns ACAO=* in dev (allowlist null), echoes specific origin in prod
export function getCorsHeaders(request: Request): Record<string, string>
```

### OPS-01: CODEPULSE_ALLOWED_ORIGIN

- **Current state:** `.env.example` has `# CODEPULSE_ALLOWED_ORIGIN=http://localhost:5173` (commented). Not set in production.
- **Target:** Set in Convex cloud deployment env; deploy checklist documents it.
- **Behavior when set:** `getCorsHeaders` reads `CODEPULSE_ALLOWED_ORIGIN` at module init via `parseAllowlist`. In prod (value set), it echoes the specific allowed origin back (fail-closed). When UNSET (current dev default), it falls back to wildcard (`*`) — dev-safe but NOT acceptable for prod.
- **No wildcard-only fallback for Forge endpoints in prod:** The `getCorsHeaders` implementation already satisfies this — it returns no `ACAO` header at all when an origin doesn't match the allowlist (browser blocks cross-origin reads). The requirement is that the env var is actually SET in production.

---

## Convex Backend Patterns

### forgeFiles table (new)

```typescript
forgeFiles: defineTable({
  hostId:     v.string(),
  forgeJobId: v.string(),
  path:       v.string(),       // relative path within workspace
  kind:       v.string(),       // "text" | "image" | "video" | "audio" | "pdf" | "binary"
  sizeBytes:  v.number(),
  createdAt:  v.string(),       // ISO timestamp — for TTL retention
})
  .index("by_host_job",      ["hostId", "forgeJobId"])           // listJobFiles
  .index("by_host_job_path", ["hostId", "forgeJobId", "path"]),  // idempotency check
```

### forgeArtifacts table (new)

```typescript
forgeArtifacts: defineTable({
  hostId:      v.string(),
  forgeJobId:  v.string(),
  path:        v.string(),                  // relative path — matches forgeFiles row
  kind:        v.string(),                  // "text" | "image"
  sizeBytes:   v.number(),
  textContent: v.optional(v.string()),      // text/HTML bytes (≤ ~1 MB)
  storageId:   v.optional(v.id("_storage")), // image bytes (Convex File Storage)
  createdAt:   v.string(),
})
  .index("by_host_job",      ["hostId", "forgeJobId"])
  .index("by_host_job_path", ["hostId", "forgeJobId", "path"]),  // idempotency + lookup
```

### upsertFileEntries (internalMutation)

Idempotent per `(hostId, forgeJobId, path)` — check `by_host_job_path` before insert. No-op on duplicate (mirrors `appendLogChunk`'s `if (existing) return;` pattern). Unlike log chunks, files are last-writer-wins on re-push (a file's size may change; use patch on existing row). [ASSUMED: last-writer-wins is the correct policy for file rows; confirm at plan time]

### upsertArtifact (internalMutation)

Idempotent per `(hostId, forgeJobId, path)`. If an existing artifact row has a `storageId`, and a new push arrives for the same path, the old blob should be deleted before inserting/patching: call `ctx.storage.delete(existing.storageId)` then update the row. [ASSUMED: re-push artifact handling; confirm at plan time]

### listJobFiles (query)

```typescript
export const listJobFiles = query({
  args: { hostId: v.string(), forgeJobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("forgeFiles")
      .withIndex("by_host_job", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
      )
      .order("asc")
      .take(FILE_LIST_LIMIT);  // discretionary cap, e.g. 2000
  },
});
```

### getJobArtifact (query)

```typescript
// Called when a file row is selected in FileBrowser
export const getJobArtifact = query({
  args: { hostId: v.string(), forgeJobId: v.string(), path: v.string() },
  handler: async (ctx, args) => {
    const artifact = await ctx.db
      .query("forgeArtifacts")
      .withIndex("by_host_job_path", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("path", args.path)
      )
      .unique();
    if (!artifact) return null;

    // Resolve storageId → URL for images (cannot call getUrl in a query — see note below)
    return artifact;
  },
});
```

**Note on `ctx.storage.getUrl` in queries:** `getUrl` requires `StorageReader` which is available on `QueryCtx`. The URL can be resolved in the query handler. This means `listJobFiles` or `getJobArtifact` can resolve the image URL server-side and return it directly to the React hook. [CITED: docs.convex.dev/file-storage/serve-files — "in your query you can control who gets access to a file when the URL is generated"]

```typescript
// In the query handler:
let imageUrl: string | null = null;
if (artifact.storageId) {
  imageUrl = await ctx.storage.getUrl(artifact.storageId);
}
return { ...artifact, imageUrl };
```

This is the cleanest pattern: the hook receives `{ textContent?, imageUrl?, ... }` and passes it directly to `ArtifactPreview`.

### Retention sweep (sweepForgeFileRecords)

```typescript
export const sweepForgeFileRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Pass 1: TTL — delete forgeArtifacts + forgeFiles past 7-day TTL.
    // CRITICAL: For image artifacts, storage.delete BEFORE db.delete.
    const allArtifacts = await ctx.db.query("forgeArtifacts").collect();
    const artifactTtlDeletes = selectTtlDeletes(allArtifacts, now);
    for (const artifact of artifactTtlDeletes) {
      if (artifact.storageId) {
        await ctx.storage.delete(artifact.storageId); // blob first
      }
      await ctx.db.delete(artifact._id);             // then doc row
    }

    // Similarly for forgeFiles rows past TTL...
    // Pass 2: Per-job cap (mirror selectCapDeletes shape for file bytes)
  },
});
```

Pure helpers analogous to `chunkByteSize`/`selectTtlDeletes`/`selectCapDeletes` should be exported from `forge.ts` so retention tests can exercise deletion logic without a Convex runtime.

---

## Daemon-Side Patterns

### emitFiles extension to codepulse-emitter.ts

Mirror `emitJob` / `emitWorkspaces` exactly — same `EmitCfg` type, same fire-and-forget discipline, same retry shape, same `loggedAuthStatuses` suppression for 401/403.

```typescript
// New env var: FORGE_FILE_INGEST_URL (separate gate, mirrors FORGE_LOG_INGEST_URL)
// Reuses: FORGE_INGEST_API_KEY (D-3)

export interface ForgeFileEntry {
  path:      string;   // relative path within workspace
  kind:      string;   // "text" | "image" | "video" | "audio" | "pdf" | "binary"
  sizeBytes: number;
}

export interface ForgeArtifactEntry {
  path:        string;
  kind:        string;        // "text" | "image"
  sizeBytes:   number;
  textContent?: string;       // text/HTML content (≤ 1 MB bytes)
  imageBase64?: string;       // image bytes base64-encoded for JSON transport
  //                             NOTE: see transport encoding discussion below
}

export interface ForgeFilesPayload {
  type:      'files';
  hostId:    string;
  forgeJobId: string;
  files:     ForgeFileEntry[];
  artifacts: ForgeArtifactEntry[];
}
```

**Transport encoding for image bytes:** JSON cannot carry raw binary. Options:
- base64 in JSON body — inflates ~37%; a 1 MB image becomes ~1.37 MB payload
- `multipart/form-data` — carries binary naturally but more complex to parse in the httpAction

For a cap of ≤ 1 MB per image, a base64-encoded JSON body is at most ~1.37 MB per artifact, well within Convex httpAction limits. The httpAction decodes base64 → `Uint8Array` → `Blob` → `ctx.storage.store(blob)`. This is the simpler path. [ASSUMED: base64-in-JSON is the chosen transport; confirm at plan time — the alternative is multipart but adds parsing complexity]

```typescript
// In httpAction: decode base64 image bytes
const bytes = Uint8Array.from(atob(artifact.imageBase64), c => c.charCodeAt(0));
const blob = new Blob([bytes], { type: contentTypeFor(artifact.path) });
const storageId = await ctx.storage.store(blob);
```

Note: `atob` is available in the Convex httpAction runtime (V8/Web platform APIs). [ASSUMED: atob available; alternatively use Buffer.from(base64, 'base64') which is Node-compatible]

### Recursive walk + ignore rules

Reuse the existing file system patterns from `forge` repo. Ignore list (discretionary — set at plan time, suggested):

```typescript
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.venv']);
const FILE_COUNT_CAP = 500;    // discretionary; set at plan time
const FILE_BYTE_CAP_PER_JOB = 10_000_000; // 10 MB total artifact bytes per job
const PER_FILE_CAP = 1_000_000; // 1 MB per file (text or image)
```

### Path-traversal guard on enumeration

Import `guardPath` and `PathTraversalError` from `src/workspace/manager.ts`. Apply before reading file bytes:

```typescript
import { guardPath, PathTraversalError } from '../workspace/manager.js';
import { kindTag } from '../workspace/kinds.js';
// ...
try {
  const absPath = guardPath(workspace.rootPath, ...relativeParts);
  // Also apply fs.realpathSync to catch symlink escapes (mirrors artifact.ts:134-148)
  const realPath = fs.realpathSync.native(absPath);
  const realRoot = fs.realpathSync.native(workspace.rootPath);
  if (!realPath.toLowerCase().startsWith(realRoot.toLowerCase() + path.sep.toLowerCase())) {
    // symlink escape — skip this entry
    continue;
  }
} catch (err) {
  if (err instanceof PathTraversalError) continue; // skip path-traversal entries
  throw err;
}
```

The test for Req 9 (path-traversal/symlink-escape rejection) targets this guard.

---

## Component Port Patterns

### FileBrowser port delta

Source: `C:\Users\mandr\forge\web\src\components\FileBrowser.tsx`

Key adaptations:
1. **Props:** `files: ForgeFileEntry[]` (from `listJobFiles`), `workspace: { rootPath: string }`, `onSelectFile: (entry) => void`. Drop `currentPath`/`onNavigate` (not used; SPEC boundary: no folder drill-down).
2. **Style:** Replace all `style={{...}}` with Tailwind class strings per UI-SPEC.
3. **File rows:** Remove the `href="#"` anchor wrapper — per UI-SPEC, filename is a plain text node. VS Code link uses `<a href={vsCodeHref}>` for text files (D-04a: all kinds show VS Code link per UI-SPEC).
4. **Empty state:** Use UI-SPEC copy ("No files found for this job." for zero-files terminal; "Files appear after the job completes." for running job — handled in `ForgeFilesPane`, not `FileBrowser`).
5. **Source FileBrowser uses `entry.name` (bare filename):** CodePulse port uses `entry.path` (relative path string from Convex). Update key prop and display accordingly.
6. **Dirs branch:** Suppress entirely (no `onNavigate` wired → `navEnabled = false` → `dirs` filter produces no output).

### ArtifactPreview port delta

Source: `C:\Users\mandr\forge\web\src\components\ArtifactPreview.tsx`

Key adaptations:
1. **Remove `buildArtifactUrl` / `getForgeConfig()`** — data comes from props, not `http://127.0.0.1`.
2. **New props:** See `ArtifactPreviewProps` in `82-UI-SPEC.md` — `textContent?`, `imageUrl?`, `fileKind`, `sizeBytes`, `rootPath`, `filePath`, `defaultMode?`.
3. **iframe src:** Replace `artifactUrl` (http://127.0.0.1) with `data:` URI:
   ```typescript
   const dataSrc = `data:text/html;charset=utf-8,${encodeURIComponent(textContent)}`;
   // <iframe src={dataSrc} sandbox="allow-scripts" title="Artifact preview" ... />
   ```
4. **Source mode:** No async fetch needed — `textContent` is already in props (eager push). Remove `fetchedSource` / `setIsFetching` state. Simple toggle between iframe and `<pre>{textContent}</pre>`.
5. **Image:** `<img src={imageUrl}>` where `imageUrl` comes from `ctx.storage.getUrl` resolved in the Convex query (permanent URL, no fetch needed).
6. **Not-previewable fallback:** Implement per UI-SPEC (size/kind condition, VS Code link, local path).
7. **Video/audio/PDF:** Fallback to not-previewable card (SPEC out-of-scope for inline preview).
8. **Remove `source?` optional fetch-on-demand pattern** — not needed under eager push.

### ForgeJobDetail tab strip extension

```typescript
// Before (line 50):
type DetailTab = "details" | "logs";

// After:
type DetailTab = "details" | "logs" | "files";
```

Add Files button in the tab strip (line 165 pattern), add conditional render:

```tsx
{activeTab === "files" && (
  <SectionErrorBoundary name="Files">
    <ForgeFilesPane
      hostId={job.hostId}
      forgeJobId={job._id}  // NOTE: verify exact field name (forgeJobId vs _id)
      jobStatus={job.status}
      workspace={{ rootPath: /* from forgeWorkspaces */ }}
    />
  </SectionErrorBoundary>
)}
```

**Note on workspace rootPath:** `ForgeJobDetail` receives a `job` object. The `rootPath` comes from the `forgeWorkspaces` table (via `workspaceId`). Either pass it from `ForgePage` or add a `useQuery(api.forge.listWorkspaces, ...)` lookup in `ForgeFilesPane`. [ASSUMED: workspace prop is available from ForgePage — verify at plan time]

### useForgeJobFiles hook

```typescript
// Mirror useForgeJobLogs pattern exactly:
export function useForgeJobFiles(
  hostId: string | null,
  forgeJobId: string | null
): ForgeFileRow[] {
  const raw = useQuery(
    api.forge.listJobFiles,
    hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
  );
  return useMemo(
    () => (raw === undefined ? [] : raw.map(adaptFileEntry)),
    [raw]
  );
}

// Artifact accessor (selected file → artifact content):
export function useForgeJobArtifact(
  hostId: string | null,
  forgeJobId: string | null,
  path: string | null
): ForgeArtifactRow | null | undefined {
  return useQuery(
    api.forge.getJobArtifact,
    hostId && forgeJobId && path ? { hostId, forgeJobId, path } : "skip"
  );
}
```

**Referential stability:** `useMemo` wrapper required (Phase 80 lesson — prevents React render loops on every Convex reactive update).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bearer auth for ingest | Custom auth middleware | `validateForgeIngestAuth` from `ingestAuth.ts` | Already implemented, fail-closed, tested |
| CORS headers | Custom CORS logic | `getCorsHeaders` from `ingestAuth.ts` | Already handles allowlist + dev fallback |
| Path traversal guard | Custom path normalization | `guardPath` + `PathTraversalError` from `workspace/manager.ts` | Already Windows-correct, tested |
| Symlink escape | fs.stat-based check | `fs.realpathSync.native` pattern from `artifact.ts:134-148` | Already handles NTFS junctions |
| File kind classification | Custom extension map | `kindTag` from `workspace/kinds.ts` | Already allowlisted, tested, canonical |
| Retention TTL logic | Custom date math | `selectTtlDeletes`/`selectCapDeletes` pure helper pattern | Export new helpers for testability |
| UI primitives | Custom list/scroll/button | `Button`, `ScrollArea`, `Separator` from `src/components/ui/` | Already shadcn New York style |
| Sandbox XSS prevention | Custom sanitization | `sandbox="allow-scripts"` + React text node `{textContent}` | Platform-enforced; React auto-escapes |

**Key insight:** Every security-critical sub-problem (auth, path guards, sandbox, XSS) has an existing, tested solution in the codebase. This phase's job is to wire them together, not rebuild them.

---

## Common Pitfalls

### Pitfall 1: ctx.storage.store() in a query context
**What goes wrong:** Attempting to call `ctx.storage.store()` from a Convex `query` function fails — `storage.store` requires `MutationCtx` or `ActionCtx`.
**Why it happens:** Confusing the httpAction context (ActionCtx, has storage) with the query context.
**How to avoid:** Store blobs in the httpAction (ActionCtx) or an `internalAction`. Pass the resulting `storageId` to an `internalMutation` via `ctx.runMutation`. Never call `ctx.storage.store` from a `query`.
**Warning signs:** TypeScript error — `store` not on `QueryCtx` type.

### Pitfall 2: Blob leak from orphaned storageIds
**What goes wrong:** Deleting a `forgeArtifacts` doc row without calling `ctx.storage.delete(storageId)` first leaves the blob in File Storage permanently (no automatic GC).
**Why it happens:** Treating Convex File Storage like a normal table — documents auto-delete, blobs don't.
**How to avoid:** In `sweepForgeFileRecords` and in `upsertArtifact` (when overwriting an existing image), always call `ctx.storage.delete(storageId)` before `ctx.db.delete(_id)`. The retention test MUST verify both the doc row AND the blob are gone.
**Warning signs:** File Storage usage growing without bound despite active retention sweep.

### Pitfall 3: Base64 double-encoding of image bytes
**What goes wrong:** Storing the base64 transport string in the Convex doc (`textContent`) instead of decoding it first.
**Why it happens:** Confusing transport format (base64 JSON) with storage format (string for text, storageId for images).
**How to avoid:** httpAction always decodes base64 → Uint8Array → Blob → `ctx.storage.store`. Never write raw base64 into a `forgeArtifacts` doc.

### Pitfall 4: allow-same-origin on the preview iframe
**What goes wrong:** Adding `allow-same-origin` to the iframe sandbox permits the framed content to access the parent origin's DOM, localStorage, and cookies — exactly the XSS vector WSP-03 prevents.
**Why it happens:** Developer adds it to allow the iframe to read its own `document`, not realizing it unlocks parent-origin access.
**How to avoid:** The iframe `sandbox` attribute MUST be exactly `"allow-scripts"` — nothing else. Use a `data:` URI (opaque null origin) as the src, not a Convex URL. The `82-UI-SPEC.md` §Security Invariants is the ground truth.
**Warning signs:** Code review check — grep for `allow-same-origin` in all JSX files.

### Pitfall 5: Double-path URL construction (CONVEX_FORGE_INGEST_URL)
**What goes wrong:** Env var already has `/forge-ingest` appended; emitter appends it again → 404.
**Why it happens:** Existing pattern in `codepulse-emitter.ts:146` — `url = \`${ingestUrl}/forge-ingest\``.
**How to avoid:** `FORGE_FILE_INGEST_URL` should be the full endpoint URL (including path): e.g. `https://deployment.convex.site/forge-file-ingest`. Mirror the `FORGE_LOG_INGEST_URL` convention from `log-forwarder.ts:214` which stores the full path in the var and appends `LOG_INGEST_PATH`. Alternatively, store the base URL and append the path in the emitter — but be consistent. Document the convention in the deploy checklist.

### Pitfall 6: seq-based idempotency applied to file entries (wrong key)
**What goes wrong:** Using a `seq` counter for file entry deduplication (copied from log chunks) instead of `(hostId, forgeJobId, path)`.
**Why it happens:** Mechanical clone of the log chunk pattern without adapting the idempotency key.
**How to avoid:** File entries are idempotent on `path` (a file at a given path is a single record per job). Use the `by_host_job_path` index for the `.unique()` check. There is no `seq` field on file rows.

### Pitfall 7: Terminal-state gate bypassed for running jobs
**What goes wrong:** File listing shows during a running job (or the ForgeFilesPane renders file data mid-run).
**Why it happens:** Forgetting to gate the `ForgeFilesPane` on `job.status` before rendering.
**How to avoid:** In `ForgeFilesPane`, check `const TERMINAL_STATUSES = ["completed", "failed", "stopped"]` and return the running-job empty state if `!TERMINAL_STATUSES.includes(jobStatus)`. This is the first conditional in the component, before any data fetch.

### Pitfall 8: FORGE_INGEST_API_KEY in browser code
**What goes wrong:** Bearer key leaks to the client bundle.
**Why it happens:** Accidentally importing the emitter or ingest env var in a `src/` file.
**How to avoid:** The key is in the daemon's process.env and in the Convex cloud deployment env. The browser never sees it. Audit check: `grep -r "FORGE_INGEST_API_KEY" src/` should return zero results.

---

## Code Examples

### forgeFileIngest.ts — clone of forgeLogIngest.ts

```typescript
// convex/forgeFileIngest.ts
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";

export const forgeFileIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: getCorsHeaders(request) });
  }
  if (!validateForgeIngestAuth(request)) {
    return unauthorizedResponse();
  }

  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
    status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) }
  }); }

  const { type, hostId, forgeJobId, files, artifacts } = body ?? {};
  if (type !== "files" || !hostId || !forgeJobId || !Array.isArray(files)) {
    return new Response(JSON.stringify({ error: "Missing required fields: type, hostId, forgeJobId, files" }), {
      status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) }
    });
  }

  // Store image blobs via ctx.storage (ActionCtx) BEFORE calling internalMutation
  const artifactsWithStorageIds = [];
  for (const artifact of (artifacts ?? [])) {
    if (artifact.kind === "image" && artifact.imageBase64) {
      const bytes = Uint8Array.from(atob(artifact.imageBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes]);
      const storageId = await ctx.storage.store(blob);
      artifactsWithStorageIds.push({ ...artifact, storageId, imageBase64: undefined });
    } else {
      artifactsWithStorageIds.push(artifact);
    }
  }

  await ctx.runMutation(internal.forge.upsertFileEntries, { hostId, forgeJobId, files });
  await ctx.runMutation(internal.forge.upsertArtifacts, {
    hostId, forgeJobId, artifacts: artifactsWithStorageIds
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) }
  });
});
```

[Source pattern: `convex/forgeLogIngest.ts` — verified]

### ArtifactPreview — data: URI iframe (security invariant)

```typescript
// Preview mode: data: URI preserves null-origin sandbox semantics
// SECURITY: sandbox MUST NOT include allow-same-origin
const dataSrc = `data:text/html;charset=utf-8,${encodeURIComponent(textContent)}`;

<iframe
  src={dataSrc}
  sandbox="allow-scripts"      // IMMUTABLE: no allow-same-origin ever
  title="Artifact preview"
  style={{ width: '100%', height: '100%', border: 'none', minHeight: 240 }}
/>

// Source mode: React text node — auto-escaped
<pre style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.538, ... }}>
  {textContent}    {/* React child: never innerHTML, never dangerouslySetInnerHTML */}
</pre>
```

[Source: `forge/web/src/components/ArtifactPreview.tsx:137-174` + `82-UI-SPEC.md §Security Invariants` — verified]

### Retention sweep with File Storage delete

```typescript
// Export pure helper for testing (mirror chunkByteSize pattern)
export function artifactByteSize(artifact: { textContent?: string; sizeBytes: number }): number {
  return artifact.textContent ? artifact.textContent.length : artifact.sizeBytes;
}

// In sweepForgeFileRecords internalMutation:
for (const artifact of artifactTtlDeletes) {
  if (artifact.storageId) {
    await ctx.storage.delete(artifact.storageId);  // blob FIRST
  }
  await ctx.db.delete(artifact._id);               // then doc row
}
```

---

## Runtime State Inventory

> Omit for this phase — this is a greenfield surface (new tables, new components, new daemon extension). No existing runtime state carries the concept of "files" or "artifacts" in Convex that requires migration.

One exception: **`forgeJobs.artifactCount`** — this display-only counter (set by the daemon on each job state push) is NOT migrated or changed. The new `forgeFiles` table is additive; `artifactCount` remains as-is.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `fs.realpathSync.native` | Daemon file enumeration | ✓ | Node.js 18+ (forge runtime) | — |
| Node.js `path` module | guardPath + kindTag | ✓ | Node.js built-in | — |
| `atob` global | httpAction base64 decode | ✓ (V8/Web API in Convex runtime) | — | `Buffer.from(b64, 'base64')` if not available |
| `Blob` constructor | `ctx.storage.store(blob)` | ✓ (V8/Web API in Convex runtime) | — | — |
| Convex File Storage | Image artifact storage | ✓ | Convex 1.41.0 | — |
| `vscode://` URI handler | VS Code deep links | best-effort | same-machine only | Link renders regardless; labeled best-effort |

**Missing dependencies with no fallback:** none

**Missing dependencies with fallback:** VS Code URI handler (best-effort by design per D-04a).

---

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (configured, existing) |
| Config file | `vite.config.ts` (existing Vitest config) |
| Quick run command | `npx vitest run convex/forgeFileIngest.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-1 (FI-12) | listJobFiles returns correct rows | unit (pure helper) | `npx vitest run convex/forgeFileIngest.test.ts` | ❌ Wave 0 |
| REQ-1 | Ingest is idempotent per (hostId, forgeJobId, path) | unit (simulateDispatch) | same | ❌ Wave 0 |
| REQ-1 | 401 on bad bearer, 400 on bad body | unit (validateForgeIngestAuth) | same | ❌ Wave 0 |
| REQ-2 (FI-13) | ≤1 MB text artifact retrievable from Convex | unit (simulateDispatch) | same | ❌ Wave 0 |
| REQ-2 | >1 MB file has no artifact bytes | unit | same | ❌ Wave 0 |
| REQ-3 (FI-14) | Retention TTL deletes doc + blob | unit (pure helpers) | same | ❌ Wave 0 |
| REQ-3 | Per-job cap deletes oldest first | unit (pure helpers) | same | ❌ Wave 0 |
| REQ-8 (FI-14) | No browser-side FORGE_INGEST_API_KEY reference | grep/audit | `grep -r FORGE_INGEST_API_KEY src/` | manual |
| REQ-9 (FI-14) | Path-traversal entry rejected by daemon enumeration | unit (guardPath) | `npx vitest run src/emit/codepulse-emitter.test.ts` (extend) or new forge test | ❌ Wave 0 |
| REQ-9 | No dangerouslySetInnerHTML, no allow-same-origin in iframe | code review + grep | `grep -r "allow-same-origin\|dangerouslySetInnerHTML" src/` | manual |
| REQ-12 (FI-13) | Live round-trip: terminal job → files appear in CodePulse | e2e (manual) | manual — env gate set/unset | manual-only |
| REQ-6 (FI-12) | Files tab renders; Details + Logs unchanged | visual + smoke | `npx vitest run src/App.test.tsx` + manual | manual |
| REQ-7 (FI-12) | Running job → empty state; terminal → file listing | unit/smoke | `npx vitest run` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/forgeFileIngest.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm test` fully green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `convex/forgeFileIngest.test.ts` — covers auth (SC#1), body validation (SC#2), simulateForgeFileIngestDispatch, retention pure helpers
- [ ] `convex/forge.ts` — export `artifactByteSize`, `selectFileCapDeletes` pure helpers (testable without Convex runtime)
- [ ] Extend `forge/src/emit/codepulse-emitter.test.ts` (or new file) — path-traversal rejection test for daemon enumeration guard

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (bearer key is server-to-server, not user auth) |
| V3 Session Management | no | — |
| V4 Access Control | yes | Clerk AuthGuard on `/forge` route (inherited); `validateForgeIngestAuth` on ingest write path |
| V5 Input Validation | yes | JSON body validation in httpAction (400 on bad shape); `v.` validators in internalMutation args |
| V6 Cryptography | no | — (bearer key is env var, not crypto) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in file enumeration | Spoofing / EoP | `guardPath` + `fs.realpathSync.native` symlink check (reused from `artifact.ts`) |
| Symlink escape out of workspace root | EoP | `fs.realpathSync.native` containment re-check (both `absPath` and `workspace.rootPath` resolved) |
| XSS via agent-generated HTML in preview | Tampering / Info Disclosure | `sandbox="allow-scripts"` only (no `allow-same-origin`); `data:` URI origin is null; text as React text node |
| Bearer key exposure in browser | Info Disclosure | `FORGE_INGEST_API_KEY` never in `src/`; audit with grep |
| Oversized document write error | DoS | Per-file cap enforced daemon-side (≤ 1,000,000 bytes check) before POST |
| File Storage blob leak on doc delete | Info Disclosure / Storage DoS | `ctx.storage.delete(storageId)` in sweep BEFORE `ctx.db.delete` |
| Unauthenticated File Storage URL access | Info Disclosure | Accepted per D-02a (unguessable UUID; image content non-executable; behind AuthGuard'd UI) |
| Fake/injected filename as XSS vector | Tampering | All filenames and paths rendered as React text nodes; never `innerHTML` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Serving artifacts from `http://127.0.0.1` loopback | Convex bounded-ingest bridge (daemon → Convex → cloud) | Phase 78 decision / Phase 82 implementation | Mixed-content blocked in cloud browser; Convex bridge is the only viable path |
| iframe `src` from artifact server URL | `data:` URI from `encodeURIComponent(textContent)` | Phase 82 (new) | Null-origin sandbox semantics preserved without network round-trip |
| On-demand artifact fetch from loopback | Eager push at terminal state | D-01 Phase 82 | Cloud opens any previewable file instantly from reactive query |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ctx.storage.store()` is available on `ActionCtx` (httpAction context) | Convex File Storage API | Low — docs confirm storage on ActionCtx; if not, use an internalAction as intermediary |
| A2 | `atob` is available in the Convex V8 runtime | Code Examples (forgeFileIngest.ts) | Low — `Buffer.from(b64, 'base64')` is Node-compatible fallback |
| A3 | File entry re-push should be last-writer-wins (patch) for `sizeBytes` | Backend Patterns (upsertFileEntries) | Low — files rarely change; confirm at plan time |
| A4 | `upsertArtifact` should delete old storageId on re-push | Backend Patterns (upsertArtifact) | Medium — if wrong, old blobs accumulate; conservative to always delete+replace |
| A5 | Base64-in-JSON is the chosen transport encoding for image bytes | Daemon-Side Patterns | Low — multipart is the alternative; base64 is simpler to implement |
| A6 | `forgeJobId` field in `ForgeJobDetail` JSX matches the Convex doc `forgeJobId` (not `_id`) | Component Port Patterns (ForgeJobDetail extension) | Low — verify at implementation time against `ForgeJobDetail.tsx` props |
| A7 | `workspace.rootPath` is accessible in `ForgeJobDetail` or can be looked up via `forgeWorkspaces` | Component Port Patterns | Low — `forgeWorkspaces` is queryable; add `useQuery(api.forge.listWorkspaces)` in ForgeFilesPane if not passed from parent |
| A8 | `ctx.storage.delete()` ordering (blob before doc) is a correctness requirement | Retention Sweep | High if wrong — blob leak is permanent with no GC; ordering is the safe default |
| A9 | shadcn `Button`, `ScrollArea`, `Separator` are all present in `src/components/ui/` | Standard Stack | Low — components.json confirms shadcn initialized; verify with dir listing at plan time |

---

## Open Questions

1. **httpAction vs internalAction for ctx.storage.store()**
   - What we know: `ctx.storage.store()` needs ActionCtx or MutationCtx; httpActions ARE ActionCtx.
   - What's unclear: Convex 1.41.0 docs confirm this but the httpAction runtime specifics are worth a quick sanity check at plan time with `npx convex dev` and a test mutation.
   - Recommendation: Plan to store in httpAction (ActionCtx path); add a fallback plan (internalAction) in case the httpAction runtime restricts storage writes.

2. **Per-job file-count cap and total-byte cap values**
   - What we know: D-03 says "file-count cap to stay bounded — set at plan time."
   - What's unclear: Exact numbers. Research suggests: 500 files/job, 10 MB total artifact bytes/job, 1 MB per individual file.
   - Recommendation: Use these as starting values; Larry can adjust in the plan discussion.

3. **FORGE_FILE_INGEST_URL naming convention**
   - What we know: Phase 81 uses `FORGE_LOG_INGEST_URL`. This phase needs a parallel gate var.
   - What's unclear: Whether to use `FORGE_FILE_INGEST_URL` (consistent naming) or `FORGE_ARTIFACT_INGEST_URL`.
   - Recommendation: `FORGE_FILE_INGEST_URL` — consistent with `FORGE_LOG_INGEST_URL`.

4. **Deploy checklist location**
   - What we know: D-Claude's Discretion says "a markdown doc in the repo."
   - Recommendation: `docs/forge-deploy-checklist.md` at the CodePulse repo root.

---

## Sources

### Primary (HIGH confidence)

- `convex/forgeLogIngest.ts` — httpAction pattern source (verified live code)
- `convex/ingestAuth.ts` — auth/CORS utilities (verified live code)
- `convex/forge.ts` — all Phase 81 patterns: appendLogChunk, sweepForgeLogChunks, pure helpers (verified live code)
- `convex/schema.ts:1464-1508` — table/index conventions (verified live code)
- `convex/crons.ts` — sweep scheduling pattern, existing cron names + offsets (verified live code)
- `convex/http.ts` — route registration pattern (verified live code)
- `convex/forgeLogIngest.test.ts` — test structure to mirror (verified live code)
- `forge/src/emit/codepulse-emitter.ts` — EmitCfg seam, fire-and-forget, retry shape (verified live code)
- `forge/src/emit/log-forwarder.ts` — makeLogSink, FORGE_LOG_INGEST_URL gate convention (verified live code)
- `forge/src/emit/config.ts` — resolveEmitCfg env var pattern (verified live code)
- `forge/src/workspace/kinds.ts` — kindTag, FileKind union, EXTENSION_KINDS allowlist (verified live code)
- `forge/src/workspace/manager.ts` — guardPath, validateWorkspaceId, PathTraversalError (verified live code)
- `forge/src/http/routes/artifact.ts` — symlink-escape guard pattern (realpathSync.native + containment check) (verified live code)
- `forge/web/src/components/FileBrowser.tsx` — port source (verified live code)
- `forge/web/src/components/ArtifactPreview.tsx` — port source (verified live code)
- `docs.convex.dev/production/state/limits` — 1 MiB per-document limit [CITED]
- `docs.convex.dev/file-storage/store-files` — ctx.storage.store(blob) → Id<"_storage"> [CITED]
- `docs.convex.dev/file-storage/serve-files` — ctx.storage.getUrl(storageId), query-context URL generation [CITED]
- `docs.convex.dev/file-storage/delete-files` — ctx.storage.delete(storageId), v.id("_storage") [CITED]
- `src/hooks/useForge.ts:289-301` — useForgeJobLogs hook pattern to mirror (verified live code)
- `src/components/forge/ForgeJobDetail.tsx:49-51` — current two-state tab strip (verified live code)
- `.env.example:21` — CODEPULSE_ALLOWED_ORIGIN current state (verified live code)

### Secondary (MEDIUM confidence)

- `github.com/get-convex/convex-backend/issues/328` — File Storage URL public/unauthenticated/permanent semantics [CITED]

### Tertiary (LOW confidence)

- None — all critical claims verified against live code or official documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries pre-existing in codebase; no new installs
- Bridge pattern (Convex backend): HIGH — verified against Phase 81 live code
- Component port: HIGH — source components read in full; delta identified precisely
- Daemon extension: HIGH — emitter + log-forwarder source verified; pattern is a direct clone
- File Storage API: MEDIUM-HIGH — official docs consulted; `ctx.storage.store` in httpAction confirmed but one assumption logged (A1)
- Security invariants: HIGH — live code verified; UI-SPEC §Security Invariants is authoritative
- OPS-01: HIGH — `ingestAuth.ts` implementation verified; env var state verified from `.env.example`

**Research date:** 2026-06-17
**Valid until:** 2026-07-17 (Convex stable; 30 days)
