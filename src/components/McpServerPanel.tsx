import { formatTimestamp } from "../lib/formatters";

interface McpServerPanelProps {
  servers: any[];
}

function statusDot(status: string): string {
  switch (status) {
    case "connected":
      return "bg-green-400";
    case "configured":
      return "bg-yellow-400";
    default:
      return "bg-red-400";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "connected":
      return "text-green-400";
    case "configured":
      return "text-yellow-400";
    default:
      return "text-red-400";
  }
}

export default function McpServerPanel({ servers }: McpServerPanelProps) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">MCP Servers</h2>
      {servers.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No MCP servers registered
        </p>
      ) : (
        <div className="space-y-1">
          {servers.map((s: any) => (
            <div
              key={s._id}
              className="flex items-center justify-between bg-gray-900/50 rounded-lg px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(s.status)}`}
                />
                <span className="text-sm font-mono text-gray-200">
                  {s.name}
                </span>
                <span
                  className={`text-xs capitalize ${statusLabel(s.status)}`}
                >
                  {s.status}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {s.toolCount != null && (
                  <span className="text-xs text-gray-400">
                    {s.toolCount} tool{s.toolCount !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="text-xs text-gray-500 font-mono">
                  {formatTimestamp(s.lastSeenAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
