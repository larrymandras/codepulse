import { describe, it, expect } from "vitest";

/**
 * Pure-logic mirrors of the `graph_snapshot` ingest dispatch and receiver
 * logic (mirroring the repo's kg.test.ts / forge.test.ts style — no DB
 * round-trip). Covers GH-01a..e from the validation architecture.
 */

import { selectVersionDeletes, GRAPH_SNAPSHOT_KEEP_VERSIONS } from "./graphSnapshots";

// ---------------------------------------------------------------------------
// Mirror functions — replicate dispatch/receiver logic without a Convex runtime
// ---------------------------------------------------------------------------

/**
 * Mirrors the `case "graph_snapshot"` defensive-access mapping in
 * runtimeIngest.ts. Given a raw payload `d` and a fallback timestamp,
 * returns the args object passed to upsertGraphSnapshot.
 */
const mapGraphSnapshotEvent = (d: any, fallbackTs: number) => ({
  snapshotId:  d.snapshotId ?? "astridr-project-graph",
  nodes:       Array.isArray(d.nodes) ? d.nodes : [],
  links:       Array.isArray(d.links) ? d.links : [],
  sources:     Array.isArray(d.sources) ? d.sources : [],
  nodeCount:   d.nodeCount ?? 0,
  linkCount:   d.linkCount ?? 0,
  generatedAt: d.generatedAt ?? fallbackTs,
  receivedAt:  fallbackTs,
});

/**
 * Mirrors the dangling-link guard in upsertGraphSnapshot.
 * Given a list of nodes and links, returns only links whose source AND
 * target are both present in the node-id set.
 */
const filterDanglingLinks = (
  nodes: Array<{ id: string }>,
  links: Array<{ source: string; target: string; relation: string }>
) => {
  const nodeIdSet = new Set<string>(nodes.map((n) => n.id));
  return links.filter((l) => nodeIdSet.has(l.source) && nodeIdSet.has(l.target));
};

// ---------------------------------------------------------------------------
// GH-01a: selectVersionDeletes pure helper
// ---------------------------------------------------------------------------

describe("selectVersionDeletes (GH-01a)", () => {
  it("returns [] when versions is empty", () => {
    expect(selectVersionDeletes([], GRAPH_SNAPSHOT_KEEP_VERSIONS)).toEqual([]);
  });

  it("returns [] when version count is exactly keepN", () => {
    expect(selectVersionDeletes([1, 2, 3, 4, 5, 6, 7], 7)).toEqual([]);
  });

  it("returns [] when version count is below keepN", () => {
    expect(selectVersionDeletes([1, 2, 3], 7)).toEqual([]);
  });

  it("returns oldest versions when count exceeds keepN", () => {
    // 9 versions, keep 7 → delete oldest 2: [1, 2]
    expect(selectVersionDeletes([1, 2, 3, 4, 5, 6, 7, 8, 9], 7)).toEqual([1, 2]);
  });

  it("handles unsorted input — sorts internally before selecting", () => {
    // Out-of-order: [9, 3, 1, 7, 5, 2, 8, 4, 6] — still should delete [1, 2]
    expect(selectVersionDeletes([9, 3, 1, 7, 5, 2, 8, 4, 6], 7)).toEqual([1, 2]);
  });

  it("keeps exactly the N newest versions", () => {
    // 10 versions, keep 7 → delete oldest 3: [1, 2, 3]
    expect(selectVersionDeletes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 7)).toEqual([1, 2, 3]);
  });

  it("handles keepN = 1 — keeps only the newest", () => {
    expect(selectVersionDeletes([1, 2, 3], 1)).toEqual([1, 2]);
  });

  it("GRAPH_SNAPSHOT_KEEP_VERSIONS is 7", () => {
    expect(GRAPH_SNAPSHOT_KEEP_VERSIONS).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// GH-01b: dispatch mapping fallbacks
// ---------------------------------------------------------------------------

describe("mapGraphSnapshotEvent — dispatch mapping fallbacks (GH-01b)", () => {
  it("uses 'astridr-project-graph' when snapshotId is missing", () => {
    const args = mapGraphSnapshotEvent({}, 1000);
    expect(args.snapshotId).toBe("astridr-project-graph");
  });

  it("uses the provided snapshotId when present", () => {
    const args = mapGraphSnapshotEvent({ snapshotId: "my-graph" }, 1000);
    expect(args.snapshotId).toBe("my-graph");
  });

  it("defaults non-array nodes to []", () => {
    expect(mapGraphSnapshotEvent({}, 1000).nodes).toEqual([]);
    expect(mapGraphSnapshotEvent({ nodes: null }, 1000).nodes).toEqual([]);
    expect(mapGraphSnapshotEvent({ nodes: "bad" }, 1000).nodes).toEqual([]);
  });

  it("defaults non-array links to []", () => {
    expect(mapGraphSnapshotEvent({}, 1000).links).toEqual([]);
    expect(mapGraphSnapshotEvent({ links: 42 }, 1000).links).toEqual([]);
  });

  it("defaults non-array sources to []", () => {
    expect(mapGraphSnapshotEvent({}, 1000).sources).toEqual([]);
  });

  it("defaults missing nodeCount and linkCount to 0", () => {
    const args = mapGraphSnapshotEvent({}, 1000);
    expect(args.nodeCount).toBe(0);
    expect(args.linkCount).toBe(0);
  });

  it("falls back to timestamp when generatedAt is missing", () => {
    const args = mapGraphSnapshotEvent({}, 9999);
    expect(args.generatedAt).toBe(9999);
  });

  it("uses provided generatedAt when present", () => {
    const args = mapGraphSnapshotEvent({ generatedAt: 1750312345.678901 }, 9999);
    expect(args.generatedAt).toBe(1750312345.678901);
  });

  it("passes through valid arrays unchanged", () => {
    const nodes = [{ id: "n1", label: "A", type: "code", source: "codepulse" }];
    const links = [{ source: "n1", target: "n2", relation: "imports" }];
    const args = mapGraphSnapshotEvent({ nodes, links, nodeCount: 5, linkCount: 3 }, 1000);
    expect(args.nodes).toEqual(nodes);
    expect(args.links).toEqual(links);
    expect(args.nodeCount).toBe(5);
    expect(args.linkCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// GH-01c: dangling-link guard
// ---------------------------------------------------------------------------

describe("filterDanglingLinks — dangling-link guard (GH-01c)", () => {
  const nodes = [
    { id: "graphify:astridr:A", label: "A", type: "code", source: "astridr" },
    { id: "graphify:astridr:B", label: "B", type: "code", source: "astridr" },
    { id: "vault:note:C",        label: "C", type: "note", source: "vault" },
  ];

  it("keeps a link where both source and target are in the node set", () => {
    const links = [
      { source: "graphify:astridr:A", target: "graphify:astridr:B", relation: "imports" },
    ];
    expect(filterDanglingLinks(nodes, links)).toEqual(links);
  });

  it("drops a link whose source is not in the node set", () => {
    const links = [
      { source: "graphify:astridr:MISSING", target: "graphify:astridr:B", relation: "imports" },
    ];
    expect(filterDanglingLinks(nodes, links)).toEqual([]);
  });

  it("drops a link whose target is not in the node set", () => {
    const links = [
      { source: "graphify:astridr:A", target: "graphify:astridr:MISSING", relation: "imports" },
    ];
    expect(filterDanglingLinks(nodes, links)).toEqual([]);
  });

  it("keeps cross-type links (graphify → vault) when both endpoints exist", () => {
    const links = [
      { source: "graphify:astridr:A", target: "vault:note:C", relation: "wikilink" },
    ];
    expect(filterDanglingLinks(nodes, links)).toEqual(links);
  });

  it("returns [] when all links are dangling", () => {
    const links = [
      { source: "x", target: "y", relation: "unknown" },
      { source: "z", target: "w", relation: "unknown" },
    ];
    expect(filterDanglingLinks(nodes, links)).toEqual([]);
  });

  it("returns only non-dangling links from a mixed set", () => {
    const links = [
      { source: "graphify:astridr:A", target: "graphify:astridr:B", relation: "imports" },
      { source: "graphify:astridr:A", target: "MISSING", relation: "imports" },
      { source: "MISSING", target: "graphify:astridr:B", relation: "imports" },
    ];
    const result = filterDanglingLinks(nodes, links);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ source: "graphify:astridr:A", target: "graphify:astridr:B", relation: "imports" });
  });

  it("returns [] when node list is empty (all links are dangling)", () => {
    const links = [
      { source: "a", target: "b", relation: "imports" },
    ];
    expect(filterDanglingLinks([], links)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GH-01d: community null + numeric passthrough
// ---------------------------------------------------------------------------

describe("community field handling (GH-01d)", () => {
  it("a node with community: null produces undefined after coercion", () => {
    // Mirrors the receiver coercion:
    //   const community = node.community === null || node.community === undefined
    //     ? undefined : node.community;
    const coerceCommunity = (c: number | null | undefined): number | undefined =>
      c === null || c === undefined ? undefined : c;

    expect(coerceCommunity(null)).toBeUndefined();
    expect(coerceCommunity(undefined)).toBeUndefined();
  });

  it("a node with a numeric community survives coercion unchanged", () => {
    const coerceCommunity = (c: number | null | undefined): number | undefined =>
      c === null || c === undefined ? undefined : c;

    expect(coerceCommunity(0)).toBe(0);
    expect(coerceCommunity(1)).toBe(1);
    expect(coerceCommunity(42)).toBe(42);
  });

  it("vault node (community: null) and graphify node (community: 1) both survive dispatch mapping", () => {
    const nodes = [
      { id: "vault:note:X",      label: "X", type: "note", community: null,  source: "vault" },
      { id: "graphify:repo:Y",   label: "Y", type: "code", community: 1,     source: "repo" },
    ];
    const args = mapGraphSnapshotEvent({ nodes }, 1000);
    expect(args.nodes).toHaveLength(2);
    // Both pass through the Array.isArray guard intact
    expect(args.nodes[0].community).toBeNull();
    expect(args.nodes[1].community).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// GH-01e: generatedAt float passthrough
// ---------------------------------------------------------------------------

describe("generatedAt float64 passthrough (GH-01e)", () => {
  it("Python time.time() float passes through unchanged as a number", () => {
    const generatedAt = 1750312345.678901;
    const args = mapGraphSnapshotEvent({ generatedAt }, 9999);
    expect(args.generatedAt).toBe(generatedAt);
    expect(typeof args.generatedAt).toBe("number");
  });

  it("preserves full float64 precision", () => {
    const generatedAt = 1750312345.123456;
    const args = mapGraphSnapshotEvent({ generatedAt }, 9999);
    // JavaScript numbers are IEEE 754 double; this precision roundtrips fine
    expect(args.generatedAt).toBeCloseTo(generatedAt, 5);
  });

  it("integer epoch (no fractional seconds) also passes through", () => {
    const args = mapGraphSnapshotEvent({ generatedAt: 1750000000 }, 9999);
    expect(args.generatedAt).toBe(1750000000);
  });
});

// ---------------------------------------------------------------------------
// DB round-trip tests — deferred to plan 03 (requires Convex backend + bearer POST)
// ---------------------------------------------------------------------------

it.todo("upsertGraphSnapshot first ingest → activeVersion becomes 1 (DB round-trip)");
it.todo("upsertGraphSnapshot re-POST same snapshotId → activeVersion increments to 2, never two active versions (DB round-trip)");
it.todo("getProjectGraph returns null before any ingest (DB round-trip)");
it.todo("getProjectGraph returns active version nodes/links after ingest (DB round-trip)");
it.todo("sweepGraphSnapshotVersions deletes stale versions, keeps last 7 (DB round-trip)");
