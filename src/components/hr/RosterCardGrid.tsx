import { AgentCard } from "@/components/hr/AgentCard";
import type { RosterAgent } from "@/hooks/useRosterAgents";

interface RosterCardGridProps {
  agents: RosterAgent[];
  onAgentClick: (agentId: string) => void;
}

export function RosterCardGrid({ agents, onAgentClick }: RosterCardGridProps) {
  if (agents.length === 0) {
    return (
      <p className="text-base text-muted-foreground text-center py-12">
        No agents match your search.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onClick={() => onAgentClick(agent.id)}
        />
      ))}
    </div>
  );
}

export default RosterCardGrid;
