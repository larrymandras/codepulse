import { useState } from "react";
import { Copy, Star } from "lucide-react";
import { topSkills, skillInvocation, isDormant, type SkillLike } from "@/lib/skills";
import { RunTargetChooser } from "./RunTargetChooser";

export type DeckSkill = SkillLike & {
  displayName: string;
  categoryIcon?: string;
  favorite: boolean;
  discoveredAt?: number;
};

interface SkillCommandDeckProps {
  skills: DeckSkill[];
  onToggleFavorite: (skillName: string) => void;
}

/** Compact "3h ago" / "2d ago" relative time. Absolute seconds/minutes stay coarse. */
function relTime(ts?: number): string {
  if (!ts) return "";
  // discoveredAt is stored in seconds, lastUsedAt in ms — normalise to ms.
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

const CARD = "bg-card border border-border rounded-lg p-3.5 flex flex-col gap-2.5";
const LABEL =
  "text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.18em] flex items-center gap-2";
const DOT = "w-1.5 h-1.5 bg-primary/70 rounded-full";

/**
 * SkillCommandDeck — the right-rail favorites dashboard (control-surface redesign).
 * Four stacked cards derived purely from the skills list: pinned favorites,
 * most-used (with usage bars), recently used, recently added. Presentational —
 * launch goes through RunTargetChooser exactly as QuickDeck did; copy stays a
 * non-recording secondary action (D-13). No mutation is called here beyond the
 * favorite toggle the parent owns.
 */
export function SkillCommandDeck({ skills, onToggleFavorite }: SkillCommandDeckProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const favorites = skills
    .filter((s) => s.favorite && !isDormant(s))
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
    .slice(0, 6);

  const mostUsed = topSkills(skills, 6) as DeckSkill[];
  const maxUse = mostUsed[0]?.useCount ?? 1;

  const recentlyUsed = skills
    .filter((s) => (s.lastUsedAt ?? 0) > 0 && !isDormant(s))
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, 5);

  const recentlyAdded = [...skills]
    .filter((s) => (s.discoveredAt ?? 0) > 0)
    .sort((a, b) => (b.discoveredAt ?? 0) - (a.discoveredAt ?? 0))
    .slice(0, 5);

  const handleCopy = async (skill: DeckSkill) => {
    try {
      await navigator.clipboard.writeText(skillInvocation(skill));
      setCopied(skill.name);
      setTimeout(() => setCopied((c) => (c === skill.name ? null : c)), 1500);
    } catch {
      /* copy is best-effort; never claim success */
    }
  };

  const hasAnything =
    favorites.length || mostUsed.length || recentlyUsed.length || recentlyAdded.length;
  if (!hasAnything) return null;

  return (
    <aside aria-label="Command deck" className="flex flex-col gap-3.5">
      <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-primary rounded-full shadow-[var(--glow-xs)]" />
        Command Deck
      </h2>

      {/* Pinned favorites */}
      {favorites.length > 0 && (
        <section className={CARD}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>
              <span className={DOT} /> Pinned favorites
            </span>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {favorites.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {favorites.map((skill) => (
              <div
                key={skill.name}
                className="group border border-border bg-background rounded-md px-2.5 py-2 hover:border-primary/50 transition-colors"
              >
                <RunTargetChooser skill={skill}>
                  <button
                    className="w-full text-left"
                    title={`Run ${skillInvocation(skill)}`}
                    aria-label={`Run ${skill.name}`}
                  >
                    <div className="font-mono text-[11.5px] font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1 truncate">
                      <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{skill.displayName}</span>
                    </div>
                    <div className="font-mono text-[9.5px] text-muted-foreground tabular-nums">
                      used {skill.useCount ?? 0}×
                    </div>
                  </button>
                </RunTargetChooser>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Most used */}
      {mostUsed.length > 0 && (
        <section className={CARD}>
          <span className={LABEL}>
            <span className={DOT} /> Most used
          </span>
          <div className="flex flex-col gap-2">
            {mostUsed.map((skill) => (
              <div key={skill.name} className="group">
                <RunTargetChooser skill={skill}>
                  <button
                    className="w-full flex items-center justify-between gap-2"
                    aria-label={`Run ${skill.name}`}
                  >
                    <span className="font-mono text-[11.5px] text-foreground/80 group-hover:text-primary transition-colors truncate">
                      {skillInvocation(skill)}
                    </span>
                    <span className="font-mono text-[11px] text-primary tabular-nums shrink-0">
                      {skill.useCount ?? 0}
                    </span>
                  </button>
                </RunTargetChooser>
                <div className="h-1 rounded bg-background overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-primary/40 to-primary rounded"
                    style={{ width: `${Math.max(6, Math.round(((skill.useCount ?? 0) / maxUse) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently used */}
      {recentlyUsed.length > 0 && (
        <section className={CARD}>
          <span className={LABEL}>
            <span className={DOT} /> Recently used
          </span>
          <div className="flex flex-col gap-0.5">
            {recentlyUsed.map((skill) => (
              <div
                key={skill.name}
                className="group flex items-center gap-2 rounded px-1.5 py-1 -mx-1.5 hover:bg-background transition-colors"
              >
                <RunTargetChooser skill={skill}>
                  <button className="flex-1 text-left min-w-0" aria-label={`Run ${skill.name}`}>
                    <span className="font-mono text-[11.5px] text-foreground/75 group-hover:text-primary transition-colors truncate block">
                      {skillInvocation(skill)}
                    </span>
                  </button>
                </RunTargetChooser>
                <span className="font-mono text-[9.5px] text-muted-foreground shrink-0 tabular-nums">
                  {relTime(skill.lastUsedAt)}
                </span>
                <button
                  onClick={() => handleCopy(skill)}
                  aria-label={`Copy invocation for ${skill.name}`}
                  className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recently added */}
      {recentlyAdded.length > 0 && (
        <section className={CARD}>
          <span className={LABEL}>
            <span className={DOT} /> Recently added
          </span>
          <div className="flex flex-col gap-0.5">
            {recentlyAdded.map((skill) => (
              <div
                key={skill.name}
                className="group flex items-center gap-2 rounded px-1.5 py-1 -mx-1.5 hover:bg-background transition-colors"
              >
                <RunTargetChooser skill={skill}>
                  <button className="flex-1 text-left min-w-0" aria-label={`Run ${skill.name}`}>
                    <span className="font-mono text-[11.5px] text-foreground/75 group-hover:text-primary transition-colors truncate block">
                      {skill.name}
                    </span>
                  </button>
                </RunTargetChooser>
                <button
                  onClick={() => onToggleFavorite(skill.name)}
                  aria-label={`Toggle favorite ${skill.name}`}
                  className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-amber-400 transition-all shrink-0"
                >
                  <Star className={`w-3 h-3 ${skill.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>
                <span className="font-mono text-[9.5px] text-muted-foreground shrink-0 tabular-nums">
                  {relTime(skill.discoveredAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
