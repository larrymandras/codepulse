import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Network,
  Boxes,
  Share2,
  Cpu,
  Server,
  Info,
  GitBranch,
  FileText,
  ArrowUpRight,
  X,
} from "lucide-react";
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
import {
  ForceGraphCanvas,
  type ForceGraphHandle,
} from "../components/graph/ForceGraphCanvas";
import { useGraphSnapshots } from "../hooks/useGraphSnapshot";
import {
  classifySource,
  sourceLabel,
  filterBySource,
  summarizeSources,
  type SnapshotNode,
  type SourceKind,
} from "../lib/graph-snapshot";

// Phase 71 token-aligned palette. graphify code nodes = emerald primary;
// vault wikilink nodes = violet; "other" = amber.
const SOURCE_COLORS: Record<SourceKind, string> = {
  graphify: "#10b981", // --primary emerald
  vault: "#a78bfa", // violet-400
  other: "#eab308", // amber
};

// ── HUB-02: navigable tiles to the existing graph surfaces. Each is a real
// route; styling is consistent with the Tool Galaxy / KG Explorer header chips.
interface HubTile {
  to: string;
  label: string;
  blurb: string;
  icon: typeof Boxes;
}
const HUB_TILES: HubTile[] = [
  {
    to: "/tool-galaxy",
    label: "Tool Galaxy",
    blurb: "Tools · MCP servers · agent↔tool call edges",
    icon: Boxes,
  },
  {
    to: "/knowledge-graph",
    label: "KG Explorer",
    blurb: "Ástríðr's temporal knowledge graph",
    icon: Share2,
  },
  {
    to: "/capabilities",
    label: "Capabilities",
    blurb: "Tools · plugins · skills · hooks · commands",
    icon: Cpu,
  },
  {
    to: "/mcp-inventory",
    label: "MCP Inventory",
    blurb: "MCP servers + per-tool health & governance",
    icon: Server,
  },
];

function HubTiles() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {HUB_TILES.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className="group relative flex flex-col gap-2 rounded-[var(--radius)] border border-primary/20 bg-card/60 backdrop-blur-md p-4 transition-all hover:border-primary/60 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-5 w-5 text-primary transition-all group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold font-mono tracking-wide text-foreground">
                {t.label}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 leading-relaxed">
                {t.blurb}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Source toggle chip (graphify-repos vs vault).
function SourceChip({
  kind,
  label,
  count,
  active,
  onToggle,
}: {
  kind: SourceKind;
  label: string;
  count: number;
  active: boolean;
  onToggle: () => void;
}) {
  const color = SOURCE_COLORS[kind];
  return (
    <button
      onClick={onToggle}
      disabled={count === 0}
      className={`flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-1.5 text-[11px] font-mono transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
      }`}
      style={active ? { boxShadow: `0 0 12px ${color}22` } : undefined}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{
          backgroundColor: active ? color : "transparent",
          border: `1.5px solid ${color}`,
        }}
      />
      {label}
      <span className="text-muted-foreground/60">{count}</span>
    </button>
  );
}

// ── HUB-03: node details + best-effort cross-graph navigation.
// We link a selected node to the surface its `source` family belongs to *only*
// where a real, honest route exists. We do NOT fabricate pre-filtered deep
// links into Tool Galaxy / KG Explorer (those surfaces filter via local state,
// not URL params), so we navigate to the surface and say so plainly.
function NodeDetails({
  node,
  degree,
  onClose,
}: {
  node: SnapshotNode;
  degree: number;
  onClose: () => void;
}) {
  const kind = classifySource(node.source);
  const repo = sourceLabel(node.source);
  return (
    <div className="rounded-[var(--radius)] border border-primary/20 bg-card/60 backdrop-blur-md p-4 space-y-3 h-fit">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold font-mono text-foreground break-words">
            {node.label}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 break-all">
            {node.id}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] font-mono">
        <dt className="text-muted-foreground">type</dt>
        <dd className="text-foreground break-words">{node.type}</dd>
        <dt className="text-muted-foreground">source</dt>
        <dd className="text-foreground break-words">
          {kind === "graphify" ? (
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3 w-3 text-primary" /> {repo}
            </span>
          ) : kind === "vault" ? (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3 text-violet-400" /> vault
            </span>
          ) : (
            node.source || "—"
          )}
        </dd>
        <dt className="text-muted-foreground">degree</dt>
        <dd className="text-foreground">{degree}</dd>
        {node.community !== undefined && (
          <>
            <dt className="text-muted-foreground">community</dt>
            <dd className="text-foreground">{node.community}</dd>
          </>
        )}
      </dl>

      {/* HUB-03: cross-graph navigation, best-effort + honest about limits. */}
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-primary/60 font-mono">
          Cross-graph
        </p>
        {kind === "graphify" ? (
          <>
            <Link
              to="/tool-galaxy"
              className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-mono text-foreground hover:border-primary/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Boxes className="h-3.5 w-3.5 text-primary" /> Open Tool Galaxy
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
            <p className="text-[10px] text-muted-foreground/70 font-mono leading-relaxed">
              This is a graphify code node. Tool→owning-agent→KG entity linking
              isn't in the snapshot data — the galaxy isn't pre-filtered to this
              node.
            </p>
          </>
        ) : kind === "vault" ? (
          <p className="text-[10px] text-muted-foreground/70 font-mono leading-relaxed">
            Vault note. No other CodePulse surface renders the vault graph, so
            there's no cross-link target — explore neighbors here.
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground/70 font-mono leading-relaxed">
            Unclassified source — no cross-graph target.
          </p>
        )}
      </div>
    </div>
  );
}

function SnapshotGraph() {
  const { snapshots, loading } = useGraphSnapshots();
  const fgRef = useRef<ForceGraphHandle>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<SourceKind>>(
    () => new Set<SourceKind>(["graphify", "vault", "other"]),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Default to the first (newest-updated) snapshot.
  const active = useMemo(() => {
    if (snapshots.length === 0) return null;
    if (selectedId) {
      return snapshots.find((s) => s.snapshotId === selectedId) ?? snapshots[0];
    }
    return snapshots[0];
  }, [snapshots, selectedId]);

  const allSummary = useMemo(
    () => summarizeSources(active?.nodes ?? []),
    [active],
  );

  const filtered = useMemo(() => {
    if (!active) return { nodes: [], links: [] };
    return filterBySource(active, enabled);
  }, [active, enabled]);

  // Degree per node id (for the details panel) over the filtered link set.
  const degreeById = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of filtered.links) {
      m.set(l.source, (m.get(l.source) ?? 0) + 1);
      m.set(l.target, (m.get(l.target) ?? 0) + 1);
    }
    return m;
  }, [filtered.links]);

  const nodeById = useMemo(() => {
    const m = new Map<string, SnapshotNode>();
    for (const n of filtered.nodes) m.set(n.id, n);
    return m;
  }, [filtered.nodes]);

  const colorFn = useCallback(
    (n: any) => SOURCE_COLORS[classifySource((n as SnapshotNode).source)],
    [],
  );

  const labelFn = useCallback((n: any) => {
    const node = n as SnapshotNode;
    return `${node.label} · ${node.type} · ${sourceLabel(node.source)}`;
  }, []);

  const toggle = (k: SourceKind) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
        <p className="text-primary/70 font-mono text-sm animate-pulse">
          Loading graph snapshots…
        </p>
      </div>
    );
  }

  // HUB-01 no-telemetry empty state — mirrors the Tool Galaxy treatment. The
  // `graph_snapshot` event doesn't exist until Ástríðr runs the cron.
  if (!active) {
    return (
      <div className="rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-5 py-6">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-amber-500" />
          <div className="font-mono">
            <p className="text-foreground text-sm font-bold">
              No graph snapshot yet.
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
              The graphify-out repo graphs and the Obsidian vault wikilink graph
              render here once Ástríðr pushes a{" "}
              <span className="text-primary">graph_snapshot</span> event from its{" "}
              <span className="text-primary">graph:snapshot</span> cron. Until
              then the hub tiles above link to the live graph surfaces.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const isEmpty = filtered.nodes.length === 0;

  return (
    <div className="space-y-4">
      {/* Controls: snapshot picker + source toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {snapshots.length > 1 ? (
            <Select
              value={active.snapshotId}
              onValueChange={(v) => {
                setSelectedId(v);
                setSelectedNodeId(null);
              }}
            >
              <SelectTrigger className="w-64 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((s) => (
                  <SelectItem key={s.snapshotId} value={s.snapshotId} className="font-mono">
                    {s.snapshotId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs font-mono text-muted-foreground">
              {active.snapshotId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SourceChip
            kind="graphify"
            label="Code repos"
            count={allSummary.graphify}
            active={enabled.has("graphify")}
            onToggle={() => toggle("graphify")}
          />
          <SourceChip
            kind="vault"
            label="Vault"
            count={allSummary.vault}
            active={enabled.has("vault")}
            onToggle={() => toggle("vault")}
          />
          {allSummary.other > 0 && (
            <SourceChip
              kind="other"
              label="Other"
              count={allSummary.other}
              active={enabled.has("other")}
              onToggle={() => toggle("other")}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Nodes (shown)" value={filtered.nodes.length} />
        <MetricCard label="Links (shown)" value={filtered.links.length} />
        <MetricCard label="Code repos" value={allSummary.repos.length} />
        <MetricCard label="Vault notes" value={allSummary.vault} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div className="relative">
          {/* Legend */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-[10px] font-mono">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SOURCE_COLORS.graphify }}
              />
              graphify code node
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SOURCE_COLORS.vault }}
              />
              vault note
            </span>
            {allSummary.other > 0 && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: SOURCE_COLORS.other }}
                />
                other
              </span>
            )}
          </div>

          {isEmpty ? (
            <div className="h-[600px] flex flex-col items-center justify-center gap-2 text-center px-6 rounded-[var(--radius)] border border-primary/20 bg-[#09090b]">
              <Info className="h-6 w-6 text-primary/50" />
              <p className="text-sm text-muted-foreground font-mono">
                No nodes match the enabled sources.
              </p>
              <p className="text-xs text-muted-foreground/60">
                Toggle a source family above to view its graph.
              </p>
            </div>
          ) : (
            <ForceGraphCanvas
              ref={fgRef}
              data={filtered}
              colorFn={colorFn}
              labelFn={labelFn}
              focusSet={
                selectedNodeId ? new Set([selectedNodeId]) : null
              }
              onNodeClick={(n: any) => setSelectedNodeId(n.id)}
              onBackgroundClick={() => setSelectedNodeId(null)}
              linkDirectionalArrow
            />
          )}
        </div>

        {selectedNode ? (
          <NodeDetails
            node={selectedNode}
            degree={degreeById.get(selectedNode.id) ?? 0}
            onClose={() => setSelectedNodeId(null)}
          />
        ) : (
          <div className="rounded-[var(--radius)] border border-border bg-card/40 p-4 h-fit">
            <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
              Click a node to inspect it and see cross-graph navigation options
              (HUB-03). Snapshot pushed{" "}
              {active.snapshotTimestamp
                ? new Date(active.snapshotTimestamp * 1000).toLocaleString()
                : "—"}
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GraphsHub() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            Graphs Hub
            <InfoTooltip text="One entry point for every graph surface in CodePulse: the Tool Galaxy, KG Explorer, Capabilities, and MCP Inventory, plus the graphify-out code graphs and Obsidian vault wikilink graph pushed as snapshots by Ástríðr." />
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            graphSnapshots · graphify-out + vault — pushed by Ástríðr's graph:snapshot cron
          </p>
        </div>
      </div>

      {/* HUB-02: navigable tiles to the existing graph surfaces */}
      <SectionErrorBoundary name="Graph Surfaces">
        <HubTiles />
      </SectionErrorBoundary>

      {/* HUB-01: graphify + vault snapshot via shared ForceGraphCanvas */}
      <SectionErrorBoundary name="Graph Snapshot">
        <SnapshotGraph />
      </SectionErrorBoundary>
    </div>
  );
}
