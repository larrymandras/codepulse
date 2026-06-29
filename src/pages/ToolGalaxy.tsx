import { useCallback, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  AlertTriangle,
  RefreshCw,
  Info,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  X,
} from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import MetricCard from "../components/MetricCard";
import { Separator } from "../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToolGalaxySources } from "../hooks/useToolGalaxy";
import {
  buildGalaxy,
  deriveAgents,
  deriveMcpServers,
  type GalaxyNode,
} from "../lib/tool-galaxy";
import { buildFocusUrl, focusKeysMatch } from "../lib/focus-url";
import { centerNodeWhenReady } from "../lib/graph-center";
import { useProjectGraph } from "../hooks/useProjectGraph";
import { useFocusParam } from "../hooks/useFocusParam";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Phase 71 token-aligned palette (emerald primary, info blue, violet).
const COLORS = {
  toolBase: [16, 185, 129] as const, // --primary emerald
  agent: "#3b82f6", // --status-info
  server: "#a78bfa", // violet-400
  kit: "#f472b6", // pink-400 — capability bundle
  error: "#ef4444", // --status-error
  orphan: "#eab308", // --status-warn (amber)
};

const ALL = "__all__";

/** Mix an emerald tool color whose brightness tracks recency (0..1). */
function toolColor(node: GalaxyNode): string {
  if (node.status === "errored") return COLORS.error;
  if (node.orphan) return COLORS.orphan;
  const [r, g, b] = COLORS.toolBase;
  // Dim toward 35% brightness for stale tools, full for fresh.
  const k = 0.35 + 0.65 * Math.max(0, Math.min(1, node.recency));
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

function nodeColor(node: GalaxyNode): string {
  switch (node.kind) {
    case "agent":
      return COLORS.agent;
    case "mcpServer":
      return COLORS.server;
    case "kit":
      return COLORS.kit;
    default:
      return toolColor(node);
  }
}

/** Derive a friendly surface label from a decoded from-param URL path. */
function surfaceLabel(fromUrl: string): string {
  const path = fromUrl.split("?")[0];
  if (path.startsWith("/graphs")) return "Code/Vault Graph";
  if (path.startsWith("/knowledge-graph")) return "KG Explorer";
  if (path.startsWith("/tool-galaxy")) return "Tool Galaxy";
  if (path.startsWith("/hive")) return "Hive";
  if (path.startsWith("/memory")) return "Memory";
  return "previous graph";
}

function GalaxyCanvas({
  agentFilter,
  mcpFilter,
}: {
  agentFilter: string | null;
  mcpFilter: string | null;
}) {
  const { tools, mcpServers, edges, kits, loading } = useToolGalaxySources();
  const fgRef = useRef<any>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const navigate = useNavigate();

  const agents = useMemo(() => deriveAgents(edges), [edges]);
  const servers = useMemo(() => deriveMcpServers(mcpServers), [mcpServers]);

  const graph = useMemo(
    () =>
      buildGalaxy({
        tools,
        mcpServers,
        edges,
        kits,
        agentFilter,
        mcpFilter,
        now: Date.now() / 1000,
      }),
    [tools, mcpServers, edges, kits, agentFilter, mcpFilter],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, GalaxyNode>();
    for (const n of graph.nodes) m.set(n.id, n);
    return m;
  }, [graph.nodes]);

  // Derive selected node from selectedNodeId
  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

  // Load code/vault nodes for eager owning-agent match (D-04)
  const projectGraph = useProjectGraph();
  const codeVaultNodes = projectGraph?.nodes ?? [];

  // Compute owning agent for a selected tool node:
  // find the agent-tool link whose target === selected tool id,
  // then resolve the agent node to get its bare name.
  const owningAgentName = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== "tool") return null;
    const agentLink = graph.links.find(
      (l) => l.kind === "agent-tool" && l.target === selectedNode.id,
    );
    if (!agentLink) return null;
    const agentNode = graph.nodes.find((n) => n.id === agentLink.source);
    return agentNode?.name ?? null; // bare name (no "agent:" prefix)
  }, [selectedNode, graph.links, graph.nodes]);

  // Eager match: confirm the owning agent exists in code/vault snapshot (SC#3/D-04).
  // Pass bare agent name (owningAgentName), NOT the agent: prefixed id.
  const ownerMatch = useMemo(() => {
    if (!owningAgentName) return null;
    return (
      codeVaultNodes.find((cv) => focusKeysMatch(owningAgentName, cv.label)) ??
      null
    );
  }, [owningAgentName, codeVaultNodes]);

  // Reverse link (GH-04 round-trip): when an AGENT node is selected, list the
  // tools it owns via the same agent-tool edges (source === agent), sorted by
  // name. Jump target is the first tool, mirroring the forward "N KG entities"
  // jump-to-first pattern.
  const agentTools = useMemo(() => {
    if (!selectedNode || selectedNode.kind !== "agent") return [];
    const toolIds = graph.links
      .filter((l) => l.kind === "agent-tool" && l.source === selectedNode.id)
      .map((l) => l.target);
    const toolNodes = toolIds
      .map((id) => graph.nodes.find((n) => n.id === id))
      .filter((n): n is GalaxyNode => !!n && n.kind === "tool");
    return [...toolNodes].sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedNode, graph.links, graph.nodes]);
  const firstTool = agentTools.length > 0 ? agentTools[0] : null;

  // Inbound cross-graph: swarm goals this agent participated in (Tool Galaxy
  // agent → Hive). Skipped for non-agent nodes. Newest goal is the jump target.
  const agentGoals =
    useQuery(
      api.swarmTasks.goalsByAgent,
      selectedNode?.kind === "agent" ? { agentId: selectedNode.name } : "skip",
    ) ?? [];
  const firstGoal = agentGoals.length > 0 ? agentGoals[0] : null;

  // Inbound focus param handling (Task 2) — one-shot on mount
  const { fromParam } = useFocusParam({
    nodes: loading ? undefined : graph.nodes,
    getId: (n) => n.id,
    onFocus: (node) => {
      setSelectedNodeId(node.id);
      // Center once the force layout assigns x/y (WR-02 — retry, don't skip).
      centerNodeWhenReady(fgRef, node as GalaxyNode & { x?: number; y?: number });
    },
  });

  // "Data-starved" state: tools are installed but no tool call has ever been
  // recorded (callGraphEdges is empty), so usage sizing, agent links, kit
  // bundles, and orphan flags are all meaningless. Surface it explicitly rather
  // than rendering a hairball of "all-orphan" nodes that reads as broken.
  const noTelemetry =
    graph.stats.edgeCount === 0 && graph.stats.toolCount > 0;

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GalaxyNode & { x: number; y: number };
      const isHovered = n.id === hoverId;
      const size = Math.max(n.val, 3);
      const color = nodeColor(n);

      // GAL-02: glow encodes recency/usage; errored & orphan still legible.
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered
        ? 28
        : n.kind === "tool"
          ? 6 + n.recency * 18
          : 10;
      ctx.fillStyle = isHovered ? "#ffffff" : color;
      if (n.kind === "kit") {
        // Kits render as a rounded square so the capability-bundle layer reads
        // distinctly from the circular tool/agent/server nodes.
        const r = 2;
        const x = node.x - size;
        const y = node.y - size;
        const s = size * 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + s, y, x + s, y + s, r);
        ctx.arcTo(x + s, y + s, x, y + s, r);
        ctx.arcTo(x, y + s, x, y, r);
        ctx.arcTo(x, y, x + s, y, r);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // GAL-03: orphan ring — dashed amber outline so unused tools read instantly.
      // Suppressed when there's no telemetry at all: every tool is trivially an
      // "orphan" then, which is noise rather than signal.
      if (n.orphan && !noTelemetry) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 2.5, 0, 2 * Math.PI, false);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = COLORS.orphan;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (globalScale > 1.4 || isHovered) {
        const fontSize = (isHovered ? 13 : 11) / globalScale;
        ctx.font = `${isHovered ? "bold " : ""}${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = n.name;
        const tw = ctx.measureText(label).width;
        const bgH = fontSize + 4;
        ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
        ctx.fillRect(node.x - tw / 2 - 4, node.y + size + 2, tw + 8, bgH);
        ctx.fillStyle = isHovered ? "#ffffff" : color;
        ctx.fillText(label, node.x, node.y + size + 2 + bgH / 2);
      }
    },
    [hoverId, noTelemetry],
  );

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
        <div className="flex items-center gap-3 text-primary/70 font-mono text-base">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Assembling capability galaxy...
        </div>
      </div>
    );
  }

  const isEmpty = graph.nodes.length === 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard label="Tools" value={graph.stats.toolCount} />
        <MetricCard label="Agents" value={graph.stats.agentCount} />
        <MetricCard label="MCP Servers" value={graph.stats.serverCount} />
        <MetricCard label="Kits" value={graph.stats.kitCount} />
        <MetricCard label="Edges" value={graph.stats.edgeCount} />
        <MetricCard label="Orphans" value={graph.stats.orphanCount} />
      </div>

      {noTelemetry && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <div className="text-sm font-mono leading-relaxed">
            <p className="text-foreground">No usage telemetry yet.</p>
            <p className="text-muted-foreground mt-0.5">
              {graph.stats.toolCount} tools are installed, but no tool calls have
              been recorded. Node sizing, agent links, kit bundles, and orphan
              flags populate once Ástríðr reports tool executions to{" "}
              <span className="text-primary">callGraphEdges</span> (and{" "}
              <span className="text-primary">kits_snapshot</span> at bootstrap).
            </p>
          </div>
        </div>
      )}

      {/* Return chip — rendered top-left when ?from is present (D-06 / T-85-01) */}
      {fromParam && (
        <SectionErrorBoundary name="Return navigation">
          <button
            aria-label={"Return to " + surfaceLabel(fromParam)}
            onClick={() => navigate(fromParam)}
            className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground border-l-2 border-primary/40 pl-2 py-1.5 hover:border-primary/70 transition-colors duration-200"
          >
            <ChevronLeft className="h-3 w-3" />
            {"Back to " + surfaceLabel(fromParam)}
          </button>
        </SectionErrorBoundary>
      )}

      {/* Canvas + optional detail panel side-by-side when a node is selected */}
      <div className={selectedNodeId ? "grid grid-cols-[1fr_280px] gap-4 items-start" : ""}>
        <div
          className="relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]"
          style={{ boxShadow: "var(--glow-lg)" }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-[#09090b] to-black opacity-80 pointer-events-none" />

          {/* Legend */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-xs font-mono">
            <LegendDot color="rgb(16,185,129)" label="Tool (bright = recent)" />
            <LegendDot color={COLORS.agent} label="Agent / persona" />
            <LegendDot color={COLORS.server} label="MCP server" />
            <LegendDot color={COLORS.kit} label="Kit (bundle)" square />
            <LegendDot color={COLORS.error} label="Errored" />
            <LegendDot color={COLORS.orphan} label="Orphan (unused)" dashed />
          </div>

          {isEmpty ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
              <AlertTriangle className="h-6 w-6 text-primary/50" />
              <p className="text-base text-muted-foreground font-mono">
                No capabilities match the current filters.
              </p>
              <p className="text-sm text-muted-foreground/60">
                Tools, MCP servers, and agent call edges will appear here once
                Ástríðr telemetry arrives.
              </p>
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graph}
              nodeId="id"
              nodeLabel={(n: any) => {
                const node = n as GalaxyNode;
                if (node.kind === "tool") {
                  return `${node.name} — ${node.callCount} calls${
                    node.orphan ? " (orphan)" : ""
                  }${node.errorCount ? ` · ${node.errorCount} errors` : ""}`;
                }
                return `${node.kind}: ${node.name}`;
              }}
              nodeColor={(n: any) => nodeColor(n as GalaxyNode)}
              nodeRelSize={1}
              nodeCanvasObject={paintNode}
              linkColor={(l: any) => {
                const active =
                  l.source?.id === hoverId || l.target?.id === hoverId;
                if (active) return "rgba(16, 185, 129, 0.9)";
                if (l.kind === "server-tool") return "rgba(167, 139, 250, 0.25)";
                if (l.kind === "kit-tool") return "rgba(244, 114, 182, 0.25)";
                return "rgba(16, 185, 129, 0.18)";
              }}
              linkWidth={(l: any) =>
                l.source?.id === hoverId || l.target?.id === hoverId ? 2 : 0.6
              }
              linkDirectionalParticles={(l: any) =>
                l.kind === "agent-tool" ? 2 : 0
              }
              linkDirectionalParticleWidth={1.5}
              linkDirectionalParticleSpeed={0.006}
              onNodeHover={(n: any) => setHoverId(n?.id ?? null)}
              onNodeClick={(n: any) => {
                setSelectedNodeId(n.id);
                fgRef.current?.centerAt(n.x, n.y, 800);
                fgRef.current?.zoom(3, 800);
              }}
              cooldownTicks={120}
              d3VelocityDecay={0.3}
              backgroundColor="transparent"
            />
          )}
        </div>

        {/* Detail panel — rendered when a node is selected */}
        {selectedNodeId && (
          <div
            aria-label="Node details"
            className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 h-[600px] overflow-y-auto"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Node Details
              </span>
              <button
                aria-label="Close node details"
                onClick={() => setSelectedNodeId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedNode ? (
              <div className="space-y-3">
                {/* Name */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">
                    name
                  </p>
                  <p className="font-bold text-base text-foreground">
                    {selectedNode.name}
                  </p>
                </div>

                {/* Kind */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">
                    kind
                  </p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {selectedNode.kind}
                  </p>
                </div>

                {/* Call count (tools only) */}
                {selectedNode.kind === "tool" && (
                  <div>
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">
                      calls
                    </p>
                    <p className="text-sm font-mono text-muted-foreground">
                      {selectedNode.callCount}
                      {selectedNode.errorCount > 0 &&
                        ` · ${selectedNode.errorCount} errors`}
                    </p>
                  </div>
                )}

                {/* RELATED ACROSS GRAPHS — forward tool→agent (ownerMatch),
                    reverse agent→tools (firstTool), and agent→Hive swarm goals
                    (firstGoal). Tools/agent are mutually exclusive; an agent may
                    show both tools + swarm-goals. (SC#3/D-04 + GH-04 round-trip) */}
                {(ownerMatch || firstTool || firstGoal) && (
                  <>
                    <Separator className="mt-6 mb-4" />
                    <div
                      aria-label="Related across graphs navigation links"
                    >
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                        RELATED ACROSS GRAPHS
                      </p>
                      <SectionErrorBoundary name="Cross-graph links">
                        {ownerMatch && (
                          <button
                            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-primary/5 cursor-pointer transition-colors duration-200"
                            onClick={() => {
                              const fromGalaxyUrl =
                                "/tool-galaxy?focus=" +
                                encodeURIComponent(selectedNode.id);
                              navigate(
                                buildFocusUrl(
                                  { surface: "graphs", nodeId: ownerMatch.id },
                                  fromGalaxyUrl,
                                ),
                              );
                            }}
                          >
                            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-sm text-muted-foreground">
                              Owning agent:
                            </span>
                            <span className="text-sm font-semibold text-foreground truncate">
                              {ownerMatch.label}
                            </span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto shrink-0" />
                          </button>
                        )}
                        {firstTool && (
                          <button
                            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-primary/5 cursor-pointer transition-colors duration-200"
                            onClick={() => {
                              const fromGalaxyUrl =
                                "/tool-galaxy?focus=" +
                                encodeURIComponent(selectedNode.id);
                              navigate(
                                buildFocusUrl(
                                  { surface: "tool-galaxy", nodeId: firstTool.id },
                                  fromGalaxyUrl,
                                ),
                              );
                            }}
                          >
                            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-sm text-muted-foreground">
                              {agentTools.length === 1
                                ? "1 tool"
                                : `${agentTools.length} tools`}
                            </span>
                            <span className="text-sm font-semibold text-foreground truncate">
                              {firstTool.name}
                            </span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto shrink-0" />
                          </button>
                        )}
                        {firstGoal && (
                          <button
                            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-primary/5 cursor-pointer transition-colors duration-200"
                            onClick={() =>
                              navigate(
                                "/hive?goal=" + encodeURIComponent(firstGoal),
                              )
                            }
                          >
                            <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-sm text-muted-foreground">
                              {agentGoals.length === 1
                                ? "1 swarm goal"
                                : `${agentGoals.length} swarm goals`}
                            </span>
                            <span className="text-sm font-semibold text-foreground truncate">
                              Hive
                            </span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto shrink-0" />
                          </button>
                        )}
                      </SectionErrorBoundary>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm font-mono text-muted-foreground text-center mt-8">
                Select a node to inspect
              </p>
            )}
          </div>
        )}
      </div>

      {/* Filter option counts surfaced for accessibility / debugging */}
      <p className="sr-only">
        {agents.length} agents, {servers.length} MCP servers available as
        filters.
      </p>
    </div>
  );
}

function LegendDot({
  color,
  label,
  dashed,
  square,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  square?: boolean;
}) {
  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span
        className={`inline-block h-2.5 w-2.5 ${square ? "rounded-[2px]" : "rounded-full"}`}
        style={{
          backgroundColor: dashed ? "transparent" : color,
          border: dashed ? `1.5px dashed ${color}` : undefined,
        }}
      />
      {label}
    </span>
  );
}

export default function ToolGalaxy() {
  const { mcpServers, edges } = useToolGalaxySources();
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [mcpFilter, setMcpFilter] = useState<string | null>(null);

  const agents = useMemo(() => deriveAgents(edges), [edges]);
  const servers = useMemo(() => deriveMcpServers(mcpServers), [mcpServers]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
      <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            Tool Galaxy
            <InfoTooltip text="Force-directed map of every installed tool, MCP server, and the agents that call them. Node brightness = recency, size = usage; dashed amber rings flag installed-but-unused (orphan) tools." />
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Capability topology from discoveredTools · mcpServers · callGraphEdges · kits
          </p>
        </div>

        {/* GAL-04: client-side filters — no reload */}
        <div className="flex items-center gap-2">
          <Select
            value={agentFilter ?? ALL}
            onValueChange={(v) => setAgentFilter(v === ALL ? null : v)}
          >
            <SelectTrigger className="w-44 font-mono text-sm">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a} value={a} className="font-mono">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={mcpFilter ?? ALL}
            onValueChange={(v) => setMcpFilter(v === ALL ? null : v)}
          >
            <SelectTrigger className="w-44 font-mono text-sm">
              <SelectValue placeholder="All MCP servers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All MCP servers</SelectItem>
              {servers.map((s) => (
                <SelectItem key={s._id} value={s.name} className="font-mono">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="md:col-span-12">
        <SectionErrorBoundary name="Tool Galaxy">
          <GalaxyCanvas agentFilter={agentFilter} mcpFilter={mcpFilter} />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
