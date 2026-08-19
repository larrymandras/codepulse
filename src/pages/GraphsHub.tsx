/**
 * GraphsHub — Unified Graphs Hub page (Phase 84, GH-03).
 *
 * Route: /graphs
 *
 * Composes six live summary tiles (Tool Galaxy, MCP Inventory, KG Explorer,
 * Capabilities, 3D Memory Galaxy, Hive/Swarm) above the CodeVaultGraph hero.
 * Follows the HivePage thin-composition pattern.
 * Each tile and the hero are independently wrapped in SectionErrorBoundary so
 * a single surface failure does not take down the page (D-12 — tiles are
 * independent of the snapshot state).
 */

import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { Network } from "lucide-react";
import { api } from "../../convex/_generated/api";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { GlassPanel } from "../components/GlassPanel";
import MetricCard from "../components/MetricCard";
import InfoTooltip from "../components/InfoTooltip";
import { pluralize } from "../lib/formatters";
import { CodeVaultGraph } from "../components/graph/CodeVaultGraph";
import { useToolGalaxySources } from "../hooks/useToolGalaxy";
import { useMcpHealthSources } from "../hooks/useMcpHealth";
import { useKgSummary } from "../hooks/useKgSummary";
import { useCapabilitySummary } from "../hooks/useCapabilities";
import { useGoalList } from "../hooks/useSwarmGraph";
import { buildGalaxy } from "../lib/tool-galaxy";
import { PageHeader } from "../components/PageHeader";
import { useMetricState } from "../hooks/useMetricState";
import type { MetricState } from "../lib/metricState";

// ---------------------------------------------------------------------------
// Sub-components — each tile is its own small component so the hook and
// SectionErrorBoundary scope are self-contained.
// ---------------------------------------------------------------------------

function ToolGalaxyTile() {
  const navigate = useNavigate();
  const { tools, mcpServers, edges, kits, loading } = useToolGalaxySources();

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

  // D-14: useToolGalaxySources() exposes its own genuine `loading: boolean`.
  return (
    <MetricCard
      label="TOOL GALAXY"
      value={`${pluralize(stats.toolCount, "tool")} · ${pluralize(stats.orphanCount, "orphan")}`}
      onClick={() => navigate("/tool-galaxy")}
      state={loading ? "loading" : "ready"}
    />
  );
}

function McpInventoryTile() {
  const navigate = useNavigate();
  const { mcpServers, loading } = useMcpHealthSources();

  const serverCount = mcpServers.length;
  const errorCount = mcpServers.filter((s) => s.status === "error").length;

  // D-14: useMcpHealthSources() exposes its own genuine `loading: boolean`.
  return (
    <MetricCard
      label="MCP INVENTORY"
      value={`${pluralize(serverCount, "server")} · ${pluralize(errorCount, "error")}`}
      onClick={() => navigate("/mcp-inventory")}
      state={loading ? "loading" : "ready"}
    />
  );
}

function KgExplorerTile() {
  const navigate = useNavigate();
  const { summary, loading } = useKgSummary();

  const entities = summary?.totalEntities ?? 0;
  const triples = summary?.currentTripleCount ?? 0;

  // D-14: `summary === null` means the doc genuinely never arrived (matches
  // KGSummaryCards.tsx's identical "No KG summary telemetry yet" semantics
  // off the same underlying query).
  const state: MetricState = loading ? "loading" : summary === null ? "empty" : "ready";

  return (
    <MetricCard
      label="KG EXPLORER"
      value={`${pluralize(entities, "entity", "entities")} · ${pluralize(triples, "triple")}`}
      onClick={() => navigate("/knowledge-graph")}
      state={state}
    />
  );
}

function CapabilitiesTile() {
  const navigate = useNavigate();
  const summary = useCapabilitySummary();
  const { state } = useMetricState(summary, undefined, {});

  const skills = summary?.skills ?? 0;
  const tools = summary?.tools ?? 0;

  return (
    <MetricCard
      label="CAPABILITIES"
      value={`${pluralize(skills, "skill")} · ${pluralize(tools, "tool")}`}
      onClick={() => navigate("/capabilities")}
      state={state}
    />
  );
}

function MemoryGalaxyTile() {
  const navigate = useNavigate();
  const overview = useQuery(api.memory.overview);
  const { state } = useMetricState(overview, undefined, {});

  const events = overview?.total ?? 0;
  const agents = overview ? Object.keys(overview.byAgent).length : 0;

  return (
    <MetricCard
      label="3D MEMORY GALAXY"
      value={`${pluralize(events, "event")} · ${pluralize(agents, "agent")}`}
      onClick={() => navigate("/memory")}
      state={state}
    />
  );
}

function HiveSwarmTile() {
  const navigate = useNavigate();
  const goals = useGoalList();
  // D-14: useGoalList() collapses `undefined` (loading) into `[]`, so a raw
  // duplicate of the same query (same function + args, shared Convex
  // client cache) recovers the loading signal.
  const goalsRaw = useQuery(api.swarmTasks.listGoals);
  const { state } = useMetricState(goalsRaw, undefined, {});

  return (
    <MetricCard
      label="HIVE / SWARM"
      value={`${pluralize(goals.length, "goal")}`}
      onClick={() => navigate("/hive")}
      state={state}
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
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Graphs Hub
            <InfoTooltip text="Ástríðr's code, vault, and tool graphs — unified. The hero below shows the nightly graphify + Obsidian snapshot." />
          </span>
        }
        icon={Network}
      />

      {/* Summary tile row — six independent tiles, one per graph surface */}
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
        <SectionErrorBoundary name="Capabilities tile">
          <CapabilitiesTile />
        </SectionErrorBoundary>
        <SectionErrorBoundary name="3D Memory Galaxy tile">
          <MemoryGalaxyTile />
        </SectionErrorBoundary>
        <SectionErrorBoundary name="Hive / Swarm tile">
          <HiveSwarmTile />
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
