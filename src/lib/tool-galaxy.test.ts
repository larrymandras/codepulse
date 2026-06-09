import { describe, it, expect } from "vitest";
import {
  buildGalaxy,
  deriveAgents,
  deriveMcpServers,
  type ToolGalaxyInput,
  type DiscoveredTool,
  type McpServer,
  type CallGraphEdge,
  type Kit,
} from "./tool-galaxy";

// ---- fixtures -------------------------------------------------------------

const tool = (
  name: string,
  extra: Partial<DiscoveredTool> = {},
): DiscoveredTool => ({
  _id: `tool-${name}`,
  name,
  source: "mcp",
  usageCount: 0,
  discoveredAt: 1000,
  ...extra,
});

const server = (name: string, extra: Partial<McpServer> = {}): McpServer => ({
  _id: `srv-${name}`,
  name,
  status: "connected",
  lastSeenAt: 1000,
  ...extra,
});

const edge = (
  agentId: string,
  toolName: string,
  extra: Partial<CallGraphEdge> = {},
): CallGraphEdge => ({
  _id: `edge-${agentId}-${toolName}`,
  agentId,
  toolName,
  sessionId: "s1",
  callCount: 1,
  lastCallAt: 1000,
  errorCount: 0,
  status: "healthy",
  ...extra,
});

const kit = (name: string, tools: string[], extra: Partial<Kit> = {}): Kit => ({
  _id: `kit-${name}`,
  name,
  tools,
  updatedAt: 1000,
  ...extra,
});

const input = (over: Partial<ToolGalaxyInput> = {}): ToolGalaxyInput => ({
  tools: [],
  mcpServers: [],
  edges: [],
  now: 2000,
  ...over,
});

// ---- node / edge assembly -------------------------------------------------

describe("buildGalaxy — node assembly", () => {
  it("creates a node for each tool, mcp server, and agent", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("create_issue", { serverName: "github" })],
        mcpServers: [server("github")],
        edges: [edge("skuld", "create_issue")],
      }),
    );
    const kinds = g.nodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.kind] = (acc[n.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(kinds.tool).toBe(1);
    expect(kinds.mcpServer).toBe(1);
    expect(kinds.agent).toBe(1);
  });

  it("does not duplicate an agent that calls many tools", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read"), tool("Write")],
        edges: [edge("skuld", "Read"), edge("skuld", "Write")],
      }),
    );
    expect(g.nodes.filter((n) => n.kind === "agent")).toHaveLength(1);
  });

  it("creates a tool node for an edge whose tool is not in discoveredTools", () => {
    const g = buildGalaxy(input({ edges: [edge("skuld", "PhantomTool")] }));
    const phantom = g.nodes.find((n) => n.id === "tool:PhantomTool");
    expect(phantom).toBeDefined();
    expect(phantom?.kind).toBe("tool");
  });

  it("links an agent to each tool it calls", () => {
    const g = buildGalaxy(
      input({ tools: [tool("Read")], edges: [edge("skuld", "Read")] }),
    );
    const link = g.links.find(
      (l) => l.source === "agent:skuld" && l.target === "tool:Read",
    );
    expect(link).toBeDefined();
  });

  it("links a tool to its MCP server when serverName matches", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("create_issue", { serverName: "github" })],
        mcpServers: [server("github")],
      }),
    );
    const link = g.links.find(
      (l) => l.source === "mcp:github" && l.target === "tool:create_issue",
    );
    expect(link).toBeDefined();
  });

  it("does not create a server-tool link when serverName has no matching server", () => {
    const g = buildGalaxy(
      input({ tools: [tool("x", { serverName: "ghost-server" })] }),
    );
    expect(g.links.some((l) => l.source.startsWith("mcp:"))).toBe(false);
  });
});

// ---- usage / recency scaling (GAL-02) -------------------------------------

describe("buildGalaxy — usage + recency (GAL-02)", () => {
  it("aggregates callCount across edges into the tool's usage", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read")],
        edges: [
          edge("a", "Read", { callCount: 3 }),
          edge("b", "Read", { callCount: 7 }),
        ],
      }),
    );
    const read = g.nodes.find((n) => n.id === "tool:Read")!;
    expect(read.callCount).toBe(10);
  });

  it("scales node size monotonically with usage", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("low"), tool("high")],
        edges: [
          edge("a", "low", { callCount: 1 }),
          edge("a", "high", { callCount: 100 }),
        ],
      }),
    );
    const low = g.nodes.find((n) => n.id === "tool:low")!;
    const high = g.nodes.find((n) => n.id === "tool:high")!;
    expect(high.val).toBeGreaterThan(low.val);
  });

  it("gives a never-used tool the minimum size", () => {
    const g = buildGalaxy(input({ tools: [tool("idle")] }));
    const idle = g.nodes.find((n) => n.id === "tool:idle")!;
    expect(idle.val).toBeGreaterThan(0);
    expect(idle.callCount).toBe(0);
  });

  it("recency is 1 for a just-used tool and decays toward 0 for an old one", () => {
    const g = buildGalaxy(
      input({
        now: 1_000_000,
        tools: [tool("fresh"), tool("stale")],
        edges: [
          edge("a", "fresh", { lastCallAt: 1_000_000 }),
          edge("a", "stale", { lastCallAt: 1 }),
        ],
      }),
    );
    const fresh = g.nodes.find((n) => n.id === "tool:fresh")!;
    const stale = g.nodes.find((n) => n.id === "tool:stale")!;
    expect(fresh.recency).toBeGreaterThan(stale.recency);
    expect(fresh.recency).toBeLessThanOrEqual(1);
    expect(stale.recency).toBeGreaterThanOrEqual(0);
  });

  it("uses the most recent edge for a tool's lastCallAt", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read")],
        edges: [
          edge("a", "Read", { lastCallAt: 500 }),
          edge("b", "Read", { lastCallAt: 900 }),
        ],
      }),
    );
    expect(g.nodes.find((n) => n.id === "tool:Read")!.lastCallAt).toBe(900);
  });

  it("marks a tool errored when any of its edges errored", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read")],
        edges: [
          edge("a", "Read", { status: "healthy", errorCount: 0 }),
          edge("b", "Read", { status: "errored", errorCount: 2 }),
        ],
      }),
    );
    const read = g.nodes.find((n) => n.id === "tool:Read")!;
    expect(read.errorCount).toBe(2);
    expect(read.status).toBe("errored");
  });
});

// ---- orphan detection (GAL-03) --------------------------------------------

describe("buildGalaxy — orphan detection (GAL-03)", () => {
  it("flags an installed tool with no edges as an orphan", () => {
    const g = buildGalaxy(input({ tools: [tool("Unused")] }));
    expect(g.nodes.find((n) => n.id === "tool:Unused")!.orphan).toBe(true);
  });

  it("does not flag a tool that has at least one edge", () => {
    const g = buildGalaxy(
      input({ tools: [tool("Read")], edges: [edge("a", "Read")] }),
    );
    expect(g.nodes.find((n) => n.id === "tool:Read")!.orphan).toBe(false);
  });

  it("never flags agent or mcpServer nodes as orphans", () => {
    const g = buildGalaxy(
      input({ mcpServers: [server("github")], edges: [edge("a", "Read")] }),
    );
    const nonTools = g.nodes.filter((n) => n.kind !== "tool");
    expect(nonTools.every((n) => n.orphan === false)).toBe(true);
  });

  it("reports the orphan count in stats", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("a"), tool("b"), tool("c")],
        edges: [edge("x", "a")],
      }),
    );
    expect(g.stats.orphanCount).toBe(2);
  });
});

// ---- filtering (GAL-04) ---------------------------------------------------

describe("buildGalaxy — filters (GAL-04)", () => {
  const base = input({
    tools: [
      tool("Read"),
      tool("create_issue", { serverName: "github" }),
      tool("query", { serverName: "supabase" }),
    ],
    mcpServers: [server("github"), server("supabase")],
    edges: [
      edge("skuld", "Read"),
      edge("skuld", "create_issue"),
      edge("hildr", "query"),
    ],
  });

  it("filtering by agent keeps only that agent and the tools it calls", () => {
    const g = buildGalaxy({ ...base, agentFilter: "hildr" });
    expect(g.nodes.some((n) => n.id === "agent:skuld")).toBe(false);
    expect(g.nodes.some((n) => n.id === "agent:hildr")).toBe(true);
    expect(g.nodes.some((n) => n.id === "tool:query")).toBe(true);
    // Read/create_issue belonged only to skuld
    expect(g.nodes.some((n) => n.id === "tool:Read")).toBe(false);
  });

  it("filtering by mcp server keeps only that server and its tools", () => {
    const g = buildGalaxy({ ...base, mcpFilter: "github" });
    expect(g.nodes.some((n) => n.id === "mcp:github")).toBe(true);
    expect(g.nodes.some((n) => n.id === "mcp:supabase")).toBe(false);
    expect(g.nodes.some((n) => n.id === "tool:create_issue")).toBe(true);
    expect(g.nodes.some((n) => n.id === "tool:query")).toBe(false);
    // builtin Read has no server → excluded under an mcp filter
    expect(g.nodes.some((n) => n.id === "tool:Read")).toBe(false);
  });

  it("agent + mcp filters compose (intersection of tools)", () => {
    const g = buildGalaxy({ ...base, agentFilter: "skuld", mcpFilter: "github" });
    expect(g.nodes.some((n) => n.id === "tool:create_issue")).toBe(true);
    expect(g.nodes.some((n) => n.id === "tool:Read")).toBe(false);
    expect(g.nodes.some((n) => n.id === "tool:query")).toBe(false);
  });

  it("never emits a link that references a dropped node", () => {
    const g = buildGalaxy({ ...base, agentFilter: "hildr" });
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const l of g.links) {
      expect(ids.has(l.source)).toBe(true);
      expect(ids.has(l.target)).toBe(true);
    }
  });

  it("no filter returns the full graph", () => {
    const g = buildGalaxy(base);
    expect(g.nodes.filter((n) => n.kind === "agent")).toHaveLength(2);
    expect(g.nodes.filter((n) => n.kind === "tool")).toHaveLength(3);
  });
});

// ---- filter option derivation ---------------------------------------------

describe("deriveAgents / deriveMcpServers", () => {
  it("deriveAgents returns sorted unique agent ids from edges", () => {
    const agents = deriveAgents([
      edge("hildr", "a"),
      edge("skuld", "b"),
      edge("hildr", "c"),
    ]);
    expect(agents).toEqual(["hildr", "skuld"]);
  });

  it("deriveAgents ignores blank/unknown agent ids", () => {
    const agents = deriveAgents([
      edge("", "a"),
      edge("unknown", "b"),
      edge("skuld", "c"),
    ]);
    expect(agents).toEqual(["skuld"]);
  });

  it("deriveMcpServers returns sorted server names", () => {
    expect(
      deriveMcpServers([server("supabase"), server("github")]).map((s) => s.name),
    ).toEqual(["github", "supabase"]);
  });
});

// ---- kit nodes (Phase 72 GAP B) -------------------------------------------

describe("buildGalaxy — kit nodes", () => {
  it("creates a kit node and kit->tool membership links", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read"), tool("Write")],
        kits: [kit("io", ["Read", "Write"])],
      }),
    );
    const kitNode = g.nodes.find((n) => n.id === "kit:io");
    expect(kitNode).toBeDefined();
    expect(kitNode?.kind).toBe("kit");
    const memberLinks = g.links.filter(
      (l) => l.kind === "kit-tool" && l.source === "kit:io",
    );
    expect(memberLinks.map((l) => l.target).sort()).toEqual([
      "tool:Read",
      "tool:Write",
    ]);
  });

  it("carries the kit description onto the kit node", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read")],
        kits: [kit("io", ["Read"], { description: "file io" })],
      }),
    );
    expect(g.nodes.find((n) => n.id === "kit:io")?.description).toBe("file io");
  });

  it("counts kits in stats", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read"), tool("query")],
        kits: [kit("io", ["Read"]), kit("db", ["query"])],
      }),
    );
    expect(g.stats.kitCount).toBe(2);
  });

  it("creates a tool node for a kit member not present in discoveredTools", () => {
    const g = buildGalaxy(input({ kits: [kit("io", ["PhantomKitTool"])] }));
    const phantom = g.nodes.find((n) => n.id === "tool:PhantomKitTool");
    expect(phantom).toBeDefined();
    expect(phantom?.kind).toBe("tool");
    expect(phantom?.orphan).toBe(true); // kit membership is not usage
  });

  it("never flags a kit node as an orphan", () => {
    const g = buildGalaxy(
      input({ tools: [tool("Read")], kits: [kit("io", ["Read"])] }),
    );
    expect(g.nodes.find((n) => n.kind === "kit")?.orphan).toBe(false);
  });

  it("dedupes repeated tool membership within a kit", () => {
    const g = buildGalaxy(
      input({ tools: [tool("Read")], kits: [kit("io", ["Read", "Read"])] }),
    );
    expect(
      g.links.filter((l) => l.kind === "kit-tool" && l.target === "tool:Read"),
    ).toHaveLength(1);
  });

  it("drops a kit node when none of its tools survive a filter", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read"), tool("query", { serverName: "supabase" })],
        mcpServers: [server("supabase")],
        edges: [edge("skuld", "Read"), edge("hildr", "query")],
        kits: [kit("io", ["Read"])], // Read belongs only to skuld
        agentFilter: "hildr",
      }),
    );
    expect(g.nodes.some((n) => n.id === "kit:io")).toBe(false);
    // and no dangling kit-tool link references a dropped node
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const l of g.links) {
      expect(ids.has(l.source)).toBe(true);
      expect(ids.has(l.target)).toBe(true);
    }
  });

  it("keeps a kit when at least one member tool survives the filter", () => {
    const g = buildGalaxy(
      input({
        tools: [tool("Read"), tool("Write")],
        edges: [edge("skuld", "Read"), edge("hildr", "Write")],
        kits: [kit("io", ["Read", "Write"])],
        agentFilter: "hildr",
      }),
    );
    expect(g.nodes.some((n) => n.id === "kit:io")).toBe(true);
    // only the surviving member (Write) is linked
    const targets = g.links
      .filter((l) => l.kind === "kit-tool")
      .map((l) => l.target);
    expect(targets).toEqual(["tool:Write"]);
  });

  it("emits no kit nodes when no kits are supplied", () => {
    const g = buildGalaxy(input({ tools: [tool("Read")] }));
    expect(g.nodes.some((n) => n.kind === "kit")).toBe(false);
    expect(g.stats.kitCount).toBe(0);
  });
});

// ---- empty / defensive ----------------------------------------------------

describe("buildGalaxy — defensive", () => {
  it("returns an empty graph for empty input", () => {
    const g = buildGalaxy(input());
    expect(g.nodes).toEqual([]);
    expect(g.links).toEqual([]);
    expect(g.stats.toolCount).toBe(0);
  });

  it("dedupes if the same tool name appears twice in discoveredTools", () => {
    const g = buildGalaxy(
      input({ tools: [tool("Read"), tool("Read", { _id: "dup" })] }),
    );
    expect(g.nodes.filter((n) => n.id === "tool:Read")).toHaveLength(1);
  });
});
