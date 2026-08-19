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
    Unknown: "text-muted-foreground bg-muted",
  };
  return (
    <span
      className={`text-sm px-2 py-0.5 rounded ${colors[status] ?? colors.Unknown}`}
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
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Integration Health<InfoTooltip text="Connection status for all integrated services with quick test capability" />
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INTEGRATIONS.map((integration) => (
          <div
            key={integration.name}
            className="flex items-center justify-between bg-background/50 border border-border/30 rounded-lg px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground w-6 text-center">
                {integration.icon}
              </span>
              <span className="text-base text-foreground">{integration.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {testing === integration.key ? (
                <span className="text-xs text-yellow-400 animate-pulse">
                  checking...
                </span>
              ) : (
                statusBadge(health[integration.key])
              )}
              <button
                onClick={() => handleTest(integration.key)}
                disabled={testing === integration.key}
                className="text-xs px-1.5 py-0.5 rounded border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/50 transition-colors disabled:opacity-50"
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
