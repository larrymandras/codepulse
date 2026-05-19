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
        className="flex items-center gap-3 rounded-xl px-5 py-4"
        style={{ backgroundColor: hex + "20" }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700/50 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-3xl">{categoryIcon}</span>
        <h2 className="text-white text-lg font-bold flex-1">
          {categoryDisplayName}
        </h2>
        <span className="text-xs font-medium text-gray-300 bg-gray-700/60 rounded-full px-2.5 py-0.5">
          {skills.length} {skills.length === 1 ? "skill" : "skills"}
        </span>
      </div>

      {/* Drop targets — always visible */}
      {otherCategories.length > 0 && (
        <div className="border border-gray-700/50 rounded-lg p-3 bg-gray-800/30">
          <p className="text-xs text-gray-500 mb-2">Drag a skill here to move it, or use the "Move to" dropdown:</p>
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-default ${
                    isHover ? "ring-2 ring-indigo-400 scale-105" : ""
                  }`}
                  style={{ backgroundColor: catHex + (isHover ? "40" : "18") }}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span className="text-xs font-medium text-gray-300">{cat.displayName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No skills in this category.
        </div>
      )}

      {/* Skill rows */}
      <div className="space-y-1">
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
              className="flex items-center gap-3 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-colors group"
            >
              <GripVertical className="w-4 h-4 text-gray-600 group-hover:text-gray-400 cursor-grab flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm truncate">
                  {skill.displayName}
                </div>
                {desc && (
                  <div className="text-gray-400 text-sm truncate">{desc}</div>
                )}
              </div>

              {(skill.useCount ?? 0) > 0 && (
                <span className="text-[11px] text-gray-400 bg-gray-700/60 rounded-full px-2 py-0.5 flex-shrink-0">
                  {skill.useCount} uses
                </span>
              )}

              {otherCategories.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onReassignSkill(skill.name, e.target.value);
                  }}
                  className="bg-gray-700/50 border border-gray-600 rounded text-xs text-gray-400 px-2 py-1 focus:outline-none focus:border-indigo-500 flex-shrink-0"
                  title="Move to category"
                >
                  <option value="">Move to...</option>
                  {otherCategories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.icon} {c.displayName}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => onEditSkill(skill.name)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-400 hover:bg-gray-700/50 transition-colors flex-shrink-0"
                aria-label={`Edit ${skill.displayName}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onLaunch(skill.name)}
                className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
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
