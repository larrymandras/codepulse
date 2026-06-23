import { useMemo, useState } from "react";
import {
  Network,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Ban,
  CircleCheck,
  AlertTriangle,
} from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import { formatTimestamp, relativeTime } from "../lib/formatters";
import { useMcpHealthSources, useSetToolDisabled } from "../hooks/useMcpHealth";
import {
  buildMcpHealth,
  type ServerGroup,
  type ToolHealth,
  type ServerStatus,
  type ToolStatus,
} from "../lib/mcp-health";

// Map MCP status → StatusBadge semantic (ok/error/idle), so the inventory reuses
// the Phase 71 design-token status colors rather than inventing new ones.
const SERVER_BADGE: Record<ServerStatus, { semantic: string; label: string }> = {
  connected: { semantic: "ok", label: "CONNECTED" },
  error: { semantic: "error", label: "ERROR" },
  unused: { semantic: "idle", label: "UNUSED" },
};

const TOOL_BADGE: Record<ToolStatus, { semantic: string; label: string }> = {
  connected: { semantic: "ok", label: "OK" },
  error: { semantic: "error", label: "ERROR" },
  unused: { semantic: "idle", label: "UNUSED" },
};

function pct(rate: number): string {
  return `${(rate * 100).toFixed(rate > 0 && rate < 0.1 ? 1 : 0)}%`;
}

/* ---- Per-tool health row (MCP-02) + prune chip (MCP-03) ---- */
function ToolRow({
  tool,
  onToggleDisabled,
  pending,
}: {
  tool: ToolHealth;
  onToggleDisabled: (name: string, next: boolean) => void;
  pending: boolean;
}) {
  const badge = TOOL_BADGE[tool.status];
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 transition-colors ${
        tool.disabled
          ? "bg-muted/30 border border-dashed border-border"
          : "bg-background hover:bg-accent/40"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <StatusBadge status={badge.semantic} label={badge.label} />
        <span
          className={`text-base font-mono truncate ${
            tool.disabled ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {tool.name}
        </span>
        {tool.disabled && (
          <span className="text-xs font-mono uppercase tracking-wider text-amber-500 flex-shrink-0">
            pruned
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        {/* MCP-02: last call + error rate */}
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm text-muted-foreground font-mono">
            {tool.lastCallAt
              ? `last ${relativeTime(tool.lastCallAt)}`
              : "never called"}
          </span>
          <span
            className={`text-sm font-mono ${
              tool.errorRate > 0 ? "text-(--status-error)" : "text-muted-foreground"
            }`}
            title={`${tool.errorCount} errors / ${tool.callCount} calls`}
          >
            {tool.callCount} calls · {pct(tool.errorRate)} err
          </span>
        </div>

        {/* MCP-03: prune / disable chip */}
        <button
          type="button"
          disabled={pending}
          onClick={() => onToggleDisabled(tool.name, !tool.disabled)}
          aria-pressed={tool.disabled}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-mono uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            tool.disabled
              ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              : "border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-400"
          }`}
          title={
            tool.disabled
              ? "Re-enable this tool (clears the governance flag)"
              : "Prune: flag this tool as disabled (governance only — Ástríðr enforcement pending)"
          }
        >
          {tool.disabled ? (
            <>
              <CircleCheck className="h-3 w-3" /> Enable
            </>
          ) : (
            <>
              <Ban className="h-3 w-3" /> Prune
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ---- Server group panel (MCP-01) ---- */
function ServerPanel({
  group,
  onToggleDisabled,
  pendingTool,
  defaultOpen,
}: {
  group: ServerGroup;
  onToggleDisabled: (name: string, next: boolean) => void;
  pendingTool: string | null;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const badge = SERVER_BADGE[group.status];

  return (
    <div
      className="bg-card/60 backdrop-blur border border-border/50 rounded-xl overflow-hidden"
      style={{ boxShadow: "0 0 15px rgba(255,255,255,0.02)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="text-base font-mono font-medium text-foreground truncate">
            {group.name}
          </span>
          <StatusBadge status={badge.semantic} label={badge.label} />
          {group.origin && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-(--info)/10 text-(--info) flex-shrink-0">
              {group.origin}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 text-sm font-mono">
          <span className="text-muted-foreground">
            {group.toolCount} tool{group.toolCount !== 1 ? "s" : ""}
          </span>
          {group.errorCount > 0 && (
            <span className="text-(--status-error)">{group.errorCount} err</span>
          )}
          {group.unusedCount > 0 && (
            <span className="text-(--status-warn)">{group.unusedCount} unused</span>
          )}
          {group.disabledCount > 0 && (
            <span className="text-amber-500">{group.disabledCount} pruned</span>
          )}
          <span className="text-muted-foreground/70 hidden md:inline">
            {group.totalCalls} calls
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/50 px-3 py-3 space-y-1.5">
          {group.url && (
            <p className="text-sm font-mono text-muted-foreground px-1 pb-1 truncate">
              {group.url} · seen {formatTimestamp(group.lastSeenAt)}
            </p>
          )}
          {group.tools.length === 0 ? (
            <p className="text-base text-muted-foreground py-4 text-center">
              No tools discovered for this server yet.
            </p>
          ) : (
            group.tools.map((t) => (
              <ToolRow
                key={t.name}
                tool={t}
                onToggleDisabled={onToggleDisabled}
                pending={pendingTool === t.name}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Page body ---- */
function McpInventoryBody() {
  const { mcpServers, tools, edges, governance, loading } =
    useMcpHealthSources();
  const setToolDisabled = useSetToolDisabled();
  const [pendingTool, setPendingTool] = useState<string | null>(null);

  const model = useMemo(
    () => buildMcpHealth({ mcpServers, tools, edges, governance }),
    [mcpServers, tools, edges, governance],
  );

  const handleToggle = async (name: string, next: boolean) => {
    setPendingTool(name);
    try {
      // Optimistic intent: the Convex subscription re-derives the model the
      // moment the mutation lands, so we just clear the pending state after.
      await setToolDisabled({ toolName: name, disabled: next });
    } finally {
      setPendingTool(null);
    }
  };

  if (loading) {
    return (
      <div className="h-[400px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
        <div className="flex items-center gap-3 text-primary/70 font-mono text-base">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading MCP inventory...
        </div>
      </div>
    );
  }

  const { servers, stats } = model;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="MCP Servers" value={stats.serverCount} />
        <MetricCard
          label="Connected"
          value={stats.connectedServers}
          severity="info"
        />
        <MetricCard
          label="Errored"
          value={stats.erroredServers}
          severity={stats.erroredServers > 0 ? "error" : "default"}
        />
        <MetricCard label="MCP Tools" value={stats.mcpToolCount} />
        <MetricCard
          label="Unused Tools"
          value={stats.unusedTools}
          severity={stats.unusedTools > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Pruned"
          value={stats.disabledTools}
          severity={stats.disabledTools > 0 ? "warning" : "default"}
        />
      </div>

      {/* Ástríðr enforcement caveat (MCP-03 follow-up) */}
      {stats.disabledTools > 0 && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <p className="text-sm font-mono leading-relaxed text-muted-foreground">
            <span className="text-foreground">
              {stats.disabledTools} tool{stats.disabledTools !== 1 ? "s" : ""}{" "}
              flagged as pruned.
            </span>{" "}
            Governance flags are persisted in CodePulse, but enforcement (Ástríðr
            refusing to load a disabled tool) requires an agent-side endpoint that
            does not exist yet — tracked as a follow-up.
          </p>
        </div>
      )}

      {/* Server groups */}
      {servers.length === 0 ? (
        <div className="bg-card border border-border rounded-xl px-4 py-10 text-center">
          <Network className="h-6 w-6 text-primary/40 mx-auto mb-2" />
          <p className="text-base text-muted-foreground font-mono">
            No MCP servers registered.
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Servers and their tools appear here once Ástríðr reports its
            capability inventory.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((g, i) => (
            <ServerPanel
              key={g.serverId}
              group={g}
              onToggleDisabled={handleToggle}
              pendingTool={pendingTool}
              // Auto-expand the first server and any that need attention.
              defaultOpen={i === 0 || g.status !== "connected"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function McpInventory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          MCP Inventory & Health
          <InfoTooltip text="Every MCP server and the tools it hosts, with per-tool health (last call, error rate) derived from callGraphEdges. Prune chips flag tools as disabled — a CodePulse governance flag; Ástríðr enforcement is a follow-up." />
        </h1>
        <p className="text-sm text-muted-foreground font-mono mt-1">
          Server → tool health from mcpServers · discoveredTools · callGraphEdges
        </p>
      </div>

      <SectionErrorBoundary name="MCP Inventory">
        <McpInventoryBody />
      </SectionErrorBoundary>
    </div>
  );
}
