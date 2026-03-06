import MetricCard from "../components/MetricCard";
import McpServerPanel from "../components/McpServerPanel";
import PluginPanel from "../components/PluginPanel";
import DiscoveredToolsTable from "../components/DiscoveredToolsTable";
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

function changeTypeColor(key: string, oldVal: any, newVal: any): string {
  if (oldVal === undefined || oldVal === null) return "text-green-400";
  if (newVal === undefined || newVal === null) return "text-red-400";
  return "text-yellow-400";
}

function changeTypeLabel(oldVal: any, newVal: any): string {
  if (oldVal === undefined || oldVal === null) return "added";
  if (newVal === undefined || newVal === null) return "removed";
  return "modified";
}

export default function Capabilities() {
  const summary = useCapabilitySummary();
  const configChanges = useConfigChanges(30);
  const servers = useMcpServers();
  const plugins = usePlugins();
  const skills = useSkills();
  const hooks = useHooks();
  const tools = useDiscoveredTools();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Capabilities Registry</h1>

      {/* 1. Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label="MCP Servers" value={summary?.mcpServers ?? 0} />
        <MetricCard label="Plugins" value={summary?.plugins ?? 0} />
        <MetricCard label="Skills" value={summary?.skills ?? 0} />
        <MetricCard label="Tools" value={summary?.tools ?? 0} />
        <MetricCard label="Hooks" value={summary?.hooks ?? 0} />
        <MetricCard label="Commands" value={summary?.slashCommands ?? 0} />
      </div>

      {/* 2. Config Change Feed */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Configuration Changes
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
      <McpServerPanel servers={servers} />

      {/* 4. Plugins */}
      <PluginPanel plugins={plugins} />

      {/* 5. Skills & Hooks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Skills */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Skills</h2>
          {skills.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No skills registered
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {skills.map((s: any) => (
                <div
                  key={s._id}
                  className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-200">
                      {s.name}
                    </span>
                    {s.source && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-400">
                        {s.source}
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      {s.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hooks */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Hooks</h2>
          {hooks.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No hooks registered
            </p>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-xs text-gray-500 uppercase px-3 py-2">
                      Hook Type
                    </th>
                    <th className="text-xs text-gray-500 uppercase px-3 py-2">
                      Command
                    </th>
                    <th className="text-xs text-gray-500 uppercase px-3 py-2">
                      Matcher
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hooks.map((h: any) => (
                    <tr
                      key={h._id}
                      className="border-b border-gray-800/30"
                    >
                      <td className="px-3 py-2 text-xs font-mono text-purple-400">
                        {h.hookType}
                      </td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-200 truncate max-w-[200px]">
                        {h.command}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {h.matcher ?? "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6. Discovered Tools */}
      <DiscoveredToolsTable tools={tools} />
    </div>
  );
}
