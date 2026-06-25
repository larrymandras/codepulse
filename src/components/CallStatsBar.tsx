/**
 * CallStatsBar — 4-cell metric grid for call statistics.
 * Used in Meeting Bot call detail and War Room active call views.
 *
 * Phase 72, Plan 02: D-09
 */

import { GlassPanel } from "@/components/GlassPanel";
import MetricCard from "@/components/MetricCard";

export interface CallStatsBarProps {
  durationMs?: number;
  participantCount?: number;
  wordCount?: number;
  costUsd?: number;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function CallStatsBar({
  durationMs,
  participantCount,
  wordCount,
  costUsd,
}: CallStatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <GlassPanel className="rounded-xl hover:scale-[1.01] transition-transform duration-300">
        <MetricCard
          label="Duration"
          value={formatDuration(durationMs ?? 0)}
          numericValue={Math.floor((durationMs ?? 0) / 1000)}
          format={(v) => formatDuration(v * 1000)}
        />
      </GlassPanel>
      <GlassPanel className="rounded-xl hover:scale-[1.01] transition-transform duration-300">
        <MetricCard
          label="Participants"
          value={String(participantCount ?? 0)}
          numericValue={participantCount ?? 0}
        />
      </GlassPanel>
      <GlassPanel className="rounded-xl hover:scale-[1.01] transition-transform duration-300">
        <MetricCard
          label="Words"
          value={String(wordCount ?? 0)}
          numericValue={wordCount ?? 0}
        />
      </GlassPanel>
      <GlassPanel className="rounded-xl hover:scale-[1.01] transition-transform duration-300">
        <MetricCard
          label="Cost"
          value={`$${(costUsd ?? 0).toFixed(2)}`}
          numericValue={costUsd ?? 0}
          format={(v) => `$${v.toFixed(2)}`}
        />
      </GlassPanel>
    </div>
  );
}
