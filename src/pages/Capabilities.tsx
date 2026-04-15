import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import MetricCard from "../components/MetricCard";
import McpServerPanel from "../components/McpServerPanel";
import PluginPanel from "../components/PluginPanel";
import DiscoveredToolsTable from "../components/DiscoveredToolsTable";
import CommandCatalogPanel from "../components/CommandCatalogPanel";
import InfoTooltip from "../components/InfoTooltip";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { CommandTryItForm } from "../components/CommandTryItForm";
import { formatTimestamp } from "../lib/formatters";
import {
  useCapabilitySummary,
  useConfigChanges,
  useMcpServers,
  usePlugins,
  useSkills,
  useHooks,
  useDiscoveredTools,
} from "../hooks/useCapabilities";
import { useCommandCatalog } from "../hooks/useCommandCatalog";
import { useAstridrWS } from "../contexts/AstridrWSContext";

function changeTypeColor(_key: string, oldVal: any, newVal: any): string {
  if (oldVal === undefined || oldVal === null) return "text-green-400";
  if (newVal === undefined || newVal === null) return "text-red-400";
  return "text-yellow-400";
}

function changeTypeLabel(oldVal: any, newVal: any): string {
  if (oldVal === undefined || oldVal === null) return "added";
  if (newVal === undefined || newVal === null) return "removed";
  return "modified";
}

/* ---- Expandable Skills Section ---- */
function SkillsPanel({
  skills,
  filter,
}: {
  skills: any[];
  filter?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(filter) ||
          (s.description ?? "").toLowerCase().includes(filter) ||
          (s.source ?? "").toLowerCase().includes(filter)
      )
    : skills;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Skills
        <span className="ml-2 text-xs text-gray-500 font-normal">{filtered.length}</span>
        <InfoTooltip text="Composed multi-step workflows like code generation, PR management, and web search. Click to expand." />
      </h2>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          {filter ? "No skills match your search" : "No skills registered"}
        </p>
      ) : (
        <div className="space-y-1 max-h-[420px] overflow-y-auto">
          {filtered.map((s: any) => {
            const isExpanded = expandedId === s._id;
            return (
              <div key={s._id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : s._id)}
                  className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono text-gray-200 truncate">
                      {s.name}
                    </span>
                    {s.source && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 flex-shrink-0">
                        {s.source}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {s.description && (
                      <span className="text-xs text-gray-500 truncate max-w-[200px] hidden md:inline">
                        {s.description}
                      </span>
                    )}
                    <span className="text-gray-600 text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-5 mt-1 mb-2 bg-gray-900/80 border border-gray-700/40 rounded-lg px-4 py-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div>
                        <span className="text-gray-500">Name</span>
                        <p className="text-gray-200 font-mono">{s.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Source / Category</span>
                        <p className="text-gray-300">{s.source ?? "N/A"}</p>
                      </div>
                      {s.description && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Description</span>
                          <p className="text-gray-300">{s.description}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Discovered</span>
                        <p className="text-gray-300 font-mono">{formatTimestamp(s.discoveredAt)}</p>
                      </div>
                      {s.lastUsedAt && (
                        <div>
                          <span className="text-gray-500">Last Used</span>
                          <p className="text-gray-300 font-mono">{formatTimestamp(s.lastUsedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---- Expandable Hooks Section ---- */
function HooksPanel({
  hooks,
  filter,
}: {
  hooks: any[];
  filter?: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter
    ? hooks.filter(
        (h) =>
          (h.hookType ?? "").toLowerCase().includes(filter) ||
          (h.command ?? "").toLowerCase().includes(filter) ||
          (h.matcher ?? "").toLowerCase().includes(filter)
      )
    : hooks;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Hooks
        <span className="ml-2 text-xs text-gray-500 font-normal">{filtered.length}</span>
        <InfoTooltip text="Event-driven shell hooks that fire before/after tool use, on prompt submit, etc. Click to see full command." />
      </h2>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          {filter ? "No hooks match your search" : "No hooks registered"}
        </p>
      ) : (
        <div className="space-y-1 max-h-[420px] overflow-y-auto">
          {filtered.map((h: any) => {
            const isExpanded = expandedId === h._id;
            return (
              <div key={h._id}>
                <div
                  onClick={() => setExpandedId(isExpanded ? null : h._id)}
                  className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-purple-400 flex-shrink-0">
                      {h.hookType}
                    </span>
                    <span className="text-xs font-mono text-gray-300 truncate">
                      {h.command}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {h.matcher && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                        {h.matcher}
                      </span>
                    )}
                    <span className="text-gray-600 text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-5 mt-1 mb-2 bg-gray-900/80 border border-gray-700/40 rounded-lg px-4 py-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div>
                        <span className="text-gray-500">Hook Type</span>
                        <p className="text-purple-400 font-mono">{h.hookType}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Matcher</span>
                        <p className="text-gray-300 font-mono">{h.matcher ?? "All (no filter)"}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Command</span>
                        <pre className="mt-1 text-[11px] text-gray-300 bg-gray-950/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                          {h.command}
                        </pre>
                      </div>
                      <div>
                        <span className="text-gray-500">Registered</span>
                        <p className="text-gray-300 font-mono">{formatTimestamp(h.registeredAt)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Capabilities() {
  const summary = useCapabilitySummary();
  const configChanges = useConfigChanges(30);
  const servers = useMcpServers();
  const plugins = usePlugins();
  const skills = useSkills();
  const hooks = useHooks();
  const tools = useDiscoveredTools();
  const { commands: catalogCommands, status: catalogStatus, error: catalogError } = useCommandCatalog();
  const { status: wsStatus } = useAstridrWS();

  const [search, setSearch] = useState("");
  const [tryCommand, setTryCommand] = useState<string | null>(null);
  const filter = search.toLowerCase().trim() || undefined;

  // Deep linking: ?try=<commandName> from CommandPalette
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const tryName = searchParams.get("try");
    if (tryName) setTryCommand(tryName);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Capabilities Registry</h1>
        {/* Global search */}
        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools, skills, commands..."
            className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-1.5 pl-8 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-colors"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* 1. Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard label="MCP Servers" value={summary?.mcpServers ?? 0} />
        <MetricCard label="Plugins" value={summary?.plugins ?? 0} />
        <MetricCard label="Skills" value={summary?.skills ?? 0} />
        <MetricCard label="Tools" value={summary?.tools ?? 0} />
        <MetricCard label="Hooks" value={summary?.hooks ?? 0} />
        <MetricCard label="Commands" value={catalogStatus === "ready" ? catalogCommands.length : 0} />
      </div>

      {/* 2. Config Change Feed */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Configuration Changes
          <InfoTooltip text="Tracks additions, removals, and modifications to your registry — MCP servers, plugins, skills, and hooks." />
        </h2>
        {configChanges.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No configuration changes detected
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {configChanges.map((c: any, i: number) => {
              const type = changeTypeLabel(c.oldValue, c.newValue);
              const color = changeTypeColor(c.configKey, c.oldValue, c.newValue);
              const detail =
                type === "removed"
                  ? String(c.oldValue)
                  : String(c.newValue);
              const truncated =
                detail.length > 60 ? detail.slice(0, 57) + "..." : detail;

              return (
                <div
                  key={c._id ?? i}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-xs ${
                    i % 2 === 0 ? "bg-gray-800/30" : ""
                  }`}
                >
                  <span className="text-gray-600 font-mono whitespace-nowrap">
                    {formatTimestamp(c.changedAt)}
                  </span>
                  <span className="text-gray-200 font-mono truncate max-w-[160px]">
                    {c.configKey}
                  </span>
                  <span className={`${color} capitalize flex-shrink-0`}>
                    {type}
                  </span>
                  <span className="text-gray-500 truncate">{truncated}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. MCP Servers */}
      <McpServerPanel servers={servers} filter={filter} />

      {/* 4. Plugins */}
      <PluginPanel plugins={plugins} filter={filter} />

      {/* 5. Skills & Hooks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkillsPanel skills={skills} filter={filter} />
        <HooksPanel hooks={hooks} filter={filter} />
      </div>

      {/* 6. Discovered Tools */}
      <DiscoveredToolsTable tools={tools} filter={filter} />

      {/* 7. Commands (WebSocket catalog) */}
      {wsStatus === "disconnected" && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-400">
          WebSocket disconnected. Command execution unavailable. Reconnecting...
        </div>
      )}

      {catalogStatus === "ready" && catalogCommands.length === 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-6 text-center text-sm text-gray-500">
          No commands registered. Connect to Astridr WebSocket to load the command registry.
        </div>
      )}

      <CommandCatalogPanel
        commands={catalogCommands}
        filter={filter}
        status={catalogStatus}
        error={catalogError}
        tryCommand={tryCommand}
        onTryCommand={setTryCommand}
        renderTryItForm={(cmd) => (
          <SectionErrorBoundary name="Try It">
            <CommandTryItForm
              commandName={cmd.name}
              schema={cmd.inputSchema as Record<string, unknown> | undefined}
              onClose={() => setTryCommand(null)}
            />
          </SectionErrorBoundary>
        )}
      />
    </div>
  );
}
