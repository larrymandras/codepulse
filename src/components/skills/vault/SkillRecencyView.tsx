import { useMemo, useState } from "react";
import { Clock, Archive } from "lucide-react";
import {
  CONTAINER_LABEL,
  uniqueSkills,
  type VaultContainerId,
  type VaultModel,
  type VaultSkill,
} from "@/lib/skillVault";
import { SkillVaultDetailCard } from "./SkillVaultDetailCard";

const CONTAINER_ACCENT: Record<VaultContainerId, string> = {
  global: "#22d3ee",
  project: "#a78bfa",
  cold: "#fbbf24",
};

interface Bucket {
  key: string;
  label: string;
  maxDays: number;
  heat: string; // accent color = recency heat
  stale?: boolean;
}

const BUCKETS: Bucket[] = [
  { key: "today", label: "Today", maxDays: 1, heat: "#10b981" },
  { key: "week", label: "This week", maxDays: 7, heat: "#22d3ee" },
  { key: "month", label: "This month", maxDays: 30, heat: "#a78bfa" },
  { key: "quarter", label: "Last 90 days", maxDays: 90, heat: "#f59e0b" },
  { key: "stale", label: "Dormant · 90d+ / never used", maxDays: Infinity, heat: "#71717a", stale: true },
];

function daysSince(ms: number | null): number {
  if (ms == null) return Infinity;
  return (Date.now() - ms) / 86_400_000;
}

function relTime(ms: number | null): string {
  if (ms == null) return "never used";
  const d = Math.floor(daysSince(ms));
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/**
 * Recency feed — skills grouped into recency buckets (Today → Dormant), each row
 * showing its "last used" time, colored by recency heat. Surfaces what's alive vs.
 * cold-storage candidates. Plain DOM. Click a row for the shared detail card.
 */
export function SkillRecencyView({ model, query }: { model: VaultModel; query: string }) {
  const [selected, setSelected] = useState<VaultSkill | null>(null);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = uniqueSkills(model);
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.displayName.toLowerCase().includes(q) ||
          s.categoryLabel.toLowerCase().includes(q) ||
          (s.command ?? "").toLowerCase().includes(q),
      );
    }
    const buckets = BUCKETS.map((b) => ({ ...b, skills: [] as VaultSkill[] }));
    for (const s of list) {
      const d = daysSince(s.lastUsedAt);
      const bucket = buckets.find((b) => d < b.maxDays) ?? buckets[buckets.length - 1]!;
      bucket.skills.push(s);
    }
    for (const b of buckets) {
      b.skills.sort((a, z) => (z.lastUsedAt ?? -1) - (a.lastUsedAt ?? -1) || a.name.localeCompare(z.name));
    }
    return buckets;
  }, [model, query]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="h-full overflow-y-auto px-3 py-3">
        {grouped.map((b) => (
          <div key={b.key} className="mb-4">
            <div className="mb-1.5 flex items-center gap-2 px-1">
              {b.stale ? <Archive className="h-3.5 w-3.5" style={{ color: b.heat }} /> : <Clock className="h-3.5 w-3.5" style={{ color: b.heat }} />}
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: b.heat }}>
                {b.label}
              </span>
              <span className="text-xs text-muted-foreground">{b.skills.length}</span>
              <div className="ml-2 h-px flex-1" style={{ background: `linear-gradient(90deg, ${b.heat}44, transparent)` }} />
            </div>

            {b.skills.length === 0 ? (
              <div className="px-3 py-1 text-xs text-muted-foreground/50">—</div>
            ) : (
              b.skills.map((s) => {
                const accent = CONTAINER_ACCENT[s.container];
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                    style={{ opacity: b.stale ? 0.72 : 1 }}
                  >
                    <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: b.heat, boxShadow: `0 0 6px ${b.heat}66` }} aria-hidden="true" />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{s.displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{s.categoryLabel}</span>
                    <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">{relTime(s.lastUsedAt)}</span>
                    <span
                      className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline"
                      style={{ backgroundColor: `${accent}1f`, color: accent }}
                    >
                      {CONTAINER_LABEL[s.container]}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ))}
      </div>

      {selected && <SkillVaultDetailCard skill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default SkillRecencyView;
