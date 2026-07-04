# Phase 83: Graph Snapshot Receiver - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **CodePulse-side receiver** for Ástríðr's nightly `graph_snapshot` telemetry (GH-01). Three parts:
1. New Convex tables to persist the merged code (graphify) + vault (Obsidian) `{nodes, links}` graph.
2. A `runtimeIngest` dispatch case for the `graph_snapshot` event — **idempotent on `snapshotId`, full-replacement** — so the snapshots are stored instead of dropped.
3. A read query API (`getProjectGraph`, `listSnapshots`) that Phase 84 consumes.

**This fixes a live bug:** `graph_snapshot` is currently **absent** from the `runtimeIngest` switch (`convex/runtimeIngest.ts` — cases run `llm_call` → `auth_alias`, no `graph_snapshot`), so every nightly emit from the already-shipping producer is silently discarded.

**Out of scope (later phases, do NOT build here):**
- `/graphs` landing route, ForceGraphCanvas rendering, unified hub IA — Phase 84 (GH-02/GH-03).
- Cross-graph navigation (tool → agent → KG entity) — Phase 85 (GH-04).
- KG full-text search, clustering layout — Phase 86 (KG-08/KG-09).
- Saved views, temporal diff/animation — Phase 87 (KG-10/KG-11). *(Retention decision below sets this up, but the diff UI itself is Phase 87.)*
- Any Ástríðr-side change. The producer already ships; this phase only verifies it (see flagged research items).

</domain>

<decisions>
## Implementation Decisions

These are HOW-only decisions from discussion. Requirement GH-01 stays the scope anchor (see canonical refs).

### Storage shape
- **D-01: Metadata doc + entity rows (NOT a single blob).** A single `graphSnapshots` doc holds snapshot metadata + an `activeVersion` pointer; nodes and links are stored as **separate entity rows** keyed by `snapshotId` + `version`.
  - **Why not the `kgSummary` single-row blob model:** worst-case merged payload is ~4,500 nodes / ~9,000 links (per-source caps 1,500 nodes / 3,000 links × graphify repo(s) + vault). ~9k links exceeds Convex's **8,192-element array-field limit**, and ~1.2 MB exceeds the **~1 MiB per-document limit** → a blob row would silently reject large snapshots.
  - Shape (exact field set to be finalized at plan time):
    ```
    graphSnapshots:     { snapshotId, activeVersion, sources[], nodeCount, linkCount,
                          storedNodeCount, storedLinkCount, generatedAt, updatedAt }   // 1 row per snapshotId
    graphSnapshotNodes: { snapshotId, version, nodeId, label, type, community, source } // index by_snapshot_version
    graphSnapshotLinks: { snapshotId, version, source, target, relation }              // index by_snapshot_version
    ```

### Replacement / atomicity
- **D-02: Versioned swap.** Each ingest writes new node/link rows under a fresh internal `version` for that `snapshotId`, flips the `graphSnapshots` doc's `activeVersion` pointer **last**, then sweeps superseded versions (subject to retention, D-03). Readers always see exactly one complete graph — never a half-written one. Avoids one giant delete+insert transaction.
- **D-02a (flagged for research):** Confirm Convex per-mutation write limits vs worst-case row count (~13.5k rows). The versioned write likely needs **batched internalMutations orchestrated by the httpAction** rather than a single mutation. The pointer flip itself must be a single small mutation.

### Retention
- **D-03: Keep last N≈7 versions per `snapshotId`.** Nearly free given versioning (D-02); retains ~a week of nightly history, which is exactly what Phase 87 (KG-11) code/vault-graph temporal diff would need. Bounded growth (~N × worst-case rows).
  - The producer's "replace, don't accumulate" contract is honored at the **active-pointer** level; retaining prior versions is an internal CodePulse retention choice.
  - **Requires a retention sweep cron**, mirroring `sweepForgeLogChunks` (Phase 81) — keep `activeVersion` + (N−1) prior, drop older. Pure selection helper should be unit-tested like `selectTtlDeletes`/`selectCapDeletes`.
  - Final N chosen at plan time.

### Read API
- **D-04: Full-graph getter + list.**
  - `getProjectGraph({snapshotId?})` → reassembles the **active version** into `{ snapshotId, sources[], nodeCount, linkCount, storedNodeCount, storedLinkCount, generatedAt, nodes[], links[] }` — ForceGraphCanvas-ready (Phase 84 consumes this whole).
  - `listSnapshots()` → `[{ snapshotId, nodeCount, linkCount, generatedAt, updatedAt }]` for the hub to enumerate available graphs.
  - **Source/community filtering is client-side** (payload is already bounded) — mirrors the GAL-04 precedent (client-side agent/MCP filtering, no reload).
  - Read path is **public graceful-skip** (no Clerk gating) — consistent with `kg.latestSummary`, `forge.listJobs`, and the established CodePulse read convention.
- **D-04a (flagged for research):** Confirm a single `getProjectGraph` query reading ~13.5k rows stays within Convex's per-query read limit; if not, the getter paginates internally / `.collect()` bounds are respected.

### Truncation & counts
- **D-05: Store producer `sources[]` verbatim AND record receiver-side actual counts.**
  - Persist the producer's `sources[]` (each: `source, kind, nodeCount, linkCount, emittedNodeCount, emittedLinkCount, truncated`) verbatim — this is the **authoritative "showing X of Y"** source for Phase 84's truncation indicator.
  - On store, **defensively drop any link whose endpoints aren't among stored nodes** (mirrors the producer's own dangling-link guard) and record the receiver's `storedNodeCount` / `storedLinkCount` on the meta doc.
  - If `stored*` diverges from the producer's emitted counts, that's a **visible data-quality signal**, not a silent broken graph.

### Ingest auth & envelope (established — not re-decided)
- Reuse the existing `/runtime-ingest` bearer auth (`validateIngestAuth` / `unauthorizedResponse`) and CORS/OPTIONS handling — no new auth surface.
- Envelope: telemetry arrives as `{ eventType: "graph_snapshot", data: {…payload} }`; the dispatch reads `data = evt.data ?? evt`, mirroring sibling cases. Defensive `??` field access like `kg_summary` / `kits_snapshot`.

### Claude's Discretion
- Exact schema field names/types and index names for the three tables (follow `convex/schema.ts` conventions near `kgSummary` ~L993 and the Forge tables).
- Internal `version` representation (monotonic int vs ingest timestamp vs ulid) — pick what makes the sweep selection cleanest.
- Batch sizes for the versioned write and the retention sweep cadence.
- Whether `getProjectGraph` defaults `snapshotId` to the single known id (`"astridr-project-graph"`) or the most-recently-updated snapshot.
- Mutation kind: the entity-row writers are `internalMutation` (httpActions have no Clerk identity — same rule as `forge.appendLogChunk`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement / milestone scope (the anchor)
- `.planning/REQUIREMENTS.md` § "Graph Hub (GH)" — **GH-01** full definition (table + dispatch + read API, idempotent on `snapshotId`, full-replacement, "fixes the dropped-events bug").
- `.planning/PROJECT.md` § "Current Milestone: v8.0" — why the producer already ships and CodePulse is only the receiver.
- `.planning/STATE.md` § "Milestone v8.0 Roadmap" — sequencing: Phase 83 (receiver) MUST land before any rendering phase (84+).

### Producer contract (Ástríðr — read to lock the payload shape)
- `C:\Users\mandr\astridr-repo\astridr\automation\graph_snapshot.py` — the **exact emit payload**: `build_graph_snapshot()` returns `{ snapshotId:"astridr-project-graph", nodes:[{id,label,type,community,source}], links:[{source,target,relation}], sources:[{source,kind,nodeCount,linkCount,emittedNodeCount,emittedLinkCount,truncated}], nodeCount, linkCount, generatedAt }`. Per-source caps `DEFAULT_MAX_NODES=1500` / `DEFAULT_MAX_LINKS=3000`. Node ids namespaced `graphify:<repo>:` / `vault:`.
- `C:\Users\mandr\astridr-repo\astridr\engine\telemetry.py` § `send()` (~L252) — confirms the `{event_type/eventType, data, timestamp}` envelope the batched HTTP path POSTs to `/runtime-ingest`.

### CodePulse patterns to mirror
- `convex/runtimeIngest.ts` — the dispatch switch; add the `graph_snapshot` case. Closest analogs: **`kg_summary`** (~L692, latest-wins upsert of a pushed snapshot) and **`kits_snapshot`** (~L673, replace-an-array-wholesale idempotent upsert).
- `convex/kg.ts` — `upsertSummary` + `latestSummary` (single-snapshot upsert mutation + public graceful-skip read query conventions).
- `convex/schema.ts` ~L993 (`kgSummary`) and the Forge tables — `defineTable` + `v.` validator + index conventions to mirror for the three new tables.
- `convex/forge.ts` — Phase 81 retention pattern to clone for D-03: `sweepForgeLogChunks` + pure helpers (`selectTtlDeletes` / `selectCapDeletes`) + bounded reactive read queries; `appendLogChunk` for the `internalMutation` idempotency shape.
- `convex/forgeLogIngest.ts` / `convex/forgeIngest.ts` — httpAction → validate → dispatch → internalMutation orchestration shape (relevant for the batched versioned write, D-02a).
- `convex/ingestAuth.ts` — `validateIngestAuth`, `getCorsHeaders`, `unauthorizedResponse` (reuse as-is).
- Phase 78 receiver precedent: `.planning/phases/078-forge-emitter-convex-schema/078-CONTEXT.md` — the architectural template the milestone explicitly calls out for GH-01 (idempotent upsert keyed by a stable id, read-only one-way, source-of-truth-is-the-producer).

### Render consumer (downstream, for contract awareness only — do NOT build here)
- `ForceGraphCanvas` (CodePulse render component reused by GH-02) — the `getProjectGraph` return shape (D-04) must be what it consumes. Phase 84 wires this.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`convex/ingestAuth.ts`** (`validateIngestAuth` / `getCorsHeaders` / `unauthorizedResponse`): the receiver inherits bearer auth + CORS for free — `/runtime-ingest` already enforces it. No new auth.
- **`convex/forge.ts` retention helpers** (`selectTtlDeletes` / `selectCapDeletes` + `sweepForgeLogChunks`): clone the pure-selection-helper + cron shape for the keep-N version sweep (D-03), including a unit test.
- **`convex/kg.ts`** (`upsertSummary` / `latestSummary`): template for the upsert mutation + public graceful-skip read query.

### Established Patterns
- **Dispatch case convention** (`runtimeIngest.ts`): `const d = data as any;` + defensive `d.foo ?? d.foo_snake ?? default` field access; `await ctx.runMutation(...)`; `break;`. `kg_summary` / `kits_snapshot` are the idempotent-snapshot exemplars.
- **`internalMutation` for httpAction-driven writes** (`forge.appendLogChunk`): httpActions have no Clerk identity — the entity-row writers must be `internalMutation`, not `mutation`.
- **Idempotent upsert keyed by a stable id** (Forge `(hostId, forgeJobId)`, kg single-row): here the key is `snapshotId`, with the versioned-swap twist (D-02).
- **Client-side filtering of bounded graph data** (GAL-04): justifies returning the whole bounded graph from `getProjectGraph` and filtering by source/community in the UI later.

### Integration Points
- `convex/runtimeIngest.ts` switch — new `case "graph_snapshot":` dispatching to the versioned-write orchestration.
- `convex/schema.ts` — three new tables (`graphSnapshots`, `graphSnapshotNodes`, `graphSnapshotLinks`).
- New `convex/graphSnapshots.ts` (or similar) — the write orchestration + `getProjectGraph` / `listSnapshots` + retention sweep + pure helpers.
- `convex/crons.ts` (wherever `sweepForgeLogChunks` is scheduled) — register the version-retention sweep.

</code_context>

<specifics>
## Specific Ideas

- The receiver must be a faithful sink for the producer's **exact** payload — node ids are pre-namespaced (`graphify:<repo>:` / `vault:`); do not re-namespace or rewrite ids.
- The "showing X of Y" truncation indicator (Phase 84) reads the producer's `sources[].emittedNodeCount` / `nodeCount`; the receiver's job is to persist those verbatim and additionally expose its own `storedNodeCount` as an integrity cross-check (D-05).
- Verification bar (per global rules): "done" = a **real** `graph_snapshot` event (from the running Ástríðr cron, or a faithfully-shaped fixture POSTed with a valid bearer key) lands rows and is returned by `getProjectGraph` — observed via the query/Convex dashboard, not "the mutation returned ok."

</specifics>

<deferred>
## Deferred Ideas

- **Multi-project / multi-snapshotId support** — schema is keyed by `snapshotId` so it's ready, but today the producer emits a single stable id (`"astridr-project-graph"`). No multi-project UI here.
- **Code/vault-graph temporal diff UI** — enabled by the keep-N retention (D-03) but built in Phase 87 (KG-11).
- **Snapshot freshness/staleness banner** (`generatedAt` age) — a Phase 84 client concern; receiver just persists `generatedAt`.

### Flagged for research/verification (carry into RESEARCH.md)
1. **Verify the producer is actually wired + firing.** `graph_snapshot.py` ships, but confirm it's registered in Ástríðr's nightly cron (`astridr/engine/bootstrap/cron_builders.py` / `cron_dispatcher.py`) and pointed at the right `graphify_repos` + `vault_path` — otherwise the receiver has nothing to receive. Check `tests/integration/test_codepulse_ingest.py` for the expected wire shape.
2. **Convex limits vs worst-case volume.** Confirm per-mutation write limits (drives batching in D-02a) and per-query read limits (drives D-04a pagination) against ~13.5k rows.

</deferred>

---

*Phase: 83-graph-snapshot-receiver*
*Context gathered: 2026-06-18*
