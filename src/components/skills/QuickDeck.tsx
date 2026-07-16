import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { deckSkills, skillInvocation, type SkillLike } from "@/lib/skills";

export type DeckSkill = SkillLike & {
  displayName: string;
  categoryIcon: string;
  favorite: boolean;
};

interface QuickDeckProps {
  skills: DeckSkill[];
  /** Records the copy so useCount keeps ranking the deck. */
  onUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
  limit?: number;
}

/**
 * The unified quick-access dock: favorites pinned, most-used fill (deckSkills).
 * Chip click copies the invocation (primary action); hover reveals open-in-Chat
 * and favorite-toggle. Replaces SkillPills + FavoriteSkills + FrequentSkills.
 */
export function QuickDeck({ skills, onUse, onOpenInChat, onToggleFavorite, limit = 10 }: QuickDeckProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const deck = deckSkills(skills, limit) as DeckSkill[];

  if (deck.length === 0) return null;

  const handleCopy = async (skill: DeckSkill) => {
    const invocation = skillInvocation(skill);
    setFailed(null);
    try {
      await navigator.clipboard.writeText(invocation);
      setCopied(skill.name);
      setTimeout(() => setCopied((c) => (c === skill.name ? null : c)), 1500);
    } catch {
      // Don't claim "copied" when nothing reached the clipboard.
      setFailed(skill.name);
      setTimeout(() => setFailed((f) => (f === skill.name ? null : f)), 2500);
    }
    onUse(skill.name);
  };

  return (
    <section aria-label="Command deck" className="flex flex-col gap-2">
      <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
        Command Deck
      </h2>
      <div className="flex flex-wrap gap-2">
        {deck.map((skill) => {
          const invocation = skillInvocation(skill);
          const isCopied = copied === skill.name;
          const isFailed = failed === skill.name;
          return (
            <div
              key={skill.name}
              data-testid="deck-chip-wrap"
              className={`group inline-flex items-center rounded-full border transition-all ${
                isFailed
                  ? "border-destructive/50 bg-destructive/10"
                  : isCopied
                    ? "border-primary bg-primary/20 shadow-[var(--glow-sm)]"
                    : "border-primary/25 bg-card hover:border-primary hover:shadow-[var(--glow-xs)]"
              }`}
            >
              <button
                data-testid="deck-chip"
                onClick={() => handleCopy(skill)}
                title={`${invocation} — click to copy${skill.useCount ? ` · used ${skill.useCount}×` : ""}`}
                aria-label={`Copy invocation ${invocation}`}
                className={`inline-flex items-center gap-2 pl-3 pr-2 py-1.5 font-mono text-xs transition-colors ${
                  isFailed ? "text-destructive" : isCopied ? "text-primary" : "text-foreground group-hover:text-primary"
                }`}
              >
                <span aria-hidden="true">{skill.categoryIcon}</span>
                <span className="truncate max-w-[14rem]">{invocation}</span>
                {skill.favorite && (
                  <Star aria-hidden="true" className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                )}
                <span className={`text-[10px] tabular-nums ${isCopied || isFailed ? "" : "text-muted-foreground"}`}>
                  {isFailed ? "copy failed" : isCopied ? "copied" : (skill.useCount ?? 0)}
                </span>
              </button>
              <div className="flex w-0 overflow-hidden items-center gap-0.5 transition-all group-hover:w-14 group-focus-within:w-14 group-hover:pr-2 group-focus-within:pr-2">
                <button
                  onClick={() => onOpenInChat(skill.name)}
                  aria-label={`Open ${skill.name} in Chat`}
                  className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onToggleFavorite(skill.name)}
                  aria-label={`Toggle favorite ${skill.name}`}
                  className="p-1 rounded text-muted-foreground hover:text-amber-400 transition-colors"
                >
                  <Star className={`w-3.5 h-3.5 ${skill.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
