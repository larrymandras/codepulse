import { describe, it, expect } from "vitest";
import {
  buildMcpHealth,
  type McpHealthInput,
  type McpServer,
  type DiscoveredTool,
  type CallGraphEdge,
  type ToolGovernanceRow,
} from "./mcp-health";

// ---- fixtures -------------------------------------------------------------

const server = (name: string, extra: Partial<McpServer> = {}): McpServer => ({
  _id: `srv-${name}`,
  name,
  status: "connected",
  lastSeenAt: 1000,
  ...extra,
});

const tool = (
  name: string,
  serverName: string,
  extra: Partial<DiscoveredTool> = {},
): DiscoveredTool => ({
  _id: `tool-${name}`,
  name,
  source: "mcp",
  serverName,
  usageCount: 0,
  discoveredAt: 1000,
  ...extra,
});

const edge = (
  toolName: string,
  extra: Partial<CallGraphEdge> = {},
): CallGraphEdge => ({
  _id: `edge-${toolName}-${Math.random()}`,
  agentId: "skuld",
  toolName,
  sessionId: "s1",
  callCount: 1,
  lastCallAt: 1000,
  errorCount: 0,
  status: "healthy",
  ...extra,
});

const gov = (
  toolName: string,
  disabled: boolean,
  extra: Partial<ToolGovernanceRow> = {},
): ToolGovernanceRow => ({
  _id: `gov-${toolName}`,
  toolName,
  disabled,
  updatedAt: 1000,
  ...extra,
});

const input = (over: Partial<McpHealthInput> = {}): McpHealthInput => ({
  mcpServers: [],
  tools: [],
  edges: [],
  ...over,
});

// ---- tests ----------------------------------------------------------------

describe("buildMcpHealth", () => {
  describe("grouping (MCP-01)", () => {
    it("groups tools under their MCP server by serverName", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github"), server("supabase")],
          tools: [
            tool("get_me", "github"),
            tool("list_issues", "github"),
            tool("execute_sql", "supabase"),
          ],
        }),
      );
      const gh = servers.find((s) => s.name === "github")!;
      const sb = servers.find((s) => s.name === "supabase")!;
      expect(gh.tools.map((t) => t.name).sort()).toEqual([
        "get_me",
        "list_issues",
      ]);
      expect(sb.tools.map((t) => t.name)).toEqual(["execute_sql"]);
    });

    it("excludes non-MCP tools (builtin without a matching server)", () => {
      const { servers, stats } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [
            tool("get_me", "github"),
            { ...tool("Read", ""), source: "builtin", serverName: undefined },
          ],
        }),
      );
      const gh = servers.find((s) => s.name === "github")!;
      expect(gh.tools.map((t) => t.name)).toEqual(["get_me"]);
      expect(stats.mcpToolCount).toBe(1);
    });

    it("de-duplicates a tool that appears twice for the same server", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github"), tool("get_me", "github")],
        }),
      );
      expect(servers[0].tools).toHaveLength(1);
    });
  });

  describe("per-tool health (MCP-02)", () => {
    it("computes error rate = errorCount / callCount", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github")],
          edges: [
            edge("get_me", { callCount: 8, errorCount: 2, status: "errored" }),
            edge("get_me", { callCount: 2, errorCount: 0 }),
          ],
        }),
      );
      const t = servers[0].tools[0];
      expect(t.callCount).toBe(10);
      expect(t.errorCount).toBe(2);
      expect(t.errorRate).toBeCloseTo(0.2, 5);
      expect(t.status).toBe("error");
    });

    it("marks a tool with calls and no errors as connected", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github")],
          edges: [edge("get_me", { callCount: 5, errorCount: 0 })],
        }),
      );
      expect(servers[0].tools[0].status).toBe("connected");
      expect(servers[0].tools[0].errorRate).toBe(0);
    });

    it("marks an installed-but-never-called tool as unused with rate 0", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github")],
          edges: [],
        }),
      );
      const t = servers[0].tools[0];
      expect(t.unused).toBe(true);
      expect(t.status).toBe("unused");
      expect(t.errorRate).toBe(0);
      expect(t.callCount).toBe(0);
      expect(t.lastCallAt).toBeUndefined();
    });

    it("aggregates lastCallAt to the most recent across edges", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github")],
          edges: [
            edge("get_me", { lastCallAt: 1000 }),
            edge("get_me", { lastCallAt: 5000 }),
            edge("get_me", { lastCallAt: 3000 }),
          ],
        }),
      );
      expect(servers[0].tools[0].lastCallAt).toBe(5000);
    });

    it("surfaces lastErrorAt only when an error has occurred", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github"), tool("ok", "github")],
          edges: [
            edge("get_me", {
              callCount: 3,
              errorCount: 1,
              lastErrorAt: 4242,
              status: "errored",
            }),
            edge("ok", { callCount: 1, errorCount: 0 }),
          ],
        }),
      );
      const gm = servers[0].tools.find((t) => t.name === "get_me")!;
      const ok = servers[0].tools.find((t) => t.name === "ok")!;
      expect(gm.lastErrorAt).toBe(4242);
      expect(ok.lastErrorAt).toBeUndefined();
    });
  });

  describe("server status pill (MCP-01)", () => {
    it("flags a server whose own status is error/disconnected", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("flaky", { status: "error" })],
          tools: [tool("x", "flaky")],
          edges: [edge("x", { callCount: 1 })],
        }),
      );
      expect(servers[0].status).toBe("error");
    });

    it("marks a connected server whose tools have zero calls as unused", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("idle", { status: "connected" })],
          tools: [tool("a", "idle"), tool("b", "idle")],
          edges: [],
        }),
      );
      expect(servers[0].status).toBe("unused");
    });

    it("keeps a connected server with at least one used tool connected", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("live", { status: "connected" })],
          tools: [tool("a", "live"), tool("b", "live")],
          edges: [edge("a", { callCount: 3 })],
        }),
      );
      expect(servers[0].status).toBe("connected");
    });

    it("treats a configured server with usage as connected, without usage as unused", () => {
      const used = buildMcpHealth(
        input({
          mcpServers: [server("cfg", { status: "configured" })],
          tools: [tool("a", "cfg")],
          edges: [edge("a", { callCount: 1 })],
        }),
      );
      const idle = buildMcpHealth(
        input({
          mcpServers: [server("cfg", { status: "configured" })],
          tools: [tool("a", "cfg")],
          edges: [],
        }),
      );
      expect(used.servers[0].status).toBe("connected");
      expect(idle.servers[0].status).toBe("unused");
    });
  });

  describe("governance (MCP-03)", () => {
    it("merges the disabled flag onto the matching tool", () => {
      const { servers, stats } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github"), tool("danger", "github")],
          edges: [edge("get_me", { callCount: 1 })],
          governance: [gov("danger", true)],
        }),
      );
      const danger = servers[0].tools.find((t) => t.name === "danger")!;
      const getMe = servers[0].tools.find((t) => t.name === "get_me")!;
      expect(danger.disabled).toBe(true);
      expect(getMe.disabled).toBe(false);
      expect(stats.disabledTools).toBe(1);
      expect(servers[0].disabledCount).toBe(1);
    });

    it("treats an explicit disabled:false governance row as enabled", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [tool("get_me", "github")],
          governance: [gov("get_me", false)],
        }),
      );
      expect(servers[0].tools[0].disabled).toBe(false);
    });
  });

  describe("ordering & aggregates", () => {
    it("orders servers error → unused → connected", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [
            server("zlive", { status: "connected" }),
            server("aerror", { status: "error" }),
            server("midle", { status: "connected" }),
          ],
          tools: [
            tool("t1", "zlive"),
            tool("t2", "aerror"),
            tool("t3", "midle"),
          ],
          edges: [edge("t1", { callCount: 1 }), edge("t2", { callCount: 1 })],
        }),
      );
      expect(servers.map((s) => s.name)).toEqual(["aerror", "midle", "zlive"]);
    });

    it("orders tools within a server error → unused → connected, then by calls", () => {
      const { servers } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [
            tool("connected_hi", "github"),
            tool("connected_lo", "github"),
            tool("unused", "github"),
            tool("errored", "github"),
          ],
          edges: [
            edge("connected_hi", { callCount: 50 }),
            edge("connected_lo", { callCount: 2 }),
            edge("errored", { callCount: 4, errorCount: 1, status: "errored" }),
          ],
        }),
      );
      expect(servers[0].tools.map((t) => t.name)).toEqual([
        "errored",
        "unused",
        "connected_hi",
        "connected_lo",
      ]);
    });

    it("computes per-server and global aggregate counts", () => {
      const { servers, stats } = buildMcpHealth(
        input({
          mcpServers: [server("github")],
          tools: [
            tool("a", "github"),
            tool("b", "github"),
            tool("c", "github"),
          ],
          edges: [
            edge("a", { callCount: 10, errorCount: 0 }),
            edge("b", { callCount: 4, errorCount: 2, status: "errored" }),
          ],
          governance: [gov("c", true)],
        }),
      );
      const g = servers[0];
      expect(g.toolCount).toBe(3);
      expect(g.connectedCount).toBe(1);
      expect(g.errorCount).toBe(1);
      expect(g.unusedCount).toBe(1);
      expect(g.disabledCount).toBe(1);
      expect(g.totalCalls).toBe(14);

      expect(stats.serverCount).toBe(1);
      expect(stats.mcpToolCount).toBe(3);
      expect(stats.erroredTools).toBe(1);
      expect(stats.unusedTools).toBe(1);
      expect(stats.disabledTools).toBe(1);
    });
  });

  describe("empty / edge cases", () => {
    it("returns empty model for empty input", () => {
      const { servers, stats } = buildMcpHealth(input());
      expect(servers).toEqual([]);
      expect(stats.serverCount).toBe(0);
      expect(stats.mcpToolCount).toBe(0);
    });

    it("keeps a server with no tools and connected status as connected", () => {
      const { servers } = buildMcpHealth(
        input({ mcpServers: [server("empty", { status: "connected" })] }),
      );
      expect(servers[0].status).toBe("connected");
      expect(servers[0].toolCount).toBe(0);
    });
  });
});
