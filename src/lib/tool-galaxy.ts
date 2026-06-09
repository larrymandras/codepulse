/**
 * Tool / Capability Galaxy — pure data-transform layer (Phase 72, GAL-01..04).
 *
 * Assembles a force-graph {nodes, links} model from three live Convex sources:
 *   - discoveredTools  (installed tools)
 *   - mcpServers       (MCP servers that host tools)
 *   - callGraphEdges   (agent -> tool call edges with usage/recency/health)
 *
 * NOTE: the milestone requirements (GAL-01) also mention `kits`, but there is no
 * `kits`/`toolKits` table in convex/schema.ts. This module is built for the three
 * tables that DO exist; add a `kit` node kind here when/if that table lands.
 *
 * This file is intentionally framework-free and fully unit-testable: it does no
 * rendering and imports nothing from React or the graph library. The page
 * (ToolGalaxy.tsx) feeds raw query rows in and gets a render-ready model out.
 */

// ---- source row shapes (subset of the Convex docs we actually read) -------

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

export interface McpServer {
  _id: string;
  name: string;
  status: string; // "connected" | "disconnected" | "error" | ...
  url?: string;
  toolCount?: number;
  lastSeenAt: number;
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

// ---- output model ---------------------------------------------------------

export type NodeKind = "tool" | "mcpServer" | "agent";

export interface GalaxyNode {
  id: string; // namespaced: "tool:Read" | "mcp:github" | "agent:skuld"
  name: string;
  kind: NodeKind;
  /** force-graph node size; scaled from usage for tools, fixed for others. */
  val: number;
  /** aggregate call volume across all edges (tools only; 0 otherwise). */
  callCount: number;
  errorCount: number;
  /** 0..1 — 1 = used just now, decays with age (tools only). */
  recency: number;
  lastCallAt?: number;
  /** GAL-03: installed tool with zero call edges. Always false for non-tools. */
  orphan: boolean;
  status: "healthy" | "errored" | "idle";
  /** MCP server host for a tool node, if any. */
  serverName?: string;
  description?: string;
  origin?: string;
}

export interface GalaxyLink {
  source: string;
  target: string;
  kind: "agent-tool" | "server-tool";
  callCount: number;
}

export interface GalaxyStats {
  toolCount: number;
  agentCount: number;
  serverCount: number;
  orphanCount: number;
  edgeCount: number;
}

export interface GalaxyGraph {
  nodes: GalaxyNode[];
  links: GalaxyLink[];
  stats: GalaxyStats;
}

export interface ToolGalaxyInput {
  tools: DiscoveredTool[];
  mcpServers: McpServer[];
  edges: CallGraphEdge[];
  /** current epoch (seconds) for recency; defaults to Date.now()/1000. */
  now?: number;
  /** GAL-04: keep only this agent and the tools it calls. */
  agentFilter?: string | null;
  /** GAL-04: keep only this MCP server and the tools it hosts. */
  mcpFilter?: string | null;
}

// id helpers — keep namespacing in one place so links/nodes never drift.
export const toolId = (name: string) => `tool:${name}`;
export const mcpId = (name: string) => `mcp:${name}`;
export const agentId = (id: string) => `agent:${id}`;

const MIN_TOOL_SIZE = 3;
const MAX_TOOL_SIZE = 22;
const AGENT_SIZE = 8;
const SERVER_SIZE = 10;
// Recency half-life: ~7 days (in seconds). After one half-life, recency = 0.5.
const RECENCY_HALFLIFE_S = 7 * 24 * 60 * 60;

const isRealAgent = (id: string) => !!id && id !== "unknown";

/** GAL-04 option lists, derived from the same live sources the graph uses. */
export function deriveAgents(edges: CallGraphEdge[]): string[] {
  const set = new Set<string>();
  for (const e of edges) if (isRealAgent(e.agentId)) set.add(e.agentId);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function deriveMcpServers(servers: McpServer[]): McpServer[] {
  return [...servers].sort((a, b) => a.name.localeCompare(b.name));
}

interface ToolAgg {
  callCount: number;
  errorCount: number;
  lastCallAt: number;
  errored: boolean;
  edgeCount: number;
}

function aggregateEdgesByTool(edges: CallGraphEdge[]): Map<string, ToolAgg> {
  const map = new Map<string, ToolAgg>();
  for (const e of edges) {
    const agg = map.get(e.toolName) ?? {
      callCount: 0,
      errorCount: 0,
      lastCallAt: 0,
      errored: false,
      edgeCount: 0,
    };
    agg.callCount += e.callCount;
    agg.errorCount += e.errorCount;
    agg.lastCallAt = Math.max(agg.lastCallAt, e.lastCallAt);
    agg.errored = agg.errored || e.status === "errored" || e.errorCount > 0;
    agg.edgeCount += 1;
    map.set(e.toolName, agg);
  }
  return map;
}

/** Exponential decay → 1 just used, 0.5 one half-life ago, → 0 for very old. */
function computeRecency(lastCallAt: number | undefined, now: number): number {
  if (!lastCallAt || lastCallAt <= 0) return 0;
  const ageS = Math.max(0, now - lastCallAt);
  return Math.pow(2, -ageS / RECENCY_HALFLIFE_S);
}

/** Log-scaled tool size so a 1000-call tool isn't 1000x a 1-call tool. */
function scaleToolSize(callCount: number, maxCall: number): number {
  if (callCount <= 0 || maxCall <= 0) return MIN_TOOL_SIZE;
  const ratio = Math.log1p(callCount) / Math.log1p(maxCall);
  return MIN_TOOL_SIZE + ratio * (MAX_TOOL_SIZE - MIN_TOOL_SIZE);
}

export function buildGalaxy(inputArg: ToolGalaxyInput): GalaxyGraph {
  const now = inputArg.now ?? Date.now() / 1000;
  const agentFilter = inputArg.agentFilter || null;
  const mcpFilter = inputArg.mcpFilter || null;

  const edgeAgg = aggregateEdgesByTool(inputArg.edges);

  // ---- 1. collect the universe of tool names (installed ∪ edge-referenced) --
  const toolByName = new Map<string, DiscoveredTool | undefined>();
  for (const t of inputArg.tools) {
    if (!toolByName.has(t.name)) toolByName.set(t.name, t);
  }
  for (const name of edgeAgg.keys()) {
    if (!toolByName.has(name)) toolByName.set(name, undefined);
  }

  // serverName lookup is only meaningful when the server actually exists.
  const serverNames = new Set(inputArg.mcpServers.map((s) => s.name));

  const maxCall = Math.max(
    1,
    ...[...edgeAgg.values()].map((a) => a.callCount),
  );

  // ---- 2. decide which agents / tools / servers survive the filters --------
  // Agents called per tool (for agent-filter tool inclusion).
  const agentsByTool = new Map<string, Set<string>>();
  for (const e of inputArg.edges) {
    if (!isRealAgent(e.agentId)) continue;
    const s = agentsByTool.get(e.toolName) ?? new Set<string>();
    s.add(e.agentId);
    agentsByTool.set(e.toolName, s);
  }

  const toolServer = (name: string): string | undefined => {
    const t = toolByName.get(name);
    return t?.serverName && serverNames.has(t.serverName)
      ? t.serverName
      : undefined;
  };

  const toolPassesFilters = (name: string): boolean => {
    if (agentFilter) {
      const callers = agentsByTool.get(name);
      if (!callers || !callers.has(agentFilter)) return false;
    }
    if (mcpFilter) {
      if (toolServer(name) !== mcpFilter) return false;
    }
    return true;
  };

  const keptToolNames = [...toolByName.keys()].filter(toolPassesFilters);
  const keptToolSet = new Set(keptToolNames);

  // ---- 3. build tool nodes -------------------------------------------------
  const nodes: GalaxyNode[] = [];
  for (const name of keptToolNames) {
    const t = toolByName.get(name);
    const agg = edgeAgg.get(name);
    const callCount = agg?.callCount ?? 0;
    const errorCount = agg?.errorCount ?? 0;
    const lastCallAt = agg?.lastCallAt ?? t?.lastUsedAt;
    const orphan = !agg || agg.edgeCount === 0;
    const status: GalaxyNode["status"] = orphan
      ? "idle"
      : agg!.errored
        ? "errored"
        : "healthy";
    nodes.push({
      id: toolId(name),
      name,
      kind: "tool",
      val: orphan ? MIN_TOOL_SIZE : scaleToolSize(callCount, maxCall),
      callCount,
      errorCount,
      recency: computeRecency(lastCallAt, now),
      lastCallAt: lastCallAt && lastCallAt > 0 ? lastCallAt : undefined,
      orphan,
      status,
      serverName: toolServer(name),
      description: t?.description,
      origin: t?.origin,
    });
  }

  // ---- 4. build agent nodes (only those with a surviving tool) -------------
  const agentSet = new Set<string>();
  for (const e of inputArg.edges) {
    if (!isRealAgent(e.agentId)) continue;
    if (agentFilter && e.agentId !== agentFilter) continue;
    if (!keptToolSet.has(e.toolName)) continue;
    agentSet.add(e.agentId);
  }
  for (const id of agentSet) {
    nodes.push({
      id: agentId(id),
      name: id,
      kind: "agent",
      val: AGENT_SIZE,
      callCount: 0,
      errorCount: 0,
      recency: 0,
      orphan: false,
      status: "healthy",
    });
  }

  // ---- 5. build server nodes (only those hosting a surviving tool) ---------
  const serverSet = new Set<string>();
  for (const name of keptToolNames) {
    const sn = toolServer(name);
    if (sn) serverSet.add(sn);
  }
  for (const srv of inputArg.mcpServers) {
    if (mcpFilter && srv.name !== mcpFilter) continue;
    if (!serverSet.has(srv.name)) continue;
    nodes.push({
      id: mcpId(srv.name),
      name: srv.name,
      kind: "mcpServer",
      val: SERVER_SIZE,
      callCount: 0,
      errorCount: 0,
      recency: 0,
      orphan: false,
      status: srv.status === "connected" ? "healthy" : "idle",
      origin: srv.origin,
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // ---- 6. links ------------------------------------------------------------
  const links: GalaxyLink[] = [];

  // agent -> tool (one per surviving edge target, aggregated per pair)
  const agentToolSeen = new Set<string>();
  const edgePairCount = new Map<string, number>();
  for (const e of inputArg.edges) {
    if (!isRealAgent(e.agentId)) continue;
    const key = `${e.agentId} ${e.toolName}`;
    edgePairCount.set(key, (edgePairCount.get(key) ?? 0) + e.callCount);
  }
  for (const e of inputArg.edges) {
    if (!isRealAgent(e.agentId)) continue;
    const src = agentId(e.agentId);
    const tgt = toolId(e.toolName);
    const key = `${src} ${tgt}`;
    if (agentToolSeen.has(key)) continue;
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue;
    agentToolSeen.add(key);
    links.push({
      source: src,
      target: tgt,
      kind: "agent-tool",
      callCount: edgePairCount.get(`${e.agentId} ${e.toolName}`) ?? 0,
    });
  }

  // server -> tool
  for (const name of keptToolNames) {
    const sn = toolServer(name);
    if (!sn) continue;
    const src = mcpId(sn);
    const tgt = toolId(name);
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue;
    links.push({ source: src, target: tgt, kind: "server-tool", callCount: 0 });
  }

  const toolNodes = nodes.filter((n) => n.kind === "tool");
  const stats: GalaxyStats = {
    toolCount: toolNodes.length,
    agentCount: agentSet.size,
    serverCount: serverSet.size,
    orphanCount: toolNodes.filter((n) => n.orphan).length,
    edgeCount: links.length,
  };

  return { nodes, links, stats };
}
