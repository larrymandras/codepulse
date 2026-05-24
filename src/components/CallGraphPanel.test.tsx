import { describe, it, expect } from "vitest";
import { computeLayout, type GraphEdge } from "./CallGraphSVG";

describe("CallGraphPanel", () => {
  describe("computeLayout", () => {
    it("returns correct node count from edges (1 agent + 1 tool = 2 nodes)", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-1", status: "healthy", callCount: 5, errorCount: 0 },
      ];
      const result = computeLayout(edges);
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
    });

    it("returns 0 nodes for empty edges array", () => {
      const result = computeLayout([]);
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it("marks agent node as errored when any edge has status errored", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-1", status: "healthy", callCount: 3, errorCount: 0 },
        { agentId: "agent-1", toolName: "tool-2", status: "errored", callCount: 2, errorCount: 1 },
      ];
      const result = computeLayout(edges);
      const agentNode = result.nodes.find((n) => n.id === "agent:agent-1");
      expect(agentNode?.status).toBe("errored");
    });

    it("marks tool node as errored when its edge has status errored", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-bad", status: "errored", callCount: 1, errorCount: 1 },
      ];
      const result = computeLayout(edges);
      const toolNode = result.nodes.find((n) => n.id === "tool:tool-bad");
      expect(toolNode?.status).toBe("errored");
    });

    it("deduplicates agent nodes across multiple edges", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-1", status: "healthy", callCount: 1, errorCount: 0 },
        { agentId: "agent-1", toolName: "tool-2", status: "healthy", callCount: 1, errorCount: 0 },
      ];
      const result = computeLayout(edges);
      const agentNodes = result.nodes.filter((n) => n.type === "agent");
      expect(agentNodes).toHaveLength(1);
    });

    it("deduplicates tool nodes across multiple edges", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-1", status: "healthy", callCount: 1, errorCount: 0 },
        { agentId: "agent-2", toolName: "tool-1", status: "healthy", callCount: 1, errorCount: 0 },
      ];
      const result = computeLayout(edges);
      const toolNodes = result.nodes.filter((n) => n.type === "tool");
      expect(toolNodes).toHaveLength(1);
    });

    it("all nodes have x, y, width, height after layout", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-1", status: "healthy", callCount: 1, errorCount: 0 },
      ];
      const result = computeLayout(edges);
      for (const node of result.nodes) {
        expect(typeof node.x).toBe("number");
        expect(typeof node.y).toBe("number");
        expect(node.width).toBeGreaterThan(0);
        expect(node.height).toBeGreaterThan(0);
      }
    });

    it("agent nodes have larger dimensions than tool nodes", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-1", status: "healthy", callCount: 1, errorCount: 0 },
      ];
      const result = computeLayout(edges);
      const agent = result.nodes.find((n) => n.type === "agent")!;
      const tool = result.nodes.find((n) => n.type === "tool")!;
      expect(agent.width).toBeGreaterThan(tool.width);
      expect(agent.height).toBeGreaterThan(tool.height);
    });

    it("marks shared tool as errored when any agent-tool edge is errored", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-shared", status: "healthy", callCount: 1, errorCount: 0 },
        { agentId: "agent-2", toolName: "tool-shared", status: "errored", callCount: 1, errorCount: 1 },
      ];
      const result = computeLayout(edges);
      const toolNode = result.nodes.find((n) => n.id === "tool:tool-shared");
      expect(toolNode?.status).toBe("errored");
    });

    it("errored edge is marked in layout edges", () => {
      const edges: GraphEdge[] = [
        { agentId: "agent-1", toolName: "tool-1", status: "errored", callCount: 1, errorCount: 1 },
      ];
      const result = computeLayout(edges);
      expect(result.edges[0].errored).toBe(true);
    });
  });
});
