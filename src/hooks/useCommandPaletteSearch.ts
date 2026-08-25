import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface PaletteAgent { id: string; name: string }
export interface PaletteSession { id: string; label: string }
export interface PaletteAlert { id: string; title: string }
export interface PaletteCronJob { id: string; name: string }
export interface PaletteLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
  // Ranking inputs, carried through so CommandPalette can order and bound the
  // group itself — it needs the live cmdk search state to decide whether the
  // cap applies, and that state does not exist up here.
  pinned?: boolean;
  usageCount?: number;
  lastUsedAt?: number;
  createdAt: number;
}

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
  // than getting their own palette plumbing.
  //
  // Still not sliced HERE, and that is now a decision rather than the original
  // "the hub stays small" assumption — which stopped holding the moment the hub
  // became somewhere to put every link. Ranking and bounding moved into
  // CommandPalette's own Links group (src/lib/bifrostPaletteRank.ts) because the
  // cap must lift while the operator is typing, and the cmdk search state that
  // decides it is only readable inside <CommandList>. Slicing up here would put
  // the long tail permanently out of reach of search.
  const linksRaw = useQuery(api.bifrost.list) ?? [];

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
    icon: l.icon,
    pinned: l.pinned,
    usageCount: l.usageCount,
    lastUsedAt: l.lastUsedAt,
    createdAt: l.createdAt,
  }));

  return { agents, sessions, alerts, cronJobs, links };
}
