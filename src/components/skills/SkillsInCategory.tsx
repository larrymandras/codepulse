import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { categoryHex } from "@/lib/categoryColors";
import { SkillRow, type RowSkill } from "./SkillRow";

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
  skills: RowSkill[];
  categories: CategoryOption[];
  onBack: () => void;
  onRecordUse: (skillName: string) => void;
  onOpenInChat: (skillName: string) => void;
  onEditSkill: (skillName: string) => void;
  onReassignSkill: (skillName: string, newCategoryName: string) => void;
  onToggleFavorite: (skillName: string) => void;
}

export function SkillsInCategory({
  categoryName,
  categoryDisplayName,
  categoryIcon,
  categoryColor,
  skills,
  categories,
  onBack,
  onRecordUse,
  onOpenInChat,
  onEditSkill,
  onReassignSkill,
  onToggleFavorite,
}: SkillsInCategoryProps) {
  const hex = categoryHex(categoryColor);
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
          <h2 className="text-foreground text-base font-mono font-bold tracking-widest uppercase flex items-center gap-3">
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
              const catHex = categoryHex(cat.color);
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

      <div className="flex flex-col divide-y divide-primary/10 border-t border-b border-primary/20 bg-background/30">
        {skills.map((skill) => (
          <SkillRow
            key={skill.name}
            skill={skill}
            onRecordUse={onRecordUse}
            onOpenInChat={onOpenInChat}
            onEdit={onEditSkill}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
