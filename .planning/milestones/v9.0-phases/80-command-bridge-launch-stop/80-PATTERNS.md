# Phase 80: Command Bridge (launch + stop) — Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 13 new/modified files
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `convex/schema.ts` | model | CRUD | `convex/schema.ts:1464` (forgeJobs/forgeWorkspaces) | exact-extend |
| `convex/forge.ts` | service | CRUD + event-driven | `convex/forge.ts` (existing) | exact-extend |
| `convex/http.ts` | route | request-response | `convex/http.ts:72` (/forge-ingest registration) | exact-extend |
| `convex/crons.ts` | config | batch | `convex/crons.ts` (existing cron patterns) | exact-extend |
| `convex/forgeCommands.ts` (httpActions) | middleware | request-response | `convex/forgeIngest.ts` (httpAction shape) | exact |
| `convex/forge.test.ts` | test | CRUD | `convex/forge.test.ts` (existing pure-logic pattern) | exact-extend |
| `src/hooks/useForge.ts` | hook | request-response | `src/hooks/useForge.ts` (existing) | exact-extend |
| `src/components/forge/ForgeLaunchModal.tsx` | component | request-response | `forge/web/src/components/NewJobModal.tsx` (port source) | port+trim |
| `src/components/forge/ForgeStopConfirmDialog.tsx` | component | request-response | shadcn `AlertDialog` in `src/components/ui/alert-dialog.tsx` | role-match |
| `src/components/forge/ForgeStatusBadge.tsx` | component | transform | `src/components/forge/ForgeStatusBadge.tsx` (existing) | exact-extend |
| `src/components/forge/ForgeJobList.tsx` | component | CRUD | `src/components/forge/ForgeJobList.tsx` (existing) | exact-extend |
| `src/components/forge/ForgeJobDetail.tsx` | component | request-response | `src/components/forge/ForgeJobDetail.tsx` (existing) | exact-extend |
| `src/pages/ForgePage.tsx` | controller | request-response | `src/pages/ForgePage.tsx` (existing) | exact-extend |

---

## Pattern Assignments

### `convex/schema.ts` — add `forgeCommands` + `forgeHosts` tables

**Analog:** `convex/schema.ts:1464–1497` (forgeJobs + forgeWorkspaces table definitions)

**Table definition pattern** (lines 1464–1497):
```typescript
// FORGE INTEGRATION (Phase 78)
forgeJobs: defineTable({
  forgeJobId:    v.string(),
  hostId:        v.string(),
  agent:         v.string(),
  mode:          v.string(),
  prompt:        v.union(v.string(), v.null()),
  workspaceId:   v.string(),
  status:        v.string(),
  pid:           v.union(v.number(), v.null()),
  exitCode:      v.union(v.number(), v.null()),
  startedAt:     v.union(v.string(), v.null()),
  finishedAt:    v.union(v.string(), v.null()),
  artifactCount: v.number(),
  model:         v.union(v.string(), v.null()),
  capabilities:  v.string(),  // JSON string — passed through as-is
  createdAt:     v.string(),
  updatedAt:     v.string(),
})
  .index("by_forgeJobId",     ["hostId", "forgeJobId"])
  .index("by_host_status",    ["hostId", "status", "updatedAt"])
  .index("by_host_updatedAt", ["hostId", "updatedAt"])
  .index("by_updatedAt",      ["updatedAt"]),

forgeWorkspaces: defineTable({
  hostId:      v.string(),
  workspaceId: v.string(),
  class:       v.string(),
  name:        v.string(),
  rootPath:    v.string(),
  updatedAt:   v.string(),
})
  .index("by_host_workspaceId", ["hostId", "workspaceId"]),
```

**Copy these conventions for `forgeCommands`:**
- Section comment: `// FORGE COMMAND BRIDGE (Phase 80)` to match the Phase 78 header style
- Nullable timestamp fields: `v.union(v.number(), v.null())` (not `v.optional`)
- Multi-column indexes: `["hostId", "status", "createdAt"]` for the claim query; `["commandId"]` for optimistic reconciliation; `["expiresAt"]` for TTL cron
- String status field: `v.string()` (not a union literal — matches forgeJobs.status pattern)
- JSON passthrough as string: `capabilities: v.union(v.string(), v.null())` — consistent with `forgeJobs.capabilities: v.string()`

**`forgeHosts` table** (new, lightweight — no existing analog, follow `forgeWorkspaces` single-index pattern):
```typescript
forgeHosts: defineTable({
  hostId:     v.string(),
  lastSeenAt: v.number(),
  hostname:   v.optional(v.string()),
})
  .index("by_hostId",     ["hostId"])
  .index("by_lastSeenAt", ["lastSeenAt"]),
```

---

### `convex/forge.ts` — extend with mutations, queries, internalMutations

**Analog:** `convex/forge.ts` (full file, 192 lines)

**Imports pattern** (lines 9–10):
```typescript
import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
```

**Extend to:**
```typescript
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
```

**internalMutation pattern** — copy `upsertJob` handler structure (lines 16–86):
```typescript
export const upsertJob = internalMutation({
  args: { /* explicit v. validator per field */ },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("forgeJobs")
      .withIndex("by_forgeJobId", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { /* fields */ });
    } else {
      await ctx.db.insert("forgeJobs", { /* fields */ });
    }
  },
});
```
Apply the same read-then-patch-or-insert shape for `claimAndUpsertHost` and `ackCommand`.

**Query pattern with optional hostId** (lines 139–159):
```typescript
export const listJobs = query({
  args: { hostId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const hostId = args.hostId;
    if (hostId) {
      return await ctx.db
        .query("forgeJobs")
        .withIndex("by_host_updatedAt", (q) => q.eq("hostId", hostId))
        .order("desc")
        .take(JOB_LIST_LIMIT);
    }
    return await ctx.db.query("forgeJobs").withIndex("by_updatedAt").order("desc").take(JOB_LIST_LIMIT);
  },
});
```
Apply the same pattern for `listForgeCommands(hostId)` and `listHosts()` (read queries, no auth check — these are read-only).

**CRITICAL: Fail-closed mutation pattern** (NEW for Phase 80 — D-13 deliberate divergence):
```typescript
// D-13: Fail-closed — deliberate divergence from read query graceful-skip convention.
// DO NOT change this to graceful-skip (if (!identity) return;). This is a write/control
// path. Read queries in this file have no auth check — that convention does NOT propagate here.
export const enqueueLaunch = mutation({
  args: { /* ... */ },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Authentication required to issue Forge commands");
    }
    // identity.subject is the Clerk user ID
    await ctx.db.insert("forgeCommands", { /* fields */ });
  },
});
```

**Index-filtered claim pattern** (new, mirrors `upsertWorkspaces` loop pattern):
```typescript
export const claimAndUpsertHost = internalMutation({
  args: { hostId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    // Upsert forgeHosts (read+patch-or-insert in one mutation = atomic)
    const host = await ctx.db
      .query("forgeHosts")
      .withIndex("by_hostId", (q) => q.eq("hostId", args.hostId))
      .unique();
    if (host) {
      await ctx.db.patch(host._id, { lastSeenAt: args.now });
    } else {
      await ctx.db.insert("forgeHosts", { hostId: args.hostId, lastSeenAt: args.now });
    }
    // Claim queued commands atomically
    const queued = await ctx.db
      .query("forgeCommands")
      .withIndex("by_host_status_created", (q) =>
        q.eq("hostId", args.hostId).eq("status", "queued")
      )
      .filter((q) => q.gt(q.field("expiresAt"), args.now))
      .take(10);
    for (const cmd of queued) {
      await ctx.db.patch(cmd._id, { status: "executing", claimedAt: args.now });
    }
    return queued;
  },
});
```

**File header comment pattern** (line 1–7 of existing forge.ts):
```typescript
/**
 * Forge integration mutations and read queries (Phase 78).
 *
 * upsertJob / upsertWorkspaces are internalMutation — they are called
 * exclusively from the /forge-ingest httpAction, which has no Clerk identity.
 * listJobs / getJob / listWorkspaces are public queries consumed by P79 UI.
 */
```
Phase 80 additions should extend this header to describe the new command-bridge mutations and include the D-13 divergence notice.

---

### `convex/http.ts` — add `/forge-commands-claim` and `/forge-commands-ack` routes

**Analog:** `convex/http.ts:72–73` (the `/forge-ingest` pair)

**Route registration pattern** (lines 71–73):
```typescript
// Phase 78: Forge integration ingest endpoint
http.route({ path: "/forge-ingest", method: "POST", handler: forgeIngest });
http.route({ path: "/forge-ingest", method: "OPTIONS", handler: forgeIngest });
```

**Copy exactly** for Phase 80:
```typescript
// Phase 80: Forge command bridge — claim + ack endpoints (daemon-facing)
http.route({ path: "/forge-commands-claim", method: "POST",    handler: forgeCommandsClaim });
http.route({ path: "/forge-commands-claim", method: "OPTIONS", handler: forgeCommandsClaim });
http.route({ path: "/forge-commands-ack",   method: "POST",    handler: forgeCommandsAck });
http.route({ path: "/forge-commands-ack",   method: "OPTIONS", handler: forgeCommandsAck });
```

Import the handlers from a new `convex/forgeCommands.ts` (or from `convex/forge.ts` if the team chooses to keep httpActions there), following the existing import pattern at lines 1–24 of http.ts.

---

### `convex/crons.ts` — add `expire-stale-forge-commands` cron

**Analog:** `convex/crons.ts` (existing file, 104 lines — file exists, just needs a new entry)

**Cron registration pattern** (lines 83–88 — `docker-health-cleanup` interval as closest match):
```typescript
// Docker container staleness cleanup (every 5 minutes)
crons.interval(
  "docker-health-cleanup",
  { minutes: 5 },
  internal.docker.pollHealth
);
```

**Copy pattern for Phase 80** (add before `export default crons`):
```typescript
// Phase 80: Forge command bridge — expire unclaimed commands past their TTL (D-12)
crons.interval(
  "expire-stale-forge-commands",
  { minutes: 1 },
  internal.forge.expireStaleCommands,
);
```

Note: `convex/crons.ts` already exists (confirmed) — it is NOT a Wave 0 gap. The RESEARCH.md assumption A1 is incorrect. Only a new entry is needed.

---

### `convex/forgeCommands.ts` (new httpAction file) — `forgeCommandsClaim` + `forgeCommandsAck`

**Analog:** `convex/forgeIngest.ts` (124 lines — exact structural match)

**Imports pattern** (lines 15–17):
```typescript
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";
```

**httpAction skeleton** (lines 19–123):
```typescript
export const forgeIngest = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  // Bearer token auth
  if (!validateForgeIngestAuth(request)) {
    return unauthorizedResponse();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
    );
  }

  // Validate required fields
  const { hostId } = body ?? {};
  if (!hostId) {
    return new Response(
      JSON.stringify({ error: "Missing required field: hostId" }),
      { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
    );
  }

  // Dispatch to internalMutation
  const result = await ctx.runMutation(internal.forge.claimAndUpsertHost, {
    hostId,
    now: Date.now(),
  });

  return new Response(
    JSON.stringify({ commands: result }),
    { status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
  );
});
```

The `forgeCommandsAck` httpAction follows the same shape but dispatches to `internal.forge.ackCommand`.

**Auth pattern** (lines 28–31 of forgeIngest.ts):
```typescript
// Bearer token auth (D-14: reuses FORGE_INGEST_API_KEY)
if (!validateForgeIngestAuth(request)) {
  return unauthorizedResponse();
}
```

**Error response pattern** (lines 36–44 of forgeIngest.ts):
```typescript
return new Response(
  JSON.stringify({ error: "Invalid JSON body" }),
  {
    status: 400,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  }
);
```

**Success response pattern** (lines 116–122 of forgeIngest.ts):
```typescript
return new Response(
  JSON.stringify({ ok: true }),
  {
    status: 200,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
  }
);
```

---

### `convex/forge.test.ts` — extend with Phase 80 tests

**Analog:** `convex/forge.test.ts` (existing, 376 lines — pure-logic testing pattern)

**Test file header pattern** (lines 1–11):
```typescript
/**
 * Tests for convex/forge.ts — idempotent upsert mutations + read queries (Phase 78).
 *
 * Following the repo's pure-logic testing pattern: extract the decision
 * logic from the DB handlers and exercise it without a live Convex runtime.
 * DB round-trip tests are marked .todo per the established convention.
 */
import { describe, it, expect } from "vitest";
```

**Pure-logic function extraction pattern** (lines 20–44):
```typescript
// Extract decision logic as a pure function, then test it
function shouldPatchJob(existingUpdatedAt: string, incomingUpdatedAt: string): boolean {
  return incomingUpdatedAt >= existingUpdatedAt;
}

describe("forge.upsertJob — last-writer-wins logic (SC#2)", () => {
  it("patches when incoming updatedAt is newer than existing", () => {
    expect(shouldPatchJob("2024-01-01T00:00:00.000Z", "2024-01-01T00:00:01.000Z")).toBe(true);
  });
  // ...
});
```

**Apply to Phase 80:** Extract these functions as pure logic and test them in `convex/forge.test.ts`:
- `shouldExpireCommand(expiresAt: number, now: number): boolean` — TTL expiry decision (D-12)
- `buildLaunchRow(args, identity, now, TTL_MS)` — field mapping for forgeCommands insert
- `shouldStripDangerousCapability(caps: string): string` — Pitfall 7 mitigation
- Auth fail-closed test (no live Clerk needed — test that `identity === null` causes throw)

**DB round-trip stub pattern** (lines 368–375):
```typescript
describe("forge mutations — DB round-trip (integration)", () => {
  it.todo("upsertJob: insert then re-upsert same (hostId, forgeJobId) → ONE row");
  // ...
});
```

New stubs to add at the bottom of the same describe block:
```typescript
  it.todo("enqueueLaunch: inserts forgeCommands row with status='queued'");
  it.todo("claimAndUpsertHost: atomically claims queued commands + upserts host");
  it.todo("expireStaleCommands: marks queued commands past expiresAt as expired");
  it.todo("ackCommand: sets resolvedForgeJobId and status on done command");
```

---

### `src/hooks/useForge.ts` — extend with `useForgeCommands` and `useForgeHosts`

**Analog:** `src/hooks/useForge.ts` (full file, 108 lines)

**Imports pattern** (lines 1–2):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
```

**Type definition pattern** (lines 8–14):
```typescript
export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stopped"
  | "auth_failed";
```

**Extend `JobStatus`** to include Phase 80 states:
```typescript
export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "stopped"
  | "auth_failed"
  | "pending"          // optimistic cloud-initiated state (Phase 80)
  | "stopping_pending" // D-04: async stop, waiting for daemon
  | "expired";         // D-12: TTL-expired command
```

**useQuery hook pattern** (lines 79–83):
```typescript
export function useForgeJobsRaw(): ForgeJobRow[] | undefined {
  const raw = useQuery(api.forge.listJobs, {});
  if (raw === undefined) return undefined;
  return raw.map(adaptJob);
}
```

**Conditional-query pattern** (lines 99–107 — `useForgeJob`):
```typescript
export function useForgeJob(hostId: string | null, forgeJobId: string | null) {
  return useQuery(
    api.forge.getJob,
    hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
  );
}
```
Apply `"skip"` idiom for `useForgeCommands(hostId: string | null)` and `useForgeHosts()`.

**Adapter function pattern** (lines 50–69 — `adaptJob`):
```typescript
function adaptJob(doc: any): ForgeJobRow {
  return {
    id: doc.forgeJobId,
    agent: doc.agent,
    // ...field mapping, not passed through as raw doc
  };
}
```
Add `adaptCommand(doc: any): ForgeCommandRow` following the same shape.

---

### `src/components/forge/ForgeLaunchModal.tsx` (new) — trimmed NewJobModal port

**Primary analog:** `C:\Users\mandr\forge\web\src\components\NewJobModal.tsx` (588 lines — port source)

**Imports pattern** (lines 16–41 of NewJobModal.tsx):
```typescript
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
```
All these primitives exist in `src/components/ui/` — import paths change from `@/components/ui/` (same alias).

**What to ADD to imports** (Phase 80 differences):
```typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
```

**What to DROP from the port:**
- `import { apiFetch } from '@/api/client'` — replaced by `useMutation`
- `import type { Job, JobMode, Workspace } from '@/types'` — use local types or `useForge` types
- `import { Switch } from '@/components/ui/switch'` — dangerous-mode section dropped (D-06)
- Inline workspace creation state variables and handlers (D-07): `creatingWorkspace`, `newWsName`, `newWsClass`, `wsCreateError`, `wsCreating`, `handleCreateWorkspace`
- Dangerous-mode state: `dangerousMode`, `dangerousConfirmed`, `handleDangerousToggle`

**CLAUDE_MODELS list** (lines 50–57 of NewJobModal.tsx — copy verbatim):
```typescript
const CLAUDE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (default)' },
  { id: 'claude-fable-5', label: 'Claude Fable 5 (most capable)' },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest)' },
];
const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-8';
```

**State reset pattern on open** (lines 98–117):
```typescript
useEffect(() => {
  if (open) {
    setAgent('codex');
    setWorkspaceId('');
    setMode('goal');
    setPrompt('');
    setModel('gpt-5.5');
    setMaxTurns('50');
    setAdvancedOpen(false);
    setSubmitError(null);
    setSubmitting(false);
    // Phase 80 additions:
    setHostId('');       // pre-selected by useForgeHosts
  }
}, [open]);
```

**Model default on agent-change** (lines 120–128 — copy verbatim):
```typescript
useEffect(() => {
  if (agent === 'codex') {
    setModel('gpt-5.5');
  } else if (agent === 'claude') {
    setModel(DEFAULT_CLAUDE_MODEL);
  }
}, [agent]);
```

**Submit enabled condition** (lines 184–189 — adapt):
```typescript
const workspaceOk = workspaces.length === 0 || workspaceId.trim() !== '';
const requiredFilled =
  workspaceOk &&
  (agent !== 'claude' || model.trim() !== '');
// Phase 80: hostId must also be set (and online)
const submitEnabled = requiredFilled && hostId.trim() !== '' && !submitting;
```

**Submit handler** (lines 200–242 — adapt): Replace `apiFetch('/jobs', { method: 'POST', ... })` with `enqueueLaunch(args)`. Strip dangerous capability per Pitfall 7:
```typescript
const capabilities: Record<string, unknown> = {};
// D-06: dangerous is NEVER included in cloud launch capabilities
const parsedMaxTurns = Number.parseInt(maxTurns, 10);
if (Number.isFinite(parsedMaxTurns) && parsedMaxTurns > 0) {
  capabilities['maxTurns'] = parsedMaxTurns;
}
const capabilitiesStr = Object.keys(capabilities).length > 0 ? JSON.stringify(capabilities) : null;
```

**Workspace picker JSX** (lines 305–405 — trim the inline-create panel, keep the Select):
Drop the `<button type="button" onClick={() => setCreatingWorkspace(...)}` toggle and the entire `{creatingWorkspace && (...)}` panel. Keep only:
```tsx
<Select value={workspaceId} onValueChange={setWorkspaceId} disabled={workspaces.length === 0}>
  <SelectTrigger id="workspace-select" aria-label="Workspace">
    <SelectValue placeholder="Select workspace" />
  </SelectTrigger>
  <SelectContent>
    {workspaces.map((ws) => (
      <SelectItem key={ws.workspaceId} value={ws.workspaceId}>
        {ws.name}
        <Badge variant={ws.class === 'synced' ? 'default' : 'outline'}>{ws.class}</Badge>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
{workspaces.length === 0 && (
  <p className="text-xs text-muted-foreground">
    No workspaces synced from this host yet.
  </p>
)}
```

**Advanced collapsible** (lines 451–513 — keep, drop dangerous-mode section lines 515–565):
The Collapsible pattern, model Select/Input, and max-turns Input are kept verbatim. Everything from `{/* Dangerous mode (D-07 / T-5-DANGER) */}` to the closing `</div>` is dropped.

**Mode segmented control** (lines 407–433 — copy verbatim):
```tsx
<div className="flex rounded-md border border-input overflow-hidden">
  <button type="button" onClick={() => setMode('goal')}
    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
      mode === 'goal' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-accent'
    }`}>
    Goal
  </button>
  <button type="button" onClick={() => setMode('chat')}
    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors border-l border-input ${
      mode === 'chat' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-accent'
    }`}>
    Chat
  </button>
</div>
```

**DialogFooter pattern** (lines 572–584 — adapt `submitLabel`):
```tsx
<DialogFooter>
  <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
  <Button type="button" onClick={handleSubmit} disabled={!submitEnabled}>
    {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Launching…</> : submitLabel}
  </Button>
</DialogFooter>
```

**NEW: Host picker section** (insert above Agent picker — D-08):
```tsx
<div className="flex flex-col gap-1.5">
  <label htmlFor="host-select" className="text-sm font-medium">Host</label>
  {hostsLoading ? (
    <Skeleton className="h-9 w-full" />
  ) : (
    <Select value={hostId} onValueChange={setHostId}>
      <SelectTrigger id="host-select" aria-label="Host">
        <SelectValue placeholder="Select host" />
      </SelectTrigger>
      <SelectContent>
        {hosts.map((host) => {
          const isOnline = Date.now() - host.lastSeenAt < 30_000;
          return (
            <SelectItem key={host.hostId} value={host.hostId} disabled={!isOnline}>
              <span className="flex items-center gap-2">
                {isOnline && <span className="h-2 w-2 rounded-full bg-primary inline-block" />}
                {host.hostId}{!isOnline ? ' (offline)' : ''}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  )}
</div>
```

**Submit mutation pattern** (Phase 80 replaces `apiFetch`):

> ⚠ **SUPERSEDED by plan revision B2 (2026-06-16).** Do NOT use `withOptimisticUpdate` for the pending row — the cache key (`{hostId}`) won't match ForgePage's `listForgeCommands` `{}` subscription, so the row wouldn't render until the server responds. Per the 80-03 PLAN: call a plain `useMutation(api.forge.enqueueLaunch)` and surface the optimistic "Queued" row via ForgePage-local `pendingLocal` `useState` through `onLaunched`/`onLaunchFailed` callbacks. The 80-03 acceptance criteria assert `withOptimisticUpdate` count is 0. The snippet below is historical only.

```typescript
// SUPERSEDED — see B2 note above; the plan uses ForgePage-local pendingLocal state, not this.
const enqueueLaunch = useMutation(api.forge.enqueueLaunch).withOptimisticUpdate(
  (localStore, args) => {
    // See Pattern Assignments for ForgeJobList — optimistic row insertion goes here
  }
);
```

---

### `src/components/forge/ForgeStopConfirmDialog.tsx` (new)

**Analog:** shadcn `AlertDialog` API (all primitives in `src/components/ui/alert-dialog.tsx`)

**Secondary analog for component structure:** `src/components/forge/ForgeJobDetail.tsx` — component shape (props interface, named export function, no default export).

**Imports pattern** (following ForgeJobDetail.tsx style):
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
```

**Component pattern** (D-03 — AlertDialog wrapping the trigger):
```tsx
interface ForgeStopConfirmDialogProps {
  jobId: string;
  hostId: string;
  isStopping: boolean;
  onConfirmedStop: () => void;
}

export function ForgeStopConfirmDialog({
  jobId, hostId, isStopping, onConfirmedStop
}: ForgeStopConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isStopping} aria-label="Stop job">
          {isStopping
            ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Stopping…</>
            : "Stop"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop this job?</AlertDialogTitle>
          <AlertDialogDescription>
            This will immediately kill the agent process (taskkill /T /F). Any work in
            progress — not yet promoted to the workspace — will be discarded. This cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmedStop}>
            Yes, stop the job
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Stopping… state contract (D-04):** `isStopping` is local state on `ForgeJobDetail` — NOT derived from forgeJobs.status. The button shows "Stopping…" the moment the user confirms. The `forgeJobs` status badge never changes optimistically. Only when the reactive query delivers `status: "stopped"` does the button disappear (terminal state).

---

### `src/components/forge/ForgeStatusBadge.tsx` — extend STATUS_MAP

**Analog:** `src/components/forge/ForgeStatusBadge.tsx` (full file, 99 lines)

**STATUS_MAP pattern** (lines 22–53):
```typescript
const STATUS_MAP: Record<JobStatus, StatusConfig> = {
  queued: {
    label: "Queued",
    className: "bg-zinc-800/60 text-zinc-400",
    Icon: Clock,
  },
  running: {
    label: "Running",
    className: "bg-blue-900/60 text-[var(--status-info)]",
    Icon: Loader2,
  },
  // ...
};
```

**Add three new entries** following the exact same object structure:
```typescript
  pending: {
    label: "Queued…",
    className: "bg-zinc-800/60 text-primary",
    Icon: Loader2,
  },
  stopping_pending: {
    label: "Stopping…",
    className: "bg-amber-900/40 text-[var(--status-warn)]",
    Icon: Loader2,
  },
  expired: {
    label: "Expired",
    className: "bg-zinc-800/30 text-zinc-600",
    Icon: Clock,
  },
```

**Animated icon pattern** (lines 91–95):
```tsx
<config.Icon
  className={`h-3 w-3${status === "running" ? " animate-spin" : ""}`}
/>
```
Extend the animate-spin condition:
```tsx
className={`h-3 w-3${(status === "running" || status === "pending" || status === "stopping_pending") ? " animate-spin" : ""}`}
```

**data-color-scheme** (lines 72–83): Add new cases for `pending` → `"emerald"`, `stopping_pending` → `"amber"`, `expired` → `"stone"`.

**Test extension** — `ForgeStatusBadge.test.tsx` (existing, 161 lines): Add a new `describe` block following the `"all 6 status labels"` pattern (lines 70–87) for the 3 new statuses. Same label/status table pattern.

---

### `src/components/forge/ForgeJobList.tsx` — add Launch button + pending rows

**Analog:** `src/components/forge/ForgeJobList.tsx` (full file, 162 lines)

**Props interface pattern** (lines 56–61):
```typescript
interface ForgeJobListProps {
  jobs: ForgeJobRow[];
  loading: boolean;
  selectedKey: { hostId: string; forgeJobId: string } | null;
  onSelect: (key: { hostId: string; forgeJobId: string }) => void;
}
```

**Extend to** (Phase 80):
```typescript
interface ForgeJobListProps {
  jobs: ForgeJobRow[];
  pendingCommands: ForgeCommandRow[];  // from useForgeCommands()
  loading: boolean;
  selectedKey: { hostId: string; forgeJobId: string } | null;
  onSelect: (key: { hostId: string; forgeJobId: string }) => void;
  onLaunchClick: () => void;          // opens ForgeLaunchModal
  isAuthenticated: boolean;           // gates Launch button (Clerk)
}
```

**Job card pattern** (lines 114–155 — the `<button>` card): The pending row renders as a visual variant of this same card button, with `border-l-2 border-primary` (already used for selected state) applied unconditionally, `status="pending"` forwarded to `ForgeStatusBadge`, and a distinct click target that shows the pending detail pane.

**Selected row pattern** (line 119):
```tsx
className={`w-full text-left flex items-start gap-2 px-3 py-3 min-h-[72px] border-b border-border transition-colors hover:bg-accent/50 ${
  isSelected ? "bg-accent border-l-2 border-primary" : ""
}`}
```
Pending rows get `border-l-2 border-primary` unconditionally (non-selected state). Failed pending rows get `border-l-2 border-destructive`.

**Empty state** (lines 93–102): Keep existing "No jobs yet" copy unchanged. Pending rows appear above the list regardless of whether real jobs exist.

**Launch toolbar button** (new, insert into the component wrapper above ScrollArea):
```tsx
{isAuthenticated && (
  <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
    <Button variant="default" size="sm" onClick={onLaunchClick} className="gap-2">
      <Rocket className="h-4 w-4" />
      Launch Job
    </Button>
  </div>
)}
```
Add `Rocket` to the existing lucide-react import (line 17 of ForgeJobList.tsx adds `Bot, Code, Zap`).

**Pending row reconciliation:** Filter `pendingCommands` to exclude those where `resolvedForgeJobId` exists AND that id appears in the `jobs` array. The remaining pending rows render above the real jobs list.

---

### `src/components/forge/ForgeJobDetail.tsx` — add Stop button + pending detail state

**Analog:** `src/components/forge/ForgeJobDetail.tsx` (full file, 62 lines)

**Header pattern** (lines 46–54):
```tsx
<div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
  <span className="text-sm font-semibold text-foreground">{job.agent}</span>
  <ForgeStatusBadge status={job.status} />
  {job.prompt && (
    <span className="flex-1 text-xs text-muted-foreground truncate">{job.prompt}</span>
  )}
</div>
```

**Extend header** to include Stop button (Phase 80):
```tsx
<div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
  <span className="text-sm font-semibold text-foreground">{job.agent}</span>
  <ForgeStatusBadge status={job.status} />
  {job.prompt && (
    <span className="flex-1 text-xs text-muted-foreground truncate">{job.prompt}</span>
  )}
  {/* D-03/D-04: Stop button — only for running jobs; hidden on terminal states */}
  {job.status === "running" && (
    <ForgeStopConfirmDialog
      jobId={job.id}
      hostId={job.hostId}
      isStopping={isStoppingLocal}
      onConfirmedStop={handleConfirmedStop}
    />
  )}
</div>
```

**Local isStopping state** (new, not optimistic on forgeJobs status):
```typescript
const [isStoppingLocal, setIsStoppingLocal] = useState(false);

const handleConfirmedStop = async () => {
  setIsStoppingLocal(true);  // Only the button goes to "Stopping…" (D-04)
  try {
    await enqueueStop({ hostId: job.hostId, forgeJobId: job.id, commandId: ulid() });
  } catch (err) {
    setIsStoppingLocal(false);  // Reset if mutation fails
    // show error toast
  }
  // Do NOT setIsStoppingLocal(false) on success — stays "Stopping…" until
  // the reactive listJobs query delivers status:"stopped" and the button disappears.
};

// When job transitions to terminal state, clear local stopping state
useEffect(() => {
  if (job?.status !== "running") setIsStoppingLocal(false);
}, [job?.status]);
```

**Pending job detail pane** (new state for when a pending command row is selected):
```tsx
if (job._type === "pending") {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <ForgeStatusBadge status={job.status as JobStatus} />
      </div>
      <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
        Queued — waiting for Forge daemon on {job.hostId}…
      </div>
    </div>
  );
}
```

---

### `src/pages/ForgePage.tsx` — wire launch modal trigger + mutations

**Analog:** `src/pages/ForgePage.tsx` (full file, 66 lines)

**Page structure pattern** (lines 17–65):
```tsx
export default function ForgePage() {
  const raw = useForgeJobsRaw();
  const jobs = raw ?? [];
  const isLoading = raw === undefined;
  const [selectedKey, setSelectedKey] = useState<{ hostId: string; forgeJobId: string } | null>(null);
  const selectedJob = selectedKey
    ? (jobs.find((j) => j.hostId === selectedKey.hostId && j.id === selectedKey.forgeJobId) ?? null)
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-4">
      <h1 className="text-2xl font-bold text-foreground shrink-0">Forge</h1>
      <GlassPanel className="flex-1 flex overflow-hidden min-h-0">
        <div className="w-[280px] shrink-0 border-r border-border overflow-hidden">
          <SectionErrorBoundary name="Forge Job List">
            <ForgeJobList /* props */ />
          </SectionErrorBoundary>
        </div>
        <div className="flex-1 overflow-hidden">
          <SectionErrorBoundary name="Forge Job Detail">
            <ForgeJobDetail job={selectedJob} />
          </SectionErrorBoundary>
        </div>
      </GlassPanel>
    </div>
  );
}
```

**Phase 80 additions** (add to ForgePage without changing layout):
```typescript
// New state
const [launchModalOpen, setLaunchModalOpen] = useState(false);
const { commands: pendingCommands } = useForgeCommands(null);  // all hosts

// New Clerk auth check
const { user } = useUser();  // from '@clerk/clerk-react'
const isAuthenticated = user !== null;
```

Add `<ForgeLaunchModal open={launchModalOpen} onClose={() => setLaunchModalOpen(false)} />` after the closing `</GlassPanel>`. Pass `onLaunchClick={() => setLaunchModalOpen(true)}` and `pendingCommands` to `<ForgeJobList>`.

---

## Shared Patterns

### Bearer Auth (daemon-to-Convex, D-14)

**Source:** `convex/ingestAuth.ts` (109 lines)

**Apply to:** `convex/forgeCommands.ts` httpActions (`forgeCommandsClaim`, `forgeCommandsAck`)

```typescript
// convex/ingestAuth.ts:88-97
export function validateForgeIngestAuth(request: Request): boolean {
  const expectedKey = _env.FORGE_INGEST_API_KEY;
  if (!expectedKey) {
    // Fail closed: a missing key must not silently open /forge-ingest to the
    // public internet. Require an explicit opt-in for the dev/anon path.
    return _env.FORGE_INGEST_ALLOW_ANON === "true";
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${expectedKey}`;
}
```

```typescript
// convex/ingestAuth.ts:99-108
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { "Content-Type": "application/json" } }
  );
}
```

**Both functions are already exported** — no changes to `ingestAuth.ts` required.

### CORS Headers (httpAction pattern)

**Source:** `convex/ingestAuth.ts:36-65` + `convex/forgeIngest.ts:21-26`

**Apply to:** All new httpAction handlers in `convex/forgeCommands.ts`

```typescript
// forgeIngest.ts:21-26 — OPTIONS preflight
if (request.method === "OPTIONS") {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request),
  });
}
```

```typescript
// forgeIngest.ts:116-122 — success response always includes CORS headers
return new Response(
  JSON.stringify({ ok: true }),
  { status: 200, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
);
```

### Fail-Closed Clerk Check (D-13 — DIVERGES from read queries)

**Source:** Convex docs pattern applied for Phase 80 — no existing analog in this repo (all mutations in convex/forge.ts are internalMutation called from httpActions, which carry no Clerk identity).

**Apply to:** `enqueueLaunch` and `enqueueStop` mutations in `convex/forge.ts`

```typescript
// D-13: Fail-closed — deliberate divergence from read query graceful-skip convention.
// Read queries in this file have no auth check (no Clerk for httpAction callers).
// DO NOT propagate that pattern here — this is a write/control path.
const identity = await ctx.auth.getUserIdentity();
if (identity === null) {
  throw new Error("Authentication required to issue Forge commands");
}
```

### Index-Based Query Pattern

**Source:** `convex/forge.ts:148-158` (listJobs with withIndex + order + take)

**Apply to:** `listForgeCommands`, `listHosts`, `expireStaleCommands` queries

```typescript
return await ctx.db
  .query("forgeJobs")
  .withIndex("by_host_updatedAt", (q) => q.eq("hostId", hostId))
  .order("desc")
  .take(JOB_LIST_LIMIT);
```

### Cron Entry Pattern

**Source:** `convex/crons.ts:83-88` (docker-health-cleanup interval)

**Apply to:** New `expire-stale-forge-commands` interval entry

```typescript
crons.interval(
  "docker-health-cleanup",
  { minutes: 5 },
  internal.docker.pollHealth
);
```

### SectionErrorBoundary Wrapping

**Source:** `src/pages/ForgePage.tsx:47-54`

**Apply to:** `ForgeLaunchModal` trigger area if added to its own panel region.

```tsx
<SectionErrorBoundary name="Forge Job List">
  <ForgeJobList /* ... */ />
</SectionErrorBoundary>
```

### useQuery Conditional Skip Pattern

**Source:** `src/hooks/useForge.ts:99-107`

**Apply to:** `useForgeCommands(hostId: string | null)` in `useForge.ts`

```typescript
return useQuery(
  api.forge.getJob,
  hostId && forgeJobId ? { hostId, forgeJobId } : "skip"
);
```

### Pure-Logic Test Extraction Pattern

**Source:** `convex/forge.test.ts:20-44`

**Apply to:** All new `convex/forge.test.ts` Phase 80 test sections — extract decision logic as pure functions, test without a live Convex runtime, mark DB round-trips as `.todo`.

---

## No Analog Found

All Phase 80 files have analogs in the codebase or in the cross-repo port source. No files require falling back to RESEARCH.md patterns exclusively.

| File | Role | Data Flow | Notes |
|------|------|-----------|-------|
| `forge/src/emit/command-poller.ts` | service | event-driven | Cross-repo daemon file — no existing Convex-polling service in the Forge repo. Analog is the existing emitter pattern in `forge/src/emit/codepulse-emitter.ts` (fire-and-forget fetch). Pattern map is cross-repo only; RESEARCH.md §Pattern 4 provides the full class scaffold. |

---

## Metadata

**Analog search scope:** `convex/`, `src/components/forge/`, `src/hooks/`, `src/pages/`, `forge/web/src/components/`, `forge/src/emit/`, `convex/crons.ts`

**Files scanned:** 15 source files read directly

**Key corrections to RESEARCH.md assumptions:**
- A1 (`convex/crons.ts` does not exist) is WRONG — the file exists with 14 registered crons. Only a new `crons.interval()` entry is needed, not a new file.
- A4 (`AlertDialog` may not be installed) is confirmed safe — all shadcn primitives including `AlertDialog` are already in `src/components/ui/`.

**Pattern extraction date:** 2026-06-16
