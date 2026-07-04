# Phase 83: Graph Snapshot Receiver — Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 5 (3 create, 2 modify)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `convex/schema.ts` | config | — | `convex/schema.ts` `kgSummary` (L995) + `forgeLogChunks` (L1491) | exact (same file, same conventions) |
| `convex/runtimeIngest.ts` | middleware/router | request-response | `convex/runtimeIngest.ts` `kits_snapshot` (L673) + `kg_summary` (L692) | exact (same file, same switch) |
| `convex/graphSnapshots.ts` | service | CRUD + batch | `convex/forge.ts` `appendLogChunk` + `sweepForgeLogChunks` + `selectCapDeletes`; `convex/kg.ts` `upsertSummary` + `latestSummary` | role-match (exact patterns, different domain) |
| `convex/crons.ts` | config | event-driven | `convex/crons.ts` `sweep-forge-log-chunks` (L112) + `sweep-forge-file-records` (L120) | exact (same file, same daily pattern) |
| `convex/graphSnapshots.test.ts` | test | — | `convex/kg.test.ts` + `convex/forge.test.ts` | exact (same pure-logic test pattern) |

---

## Pattern Assignments

### `convex/schema.ts` (MODIFY — add 3 tables)

**Analog:** `convex/schema.ts` `kgSummary` table (lines 990–1003) and `forgeLogChunks` table (lines 1489–1499)

**Import pattern** (lines 1–3):
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
```

**Table definition pattern — kgSummary** (lines 990–1003):
```typescript
  // Temporal-KG summary snapshot — pushed by Ástríðr's `kg_summary` telemetry
  // event (Phase 135 emitter). Single latest-snapshot semantics: one row,
  // upserted on every event, so the KG Explorer summary cards (Phase 74, KG-01)
  // render even when Ástríðr is offline or before any interactive fetch.
  kgSummary: defineTable({
    entitiesByType: v.record(v.string(), v.float64()),
    totalEntities: v.float64(),
    currentTripleCount: v.float64(),
    historicalTripleCount: v.float64(),
    contradictionCount: v.float64(),
    lastExtractionAt: v.optional(v.string()),  // ISO ts of last extraction, or undefined
    updatedAt: v.float64(),                    // epoch seconds — when CodePulse received it
  }),
```

**Table definition pattern — forgeLogChunks with compound index** (lines 1489–1499):
```typescript
  // Append-only log chunks from Forge daemon. Lines arrive pre-scrubbed.
  // Retention enforced by sweep cron: 7-day TTL + ~1 MB per-job cap (D-2). Phase 81.
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

**What to copy for Phase 83:** Three new tables appended near the end of `defineSchema({...})`, before the closing `})`. Use `v.optional(v.float64())` for `community` (NOT `v.number()` — vault nodes emit `community: null`). Use `v.float64()` for `generatedAt` (NOT `v.string()` — producer emits `time.time()` float). Each entity table gets a single compound index `by_snapshot_version` on `["snapshotId", "version"]`.

---

### `convex/runtimeIngest.ts` (MODIFY — add `case "graph_snapshot"`)

**Analog:** `convex/runtimeIngest.ts` — `kits_snapshot` case (lines 673–690) and `kg_summary` case (lines 692–712)

**Dispatch switch location:** The `switch (evt.eventType)` block starts at line 52. The closing brace for the switch is at line 880. Insert the new case before line 880.

**Core dispatch pattern — kits_snapshot** (lines 673–690):
```typescript
        case "kits_snapshot": {
          // Phase 72: tool-kit membership snapshot from Ástríðr. Upserts each
          // kit idempotently by name, replacing its `tools` array wholesale.
          const d = data as any;
          if (Array.isArray(d.kits)) {
            const updatedAt = d.timestamp ?? timestamp;
            for (const kit of d.kits) {
              const name = kit?.name;
              if (!name) continue;
              await ctx.runMutation(api.kits.upsertKit, {
                name,
                description: kit.description,
                tools: Array.isArray(kit.tools) ? kit.tools : [],
                updatedAt,
              });
            }
          }
          break;
        }
```

**Core dispatch pattern — kg_summary** (lines 692–712):
```typescript
        case "kg_summary": {
          // Phase 135 emitter → Phase 74 KG Explorer summary cards (KG-01).
          // Latest-wins upsert of the single KG summary snapshot.
          const d = data as any;
          await ctx.runMutation(api.kg.upsertSummary, {
            entitiesByType: d.entitiesByType ?? d.entities_by_type ?? {},
            currentTripleCount:
              d.currentTripleCount ?? d.current_triple_count ?? d.currentTriples ?? 0,
            historicalTripleCount:
              d.historicalTripleCount ??
              d.historical_triple_count ??
              d.historicalTriples ??
              0,
            contradictionCount:
              d.contradictionCount ?? d.contradiction_count ?? 0,
            lastExtractionAt: d.lastExtractionAt ?? d.last_extraction_at ?? undefined,
            updatedAt: d.timestamp ?? timestamp,
          });
          break;
        }
```

**What to copy for Phase 83:** Follow `kg_summary` exactly: one `runMutation` call, `internal.graphSnapshots.upsertGraphSnapshot` (NOT `api.*` — httpAction requires `internal.*`), defensive `d.field ?? 0` / `Array.isArray(d.field) ? d.field : []` access, trailing `break;`. The `data` and `timestamp` variables are already available in scope from lines 39–40.

**Ingest auth — already wired at lines 14–22 (no change needed):**
```typescript
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }
```

---

### `convex/graphSnapshots.ts` (CREATE)

This file has no single analog — it combines patterns from three source files.

#### Part A: Module header + imports

**Analog:** `convex/forge.ts` lines 1–17
```typescript
/**
 * Forge integration mutations and read queries (Phases 78 + 80).
 *
 * Phase 78: upsertJob / upsertWorkspaces are internalMutation — called
 * exclusively from the /forge-ingest httpAction (no Clerk identity).
 * listJobs / getJob / listWorkspaces are public queries (graceful-skip convention).
 */

import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
```

**What to copy for Phase 83:** Same JSDoc comment style explaining that `upsertGraphSnapshot` and `sweepGraphSnapshotVersions` are `internalMutation` (called from httpAction — no Clerk identity), while `getProjectGraph` and `listSnapshots` are public `query` (graceful-skip).

Import line: `import { internalMutation, query } from "./_generated/server";` (no `mutation` — there are no public mutations in this module).

#### Part B: Pure-logic helper — `selectVersionDeletes`

**Analog:** `convex/forge.ts` `selectCapDeletes` (lines 561–577)
```typescript
/**
 * Given an array of surviving chunks for a SINGLE job (ordered by seq ascending,
 * oldest first), returns the oldest chunks that must be deleted to bring the
 * total byte count at or below `capBytes`. Newest chunks always survive.
 */
export function selectCapDeletes<T extends { _id: any; seq: number; lines: string[] }>(
  chunks: T[],
  capBytes: number
): T[] {
  let total = chunks.reduce((acc, c) => acc + chunkByteSize(c), 0);
  if (total <= capBytes) return [];
  const toDelete: T[] = [];
  for (const chunk of chunks) {
    if (total <= capBytes) break;
    toDelete.push(chunk);
    total -= chunkByteSize(chunk);
  }
  return toDelete;
}
```

**What to copy for Phase 83:** Export a named constant + pure function with the same structure. The `selectVersionDeletes` version is simpler (integer comparison, not byte accounting):
```typescript
export const GRAPH_SNAPSHOT_KEEP_VERSIONS = 7;

/** Given all known versions for a snapshotId (any order), returns those to delete. */
export function selectVersionDeletes(versions: number[], keepN: number): number[] {
  if (versions.length <= keepN) return [];
  const sorted = [...versions].sort((a, b) => a - b); // ascending = oldest first
  return sorted.slice(0, sorted.length - keepN);
}
```
Exported so `graphSnapshots.test.ts` can import it without a live Convex runtime — same pattern as `forge.ts` exporting `selectCapDeletes`/`selectTtlDeletes`.

#### Part C: `upsertGraphSnapshot` internalMutation

**Analog:** `convex/forge.ts` `appendLogChunk` (lines 623–651) for the `internalMutation` shape and idempotency pattern; `convex/kg.ts` `upsertSummary` (lines 20–50) for the patch-or-insert pattern.

**appendLogChunk — internalMutation + idempotency** (lines 623–651):
```typescript
export const appendLogChunk = internalMutation({
  args: {
    hostId:     v.string(),
    forgeJobId: v.string(),
    lines:      v.array(v.string()),
    seq:        v.number(),
    sentAt:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // D-1 idempotency: skip insert if (hostId, forgeJobId, seq) already exists.
    const existing = await ctx.db
      .query("forgeLogChunks")
      .withIndex("by_host_job_seq", (q) =>
        q.eq("hostId", args.hostId).eq("forgeJobId", args.forgeJobId).eq("seq", args.seq)
      )
      .unique();
    if (existing) return;  // Idempotent no-op
    await ctx.db.insert("forgeLogChunks", { ... });
  },
});
```

**kg.ts upsertSummary — patch-or-insert** (lines 20–50):
```typescript
export const upsertSummary = mutation({
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("kgSummary").first();
    const doc = { ... };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("kgSummary", doc);
    }
  },
});
```

**What to copy for Phase 83:** `upsertGraphSnapshot` is `internalMutation` (not `mutation`). Args use `v.array(v.object({...}))` for nodes/links/sources. Handler:
1. Query `graphSnapshots` by `snapshotId` index to get existing doc.
2. Compute `newVersion = (existing?.activeVersion ?? 0) + 1`.
3. Build a `Set<string>` of incoming `nodeId` values (dangling-link guard — D-05).
4. Filter `links` to those where both `source` and `target` are in the set.
5. Loop `nodes` in chunks of 1,000: `ctx.db.insert("graphSnapshotNodes", {...})`.
6. Loop filtered `links` in chunks of 1,000: `ctx.db.insert("graphSnapshotLinks", {...})`.
7. Patch-or-insert the `graphSnapshots` meta doc with `activeVersion = newVersion` and counts.

The pointer flip (step 7) happens last — readers always see a complete previous version while new rows are inserting.

#### Part D: `getProjectGraph` public query

**Analog:** `convex/kg.ts` `latestSummary` (lines 52–58) for graceful-skip; `convex/forge.ts` `listJobLogs` pattern for indexed range reads.

**kg.ts latestSummary — graceful-skip** (lines 52–58):
```typescript
/** Latest KG summary snapshot, or null before any telemetry has arrived. */
export const latestSummary = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("kgSummary").first();
  },
});
```

**What to copy for Phase 83:** `getProjectGraph` is a public `query` (no `internalQuery`). Returns `null` when no meta doc exists (graceful-skip). Uses `withIndex("by_snapshotId", ...)` on the meta table, then `withIndex("by_snapshot_version", (q) => q.eq("snapshotId", ...).eq("version", meta.activeVersion)).collect()` for nodes and links. Node/link rows are mapped to clean output objects (strip Convex `_id`/`_creationTime`).

#### Part E: `listSnapshots` public query

**Analog:** `convex/kg.ts` `latestSummary` pattern; any `forge.ts` list query.

**What to copy for Phase 83:** `query({ args: {}, handler: async (ctx) => ctx.db.query("graphSnapshots").collect() })`. Returns `[{snapshotId, nodeCount, linkCount, generatedAt, updatedAt}]` — strip internal fields.

#### Part F: `sweepGraphSnapshotVersions` internalMutation

**Analog:** `convex/forge.ts` `sweepForgeLogChunks` (lines 579–617)
```typescript
export const sweepForgeLogChunks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allChunks = await ctx.db.query("forgeLogChunks").collect();
    const ttlDeletes = selectTtlDeletes(allChunks, now);
    for (const chunk of ttlDeletes) {
      await ctx.db.delete(chunk._id);
    }
    const ttlDeletedIds = new Set(ttlDeletes.map((c) => c._id));
    const surviving = allChunks.filter((c) => !ttlDeletedIds.has(c._id));
    const byJob = new Map<string, typeof surviving>();
    for (const chunk of surviving) {
      const key = `${chunk.hostId}::${chunk.forgeJobId}`;
      if (!byJob.has(key)) byJob.set(key, []);
      byJob.get(key)!.push(chunk);
    }
    for (const chunks of byJob.values()) {
      chunks.sort((a, b) => a.seq - b.seq);
      const capDeletes = selectCapDeletes(chunks, LOG_BYTE_CAP_PER_JOB);
      for (const chunk of capDeletes) {
        await ctx.db.delete(chunk._id);
      }
    }
  },
});
```

**What to copy for Phase 83:** Mirror this two-pass structure but adapted for version retention:
1. Read all `graphSnapshots` meta docs (few rows — at most one per snapshotId).
2. For each, derive the full list of stored versions by querying the `by_snapshot_version` index for `graphSnapshotNodes` (one count-check per version).
3. Call `selectVersionDeletes(allVersions, GRAPH_SNAPSHOT_KEEP_VERSIONS)` to get versions to drop.
4. For each version-to-delete: collect all `graphSnapshotNodes` and `graphSnapshotLinks` rows by `(snapshotId, version)` index and delete. Process ONE version at a time per mutation call (one old version = ~13,500 deletes = within the 16,000-doc write limit; two = ~27,000 = over limit). Use a document-count guard to stop before hitting the limit.

Key difference from `sweepForgeLogChunks`: Do NOT `collect()` the entire `graphSnapshotNodes` table unconditionally — scope the collect to the `by_snapshot_version` index for identified candidate versions only (avoids hitting the 32,000-doc scan limit).

---

### `convex/crons.ts` (MODIFY — add one daily entry)

**Analog:** `convex/crons.ts` lines 111–124 — `sweep-forge-log-chunks` and `sweep-forge-file-records`

```typescript
// Phase 81: Forge log retention (D-2)
crons.daily(
  "sweep-forge-log-chunks",
  { hourUTC: 3, minuteUTC: 30 },
  internal.forge.sweepForgeLogChunks,
);

// Phase 82: Forge file/artifact retention (D-05)
// Offset from the 03:30 log sweep to avoid scheduler contention.
crons.daily(
  "sweep-forge-file-records",
  { hourUTC: 4, minuteUTC: 0 },
  internal.forge.sweepForgeFileRecords,
);
```

**What to copy for Phase 83:** Add one entry after the `sweep-forge-file-records` entry, offset by 30 minutes to avoid contention:
```typescript
// Phase 83: Graph snapshot version retention (D-03)
// Offset from the 04:00 file sweep to avoid scheduler contention.
crons.daily(
  "sweep-graph-snapshot-versions",
  { hourUTC: 4, minuteUTC: 30 },
  internal.graphSnapshots.sweepGraphSnapshotVersions,
);
```

The file's structure is: import block (lines 1–3), `cronJobs()` init (line 4), sequential `crons.interval`/`crons.daily` calls, `export default crons` (line 126). Insert before the export.

---

### `convex/graphSnapshots.test.ts` (CREATE)

**Analog:** `convex/kg.test.ts` (lines 1–95) — pure-logic test structure, `mapEvent` mirror function pattern, `.todo` for DB round-trips. Also `convex/forge.test.ts` lines 1–45 for how pure helpers are imported and tested.

**Test file header + import pattern** (`convex/kg.test.ts` lines 1–5):
```typescript
import { describe, it, expect } from "vitest";

/**
 * Pure-logic mirrors of the `kg_summary` ingest dispatch + the upsertSummary
 * derivation (mirroring the repo's kits.test.ts style — no DB round-trip).
 */
```

**Pure-helper test pattern** (`convex/forge.test.ts` lines 9–45):
```typescript
// Mirror of the upsertJob "should I patch?" decision without a DB.
function shouldPatchJob(existingUpdatedAt: string, incomingUpdatedAt: string): boolean {
  return incomingUpdatedAt >= existingUpdatedAt;
}

describe("forge.upsertJob — last-writer-wins logic (SC#2)", () => {
  it("patches when incoming updatedAt is newer than existing", () => {
    expect(shouldPatchJob("2024-01-01T00:00:00.000Z", "2024-01-01T00:00:01.000Z")).toBe(true);
  });
  // ...
  it.todo("should patch the single existing row on re-ingest (DB round-trip)");
});
```

**kg.test.ts dispatch-mapping mirror pattern** (lines 8–21):
```typescript
// Mirrors the `case "kg_summary"` branch in runtimeIngest.ts.
const mapKgSummaryEvent = (d: any, fallbackTs: number) => ({
  entitiesByType: d.entitiesByType ?? d.entities_by_type ?? {},
  // ...
});
```

**What to copy for Phase 83:** The test file should:
1. `import { describe, it, expect } from "vitest"` — no Convex imports.
2. `import { selectVersionDeletes, GRAPH_SNAPSHOT_KEEP_VERSIONS } from "./graphSnapshots"` — direct import of the exported pure helper.
3. A `mapGraphSnapshotEvent` mirror function that replicates the defensive `??` access from the dispatch case.
4. A `filterDanglingLinks` mirror function that replicates the dangling-link guard logic.
5. `describe` blocks for GH-01a through GH-01f (see RESEARCH.md Validation Architecture section for the full test map).
6. DB round-trip tests marked `it.todo(...)`.

---

## Shared Patterns

### internalMutation for httpAction-driven writes
**Source:** `convex/forge.ts` lines 1–13 (module JSDoc), `convex/forgeLogIngest.ts` line 58
**Apply to:** `upsertGraphSnapshot` and `sweepGraphSnapshotVersions` in `convex/graphSnapshots.ts`
```typescript
// forgeLogIngest.ts line 58 — the call site:
await ctx.runMutation(internal.forge.appendLogChunk, {
  hostId, forgeJobId, lines, seq, sentAt: body.sentAt ?? undefined,
});
// NOTE: internal.* not api.* — httpActions have no Clerk identity
```
Rule: Any mutation called from a `httpAction` via `ctx.runMutation` must be declared `internalMutation` and imported via `internal.graphSnapshots.*`, not `api.graphSnapshots.*`.

### Public graceful-skip read query
**Source:** `convex/kg.ts` lines 52–58
**Apply to:** `getProjectGraph` and `listSnapshots` in `convex/graphSnapshots.ts`
```typescript
export const latestSummary = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("kgSummary").first();
  },
});
```
Rule: Read queries return `null` (not throw) when no data exists yet. No auth check — consistent with `kg.latestSummary`, `forge.listJobs`.

### Ingest bearer auth (already live — no change needed)
**Source:** `convex/ingestAuth.ts` lines 72–108; `convex/runtimeIngest.ts` lines 19–22
**Apply to:** No new auth surface needed. `validateIngestAuth` already guards `/runtime-ingest` before the switch dispatch.
```typescript
// runtimeIngest.ts lines 19–22
if (!validateIngestAuth(request)) {
  return unauthorizedResponse();
}
```

### Defensive field access pattern
**Source:** `convex/runtimeIngest.ts` lines 696–710 (kg_summary case)
**Apply to:** `case "graph_snapshot"` in `runtimeIngest.ts`, all arg reads in `upsertGraphSnapshot`
```typescript
const d = data as any;
// Pattern: camelCase ?? snake_case ?? default
d.entitiesByType ?? d.entities_by_type ?? {}
d.currentTripleCount ?? d.current_triple_count ?? d.currentTriples ?? 0
// For arrays:
Array.isArray(d.nodes) ? d.nodes : []
```

### Pure-helper export for testability
**Source:** `convex/forge.ts` lines 530–577 (exported `selectTtlDeletes`, `selectCapDeletes`, `chunkByteSize`, `LOG_BYTE_CAP_PER_JOB`)
**Apply to:** `selectVersionDeletes` and `GRAPH_SNAPSHOT_KEEP_VERSIONS` in `convex/graphSnapshots.ts`

Rule: Export pure functions and constants at module level so test files can import them directly without any Convex runtime mock. Never inline the selection logic inside the `internalMutation` handler.

---

## No Analog Found

All five files have close analogs. No entries in this section.

---

## Critical Gotchas (extracted from RESEARCH.md — executor must not miss these)

| Gotcha | File | What to do |
|--------|------|------------|
| `community` is `null` for vault nodes | `convex/schema.ts` | Use `v.optional(v.float64())` — NOT `v.number()` |
| `generatedAt` is a float64 epoch seconds | `convex/schema.ts`, `convex/graphSnapshots.ts` | Use `v.float64()` — NOT `v.string()` |
| `upsertGraphSnapshot` must be `internalMutation` | `convex/graphSnapshots.ts` | Calling `api.*` from a httpAction throws a Clerk identity runtime error |
| Flip `activeVersion` LAST | `convex/graphSnapshots.ts` | Write all node/link rows first; readers see complete previous version during write |
| Dangling-link guard required | `convex/graphSnapshots.ts` | Build `Set<string>` of stored nodeIds, filter links before inserting |
| Sweep: process one old version per mutation | `convex/graphSnapshots.ts` | Two versions = ~27,000 deletes > 16,000-doc write limit; add a doc-count guard |
| Sweep: scope index collect, not full table | `convex/graphSnapshots.ts` | Full table collect could exceed 32,000-doc scan limit at N versions |

---

## Metadata

**Analog search scope:** `convex/` directory (all `.ts` files)
**Files read:** `runtimeIngest.ts`, `kg.ts`, `forge.ts`, `forgeLogIngest.ts`, `schema.ts` (targeted ranges), `crons.ts`, `ingestAuth.ts`, `kg.test.ts`, `forge.test.ts`
**Pattern extraction date:** 2026-06-18
