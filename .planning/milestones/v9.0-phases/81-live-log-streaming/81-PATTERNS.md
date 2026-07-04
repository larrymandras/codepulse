# Phase 81: Live Log Streaming - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/forgeLogIngest.ts` | httpAction handler | request-response | `convex/forgeIngest.ts` | exact |
| `convex/forge.ts` (add `appendLogChunk` + `listJobLogs`) | internalMutation + query | append-only + reactive | `convex/forge.ts` `upsertJob` + `listJobs` | exact |
| `convex/schema.ts` (add `forgeLogChunks`) | schema | CRUD | `convex/schema.ts` `forgeJobs` block (~L1464) | exact |
| `convex/http.ts` (add `/forge-log-ingest` routes) | route registration | request-response | `convex/http.ts` `/forge-ingest` block (L72-74) | exact |
| `convex/ingestAuth.ts` | auth utility | request-response | self — reuse verbatim (no new code) | n/a |
| `convex/forgeLogIngest.test.ts` | test | request-response | `convex/forgeIngest.test.ts` | exact |
| `convex/crons.ts` (add retention sweep) | cron/scheduled mutation | batch | `convex/crons.ts` `expire-stale-forge-commands` (L104-109) | exact |
| `src/components/forge/ForgeJobDetail.tsx` (add log pane) | component | streaming/reactive | `src/components/TranscriptPanel.tsx` (auto-scroll + JumpToLatestPill) | role-match |
| `src/hooks/useForge.ts` (add `useForgeJobLogs`) | hook | reactive | `src/hooks/useForge.ts` `useForgeJobs` / `useForgeCommands` (with Phase 80 memoization) | exact |

---

## Pattern Assignments

### `convex/forgeLogIngest.ts` (new httpAction, request-response)

**Analog:** `convex/forgeIngest.ts` (copy entire structure)

**Imports pattern** (lines 15-17):
```typescript
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";
```

**Handler skeleton** (lines 19-30) — OPTIONS preflight first, then auth gate:
```typescript
export const forgeLogIngest = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  // Bearer token auth (D-03: reuse validateForgeIngestAuth — same key, different gate)
  if (!validateForgeIngestAuth(request)) {
    return unauthorizedResponse();
  }
  // ...
});
```

**Body parse + field validation** (lines 33-56) — same try/catch shape as forgeIngest:
```typescript
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
    );
  }

  const { type, hostId, forgeJobId, lines, seq } = body ?? {};

  if (type !== "log" || !hostId || !forgeJobId || !Array.isArray(lines) || seq == null) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: type, hostId, forgeJobId, lines, seq" }),
      { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
    );
  }
```

**Dispatch to internalMutation** (lines 58-87, adapted from forgeIngest):
```typescript
  await ctx.runMutation(internal.forge.appendLogChunk, {
    hostId,
    forgeJobId,
    lines,
    seq,
    sentAt: body.sentAt ?? null,
  });

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
  );
```

**Error handling pattern** — identical to `forgeIngest`: per-branch 400 with `getCorsHeaders(request)` spread; single try/catch for JSON parse only; all other validation returns 400 inline.

---

### `convex/forge.ts` — add `appendLogChunk` (internalMutation, append-only)

**Analog:** `convex/forge.ts` `upsertJob` (lines 136-206)

**internalMutation imports** — already present at line 16: `import { internalMutation, mutation, query } from "./_generated/server";`

**Core append-only + idempotent pattern** (adapt from `upsertJob` lines 155-205):
```typescript
export const appendLogChunk = internalMutation({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
    lines:      v.array(v.string()),
    seq:        v.number(),
    sentAt:     v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    // D-1 idempotency: skip insert if (hostId, forgeJobId, seq) already exists
    const existing = await ctx.db
      .query("forgeLogChunks")
      .withIndex("by_host_job_seq", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("seq", args.seq)
      )
      .unique();

    if (existing) return;  // Idempotent no-op (D-1)

    await ctx.db.insert("forgeLogChunks", {
      hostId:     args.hostId,
      forgeJobId: args.forgeJobId,
      lines:      args.lines,
      seq:        args.seq,
      sentAt:     args.sentAt,
    });
  },
});
```

**Pattern note:** append-only = skip the patch branch entirely; upsertJob's `existing ? patch : insert` becomes `existing ? return : insert`.

### `convex/forge.ts` — add `listJobLogs` (query, reactive bounded)

**Analog:** `convex/forge.ts` `listJobs` (lines 259-279) — bounded `.take(N)` + index-scoped + reactive.

```typescript
// D-03: single bounded reactive query — retention already caps set to ~1 MB per job
const LOG_CHUNK_LIMIT = 5000;  // planners: tune at plan time; retention bounds the real set

export const listJobLogs = query({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("forgeLogChunks")
      .withIndex("by_host_job", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
      )
      .order("asc")   // ascending by seq / _creationTime — oldest chunk first
      .take(LOG_CHUNK_LIMIT);
  },
});
```

**Pattern notes:**
- `listJobs` uses `.order("desc").take(N)` for newest-first. `listJobLogs` flips to `.order("asc")` — terminal display reads top-to-bottom, oldest first.
- No `hostId` optional branch needed (unlike `listJobs`) — log query always requires both identifiers.
- `LOG_CHUNK_LIMIT` constant placed near file top alongside `JOB_LIST_LIMIT = 1000` (line 257).

---

### `convex/schema.ts` — add `forgeLogChunks` table

**Analog:** `convex/schema.ts` `forgeJobs` block (lines 1462-1485)

**Placement:** insert immediately after `forgeJobs` block (after line 1485, before `forgeWorkspaces`). Mirror the section header comment style.

**Verbatim schema from SPEC §Locked design 2:**
```typescript
  // Append-only log chunks from Forge daemon. Lines arrive pre-scrubbed (T-3-BYPASS upstream).
  // Retention enforced by sweep cron: 7-day TTL + ~1 MB per-job cap (D-2).
  forgeLogChunks: defineTable({
    hostId:     v.string(),
    forgeJobId: v.string(),
    lines:      v.array(v.string()),   // already scrubbed by Forge (T-3-BYPASS upstream)
    seq:        v.number(),            // D-1: monotonic per (host,job) — ordering + dedup (REQUIRED)
    sentAt:     v.optional(v.string()), // client flush time (ISO)
  })
    .index("by_host_job",     ["hostId", "forgeJobId"])          // listJobLogs / retention sweep
    .index("by_host_job_seq", ["hostId", "forgeJobId", "seq"]),  // D-1 idempotency unique-check
```

**Pattern notes from `forgeJobs` analog:**
- Index names follow `by_<fields>` snake_case convention.
- Two-field composite indexes (like `by_host_job`) prefix-scan efficiently via `withIndex(..., (q) => q.eq("hostId", h).eq("forgeJobId", j))`.
- Three-field index `by_host_job_seq` enables a `.unique()` lookup for the D-1 idempotency check.
- `v.optional(v.string())` (not `v.union(v.string(), v.null())`) used for truly optional metadata fields — match the SPEC definition exactly.

---

### `convex/http.ts` — register `/forge-log-ingest` routes

**Analog:** `convex/http.ts` lines 72-74 (`/forge-ingest` block)

**Import addition** — add alongside `forgeIngest` import (line 24):
```typescript
import { forgeLogIngest } from "./forgeLogIngest";
```

**Route registration** — add immediately after the Phase 78 `/forge-ingest` block (after line 74):
```typescript
// Phase 81: Forge log ingest endpoint
http.route({ path: "/forge-log-ingest", method: "POST",    handler: forgeLogIngest });
http.route({ path: "/forge-log-ingest", method: "OPTIONS", handler: forgeLogIngest });
```

**Pattern note:** Every ingest endpoint registers both POST and OPTIONS with the same handler — OPTIONS is handled inside the handler via `request.method === "OPTIONS"` guard.

---

### `convex/ingestAuth.ts` — REUSE VERBATIM (no new code)

**Pattern:** `validateForgeIngestAuth` (lines 88-97) and `getCorsHeaders` (lines 63-65) are reused by `forgeLogIngest.ts` with zero modification. D-3 decision: same `FORGE_INGEST_API_KEY` bearer, same fail-closed behavior. Document reuse in `forgeLogIngest.ts` header comment.

**Key behavior to preserve:**
- `validateForgeIngestAuth` fails closed when `FORGE_INGEST_API_KEY` is unset (line 93: requires `FORGE_INGEST_ALLOW_ANON=true` for dev/anon path).
- `unauthorizedResponse()` (line 103-107) returns 401 with no CORS headers — correct for auth rejections.

---

### `convex/forgeLogIngest.test.ts` (new test file)

**Analog:** `convex/forgeIngest.test.ts` — mirror the three-section structure exactly.

**Test file structure** (copy from forgeIngest.test.ts):

Section 1 — Auth gate tests (lines 21-86): Copy all 6 `validateForgeIngestAuth` tests verbatim. Update URL strings from `/forge-ingest` to `/forge-log-ingest`.

Section 2 — Body validation (lines 92-222): Replace `simulateForgeIngestDispatch` with `simulateForgeLogIngestDispatch`. New dispatch logic validates `type === "log"` + `hostId` + `forgeJobId` + `Array.isArray(lines)` + `seq != null`.

```typescript
type DispatchResult =
  | { status: 200; body: { ok: true } }
  | { status: 400; body: { error: string } };

function simulateForgeLogIngestDispatch(body: any): DispatchResult {
  if (!body || typeof body !== "object") {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, lines, seq" } };
  }
  const { type, hostId, forgeJobId, lines, seq } = body;
  if (type !== "log" || !hostId || !forgeJobId || !Array.isArray(lines) || seq == null) {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, lines, seq" } };
  }
  return { status: 200, body: { ok: true } };
}
```

Section 3 — Wire envelope shape: verify `{type:"log", hostId, forgeJobId, lines, seq}` contract + idempotency fields.

Section 4 — DB round-trip stubs (`.todo`): mirror forgeIngest.test.ts lines 286-291 pattern:
```typescript
describe("forgeLogIngest — DB round-trip (integration)", () => {
  it.todo("valid key + {type:'log', hostId, forgeJobId, lines, seq} → 200 + forgeLogChunks row inserted (SC#1)");
  it.todo("bad/missing key → 401 (SC#1)");
  it.todo("missing fields → 400 (SC#1)");
  it.todo("repeat (hostId, forgeJobId, seq) → no-op / 200 (D-1 idempotent) (SC#1)");
  it.todo("valid retention sweep: chunks > 7 days old deleted; per-job cap enforced (SC#3)");
});
```

---

### `convex/crons.ts` — add retention sweep cron

**Analog:** `convex/crons.ts` lines 104-109 (`expire-stale-forge-commands`)

**Existing pattern to copy:**
```typescript
// Phase 80: Forge command bridge — expire unclaimed commands past their TTL (D-12)
crons.interval(
  "expire-stale-forge-commands",
  { minutes: 1 },
  internal.forge.expireStaleCommands,
);
```

**New cron entry** (add after line 109, before `export default crons`):
```typescript
// Phase 81: Forge log retention — sweep chunks > 7-day TTL + enforce per-job byte cap (D-2)
crons.daily(
  "sweep-forge-log-chunks",
  { hourUTC: 3, minuteUTC: 30 },
  internal.forge.sweepForgeLogChunks,
);
```

**Pattern notes:**
- Daily cadence (`crons.daily`) preferred over per-minute for storage sweeps that don't need sub-minute freshness — mirrors `archive-stale-events` (line 27) and `evaluate-memory-quality` (line 77).
- The internal mutation `sweepForgeLogChunks` must be exported from `convex/forge.ts` as `internalMutation` (same pattern as `expireStaleCommands` lines 458-475).
- Sweep logic: delete chunks where `_creationTime < Date.now() - 7_DAYS_MS` (TTL); then for each job, sum line lengths and drop oldest chunks until total is under the byte cap.

---

### `src/components/forge/ForgeJobDetail.tsx` — add live log pane

**Analog:** `src/components/TranscriptPanel.tsx` (full file) — this is the exact auto-scroll + pause-on-scroll-up + JumpToLatestPill pattern specified in D-02.

**Auto-scroll state pattern** (TranscriptPanel.tsx lines 33-38):
```typescript
const [showPill, setShowPill] = useState(false);
const viewportRef = useRef<HTMLDivElement>(null);
const isAutoScrollingRef = useRef(true);  // starts auto-following for logs (always live)
const prevChunkCountRef = useRef(chunks.length);
```

**Scroll-to-bottom on new chunks** (TranscriptPanel.tsx lines 40-49):
```typescript
useEffect(() => {
  if (isAutoScrollingRef.current && viewportRef.current) {
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }
  prevChunkCountRef.current = chunks.length;
}, [chunks.length]);
```

**Pause-on-scroll-up + near-bottom resume** (TranscriptPanel.tsx lines 51-64):
```typescript
const handleScroll = useCallback(() => {
  const el = viewportRef.current;
  if (!el) return;
  if (el.scrollTop + el.clientHeight < el.scrollHeight - 100) {
    isAutoScrollingRef.current = false;
    setShowPill(true);
  } else {
    isAutoScrollingRef.current = true;
    setShowPill(false);
  }
}, []);
```

**Jump to latest** (TranscriptPanel.tsx lines 66-72):
```typescript
const jumpToLatest = useCallback(() => {
  isAutoScrollingRef.current = true;
  setShowPill(false);
  if (viewportRef.current) {
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }
}, []);
```

**JumpToLatestPill** (TranscriptPanel.tsx lines 99-101) — import and use verbatim:
```typescript
import { JumpToLatestPill } from "@/components/JumpToLatestPill";
// ...
<JumpToLatestPill visible={showPill} onClick={jumpToLatest} />
```

**Log line rendering** — adapt from `BashLog.tsx` for terminal-style monospace text (not TranscriptBubble). Use `font-mono text-xs` on each line, `whitespace-pre` for formatting. Use a `<pre>` or flat `<div>` per chunk, iterating `chunk.lines`.

**Integration into ForgeJobDetail** — the existing component (lines 122-153) has a two-part layout: header (shrink-0) + scrollable body (`flex-1 overflow-y-auto`). The log pane replaces or extends the scrollable body section. Consider a tab strip (Details | Logs) to avoid clobbering `ForgeMetadataPanel`. The ForgeJobDetail import block (lines 21-28) shows the existing import pattern.

**Imports to add:**
```typescript
import { useState, useRef, useEffect, useCallback } from "react";
import { JumpToLatestPill } from "@/components/JumpToLatestPill";
import { useForgeJobLogs } from "@/hooks/useForge";
```

---

### `src/hooks/useForge.ts` — add `useForgeJobLogs`

**Analog:** `src/hooks/useForge.ts` `useForgeCommands` (lines 202-218) — the Phase 80 memoized pattern with `useMemo` for referential stability.

**Imports** — already present: `useMemo` (line 1), `useQuery` (line 2), `api` (line 3).

**Type definition** (add near other row types, after `ForgeJobRow`):
```typescript
// ForgeLogChunk: Convex forgeLogChunks doc adapted for the log pane.
export interface ForgeLogChunk {
  id: string;          // doc._id
  seq: number;
  lines: string[];
  sentAt: string | null;
}
```

**Adapter** (follow `adaptCommand` pattern — lines 135-149):
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptLogChunk(doc: any): ForgeLogChunk {
  return {
    id:     doc._id,
    seq:    doc.seq,
    lines:  doc.lines,
    sentAt: doc.sentAt ?? null,
  };
}
```

**Hook** (follow `useForgeCommands` memoization pattern — lines 202-218):
```typescript
/**
 * Returns log chunks for a specific job, ordered by seq asc.
 * Returns [] during load. Memoized for referential stability (Phase 80 lesson).
 * Skip-query pattern when either arg is null (idiomatic Convex).
 */
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

**Phase 80 memoization rule** (documented in `useForgeJobsRaw` comments, lines 162-169): `raw.map(...)` allocates a new array every render. Without `useMemo`, a reactive query delivering updates would cause referential instability, breaking any `useEffect` with this array as a dependency. Always wrap `.map()` output in `useMemo([raw])`.

---

## Shared Patterns

### Authentication — reuse verbatim
**Source:** `convex/ingestAuth.ts` lines 88-97 (`validateForgeIngestAuth`) and lines 63-65 (`getCorsHeaders`)
**Apply to:** `convex/forgeLogIngest.ts`
```typescript
// validateForgeIngestAuth: fails closed — missing key requires FORGE_INGEST_ALLOW_ANON=true
export function validateForgeIngestAuth(request: Request): boolean {
  const expectedKey = _env.FORGE_INGEST_API_KEY;
  if (!expectedKey) {
    return _env.FORGE_INGEST_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```
Import with: `import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";`

### internalMutation rule — no Clerk identity
**Source:** `convex/forge.ts` file header (lines 1-14) and `upsertJob` handler
**Apply to:** `appendLogChunk`, `sweepForgeLogChunks`

httpActions have no Clerk identity — all mutations they invoke MUST be `internalMutation` (not `mutation`). The `forgeLogIngest` httpAction calls `ctx.runMutation(internal.forge.appendLogChunk, ...)` where `appendLogChunk` is `internalMutation`. Never use `mutation` for httpAction-dispatched writes.

### Error response shape — consistent JSON + CORS headers
**Source:** `convex/forgeIngest.ts` lines 37-55
**Apply to:** `convex/forgeLogIngest.ts`
```typescript
// Every non-200 response includes getCorsHeaders(request) in the headers spread
return new Response(
  JSON.stringify({ error: "..." }),
  { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
);
// Exception: 401 unauthorizedResponse() deliberately omits CORS headers (ingestAuth.ts:103-107)
```

### Referential stability via useMemo
**Source:** `src/hooks/useForge.ts` lines 162-169 (`useForgeJobsRaw`) and lines 212-216 (`useForgeCommands`)
**Apply to:** `useForgeJobLogs`

All hooks that call `.map()` on a `useQuery` result MUST wrap with `useMemo([raw])`. This prevents new array identity on every render from triggering infinite re-render loops in `useEffect` dependencies.

### Cron + internalMutation sweep pattern
**Source:** `convex/crons.ts` lines 104-109; `convex/forge.ts` `expireStaleCommands` (lines 458-475)
**Apply to:** `sweepForgeLogChunks` internalMutation + cron entry

```typescript
// forge.ts sweep pattern
export const expireStaleCommands = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("forgeCommands")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .collect();
    for (const cmd of stale) {
      if (shouldExpireCommand(cmd.status, cmd.expiresAt, now)) {
        await ctx.db.patch(cmd._id, { status: "expired" });
      }
    }
  },
});
```
Adapt for `forgeLogChunks`: use `by_host_job` index to enumerate per-job chunks; delete by `_creationTime < now - 7_DAYS_MS` (TTL) and by byte-cap (drop oldest when sum of line lengths exceeds cap).

---

## Cross-Repo Handoff (out of scope for codebase pattern-mapping)

The Forge-side finalization (`C:\Users\mandr\forge\src\emit\log-forwarder.ts` `makeLogSink`) is in a separate repo. The locked envelope to implement is:
```
POST /forge-log-ingest
{ type: "log", hostId: string, forgeJobId: string, lines: string[], seq: number, sentAt?: string }
Authorization: Bearer <FORGE_INGEST_API_KEY>
```
Set `FORGE_LOG_INGEST_URL=https://<deployment>.convex.site`. Never log the `apiKey` (T-6-KEYLEAK). No codebase pattern-mapping is possible from the CodePulse tree for this file.

---

## No Analog Found

None. All 9 files have direct analogs in the CodePulse codebase.

---

## Metadata

**Analog search scope:** `convex/`, `src/hooks/`, `src/components/`, `src/components/forge/`
**Files scanned:** 11 files read directly (forgeIngest.ts, forgeIngest.test.ts, ingestAuth.ts, forge.ts, http.ts, schema.ts, crons.ts, useForge.ts, ForgeJobDetail.tsx, TranscriptPanel.tsx, BashLog.tsx, JumpToLatestPill.tsx)
**Pattern extraction date:** 2026-06-16
