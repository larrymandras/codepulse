/**
 * GraphsHub — Unified Graphs Hub page (Phase 84, GH-03).
 *
 * Route: /graphs
 *
 * Composes three live summary tiles (Tool Galaxy, MCP Inventory, KG Explorer)
 * above the CodeVaultGraph hero. Follows the HivePage thin-composition pattern.
 * Each tile and the hero are independently wrapped in SectionErrorBoundary so
 * a single surface failure does not take down the page (D-12 — tiles are
 * independent of the snapshot state).
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Network } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { GlassPanel } from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import InfoTooltip from "../components/InfoTooltip";
import { CodeVaultGraph } from "../components/graph/CodeVaultGraph";
import { useToolGalaxySources } from "../hooks/useToolGalaxy";
import { useMcpHealthSources } from "../hooks/useMcpHealth";
import { useKgSummary } from "../hooks/useKgSummary";
import { buildGalaxy } from "../lib/tool-galaxy";

// ---------------------------------------------------------------------------
// Sub-components — each tile is its own small component so the hook and
// SectionErrorBoundary scope are self-contained.
// ---------------------------------------------------------------------------

function ToolGalaxyTile() {
  const navigate = useNavigate();
  const { tools, mcpServers, edges, kits } = useToolGalaxySources();

  const stats = useMemo(
    () =>
      buildGalaxy({
        tools,
        mcpServers,
        edges,
        kits,
        agentFilter: null,
        mcpFilter: null,
        now: Date.now() / 1000,
      }).stats,
    [tools, mcpServers, edges, kits]
  );

  return (
    <MetricCard
      label="TOOL GALAXY"
      value={`${stats.toolCount} tools · ${stats.orphanCount} orphans`}
      onClick={() => navigate("/tool-galaxy")}
    />
  );
}

function McpInventoryTile() {
  const navigate = useNavigate();
  const { mcpServers } = useMcpHealthSources();

  const serverCount = mcpServers.length;
  const errorCount = mcpServers.filter((s) => s.status === "error").length;

  return (
    <MetricCard
      label="MCP INVENTORY"
      value={`${serverCount} servers · ${errorCount} errors`}
      onClick={() => navigate("/mcp-inventory")}
    />
  );
}

function KgExplorerTile() {
  const navigate = useNavigate();
  const { summary } = useKgSummary();

  const entities = summary?.totalEntities ?? 0;
  const triples = summary?.currentTripleCount ?? 0;

  return (
    <MetricCard
      label="KG EXPLORER"
      value={`${entities} entities · ${triples} triples`}
      onClick={() => navigate("/knowledge-graph")}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GraphsHub() {
  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xs font-mono uppercase tracking-widest font-bold text-primary flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          GRAPHS HUB
          <InfoTooltip text="Ástríðr's code, vault, and tool graphs — unified. The hero below shows the nightly graphify + Obsidian snapshot." />
        </h1>
      </div>

      {/* Summary tile row — three independent tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SectionErrorBoundary name="Tool Galaxy tile">
          <ToolGalaxyTile />
        </SectionErrorBoundary>
        <SectionErrorBoundary name="MCP Inventory tile">
          <McpInventoryTile />
        </SectionErrorBoundary>
        <SectionErrorBoundary name="KG Explorer tile">
          <KgExplorerTile />
        </SectionErrorBoundary>
      </div>

      {/* Code/Vault Graph hero */}
      <SectionErrorBoundary name="Code/Vault Graph">
        <GlassPanel className="rounded-xl">
          <CodeVaultGraph />
        </GlassPanel>
      </SectionErrorBoundary>
    </div>
  );
}
