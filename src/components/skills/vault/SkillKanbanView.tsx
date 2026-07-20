import { useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  CONTAINER_LABEL,
  CONTAINER_ORDER,
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

/**
 * Kanban lanes — three columns (Global / Project / Cold) of skill cards sorted by
 * usage. List-driven and scannable; the cards are drag-styled to foreshadow the
 * Phase-98/100 move/archive-between-containers work (drag is not wired yet). Plain
 * DOM. Click a card for the shared detail card.
 */
export function SkillKanbanView({ model, query }: { model: VaultModel; query: string }) {
  const [selected, setSelected] = useState<VaultSkill | null>(null);

  const lanes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONTAINER_ORDER.map((id) => {
      const container = model.containers.find((c) => c.id === id)!;
      let skills = container.clusters.flatMap((cl) => cl.skills);
      if (q) {
        skills = skills.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.displayName.toLowerCase().includes(q) ||
            s.categoryLabel.toLowerCase().includes(q) ||
            (s.command ?? "").toLowerCase().includes(q),
        );
      }
      skills = [...skills].sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name));
      return { id, label: CONTAINER_LABEL[id], accent: CONTAINER_ACCENT[id], count: container.count, skills };
    });
  }, [model, query]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="flex h-full gap-3 overflow-x-auto p-3">
        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="flex h-full min-w-[240px] flex-1 flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]"
          >
            {/* lane header */}
            <div
              className="flex items-center justify-between gap-2 border-b px-3 py-2"
              style={{ borderColor: `${lane.accent}33` }}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lane.accent, boxShadow: `0 0 6px ${lane.accent}` }} />
                <span className="text-sm font-semibold" style={{ color: lane.accent }}>
                  {lane.label}
                </span>
              </div>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{lane.count}</span>
            </div>

            {/* cards */}
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
              {lane.skills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="group flex w-full items-center gap-2 rounded-lg border border-white/8 bg-zinc-900/60 px-2.5 py-2 text-left transition-all hover:-translate-y-px hover:border-white/20 hover:bg-zinc-900"
                  style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.02)" }}
                >
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color, boxShadow: `0 0 5px ${s.color}88` }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-foreground">{s.displayName}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.categoryLabel}</div>
                  </div>
                  {s.useCount > 0 && (
                    <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {s.useCount}×
                    </span>
                  )}
                </button>
              ))}
              {lane.skills.length === 0 && (
                <div className="flex h-24 items-center justify-center text-xs text-muted-foreground/60">
                  {query ? "No matches" : "Empty"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selected && <SkillVaultDetailCard skill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default SkillKanbanView;
