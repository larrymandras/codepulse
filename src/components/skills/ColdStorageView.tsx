import { Archive } from "lucide-react";
import { SkillRow, type RowSkill } from "./SkillRow";

interface ColdStorageViewProps {
  /** Already filtered by the page: non-hidden, dormant, + search. */
  skills: RowSkill[];
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onEdit: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
}

/**
 * Main-area view for dormant skills (origins === ["claude-code:available"]).
 * They live on disk but aren't loaded by Claude Code — this makes them
 * discoverable without digging through the origin dropdown.
 */
export function ColdStorageView({
  skills,
  onRecordUse,
  onOpenInChat,
  onEdit,
  onToggleFavorite,
}: ColdStorageViewProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3 border-b border-border px-1 pb-1">
        <Archive className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <h3 className="text-muted-foreground text-sm font-mono font-bold tracking-widest uppercase">
          Cold Storage
        </h3>
        <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-border text-muted-foreground flex-shrink-0">
          {skills.length}
        </span>
      </div>
      <p className="text-xs text-muted-foreground/60 px-1">
        Dormant skills live on disk but are not loaded. Use the ⋯ menu on a
        row to restore or permanently delete it.
      </p>

      {skills.length === 0 ? (
        <div className="text-center font-mono text-sm tracking-widest text-muted-foreground py-8 border border-dashed border-primary/20 rounded bg-primary/5">
          [ NO SKILLS MATCH ]
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-primary/10 border-t border-b border-primary/20 bg-background/30">
          {skills.map((skill) => (
            <SkillRow
              key={skill.name}
              skill={skill}
              onRecordUse={onRecordUse}
              onOpenInChat={onOpenInChat}
              onEdit={onEdit}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </section>
  );
}
