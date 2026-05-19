import { GripVertical } from "lucide-react";

interface SkillEntry {
  name: string;
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
}

interface UncategorizedSkillsProps {
  skills: SkillEntry[];
  onLaunch: (skillName: string) => void;
  onEditSkill: (skillName: string) => void;
}

export function UncategorizedSkills({
  skills,
  onLaunch,
  onEditSkill,
}: UncategorizedSkillsProps) {
  if (skills.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📦</span>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Uncategorized
        </h2>
        <span className="text-xs text-gray-500 bg-gray-800/60 rounded-full px-2 py-0.5">
          {skills.length}
        </span>
        <span className="text-xs text-gray-600 ml-2">
          Drag onto a category to assign
        </span>
      </div>
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
              className="flex items-center gap-3 bg-gray-800/50 border border-gray-700/50 rounded-lg px-4 py-3 hover:bg-gray-700/50 transition-colors group cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium text-sm truncate">
                  {skill.displayName}
                </div>
                {desc && (
                  <div className="text-gray-500 text-xs truncate">{desc}</div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onEditSkill(skill.name); }}
                className="text-xs text-gray-500 hover:text-indigo-400 transition-colors px-2 py-1"
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onLaunch(skill.name); }}
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
