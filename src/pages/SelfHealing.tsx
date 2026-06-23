import { useState, useEffect } from "react";
import MetricCard from "../components/MetricCard";
import ComponentHealthGrid from "../components/ComponentHealthGrid";
import RecoveryTimeline from "../components/RecoveryTimeline";
import VersionHistory from "../components/VersionHistory";
import RecoveryCommits from "../components/RecoveryCommits";
import RecentGitActivity from "../components/RecentGitActivity";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import {
  useComponentHealth,
  useRecentRecoveries,
  useUptimeStats,
  useVersionHistory,
} from "../hooks/useSelfHealing";

type SelfHealingEventPayload = {
  id?: string;
  component?: string;
  action?: string;
  description?: string;
  timestamp?: number;
  [key: string]: unknown;
};

const ESCALATION_LEVELS = [
  { level: 1, label: "Auto-retry", detail: "3 attempts" },
  { level: 2, label: "Auto-failover", detail: "Switch to backup" },
  { level: 3, label: "Auto-restart", detail: "Service restart" },
  { level: 4, label: "HITL escalation", detail: "Human-in-the-loop" },
  { level: 5, label: "Git commit + version tag", detail: "Permanent fix recorded" },
];

export default function SelfHealing() {
  const components = useComponentHealth();
  const recoveries = useRecentRecoveries();
  const stats = useUptimeStats();
  const versions = useVersionHistory();
  const { subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  // WS-prepended self-healing events overlay on Convex data
  const [wsEvents, setWsEvents] = useState<SelfHealingEventPayload[]>([]);

  useEffect(() => {
    const unsub = subscribeEvent("self_healing", (event) => {
      const data = event.data as SelfHealingEventPayload | undefined;
      if (!data) return;
      const wsEvent: SelfHealingEventPayload = {
        ...data,
        id: (data.id as string | undefined) ?? crypto.randomUUID(),
      };
      setWsEvents((prev) => {
        if (prev.some((e) => e.id === wsEvent.id)) return prev;
        return [wsEvent, ...prev];
      });
      triggerFlash();
    });
    return unsub;
  }, [subscribeEvent, triggerFlash]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Self-Healing</h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Events" value={(stats?.total ?? 0) + wsEvents.length} />
        <MetricCard label="Resolved" value={stats?.resolved ?? 0} trend="up" />
        <MetricCard label="Failed" value={stats?.failed ?? 0} trend="down" />
        <MetricCard label="Pending" value={stats?.pending ?? 0} />
      </div>

      {/* Component Health Grid */}
      <ComponentHealthGrid components={components} />

      {/* Recovery Stats */}
      {stats && Object.keys(stats.actionCounts).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-base font-semibold text-foreground uppercase tracking-wide mb-4">
            Recovery Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(stats.actionCounts).map(([action, count]) => (
              <div
                key={action}
                className="bg-background rounded-lg p-3 text-center"
              >
                <p className="text-lg font-semibold text-foreground">{count}</p>
                <p className="text-sm text-muted-foreground capitalize">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recovery Timeline — WS-enhanced with live prepended events */}
      <SectionErrorBoundary name="Self-Healing Events">
        <div ref={flashRef} className="space-y-4">
          <RecoveryTimeline events={recoveries} />
        </div>
      </SectionErrorBoundary>

      {/* Recovery Commits — git commits tied to self-healing actions */}
      <RecoveryCommits />

      {/* Recent Git Activity — all commits for full picture */}
      <RecentGitActivity />

      {/* Version History */}
      <VersionHistory versions={versions} />

      {/* Escalation Chain */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground uppercase tracking-wide mb-4">
          Escalation Chain
        </h2>
        <div className="space-y-2">
          {ESCALATION_LEVELS.map((esc) => (
            <div
              key={esc.level}
              className="flex items-center gap-3 bg-background rounded-lg px-4 py-2.5"
            >
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground shrink-0">
                {esc.level}
              </span>
              <span className="text-base text-foreground font-medium flex-1">
                {esc.label}
              </span>
              <span className="text-sm text-muted-foreground">{esc.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
