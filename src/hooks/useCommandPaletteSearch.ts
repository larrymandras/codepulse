import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface PaletteAgent { id: string; name: string }
export interface PaletteSession { id: string; label: string }
export interface PaletteAlert { id: string; title: string }
export interface PaletteCronJob { id: string; name: string }
export interface PaletteLink { id: string; title: string; url: string }

export function useCommandPaletteSearch() {
  // Live Convex subscriptions — always up-to-date (avoids stale data)
  const agentsRaw = useQuery(api.agents.listAll) ?? [];
  const alertsRaw = useQuery(api.alerts.listAll, {}) ?? [];
  // Sessions: use most recent 20 for palette (not entire history)
  const sessionsRaw = useQuery(api.sessions.listAll, {}) ?? [];
  // Cron jobs: per D-01/D-03, cron jobs are a searchable entity type
  // recentCrons returns individual cron execution records with jobName field
  const cronRaw = useQuery(api.automation.recentCrons, {}) ?? [];
  // Phase 117 D-05: Bifröst links join this existing aggregation seam rather
  // than getting their own palette plumbing. Not sliced — the hub is curated by
  // hand and is expected to stay small, unlike the telemetry sets above.
  // SWEEP-01 guard (2026-08-25): this subscription is SHELL-LEVEL — the palette
  // is rendered unconditionally by DashboardLayout, so it runs on every route.
  // `api.bifrost.list` is now bounded and returns `{links, truncated}`.
  const linksRaw = useQuery(api.bifrost.list)?.links ?? [];

  const agents: PaletteAgent[] = (agentsRaw as any[]).slice(0, 20).map((a) => ({
    id: a._id,
    name: a.agentId || a.name || "Unknown Agent",
  }));

  const sessions: PaletteSession[] = (sessionsRaw as any[]).slice(0, 20).map((s) => ({
    id: s._id,
    label: s.sessionId ? `Session ${s.sessionId.slice(0, 8)}` : `Session ${s._id.slice(0, 8)}`,
  }));

  const alerts: PaletteAlert[] = (alertsRaw as any[]).slice(0, 20).map((a) => ({
    id: a._id,
    title: a.message || a.title || "Alert",
  }));

  // Deduplicate cron jobs by jobName — palette shows unique job names, not every execution
  const seenCronNames = new Set<string>();
  const cronJobs: PaletteCronJob[] = [];
  for (const c of cronRaw as any[]) {
    const name = c.jobName || c.name || "Cron Job";
    if (!seenCronNames.has(name)) {
      seenCronNames.add(name);
      cronJobs.push({ id: c._id ?? name, name });
    }
    if (cronJobs.length >= 20) break;
  }

  const links: PaletteLink[] = (linksRaw as any[]).map((l) => ({
    id: l._id,
    title: l.title,
    url: l.url,
  }));

  return { agents, sessions, alerts, cronJobs, links };
}
