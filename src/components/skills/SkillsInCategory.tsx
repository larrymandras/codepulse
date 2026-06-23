import { useState } from "react";
import { ArrowLeft, GripVertical, Pencil, Star } from "lucide-react";

interface SkillEntry {
  name: string;
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  useCount?: number;
  isAutoAssigned: boolean;
  favorite: boolean;
}

interface CategoryOption {
  name: string;
  displayName: string;
  icon: string;
  color: string;
}

interface SkillsInCategoryProps {
  categoryName: string | null;
  categoryDisplayName: string;
  categoryIcon: string;
  categoryColor: string;
  skills: SkillEntry[];
  categories: CategoryOption[];
  onBack: () => void;
  onLaunch: (skillName: string) => void;
  onEditSkill: (skillName: string) => void;
  onReassignSkill: (skillName: string, newCategoryName: string) => void;
  onToggleFavorite: (skillName: string) => void;
}

const COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1", red: "#ef4444", purple: "#a855f7", amber: "#f59e0b",
  cyan: "#06b6d4", emerald: "#10b981", violet: "#8b5cf6", blue: "#3b82f6",
  orange: "#f97316", pink: "#ec4899", teal: "#14b8a6", rose: "#f43f5e",
  green: "#22c55e", yellow: "#eab308", gray: "#6b7280",
};

export function SkillsInCategory({
  categoryName,
  categoryDisplayName,
  categoryIcon,
  categoryColor,
  skills,
  categories,
  onBack,
  onLaunch,
  onEditSkill,
  onReassignSkill,
  onToggleFavorite,
}: SkillsInCategoryProps) {
  const hex = COLOR_HEX[categoryColor] ?? COLOR_HEX.gray;
  const otherCategories = categories.filter((c) => c.name !== categoryName);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Dense Header */}
      <div
        className="relative flex items-center justify-between border-b px-4 py-2 mb-4"
        style={{ borderColor: `${hex}40` }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back"
            className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span
            className="text-2xl drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]"
          >{categoryIcon}</span>
          <h2 className="text-white text-base font-mono font-bold tracking-widest uppercase flex items-center gap-3">
            {categoryDisplayName}
            <span 
              className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
              style={{
                color: hex,
                borderColor: `${hex}50`,
                backgroundColor: `${hex}10`,
              }}
            >
              {skills.length}
            </span>
          </h2>
        </div>
        
        {otherCategories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-muted-foreground">Move target:</span>
            {otherCategories.map((cat) => {
              const catHex = COLOR_HEX[cat.color] ?? COLOR_HEX.gray;
              const isHover = hoverTarget === cat.name;
              return (
                <div
                  key={cat.name}
                  data-drop-target={cat.name}
                  onDragOver={(e) => { e.preventDefault(); setHoverTarget(cat.name); }}
                  onDragLeave={() => setHoverTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const skillName = e.dataTransfer.getData("text/plain");
                    if (skillName) onReassignSkill(skillName, cat.name);
                    setHoverTarget(null);
                  }}
                  className={`flex items-center justify-center w-6 h-6 rounded border transition-all cursor-crosshair ${
                    isHover ? "scale-110" : ""
                  }`}
                  title={`Drop to move to ${cat.displayName}`}
                  style={{ 
                    backgroundColor: catHex + (isHover ? "30" : "10"),
                    borderColor: catHex + (isHover ? "80" : "30"),
                    boxShadow: isHover ? `0 0 10px ${catHex}40` : "none"
                  }}
                >
                  <span className="text-xs">{cat.icon}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {skills.length === 0 && (
        <div className="text-center font-mono text-sm tracking-widest text-muted-foreground py-8 border border-dashed border-primary/20 rounded bg-primary/5">
          [ NO SKILLS FOUND IN SECTOR ]
        </div>
      )}

      {/* Dense Skill Rows */}
      <div className="flex flex-col divide-y divide-primary/10 border-t border-b border-primary/20 bg-background/30">
        {skills.map((skill) => {
          const desc = skill.overrideDescription ?? skill.description ?? "";
          return (
            <div
              key={skill.name}
              data-skill={skill.name}
              draggable="true"
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", skill.name);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="group relative flex items-center gap-3 px-3 py-2 hover:bg-primary/10 transition-colors"
            >
              <GripVertical className="w-3.5 h-3.5 text-primary/30 group-hover:text-primary cursor-grab flex-shrink-0" />

              <div className="flex items-center w-64 flex-shrink-0 gap-2 pr-4 border-r border-primary/10">
                <div className="text-white font-mono font-bold text-sm tracking-wide truncate">
                  {skill.displayName}
                </div>
                {skill.favorite && (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
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
                  <span className="text-[11px] font-mono text-primary/60 px-2 w-16 text-right">
                    {skill.useCount} uses
                  </span>
                )}

                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 pr-2 border-r border-primary/10">
                  <button
                    onClick={() => onToggleFavorite(skill.name)}
                    className="p-1 rounded hover:bg-amber-400/20 text-muted-foreground hover:text-amber-400 transition-colors"
                    title="Toggle Priority"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onEditSkill(skill.name)}
                    className="p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                    title="Edit Metadata"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => onLaunch(skill.name)}
                  className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary hover:text-primary-foreground border border-primary/30 bg-transparent hover:bg-primary rounded px-3 py-1 transition-all"
                >
                  Launch
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
