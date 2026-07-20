import { X, Layers, ArrowRight } from "lucide-react";
import { CONTAINER_LABEL, type VaultContainerId, type VaultCluster, type VaultSkill } from "@/lib/skillVault";

const CONTAINER_ACCENT: Record<VaultContainerId, string> = {
  global: "#22d3ee",
  project: "#a78bfa",
  cold: "#fbbf24",
};

/**
 * Category (cluster) summary card — shown when a cluster orb is clicked. Lists the
 * skills in that category; clicking a row drills into the skill detail card.
 */
export function ClusterDetailCard({
  cluster,
  onClose,
  onSelectSkill,
}: {
  cluster: VaultCluster;
  onClose: () => void;
  onSelectSkill: (skill: VaultSkill) => void;
}) {
  const accent = cluster.color;
  const scopeAccent = CONTAINER_ACCENT[cluster.container];
  const icon = cluster.skills[0]?.icon ?? "⚡";

  return (
    <div
      className="absolute top-4 right-4 z-20 flex max-h-[calc(100%-2rem)] w-[340px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 backdrop-blur-xl"
      style={{ boxShadow: `0 0 0 1px ${accent}33, 0 18px 50px -12px ${accent}55` }}
      role="dialog"
      aria-label={`Category ${cluster.categoryLabel}`}
    >
      <div className="h-1 w-full shrink-0" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: `${accent}22`, boxShadow: `inset 0 0 0 1px ${accent}55` }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-zinc-50">{cluster.categoryLabel}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3 w-3" style={{ color: accent }} />
              {cluster.skills.length} skill{cluster.skills.length === 1 ? "" : "s"}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
              style={{ backgroundColor: `${scopeAccent}1f`, color: scopeAccent }}
            >
              {CONTAINER_LABEL[cluster.container]}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          aria-label="Close category details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {cluster.skills.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectSkill(s)}
            className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}99` }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">{s.displayName}</span>
            {s.useCount > 0 && <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{s.useCount}×</span>}
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  );
}
