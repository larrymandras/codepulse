# Phase 82: Files + Artifact Preview + Hardening — Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 14 new/modified files (10 CodePulse, 1 cross-repo forge daemon, plus 3 reuse/no-mod)
**Analogs found:** 13 / 14 (1 file — `docs/forge-deploy-checklist.md` — has no code analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `convex/forgeFileIngest.ts` (NEW) | httpAction handler | request-response | `convex/forgeLogIngest.ts` | exact |
| `convex/forge.ts` (MODIFY) | service / internalMutation + query | CRUD | `convex/forge.ts` lines 530–669 (log sweep/ingest/query block) | exact — extend in-file |
| `convex/schema.ts` (MODIFY) | model / schema | CRUD | `convex/schema.ts` lines 1487–1497 (`forgeLogChunks` table) | exact |
| `convex/http.ts` (MODIFY) | config / router | request-response | `convex/http.ts` lines 77–79 (Phase 81 log route block) | exact |
| `convex/crons.ts` (MODIFY) | config / scheduler | batch | `convex/crons.ts` lines 111–116 (Phase 81 sweep cron) | exact |
| `convex/forgeFileIngest.test.ts` (NEW) | test | CRUD | `convex/forgeLogIngest.test.ts` | exact |
| `src/components/forge/ForgeFilesPane.tsx` (NEW) | component | request-response | `src/components/forge/ForgeLogPane.tsx` | exact |
| `src/components/forge/FileBrowser.tsx` (NEW) | component | request-response | `C:\Users\mandr\forge\web\src\components\FileBrowser.tsx` | exact (port source) |
| `src/components/forge/ArtifactPreview.tsx` (NEW) | component | request-response | `C:\Users\mandr\forge\web\src\components\ArtifactPreview.tsx` | exact (port source) |
| `src/components/forge/ForgeJobDetail.tsx` (MODIFY) | component | request-response | `src/components/forge/ForgeJobDetail.tsx` lines 49–51, 152–185 (tab strip) | exact — extend in-file |
| `src/hooks/useForge.ts` (MODIFY) | hook | request-response | `src/hooks/useForge.ts` lines 289–301 (`useForgeJobLogs`) | exact — extend in-file |
| `forge/src/emit/codepulse-emitter.ts` (MODIFY, cross-repo) | service / emitter | event-driven | `forge/src/emit/codepulse-emitter.ts` lines 138–196 (`emitJob`) + `forge/src/emit/log-forwarder.ts` lines 241–275 (`makeLogSink`) | exact |
| `convex/ingestAuth.ts` (REUSE, no modify) | utility | — | self — reused verbatim | verbatim |
| `docs/forge-deploy-checklist.md` (NEW) | doc | — | — | no analog |

---

## Pattern Assignments

### `convex/forgeFileIngest.ts` (NEW — httpAction, request-response)

**Analog:** `convex/forgeLogIngest.ts` (lines 1–73) — clone verbatim, adapt envelope

**Imports pattern** (lines 15–17):
```typescript
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";
```

**OPTIONS/CORS preflight pattern** (lines 21–26):
```typescript
if (request.method === "OPTIONS") {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request),
  });
}
```

**Bearer auth pattern** (lines 29–31):
```typescript
if (!validateForgeIngestAuth(request)) {
  return unauthorizedResponse();
}
```

**JSON parse + 400 error pattern** (lines 33–45):
```typescript
let body: any;
try {
  body = await request.json();
} catch {
  return new Response(
    JSON.stringify({ error: "Invalid JSON body" }),
    {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
}
```

**Field validation + 400 pattern** (lines 47–56):
```typescript
// Change: type !== "log" → type !== "files"; adapt required fields
if (type !== "files" || !hostId || !forgeJobId || !Array.isArray(files)) {
  return new Response(
    JSON.stringify({ error: "Missing required fields: type, hostId, forgeJobId, files" }),
    {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
}
```

**Dispatch to internalMutation pattern** (lines 58–64):
```typescript
// Change: appendLogChunk → upsertFileEntries + upsertArtifacts
// ADDITION (D-02): image blobs stored via ctx.storage.store(blob) in httpAction BEFORE
// calling internalMutation (ActionCtx has storage; internalMutation does not need to).
await ctx.runMutation(internal.forge.upsertFileEntries, { hostId, forgeJobId, files });
await ctx.runMutation(internal.forge.upsertArtifacts, { hostId, forgeJobId, artifacts });
```

**200 success response pattern** (lines 66–73):
```typescript
return new Response(
  JSON.stringify({ ok: true }),
  {
    status: 200,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  }
);
```

**Key adaptations from analog:**
- `type !== "log"` → `type !== "files"`
- Required fields: `{ type, hostId, forgeJobId, files }` — no `seq` (file idempotency key is `path`, not `seq`)
- Image blob storage step inserted between validation and internalMutation dispatch (uses `ctx.storage.store(blob)` on ActionCtx — only available here, not in mutation)
- Two separate `ctx.runMutation` calls: one for file entries, one for artifacts

---

### `convex/forge.ts` — new additions: `upsertFileEntries`, `upsertArtifact`, `listJobFiles`, `sweepForgeFileRecords`, pure helpers (MODIFY)

**Analog:** `convex/forge.ts` lines 530–669 — read in full above

**Constants pattern** (mirror lines 530 — `LOG_BYTE_CAP_PER_JOB`):
```typescript
export const FILE_LIST_LIMIT = 2000;            // discretionary — set at plan time
export const ARTIFACT_BYTE_CAP_PER_JOB = 10_000_000;  // 10 MB total artifact bytes per job
export const PER_FILE_BYTE_CAP = 1_000_000;    // 1 MB per text/image artifact
```

**Pure helper — byte accounting** (mirror lines 536–542 `chunkByteSize`):
```typescript
export function artifactByteSize(artifact: { textContent?: string; sizeBytes: number }): number {
  return artifact.textContent ? artifact.textContent.length : artifact.sizeBytes;
}
```

**Pure helper — TTL filter** (mirror lines 548–554 `selectTtlDeletes`):
```typescript
// selectTtlDeletes shape carries over verbatim; new helper is selectFileCapDeletes
// (files use sizeBytes not lines, so a new pure helper is needed):
export function selectFileCapDeletes<T extends { _id: any; createdAt: string; sizeBytes: number }>(
  files: T[],
  capBytes: number
): T[] { ... }
```

**`appendLogChunk` idempotency pattern** (lines 623–651) — copy for `upsertFileEntries`:
```typescript
// D-1 idempotency check pattern (adapt index name + field):
const existing = await ctx.db
  .query("forgeFiles")
  .withIndex("by_host_job_path", (q) =>
    q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("path", args.path)
  )
  .unique();

// DIFFERENCE FROM LOG CHUNK: file rows are last-writer-wins patch (not append-only no-op)
// because file size may change on re-push. Use ctx.db.patch(existing._id, {...}) not return.
```

**`listJobLogs` reactive query pattern** (lines 653–669) — copy for `listJobFiles`:
```typescript
// Change index name: by_host_job (same); change table: "forgeFiles"
// Change take: LOG_CHUNK_LIMIT → FILE_LIST_LIMIT
return await ctx.db
  .query("forgeFiles")
  .withIndex("by_host_job", (q) =>
    q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
  )
  .order("asc")
  .take(FILE_LIST_LIMIT);
```

**`sweepForgeLogChunks` retention sweep pattern** (lines 579–617) — copy for `sweepForgeFileRecords`:
```typescript
// CRITICAL ADDITION (D-05): for image artifacts, call ctx.storage.delete(storageId)
// BEFORE ctx.db.delete(_id). Blob leak is permanent if doc is deleted first.
// Order: storage.delete → db.delete (within each iteration)
for (const artifact of artifactTtlDeletes) {
  if (artifact.storageId) {
    await ctx.storage.delete(artifact.storageId);  // blob FIRST
  }
  await ctx.db.delete(artifact._id);               // then doc row
}
```

---

### `convex/schema.ts` — `forgeFiles` + `forgeArtifacts` tables (MODIFY)

**Analog:** `convex/schema.ts` lines 1487–1497 (`forgeLogChunks` table definition)

**Table definition pattern** (lines 1489–1497):
```typescript
forgeLogChunks: defineTable({
  hostId:     v.string(),
  forgeJobId: v.string(),
  lines:      v.array(v.string()),
  seq:        v.number(),
  sentAt:     v.optional(v.string()),
})
  .index("by_host_job",     ["hostId", "forgeJobId"])
  .index("by_host_job_seq", ["hostId", "forgeJobId", "seq"]),
```

**New `forgeFiles` table** (insert after line 1497, before `forgeWorkspaces`):
```typescript
forgeFiles: defineTable({
  hostId:     v.string(),
  forgeJobId: v.string(),
  path:       v.string(),     // relative path within workspace
  kind:       v.string(),     // "text"|"image"|"video"|"audio"|"pdf"|"binary"
  sizeBytes:  v.number(),
  createdAt:  v.string(),     // ISO timestamp — for TTL retention
})
  .index("by_host_job",      ["hostId", "forgeJobId"])           // listJobFiles / sweep
  .index("by_host_job_path", ["hostId", "forgeJobId", "path"]),  // idempotency + upsert
```

**New `forgeArtifacts` table** (insert after `forgeFiles`):
```typescript
forgeArtifacts: defineTable({
  hostId:      v.string(),
  forgeJobId:  v.string(),
  path:        v.string(),
  kind:        v.string(),
  sizeBytes:   v.number(),
  textContent: v.optional(v.string()),       // text/HTML bytes (≤ ~1 MB string)
  storageId:   v.optional(v.id("_storage")), // image bytes (Convex File Storage)
  createdAt:   v.string(),
})
  .index("by_host_job",      ["hostId", "forgeJobId"])
  .index("by_host_job_path", ["hostId", "forgeJobId", "path"]),
```

**Key difference from `forgeLogChunks`:** No `seq` field — idempotency key is `path` not `(hostId, forgeJobId, seq)`. Two indexes: `by_host_job` (sweep/list) and `by_host_job_path` (upsert idempotency + artifact lookup). `createdAt` is an explicit ISO string (not relying on `_creationTime` for TTL, matching the `forgeJobs` / `forgeWorkspaces` convention).

---

### `convex/http.ts` — new `/forge-file-ingest` routes (MODIFY)

**Analog:** `convex/http.ts` lines 77–79 (Phase 81 `forgeLogIngest` route block)

**Import addition** (line 25 area — add alongside `forgeLogIngest`):
```typescript
import { forgeFileIngest } from "./forgeFileIngest";
```

**Route registration pattern** (lines 77–79):
```typescript
// Phase 81: Forge log ingest endpoint
http.route({ path: "/forge-log-ingest", method: "POST",    handler: forgeLogIngest });
http.route({ path: "/forge-log-ingest", method: "OPTIONS", handler: forgeLogIngest });
```

**New routes to add immediately after** (after line 79):
```typescript
// Phase 82: Forge file/artifact ingest endpoint
http.route({ path: "/forge-file-ingest", method: "POST",    handler: forgeFileIngest });
http.route({ path: "/forge-file-ingest", method: "OPTIONS", handler: forgeFileIngest });
```

---

### `convex/crons.ts` — new `sweep-forge-file-records` cron (MODIFY)

**Analog:** `convex/crons.ts` lines 111–116 (Phase 81 `sweep-forge-log-chunks`)

**Existing cron pattern** (lines 111–116):
```typescript
// Phase 81: Forge log retention (D-2)
crons.daily(
  "sweep-forge-log-chunks",
  { hourUTC: 3, minuteUTC: 30 },
  internal.forge.sweepForgeLogChunks,
);
```

**New cron to add immediately after** (offset by 30 minutes to avoid scheduler contention):
```typescript
// Phase 82: Forge file/artifact retention (D-05)
crons.daily(
  "sweep-forge-file-records",
  { hourUTC: 4, minuteUTC: 0 },
  internal.forge.sweepForgeFileRecords,
);
```

---

### `convex/forgeFileIngest.test.ts` (NEW — test, CRUD)

**Analog:** `convex/forgeLogIngest.test.ts` (lines 1–454) — clone structure, adapt 3 test groups

**Import pattern** (lines 1–18):
```typescript
import { describe, it, expect, vi } from "vitest";
import { validateForgeIngestAuth } from "./ingestAuth";
// New: import pure helpers from forge.ts
import {
  artifactByteSize,
  selectTtlDeletes,
  selectFileCapDeletes,
} from "./forge";
```

**Auth test group** (lines 20–85) — clone verbatim, change URL strings:
```typescript
// Change: "http://localhost/forge-log-ingest" → "http://localhost/forge-file-ingest"
// All 7 auth test cases are identical (validateForgeIngestAuth is shared)
```

**Body validation dispatch function** (lines 91–111) — adapt for file envelope:
```typescript
function simulateForgeFileIngestDispatch(body: any): DispatchResult {
  if (!body || typeof body !== "object") {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, files" } };
  }
  const { type, hostId, forgeJobId, files } = body;
  // DIFFERENCE: type === "files"; required: files array; NO seq check
  if (type !== "files" || !hostId || !forgeJobId || !Array.isArray(files)) {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, files" } };
  }
  return { status: 200, body: { ok: true } };
}
```

**Retention pure helpers test group** (lines 312–454) — clone structure, adapt for `artifactByteSize` / `selectFileCapDeletes`:
```typescript
// chunkByteSize tests → artifactByteSize tests (textContent.length vs sizeBytes)
// selectCapDeletes tests → selectFileCapDeletes tests (sizeBytes-based not lines-based)
// selectTtlDeletes tests → clone verbatim (same shape, same TTL logic)
```

**Additional test groups (NEW — no analog in forgeLogIngest.test.ts):**
```typescript
// Storage blob deletion test:
describe("retention sweep — blob delete ordering (D-05)", () => {
  it("storage.delete called BEFORE db.delete for image artifacts", ...);
  it("text artifacts deleted without storage.delete (no storageId)", ...);
});
```

---

### `src/components/forge/ForgeFilesPane.tsx` (NEW — component, request-response)

**Analog:** `src/components/forge/ForgeLogPane.tsx` (lines 1–114) — mirror loading/empty/data structure, remove auto-scroll logic

**Props pattern** (lines 28–31 of ForgeLogPane):
```typescript
// ForgeLogPane:
interface ForgeLogPaneProps {
  hostId: string;
  forgeJobId: string;
}
// ForgeFilesPane adds:
interface ForgeFilesPaneProps {
  hostId: string;
  forgeJobId: string;
  jobStatus: string;           // NEW: gate on terminal state (Pitfall 7)
  workspace: { rootPath: string };  // NEW: for VS Code deep links
}
```

**Terminal-state gate pattern** (add before data fetch — Pitfall 7):
```typescript
const TERMINAL_STATUSES = ["completed", "failed", "stopped"];
if (!TERMINAL_STATUSES.includes(jobStatus)) {
  return (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Files appear after the job completes.
    </div>
  );
}
```

**Loading/empty state pattern** (lines 91–95 of ForgeLogPane — mirror):
```typescript
// ForgeLogPane empty:
{chunks.length === 0 ? (
  <p className="text-sm text-muted-foreground text-center py-8">
    Waiting for logs&hellip;
  </p>
) : ...}

// ForgeFilesPane loading (raw === undefined):
// ForgeFilesPane empty (files.length === 0, terminal state):
{files === undefined ? (
  <LoadingState />
) : files.length === 0 ? (
  <p className="text-sm text-muted-foreground text-center py-8">
    No files found for this job.
  </p>
) : (
  <FileBrowser files={files} workspace={workspace} onSelectFile={setSelectedFile} />
)}
```

**SectionErrorBoundary wrap** (per CLAUDE.md + SPEC Req 11 — not in ForgeLogPane):
```typescript
// ForgeFilesPane itself does NOT wrap with SectionErrorBoundary
// — the boundary is applied by ForgeJobDetail at the call site:
// <SectionErrorBoundary name="Files"><ForgeFilesPane .../></SectionErrorBoundary>
```

**Container/layout pattern** (lines 81–113 of ForgeLogPane):
```typescript
// ForgeLogPane:
<div className="relative flex flex-col h-full overflow-hidden">
  <div
    ref={viewportRef}
    onScroll={handleScroll}
    className="flex-1 overflow-y-auto p-3 bg-background"
  >
// ForgeFilesPane: two-panel split (FileBrowser left + ArtifactPreview right)
<div className="flex h-full overflow-hidden">
  <div className="w-64 shrink-0 border-r border-border overflow-y-auto">
    <FileBrowser ... />
  </div>
  <div className="flex-1 overflow-hidden">
    {selectedFile ? <ArtifactPreview ... /> : <EmptyPreviewState />}
  </div>
</div>
```

---

### `src/components/forge/FileBrowser.tsx` (NEW — component port, request-response)

**Port source:** `C:\Users\mandr\forge\web\src\components\FileBrowser.tsx` (lines 1–364)

**Adaptations from port source:**

1. **Props interface change** (lines 276–291 of source):
```typescript
// Source uses: files: FileEntry[], workspace: Workspace, onSelectFile, currentPath, onNavigate
// CodePulse port uses: files: ForgeFileRow[] (from listJobFiles), workspace: { rootPath: string }
// Drop: onNavigate, currentPath (no folder drill-down per SPEC boundary)
// navEnabled is always false → dirs branch never renders
interface FileBrowserProps {
  files: ForgeFileRow[];    // from useForgeJobFiles
  workspace: { rootPath: string };
  onSelectFile?: (entry: ForgeFileRow) => void;
}
```

2. **Style replacement** — ALL `style={{...}}` props → Tailwind classes:
```typescript
// Source row: style={{ display:'flex', alignItems:'center', height:44, padding:'0 16px', gap:8 }}
// Port:       className="flex items-center h-11 px-4 gap-2 cursor-pointer border-b border-border"

// Source kind header: style={{ padding:'6px 16px 4px', fontSize:12, fontWeight:600, color:'#94A3B8', ... }}
// Port: className="px-4 pt-1.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest font-mono bg-card"
```

3. **`entry.name` → `entry.path`** — source uses bare filename; CodePulse has relative path from Convex:
```typescript
// Source: key={entry.name}, display: {entry.name}
// Port:   key={entry.path}, display: {entry.path}  (text node — never innerHTML)
```

4. **`<a href="#">` removal for non-text rows** (lines 111–132 of source) — replace with text node:
```typescript
// Source: <a href={isText ? vsCodeHref : '#'} onClick={...}>{entry.name}</a>
// Port:   <span className="flex-1 text-sm text-foreground truncate">{entry.path}</span>
// VS Code link stays as <a href={vsCodeHref}> on all kinds (D-04a: "always show")
```

5. **VS Code link** — per D-04a, show for ALL previewable kinds (not just text):
```typescript
// Source: {isText && vsCodeHref && <a...>}
// Port: all kinds show VS Code link (labeled best-effort per UI-SPEC)
const vsCodeHref = buildVsCodeHref(workspace.rootPath, entry.path);
```

6. **Empty state copy** (lines 316–328 of source):
```typescript
// Source: 'This workspace has no files yet. Files appear here after the job completes.'
// Port: 'No files found for this job.'
// (terminal-state gate in ForgeFilesPane handles the "running job" copy)
```

7. **Drop navigation rows** (UpRow, FoldersGroup, dirs filtering) — not rendered when `onNavigate` absent.

8. **ScrollArea** — source uses `ScrollArea` from `@/components/ui/scroll-area`; keep import (already in project).

---

### `src/components/forge/ArtifactPreview.tsx` (NEW — component port, request-response)

**Port source:** `C:\Users\mandr\forge\web\src\components\ArtifactPreview.tsx` (lines 1–284)

**Adaptations from port source:**

1. **Remove `buildArtifactUrl` / `getForgeConfig()`** (lines 59–66, 188–189 of source) — data comes from props, not `http://127.0.0.1`:
```typescript
// Source: const { artifactPort } = getForgeConfig(); const artifactUrl = buildArtifactUrl(...)
// Port: no URL construction — textContent and imageUrl arrive as props from Convex query
```

2. **New props interface** (replacing lines 35–53 of source):
```typescript
interface ArtifactPreviewProps {
  textContent?: string;    // text/HTML bytes from forgeArtifacts.textContent
  imageUrl?: string;       // Convex File Storage URL from ctx.storage.getUrl
  fileKind: string;        // from forgeFiles.kind
  sizeBytes: number;       // from forgeFiles.sizeBytes
  rootPath: string;        // from workspace.rootPath for VS Code deep link
  filePath: string;        // from forgeFiles.path
  defaultMode?: "preview" | "source";
}
```

3. **iframe src → `data:` URI** (SECURITY INVARIANT — lines 139 of source):
```typescript
// Source: <iframe src={artifactUrl} sandbox="allow-scripts" .../>
// Port:   const dataSrc = `data:text/html;charset=utf-8,${encodeURIComponent(textContent)}`;
//         <iframe src={dataSrc} sandbox="allow-scripts" title="Artifact preview" .../>
// IMMUTABLE: sandbox MUST be exactly "allow-scripts" — never add allow-same-origin
```

4. **Source mode — no async fetch** (lines 86–100 of source) — remove `switchToSource`, `fetchedSource`, `isFetching`:
```typescript
// Source: async function switchToSource() { fetch(artifactUrl)... }
// Port:   simple toggle — textContent is already in props (eager push, D-01)
const [mode, setMode] = useState<"preview" | "source">(defaultMode ?? "preview");
// Source: {fetchedSource ?? ''}  →  Port: {textContent ?? ''}
```

5. **Image rendering** (lines 202–212 of source):
```typescript
// Source: <img src={artifactUrl} alt={filePath} style={{...}} />
// Port:   <img src={imageUrl} alt={filePath} className="max-w-full max-h-[80vh] block" />
// imageUrl = Convex File Storage URL (permanent public URL — accepted per D-02a)
```

6. **Not-previewable fallback** (new — replaces video/audio/pdf/binary branches for cloud path):
```typescript
// video, audio, pdf, binary (and >1 MB files): show fallback card
const NOT_PREVIEWABLE_KINDS = ["video", "audio", "pdf", "binary"];
if (NOT_PREVIEWABLE_KINDS.includes(fileKind) || (!textContent && !imageUrl)) {
  return (
    <div className="p-4 text-sm text-muted-foreground">
      <p>Not previewable in cloud ({formatBytes(sizeBytes)} / {fileKind})</p>
      <p className="font-mono text-xs mt-2">{rootPath}/{filePath}</p>
      <a href={`vscode://file/${rootPath}/${filePath}`} className="text-blue-500 text-xs mt-1 inline-flex items-center gap-1">
        Open in VS Code <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
      <p className="text-[10px] mt-1 text-muted-foreground/60">(same-machine only)</p>
    </div>
  );
}
```

7. **Style replacement** — ALL `style={{...}}` → Tailwind:
```typescript
// Source HtmlPreview toggle bar: style={{ display:'flex', gap:4, padding:'8px 16px', ... }}
// Port: className="flex gap-1 p-2 px-4 border-b border-border bg-card shrink-0"

// Source pre: style={{ fontFamily: 'ui-monospace...', fontSize:13, lineHeight:1.538, ... }}
// Port: className="m-0 p-4 font-mono text-[13px] leading-[1.538] text-foreground bg-background overflow-auto h-full whitespace-pre-wrap"
```

8. **Lucide imports** (source uses none — port uses `ExternalLink` from `lucide-react`).

---

### `src/components/forge/ForgeJobDetail.tsx` — Files tab addition (MODIFY)

**Analog:** `src/components/forge/ForgeJobDetail.tsx` lines 49–51 + 152–185 (read in full above)

**Tab type extension** (line 50):
```typescript
// Before:
type DetailTab = "details" | "logs";
// After:
type DetailTab = "details" | "logs" | "files";
```

**Tab strip button addition** (lines 152–173 — add "Files" button after "Logs" button, same className pattern):
```typescript
// Existing Logs button pattern (lines 164–173):
<button
  onClick={() => setActiveTab("logs")}
  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
    activeTab === "logs"
      ? "border-emerald-500 text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`}
>
  Logs
</button>
// New Files button — add immediately after, same pattern:
<button
  onClick={() => setActiveTab("files")}
  className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
    activeTab === "files"
      ? "border-emerald-500 text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  }`}
>
  Files
</button>
```

**Tab body conditional render** (lines 177–185 — add `files` branch):
```typescript
// Existing (lines 177–185):
<div className="flex-1 overflow-hidden">
  {activeTab === "details" ? (
    <div className="h-full overflow-y-auto"><ForgeMetadataPanel job={job} /></div>
  ) : (
    <ForgeLogPane hostId={job.hostId} forgeJobId={job.id} />
  )}
</div>
// New three-way branch:
<div className="flex-1 overflow-hidden">
  {activeTab === "details" ? (
    <div className="h-full overflow-y-auto"><ForgeMetadataPanel job={job} /></div>
  ) : activeTab === "logs" ? (
    <ForgeLogPane hostId={job.hostId} forgeJobId={job.id} />
  ) : (
    <SectionErrorBoundary name="Files">
      <ForgeFilesPane
        hostId={job.hostId}
        forgeJobId={job.id}
        jobStatus={job.status}
        workspace={{ rootPath: job.rootPath ?? "" }}
        // NOTE (A7): rootPath may need lookup via useQuery(api.forge.listWorkspaces)
        // if not available on ForgeJobRow — verify at implementation time
      />
    </SectionErrorBoundary>
  )}
</div>
```

**New imports to add:**
```typescript
import { ForgeFilesPane } from "./ForgeFilesPane";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
```

---

### `src/hooks/useForge.ts` — `useForgeJobFiles` + `useForgeJobArtifact` hooks (MODIFY)

**Analog:** `src/hooks/useForge.ts` lines 289–301 (`useForgeJobLogs`) — read in full above

**Existing hook pattern** (lines 289–301):
```typescript
export function useForgeJobLogs(
  hostId: string | null,
  forgeJobId: string | null
): ForgeLogChunk[] {
  const raw = useQuery(
    api.forge.listJobLogs,
    hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
  );
  return useMemo(
    () => (raw === undefined ? [] : raw.map(adaptLogChunk)),
    [raw]
  );
}
```

**New hook — `useForgeJobFiles`** (copy pattern verbatim, adapt function/type names):
```typescript
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
```

**New hook — `useForgeJobArtifact`** (artifact accessor — no `useMemo` needed, not an array):
```typescript
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

**Critical:** `useMemo` wrapper is REQUIRED on `useForgeJobFiles` (same reason as `useForgeJobLogs` — Phase 80 lesson: raw.map allocates a fresh array every render; without useMemo this causes referential instability and potential "Maximum update depth exceeded" under reactive live data).

---

### `forge/src/emit/codepulse-emitter.ts` — `emitFiles` + `buildFilesPayload` addition (MODIFY, cross-repo)

**Analog 1:** `forge/src/emit/codepulse-emitter.ts` lines 138–196 (`emitJob` function)
**Analog 2:** `forge/src/emit/log-forwarder.ts` lines 241–275 (`makeLogSink`) — for separate gate env var pattern

**Existing `EmitCfg` seam** (lines 30–39 of emitter — reuse verbatim, no changes):
```typescript
export interface EmitCfg {
  ingestUrl: string | undefined;  // base URL; /forge-ingest is appended for emitJob
  apiKey: string | undefined;
  hostId: string;
  fetchImpl?: typeof fetch;
}
```

**Separate gate pattern** (from `log-forwarder.ts` lines 214–219):
```typescript
// FORGE_LOG_INGEST_URL is the separate gate for log forwarding
ingestUrl: process.env['FORGE_LOG_INGEST_URL'],
// Mirror: FORGE_FILE_INGEST_URL is the separate gate for file/artifact forwarding
// (store full endpoint URL: https://deployment.convex.site/forge-file-ingest)
fileIngestUrl: process.env['FORGE_FILE_INGEST_URL'],
```

**New payload interfaces** (after `ForgeIngestWorkspacesPayload` at line 221):
```typescript
export interface ForgeFileEntry {
  path:      string;   // relative path within workspace
  kind:      string;   // "text"|"image"|"video"|"audio"|"pdf"|"binary"
  sizeBytes: number;
}

export interface ForgeArtifactEntry {
  path:        string;
  kind:        string;
  sizeBytes:   number;
  textContent?: string;    // text/HTML content (≤ PER_FILE_BYTE_CAP bytes)
  imageBase64?: string;    // image bytes base64-encoded for JSON transport
}

export interface ForgeFilesPayload {
  type:       'files';
  hostId:     string;
  forgeJobId: string;
  files:      ForgeFileEntry[];
  artifacts:  ForgeArtifactEntry[];
}
```

**`emitFiles` function** (mirror `emitJob` lines 138–196 exactly — same fire-and-forget discipline):
```typescript
export async function emitFiles(
  cfg: EmitCfg & { fileIngestUrl?: string },
  job: Job,
  files: ForgeFileEntry[],
  artifacts: ForgeArtifactEntry[],
): Promise<void> {
  const { fileIngestUrl, apiKey, hostId, fetchImpl = fetch } = cfg;
  // Separate gate: FORGE_FILE_INGEST_URL (not ingestUrl)
  if (!fileIngestUrl || !apiKey) return;

  const payload: ForgeFilesPayload = buildFilesPayload(hostId, job, files, artifacts);
  // fileIngestUrl is the FULL URL (convention from FORGE_LOG_INGEST_URL: full path stored)
  const url = fileIngestUrl;

  // Same retry loop as emitJob (lines 148–194) — verbatim copy
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) { ... }
}
```

**Path-traversal guard pattern** (from `forge/src/http/routes/artifact.ts` lines 110–148):
```typescript
// Reuse verbatim on the enumeration side — apply before reading file bytes:
import { guardPath, PathTraversalError } from '../workspace/manager.js';
import { kindTag } from '../workspace/kinds.js';

try {
  absPath = guardPath(workspace.rootPath, ...relativeParts);
} catch (err) {
  if (err instanceof PathTraversalError) continue; // skip this entry
  throw err;
}
// Then symlink/junction escape check:
const realPath = fs.realpathSync.native(absPath);
const realRoot = fs.realpathSync.native(workspace.rootPath);
if (!realPath.toLowerCase().startsWith(realRoot.toLowerCase() + path.sep.toLowerCase())) {
  continue; // symlink escape — skip
}
```

---

## Shared Patterns

### Authentication (bearer token)

**Source:** `convex/ingestAuth.ts` — `validateForgeIngestAuth` (lines 88–97) + `unauthorizedResponse` (lines 100–108)
**Apply to:** `convex/forgeFileIngest.ts` (same key `FORGE_INGEST_API_KEY`, reuse verbatim)

```typescript
// validateForgeIngestAuth: fails closed when FORGE_INGEST_API_KEY is unset
// (unlike validateIngestAuth which is permissive when unset)
export function validateForgeIngestAuth(request: Request): boolean {
  const expectedKey = _env.FORGE_INGEST_API_KEY;
  if (!expectedKey) {
    return _env.FORGE_INGEST_ALLOW_ANON === "true";  // explicit opt-in only
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```

### CORS headers

**Source:** `convex/ingestAuth.ts` — `getCorsHeaders` (lines 63–65) / `getCorsHeadersWithAllowlist` (lines 35–57)
**Apply to:** `convex/forgeFileIngest.ts` (same allowlist read from `CODEPULSE_ALLOWED_ORIGIN`)

OPS-01 note: `getCorsHeaders` already reads `CODEPULSE_ALLOWED_ORIGIN` at module init. Setting it in the Convex cloud deployment is the only step needed for production CORS — no code change.

### Fire-and-forget emitter discipline

**Source:** `forge/src/emit/codepulse-emitter.ts` lines 138–196 (`emitJob`)
**Apply to:** `forge/src/emit/codepulse-emitter.ts` — new `emitFiles` function

Pattern: no-op when env gate unset → retry loop (MAX_ATTEMPTS=3, exp backoff 200ms/400ms) → 4xx drop-and-log (auth 401/403: once-per-process via `loggedAuthStatuses`) → 5xx retry → exhaust and drop silently → NEVER throws, NEVER logs apiKey.

### Hook referential stability (useMemo)

**Source:** `src/hooks/useForge.ts` lines 296–300 (comment at 280–288)
**Apply to:** `useForgeJobFiles` in `src/hooks/useForge.ts`

```typescript
return useMemo(
  () => (raw === undefined ? [] : raw.map(adaptFileEntry)),
  [raw]
);
```

Phase 80 lesson: raw.map allocates a fresh array every render; without useMemo, a reactive query delivering live updates causes referential instability and "Maximum update depth exceeded" errors.

### SectionErrorBoundary wrapping

**Source:** per `CLAUDE.md` project guidelines + SPEC Req 11
**Apply to:** Files tab body in `ForgeJobDetail.tsx` (wraps `<ForgeFilesPane>`)

```typescript
<SectionErrorBoundary name="Files">
  <ForgeFilesPane ... />
</SectionErrorBoundary>
```

### iframe sandbox invariant (IMMUTABLE — WSP-03)

**Source:** `forge/web/src/components/ArtifactPreview.tsx` lines 137–148 (comment + iframe)
**Apply to:** `src/components/forge/ArtifactPreview.tsx`

`sandbox="allow-scripts"` — exactly this string, nothing else. Adding `allow-same-origin` permits the framed content to access the parent origin's DOM/cookies. `data:` URI origin is null (opaque); sandbox preserves null-origin isolation without network round-trip.

### Text-as-React-text-node (XSS prevention)

**Source:** `src/components/forge/ForgeLogPane.tsx` lines 97–100 (security note + JSX)
**Apply to:** `src/components/forge/ArtifactPreview.tsx` (Source view `<pre>`), `src/components/forge/FileBrowser.tsx` (filenames/paths)

```typescript
// ForgeLogPane pattern (line 100): {line} — React child, never innerHTML
// ArtifactPreview Source: <pre>{textContent}</pre> — auto-escaped
// FileBrowser filenames: <span>{entry.path}</span> — auto-escaped
```

### Convex File Storage blob delete ordering (D-05 CRITICAL)

**Source:** `convex/forge.ts` lines 579–617 (`sweepForgeLogChunks` shape) — extended
**Apply to:** `convex/forge.ts` `sweepForgeFileRecords` + `upsertArtifact` (overwrite case)

```typescript
// CRITICAL: storage.delete BEFORE db.delete — blob leak is permanent without GC
if (artifact.storageId) {
  await ctx.storage.delete(artifact.storageId);  // blob first
}
await ctx.db.delete(artifact._id);               // then doc row
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `docs/forge-deploy-checklist.md` | doc | — | No deploy checklist docs exist in the repo; structural markdown. Content should list: `CODEPULSE_ALLOWED_ORIGIN`, `FORGE_INGEST_API_KEY`, `CONVEX_FORGE_INGEST_URL`, `FORGE_LOG_INGEST_URL`, `FORGE_FILE_INGEST_URL`, `FORGE_INGEST_ALLOW_ANON` with purpose/required/default columns. OPS-01 scope. |

---

## Verification Notes (Analog Accuracy)

All named analogs verified against live file contents. Discrepancies from RESEARCH.md:

1. **`forgeLogIngest.test.ts` exports `chunkByteSize` / `selectTtlDeletes` / `selectCapDeletes`** — confirmed imported from `./forge` at lines 308–311. These pure helpers ARE exported from `convex/forge.ts` (verified lines 536, 548, 561). The new `forgeFileIngest.test.ts` will import `artifactByteSize` and `selectFileCapDeletes` from the same module (to be added).

2. **`codepulse-emitter.ts` `EmitCfg.ingestUrl`** — currently the base URL for `/forge-ingest`. For `emitFiles`, the pattern should use a **full endpoint URL** stored in `FORGE_FILE_INGEST_URL` (mirroring `FORGE_LOG_INGEST_URL` from `log-forwarder.ts` line 216 which stores full path, not base URL). The emitter's existing `ingestUrl` appends `/forge-ingest` (line 146) — `emitFiles` should NOT reuse this field; it needs its own `fileIngestUrl` param storing the full `/forge-file-ingest` URL to avoid the double-path Pitfall 5.

3. **`ForgeJobDetail.tsx` `job.id` vs `job.forgeJobId`** — the component passes `forgeJobId={job.id}` to `ForgeLogPane` (line 183), confirming `ForgeJobRow.id` maps to the Convex `forgeJobId`. Verified live; use `job.id` not `job.forgeJobId` in `ForgeFilesPane` props.

4. **`forge/web/src/components/FileBrowser.tsx` uses `entry.name` (bare filename), NOT `entry.path`** — confirmed at lines 129, 93. CodePulse port receives relative `path` from Convex `listJobFiles`. All `entry.name` references must be replaced with `entry.path`.

5. **`forge/web/src/components/ArtifactPreview.tsx` uses async fetch for Source mode** (lines 86–100) — confirmed. CodePulse port removes this entirely; `textContent` arrives in props via eager push (D-01). The `HtmlPreview` sub-component's async `switchToSource` function and `fetchedSource`/`isFetching` state are deleted.

---

## Metadata

**Analog search scope:** `convex/`, `src/components/forge/`, `src/hooks/`, `C:\Users\mandr\forge\src\emit\`, `C:\Users\mandr\forge\web\src\components\`, `C:\Users\mandr\forge\src\http\routes\`
**Files scanned:** 12 source files read in full
**Pattern extraction date:** 2026-06-17
