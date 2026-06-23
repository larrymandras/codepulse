/**
 * Tests for computeDiff (pure function) and useKgDiff hook behavior.
 *
 * TDD Wave 0 — covers:
 *   - Added/removed/changed node sets (D-10: changed if attributes OR incident edges differ)
 *   - Edge independent classification (D-11)
 *   - Composite key fallback for edge identity (Pitfall 6)
 *   - 404 graceful-degrade — compare() sets error, does not throw (D-08)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { computeDiff } from "./useKgDiff";
import type { KgGraphData, KgNode, KgAttribute, KgLink } from "../lib/kg-graph";

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeNode(
  id: string,
  attrs: Partial<KgAttribute>[] = [],
): KgNode {
  return {
    id,
    name: `node-${id}`,
    entityType: "person",
    agentId: "agent1",
    val: 3,
    degree: 1,
    color: "#10b981",
    attributes: attrs.map((a) => ({
      predicate: a.predicate ?? "knows",
      value: a.value ?? "value",
      confidence: a.confidence ?? 0.9,
      validFrom: a.validFrom ?? null,
      validTo: a.validTo ?? null,
      contradictionFlag: a.contradictionFlag ?? false,
      sourceTripleId: a.sourceTripleId ?? "t1",
    })),
    synthetic: false,
  };
}

function makeLink(
  id: string,
  source: string,
  target: string,
  predicate = "knows",
  current = true,
  validTo: string | null = null,
): KgLink {
  return {
    id,
    source,
    target,
    predicate,
    confidence: 0.9,
    width: 2,
    current,
    contradictionFlag: false,
    validFrom: null,
    validTo,
    agentId: "agent1",
  };
}

function makeGraph(nodes: KgNode[], links: KgLink[]): KgGraphData {
  return {
    nodes,
    links,
    stats: {
      nodeCount: nodes.length,
      edgeCount: links.length,
      attributeCount: 0,
      currentEdges: links.filter((l) => l.current).length,
      supersededEdges: links.filter((l) => !l.current).length,
      contradictionEdges: 0,
    },
  };
}

// ── computeDiff: node classification ────────────────────────────────────────

describe("computeDiff — node sets", () => {
  it("adds a node present in B but not A", () => {
    const nodeA = makeNode("n1");
    const nodeB = makeNode("n2");
    const graphA = makeGraph([nodeA], []);
    const graphB = makeGraph([nodeA, nodeB], []);

    const diff = computeDiff(graphA, graphB);

    expect(diff.added.has("n2")).toBe(true);
    expect(diff.removed.has("n2")).toBe(false);
    expect(diff.changed.has("n2")).toBe(false);
  });

  it("removes a node present in A but not B", () => {
    const nodeA = makeNode("n1");
    const nodeB = makeNode("n2");
    const graphA = makeGraph([nodeA, nodeB], []);
    const graphB = makeGraph([nodeA], []);

    const diff = computeDiff(graphA, graphB);

    expect(diff.removed.has("n2")).toBe(true);
    expect(diff.added.has("n2")).toBe(false);
    expect(diff.changed.has("n2")).toBe(false);
  });

  it("marks a node unchanged when attributes and incident edges are identical", () => {
    const node = makeNode("n1", [{ predicate: "knows", value: "Alice" }]);
    const link = makeLink("l1", "n1", "n2");
    const n2 = makeNode("n2");
    const graphA = makeGraph([node, n2], [link]);
    const graphB = makeGraph([node, n2], [link]);

    const diff = computeDiff(graphA, graphB);

    expect(diff.added.has("n1")).toBe(false);
    expect(diff.removed.has("n1")).toBe(false);
    expect(diff.changed.has("n1")).toBe(false);
  });

  it("marks a node changed when attributes differ (D-10)", () => {
    const nodeA = makeNode("n1", [{ predicate: "knows", value: "Alice" }]);
    const nodeB = makeNode("n1", [{ predicate: "knows", value: "Bob" }]);
    const graphA = makeGraph([nodeA], []);
    const graphB = makeGraph([nodeB], []);

    const diff = computeDiff(graphA, graphB);

    expect(diff.changed.has("n1")).toBe(true);
    expect(diff.added.has("n1")).toBe(false);
    expect(diff.removed.has("n1")).toBe(false);
  });

  it("marks a node changed when it gains a current edge even with identical attributes (D-10 — edge gain)", () => {
    // n1 has the same attributes in A and B; only difference is B has an extra current edge
    const n1A = makeNode("n1");
    const n2 = makeNode("n2");
    const n1B = makeNode("n1"); // identical attrs
    const newEdge = makeLink("l2", "n1", "n2", "related_to", true);

    const graphA = makeGraph([n1A, n2], []);
    const graphB = makeGraph([n1B, n2], [newEdge]);

    const diff = computeDiff(graphA, graphB);

    expect(diff.changed.has("n1")).toBe(true); // gained an incident current edge
    expect(diff.added.has("n1")).toBe(false);
    expect(diff.removed.has("n1")).toBe(false);
  });
});

// ── computeDiff: edge classification (D-11 independent) ─────────────────────

describe("computeDiff — edge classification (D-11)", () => {
  it("adds an edge only in B between two unchanged nodes", () => {
    const n1 = makeNode("n1");
    const n2 = makeNode("n2");
    const linkB = makeLink("l1", "n1", "n2");

    const graphA = makeGraph([n1, n2], []);
    const graphB = makeGraph([n1, n2], [linkB]);

    const diff = computeDiff(graphA, graphB);

    expect(diff.edges.added.has("l1")).toBe(true);
    expect(diff.edges.removed.has("l1")).toBe(false);
    expect(diff.edges.changed.has("l1")).toBe(false);
  });

  it("removes an edge only in A", () => {
    const n1 = makeNode("n1");
    const n2 = makeNode("n2");
    const linkA = makeLink("l1", "n1", "n2");

    const graphA = makeGraph([n1, n2], [linkA]);
    const graphB = makeGraph([n1, n2], []);

    const diff = computeDiff(graphA, graphB);

    expect(diff.edges.removed.has("l1")).toBe(true);
    expect(diff.edges.added.has("l1")).toBe(false);
  });

  it("marks an edge changed when current flips between A and B (D-11)", () => {
    const n1 = makeNode("n1");
    const n2 = makeNode("n2");
    const linkA = makeLink("l1", "n1", "n2", "knows", true, null);
    const linkB = makeLink("l1", "n1", "n2", "knows", false, "2024-01-01");

    const graphA = makeGraph([n1, n2], [linkA]);
    const graphB = makeGraph([n1, n2], [linkB]);

    const diff = computeDiff(graphA, graphB);

    expect(diff.edges.changed.has("l1")).toBe(true);
    expect(diff.edges.added.has("l1")).toBe(false);
    expect(diff.edges.removed.has("l1")).toBe(false);
  });

  it("marks an edge unchanged when both current and validTo are identical", () => {
    const n1 = makeNode("n1");
    const n2 = makeNode("n2");
    const linkA = makeLink("l1", "n1", "n2", "knows", true, null);
    const linkB = makeLink("l1", "n1", "n2", "knows", true, null);

    const graphA = makeGraph([n1, n2], [linkA]);
    const graphB = makeGraph([n1, n2], [linkB]);

    const diff = computeDiff(graphA, graphB);

    expect(diff.edges.added.has("l1")).toBe(false);
    expect(diff.edges.removed.has("l1")).toBe(false);
    expect(diff.edges.changed.has("l1")).toBe(false);
  });
});

// ── computeDiff: composite key fallback (Pitfall 6) ─────────────────────────

describe("computeDiff — composite key fallback (Pitfall 6)", () => {
  it("classifies edges by composite key when link.id is empty", () => {
    const n1 = makeNode("n1");
    const n2 = makeNode("n2");
    // link with empty id — must fall back to source|target|predicate
    const linkA: KgLink = { ...makeLink("", "n1", "n2", "knows", true, null) };
    const linkB: KgLink = { ...makeLink("", "n1", "n2", "knows", false, "2024-01-01") };

    const graphA = makeGraph([n1, n2], [linkA]);
    const graphB = makeGraph([n1, n2], [linkB]);

    const diff = computeDiff(graphA, graphB);

    // The composite key "n1|n2|knows" appears in both — current flipped → changed
    const compositeKey = "n1|n2|knows";
    expect(diff.edges.changed.has(compositeKey)).toBe(true);
    expect(diff.edges.added.has(compositeKey)).toBe(false);
    expect(diff.edges.removed.has(compositeKey)).toBe(false);
  });

  it("adds an edge via composite key when id is empty and edge only in B", () => {
    const n1 = makeNode("n1");
    const n2 = makeNode("n2");
    const linkB: KgLink = { ...makeLink("", "n1", "n2", "related_to", true, null) };

    const graphA = makeGraph([n1, n2], []);
    const graphB = makeGraph([n1, n2], [linkB]);

    const diff = computeDiff(graphA, graphB);

    const compositeKey = "n1|n2|related_to";
    expect(diff.edges.added.has(compositeKey)).toBe(true);
  });
});

// ── useKgDiff: 404 graceful-degrade (D-08) ──────────────────────────────────

describe("useKgDiff — 404 graceful-degrade (D-08)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("sets error and does not throw when fetchOverview rejects with AstridrApiError 404", async () => {
    // Mock fetchOverview inside useKgDiff module
    vi.doMock("../lib/kgApi", () => ({
      fetchOverview: vi.fn().mockRejectedValue(
        Object.assign(new Error("not found"), { name: "AstridrApiError", status: 404 }),
      ),
    }));

    const { useKgDiff } = await import("./useKgDiff");

    const { result } = renderHook(() => useKgDiff("2024-01-01", "2024-02-01"));

    // compare() must resolve without throwing
    await act(async () => {
      await result.current.compare();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain("snapshot");
    expect(result.current.loading).toBe(false);
    expect(result.current.diff).toBeNull();
  });
});
