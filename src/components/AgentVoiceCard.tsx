/**
 * AgentVoiceCard — War Room agent card with speaking ring animation.
 *
 * Wraps AgentAvatar without modifying it. Adds a speaking ring overlay
 * using CSS custom properties (--speaking-ring, --speaking-ring-glow).
 *
 * Phase 72, Plan 03: D-03
 */

import { useReducedMotion } from "motion/react";
import AgentAvatar from "@/components/AgentAvatar";
import { GlassPanel } from "@/components/GlassPanel";
import { Badge } from "@/components/ui/badge";

export interface AgentVoiceCardProps {
  profileId: string;
  name: string;
  avatar?: { name: string; emoji?: string; color?: string } | null;
  roleBadge: string;
  currentTask?: string;
  joinDurationMs?: number;
  isSpeaking: boolean;
}

function formatJoinDuration(ms?: number): string {
  if (!ms || ms <= 0) return "";
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  return `${minutes}m`;
}

export function AgentVoiceCard({
  name,
  avatar,
  roleBadge,
  currentTask,
  joinDurationMs,
  isSpeaking,
}: AgentVoiceCardProps) {
  const shouldReduce = useReducedMotion();

  return (
    <GlassPanel className="min-h-[160px] p-4 rounded-xl">
      <div className="flex flex-col items-center text-center">
        {/* Avatar with speaking ring overlay */}
        <div className="relative inline-block">
          <AgentAvatar
            avatar={avatar ?? { name }}
            status={isSpeaking ? "working" : "active"}
            size="lg"
          />
          {isSpeaking && !shouldReduce && (
            <div className="absolute inset-0 rounded-full ring-2 ring-[var(--speaking-ring)] shadow-[0_0_12px_var(--speaking-ring-glow)] ping-indicator pointer-events-none" />
          )}
          {isSpeaking && shouldReduce && (
            <div className="absolute inset-0 rounded-full ring-2 ring-[var(--speaking-ring)] pointer-events-none" />
          )}
        </div>

        {/* Name */}
        <p className="text-sm font-semibold mt-2">{name}</p>

        {/* Role badge */}
        <Badge variant="secondary" className="mt-1">
          {roleBadge}
        </Badge>

        {/* Current task */}
        {currentTask && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {currentTask}
          </p>
        )}

        {/* Join duration and speaking state */}
        <div className="flex items-center gap-2 mt-2">
          {joinDurationMs != null && joinDurationMs > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatJoinDuration(joinDurationMs)}
            </span>
          )}
          <span className="text-xs">
            {isSpeaking ? "Speaking" : "Listening"}
          </span>
        </div>
      </div>
    </GlassPanel>
  );
}
