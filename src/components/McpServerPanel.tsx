import { useState } from "react";
import { formatTimestamp } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

interface McpServerPanelProps {
  servers: any[];
  filter?: string;
}

function statusDot(status: string): string {
  switch (status) {
    case "connected":
      return "bg-green-400";
    case "discovered":
      return "bg-blue-400";
    case "configured":
      return "bg-yellow-400";
    default:
      return "bg-red-400";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "connected":
      return "text-green-400";
    case "discovered":
      return "text-blue-400";
    case "configured":
      return "text-yellow-400";
    default:
      return "text-red-400";
  }
}

export default function McpServerPanel({ servers, filter }: McpServerPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = filter
    ? servers.filter(
        (s) =>
          s.name.toLowerCase().includes(filter) ||
          s.status.toLowerCase().includes(filter) ||
          (s.url ?? "").toLowerCase().includes(filter)
      )
    : servers;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        MCP Servers
        <span className="ml-2 text-xs text-gray-500 font-normal">{filtered.length}</span>
        <InfoTooltip text="External service integrations exposed via Model Context Protocol. Click a server to see connection details." />
      </h2>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          {filter ? "No servers match your search" : "No MCP servers registered"}
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
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(s.status)}`}
                    />
                    <span className="text-sm font-mono text-gray-200 truncate">
                      {s.name}
                    </span>
                    <span
                      className={`text-xs capitalize flex-shrink-0 ${statusColor(s.status)}`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-2">
                    {s.toolCount != null && (
                      <span className="text-xs text-gray-400">
                        {s.toolCount} tool{s.toolCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-mono">
                      {formatTimestamp(s.lastSeenAt)}
                    </span>
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
                        <span className="text-gray-500">Status</span>
                        <p className={`capitalize ${statusColor(s.status)}`}>{s.status}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">URL</span>
                        <p className="text-gray-300 font-mono truncate">{s.url ?? "Not configured"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Tools Provided</span>
                        <p className="text-gray-300">{s.toolCount ?? "Unknown"}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Last Seen</span>
                        <p className="text-gray-300 font-mono">{formatTimestamp(s.lastSeenAt)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Record ID</span>
                        <p className="text-gray-500 font-mono truncate">{s._id}</p>
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
