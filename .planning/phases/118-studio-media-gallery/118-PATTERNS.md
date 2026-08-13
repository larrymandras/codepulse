# Phase 118: Studio Media Gallery - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 20 (new/modified)
**Analogs found:** 18 / 20 (2 have no analog: `hooks/studioWatch.mjs`'s directory-walk+hash core,
and the OpenArt MCP-probe discovery task — both flagged below rather than force-fit)

Every analog cited below was opened and read in this session (2026-08-13). Where RESEARCH.md's
claim about a file did not hold exactly, the correction is noted inline.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/schema.ts` (+`media`,`mediaStyles`,`mediaModels`) | model (table def) | CRUD | `convex/schema.ts:2339` (`pipelineRuns`) + `:2393` (`workspaceSnapshots`) | exact |
| `convex/ingestAuth.ts` (+`validateStudioAuth`) | middleware (auth) | request-response | `validateLoomAuth` (`convex/ingestAuth.ts:149-156`) | exact |
| `convex/studioHttp.ts` (new) | controller (http) | request-response | `convex/loomHttp.ts` (shape) + `convex/workspaceHttp.ts` (validation depth — see note) | exact (shape) |
| `convex/http.ts` (+1 route) | route registration | request-response | `convex/http.ts:137-139` (`/loom/event`) | exact |
| `convex/media.ts` (new — queries + public `mutation`s + `internalMutation`s) | service/model split | CRUD | `convex/loom.ts:140-167` (internalMutation half) + `convex/avatars.ts` (public-mutation half) | exact (split, see Pitfall 4) |
| `convex/media.ts`'s janitor (`internalMutation`, batch-capped) | service (batch) | batch | `convex/retention.ts:206-351` (`pruneBatchV3`) — copy the shape; `convex/forge.ts:1828-1877` (`sweepForgeFileRecords`) — anti-pattern, do not copy | exact positive / exact negative |
| `convex/retention.ts` (+D-03 exemption comment, NO new key) | config/doc | — | `convex/retention.ts:126-142` (Phase 116 `prompts` exemption block) | exact |
| `hooks/studioWatch.mjs` (new) — POST-with-bearer half | utility (host script) | request-response | `hooks/ingestPost.mjs:31-73` (never-throw shape) / `hooks/loom-emit.mjs` (fail-loud CLI shape) | exact (POST half only) |
| `hooks/studioWatch.mjs` — dir-walk + SHA-256 + dedup half | utility (host script) | file-I/O | **no analog** — see "No Analog Found" | none |
| `hooks/__tests__/studioWatch.test.mjs` (new) | test | — | `hooks/__tests__/ingestPost.test.mjs` (POST-half conventions); no analog for the hash/dedup half | partial |
| `scripts/install-studio-watch-task.ps1` (new, 5-min repeat) | config (scheduled task) | event-driven | `scripts/install-workspace-scan-task.ps1` — guards/launcher verbatim; trigger shape differs (daily vs 5-min repeat) — see note | role-match |
| `scripts/run-studio-watch.ps1` (new) | utility (wrapper) | file-I/O | `scripts/run-workspace-scan.ps1` | exact |
| `scripts/install-media-vault-backup-task.ps1` (new, nightly robocopy) | config (scheduled task) | batch | `scripts/install-workspace-scan-task.ps1` (guards/launcher; daily trigger IS the right shape here, unlike the watcher) | exact |
| `src/pages/Studio.tsx` (new) | component (page) | request-response (useQuery) | `src/pages/Galdr.tsx` (filter-chip/search/error-boundary skeleton) + `src/pages/Bifrost.tsx` (archive/no-modal-confirm pattern) | exact (composite) |
| `src/pages/Studio.tsx`'s masonry grid | component | — | **no analog** — CONTEXT.md's claim confirmed: zero hits for `masonry`/`columns-`/`Masonry` anywhere in `src/` | none (by design, CSS-only) |
| `src/pages/Studio.tsx`'s detail Sheet | component | — | `src/components/galdr/PromptEditorDrawer.tsx:188-339` (Sheet shape, SheetFooter actions row) | exact |
| `src/App.tsx` (+`/studio` route) | route | — | existing `/galdr`, `/bifrost` route entries (not separately excerpted — trivial one-line addition) | exact |
| `src/lib/navRegistry.ts` (+`images` icon, +COMMAND entry) | config (nav) | — | `src/lib/navRegistry.ts:98-100` (icon map), `:135` (Bifröst COMMAND entry) | exact |
| `convex/media.test.ts` (new) | test | — | `convex/workspaceHttp.test.ts` (control-first, auth-gate, field-validation test shape — closest full test file in repo, see note) | role-match |
| `convex/studioHttp.test.ts` (new) | test | — | `convex/workspaceHttp.test.ts` (same file — the auth-gate `describe` block specifically) | role-match |
| `e2e/studio.spec.ts` (new) | test (e2e) | — | `e2e/bifrost.spec.ts` (live-Convex-data reachability + control-pair assertion pattern) | exact |

---

## Pattern Assignments

### `convex/schema.ts` — `media`, `mediaStyles`, `mediaModels` tables

**Analog:** `convex/schema.ts:2339-2355` (`pipelineRuns`) and `:2393-2419` (`workspaceSnapshots`)

**Table-definition style to copy** (`convex/schema.ts:2339-2355`):
```typescript
pipelineRuns: defineTable({
  pipelineSlug: v.string(),
  status: v.string(), // "running" | "complete" | "error"
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  currentStep: v.optional(v.string()),
  stepEvents: v.array(
    v.object({
      stepId: v.string(),
      event: v.string(), // start | action | complete | error | warn
      text: v.optional(v.string()),
      at: v.number(),
    })
  ),
})
  .index("by_pipelineSlug", ["pipelineSlug"])
  .index("by_startedAt", ["startedAt"]),
```
Note the house convention visible in both donors: a leading doc-comment block naming the phase
and decision IDs, string-literal enums documented inline (`// "running" | "complete" | "error"`),
and an index per query access pattern (`media` will need `by_hash` for D-05/D-06 dedup lookup and
`by_deletedAt`/`by_createdAt` for the Gallery/Trash tab queries).

**`workspaceSnapshots`'s versioned-pointer-last contract** (`convex/schema.ts:2393-2419`) is a
useful secondary reference for the comment-density expectation on a new table, but `media` itself
is closer in shape to a plain row table (like `pipelineRuns`) than to `workspaceSnapshots`'s
meta-row/entity-row split — do not copy the version-pointer machinery, it solves a different
problem (large per-scan payloads) than Studio has.

---

### `convex/ingestAuth.ts` — add `validateStudioAuth`

**Analog:** `validateLoomAuth`, `convex/ingestAuth.ts:139-156`

```typescript
/**
 * Phase 119 (Loom) D-03. Fourth member of the same family, structurally
 * identical to the three above — same fail-closed shape, same explicit
 * ALLOW_ANON opt-in, same plain `===` comparison for the reason stated above.
 */
export function validateLoomAuth(request: Request): boolean {
  const expectedKey = _env.LOOM_API_KEY;
  if (!expectedKey) {
    return _env.LOOM_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```
Add `validateStudioAuth` as the 5th member of this family (checking `STUDIO_API_KEY` /
`STUDIO_ALLOW_ANON`), byte-for-byte the same shape. `unauthorizedResponse()` at the bottom of the
file (`:162-167`) is shared — no new 401 helper needed.

---

### `convex/studioHttp.ts` (new) — bearer-gated ingest route

**Analog:** `convex/loomHttp.ts` (full file, 74 lines) for the shape; `convex/workspaceHttp.ts` (not
opened this session, but its test file below shows it does deeper field validation than
`loomHttp.ts`) for the depth of body/field validation Studio's richer ingest payload will need.

**Shape to copy exactly** (`convex/loomHttp.ts:1-26,37-73`):
```typescript
/**
 * D-04: agent/CLI only. No CORS headers and no OPTIONS partner, deliberately
 * unlike the ingest route pairs elsewhere in convex/http.ts. The browser never
 * calls this; it reads through subscriptions.
 */
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { validateLoomAuth, unauthorizedResponse } from "./ingestAuth";

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const loomEventPostHandler = async (ctx: any, request: Request) => {
  if (!validateLoomAuth(request)) return unauthorizedResponse();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }
  // ... field checks, each a `if (!x) return jsonResponse({error:"MISSING_FIELD",field:"x"},400)`

  const result = await ctx.runMutation(internal.loom.recordStepEvent, { /* ... */ });
  if (!result?.ok) {
    const status = result?.error === "UNKNOWN_PIPELINE" ? 404 : 400;
    return jsonResponse({ error: result?.error ?? "REFUSED" }, status);
  }
  return jsonResponse({ ok: true, runId: result.runId }, 200);
};

export const loomEventPost = httpAction(loomEventPostHandler);
```

**Critical structural point (why the plain-handler / httpAction split matters):** export the
plain async function (`studioIngestPostHandler`) SEPARATELY from the `httpAction(...)`-wrapped
constant. `convex/workspaceHttp.test.ts:1-8`'s own docstring states why: "an httpAction-wrapped
value cannot be invoked from vitest." `studioHttp.test.ts` must drive the plain handler with a
mock `ctx` and a real `Request`, exactly like `workspaceIngestPostHandler` is tested.

**Route registration** (`convex/http.ts:137-139`):
```typescript
// Phase 119 Loom (D-02/D-04). One emit route, agent/CLI only — no OPTIONS
// partner and no CORS headers, same boundary as the /galdr routes above.
http.route({ path: "/loom/event", method: "POST", handler: loomEventPost });
```
Add `import { studioIngestPost } from "./studioHttp";` and one line:
`http.route({ path: "/studio/ingest", method: "POST", handler: studioIngestPost });` — no OPTIONS
partner, matching the D-15/119-D-04 precedent stated explicitly in the surrounding comment block
at `http.ts:126-131,137-139`.

---

### `convex/media.ts` (new) — the `internalMutation`/`mutation` split

**Analog A (internalMutation half):** `convex/loom.ts:140-167`
```typescript
/**
 * `internalMutation`, not `mutation` (v14.0 audit INT-03) — a plain `mutation`
 * lands in the client-callable `api.` namespace, so any holder of the shipped
 * `VITE_CONVEX_URL` could upsert a pipeline straight from devtools, bypassing
 * `validateLoomAuth` in loomHttp.ts entirely.
 */
export const upsertPipeline = internalMutation({
  args: { /* ... */ },
  handler: async (ctx, args) => upsertPipelineHandler(ctx, args, Date.now()),
});
```
Apply this exact rationale-comment to `ingestMedia`, the storage `generateUploadUrl` wrapper, and
the janitor's permanent-delete mutation.

**Analog B (public-mutation half, and the storage round-trip itself):** `convex/avatars.ts:63-85`
(full file read; this is the ONLY existing `ctx.storage` usage in the repo, confirming RESEARCH.md's
claim exactly):
```typescript
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveImage = mutation({
  args: { id: v.id("avatars"), storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { imageStorageId: args.storageId });
  },
});

export const getImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```
**D-01 note:** `avatars.ts`'s `generateUploadUrl`/`saveImage` are plain `mutation`s (browser
callable) because avatars are edited from the UI. Studio's equivalent must be `internalMutation`
per Pitfall 4 — the watcher calls it via the bearer-gated route, the browser never does. Copy the
`ctx.storage.*` API calls verbatim; change the `mutation`/`query` wrapper to `internalMutation`/
`internalQuery` (the getUrl-resolving read can stay a plain `query` since it's read-only and part
of the gallery's public `list` query output — see Pattern 4 below).

**`toggleStar`/`softDelete`/`restore` — the genuinely-public-mutation surface.** No repo analog
exists for a browser-writable mutation on a curated media-style table (Galdr's `toggleFavorite`
is the closest shape, structurally):
```typescript
// Shape to follow, not a literal quote — convex/galdr.ts's toggleFavorite (referenced via
// src/pages/Galdr.tsx:281's useMutation(api.galdr.toggleFavorite) call site):
// a plain `mutation`, args: { promptId: v.id("prompts") }, single ctx.db.patch call.
```

---

### The D-08 janitor — batch-capped, cursor-seeked, self-rescheduling

**Positive analog:** `convex/retention.ts:206-351` (`pruneBatchV3`, full read). Key excerpt
(`:249-263`):
```typescript
const batch = await ctx.db
  .query(table as any)
  .withIndex("by_creation_time", (q: any) =>
    q.gte("_creationTime", cursorMs).lt("_creationTime", cutoffMs)
  )
  .order("asc")
  .take(BATCH_SIZE); // 200

const { toDelete, lastCreationTime } = partitionBatchForPrune(batch, PRUNE_PREDICATES[table]);
for (const doc of toDelete) {
  await ctx.db.delete(doc._id);
}
```
Reschedule via `ctx.scheduler.runAfter(RESCHEDULE_DELAY_MS, internal.retention.pruneBatchV3, {...})`
when a batch is full, carrying the cursor forward — never `.collect()`.

**Negative analog (do NOT copy this shape):** `convex/forge.ts:1828-1877` (`sweepForgeFileRecords`,
full read, confirms RESEARCH.md's claim exactly):
```typescript
export const sweepForgeFileRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Pass 1: TTL — collect artifact records older than 7 days and delete them.
    const allArtifacts = await ctx.db.query("forgeArtifacts").collect(); // <-- UNBATCHED
    const artifactTtlDeletes = selectFileTtlDeletes(allArtifacts, now);
    for (const artifact of artifactTtlDeletes) {
      if (artifact.storageId) {
        await ctx.storage.delete(artifact.storageId); // blob FIRST (D-05) — KEEP this ordering
      }
      await ctx.db.delete(artifact._id);
    }
```
The blob-first-then-row-delete ORDERING (`ctx.storage.delete(artifact.storageId)` before
`ctx.db.delete(artifact._id)`) is correct and matches D-08's own requirement ("the blob is *not*
deleted at soft-delete time... 30-day janitor then deletes the file and its thumb blob together").
Keep that ordering; discard the unbatched `.collect()` for the janitor's own read shape — copy
`pruneBatchV3`'s cursor-seeked batching instead. This is the exact defect class documented in the
Convex-mutation-4,096-read-limit memory and RESEARCH.md's Pitfall 2.

---

### `convex/retention.ts` — D-03 exemption comment (no new `RETENTION_DAYS` key)

**Analog:** the Phase 116 `prompts` exemption block, `convex/retention.ts:126-142`:
```typescript
// Phase 116 D-13: `prompts` is deliberately EXEMPT from RETENTION_DAYS — do
// not add it as a key here. Every other new table above was bounded
// pre-emptively because it is a firehose ...; a curated Galdr prompt library
// is the opposite of a firehose, and a 90-day window would silently delete
// a prompt for the sole offence of going a quarter unused.
// `promptVersions` — the table that actually grows — IS bounded, but by a
// different mechanism: newest-20-per-prompt, pruned inline in
// convex/galdr.ts's save/restore mutations, keyed by edit frequency rather
// than calendar age.
// Do NOT "fix" this by adding `prompts` or `promptVersions` here: it would
// be syntactically valid and would pass retention.test.ts's table-existence
// check, but is semantically wrong — pruneBatchV3 deletes by `_creationTime`
// cutoff across the WHOLE table, so it would delete versions of
// actively-edited prompts exactly as readily as abandoned ones.
```
Add an equivalent block immediately after it (CONTEXT.md's own discretion note: "follows the D-13
comment block verbatim in style") naming `media`, `mediaStyles`, `mediaModels`, and stating the
D-08 janitor is what bounds `media`'s growth instead of `RETENTION_DAYS`.

---

### `hooks/studioWatch.mjs` (new) — POST half

**Analog A (never-throw POST helper):** `hooks/ingestPost.mjs:31-73`, full file:
```javascript
export async function postSnapshot(endpointUrl, ingestKey, body, deps = {}) {
  const { timeoutMs = 3000, logPrefix = "codepulse-scanner", fetchImpl = fetch } = deps;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { "Content-Type": "application/json" };
    if (ingestKey) headers["Authorization"] = `Bearer ${ingestKey}`;
    else console.warn(`[${logPrefix}] no ... set — posting unauthenticated (server may reject)`);
    const resp = await fetchImpl(endpointUrl, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
    if (!resp.ok) { console.error(...); return { ok: false, status: resp.status }; }
    return { ok: true, status: resp.status };
  } catch (err) {
    console.error(`[${logPrefix}] ${pathname} failed: ${err.message}`);
    return { ok: false, status: null };
  } finally { clearTimeout(timeout); }
}
```

**Analog B (fail-LOUD CLI shape — the better model for a scheduled-task invocation, per
RESEARCH.md):** `hooks/loom-emit.mjs`, full file (167 lines). Key excerpts:
```javascript
/** Self-hosted Convex HTTP-ACTIONS port. NOT 3210, which is the backend API. */
const DEFAULT_BASE_URL = "http://127.0.0.1:3211";
const TIMEOUT_MS = 10_000;
// Exit codes: 0 ok · 2 configuration · 3 transport/server · 4 refusal
function die(code, message) {
  console.error(`loom-emit: ${message} (base URL: ${baseUrl})`);
  process.exit(code);
}
// ... AbortController + setTimeout(..., TIMEOUT_MS) around fetch, exactly like ingestPost.mjs
// but re-throwing via die() instead of swallowing.
main().catch((err) => die(3, `unexpected error: ${err.message}`));
```
No shebang (both donors omit it deliberately — DEBT-05, documented at `hooks/ingestPost.mjs:9-12`
and `hooks/scanner.mjs:5-10`: Vite/Rolldown's SSR module transform used by
`hooks/__tests__/*.test.mjs` hoists imports above line 1, and a shebang there breaks parsing).

Env-var-first resolution order (`hooks/loom-emit.mjs:16-24,56-76`): `process.env.X` → a
`<homedir>/.claude/skills/<name>/.env` file (parsed by hand-rolled regex, `readEnvFile()`) → a
hardcoded default (URL only, never the key). Copy this exact three-tier order for
`STUDIO_API_KEY`/`CODEPULSE_URL`.

---

### `hooks/studioWatch.mjs` — dir-walk + SHA-256 dedup half

**No analog exists in this repo for this specific combination** (walk a directory tree,
content-hash each file, dedup against previously-seen hashes). `hooks/scanner.mjs` (120+ lines
read) walks `.claude` directories for settings/agents/skills, but reads JSON config, not media
bytes, and does not hash anything. `hooks/skillScan.mjs` (not opened this session — RESEARCH.md
does not cite it for this purpose either) is a metadata scanner, not a content-hasher.

**The rule to apply, not the code to copy:** `hooks/idempotency.mjs`, full file (44 lines) —
this is the governing RATIONALE D-05 cites, not a literal SHA-256 example (it keys on
`tool_use_id`/`session_id`/`hook_event_name`, not file bytes):
```javascript
/**
 * Why this exists: a single Claude Code event can be delivered to the ingest
 * endpoint more than once when the same hook is wired at two settings scopes
 * ... Both deliveries carry a byte-identical payload but run as SEPARATE
 * processes, so anything process-local — pid, hrtime, Date.now() — differs
 * between them and would defeat dedup rather than provide it. The key must
 * be derived purely from payload content.
 */
export function buildIdempotencyKey(data) { /* ... */ }
```
For `studioWatch.mjs`, the equivalent is Node's built-in `crypto.createHash("sha256")` over the
file's bytes (per RESEARCH.md's Standard Stack table — zero new dependency), with the
`by_hash` schema index (see schema section above) as the dedup lookup. This is new code, not a
port — flag it as such in the plan rather than citing a donor that doesn't fully exist.

---

### `scripts/install-studio-watch-task.ps1` / `run-studio-watch.ps1` — scheduled task

**Analog:** `scripts/install-workspace-scan-task.ps1` (full file, 235 lines) +
`scripts/run-workspace-scan.ps1` (full file, 95 lines) — confirmed machine-proven exemplar exactly
as RESEARCH.md describes.

**Guards to copy VERBATIM** (`scripts/install-workspace-scan-task.ps1:155-172`):
```powershell
# wscript.exe + run-hidden.vbs, NEVER powershell's hidden-window switch.
$argStr = '//B //Nologo "' + $HiddenVbs + '" C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe ' +
          '-NoProfile -ExecutionPolicy Bypass -File "' + $WrapperPath + '"'
$action    = New-ScheduledTaskAction -Execute 'C:\Windows\System32\wscript.exe' -Argument $argStr

# AllowStartIfOnBatteries / DontStopIfGoingOnBatteries are MANDATORY.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
              -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Minutes 30) -MultipleInstances IgnoreNew
```
Also copy: the elevation check using `IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`
(never the string form — `:112-119`), the `-SelfTest` self-verifying harness with its own
known-invalid-path control (`:52-103`), and the control-first read-back verification pattern
(`:182-213`) that probes a KNOWN-INSTALLED task (`ConvexNightlyRestart`) before trusting a
"task not found" result.

**GAP — trigger shape must be ADAPTED, not copied verbatim.** The donor uses a once-daily trigger:
```powershell
$trigger = New-ScheduledTaskTrigger -Daily -At $TriggerTime
```
D-04 requires "every 5 minutes." No scheduled-task script in this repo (`scripts/*.ps1`, grepped)
uses a repeating trigger — this is genuinely new. The correct PowerShell shape (not present
anywhere in this codebase, write fresh) is:
```powershell
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)
```
Everything else in the donor (principal, settings, launcher, self-test, read-back verification)
carries over unchanged. `scripts/install-media-vault-backup-task.ps1` (D-14, nightly robocopy)
does NOT have this gap — `-Daily -At` is the correct trigger shape there, copy the donor as-is.

**Wrapper** (`scripts/run-workspace-scan.ps1:20-94`) — copy near-verbatim: append-only ASCII log
outside the repo, 1MB rotation keeping one generation, an `$ExitMeanings` table read from the
target script's own documented exit codes, `cmd /c "node ... 2>&1"` wrapping (never redirect
native stderr directly under `$ErrorActionPreference='Stop'`), and a bounded/secret-filtered
output tail (`Where-Object { $_ -notmatch 'Bearer' }`).

---

### `src/pages/Studio.tsx` (new) — page shape

**Analog A (filter chips, search, error boundary, empty states):** `src/pages/Galdr.tsx`, full
file (452 lines). Key excerpts:
```tsx
class PromptsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="text-muted-foreground border-border rounded-md border p-8 text-center text-sm">{ERROR_COPY}</div>;
    }
    return this.props.children;
  }
}
```
```tsx
function FilterChip({ label, count, active, onClick, testId }: {...}) {
  return (
    <button type="button" data-testid={testId} aria-pressed={active} onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs font-bold transition-all ${
        active ? "border-primary bg-primary/15 text-primary shadow-[var(--glow-xs)]"
               : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}>
      {label}<span className="tabular-nums opacity-70">{count}</span>
    </button>
  );
}
```
```tsx
export default function Galdr() {
  return (
    <div className="p-6">
      <PageHeader title="Galdr" icon={Sparkles} actions={<div className="flex items-center gap-2">
        <Input value={search} onChange={...} placeholder="Search prompts..." className="w-64" aria-label="Search prompts" />
        <Button onClick={openCreate}>New Prompt</Button>
      </div>} />
      <SectionErrorBoundary name="Prompts"><PromptsErrorBoundary><GaldrLibrary ... /></PromptsErrorBoundary></SectionErrorBoundary>
      <PromptEditorDrawer ... />
    </div>
  );
}
```
Studio has no "New X" button per UI-SPEC's Page Shape — omit the create button, keep everything
else (`PageHeader` + `SectionErrorBoundary` + a local error-boundary class + Search input).
`Star` icon overlay with `var(--status-warn)` (`Galdr.tsx:196-206`) is the literal color-token
source UI-SPEC cites for the card star toggle:
```tsx
<Star className="h-4 w-4" style={prompt.favorite ? { fill: "var(--status-warn)", color: "var(--status-warn)" } : undefined} />
```

**Analog B (no-modal-confirm archive/delete, `stopPropagation` separation, liveness-null pattern
as a model for D-01's broken-thumbnail-neutral rendering):** `src/pages/Bifrost.tsx`, full file
(379 lines). Key excerpt (`:88-127`, single-click archive with no `AlertDialog`, matching UI-SPEC's
"Destructive confirmation — Move to Trash: No modal confirmation" verbatim):
```tsx
<button type="button" aria-label={`Archive ${link.title}`} onClick={onArchive}>
  <Trash2 className="text-muted-foreground h-4 w-4" />
</button>
```
`livenessOf()` (`:63-71`) is the exact "an absent signal must render as absent, never a default
positive" shape D-01's broken-thumbnail fallback and D-07's "No provenance recorded" both need:
```tsx
export function livenessOf(link: { containerName?: string }, statuses: Record<string, string>): "up" | "down" | null {
  if (!link.containerName) return null;
  const status = statuses[link.containerName];
  if (status === undefined) return null;
  return status === "running" ? "up" : "down";
}
```

**Masonry grid itself: confirmed no analog exists.** `Grep -i "masonry|columns-|Masonry"` across
`src/` returned zero files. `Galdr.tsx`/`Bifrost.tsx` both use a fixed `grid grid-cols-1 gap-4
md:grid-cols-2 xl:grid-cols-3` — uniform-height grid, not masonry. This confirms CONTEXT.md's
claim exactly. The UI-SPEC's `columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4`
+ `break-inside-avoid mb-4` CSS is genuinely new to this codebase; write it fresh per the UI-SPEC,
no donor to copy structure from.

---

### Media Detail Sheet — right-side drawer

**Analog:** `src/components/galdr/PromptEditorDrawer.tsx:186-339` (Sheet shape + SheetFooter):
```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
    <SheetHeader><SheetTitle>{isEdit ? "Edit Prompt" : "New Prompt"}</SheetTitle></SheetHeader>
    <div className="space-y-5 px-4 pb-6"> ... </div>
    <SheetFooter className="flex-row items-center justify-between">
      {isEdit ? <Button variant="destructive" onClick={...}>Archive</Button> : <span />}
      <Button onClick={() => void handleSave()}>Save</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```
Also note the plain-text-only rendering rule stated inline at `PromptEditorDrawer.tsx:258-259`
("Plain text only — never raw-HTML injection... The body is agent-authored free text") — this is
the exact precedent UI-SPEC cites for `recipeMd`'s `<pre>`/`font-mono` rendering rule.

---

### `src/lib/navRegistry.ts` — D-16 nav entry

**Analog:** `:80-101` (icon map) and `:122-140` (`navGroups`), confirmed exactly as RESEARCH.md
and CONTEXT.md describe. `grep -i "Images"` across the file returned zero matches — the icon slot
is genuinely unclaimed.
```typescript
sparkles: Sparkles,   // Phase 116 — Galdr page
"link-2": Link2,   // Phase 117 — Bifröst page
waypoints: Waypoints,   // Phase 119 — Loom page
```
```typescript
{ to: "/galdr", label: "Galdr", icon: "sparkles", group: "COMMAND" },
// Bifröst sits beside Galdr: both are Seiðr Suite curated-library surfaces.
{ to: "/bifrost", label: "Bifröst", icon: "link-2", group: "COMMAND" },
```
Add `images: Images` to the icon map (import `Images` from `lucide-react`) and
`{ to: "/studio", label: "Studio", icon: "images", group: "COMMAND" }` adjacent to the Bifröst
entry — matching UI-SPEC's own placement instruction exactly.

---

## Shared Patterns

### Bearer-gated, fail-closed, no-CORS auth (D-15)
**Source:** `convex/ingestAuth.ts:149-156` (`validateLoomAuth`) + `convex/http.ts:126-131` (comment
block explaining the missing OPTIONS partner IS the boundary)
**Apply to:** `convex/studioHttp.ts` only. Never applied to `toggleStar`/`softDelete`/`restore`
(those stay plain public `mutation`s per Pitfall 4 — this is the one place Studio's auth shape
diverges from every sibling phase).

### `internalMutation` for agent/CLI-only writes
**Source:** `convex/loom.ts:140-149`
**Apply to:** `ingestMedia`, the storage `generateUploadUrl` wrapper, the D-08 janitor's permanent
delete. NOT `toggleStar`/`softDelete`/`restore`.

### Batch-capped, cursor-seeked deletes (never `.collect()`)
**Source:** `convex/retention.ts:206-351` (positive) vs. `convex/forge.ts:1828-1877` (negative,
already-shipped anti-pattern in this exact repo)
**Apply to:** the D-08 janitor exclusively — nothing else in this phase does bulk deletes.

### `.mjs` host-script conventions (no shebang, AbortController+timeout, env-var-first resolution,
never-throw vs. fail-loud split)
**Source:** `hooks/ingestPost.mjs`, `hooks/loom-emit.mjs`, `hooks/idempotency.mjs`
**Apply to:** `hooks/studioWatch.mjs` — its POST half exactly; its dir-walk/hash half is new code
guided by `idempotency.mjs`'s RATIONALE only (see "No Analog Found").

### Scheduled-task battery/launcher guards
**Source:** `scripts/install-workspace-scan-task.ps1:155-172`
**Apply to:** both `install-studio-watch-task.ps1` and `install-media-vault-backup-task.ps1` — the
guards and launcher are identical across both; only the trigger cadence differs (5-min repeat vs.
daily).

### Curated-table retention exemption
**Source:** `convex/retention.ts:126-142`
**Apply to:** the D-03 comment block for `media`/`mediaStyles`/`mediaModels`.

### "Absent signal renders as absent, never a default positive"
**Source:** `src/pages/Bifrost.tsx:63-71` (`livenessOf`)
**Apply to:** D-01's broken-thumbnail fallback (`thumbnailUrl` null → `ImageOff` placeholder, never
a broken `<img>`) and D-07's "No provenance recorded" rendering (never blank, never inferred).

### Plain-text-only rendering for agent-authored free text (XSS avoidance)
**Source:** `src/pages/Galdr.tsx:210-213` and `src/components/galdr/PromptEditorDrawer.tsx:258-259`
**Apply to:** `mediaModels.recipeMd` rendering in the Models collapsible panel — `<pre>`/`font-mono`
only, never `dangerouslySetInnerHTML`.

---

## No Analog Found

| File / Piece | Role | Data Flow | Reason |
|---|---|---|---|
| `hooks/studioWatch.mjs` — directory walk + SHA-256 content hashing + hash-based dedup | utility (host script) | file-I/O | No file in this repo walks a directory tree and content-hashes files for dedup. `hooks/scanner.mjs`/`hooks/skillScan.mjs` walk `.claude` config directories but read JSON, never hash bytes. `hooks/idempotency.mjs` establishes the CONTENT-ONLY-KEY *rule* (D-05 cites it for exactly this) but its own key is built from event metadata (`tool_use_id`/`session_id`), not a file's SHA-256 — use it as rationale, not as code to port. Plan this as new code, built against Node's built-in `crypto.createHash("sha256")` per RESEARCH.md's Standard Stack table. |
| OpenArt MCP discovery/probe task (D-09 amendment leg 1) | integration task | — | No prior art anywhere in this repo for authenticating a hosted MCP connector and enumerating its post-auth tool surface — this is a one-off discovery task, not a code pattern. RESEARCH.md's own "OpenArt workability concern" section is the operative guidance here, not a codebase analog. |
| `hooks/studioWatch.mjs`'s ffmpeg invocation + bounded-quality encode loop | utility (host script) | file-I/O | No ffmpeg invocation exists anywhere in this repo currently (confirmed: `package.json` has no `sharp`/`jimp`/image-processing dependency, and RESEARCH.md's own search found no existing ffmpeg call site to cite). RESEARCH.md's "Code Examples" section supplies illustrative shell invocations (`ffmpeg -y -i ... -c:v libwebp -quality 80 ...`) sourced from WebSearch, not from this codebase — treat those as the starting shape, tune empirically per Pitfall 3. |

---

## Metadata

**Analog search scope:** `convex/*.ts` (avatars.ts, ingestAuth.ts, loomHttp.ts, loom.ts,
retention.ts, forge.ts, schema.ts, http.ts, workspaceHttp.test.ts), `hooks/*.mjs` (ingestPost.mjs,
loom-emit.mjs, idempotency.mjs, scanner.mjs) + `hooks/__tests__/`, `scripts/*.ps1`
(install-workspace-scan-task.ps1, run-workspace-scan.ps1), `src/pages/` (Galdr.tsx, Bifrost.tsx),
`src/components/galdr/PromptEditorDrawer.tsx`, `src/components/PageHeader.tsx`,
`src/lib/navRegistry.ts`, `e2e/bifrost.spec.ts`.

**Files scanned (full or targeted read):** 21.
**Pattern extraction date:** 2026-08-13.
