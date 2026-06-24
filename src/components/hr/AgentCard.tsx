import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AgentAvatar from "@/components/AgentAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Copy } from "lucide-react";
import { cloneAgent } from "@/lib/astridrApi";
import { toast } from "sonner";
import type { RosterAgent } from "@/hooks/useRosterAgents";

interface AgentCardProps {
  agent: RosterAgent;
  onClick: () => void;
}

const TIER_BADGE_COLOR: Record<string, string> = {
  command: "bg-purple-600/20 text-purple-400 border border-purple-500/30",
  domain: "bg-blue-600/20 text-blue-400 border border-blue-500/30",
  shared: "bg-gray-600/20 text-gray-400 border border-gray-500/30",
};

const TIER_GLOW: Record<string, string> = {
  command: "from-purple-600/20",
  domain: "from-blue-600/20",
  shared: "from-gray-600/20",
};

export function AgentCard({ agent, onClick }: AgentCardProps) {
  const navigate = useNavigate();
  const [cloning, setCloning] = useState(false);

  const handleClone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCloning(true);
    try {
      const result = await cloneAgent(agent.id);
      toast.success("Agent cloned");
      navigate(`/hr/onboarding?clone=${result.id}`);
    } catch {
      toast.error("Failed to clone agent");
    } finally {
      setCloning(false);
    }
  };

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
      className={`group bg-card/60 backdrop-blur-md rounded-xl overflow-hidden cursor-pointer transition-all duration-500 relative border ${
        isPending
          ? "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          : "border-border/50 glow-card hover:border-primary/50 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[var(--glow-md)] hover:-translate-y-1.5"
      }`}
    >
      {/* Background ambient tier glow */}
      <div className={`absolute top-0 left-0 w-full h-[150%] pointer-events-none bg-gradient-to-b ${TIER_GLOW[agent.tier] ?? TIER_GLOW.shared} via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500 mix-blend-overlay`} />
      
      {/* Cybernetic grid overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] group-hover:opacity-40 transition-opacity duration-500" />

      {/* Subtle top scanline */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Action Button */}
      <button
        className="absolute right-3 top-3 p-2 rounded-lg bg-background/50 hover:bg-primary/20 hover:text-primary transition-all z-20 opacity-0 group-hover:opacity-100 backdrop-blur-sm border border-border/30 hover:border-primary/50 translate-y-1 group-hover:translate-y-0"
        title="Clone agent blueprint"
        disabled={cloning}
        onClick={handleClone}
      >
        <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </button>

      {/* Main Content */}
      <div className="flex flex-col items-center px-6 pt-8 pb-5 relative z-10">
        
        {/* Avatar Container with glowing rings */}
        <div className="relative group-hover:scale-110 transition-transform duration-500 mb-5">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-[20px] animate-pulse opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-[-4px] rounded-full border border-primary/20 border-dashed opacity-0 group-hover:opacity-100 group-hover:animate-[spin_10s_linear_infinite]" />
          <AgentAvatar
            avatar={agent.avatarData ?? { name: agent.name }}
            status={avatarStatus as "active" | "working" | "idle"}
            size="2xl"
          />
        </div>

        {/* Agent Identity */}
        <h3 className="text-lg font-bold font-mono tracking-widest text-foreground uppercase group-hover:text-primary transition-colors text-center drop-shadow-sm">
          {agent.name}
        </h3>

        {/* Telemetry / Description */}
        <div className="h-12 mt-3 mb-4 flex items-center justify-center w-full">
           <p className="text-xs text-muted-foreground/80 font-mono leading-relaxed text-center line-clamp-2 uppercase tracking-wide group-hover:text-muted-foreground transition-colors">
             {agent.description || "Unassigned Agent Class // No telemetry available"}
           </p>
        </div>

        {/* Footer Metrics */}
        <div className="w-full flex items-center justify-between pt-4 border-t border-border/30">
          <Badge
            variant="outline"
            className={`text-[11px] font-mono tracking-widest uppercase px-2 py-0.5 ${TIER_BADGE_COLOR[agent.tier] ?? TIER_BADGE_COLOR.shared}`}
          >
            {agent.tier}
          </Badge>
          
          <div className="flex items-center gap-3">
            {agent.budget_fraction > 0 && (
              <span className="text-[11px] font-mono tracking-widest text-primary/60 flex items-center gap-1 uppercase">
                <span className="w-1 h-1 rounded-full bg-primary/50" />
                Alloc: {Math.round(agent.budget_fraction * 100)}%
              </span>
            )}
            <StatusBadge status={agent.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentCard;
