import { useEffect, useRef, useState } from "react";
import { GripVertical, MessageSquare, Pencil, Star } from "lucide-react";
import { isDormant, skillInvocation, type SkillLike } from "@/lib/skills";
import { SkillLifecycleMenu } from "./SkillLifecycleMenu";

export type RowSkill = SkillLike & {
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  favorite: boolean;
};

interface SkillRowProps {
  skill: RowSkill;
  /** Records the copy so useCount keeps ranking. */
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onEdit: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
  draggable?: boolean;
  /**
   * Optional host override for the ⋯ lifecycle menu (Phase 98). When
   * omitted, SkillLifecycleMenu resolves one itself (IntakeModal's D-08
   * online-newest convention) — this prop stays optional so every existing
   * SkillRow call site keeps compiling untouched.
   */
  hostId?: string;
  /**
   * Which lane this row renders in (98-REVIEW WR-04) — forwarded to
   * SkillLifecycleMenu so a merged shadowed row shown in Cold Storage gets
   * the dormant-copy menu. Optional; defaults to "active".
   */
  lane?: "active" | "cold";
}

type CopyState = "idle" | "copied" | "dormant" | "failed";

const COPY_LABEL: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  dormant: "Dormant",
  failed: "Failed",
};

/**
 * The one skill row used by the category view and the all-skills overview.
 * Copy is the primary action; Chat/edit/favorite reveal on hover or focus.
 */
export function SkillRow({
  skill,
  onRecordUse,
  onOpenInChat,
  onEdit,
  onToggleFavorite,
  draggable = true,
  hostId,
  lane,
}: SkillRowProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const dormant = isDormant(skill);
  const invocation = skillInvocation(skill);
  const desc = skill.overrideDescription ?? skill.description ?? "";
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invocation);
      // Dormant copy succeeds but warns: the skill is not loaded.
      setCopyState(dormant ? "dormant" : "copied");
    } catch {
      setCopyState("failed");
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), 1800);
    onRecordUse(skill.name);
  };

  return (
    <div
      data-skill={skill.name}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", skill.name);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group relative flex items-center gap-3 px-3 py-2 hover:bg-primary/10 transition-colors ${
        dormant ? "opacity-50" : ""
      }`}
    >
      <GripVertical className="w-3.5 h-3.5 text-primary/30 group-hover:text-primary cursor-grab flex-shrink-0" />

      <div className="flex items-center w-64 flex-shrink-0 gap-2 pr-4 border-r border-primary/10">
        <span className="text-foreground font-mono font-bold text-sm tracking-wide truncate">
          {skill.displayName}
        </span>
        {skill.favorite && (
          <Star aria-hidden="true" className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
        )}
        {dormant && (
          <span className="text-[9px] font-mono uppercase tracking-widest border border-muted-foreground/40 text-muted-foreground rounded px-1 shrink-0">
            dormant
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 pr-4">
        {desc ? (
          <div className="text-muted-foreground text-xs truncate">{desc}</div>
        ) : (
          <div className="text-muted-foreground/30 text-xs italic">No description available</div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {(skill.useCount ?? 0) > 0 && (
          <span className="text-[11px] font-mono text-primary/60 px-2 w-14 text-right tabular-nums">
            {skill.useCount}×
          </span>
        )}

        <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity gap-1 pr-2 border-r border-primary/10">
          <button
            onClick={() => onOpenInChat(skill.name)}
            aria-label={`Open ${skill.name} in Chat`}
            title="Open in Chat"
            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggleFavorite(skill.name)}
            aria-label={`Toggle favorite ${skill.name}`}
            title="Toggle favorite"
            className="p-1 rounded hover:bg-amber-400/20 text-muted-foreground hover:text-amber-400 transition-colors"
          >
            <Star className={`w-3.5 h-3.5 ${skill.favorite ? "fill-amber-400 text-amber-400" : ""}`} />
          </button>
          <button
            onClick={() => onEdit(skill.name)}
            aria-label={`Edit ${skill.name}`}
            title="Edit metadata"
            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        <SkillLifecycleMenu skill={skill} hostId={hostId} lane={lane} />

        <button
          onClick={handleCopy}
          aria-label={`Copy ${invocation}`}
          className={`text-[11px] font-mono font-bold uppercase tracking-widest border rounded px-3 py-1 transition-all min-w-[4.5rem] ${
            copyState === "copied"
              ? "text-primary-foreground bg-primary border-primary"
              : copyState === "failed"
                ? "text-destructive border-destructive/50"
                : copyState === "dormant"
                  ? "text-muted-foreground border-muted-foreground/40"
                  : "text-primary border-primary/30 hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          {COPY_LABEL[copyState]}
        </button>
      </div>
    </div>
  );
}
