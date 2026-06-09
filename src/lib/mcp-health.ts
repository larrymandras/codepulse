/**
 * MCP Inventory + Health — pure data-transform layer (Phase 73, MCP-01..03).
 *
 * Joins three live Convex sources into a per-server, per-tool health model:
 *   - mcpServers      (the MCP servers that host tools; name/status/url/...)
 *   - discoveredTools (installed tools; each tool's `serverName` ties it to a
 *                      server, `source === "mcp"` marks it MCP-hosted)
 *   - callGraphEdges  (agent→tool call edges with callCount/errorCount/recency)
 *
 * Like tool-galaxy.ts this file is framework-free and fully unit-testable: it
 * does no rendering and imports nothing from React. The page (McpInventory.tsx)
 * feeds raw query rows in and gets a render-ready, grouped model out.
 *
 * MCP-03 governance: a separate `toolGovernance` source supplies a `disabled`
 * flag per tool name; it's merged in so a disabled tool reads as governed
 * regardless of its live health.
 */

// ---- source row shapes (subset of the Convex docs we actually read) -------

export interface McpServer {
  _id: string;
  name: string;
  status: string; // "connected" | "disconnected" | "error" | "configured" | ...
  url?: string;
  toolCount?: number;
  lastSeenAt: number;
  origin?: string;
}

export interface DiscoveredTool {
  _id: string;
  name: string;
  source: string; // "mcp" | "builtin" | "plugin"
  serverName?: string;
  description?: string;
  usageCount: number;
  lastUsedAt?: number;
  discoveredAt: number;
  origin?: string;
}

export interface CallGraphEdge {
  _id: string;
  agentId: string;
  toolName: string;
  sessionId: string;
  callCount: number;
  lastCallAt: number;
  lastErrorAt?: number;
  errorCount: number;
  status: string; // "healthy" | "errored"
}

export interface ToolGovernanceRow {
  _id: string;
  toolName: string;
  disabled: boolean;
  updatedAt: number;
  updatedBy?: string;
  note?: string;
}

// ---- output model ---------------------------------------------------------

/**
 * MCP-01 server-level status pill:
 *   connected — server reports a live/connected status
 *   error     — server reports an error/disconnected status
 *   unused    — server is reachable/configured but none of its tools have ever
 *               been called (no edges across all its tools)
 */
export type ServerStatus = "connected" | "error" | "unused";

/**
 * MCP-02 per-tool health status:
 *   connected — has call edges and no errors
 *   error     — has call edges with at least one error (errorRate > 0)
 *   unused    — installed under this server but never called (no edges)
 */
export type ToolStatus = "connected" | "error" | "unused";

export interface ToolHealth {
  name: string;
  /** MCP-02 status pill. */
  status: ToolStatus;
  /** Total calls across all agents (from callGraphEdges). */
  callCount: number;
  /** Total errored calls across all agents. */
  errorCount: number;
  /** MCP-02 error rate in [0,1] = errorCount / callCount; 0 when never called. */
  errorRate: number;
  /** MCP-02 last call time (epoch seconds); undefined if never called. */
  lastCallAt?: number;
  /** Most recent error time (epoch seconds); undefined if never errored. */
  lastErrorAt?: number;
  /** True when there are zero call edges for this tool. */
  unused: boolean;
  /** MCP-03 governance flag — operator has disabled/pruned this tool. */
  disabled: boolean;
  description?: string;
  origin?: string;
}

export interface ServerGroup {
  serverId: string;
  name: string;
  /** MCP-01 server status pill. */
  status: ServerStatus;
  /** Raw server status string from Convex, for detail display. */
  rawStatus: string;
  url?: string;
  origin?: string;
  lastSeenAt: number;
  tools: ToolHealth[];
  /** Convenience counts for the server header. */
  toolCount: number;
  connectedCount: number;
  errorCount: number;
  unusedCount: number;
  disabledCount: number;
  /** Aggregate calls across all of this server's tools. */
  totalCalls: number;
}

export interface McpHealthStats {
  serverCount: number;
  connectedServers: number;
  erroredServers: number;
  unusedServers: number;
  mcpToolCount: number;
  unusedTools: number;
  erroredTools: number;
  disabledTools: number;
}

export interface McpHealthModel {
  servers: ServerGroup[];
  stats: McpHealthStats;
}

export interface McpHealthInput {
  mcpServers: McpServer[];
  tools: DiscoveredTool[];
  edges: CallGraphEdge[];
  /** MCP-03 governance flags, keyed by tool name. */
  governance?: ToolGovernanceRow[];
}

// Server statuses that count as a healthy/live connection.
const CONNECTED_SERVER_STATUSES = new Set(["connected"]);
// Server statuses that should read as an error pill.
const ERROR_SERVER_STATUSES = new Set(["error", "disconnected", "failed"]);

interface ToolAgg {
  callCount: number;
  errorCount: number;
  lastCallAt: number;
  lastErrorAt: number;
}

/** Aggregate every call edge down to one row per tool name. */
function aggregateEdgesByTool(edges: CallGraphEdge[]): Map<string, ToolAgg> {
  const map = new Map<string, ToolAgg>();
  for (const e of edges) {
    const agg =
      map.get(e.toolName) ??
      ({ callCount: 0, errorCount: 0, lastCallAt: 0, lastErrorAt: 0 } as ToolAgg);
    agg.callCount += e.callCount;
    agg.errorCount += e.errorCount;
    agg.lastCallAt = Math.max(agg.lastCallAt, e.lastCallAt);
    if (e.lastErrorAt) agg.lastErrorAt = Math.max(agg.lastErrorAt, e.lastErrorAt);
    map.set(e.toolName, agg);
  }
  return map;
}

/**
 * A tool is "MCP-hosted" when it advertises a serverName that matches a known
 * MCP server (preferred), OR its source is "mcp". We key grouping off
 * serverName so each tool lands under exactly one server.
 */
function isMcpTool(t: DiscoveredTool, serverNames: Set<string>): boolean {
  if (t.serverName && serverNames.has(t.serverName)) return true;
  return t.source === "mcp" && !!t.serverName;
}

function computeToolHealth(
  name: string,
  agg: ToolAgg | undefined,
  disabled: boolean,
  extra: { description?: string; origin?: string },
): ToolHealth {
  const callCount = agg?.callCount ?? 0;
  const errorCount = agg?.errorCount ?? 0;
  const unused = !agg || callCount === 0;
  const errorRate = callCount > 0 ? errorCount / callCount : 0;
  const status: ToolStatus = unused
    ? "unused"
    : errorCount > 0
      ? "error"
      : "connected";
  return {
    name,
    status,
    callCount,
    errorCount,
    errorRate,
    lastCallAt: agg && agg.lastCallAt > 0 ? agg.lastCallAt : undefined,
    lastErrorAt: agg && agg.lastErrorAt > 0 ? agg.lastErrorAt : undefined,
    unused,
    disabled,
    description: extra.description,
    origin: extra.origin,
  };
}

/**
 * Derive the server-level status pill (MCP-01):
 *   - error  when the server's own status string is an error/disconnected one
 *   - unused when the server is otherwise fine but NONE of its tools have edges
 *   - connected otherwise
 *
 * A server with no tools at all but a "connected" raw status still reads as
 * connected (it's reachable, just exposes nothing yet); a server with tools but
 * zero calls reads as unused so it surfaces for pruning.
 */
function deriveServerStatus(
  rawStatus: string,
  tools: ToolHealth[],
): ServerStatus {
  const s = rawStatus.toLowerCase();
  if (ERROR_SERVER_STATUSES.has(s)) return "error";
  if (tools.length > 0 && tools.every((t) => t.unused)) return "unused";
  if (CONNECTED_SERVER_STATUSES.has(s)) return "connected";
  // Statuses like "configured"/"discovered": connected if anything's been used,
  // otherwise unused so they don't masquerade as live.
  return tools.some((t) => !t.unused) ? "connected" : "unused";
}

export function buildMcpHealth(input: McpHealthInput): McpHealthModel {
  const serverNames = new Set(input.mcpServers.map((s) => s.name));
  const edgeAgg = aggregateEdgesByTool(input.edges);

  const disabledByName = new Map<string, boolean>();
  for (const g of input.governance ?? []) {
    disabledByName.set(g.toolName, g.disabled);
  }

  // Group MCP tools by their serverName.
  const toolsByServer = new Map<string, DiscoveredTool[]>();
  for (const t of input.tools) {
    if (!isMcpTool(t, serverNames)) continue;
    const key = t.serverName as string;
    const arr = toolsByServer.get(key) ?? [];
    arr.push(t);
    toolsByServer.set(key, arr);
  }

  const servers: ServerGroup[] = [];
  for (const srv of input.mcpServers) {
    const rawTools = toolsByServer.get(srv.name) ?? [];
    // Stable, de-duplicated tool ordering: errored first, then unused, then
    // by call volume desc, then name — so the most actionable rows sit on top.
    const seen = new Set<string>();
    const tools: ToolHealth[] = [];
    for (const t of rawTools) {
      if (seen.has(t.name)) continue;
      seen.add(t.name);
      tools.push(
        computeToolHealth(t.name, edgeAgg.get(t.name), disabledByName.get(t.name) ?? false, {
          description: t.description,
          origin: t.origin,
        }),
      );
    }
    tools.sort((a, b) => {
      const rank = (x: ToolHealth) =>
        x.status === "error" ? 0 : x.status === "unused" ? 1 : 2;
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (b.callCount !== a.callCount) return b.callCount - a.callCount;
      return a.name.localeCompare(b.name);
    });

    const status = deriveServerStatus(srv.status, tools);
    const connectedCount = tools.filter((t) => t.status === "connected").length;
    const errorCount = tools.filter((t) => t.status === "error").length;
    const unusedCount = tools.filter((t) => t.status === "unused").length;
    const disabledCount = tools.filter((t) => t.disabled).length;
    const totalCalls = tools.reduce((sum, t) => sum + t.callCount, 0);

    servers.push({
      serverId: srv._id,
      name: srv.name,
      status,
      rawStatus: srv.status,
      url: srv.url,
      origin: srv.origin,
      lastSeenAt: srv.lastSeenAt,
      tools,
      toolCount: tools.length,
      connectedCount,
      errorCount,
      unusedCount,
      disabledCount,
      totalCalls,
    });
  }

  // Servers ordered: error first, then unused, then connected; within a tier by
  // name — surfacing the servers that need attention at the top.
  servers.sort((a, b) => {
    const rank = (s: ServerGroup) =>
      s.status === "error" ? 0 : s.status === "unused" ? 1 : 2;
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });

  const mcpToolCount = servers.reduce((n, s) => n + s.toolCount, 0);
  const stats: McpHealthStats = {
    serverCount: servers.length,
    connectedServers: servers.filter((s) => s.status === "connected").length,
    erroredServers: servers.filter((s) => s.status === "error").length,
    unusedServers: servers.filter((s) => s.status === "unused").length,
    mcpToolCount,
    unusedTools: servers.reduce((n, s) => n + s.unusedCount, 0),
    erroredTools: servers.reduce((n, s) => n + s.errorCount, 0),
    disabledTools: servers.reduce((n, s) => n + s.disabledCount, 0),
  };

  return { servers, stats };
}
