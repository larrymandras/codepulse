/**
 * CallStatsBar — 4-cell metric grid for call statistics.
 * Used in Meeting Bot call detail and War Room active call views.
 *
 * Phase 72, Plan 02: D-09
 */

import { GlassPanel } from "@/components/GlassPanel";
import MetricCard from "@/components/MetricCard";
import type { MetricState } from "@/lib/metricState";

export interface CallStatsBarProps {
  durationMs?: number;
  participantCount?: number;
  wordCount?: number;
  costUsd?: number;
  /**
   * D-14: the caller declares what it knows. Defaults to "ready" because
   * this component's only caller (MeetingBot.tsx) only renders it once
   * `selectedCall` is truthy -- a row found in an already-resolved
   * `useQuery(...) ?? []` result, so by construction the row this component
   * is fed is never mid-load.
   */
  state?: MetricState;
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
  state = "ready",
}: CallStatsBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <GlassPanel className="rounded-xl">
        <MetricCard
          label="Duration"
          value={formatDuration(durationMs ?? 0)}
          numericValue={Math.floor((durationMs ?? 0) / 1000)}
          format={(v) => formatDuration(v * 1000)}
          state={state}
        />
      </GlassPanel>
      <GlassPanel className="rounded-xl">
        <MetricCard
          label="Participants"
          value={String(participantCount ?? 0)}
          numericValue={participantCount ?? 0}
          state={state}
        />
      </GlassPanel>
      <GlassPanel className="rounded-xl">
        <MetricCard
          label="Words"
          value={String(wordCount ?? 0)}
          numericValue={wordCount ?? 0}
          state={state}
        />
      </GlassPanel>
      <GlassPanel className="rounded-xl">
        <MetricCard
          label="Cost"
          value={`$${(costUsd ?? 0).toFixed(2)}`}
          numericValue={costUsd ?? 0}
          format={(v) => `$${v.toFixed(2)}`}
          state={state}
        />
      </GlassPanel>
    </div>
  );
}
