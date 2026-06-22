import { describe, it, expect } from "vitest";
import { legacyEventData } from "./ingestSummary";

describe("legacyEventData", () => {
  it("strips nodes/links from a graph_snapshot, keeping compact metadata", () => {
    const data = {
      snapshotId: "astridr-project-graph",
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      links: [{ source: "a", target: "b" }],
      sources: [{ source: "vault", kind: "vault" }],
      nodeCount: 3,
      linkCount: 1,
      generatedAt: 123,
    };
    const out = legacyEventData("graph_snapshot", data) as Record<string, unknown>;
    expect(out.nodes).toBeUndefined();
    expect(out.links).toBeUndefined();
    expect(out.snapshotId).toBe("astridr-project-graph");
    expect(out.sources).toEqual([{ source: "vault", kind: "vault" }]);
    expect(out.nodeCount).toBe(3);
    expect(out.linkCount).toBe(1);
    expect(out.generatedAt).toBe(123);
    expect(out.summarized).toBe(true);
  });

  it("derives counts from array length when not provided", () => {
    const out = legacyEventData("graph_snapshot", {
      nodes: [{ id: "a" }, { id: "b" }],
      links: [{ source: "a", target: "b" }, { source: "b", target: "a" }],
    }) as Record<string, unknown>;
    expect(out.nodeCount).toBe(2);
    expect(out.linkCount).toBe(2);
  });

  it("keeps the summarized payload tiny even for a large graph", () => {
    const big = {
      snapshotId: "x",
      nodes: Array.from({ length: 5000 }, (_, i) => ({ id: `n${i}`, label: `node ${i}` })),
      links: Array.from({ length: 8000 }, (_, i) => ({ source: `n${i}`, target: `n0` })),
      sources: [{ source: "astridr-repo", kind: "graphify" }],
      nodeCount: 5000,
      linkCount: 8000,
    };
    const out = legacyEventData("graph_snapshot", big);
    const bytes = JSON.stringify(out).length;
    expect(bytes).toBeLessThan(2000); // was ~1+ MiB before stripping
  });

  it("passes non-graph_snapshot events through unchanged", () => {
    const data = { provider: "anthropic", model: "claude", promptTokens: 10 };
    expect(legacyEventData("llm_call", data)).toBe(data);
  });

  it("passes through null / non-object data safely", () => {
    expect(legacyEventData("graph_snapshot", null)).toBeNull();
    expect(legacyEventData("graph_snapshot", "oops")).toBe("oops");
  });
});
