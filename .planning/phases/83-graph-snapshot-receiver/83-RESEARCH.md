# Phase 83: Graph Snapshot Receiver — Research

**Researched:** 2026-06-18
**Domain:** Convex backend — new tables, ingest dispatch, retention cron, read API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Storage:** `graphSnapshots` meta doc (1 row/snapshotId, `activeVersion` pointer) + `graphSnapshotNodes` / `graphSnapshotLinks` entity rows keyed by `snapshotId` + `version`. NOT a single-blob doc (blob would hit array-element and doc-size limits).
- **D-02 Replacement:** Versioned swap — write new version rows, flip `activeVersion` last, sweep old versions.
- **D-02a (research target):** Confirm per-mutation write limits vs ~13.5k rows; batch if needed.
- **D-03 Retention:** Keep last N≈7 versions per snapshotId via a retention sweep cron mirroring `sweepForgeLogChunks`.
- **D-04 Read API:** `getProjectGraph({snapshotId?})` returning active version's `{snapshotId, sources[], nodeCount, linkCount, storedNodeCount, storedLinkCount, generatedAt, nodes[], links[]}` + `listSnapshots()`.
- **D-04a (research target):** Confirm per-query read limits vs ~13.5k rows; paginate if needed.
- **D-05 Truncation:** Store producer `sources[]` verbatim. Defensively drop dangling links on receive. Record receiver `storedNodeCount` / `storedLinkCount` on the meta doc.
- **Ingest auth:** Reuse `validateIngestAuth` / `unauthorizedResponse` / `getCorsHeaders` — no new auth surface.
- **Envelope:** `{eventType: "graph_snapshot", data: {…payload}}` — read via `data = evt.data ?? evt`.
- **internalMutation for entity writers:** httpActions have no Clerk identity (same rule as `forge.appendLogChunk`).

### Claude's Discretion

- Exact schema field names/types and index names for the three tables.
- Internal `version` representation (monotonic int vs ingest timestamp vs ulid).
- Batch sizes for the versioned write and the retention sweep cadence.
- Whether `getProjectGraph` defaults `snapshotId` to the single known id (`"astridr-project-graph"`) or the most-recently-updated snapshot.
- Mutation kind: entity-row writers are `internalMutation`.

### Deferred Ideas (OUT OF SCOPE)

- Multi-project / multi-snapshotId support (schema is keyed for it but today only one stable id exists).
- Code/vault-graph temporal diff UI — Phase 87 (KG-11).
- Snapshot freshness/staleness banner — Phase 84 client concern.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GH-01 | A `graphSnapshots` Convex table + `runtimeIngest` dispatch for the `graph_snapshot` event (idempotent on `snapshotId`, full-replacement) + a read query API — so Ástríðr's nightly code/vault snapshots are stored instead of dropped. | Producer confirmed wired; exact payload shape locked from source; Convex limits confirmed; batching strategy derived; full pattern documented below. |
</phase_requirements>

---

## Summary

Phase 83 is a pure Convex backend addition: three new tables, one new `case` in the `runtimeIngest` dispatch switch, a `convex/graphSnapshots.ts` module, and a new cron entry. No frontend work.

The Ástríðr-side producer (`astridr/automation/graph_snapshot.py`) is fully operational: it is registered in the nightly cron as `graph:snapshot` (schedule `15 0 * * *`, depends on `graphify:nightly_update`), wired in `CronDispatcher._run_graph_snapshot`, and pointed at `config/graphify.yaml` repos (`/app/repos/astridr-repo`, `/app/repos/codepulse`) plus `OBSIDIAN_VAULT_PATH` from env. Graphify `graph.json` files for both repos exist when the nightly update runs. Every emit carries the exact payload shape confirmed below.

The core design challenge is Convex transaction limits vs volume. Confirmed limits are 16,000 documents and 16 MiB written per mutation, and 32,000 documents / 16 MiB read per query. A worst-case snapshot writes ~4,500 nodes + ~9,000 links = ~13,500 rows — safely inside the per-mutation document limit as a single batch. However, the node/link rows are small (~150–200 bytes each), so ~2 MiB written per version, well under the 16 MiB cap. **No mandatory batching is required at current scale.** Recommended batch size of 1,000 rows per `internalMutation` call is a defensive choice for headroom; the implementation can start with a single mutation and add batching later if needed without changing the API contract.

**Primary recommendation:** Implement in one new `convex/graphSnapshots.ts` module. Write meta + node + link rows in a single `internalMutation` (or batched at 1,000 rows if defensive); flip `activeVersion` pointer in a separate small `internalMutation` last; register a `crons.daily` sweep at 04:30 UTC. The `getProjectGraph` query reading ~13,500 rows is safe within the 32,000-document read limit.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Receive `graph_snapshot` events | API / Backend (Convex httpAction) | — | All ingest flows through `/runtime-ingest` bearer-authed httpAction already |
| Persist node/link rows | Database / Storage (Convex tables) | — | Row-based persistence to avoid doc/array limits |
| Version-swap atomicity | API / Backend (internalMutation) | — | `activeVersion` pointer flip is the single atomic gate |
| Retention sweep | API / Backend (Convex cron) | — | Mirrors `sweepForgeLogChunks` pattern |
| Read query for rendering | API / Backend (Convex query) | — | Phase 84 consumes via `useQuery(api.graphSnapshots.getProjectGraph)` |
| Source/community filtering | Browser / Client | — | Locked decision D-04; client-side, no reload (GAL-04 precedent) |

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | ~1.x (project current) | Tables, mutations, queries, crons, httpActions | The project's entire backend |
| vitest | ~2.x (project current) | Unit tests for pure-logic helpers | Established test framework |

No new packages. This phase is 100% Convex backend additions and their pure-logic unit tests.

### Installation

None required.

---

## Package Legitimacy Audit

No external packages are installed in this phase. Section not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
Ástríðr nightly cron (graph:snapshot, 00:15 UTC)
  └─ emit_graph_snapshot(telemetry, graphify_repos, vault_path)
       └─ telemetry.send("graph_snapshot", payload)
            └─ POST /runtime-ingest  { eventType: "graph_snapshot", data: payload }
                 │
                 ▼
         runtimeIngest (httpAction)
           validateIngestAuth()  ──► 401 if missing/wrong key
           case "graph_snapshot":
             const d = data as any;
             await ctx.runMutation(internal.graphSnapshots.upsertGraphSnapshot, {…})
                  │
                  ├─ internalMutation: writeNodes(snapshotId, version, nodes[])
                  ├─ internalMutation: writeLinks(snapshotId, version, links[])
                  └─ internalMutation: flipActiveVersion(snapshotId, version, meta)
                                             │
                                             ▼
                                    graphSnapshots  (1 row/snapshotId)
                                    graphSnapshotNodes  (~4,500 rows)
                                    graphSnapshotLinks  (~9,000 rows)
                                             │
                              Convex cron (04:30 UTC)
                              sweepGraphSnapshotVersions()
                              keeps N=7 versions, deletes older
                                             │
                              Phase 84 reads:
                              useQuery(api.graphSnapshots.getProjectGraph)
                              useQuery(api.graphSnapshots.listSnapshots)
```

### Recommended Project Structure

```
convex/
├── graphSnapshots.ts     # NEW: upsertGraphSnapshot internalMutation + helpers
│                         #      getProjectGraph query + listSnapshots query
│                         #      sweepGraphSnapshotVersions internalMutation
│                         #      pure-logic helpers: selectVersionDeletes
├── schema.ts             # ADD: graphSnapshots, graphSnapshotNodes, graphSnapshotLinks tables
├── runtimeIngest.ts      # ADD: case "graph_snapshot" dispatch
├── crons.ts              # ADD: crons.daily("sweep-graph-snapshot-versions", ...)
convex/__tests__/ (or top-level)
├── graphSnapshots.test.ts  # NEW: pure-logic unit tests
```

### Pattern 1: Three-Table Schema (follows kgSummary + Forge precedent)

**What:** One meta row in `graphSnapshots` holds the `activeVersion` pointer and aggregate counts. Entity rows in `graphSnapshotNodes` and `graphSnapshotLinks` are keyed by `(snapshotId, version)`. Each table has a compound index `by_snapshot_version` on `["snapshotId", "version"]` for efficient range reads and sweeps.

**Why not single blob:** The producer's worst-case payload is ~4,500 nodes × ~200 bytes = ~900 kB for nodes alone, plus links, exceeds the ~1 MiB document limit. The `links` array alone at ~9,000 elements exceeds the 8,192-element array field limit. [VERIFIED: docs.convex.dev/production/state/limits]

**Schema (recommended field set):**

```typescript
// Source: convex/schema.ts conventions near kgSummary (~L993) and Forge tables
graphSnapshots: defineTable({
  snapshotId:       v.string(),           // stable "astridr-project-graph"
  activeVersion:    v.number(),           // monotonic int — incremented on each ingest
  sources:          v.array(v.object({
    source:             v.string(),
    kind:               v.string(),
    nodeCount:          v.float64(),
    linkCount:          v.float64(),
    emittedNodeCount:   v.float64(),
    emittedLinkCount:   v.float64(),
    truncated:          v.boolean(),
  })),
  nodeCount:        v.float64(),          // producer's total merged nodeCount
  linkCount:        v.float64(),          // producer's total merged linkCount
  storedNodeCount:  v.float64(),          // receiver-side: how many nodes actually persisted
  storedLinkCount:  v.float64(),          // receiver-side: after dangling-link drop
  generatedAt:      v.float64(),          // epoch seconds (producer's payload.generatedAt)
  updatedAt:        v.float64(),          // epoch seconds (when CodePulse stored this)
}).index("by_snapshotId", ["snapshotId"]),

graphSnapshotNodes: defineTable({
  snapshotId: v.string(),
  version:    v.number(),
  nodeId:     v.string(),                 // pre-namespaced: "graphify:repo:" or "vault:"
  label:      v.string(),
  type:       v.string(),
  community:  v.optional(v.float64()),    // nullable in producer
  source:     v.string(),
}).index("by_snapshot_version", ["snapshotId", "version"]),

graphSnapshotLinks: defineTable({
  snapshotId: v.string(),
  version:    v.number(),
  source:     v.string(),                 // namespaced node id
  target:     v.string(),                 // namespaced node id
  relation:   v.string(),
}).index("by_snapshot_version", ["snapshotId", "version"]),
```

**Version representation:** Monotonic integer stored on the `graphSnapshots` meta doc. Each ingest reads `existing.activeVersion ?? 0` and increments by 1. This makes the sweep selector trivially correct (`version < activeVersion - (N-1)`) without parsing timestamps.

### Pattern 2: Versioned Swap — httpAction Orchestration

**What:** The `runtimeIngest` case calls `ctx.runMutation` sequentially. The final flip of `activeVersion` is the last and smallest mutation, making it the atomic durability gate.

**Concrete orchestration (runtimeIngest.ts case):**

```typescript
// Source: convex/runtimeIngest.ts conventions — case "kits_snapshot" (~L673) and
//         convex/forgeIngest.ts → internal.forge.upsertJob pattern
case "graph_snapshot": {
  const d = data as any;
  await ctx.runMutation(internal.graphSnapshots.upsertGraphSnapshot, {
    snapshotId:  d.snapshotId ?? "astridr-project-graph",
    nodes:       Array.isArray(d.nodes) ? d.nodes : [],
    links:       Array.isArray(d.links) ? d.links : [],
    sources:     Array.isArray(d.sources) ? d.sources : [],
    nodeCount:   d.nodeCount ?? 0,
    linkCount:   d.linkCount ?? 0,
    generatedAt: d.generatedAt ?? timestamp,
    receivedAt:  timestamp,
  });
  break;
}
```

The `upsertGraphSnapshot` internalMutation handles the full versioned-swap internally:
1. Reads `graphSnapshots` by `snapshotId` to get current `activeVersion` (or 0 if first insert).
2. Computes `newVersion = (existing?.activeVersion ?? 0) + 1`.
3. Drops links with source or target not in the stored node set (dangling-link guard, D-05).
4. Inserts `graphSnapshotNodes` rows in batches.
5. Inserts `graphSnapshotLinks` rows in batches.
6. Patches (or inserts) the `graphSnapshots` meta doc with `activeVersion = newVersion` + counts.

**Why all in one mutation (not separate mutations):** At 13,500 rows and ~2 MiB, a single mutation stays well within both limits (16,000 docs, 16 MiB). Separate mutations would make the flip non-atomic with the row writes — the existing node/link rows under the old `activeVersion` remain readable until the flip, which is correct. The flip being last means readers always see a complete, consistent version.

**Batch size recommendation:** Process nodes and links in chunks of 1,000 inserts per loop iteration inside the single mutation. This keeps each loop iteration cheap and gives headroom if future graphs grow. No separate `internalMutation` fan-out is needed at current scale.

### Pattern 3: Read Queries (public graceful-skip)

**`getProjectGraph({snapshotId?})`:**
1. Query `graphSnapshots` by `snapshotId` (defaults to `"astridr-project-graph"`).
2. If no meta doc exists, return `null` (graceful-skip — consistent with `kg.latestSummary`).
3. Read `graphSnapshotNodes` by `(snapshotId, activeVersion)` using `by_snapshot_version` index → `.collect()`.
4. Read `graphSnapshotLinks` by `(snapshotId, activeVersion)` using `by_snapshot_version` index → `.collect()`.
5. Return `{snapshotId, sources, nodeCount, linkCount, storedNodeCount, storedLinkCount, generatedAt, nodes, links}`.

At worst-case ~4,500 nodes + ~9,000 links = ~13,500 rows read: safely within the 32,000-document query limit. [VERIFIED: docs.convex.dev/production/state/limits]

**`listSnapshots()`:**
1. Query all `graphSnapshots` rows → `.collect()`.
2. Return array of `{snapshotId, nodeCount, linkCount, generatedAt, updatedAt}`.
Today: at most 1 row. Future: bounded by number of distinct `snapshotId` values.

### Pattern 4: Retention Sweep — `selectVersionDeletes` Pure Helper

**What:** A pure function takes the list of `(snapshotId, version)` pairs and returns those to delete (keeping the N newest). The cron `internalMutation` calls it, then deletes all node/link rows for those (snapshotId, version) pairs.

**Concrete helper pattern (mirrors `selectCapDeletes` from forge.ts):**

```typescript
// Source: convex/forge.ts selectCapDeletes (~L561) adapted for version retention
export const GRAPH_SNAPSHOT_KEEP_VERSIONS = 7;

/** Given all versions for a snapshotId (ascending), returns those to delete. */
export function selectVersionDeletes(versions: number[], keepN: number): number[] {
  if (versions.length <= keepN) return [];
  const sorted = [...versions].sort((a, b) => a - b); // ascending = oldest first
  return sorted.slice(0, sorted.length - keepN);       // drop oldest
}
```

**Sweep cron shape:**
```typescript
// Source: convex/crons.ts conventions — offset from 04:00 sweep-forge-file-records
crons.daily(
  "sweep-graph-snapshot-versions",
  { hourUTC: 4, minuteUTC: 30 },
  internal.graphSnapshots.sweepGraphSnapshotVersions,
);
```

The sweep `internalMutation`:
1. Collects all `graphSnapshotNodes` grouped by `(snapshotId, version)` — or queries the `graphSnapshots` meta doc for `activeVersion` and derives the full version list.
2. Calls `selectVersionDeletes` per snapshotId.
3. For each version-to-delete: deletes all `graphSnapshotNodes` and `graphSnapshotLinks` rows with that `(snapshotId, version)`.

**Sweep volume concern:** Deleting one old version = ~13,500 rows. That is within the 16,000-document write limit per mutation. If multiple old versions accumulate (e.g., 3 over-limit versions), process one version per mutation call (the cron can call itself or use batched loops with a guard). [ASSUMED — the correct behavior when multiple versions need sweeping is to limit per-mutation deletes; the concrete per-call guard should be decided at plan time.]

### Pattern 5: Naming Resolution (ROADMAP vs CONTEXT naming)

The CONTEXT.md uses `getProjectGraph` / `listSnapshots` and the ROADMAP success criteria sketch `api.graphs.listSnapshots` / `api.graphs.getSnapshot`. These can be reconciled without conflict:

**Recommended final names:**
- Module: `convex/graphSnapshots.ts` (not `graphs.ts` — avoids collision with a future `graphs.ts` hub module in Phase 84)
- Exports: `getProjectGraph`, `listSnapshots` (CONTEXT.md names win — more descriptive)
- Convex `api` path: `api.graphSnapshots.getProjectGraph`, `api.graphSnapshots.listSnapshots`
- Dispatch case: `case "graph_snapshot":` → `internal.graphSnapshots.upsertGraphSnapshot`

This is consistent with naming conventions in `convex/kg.ts` (`api.kg.upsertSummary` / `api.kg.latestSummary`) and `convex/forge.ts`.

### Anti-Patterns to Avoid

- **Single blob doc for nodes/links:** Hits array-element limit (8,192) and doc-size limit (~1 MiB) at worst-case payload. Confirmed by Convex limits docs. [VERIFIED: docs.convex.dev/production/state/limits]
- **Flipping `activeVersion` before inserting new rows:** Readers would see a partially-written new version. Always write rows first, flip last.
- **Using `mutation` (public) instead of `internalMutation`:** httpActions have no Clerk identity; calling `api.graphSnapshots.*` from `ctx.runMutation` in the httpAction requires `internal.*`. [CITED: convex/STATE.md Phase 81 implementation note — "appendLogChunk is internalMutation (not mutation) — httpActions have no Clerk identity"]
- **Skipping the dangling-link guard on receive:** The producer already drops dangling links before emit, but the receiver should guard defensively (D-05) — a truncated payload where the node cap and link cap interact differently could still produce danglers.
- **Collecting all versions in the sweep without a per-mutation document guard:** If no graph has been ingested for 8+ days, the sweep might need to delete 2+ versions at once, totalling 27,000 rows — exceeding the 16,000-document write limit. Add a per-version loop with a document-count guard.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth on ingest | Custom header check | `validateIngestAuth` from `ingestAuth.ts` | Already handles bearer token comparison, returns correct 401 shape |
| CORS | Custom headers | `getCorsHeaders` from `ingestAuth.ts` | Already wired for all ingest routes |
| Cron registration | Raw cron.ts add | `crons.daily(...)` in existing `crons.ts` | Established pattern; planner just adds one entry |
| Pure-logic test helper isolation | Live Convex runtime tests | Export pure functions from `graphSnapshots.ts`, test in vitest | `forge.test.ts` / `kg.test.ts` precedent — no Convex runtime needed for logic tests |

---

## Flagged Research Targets — Resolved

### Research Target 1: Is the Producer Actually Wired and Firing?

**CONFIRMED. HIGH confidence.** [VERIFIED: cron_builders.py L641–669, cron_dispatcher.py L237–238, L538–553]

- `cron_builders.py` L641–669: `graph:snapshot` cron is registered when `config.graphify.enabled and config.graphify.repos` — condition is true (graphify.yaml: `enabled: true`, two repos listed).
- Schedule: `"15 0 * * *"` (00:15 UTC) — runs 15 minutes after the `graphify:nightly_update` cron (00:00 UTC), so it snapshots fresh graph data.
- `depends_on=["graphify:nightly_update"]` — will not fire if graphify fails.
- `cron_dispatcher.py` L237: `elif job.name == "graph:snapshot":` → calls `self._run_graph_snapshot()`.
- `cron_dispatcher.py` L538–553: `_run_graph_snapshot` calls `emit_graph_snapshot(self._telemetry, graphify_repos=list(graphify_cfg.repos), vault_path=self._config.obsidian_vault_path)`.
- `graphify.yaml` repos: `/app/repos/astridr-repo`, `/app/repos/codepulse` — both have `graphify-out/graph.json` after the nightly graphify run.
- `vault_path` comes from `config.obsidian_sync.yaml`: `OBSIDIAN_VAULT_PATH` env var (defaults to `/app/vault`).

**Fixture-POST recommendation:** YES, a fixture POST is needed for initial end-to-end verification without waiting for the nightly cron. The verification procedure should POST a faithfully-shaped `graph_snapshot` payload with a valid bearer key to `/runtime-ingest`, then query `api.graphSnapshots.getProjectGraph` via the Convex dashboard. See Validation Architecture section for the exact fixture shape.

### Research Target 2: Convex Limits vs Worst-Case Volume

**CONFIRMED. HIGH confidence.** [VERIFIED: docs.convex.dev/production/state/limits]

| Limit | Confirmed Value | Worst-Case Demand | Fits? |
|-------|-----------------|-------------------|-------|
| Documents written per mutation | 16,000 | ~4,500 nodes + ~9,000 links + 1 meta = 13,501 | YES (margin: 2,499 docs) |
| Data written per mutation | 16 MiB | ~13,500 rows × ~200 bytes avg = ~2.7 MiB | YES (margin: ~13.3 MiB) |
| Documents scanned per query | 32,000 | ~13,500 (getProjectGraph active version) | YES (margin: ~18,500 docs) |
| Data read per query | 16 MiB | ~2.7 MiB | YES (margin: ~13.3 MiB) |
| Array field element limit | 8,192 | N/A (not using array fields for nodes/links) | N/A |

**Conclusion:** A single `internalMutation` can write all ~13,500 rows without batching. A single query can read them without pagination. The design fits current limits without mandatory batching. Defensive per-loop chunking (1,000 rows at a time inside the mutation) is still recommended as a maintainability practice.

**Retention sweep special case:** Sweeping one old version = ~13,500 deletes + a collect of surviving rows. If 2 versions need sweeping simultaneously (e.g., gap in nightly runs), that's ~27,000 deletes — exceeding the 16,000-document write limit. Sweep should process at most one version per `internalMutation` call, looping via scheduled `ctx.scheduler.runAfter` if more exist, or capping at one and relying on the next nightly cron run to clean up the rest.

---

## Common Pitfalls

### Pitfall 1: `mutation` vs `internalMutation` for httpAction-driven writes
**What goes wrong:** Using `mutation` (public) in `graphSnapshots.ts` and calling it via `api.graphSnapshots.*` from the httpAction fails with a Clerk identity error at runtime — httpActions have no Clerk context.
**Why it happens:** The Convex runtime enforces that `mutation` functions require a user identity from the caller; `internalMutation` bypasses this requirement.
**How to avoid:** Declare `upsertGraphSnapshot` and `sweepGraphSnapshotVersions` as `internalMutation`, imported via `internal.graphSnapshots.*` at the call site.
**Warning signs:** A `mutation` in `graphSnapshots.ts` compiles fine but throws a Convex runtime error when called from the httpAction.
**Precedent:** `appendLogChunk` is `internalMutation` (STATE.md Phase 81 note); `upsertJob` is `internalMutation` (forge.ts L136). [CITED: .planning/STATE.md "appendLogChunk is internalMutation (not mutation) — httpActions have no Clerk identity (81-SPEC §3)"]

### Pitfall 2: Flipping `activeVersion` Before Row Writes Complete
**What goes wrong:** A reader calling `getProjectGraph` between the flip and the row writes sees a partially-populated graph (empty or wrong data).
**Why it happens:** Convex httpAction `ctx.runMutation` calls are sequential but not wrapped in a single outer transaction — each is its own ACID transaction.
**How to avoid:** Always insert all node/link rows first; flip `activeVersion` last. Because all writes for the new version happen before the flip, old readers continue to see the previous complete version until the flip.
**Warning signs:** `getProjectGraph` returns fewer nodes than `storedNodeCount` during ingest.

### Pitfall 3: Not Guarding Dangling Links on Receive
**What goes wrong:** If the producer truncated nodes (hit `DEFAULT_MAX_NODES = 1500`) and a link references a dropped node, storing that link creates a dangling reference that would crash a force-graph renderer.
**Why it happens:** The producer does guard this inside each subgraph, but cross-subgraph merging in `build_graph_snapshot` could theoretically produce danglers if a link from the graphify subgraph targets a vault node that was dropped.
**How to avoid:** On receive, build a `Set<string>` of stored `nodeId` values, then filter `links` to only those where both `source` and `target` are in the set. This is D-05.
**Warning signs:** Phase 84's `ForceGraphCanvas` throws "node not found" errors for specific edges.

### Pitfall 4: `community` Field is `null` for Vault Nodes
**What goes wrong:** Schema uses `v.number()` for `community` — vault nodes (type `"note"`) have `community: None` from Python (serializes as `null` in JSON). Schema validation fails.
**Why it happens:** Only graphify nodes carry a community integer; vault nodes explicitly set `"community": null` in the producer.
**How to avoid:** Schema must use `v.optional(v.float64())` for the `community` field in `graphSnapshotNodes`.
**Warning signs:** Convex schema validator rejects the upsert mutation on the first vault-containing snapshot.
[VERIFIED: astridr/automation/graph_snapshot.py L190–195 — `"community": None` for vault nodes]

### Pitfall 5: `sweepForgeLogChunks` Uses `.collect()` on Unbounded Table
**What goes wrong:** The existing `sweepForgeLogChunks` calls `ctx.db.query("forgeLogChunks").collect()` — this is a known pattern in the codebase. For `graphSnapshotNodes`, a single collect of ALL versions (including old ones) could hit 16,000+ rows if N versions accumulate before sweep runs.
**Why it happens:** The sweep needs to read all rows to decide what to delete.
**How to avoid:** Scope the sweep's collect to the `by_snapshot_version` index — query only rows for versions that have been identified as candidates via the meta doc's `activeVersion` arithmetic. Never collect all rows unconditionally.
**Warning signs:** Sweep cron fails with "Documents scanned: 32,000" limit error.

### Pitfall 6: `generatedAt` Type Mismatch
**What goes wrong:** The producer emits `generatedAt: time.time()` — a Python float (epoch seconds as a float64, e.g., `1750312345.678901`). The TypeScript schema must accept `v.float64()`, not `v.string()`.
**Why it happens:** `time.time()` returns a float, not an ISO string. The Convex JSON serializer passes it through as a number.
**How to avoid:** Use `v.float64()` for `generatedAt` in all three contexts (schema, mutation args, query return type).
**Warning signs:** `"type mismatch: expected string, got number"` in Convex function logs.
[VERIFIED: astridr/automation/graph_snapshot.py L271 — `"generatedAt": time.time()`]

---

## Code Examples

### Producer Payload Shape (Confirmed — Exact Wire Format)

```python
# Source: astridr/automation/graph_snapshot.py build_graph_snapshot() L263–271
{
  "snapshotId": "astridr-project-graph",       # stable string constant SNAPSHOT_ID
  "nodes": [                                    # merged from all subgraphs
    {"id": "graphify:codepulse:someNode",       # pre-namespaced by prefix
     "label": "someNode.ts",
     "type": "code",                            # or "note" for vault
     "community": 1,                            # int or null for vault nodes
     "source": "codepulse"},                    # short repo name or "vault"
  ],
  "links": [
    {"source": "graphify:astridr-repo:A",
     "target": "graphify:astridr-repo:B",
     "relation": "imports"},                    # or "wikilink" for vault
  ],
  "sources": [
    {"source": "astridr-repo", "kind": "graphify",
     "nodeCount": 4200, "linkCount": 8100,      # FULL counts (before cap)
     "emittedNodeCount": 1500, "emittedLinkCount": 3000,  # CAPPED counts
     "truncated": True},
    {"source": "codepulse", "kind": "graphify", ...},
    {"source": "vault", "kind": "vault", ...},
  ],
  "nodeCount": 3000,     # sum of emitted node counts (merged, not full)
  "linkCount": 5800,     # sum of emitted link counts (merged, not full)
  "generatedAt": 1750312345.678901,  # float64 epoch seconds from time.time()
}
```

Note: `nodeCount` / `linkCount` on the top-level payload are the EMITTED (possibly truncated) counts, not the full pre-cap counts. Full counts are per-source in `sources[].nodeCount` / `sources[].linkCount`. [VERIFIED: astridr/automation/graph_snapshot.py L243–271, test_graph_snapshot.py L136–138]

### Telemetry Envelope (Confirmed)

```python
# Source: astridr/engine/telemetry.py send() L252–277
# The batched HTTP path posts events as:
# POST /runtime-ingest body:
{
  "events": [
    {
      "event_type": "graph_snapshot",  # normalized to eventType by runtimeIngest.ts
      "data": { /* full payload above */ },
      "timestamp": 1750312345.678901,
      "critical": false
    }
  ]
}
```

The `runtimeIngest` dispatch already normalizes `event_type` → `eventType` and sets `data = evt.data ?? evt` (line 40 of runtimeIngest.ts). The `graph_snapshot` case reads `const d = data as any;` and accesses `d.snapshotId`, `d.nodes`, etc. directly.

### runtimeIngest.ts dispatch case (pattern to follow)

```typescript
// Source: convex/runtimeIngest.ts ~L673 (kits_snapshot) and ~L692 (kg_summary)
case "graph_snapshot": {
  // Phase 83 (GH-01): Graph snapshot receiver — persists Ástríðr's nightly
  // graphify + vault snapshot instead of dropping it. Row-based storage to
  // avoid Convex array-element (8192) and doc-size (~1 MiB) limits.
  const d = data as any;
  await ctx.runMutation(internal.graphSnapshots.upsertGraphSnapshot, {
    snapshotId:  d.snapshotId ?? "astridr-project-graph",
    nodes:       Array.isArray(d.nodes) ? d.nodes : [],
    links:       Array.isArray(d.links) ? d.links : [],
    sources:     Array.isArray(d.sources) ? d.sources : [],
    nodeCount:   d.nodeCount ?? 0,
    linkCount:   d.linkCount ?? 0,
    generatedAt: d.generatedAt ?? timestamp,
    receivedAt:  timestamp,
  });
  break;
}
```

### getProjectGraph read query (pattern)

```typescript
// Source: convex/kg.ts latestSummary pattern (public graceful-skip)
export const getProjectGraph = query({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = "astridr-project-graph" }) => {
    const meta = await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .unique();
    if (!meta) return null;  // graceful-skip: no data yet

    const nodes = await ctx.db
      .query("graphSnapshotNodes")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)
      )
      .collect();

    const links = await ctx.db
      .query("graphSnapshotLinks")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)
      )
      .collect();

    return {
      snapshotId: meta.snapshotId,
      sources: meta.sources,
      nodeCount: meta.nodeCount,
      linkCount: meta.linkCount,
      storedNodeCount: meta.storedNodeCount,
      storedLinkCount: meta.storedLinkCount,
      generatedAt: meta.generatedAt,
      nodes: nodes.map((n) => ({
        id: n.nodeId, label: n.label, type: n.type,
        community: n.community, source: n.source,
      })),
      links: links.map((l) => ({
        source: l.source, target: l.target, relation: l.relation,
      })),
    };
  },
});
```

### Pure Helper — selectVersionDeletes (for unit test)

```typescript
// Source: convex/forge.ts selectCapDeletes pattern (~L561) adapted for version retention
export const GRAPH_SNAPSHOT_KEEP_VERSIONS = 7;

/** Given all known versions for a snapshotId (any order), returns those to delete. */
export function selectVersionDeletes(versions: number[], keepN: number): number[] {
  if (versions.length <= keepN) return [];
  const sorted = [...versions].sort((a, b) => a - b); // ascending = oldest first
  return sorted.slice(0, sorted.length - keepN);
}
```

---

## Runtime State Inventory

This is a greenfield receiver — no existing data in `graphSnapshots` / `graphSnapshotNodes` / `graphSnapshotLinks` (tables don't exist yet). Not a rename/refactor/migration phase.

**None — verified: these tables do not exist in `convex/schema.ts`** (confirmed by reading schema.ts in full).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `graph_snapshot` events silently dropped | `runtimeIngest` dispatch case stores to Convex | This phase | Fixes the live bug; enables Phase 84 rendering |
| Single-blob KG storage (`kgSummary`) | Row-based entity tables for large graphs | Phase 83 (new) | Required to stay within Convex array (8192) and doc (~1 MiB) limits |

**Not deprecated/replaced by this phase:** `kgSummary` (single-blob) remains correct for its use case — it is a small summary document (scalar counts + a `record<string, float64>`), not a large array. The new row-based approach only applies to the graph entity tables.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Internal `version` as monotonic int (incremented on each ingest) is the cleanest choice for sweep selection | Architecture Patterns — Pattern 1 | If wrong, sweep selection formula changes (low risk; the increment approach is self-contained) |
| A2 | Sweep can safely process one version-to-delete per cron run and rely on the next nightly run for additional cleanup | Common Pitfalls — Pitfall 5, Retention | If multiple versions accumulate (e.g., 8-day gap), cleanup takes multiple nights instead of one — acceptable for a 7-version window |
| A3 | `/app/vault` is the actual runtime Obsidian vault path (production Docker container) | Producer Wiring | If env var `OBSIDIAN_VAULT_PATH` is not set in production, vault subgraph is skipped (fail-closed behavior per producer — not a receiver concern) |

---

## Open Questions

1. **Single mutation vs batched orchestration for the write**
   - What we know: 13,500 rows fits in one mutation (16,000-doc limit). Convex recommends staying well within limits.
   - What's unclear: Whether the plan should defensively use batched calls (e.g., three mutations: write nodes, write links, flip pointer) for clarity vs. a single mutation that does all three.
   - Recommendation: Use a single `internalMutation` for the write + flip (all three steps in one handler). This is the simplest approach and stays within limits. If graph volume grows in future milestones, split at that time.

2. **Sweep per-run limit: process one stale version or all stale versions?**
   - What we know: Deleting one version = ~13,500 rows = within 16,000-doc limit. Deleting two = ~27,000 = over limit.
   - What's unclear: Whether to add a multi-version loop with doc-count guard or just process one version per cron run.
   - Recommendation: Process all versions-to-delete but delete their rows in chunks within one mutation, tracking doc count to stay under 15,000 deletes total. This avoids needing `ctx.scheduler.runAfter` complexity.

3. **`getProjectGraph` default `snapshotId`**
   - What we know: Today there is exactly one stable id (`"astridr-project-graph"`). The schema is keyed for future multi-id support.
   - What's unclear: Whether to default to the literal string or to query `listSnapshots` for the most-recently-updated.
   - Recommendation: Default to the literal string `"astridr-project-graph"`. When Phase 84 adds a second project, the UI can pass `snapshotId` explicitly.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex dev backend | All backend development | Depends on `npx convex dev` | Project current | — |
| Ástríðr bearer token | Fixture POST for verification | Available in `.env` (`VITE_ASTRIDR_API_KEY` / `CODEPULSE_INGEST_KEY`) | — | Use the same key used for Forge ingest |

**Fixture POST for verification:** The Ástríðr nightly cron runs at 00:15 UTC. For same-day verification without waiting, POST a fixture payload directly to `/runtime-ingest` with the bearer key. The fixture shape is fully documented in the Code Examples section above. Verification procedure: POST → query `api.graphSnapshots.getProjectGraph` in the Convex dashboard → confirm `nodes` and `links` arrays are populated, `storedNodeCount` matches fixture length, `activeVersion = 1`.

---

## Validation Architecture

`nyquist_validation` is not set to false in `.planning/config.json` (key absent = enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project standard) |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run convex/graphSnapshots.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GH-01a | `selectVersionDeletes` returns correct versions to delete | unit | `npx vitest run convex/graphSnapshots.test.ts` | ❌ Wave 0 |
| GH-01b | Dispatch mapping: `d.snapshotId ?? "astridr-project-graph"` defaults correctly | unit | `npx vitest run convex/graphSnapshots.test.ts` | ❌ Wave 0 |
| GH-01c | Dangling-link guard drops links with non-stored endpoints | unit | `npx vitest run convex/graphSnapshots.test.ts` | ❌ Wave 0 |
| GH-01d | `community: null` from vault nodes is accepted (v.optional field) | unit | `npx vitest run convex/graphSnapshots.test.ts` | ❌ Wave 0 |
| GH-01e | `generatedAt` as float64 passes through correctly | unit | `npx vitest run convex/graphSnapshots.test.ts` | ❌ Wave 0 |
| GH-01f | Re-posting same `snapshotId` increments version (idempotent, no accumulate) | unit/todo | `npx vitest run convex/graphSnapshots.test.ts` | ❌ Wave 0 |
| GH-01g | Fixture POST returns 200 and `getProjectGraph` returns expected shape | e2e/manual | fixture POST + Convex dashboard query | ❌ Wave 0 (manual) |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/graphSnapshots.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `convex/graphSnapshots.test.ts` — pure-logic tests for GH-01a through GH-01f
- [ ] New tables in `convex/schema.ts` (required before `convex dev` accepts the new module)

*(Existing test infrastructure covers the `convex/*.test.ts` runner — no new config needed.)*

---

## Security Domain

`security_enforcement` is not explicitly set to false — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (ingest) | `validateIngestAuth` from `ingestAuth.ts` — already enforced on `/runtime-ingest` |
| V3 Session Management | no | Read queries are public graceful-skip; no session state |
| V4 Access Control | no | Read queries are public read-only (no write surface from browser) |
| V5 Input Validation | yes | Defensive `??` field access; dangling-link guard; `Array.isArray` checks |
| V6 Cryptography | no | Bearer token comparison is string equality; no crypto hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated large payload injection | Tampering | `validateIngestAuth` — 401 before body is parsed further |
| Oversized snapshot overwhelming storage | Denial of Service | Producer caps at 1500 nodes / 3000 links per source; receiver stores verbatim within Convex limits |
| Graph node id injection (XSS via label) | Tampering | Stored verbatim; Phase 84 must sanitize before rendering in DOM |
| Dangling link reference (graph corruption) | Tampering | Receiver guard in D-05 drops links with non-stored endpoints |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on This Phase |
|-----------|---------------------|
| `internalMutation` for httpAction-driven writes | All entity writers (`upsertGraphSnapshot`, `sweepGraphSnapshotVersions`) must be `internalMutation`, not `mutation` |
| Convex patterns: `useQuery(api.domain.fn)` | Phase 84 consumes via `useQuery(api.graphSnapshots.getProjectGraph)` — this phase must export the query correctly |
| No `.env` commits | Bearer token for fixture POST must come from environment, not hardcoded |
| Test framework: Vitest | All new tests in `convex/graphSnapshots.test.ts` use `import { describe, it, expect } from "vitest"` |
| Graphify: use `graphify query` not raw grep | This research phase used `graphify`-aware file reads via the project CLAUDE.md instructions |
| `convex/crons.ts` registration pattern | New cron added as `crons.daily(...)` consistent with existing entries |

---

## Sources

### Primary (HIGH confidence)

- `C:\Users\mandr\astridr-repo\astridr\automation\graph_snapshot.py` — exact producer payload shape, node/link field names, `generatedAt: time.time()`, `community: None` for vault nodes
- `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\cron_builders.py` L641–669 — `graph:snapshot` cron registration confirmed wired, schedule `"15 0 * * *"`, depends on `graphify:nightly_update`
- `C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\cron_dispatcher.py` L237–238, L538–553 — dispatcher routes `graph:snapshot` to `_run_graph_snapshot` which calls `emit_graph_snapshot`
- `C:\Users\mandr\astridr-repo\config\graphify.yaml` — repos confirmed as `/app/repos/astridr-repo`, `/app/repos/codepulse`
- `C:\Users\mandr\astridr-repo\tests\unit\automation\test_graph_snapshot.py` — confirms exact payload shape + fixture structure for tests
- `C:\Users\mandr\codepulse\convex\runtimeIngest.ts` — dispatch switch location, `kg_summary` and `kits_snapshot` analogs at ~L692 and ~L673
- `C:\Users\mandr\codepulse\convex\kg.ts` — `upsertSummary`/`latestSummary` pattern for upsert + graceful-skip read
- `C:\Users\mandr\codepulse\convex\forge.ts` — `selectTtlDeletes`/`selectCapDeletes`/`sweepForgeLogChunks` retention pattern; `appendLogChunk` `internalMutation` shape
- `C:\Users\mandr\codepulse\convex\crons.ts` — cron registration conventions, existing sweep entries for offset reference
- `C:\Users\mandr\codepulse\convex\schema.ts` ~L993 (`kgSummary`) — `defineTable`/`v.` validator conventions to mirror
- [VERIFIED: docs.convex.dev/production/state/limits] — 16,000 docs/mutation, 16 MiB/mutation, 32,000 docs/query, 8,192 array elements/field

### Secondary (MEDIUM confidence)

- `C:\Users\mandr\astridr-repo\astridr\engine\telemetry.py` L252–277 — telemetry `send()` confirms batched POST envelope shape `{event_type, data, timestamp}`
- `C:\Users\mandr\astridr-repo\tests\integration\test_codepulse_ingest.py` — confirms bearer auth test patterns; no `graph_snapshot`-specific fixture test exists (fixture POST needed)
- `C:\Users\mandr\codepulse\convex\forgeLogIngest.ts` — httpAction → `ctx.runMutation(internal.forge.appendLogChunk, {...})` orchestration shape
- `C:\Users\mandr\codepulse\convex\kg.test.ts` — vitest pure-logic test pattern for ingest dispatch mapping
- [WebSearch: docs.convex.dev/database/writing-data] — confirms `ctx.meta.getTransactionMetrics()` exists for limit introspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all Convex patterns confirmed from live codebase
- Producer wiring: HIGH — cron registration, dispatcher, and payload shape all read from source
- Convex limits: HIGH — fetched directly from official docs.convex.dev/production/state/limits
- Architecture: HIGH — all patterns derived from existing, shipping code in this repo
- Pitfalls: HIGH — each grounded in a confirmed code path or official limit

**Research date:** 2026-06-18
**Valid until:** 2026-07-18 (Convex limits are stable; producer payload shape locked by Ástríðr Phase 137)
