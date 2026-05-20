import { useState } from "react";
import { ArrowLeft, GripVertical, Pencil } from "lucide-react";

interface SkillEntry {
  name: string;
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  useCount?: number;
  isAutoAssigned: boolean;
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
}: SkillsInCategoryProps) {
  const hex = COLOR_HEX[categoryColor] ?? COLOR_HEX.gray;
  const otherCategories = categories.filter((c) => c.name !== categoryName);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="relative overflow-hidden flex items-center gap-4 rounded border px-5 py-4 shadow-lg"
        style={{ 
          backgroundColor: hex + "10",
          borderColor: hex + "40",
          boxShadow: `0 0 20px ${hex}15, inset 0 0 10px ${hex}10`
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="w-full h-[1px] animate-scanline" style={{ backgroundColor: hex }} />
        </div>
        
        <button
          onClick={onBack}
          className="relative z-10 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span 
          className="relative z-10 text-3xl"
          style={{ textShadow: `0 0 15px ${hex}80` }}
        >{categoryIcon}</span>
        <h2 className="relative z-10 text-white text-lg font-mono font-bold tracking-widest uppercase flex-1">
          {categoryDisplayName}
        </h2>
        <span 
          className="relative z-10 text-xs font-mono font-bold uppercase tracking-widest rounded px-2.5 py-0.5 border text-white"
          style={{
            borderColor: `${hex}50`,
            backgroundColor: `${hex}30`,
          }}
        >
          {skills.length} {skills.length === 1 ? "skill" : "skills"}
        </span>
      </div>

      {/* Drop targets — always visible */}
      {otherCategories.length > 0 && (
        <div className="border border-primary/20 rounded p-4 bg-background/50 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3 font-bold">
            [ Drag a skill here to move it, or use the "Move to" dropdown ]
          </p>
          <div className="flex gap-2 flex-wrap">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-all cursor-default ${
                    isHover ? "scale-[1.03]" : "hover:scale-[1.02]"
                  }`}
                  style={{ 
                    backgroundColor: catHex + (isHover ? "30" : "10"),
                    borderColor: catHex + (isHover ? "80" : "30"),
                    boxShadow: isHover ? `0 0 15px ${catHex}40` : "none"
                  }}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-white">{cat.displayName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="text-center font-mono text-[11px] tracking-widest text-muted-foreground py-12 border border-dashed border-primary/20 rounded bg-primary/5">
          [ NO SKILLS FOUND IN SECTOR ]
        </div>
      )}

      {/* Skill rows */}
      <div className="space-y-2">
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
              className="group relative flex items-center gap-4 bg-background/40 border border-primary/20 rounded p-3 hover:bg-primary/5 hover:border-primary/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all overflow-hidden"
            >
              {/* Subtle hover scanline */}
              <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-10 transition-opacity duration-300">
                <div className="w-full h-[1px] animate-scanline bg-primary" />
              </div>

              <GripVertical className="w-4 h-4 text-primary/40 group-hover:text-primary cursor-grab flex-shrink-0 transition-colors z-10" />

              <div className="flex-1 min-w-0 relative z-10 flex flex-col">
                <div className="flex items-center gap-2">
                  <div className="text-white font-mono font-bold text-sm tracking-wide truncate">
                    {skill.displayName}
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground/50 border border-muted-foreground/20 rounded px-1.5 py-0.5 shrink-0 bg-background/50">
                    {skill.name}
                  </span>
                </div>
                {desc && (
                  <div className="text-muted-foreground text-xs truncate mt-0.5 leading-relaxed">{desc}</div>
                )}
              </div>

              {(skill.useCount ?? 0) > 0 && (
                <span className="relative z-10 text-[9px] font-mono uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5 flex-shrink-0 font-bold shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                  {skill.useCount} uses
                </span>
              )}

              {otherCategories.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onReassignSkill(skill.name, e.target.value);
                  }}
                  className="relative z-10 bg-background border border-primary/30 rounded text-[10px] font-mono uppercase tracking-wider text-primary/80 px-2 py-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 flex-shrink-0 cursor-pointer hover:bg-primary/5 transition-colors appearance-none"
                  title="Move to category"
                  style={{ backgroundImage: "none" }}
                >
                  <option value="" className="bg-background text-foreground">Move to...</option>
                  {otherCategories.map((c) => (
                    <option key={c.name} value={c.name} className="bg-background text-foreground font-sans normal-case">
                       {c.displayName}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => onEditSkill(skill.name)}
                className="relative z-10 p-1.5 rounded text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                aria-label={`Edit ${skill.displayName}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onLaunch(skill.name)}
                className="relative z-10 text-[10px] font-mono font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 hover:bg-primary hover:text-primary-foreground rounded px-4 py-1.5 transition-all flex-shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              >
                Launch
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
