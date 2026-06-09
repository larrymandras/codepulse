import { describe, it, expect } from "vitest";
import {
  classifySource,
  sourceLabel,
  normalizeNode,
  normalizeLink,
  mapGraphSnapshot,
  filterBySource,
  summarizeSources,
  type SnapshotNode,
  type SourceKind,
} from "./graph-snapshot";

describe("graph-snapshot pure transforms", () => {
  describe("classifySource", () => {
    it("classifies graphify, vault, and other namespaces", () => {
      expect(classifySource("graphify:codepulse:")).toBe("graphify");
      expect(classifySource("GRAPHIFY:Astridr:")).toBe("graphify");
      expect(classifySource("vault:")).toBe("vault");
      expect(classifySource("vault:02-projects")).toBe("vault");
      expect(classifySource("something-else")).toBe("other");
      expect(classifySource("")).toBe("other");
      expect(classifySource(undefined)).toBe("other");
      expect(classifySource(null)).toBe("other");
    });
  });

  describe("sourceLabel", () => {
    it("extracts the repo/vault label from a source namespace", () => {
      expect(sourceLabel("graphify:codepulse:")).toBe("codepulse");
      expect(sourceLabel("graphify:astridr:")).toBe("astridr");
      expect(sourceLabel("vault:")).toBe("vault");
      expect(sourceLabel("")).toBe("unknown");
      expect(sourceLabel(undefined)).toBe("unknown");
    });
  });

  describe("normalizeNode", () => {
    it("normalizes a well-formed node, defaulting label/type", () => {
      expect(
        normalizeNode({ id: "a", label: "Node A", type: "module", source: "vault:" }),
      ).toEqual({ id: "a", label: "Node A", type: "module", community: undefined, source: "vault:" });
    });

    it("falls back label→id and type→'node' when missing", () => {
      expect(normalizeNode({ id: "x", source: "vault:" })).toEqual({
        id: "x",
        label: "x",
        type: "node",
        community: undefined,
        source: "vault:",
      });
    });

    it("accepts snake_case fallbacks (node_id, node_type, name, namespace)", () => {
      expect(
        normalizeNode({ node_id: "y", name: "Why", node_type: "func", namespace: "graphify:cp:" }),
      ).toEqual({ id: "y", label: "Why", type: "func", community: undefined, source: "graphify:cp:" });
    });

    it("carries a numeric community through", () => {
      expect(normalizeNode({ id: "a", source: "vault:", community: 3 })?.community).toBe(3);
    });

    it("returns null for an un-keyable node (no id)", () => {
      expect(normalizeNode({ label: "no id", source: "vault:" })).toBeNull();
      expect(normalizeNode(null)).toBeNull();
      expect(normalizeNode("nope")).toBeNull();
    });
  });

  describe("normalizeLink", () => {
    it("normalizes a link and accepts from/to + rel fallbacks", () => {
      expect(normalizeLink({ source: "a", target: "b", relation: "imports" })).toEqual({
        source: "a",
        target: "b",
        relation: "imports",
      });
      expect(normalizeLink({ from: "a", to: "b", rel: "links_to" })).toEqual({
        source: "a",
        target: "b",
        relation: "links_to",
      });
    });

    it("defaults relation to 'links' when absent", () => {
      expect(normalizeLink({ source: "a", target: "b" })?.relation).toBe("links");
    });

    it("returns null when either endpoint is missing", () => {
      expect(normalizeLink({ source: "a" })).toBeNull();
      expect(normalizeLink({ target: "b" })).toBeNull();
      expect(normalizeLink(null)).toBeNull();
    });
  });

  describe("mapGraphSnapshot — ingest mapping (idempotent replace, namespacing)", () => {
    it("maps a well-formed event, preserving source namespacing", () => {
      const result = mapGraphSnapshot(
        {
          snapshotId: "astridr-project-graph",
          nodes: [
            { id: "a", label: "A", type: "module", source: "graphify:astridr:" },
            { id: "b", label: "B", type: "note", source: "vault:" },
          ],
          links: [{ source: "a", target: "b", relation: "references" }],
          timestamp: 1700,
        },
        9999,
      );
      expect(result).not.toBeNull();
      expect(result!.snapshotId).toBe("astridr-project-graph");
      expect(result!.nodes).toHaveLength(2);
      expect(result!.nodes[0].source).toBe("graphify:astridr:");
      expect(result!.nodes[1].source).toBe("vault:");
      expect(result!.links).toEqual([{ source: "a", target: "b", relation: "references" }]);
      expect(result!.snapshotTimestamp).toBe(1700);
    });

    it("accepts snake_case snapshot_id and edges[] as a links fallback", () => {
      const result = mapGraphSnapshot(
        {
          snapshot_id: "vault-graph",
          nodes: [
            { id: "n1", source: "vault:" },
            { id: "n2", source: "vault:" },
          ],
          edges: [{ from: "n1", to: "n2", rel: "wikilink" }],
        },
        42,
      );
      expect(result!.snapshotId).toBe("vault-graph");
      expect(result!.links).toEqual([{ source: "n1", target: "n2", relation: "wikilink" }]);
      expect(result!.snapshotTimestamp).toBe(42); // fell back to now
    });

    it("drops dangling links whose endpoints aren't in the node set", () => {
      const result = mapGraphSnapshot(
        {
          snapshotId: "g",
          nodes: [{ id: "a", source: "vault:" }],
          links: [
            { source: "a", target: "ghost", relation: "x" },
            { source: "a", target: "a", relation: "self" },
          ],
        },
        0,
      );
      expect(result!.links).toEqual([{ source: "a", target: "a", relation: "self" }]);
    });

    it("drops malformed nodes but keeps the rest", () => {
      const result = mapGraphSnapshot(
        {
          snapshotId: "g",
          nodes: [{ id: "a", source: "vault:" }, { label: "no id" }, null, "junk"],
          links: [],
        },
        0,
      );
      expect(result!.nodes).toHaveLength(1);
      expect(result!.nodes[0].id).toBe("a");
    });

    it("returns null when there is no usable snapshotId (cannot upsert)", () => {
      expect(mapGraphSnapshot({ nodes: [], links: [] }, 0)).toBeNull();
      expect(mapGraphSnapshot(null, 0)).toBeNull();
      expect(mapGraphSnapshot("nope", 0)).toBeNull();
    });

    it("tolerates a missing nodes/links arrays", () => {
      const result = mapGraphSnapshot({ snapshotId: "g" }, 5);
      expect(result).toEqual({ snapshotId: "g", nodes: [], links: [], snapshotTimestamp: 5 });
    });
  });

  describe("filterBySource", () => {
    const nodes: SnapshotNode[] = [
      { id: "a", label: "A", type: "m", source: "graphify:cp:" },
      { id: "b", label: "B", type: "n", source: "vault:" },
      { id: "c", label: "C", type: "n", source: "vault:" },
    ];
    const links = [
      { source: "a", target: "b", relation: "x" }, // cross-source
      { source: "b", target: "c", relation: "y" }, // vault-internal
    ];

    it("keeps only enabled-source nodes and prunes dependent links", () => {
      const vaultOnly = filterBySource({ nodes, links }, new Set<SourceKind>(["vault"]));
      expect(vaultOnly.nodes.map((n) => n.id)).toEqual(["b", "c"]);
      // a→b is dropped (a removed); b→c survives.
      expect(vaultOnly.links).toEqual([{ source: "b", target: "c", relation: "y" }]);
    });

    it("returns everything when all families enabled", () => {
      const all = filterBySource({ nodes, links }, new Set<SourceKind>(["graphify", "vault", "other"]));
      expect(all.nodes).toHaveLength(3);
      expect(all.links).toHaveLength(2);
    });

    it("returns empty when nothing enabled", () => {
      const none = filterBySource({ nodes, links }, new Set<SourceKind>());
      expect(none.nodes).toHaveLength(0);
      expect(none.links).toHaveLength(0);
    });
  });

  describe("summarizeSources", () => {
    it("counts per family and lists distinct sorted repos", () => {
      const summary = summarizeSources([
        { id: "a", label: "A", type: "m", source: "graphify:zeta:" },
        { id: "b", label: "B", type: "m", source: "graphify:alpha:" },
        { id: "c", label: "C", type: "n", source: "vault:" },
        { id: "d", label: "D", type: "n", source: "weird" },
      ]);
      expect(summary).toEqual({
        graphify: 2,
        vault: 1,
        other: 1,
        repos: ["alpha", "zeta"],
      });
    });
  });
});
