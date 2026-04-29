import { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePromptAssembly, usePromptTrend } from "../hooks/usePromptAssembly";

const COMPONENT_COLORS: Record<string, string> = {
  soul: "#8b5cf6",
  behavior: "#6366f1",
  userProfile: "#3b82f6",
  briefingPrefs: "#f59e0b",
  memoryContext: "#10b981",
  profileContext: "#6b7280",
  googleWorkspace: "#64748b",
  toolNames: "#06b6d4",
  agentRoster: "#ec4899",
  skillInstructions: "#84cc16",
};

const COMPONENT_LABELS: Record<string, string> = {
  soul: "Soul",
  behavior: "Behavior",
  userProfile: "User Profile",
  briefingPrefs: "Briefing Prefs",
  memoryContext: "Memory",
  profileContext: "Profile",
  googleWorkspace: "Google WS",
  toolNames: "Tools",
  agentRoster: "Agent Roster",
  skillInstructions: "Skills",
};

const COMPONENT_KEYS = Object.keys(COMPONENT_COLORS);

function PromptBudgetPanelInner() {
  const recent = usePromptAssembly(20);
  const trend = usePromptTrend(30);

  // suppress unused-var lint — trend data reserved for trend line chart in future iteration
  void trend;

  const latest = recent[0];

  const barData = latest
    ? COMPONENT_KEYS.map((key) => ({
        name: COMPONENT_LABELS[key] ?? key,
        tokens: (latest as any)[key] ?? 0,
        fill: COMPONENT_COLORS[key],
      })).filter((d) => d.tokens > 0)
    : [];

  return (
    <div className="space-y-4">
      {/* Current breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Current Assembly
          {latest && (
            <span className="ml-2 text-indigo-400 font-mono">
              {latest.totalTokens.toLocaleString()} tokens
            </span>
          )}
        </h3>
        {barData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#d1d5db" }}
                formatter={(value) => [`${value} tokens`, ""]}
              />
              <Bar dataKey="tokens" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-gray-500">No prompt assembly data yet.</p>
        )}
      </div>

      {/* Component table */}
      {latest && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Component Breakdown
          </h3>
          <div className="space-y-1">
            {barData.map((item) => {
              const pct = latest.totalTokens > 0
                ? ((item.tokens / latest.totalTokens) * 100).toFixed(1)
                : "0";
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 font-mono">{item.tokens}</span>
                    <span className="text-gray-500 w-12 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const PromptBudgetPanel = memo(PromptBudgetPanelInner);
export default PromptBudgetPanel;
