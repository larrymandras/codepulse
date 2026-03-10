import { useIntegrationHealth } from "../hooks/useIntegrationHealth";

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

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Integration Health
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
            {statusBadge(health[integration.key])}
          </div>
        ))}
      </div>
    </div>
  );
}
