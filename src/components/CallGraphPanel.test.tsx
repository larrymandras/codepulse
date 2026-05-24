import { describe, it } from "vitest";

// computeLayout will be exported from CallGraphPanel.tsx in Plan 03
describe("CallGraphPanel", () => {
  describe("computeLayout", () => {
    it.todo("returns correct node count from edges (1 agent + 1 tool = 2 nodes)");
    it.todo("returns 0 nodes for empty edges array");
    it.todo("marks agent node as errored when any edge has status errored");
    it.todo("marks tool node as errored when its edge has status errored");
    it.todo("deduplicates agent nodes across multiple edges");
    it.todo("deduplicates tool nodes across multiple edges");
    it.todo("all nodes have x, y, width, height after layout");
  });

  describe("rendering", () => {
    it.todo("renders empty state when no edges");
    it.todo("renders SVG element when edges are provided");
    it.todo("renders legend with Healthy, Errored, Pending labels");
  });
});
