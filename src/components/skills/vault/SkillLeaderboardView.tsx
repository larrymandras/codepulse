import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
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

type SortKey = "usage" | "recent" | "name";

function relTime(ms: number | null): string {
  if (ms == null) return "never";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/**
 * Usage leaderboard — a flat, list-driven view: every skill as a row with a
 * usage bar, category color chip, and scope badge, sortable by usage/recency/name.
 * Plain DOM, no three.js. Click a row for the shared detail card.
 */
export function SkillLeaderboardView({ model, query }: { model: VaultModel; query: string }) {
  const [sort, setSort] = useState<SortKey>("usage");
  const [selected, setSelected] = useState<VaultSkill | null>(null);

  const rows = useMemo(() => {
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
    const sorted = [...list];
    if (sort === "usage") sorted.sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name));
    else if (sort === "recent")
      sorted.sort((a, b) => (b.lastUsedAt ?? -1) - (a.lastUsedAt ?? -1) || a.name.localeCompare(b.name));
    else sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return sorted;
  }, [model, query, sort]);

  const maxUse = useMemo(() => Math.max(1, ...rows.map((r) => r.useCount)), [rows]);

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "usage", label: "Usage" },
    { key: "recent", label: "Recent" },
    { key: "name", label: "Name" },
  ];

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* sort bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" /> Sort
          <div className="ml-1 flex items-center gap-1 rounded-[var(--radius)] border border-border/60 bg-background/60 p-0.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  sort === s.key ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={sort === s.key}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} skills</span>
      </div>

      {/* rows */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {rows.map((s, i) => {
          const pct = Math.max(2, (s.useCount / maxUse) * 100);
          const accent = CONTAINER_ACCENT[s.container];
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
            >
              <span className="text-right font-mono text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}99` }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm text-foreground">{s.displayName}</span>
                  <span className="truncate text-xs text-muted-foreground">{s.categoryLabel}</span>
                </div>
                {/* usage bar */}
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}aa)` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-12 text-right text-sm font-semibold tabular-nums text-foreground">{s.useCount}×</span>
                {sort === "recent" && (
                  <span className="hidden w-16 text-right text-[11px] text-muted-foreground sm:inline">{relTime(s.lastUsedAt)}</span>
                )}
                <span
                  className="hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium md:inline"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  {CONTAINER_LABEL[s.container]}
                </span>
              </div>
            </button>
          );
        })}
        {rows.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No skills match.</div>
        )}
      </div>

      {selected && <SkillVaultDetailCard skill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default SkillLeaderboardView;
