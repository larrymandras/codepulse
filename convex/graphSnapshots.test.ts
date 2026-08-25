import { describe, it, expect, beforeAll } from "vitest";
import { getFunctionName } from "convex/server";
import { internal } from "./_generated/api";

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
  GRAPH_BLOB_CHUNK_CHARS,
  GRAPH_BLOB_MAX_CHUNKS,
  STALE_CHUNK_DELETE_CAP,
  splitGraphBlob,
  joinGraphBlobChunks,
  upsertGraphSnapshot,
  backfillGraphBlob,
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
// Phase 126, SWEEP-02, D-06-REVISED: splitGraphBlob / joinGraphBlobChunks —
// the chunked-blob split/join round trip that replaces the two 6,591-row
// .collect()s D-05 measured against Convex's 4,096-read ceiling.
// ---------------------------------------------------------------------------

describe("splitGraphBlob / joinGraphBlobChunks (126-02, D-06-REVISED)", () => {
  it("splitGraphBlob('') returns [] (documented empty-blob case)", () => {
    expect(splitGraphBlob("")).toEqual([]);
  });

  it("joinGraphBlobChunks([]) returns '' — the reader must handle the empty case identically", () => {
    expect(joinGraphBlobChunks([])).toBe("");
  });

  it("a string of length 3 * GRAPH_BLOB_CHUNK_CHARS splits into exactly 3 chunks", () => {
    const s = "a".repeat(3 * GRAPH_BLOB_CHUNK_CHARS);
    const chunks = splitGraphBlob(s);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.length === GRAPH_BLOB_CHUNK_CHARS)).toBe(true);
  });

  it("a string of length 2 * GRAPH_BLOB_CHUNK_CHARS + 1 splits into exactly 3 chunks, the last of length 1", () => {
    const s = "a".repeat(2 * GRAPH_BLOB_CHUNK_CHARS + 1);
    const chunks = splitGraphBlob(s);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(GRAPH_BLOB_CHUNK_CHARS);
    expect(chunks[1]).toHaveLength(GRAPH_BLOB_CHUNK_CHARS);
    expect(chunks[2]).toHaveLength(1);
  });

  it("round-trips an ASCII fixture through split then join", () => {
    const s = JSON.stringify({ nodes: Array.from({ length: 500 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` })), links: [] });
    const rows = splitGraphBlob(s, 200).map((chunk, seq) => ({ seq, chunk }));
    expect(joinGraphBlobChunks(rows)).toBe(s);
  });

  it("round-trips a fixture with an astral character positioned exactly on a chunk boundary", () => {
    // Build a string where a surrogate pair (an astral emoji, U+1F600) straddles
    // what would otherwise be the chunk boundary at maxChars.
    const maxChars = 20;
    const padding = "x".repeat(maxChars - 1); // boundary would fall AFTER this
    const emoji = "\u{1F600}"; // U+1F600, encoded as a UTF-16 surrogate pair
    const s = padding + emoji + "y".repeat(30);
    const chunks = splitGraphBlob(s, maxChars);

    // No chunk may end with a lone high surrogate, none may begin with a lone
    // low surrogate — the whole point of the boundary adjustment.
    for (const c of chunks) {
      const lastCode = c.charCodeAt(c.length - 1);
      expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false);
      const firstCode = c.charCodeAt(0);
      expect(firstCode >= 0xdc00 && firstCode <= 0xdfff).toBe(false);
    }

    const rows = chunks.map((chunk, seq) => ({ seq, chunk }));
    expect(joinGraphBlobChunks(rows)).toBe(s);
  });

  it("joinGraphBlobChunks sorts by seq — shuffled row order still returns the identical string (control: fails if the sort is removed)", () => {
    const s = JSON.stringify({ nodes: Array.from({ length: 200 }, (_, i) => ({ id: `n${i}` })), links: [] });
    const rows = splitGraphBlob(s, 50).map((chunk, seq) => ({ seq, chunk }));
    expect(rows.length).toBeGreaterThan(2); // otherwise shuffling proves nothing

    // Deliberately shuffled — NOT the seq-ascending array order.
    const shuffled = [rows[rows.length - 1], ...rows.slice(1, -1).reverse(), rows[0]];
    expect(joinGraphBlobChunks(shuffled)).toBe(s);
    expect(joinGraphBlobChunks(rows)).toBe(s); // same result regardless of input order
  });
});

// ---------------------------------------------------------------------------
// Phase 126, SWEEP-02, D-06-REVISED: upsertGraphSnapshot writer shape,
// proven against a recording fake ctx modelled on makeGraphSweepCtx above
// (sibling factory, same style, not a second unrelated harness).
// ---------------------------------------------------------------------------

/**
 * Fake ctx for the WRITER. Models the graphSnapshots meta table and the
 * graphSnapshotBlobChunks table, and RECORDS every insert/patch/delete — in
 * order, in one flat log — so a test can assert on the recorded operation
 * SHAPE and ORDER, not just the end state. Also records any insert into
 * graphSnapshotNodes/graphSnapshotLinks (the retired legacy write path) so a
 * restored insert loop shows up as a non-empty filter rather than a thrown
 * error, keeping the assertion a normal `expect(...).toHaveLength(0)`.
 */
function makeGraphWriteCtx(opts: {
  existingMeta?: any;
  existingChunks?: Array<{ snapshotId: string; version: number; seq: number; chunk: string }>;
} = {}) {
  const ops: Array<{ type: "insert" | "patch" | "delete"; table?: string; doc?: any; id?: string; fields?: any }> = [];
  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}${idCounter++}`;

  let meta: any = opts.existingMeta ? { _id: nextId("meta"), ...opts.existingMeta } : null;
  let chunks: any[] = (opts.existingChunks ?? []).map((c) => ({ _id: nextId("chunk"), ...c }));

  // Minimal index-range recorder: supports .eq/.lt chained the way Convex's
  // real query builder does, and matches rows against the recorded bounds.
  function makeChain(captured: Record<string, { op: string; value: any }>) {
    const chain: any = {
      eq:  (field: string, value: any) => { captured[field] = { op: "eq", value };  return chain; },
      lt:  (field: string, value: any) => { captured[field] = { op: "lt", value };  return chain; },
      lte: (field: string, value: any) => { captured[field] = { op: "lte", value }; return chain; },
    };
    return chain;
  }
  function matches(row: any, captured: Record<string, { op: string; value: any }>) {
    return Object.entries(captured).every(([field, cond]) => {
      const v = row[field];
      if (cond.op === "eq") return v === cond.value;
      if (cond.op === "lte") return v <= cond.value;
      return v < cond.value; // "lt"
    });
  }

  const ctx: any = {
    db: {
      insert: async (table: string, doc: any) => {
        const id = nextId(table);
        const row = { _id: id, ...doc };
        ops.push({ type: "insert", table, doc: row });
        if (table === "graphSnapshots") meta = row;
        else if (table === "graphSnapshotBlobChunks") chunks.push(row);
        // graphSnapshotNodes / graphSnapshotLinks: recorded in `ops` only —
        // this is the retired legacy path, and the test asserts on `ops`
        // filtered by table name.
        return id;
      },
      patch: async (id: string, fields: any) => {
        ops.push({ type: "patch", id, fields });
        if (meta && meta._id === id) Object.assign(meta, fields);
      },
      delete: async (id: string) => {
        ops.push({ type: "delete", id });
        chunks = chunks.filter((c) => c._id !== id);
      },
      query: (table: string) => ({
        withIndex: (_name: string, fn: any) => {
          const captured: Record<string, { op: string; value: any }> = {};
          fn(makeChain(captured));
          return {
            unique: async () => {
              if (table !== "graphSnapshots") throw new Error(`unexpected .unique() on ${table}`);
              return meta && matches(meta, captured) ? meta : null;
            },
            take: async (n: number) => {
              if (table !== "graphSnapshotBlobChunks") throw new Error(`unexpected .take() on ${table}`);
              return chunks.filter((c) => matches(c, captured)).slice(0, n);
            },
            collect: async () => {
              throw new Error(`REGRESSION: unbounded .collect() on ${table}`);
            },
          };
        },
      }),
    },
  };

  return { ctx, ops, getMeta: () => meta, getChunks: () => chunks };
}

/** Builds a fixture with the given node/link counts, plus 2 deliberately
 * dangling links, so the dangling-link guard has something to drop. */
function buildWriteFixture(nodeCount: number, linkCount: number) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: `graphify:test:n${i}`,
    label: `Node number ${i} with a realistic-length label for size estimation`,
    type: i % 3 === 0 ? "code" : "note",
    community: i % 5 === 0 ? null : (i % 7),
    source: i % 2 === 0 ? "codepulse" : "astridr-repo",
  }));
  const links: Array<{ source: string; target: string; relation: string }> = [];
  for (let i = 0; i < linkCount - 2; i++) {
    links.push({
      source: `graphify:test:n${i % nodeCount}`,
      target: `graphify:test:n${(i + 1) % nodeCount}`,
      relation: "imports",
    });
  }
  // Deliberately dangling — endpoints not in the node set.
  links.push({ source: "graphify:test:n0", target: "graphify:test:MISSING-TARGET", relation: "imports" });
  links.push({ source: "graphify:test:MISSING-SOURCE", target: "graphify:test:n1", relation: "imports" });
  return { nodes, links };
}

/** Mirrors the writer's own projection (dangling-link filter + community
 * null/undefined coercion) so the round-trip test can assert against an
 * independently computed expectation, then round-trips it through JSON so
 * `undefined` fields drop out exactly as JSON.stringify would drop them. */
function expectedWriterBlob(nodes: any[], links: any[]) {
  const nodeIdSet = new Set(nodes.map((n) => n.id));
  const filteredLinks = links.filter((l) => nodeIdSet.has(l.source) && nodeIdSet.has(l.target));
  const projectedNodes = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    type: n.type,
    community: n.community === null || n.community === undefined ? undefined : n.community,
    source: n.source,
  }));
  return JSON.parse(JSON.stringify({ nodes: projectedNodes, links: filteredLinks }));
}

describe("upsertGraphSnapshot — writer shape (126-02, D-06-REVISED)", () => {
  const SNAPSHOT_ID = "test-graph-126-02";
  const { nodes, links } = buildWriteFixture(3000, 2000);
  const args = {
    snapshotId: SNAPSHOT_ID,
    nodes,
    links,
    sources: [],
    nodeCount: nodes.length,
    linkCount: links.length,
    generatedAt: 1000,
    receivedAt: 1000,
  };

  // Run once (first ingest, no existing meta) and share across assertions —
  // one test per property in <behavior>, per the plan.
  let h: ReturnType<typeof makeGraphWriteCtx>;
  let chunkInserts: Array<{ doc: any }>;

  beforeAll(async () => {
    h = makeGraphWriteCtx({});
    await (upsertGraphSnapshot as any)._handler(h.ctx, args);
    chunkInserts = h.ops.filter((o) => o.type === "insert" && o.table === "graphSnapshotBlobChunks") as any;
  });

  it("fixture is >= 3,000 nodes and produces more than one chunk", () => {
    expect(nodes.length).toBeGreaterThanOrEqual(3000);
    expect(chunkInserts.length).toBeGreaterThan(1);
  });

  it("inserts ZERO graphSnapshotNodes rows and ZERO graphSnapshotLinks rows (control: fails if either insert loop is restored)", () => {
    const legacyNodeInserts = h.ops.filter((o) => o.type === "insert" && o.table === "graphSnapshotNodes");
    const legacyLinkInserts = h.ops.filter((o) => o.type === "insert" && o.table === "graphSnapshotLinks");
    expect(legacyNodeInserts).toHaveLength(0);
    expect(legacyLinkInserts).toHaveLength(0);
  });

  it("inserted chunk rows carry seq values exactly 0..n-1, dense, no gaps", () => {
    const seqs = chunkInserts.map((o) => o.doc.seq).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: chunkInserts.length }, (_, i) => i));
  });

  it("every inserted chunk's length is <= GRAPH_BLOB_CHUNK_CHARS", () => {
    expect(chunkInserts.every((o) => o.doc.chunk.length <= GRAPH_BLOB_CHUNK_CHARS)).toBe(true);
  });

  it("the meta doc written carries blobChunkCount equal to the number of chunk rows inserted", () => {
    const metaInsert = h.ops.find((o) => o.type === "insert" && o.table === "graphSnapshots");
    expect(metaInsert).toBeDefined();
    expect(metaInsert!.doc.blobChunkCount).toBe(chunkInserts.length);
  });

  it("joinGraphBlobChunks(<the inserted rows>) parses to {nodes, links} exactly as the writer serialized them", () => {
    const rows = chunkInserts.map((o) => ({ seq: o.doc.seq, chunk: o.doc.chunk }));
    const parsed = JSON.parse(joinGraphBlobChunks(rows));
    expect(parsed).toEqual(expectedWriterBlob(nodes, links));
  });

  it("dangling links are still dropped — a link whose target is not in the node set does not appear in the serialized blob", () => {
    const rows = chunkInserts.map((o) => ({ seq: o.doc.seq, chunk: o.doc.chunk }));
    const parsed = JSON.parse(joinGraphBlobChunks(rows));
    const hasDangling = parsed.links.some(
      (l: any) => l.target === "graphify:test:MISSING-TARGET" || l.source === "graphify:test:MISSING-SOURCE"
    );
    expect(hasDangling).toBe(false);
  });
});

describe("upsertGraphSnapshot — pointer flip happens BEFORE the stale-chunk delete (126-02)", () => {
  it("the meta write's operation index precedes the first delete's index (order, not just end state)", async () => {
    const SNAPSHOT_ID = "test-graph-order";
    const h = makeGraphWriteCtx({
      existingMeta: {
        snapshotId: SNAPSHOT_ID,
        activeVersion: 1,
        storedVersions: [1],
        sources: [],
        nodeCount: 0,
        linkCount: 0,
        storedNodeCount: 0,
        storedLinkCount: 0,
        generatedAt: 0,
        updatedAt: 0,
        blobChunkCount: 1,
      },
      existingChunks: [
        { snapshotId: SNAPSHOT_ID, version: 1, seq: 0, chunk: "old-chunk" },
      ],
    });
    const { nodes, links } = buildWriteFixture(5, 3);
    await (upsertGraphSnapshot as any)._handler(h.ctx, {
      snapshotId: SNAPSHOT_ID,
      nodes,
      links,
      sources: [],
      nodeCount: nodes.length,
      linkCount: links.length,
      generatedAt: 2000,
      receivedAt: 2000,
    });

    const metaOpIndex = h.ops.findIndex(
      (o) => o.type === "patch" || (o.type === "insert" && o.table === "graphSnapshots")
    );
    const firstDeleteIndex = h.ops.findIndex((o) => o.type === "delete");

    // An END-STATE assertion (e.g. "the old chunk is gone") cannot distinguish
    // delete-then-flip from flip-then-delete — both leave the same final rows.
    // Only the recorded operation ORDER can catch a reordering that would
    // otherwise let a mid-crash leave activeVersion pointing at a version
    // whose chunks were already deleted.
    expect(metaOpIndex).toBeGreaterThanOrEqual(0);
    expect(firstDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(metaOpIndex).toBeLessThan(firstDeleteIndex);
  });
});

describe("upsertGraphSnapshot — stale-chunk delete survivor set (126-02)", () => {
  it("deletes chunks of versions OLDER than the new one; the new version's own chunks survive (control: a too-broad predicate fails this)", async () => {
    const SNAPSHOT_ID = "test-graph-survivor";
    const h = makeGraphWriteCtx({
      existingMeta: {
        snapshotId: SNAPSHOT_ID,
        activeVersion: 1,
        storedVersions: [1],
        sources: [],
        nodeCount: 0,
        linkCount: 0,
        storedNodeCount: 0,
        storedLinkCount: 0,
        generatedAt: 0,
        updatedAt: 0,
        blobChunkCount: 2,
      },
      existingChunks: [
        { snapshotId: SNAPSHOT_ID, version: 1, seq: 0, chunk: "old-0" },
        { snapshotId: SNAPSHOT_ID, version: 1, seq: 1, chunk: "old-1" },
      ],
    });
    const { nodes, links } = buildWriteFixture(5, 3);
    await (upsertGraphSnapshot as any)._handler(h.ctx, {
      snapshotId: SNAPSHOT_ID,
      nodes,
      links,
      sources: [],
      nodeCount: nodes.length,
      linkCount: links.length,
      generatedAt: 2000,
      receivedAt: 2000,
    });

    const survivors = h.getChunks();
    // Every survivor belongs to the NEW version (2); none belong to the old
    // version (1) that was seeded in.
    expect(survivors.length).toBeGreaterThan(0);
    expect(survivors.every((c) => c.version === 2)).toBe(true);
    expect(survivors.some((c) => c.version === 1)).toBe(false);
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

// ---------------------------------------------------------------------------
// SWEEP-02 correctness guards, added by the orchestrator 2026-08-25 after a
// cross-AI review found two HIGH defects that every existing test passed over.
// ---------------------------------------------------------------------------

/** A small, normally-sized writer fixture, local to these guard tests. */
function normalArgs() {
  return {
    snapshotId: "guard-normal",
    nodes: Array.from({ length: 5 }, (_, i) => ({
      id: `n${i}`, label: `node ${i}`, type: "file", community: null, source: "repo",
    })),
    links: [{ source: "n0", target: "n1", relation: "imports" }],
    sources: [{
      source: "repo", kind: "graphify", nodeCount: 5, linkCount: 1,
      emittedNodeCount: 5, emittedLinkCount: 1, truncated: false,
    }],
    nodeCount: 5, linkCount: 1, generatedAt: 1, receivedAt: 1,
  };
}

describe("upsertGraphSnapshot — writer-side chunk cap (SWEEP-02 guard)", () => {
  /** Few nodes, enormous labels: crosses the chunk cap without building a
   *  100k-element fixture. 20 x ~130k chars ~= 2.6 MB -> >16 chunks. */
  function oversizedArgs() {
    const big = "x".repeat(130_000);
    return {
      snapshotId: "cap-test",
      nodes: Array.from({ length: 20 }, (_, i) => ({
        id: `n${i}`, label: big, type: "file", community: null, source: "repo",
      })),
      links: [],
      sources: [{
        source: "repo", kind: "graphify", nodeCount: 20, linkCount: 0,
        emittedNodeCount: 20, emittedLinkCount: 0, truncated: false,
      }],
      nodeCount: 20, linkCount: 0, generatedAt: 1, receivedAt: 1,
    };
  }

  it("CONTROL: the oversized fixture really does exceed the cap (otherwise the test below is vacuous)", () => {
    const a = oversizedArgs();
    const blob = JSON.stringify({
      nodes: a.nodes.map((n) => ({
        id: n.id, label: n.label, type: n.type, community: n.community, source: n.source,
      })),
      links: [],
    });
    expect(splitGraphBlob(blob).length).toBeGreaterThan(GRAPH_BLOB_MAX_CHUNKS);
  });

  it("THROWS instead of publishing a blob the reader would reject", async () => {
    const h = makeGraphWriteCtx({});
    await expect(
      (upsertGraphSnapshot as any)._handler(h.ctx, oversizedArgs())
    ).rejects.toThrow(/GRAPH_BLOB_MAX_CHUNKS/);
  });

  it("leaves the PRIOR version completely untouched — the half that separates 'rejected safely' from 'rejected after damage'", async () => {
    const priorChunks = [
      { snapshotId: "cap-test", version: 7, seq: 0, chunk: '{"nodes":[],"links":[]}' },
    ];
    const h = makeGraphWriteCtx({
      existingMeta: { snapshotId: "cap-test", activeVersion: 7, blobChunkCount: 1, storedVersions: [7] },
      existingChunks: priorChunks,
    });

    await expect(
      (upsertGraphSnapshot as any)._handler(h.ctx, oversizedArgs())
    ).rejects.toThrow();

    // Nothing written, nothing deleted, pointer unmoved.
    expect(h.ops.filter((o) => o.type === "insert")).toHaveLength(0);
    expect(h.ops.filter((o) => o.type === "delete")).toHaveLength(0);
    expect(h.ops.filter((o) => o.type === "patch")).toHaveLength(0);
    expect(h.getMeta().activeVersion).toBe(7);
    expect(h.getChunks()).toHaveLength(1);
  });

  it("CONTROL: a normally-sized blob still publishes (proves the guard is not simply refusing everything)", async () => {
    const h = makeGraphWriteCtx({});
    await (upsertGraphSnapshot as any)._handler(h.ctx, normalArgs());
    expect(
      h.ops.filter((o) => o.type === "insert" && o.table === "graphSnapshotBlobChunks").length
    ).toBeGreaterThan(0);
  });
});

describe("upsertGraphSnapshot — expectedVersion TOCTOU guard (SWEEP-02)", () => {
  it("RETURNS a versionAdvanced status (not a throw) when activeVersion moved since the backfill read it, without writing anything", async () => {
    // The backfill paged against version 3; a producer ingest advanced it to 4
    // before the mutation ran. Publishing now would roll the graph backwards.
    //
    // Asserts a RETURNED status, not a thrown error (review correction,
    // 2026-08-25): this mutation is called from backfillGraphBlob via
    // ctx.runMutation, and a throw here would propagate as an uncaught
    // exception through that action, defeating backfillGraphBlob's own
    // "every path returns a named status" contract.
    const h = makeGraphWriteCtx({
      existingMeta: { snapshotId: "toctou", activeVersion: 4, blobChunkCount: 1, storedVersions: [4] },
      existingChunks: [{ snapshotId: "toctou", version: 4, seq: 0, chunk: '{"nodes":[],"links":[]}' }],
    });

    const result = await (upsertGraphSnapshot as any)._handler(h.ctx, {
      ...normalArgs(), snapshotId: "toctou", expectedVersion: 3,
    });

    expect(result).toEqual({
      status: "versionAdvanced",
      snapshotId: "toctou",
      expectedVersion: 3,
      foundVersion: 4,
    });
    expect(h.ops.filter((o) => o.type === "insert")).toHaveLength(0);
    expect(h.ops.filter((o) => o.type === "patch")).toHaveLength(0);
    expect(h.ops.filter((o) => o.type === "delete")).toHaveLength(0);
    expect(h.getMeta().activeVersion).toBe(4);
  });

  it("CONTROL: publishes normally when expectedVersion MATCHES — so the guard is not refusing every backfill", async () => {
    const h = makeGraphWriteCtx({
      existingMeta: { snapshotId: "toctou", activeVersion: 3, blobChunkCount: 1, storedVersions: [3] },
      existingChunks: [{ snapshotId: "toctou", version: 3, seq: 0, chunk: '{"nodes":[],"links":[]}' }],
    });

    await (upsertGraphSnapshot as any)._handler(h.ctx, {
      ...normalArgs(), snapshotId: "toctou", expectedVersion: 3,
    });

    expect(
      h.ops.filter((o) => o.type === "insert" && o.table === "graphSnapshotBlobChunks").length
    ).toBeGreaterThan(0);
  });

  it("CONTROL: the normal producer path (no expectedVersion) is unaffected by the guard", async () => {
    const h = makeGraphWriteCtx({
      existingMeta: { snapshotId: "plain", activeVersion: 9, blobChunkCount: 1, storedVersions: [9] },
    });
    await (upsertGraphSnapshot as any)._handler(h.ctx, { ...normalArgs(), snapshotId: "plain" });
    expect(
      h.ops.filter((o) => o.type === "insert" && o.table === "graphSnapshotBlobChunks").length
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// backfillGraphBlob (the ACTION) — a race the action's OWN pre-check cannot
// see (SWEEP-02, review correction 2026-08-25).
//
// The tests above exercise upsertGraphSnapshot's handler directly, in
// isolation. They cannot prove what backfillGraphBlob itself DOES when the
// race actually happens, because in the real failure mode the action's own
// pre-check (Guard 3) reads the SAME pre-race version everything else saw —
// it is the mutation's OWN internal re-read, a separate transaction, that
// catches a producer ingest landing in the gap between them. A test that
// only drives upsertGraphSnapshot directly cannot distinguish "the mutation
// guard works" from "the action correctly surfaces what the guard reports",
// and the second property is what this describe block proves.
//
// Simulated here with a hand-built fake ctx exposing only runQuery/
// runMutation — the correct seam for testing an internalAction, which has no
// direct ctx.db access of its own. getFunctionName(fnRef) discriminates
// which function reference is being called, because `internal.*` is a Proxy
// that returns a NEW object on every property access (verified against
// node_modules/convex/dist/cjs/server/api.js's createApi) — a strict `===`
// comparison on the function reference itself would silently never match.
// ---------------------------------------------------------------------------

describe("backfillGraphBlob — surfaces a race the action's own pre-check cannot see (SWEEP-02)", () => {
  /** Builds a fake action ctx where the two runQuery reads the action makes
   * (initial meta lookup + Guard 3's early-out re-read) both see version 3 —
   * the same version the backfill paged against — but the mutation's OWN
   * internal check (simulated here, not the real upsertGraphSnapshot) sees a
   * DIFFERENT, later version 4. This is exactly what a producer ingest
   * landing between the action's pre-check and the mutation's own
   * transaction would look like from the outside. */
  function makeRacingBackfillCtx() {
    const runMutationCalls: unknown[] = [];
    const ctx: any = {
      runQuery: async (fnRef: unknown, args: any) => {
        const name = getFunctionName(fnRef as any);
        if (name === getFunctionName(internal.graphSnapshots.getGraphMetaForBackfill)) {
          return {
            snapshotId: args.snapshotId,
            activeVersion: 3,
            blobChunkCount: undefined, // not yet chunked -- eligible to backfill
            sources: [],
            nodeCount: 1,
            linkCount: 0,
            storedNodeCount: 1,
            storedLinkCount: 0,
            generatedAt: 1,
          };
        }
        if (name === getFunctionName(internal.graphSnapshots.getGraphEntityPage)) {
          if (args.kind === "nodes" && args.cursor === null) {
            return {
              page: [{ nodeId: "n0", label: "l0", type: "file", community: undefined, source: "repo" }],
              isDone: true,
              continueCursor: "",
            };
          }
          return { page: [], isDone: true, continueCursor: "" };
        }
        throw new Error(`TEST BUG: unexpected runQuery ${name}`);
      },
      runMutation: async (fnRef: unknown, args: any) => {
        runMutationCalls.push(args);
        const name = getFunctionName(fnRef as any);
        if (name === getFunctionName(internal.graphSnapshots.upsertGraphSnapshot)) {
          // The REAL race: this mutation's own transaction sees version 4 —
          // NOT the version 3 every runQuery call above reported — modelling
          // a producer ingest that landed after the action's checks ran but
          // before this mutation's own read. Mirrors upsertGraphSnapshot's
          // real expectedVersion guard: return, do not throw.
          const trueCurrentVersion = 4;
          if (args.expectedVersion !== undefined && args.expectedVersion !== trueCurrentVersion) {
            return {
              status: "versionAdvanced",
              snapshotId: args.snapshotId,
              expectedVersion: args.expectedVersion,
              foundVersion: trueCurrentVersion,
            };
          }
          throw new Error("TEST BUG: fixture should always hit the versionAdvanced branch");
        }
        throw new Error(`TEST BUG: unexpected runMutation ${name}`);
      },
    };
    return { ctx, runMutationCalls };
  }

  it("returns versionAdvanced (not an uncaught throw) when only the mutation's own transaction detects the moved version", async () => {
    const { ctx, runMutationCalls } = makeRacingBackfillCtx();

    const result = await (backfillGraphBlob as any)._handler(ctx, {});

    expect(result.status).toBe("versionAdvanced");
    expect(result.sourceVersion).toBe(3);
    // The mutation WAS attempted (this is the race path, not the cheap
    // action-side early-out short-circuiting first) — proving the action's
    // own Guard 3 pre-check passed (it also saw version 3) and it was the
    // mutation's internal guard that caught the race and reported it back.
    expect(runMutationCalls).toHaveLength(1);
  });

  it("CONTROL: the action-side early-out fires BEFORE calling the mutation when the race is visible to it too (proves the two guards are independent, not the same code path)", async () => {
    let sawEarlyMeta = true;
    const runMutationCalls: unknown[] = [];
    const ctx: any = {
      runQuery: async (fnRef: unknown, args: any) => {
        const name = getFunctionName(fnRef as any);
        if (name === getFunctionName(internal.graphSnapshots.getGraphMetaForBackfill)) {
          // First call (initial meta lookup) reports version 3; by the time
          // Guard 3's own re-read runs, this fixture ALREADY shows the moved
          // version — the race is visible to the action's own cheap
          // pre-check this time, not just the mutation's.
          const version = sawEarlyMeta ? 3 : 4;
          sawEarlyMeta = false;
          return {
            snapshotId: args.snapshotId,
            activeVersion: version,
            blobChunkCount: undefined,
            sources: [], nodeCount: 1, linkCount: 0, storedNodeCount: 1, storedLinkCount: 0, generatedAt: 1,
          };
        }
        if (name === getFunctionName(internal.graphSnapshots.getGraphEntityPage)) {
          if (args.kind === "nodes" && args.cursor === null) {
            return {
              page: [{ nodeId: "n0", label: "l0", type: "file", community: undefined, source: "repo" }],
              isDone: true,
              continueCursor: "",
            };
          }
          return { page: [], isDone: true, continueCursor: "" };
        }
        throw new Error(`TEST BUG: unexpected runQuery ${name}`);
      },
      runMutation: async (fnRef: unknown, args: any) => {
        runMutationCalls.push(args);
        throw new Error("TEST BUG: the action-side early-out should have returned before this ran");
      },
    };

    const result = await (backfillGraphBlob as any)._handler(ctx, {});

    expect(result.status).toBe("versionAdvanced");
    expect(runMutationCalls).toHaveLength(0);
  });
});
