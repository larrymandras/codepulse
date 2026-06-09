import { useCallback, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Boxes, AlertTriangle, RefreshCw } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import MetricCard from "../components/MetricCard";
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
      if (n.orphan) {
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
    [hoverId],
  );

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
        <div className="flex items-center gap-3 text-primary/70 font-mono text-sm">
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

      <div
        className="relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]"
        style={{ boxShadow: "var(--glow-lg)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-[#09090b] to-black opacity-80 pointer-events-none" />

        {/* Legend */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-[10px] font-mono">
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
            <p className="text-sm text-muted-foreground font-mono">
              No capabilities match the current filters.
            </p>
            <p className="text-xs text-muted-foreground/60">
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
              fgRef.current?.centerAt(n.x, n.y, 800);
              fgRef.current?.zoom(3, 800);
            }}
            cooldownTicks={120}
            d3VelocityDecay={0.3}
            backgroundColor="transparent"
          />
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" />
            Tool Galaxy
            <InfoTooltip text="Force-directed map of every installed tool, MCP server, and the agents that call them. Node brightness = recency, size = usage; dashed amber rings flag installed-but-unused (orphan) tools." />
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Capability topology from discoveredTools · mcpServers · callGraphEdges · kits
          </p>
        </div>

        {/* GAL-04: client-side filters — no reload */}
        <div className="flex items-center gap-2">
          <Select
            value={agentFilter ?? ALL}
            onValueChange={(v) => setAgentFilter(v === ALL ? null : v)}
          >
            <SelectTrigger className="w-44 font-mono text-xs">
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
            <SelectTrigger className="w-44 font-mono text-xs">
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

      <SectionErrorBoundary name="Tool Galaxy">
        <GalaxyCanvas agentFilter={agentFilter} mcpFilter={mcpFilter} />
      </SectionErrorBoundary>
    </div>
  );
}
