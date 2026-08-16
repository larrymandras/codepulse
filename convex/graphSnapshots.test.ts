import { describe, it, expect } from "vitest";

/**
 * Pure-logic mirrors of the `graph_snapshot` ingest dispatch and receiver
 * logic (mirroring the repo's kg.test.ts / forge.test.ts style — no DB
 * round-trip). Covers GH-01a..e from the validation architecture.
 */

import {
  selectVersionDeletes,
  GRAPH_SNAPSHOT_KEEP_VERSIONS,
  projectSnapshotRow,
  sweepGraphSnapshotVersions,
  backfillGraphStoredVersions,
} from "./graphSnapshots";

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
// Phase 114 D-13: projectSnapshotRow — listSnapshots gains a `sources` field
// ---------------------------------------------------------------------------

describe("projectSnapshotRow (114 D-13)", () => {
  const armsSource = {
    source:           "arms-host",
    kind:              "arms",
    nodeCount:         12,
    linkCount:         4,
    emittedNodeCount:  12,
    emittedLinkCount:  4,
    truncated:         false,
  };
  const codeSource = {
    source:           "graphify",
    kind:              "code",
    nodeCount:         3904,
    linkCount:         5210,
    emittedNodeCount:  3904,
    emittedLinkCount:  5210,
    truncated:         false,
  };
  const baseRow = {
    snapshotId:  "astridr-project-graph",
    nodeCount:   3904,
    linkCount:   5210,
    generatedAt: 1750312345.678901,
    updatedAt:   1750312400.123456,
    sources:     [armsSource, codeSource],
  };

  it("returns sources deep-equal to the input array — order and sub-fields preserved", () => {
    const result = projectSnapshotRow(baseRow);
    expect(result.sources).toEqual([armsSource, codeSource]);
  });

  it("returns the five pre-existing fields byte-identical (no-regression control)", () => {
    const result = projectSnapshotRow(baseRow);
    expect(result.snapshotId).toBe(baseRow.snapshotId);
    expect(result.nodeCount).toBe(baseRow.nodeCount);
    expect(result.linkCount).toBe(baseRow.linkCount);
    expect(result.generatedAt).toBe(baseRow.generatedAt);
    expect(result.updatedAt).toBe(baseRow.updatedAt);
  });

  it("returns exactly 6 keys — no stray extra or dropped field", () => {
    const result = projectSnapshotRow(baseRow);
    expect(Object.keys(result).sort()).toEqual(
      ["generatedAt", "linkCount", "nodeCount", "snapshotId", "sources", "updatedAt"]
    );
  });

  it("handles an empty sources array (row predates the arms probe)", () => {
    const result = projectSnapshotRow({ ...baseRow, sources: [] });
    expect(result.sources).toEqual([]);
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

// ---------------------------------------------------------------------------
// storedVersions on the meta doc (2026-08-16) — the fix that let crons.ts
// re-enable this sweep after it sat disabled from 2026-07-14.
//
// The defect was NOT the delete cap (already corrected 2026-08-13). It was
// candidate SELECTION: deriving the version set by collecting every
// graphSnapshotNodes row across every stored version, ~10,000 rows per version
// and up to 7 kept, against a 4,096-READ ceiling. Every test below exercises the
// handler through the same `._handler(ctx)` seam aggregates.test.ts uses, with a
// fake ctx modelled on convex/workspace.test.ts's — the phase that fixed the
// identical shape first.
// ---------------------------------------------------------------------------

/**
 * Fake ctx for the sweep. Models two entity tables keyed by version, plus the
 * meta table, and RECORDS every read so a test can assert the read count rather
 * than trusting that a bounded-looking query was bounded.
 */
function makeGraphSweepCtx(opts: {
  metas: any[];
  nodesByVersion?: Record<number, number>;
  linksByVersion?: Record<number, number>;
}) {
  const patches: any[] = [];
  const deleted: string[] = [];
  const warnings: string[] = [];
  let rowsRead = 0;

  const metas = opts.metas.map((m, i) => ({ ...m, _id: `meta${i}` }));
  const mk = (prefix: string, byVersion: Record<number, number> = {}) => {
    const out: Record<number, { _id: string }[]> = {};
    for (const [ver, n] of Object.entries(byVersion)) {
      out[Number(ver)] = Array.from({ length: n }, (_, i) => ({ _id: `${prefix}-v${ver}-${i}` }));
    }
    return out;
  };
  const nodes = mk("n", opts.nodesByVersion);
  const links = mk("l", opts.linksByVersion);
  const tableOf = (t: string) => (t === "graphSnapshotNodes" ? nodes : links);

  const ctx: any = {
    db: {
      query: (table: string) => ({
        collect: async () => {
          if (table !== "graphSnapshots") throw new Error(`unexpected .collect() on ${table}`);
          rowsRead += metas.length;
          return metas;
        },
        withIndex: (_name: string, fn: any) => {
          const captured: any = {};
          fn({
            eq: (field: string, value: any) => {
              captured[field] = value;
              const chain: any = {
                eq: (f2: string, v2: any) => {
                  captured[f2] = v2;
                  return chain;
                },
              };
              return chain;
            },
          });
          return {
            take: async (n: number) => {
              const rows = (tableOf(table)[captured.version] ?? []).slice(0, n);
              rowsRead += rows.length;
              return rows;
            },
            collect: async () => {
              // The sweep must never reach this on an entity table — that is the
              // defect. Throwing makes a regression loud instead of slow.
              throw new Error(`REGRESSION: unbounded .collect() on ${table}`);
            },
          };
        },
      }),
      patch: async (id: string, fields: any) => {
        patches.push({ id, fields });
        const m = metas.find((x) => x._id === id);
        if (m) Object.assign(m, fields);
      },
      delete: async (id: string) => {
        deleted.push(id);
        rowsRead += 1; // a delete costs a read too — the whole point of the fix
        for (const tbl of [nodes, links]) {
          for (const v of Object.keys(tbl)) {
            tbl[Number(v)] = tbl[Number(v)].filter((r) => r._id !== id);
          }
        }
      },
    },
  };

  const origWarn = console.warn;
  console.warn = (...a: any[]) => warnings.push(a.join(" "));
  const restore = () => {
    console.warn = origWarn;
  };

  return { ctx, patches, deleted, warnings, metas, restore, readCount: () => rowsRead };
}

const baseMeta = (over: any = {}) => ({
  snapshotId: "astridr-project-graph",
  activeVersion: 10,
  sources: [],
  nodeCount: 0,
  linkCount: 0,
  storedNodeCount: 0,
  storedLinkCount: 0,
  generatedAt: 0,
  updatedAt: 0,
  ...over,
});

describe("sweepGraphSnapshotVersions — candidate selection reads ONE field, not every row", () => {
  it("selects delete candidates from meta.storedVersions and never collects an entity table", async () => {
    // 10 stored versions, keep 7 -> versions 1,2,3 are stale; one per invocation.
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ storedVersions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })],
      nodesByVersion: { 1: 3 },
      linksByVersion: { 1: 2 },
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }

    // Version 1 fully removed, and ONLY version 1.
    expect(h.deleted.sort()).toEqual(["l-v1-0", "l-v1-1", "n-v1-0", "n-v1-1", "n-v1-2"]);
    expect(h.metas[0].storedVersions).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(h.metas[0].pruneIncomplete).toBe(false);

    // THE PROPERTY THE FIX EXISTS FOR: total rows read is a handful, not the
    // ~70,000 the old candidate-selection collect would have cost. The fake
    // throws outright on an entity-table .collect(), so a regression cannot
    // merely be slow here — it fails.
    expect(h.readCount()).toBeLessThan(30);
  });

  it("REFUSES to treat an absent storedVersions as an empty list, and says why", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({})], // no storedVersions — a doc predating the field
      nodesByVersion: { 1: 5 },
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }

    // Nothing deleted, and the reason is stated rather than silent. "Absent" and
    // "empty" are the same to selectVersionDeletes, and the difference between
    // them is "prune nothing forever" versus "nothing to prune".
    expect(h.deleted).toEqual([]);
    expect(h.warnings.join(" ")).toMatch(/storedVersions is absent/);
    expect(h.warnings.join(" ")).toMatch(/backfillGraphStoredVersions/);
  });

  it("CONTROL: the same meta WITH storedVersions does sweep — so the refusal above is a decision, not an inability", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ storedVersions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })],
      nodesByVersion: { 1: 5 },
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }
    expect(h.deleted.length).toBe(5);
    expect(h.warnings.join(" ")).not.toMatch(/storedVersions is absent/);
  });

  it("does nothing when the stored list is within the keep limit", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 3, storedVersions: [1, 2, 3] })],
      nodesByVersion: { 1: 99 },
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }
    expect(h.deleted).toEqual([]);
    expect(h.metas[0].storedVersions).toEqual([1, 2, 3]);
  });
});

describe("sweepGraphSnapshotVersions — the cap leaves the version selectable, never stranded", () => {
  it("on a cap hit it flags pruneIncomplete and KEEPS the version in storedVersions", async () => {
    // 1,500 nodes in the stale version against a 1,000 cap.
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ storedVersions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })],
      nodesByVersion: { 1: 1500 },
      linksByVersion: { 1: 400 },
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }

    expect(h.deleted.length).toBe(1000); // exactly the cap, never more
    expect(h.metas[0].pruneIncomplete).toBe(true);
    // The load-bearing half: version 1 is STILL listed, so the next run
    // re-selects and finishes it. Dropping it here is how rows get stranded.
    expect(h.metas[0].storedVersions).toContain(1);
  });

  it("when node deletes consume the WHOLE budget, links are not even looked at — and that still counts as more-remains", async () => {
    // Exactly the cap in nodes, so linkBudget is 0 and the link query never runs.
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ storedVersions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })],
      nodesByVersion: { 1: 1000 },
      linksByVersion: { 1: 250 },
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }

    expect(h.deleted.length).toBe(1000);
    // If this returned "done", version 1 would leave storedVersions while 250
    // link rows survived — permanently unreachable, because selection is BY
    // VERSION and no later pass would ever name it again.
    expect(h.metas[0].pruneIncomplete).toBe(true);
    expect(h.metas[0].storedVersions).toContain(1);
  });

  it("clears a stale pruneIncomplete once nothing is over the keep limit", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 3, storedVersions: [1, 2, 3], pruneIncomplete: true })],
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }
    expect(h.metas[0].pruneIncomplete).toBe(false);
  });

  it("SELF-HEALS the crash case: a listed version whose rows are already gone completes cleanly", async () => {
    // The post-crash state, constructed directly rather than induced: the entry
    // survives in storedVersions but the rows do not.
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ storedVersions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], pruneIncomplete: true })],
      nodesByVersion: {},
      linksByVersion: {},
    });
    try {
      await (sweepGraphSnapshotVersions as any)._handler(h.ctx);
    } finally {
      h.restore();
    }
    expect(h.deleted).toEqual([]);
    expect(h.metas[0].storedVersions).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(h.metas[0].pruneIncomplete).toBe(false);
  });
});

describe("backfillGraphStoredVersions — probes, never scans", () => {
  it("probes one row per candidate version and reports what it found", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 5 })],
      nodesByVersion: { 2: 9000, 4: 9000, 5: 9000 }, // 1 and 3 already swept away
    });
    let res: any;
    try {
      res = await (backfillGraphStoredVersions as any)._handler(h.ctx, { window: 10 });
    } finally {
      h.restore();
    }

    expect(res.snapshots[0].found).toEqual([2, 4, 5]);
    expect(h.metas[0].storedVersions).toEqual([2, 4, 5]);

    // THE POINT: 27,000 rows exist across those versions and the probe read a
    // handful. Cost is per VERSION, not per ROW.
    expect(h.readCount()).toBeLessThan(20);
  });

  it("does NOT early-stop at a gap — a non-contiguous list is found in full", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 6 })],
      nodesByVersion: { 1: 1, 5: 1, 6: 1 }, // gap at 2,3,4
    });
    try {
      await (backfillGraphStoredVersions as any)._handler(h.ctx, { window: 10 });
    } finally {
      h.restore();
    }
    // Stopping at the first miss would have yielded [1] and silently orphaned 5
    // and 6 — they would read as "already gone" and never be swept.
    expect(h.metas[0].storedVersions).toEqual([1, 5, 6]);
  });

  it("REPORTS a truncated window instead of silently returning a short list", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 10 })],
      nodesByVersion: { 8: 1, 9: 1, 10: 1 },
    });
    let res: any;
    try {
      res = await (backfillGraphStoredVersions as any)._handler(h.ctx, { window: 3 });
    } finally {
      h.restore();
    }
    // Window covers 8..10, the oldest probed version HAS rows, so older ones may
    // exist beyond the window.
    expect(res.snapshots[0].found).toEqual([8, 9, 10]);
    expect(res.snapshots[0].windowTruncated).toBe(true);
  });

  it("CONTROL: a window with room to spare reports NO truncation", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 10 })],
      nodesByVersion: { 8: 1, 9: 1, 10: 1 },
    });
    let res: any;
    try {
      res = await (backfillGraphStoredVersions as any)._handler(h.ctx, { window: 10 });
    } finally {
      h.restore();
    }
    expect(res.snapshots[0].windowTruncated).toBe(false);
  });

  it("skips a doc that already has storedVersions, and force overrides", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 3, storedVersions: [3] })],
      nodesByVersion: { 1: 1, 2: 1, 3: 1 },
    });
    let skipped: any, forced: any;
    try {
      skipped = await (backfillGraphStoredVersions as any)._handler(h.ctx, {});
      forced = await (backfillGraphStoredVersions as any)._handler(h.ctx, { force: true });
    } finally {
      h.restore();
    }
    expect(skipped.snapshots[0].skipped).toBe(true);
    expect(skipped.snapshots[0].found).toEqual([3]); // untouched
    expect(forced.snapshots[0].skipped).toBe(false);
    expect(forced.snapshots[0].found).toEqual([1, 2, 3]); // recomputed
  });

  it("deletes nothing, ever", async () => {
    const h = makeGraphSweepCtx({
      metas: [baseMeta({ activeVersion: 4 })],
      nodesByVersion: { 1: 5, 2: 5, 3: 5, 4: 5 },
    });
    try {
      await (backfillGraphStoredVersions as any)._handler(h.ctx, { window: 10 });
    } finally {
      h.restore();
    }
    expect(h.deleted).toEqual([]);
  });
});
