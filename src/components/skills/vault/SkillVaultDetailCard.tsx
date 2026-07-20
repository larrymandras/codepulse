import { X, Zap, Clock, GitBranch, Terminal, Copy, Check } from "lucide-react";
import { useState } from "react";
import { CONTAINER_LABEL, type VaultContainerId, type VaultSkill } from "@/lib/skillVault";

const CONTAINER_ACCENT: Record<VaultContainerId, string> = {
  global: "#22d3ee",
  project: "#a78bfa",
  cold: "#fbbf24",
};

/**
 * Detail overlay for a selected skill in the vault. Plain DOM, category-colored,
 * floats over the 3D canvas. No three.js.
 */
export function SkillVaultDetailCard({
  skill,
  onClose,
}: {
  skill: VaultSkill;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const accent = skill.color;
  const scopeAccent = CONTAINER_ACCENT[skill.container];

  const lastUsed =
    skill.lastUsedAt != null
      ? new Date(skill.lastUsedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "Never";

  const copyCommand = () => {
    if (!skill.command) return;
    void navigator.clipboard?.writeText(skill.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      className="absolute top-4 right-4 z-20 w-[340px] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/85 backdrop-blur-xl"
      style={{ boxShadow: `0 0 0 1px ${accent}33, 0 18px 50px -12px ${accent}55` }}
      role="dialog"
      aria-label={`Skill ${skill.displayName}`}
    >
      {/* accent glow strip */}
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: `${accent}22`, boxShadow: `inset 0 0 0 1px ${accent}55` }}
            aria-hidden="true"
          >
            {skill.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-zinc-50">{skill.displayName}</h3>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent, boxShadow: `0 0 6px ${accent}` }} />
              <span className="truncate text-xs text-zinc-400">{skill.categoryLabel}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            aria-label="Close skill details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {skill.command && (
          <button
            onClick={copyCommand}
            className="group mt-3 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-left transition-colors hover:border-white/20"
          >
            <Terminal className="h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
            <code className="flex-1 truncate font-mono text-xs text-zinc-200">{skill.command}</code>
            {copied ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-zinc-300" />
            )}
          </button>
        )}

        {skill.description && (
          <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-zinc-400">{skill.description}</p>
        )}

        {/* stat tiles */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Zap className="h-3 w-3" /> Uses
            </div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">{skill.useCount}</div>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Clock className="h-3 w-3" /> Last used
            </div>
            <div className="mt-0.5 truncate text-sm font-medium text-zinc-100">{lastUsed}</div>
          </div>
        </div>

        {/* footer: scope + upstream */}
        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium"
            style={{ backgroundColor: `${scopeAccent}1f`, color: scopeAccent, boxShadow: `inset 0 0 0 1px ${scopeAccent}44` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: scopeAccent }} />
            {CONTAINER_LABEL[skill.container]}
          </span>
          <span className="inline-flex items-center gap-1 truncate text-zinc-500" title={skill.upstream ?? undefined}>
            <GitBranch className="h-3 w-3 shrink-0" />
            <span className="truncate">{skill.upstream ?? "no upstream"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
