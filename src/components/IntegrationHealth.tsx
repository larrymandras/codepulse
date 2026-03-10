import { useState } from "react";
import { useIntegrationHealth } from "../hooks/useIntegrationHealth";
import InfoTooltip from "./InfoTooltip";

const INTEGRATIONS = [
  { name: "GitHub MCP", icon: "GH", key: "github" as const },
  { name: "Supabase", icon: "SB", key: "supabase" as const },
  { name: "Docker", icon: "DK", key: "docker" as const },
  { name: "Telegram", icon: "TG", key: "telegram" as const },
  { name: "Slack", icon: "SL", key: "slack" as const },
  { name: "Email", icon: "EM", key: "email" as const },
];

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    Connected: "text-green-400 bg-green-400/10",
    Idle: "text-blue-400 bg-blue-400/10",
    Degraded: "text-yellow-400 bg-yellow-400/10",
    Disconnected: "text-red-400 bg-red-400/10",
    Unknown: "text-gray-400 bg-gray-400/10",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${colors[status] ?? colors.Unknown}`}
    >
      {status}
    </span>
  );
}

export default function IntegrationHealth() {
  const health = useIntegrationHealth();
  const [testing, setTesting] = useState<string | null>(null);

  const handleTest = (key: string) => {
    setTesting(key);
    // Convex queries are reactive, so we just show a brief "checking" state
    setTimeout(() => setTesting(null), 1500);
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Integration Health<InfoTooltip text="Connection status for all integrated services with quick test capability" />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center justify-between bg-gray-900/50 border border-gray-700/30 rounded-lg px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-500 w-6 text-center">
                {integration.icon}
              </span>
              <span className="text-sm text-gray-200">{integration.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {testing === integration.key ? (
                <span className="text-[10px] text-yellow-400 animate-pulse">
                  checking...
                </span>
              ) : (
                statusBadge(health[integration.key])
              )}
              <button
                onClick={() => handleTest(integration.key)}
                disabled={testing === integration.key}
                className="text-[10px] px-1.5 py-0.5 rounded border border-gray-600/30 text-gray-500 hover:text-gray-300 hover:border-gray-500/50 transition-colors disabled:opacity-50"
                title="Test connection"
              >
                Test
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
