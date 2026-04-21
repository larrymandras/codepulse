import AgentAvatar from "@/components/AgentAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import type { RosterAgent } from "@/hooks/useRosterAgents";

interface AgentCardProps {
  agent: RosterAgent;
  onClick: () => void;
}

const TIER_GRADIENT: Record<string, string> = {
  command: "bg-gradient-to-r from-purple-600 to-purple-700",
  domain: "bg-gradient-to-r from-blue-600 to-blue-700",
  shared: "bg-gradient-to-r from-gray-600 to-gray-700",
};

const TIER_BADGE_COLOR: Record<string, string> = {
  command: "bg-purple-600 text-white",
  domain: "bg-blue-600 text-white",
  shared: "bg-gray-600 text-white",
};

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const isPending = agent.status === "pending";
  const avatarStatus =
    agent.status === "active"
      ? "active"
      : agent.status === "pending"
        ? "working"
        : "idle";

  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-lg overflow-hidden cursor-pointer transition-colors hover:border-accent/50 ${
        isPending
          ? "border border-dashed border-amber-500/50"
          : "border border-border"
      }`}
    >
      {/* Gradient header strip */}
      <div
        className={`h-6 ${TIER_GRADIENT[agent.tier] ?? TIER_GRADIENT.shared}`}
      />

      {/* Content */}
      <div className="flex flex-col items-center px-4 pb-4">
        {/* Avatar overlapping header */}
        <div className="-mt-3">
          <AgentAvatar
            avatar={{ name: agent.name }}
            status={avatarStatus as "active" | "working" | "idle"}
            size="md"
          />
        </div>

        {/* Name */}
        <p
          className={`text-sm font-semibold mt-2 truncate max-w-full ${
            isPending ? "text-[var(--status-warn)]" : "text-foreground"
          }`}
        >
          {agent.name}
        </p>

        {/* Description */}
        {agent.description && (
          <p className="text-xs text-muted-foreground truncate max-w-full">
            {agent.description}
          </p>
        )}

        {/* Badge row */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0 ${TIER_BADGE_COLOR[agent.tier] ?? TIER_BADGE_COLOR.shared}`}
          >
            {agent.tier}
          </Badge>
          <StatusBadge status={agent.status} />
          {agent.budget_fraction > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {Math.round(agent.budget_fraction * 100)}%
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentCard;
