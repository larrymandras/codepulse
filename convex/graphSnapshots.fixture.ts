/**
 * Verification fixture for the GH-01 graph-snapshot receiver (Phase 83, plan 03).
 *
 * This is a faithfully-shaped mirror of the `data` payload emitted by
 * Ástríðr's nightly producer — `astridr/automation/graph_snapshot.py`
 * `build_graph_snapshot()` — wrapped in the telemetry envelope and POSTed to
 * `/runtime-ingest` as `{ events: [{ event_type: "graph_snapshot", data: <this>,
 * timestamp, critical: false }] }`. See 83-RESEARCH.md "Code Examples".
 *
 * It is intentionally heterogeneous so the live round-trip can observe the
 * receiver's edge-case handling:
 *   - a graphify node with a numeric `community` AND a vault node with
 *     `community: null` (asserts the schema's optional/nullable community field);
 *   - exactly ONE intentional DANGLING link whose target id is absent from
 *     `nodes` (asserts the D-05 dangling-link drop — `storedLinkCount` must come
 *     back one less than `links.length`);
 *   - a `sources[]` entry with `truncated: true` and `emittedNodeCount < nodeCount`
 *     (asserts truncated producer caps survive the round-trip verbatim).
 *
 * Node ids are PRE-NAMESPACED exactly as the producer emits them — do NOT
 * re-namespace. No bearer key or secret appears in this file; the verification
 * POST reads the ingest key from the environment at call time.
 */

export interface GraphSnapshotNodeFixture {
  id: string;
  label: string;
  type: string;
  community: number | null;
  source: string;
}

export interface GraphSnapshotLinkFixture {
  source: string;
  target: string;
  relation: string;
}

export interface GraphSnapshotSourceFixture {
  source: string;
  kind: string;
  nodeCount: number;
  linkCount: number;
  emittedNodeCount: number;
  emittedLinkCount: number;
  truncated: boolean;
}

export interface GraphSnapshotFixture {
  snapshotId: string;
  nodes: GraphSnapshotNodeFixture[];
  links: GraphSnapshotLinkFixture[];
  sources: GraphSnapshotSourceFixture[];
  nodeCount: number;
  linkCount: number;
  generatedAt: number;
}

export const graphSnapshotFixture: GraphSnapshotFixture = {
  snapshotId: "astridr-project-graph",
  nodes: [
    {
      id: "graphify:codepulse:graphSnapshots",
      label: "graphSnapshots.ts",
      type: "code",
      community: 1,
      source: "codepulse",
    },
    {
      id: "graphify:codepulse:runtimeIngest",
      label: "runtimeIngest.ts",
      type: "code",
      community: 1,
      source: "codepulse",
    },
    {
      // Vault node — community is null for vault notes (T-83-04 mitigation).
      id: "vault:GraphSnapshotReceiver",
      label: "Graph Snapshot Receiver",
      type: "note",
      community: null,
      source: "vault",
    },
  ],
  links: [
    // Valid: both endpoints present.
    {
      source: "graphify:codepulse:runtimeIngest",
      target: "graphify:codepulse:graphSnapshots",
      relation: "imports",
    },
    // Valid: vault wikilink into a present code node.
    {
      source: "vault:GraphSnapshotReceiver",
      target: "graphify:codepulse:graphSnapshots",
      relation: "wikilink",
    },
    // INTENTIONAL DANGLING LINK — target id is absent from `nodes`.
    // The receiver's D-05 guard must drop this, so storedLinkCount === 2.
    {
      source: "graphify:codepulse:graphSnapshots",
      target: "graphify:codepulse:missing",
      relation: "imports",
    },
  ],
  sources: [
    {
      // Truncated source: emitted counts capped below full counts.
      source: "astridr-repo",
      kind: "graphify",
      nodeCount: 4200,
      linkCount: 8100,
      emittedNodeCount: 1500,
      emittedLinkCount: 3000,
      truncated: true,
    },
    {
      source: "codepulse",
      kind: "graphify",
      nodeCount: 2,
      linkCount: 2,
      emittedNodeCount: 2,
      emittedLinkCount: 2,
      truncated: false,
    },
    {
      source: "vault",
      kind: "vault",
      nodeCount: 1,
      linkCount: 1,
      emittedNodeCount: 1,
      emittedLinkCount: 1,
      truncated: false,
    },
  ],
  // Top-level counts are the EMITTED (merged) totals, not pre-cap full counts.
  nodeCount: 3,
  linkCount: 3,
  generatedAt: 1750312345.678901,
};
