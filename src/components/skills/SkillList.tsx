import { Pencil } from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";

type Category = Doc<"skillCategories">;

interface EnrichedSkill {
  _id: any;
  name: string;
  displayName: string;
  description?: string | null;
  overrideDescription?: string | null;
  categoryIcon: string;
  categoryColor: string;
  categoryName: string | null;
  hidden: boolean;
  isAutoAssigned: boolean;
  useCount?: number;
}

interface SkillListProps {
  skills: EnrichedSkill[];
  categories: Category[];
  editMode: boolean;
  onLaunch: (skillName: string) => void;
  onEditSkill?: (skillName: string) => void;
}

export function SkillList({
  skills,
  categories,
  editMode,
  onLaunch,
  onEditSkill,
}: SkillListProps) {
  const grouped = new Map<string, EnrichedSkill[]>();
  for (const skill of skills) {
    const cat = skill.categoryName ?? "uncategorized";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(skill);
  }

  return (
    <div className="space-y-6">
      {categories
        .filter((cat) => (grouped.get(cat.name)?.length ?? 0) > 0)
        .map((cat) => {
          const catSkills = grouped.get(cat.name) ?? [];
          return (
            <div key={cat.name}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700/50">
                <span className="text-lg">{cat.icon}</span>
                <div className="flex-1">
                  <div className="text-white text-sm font-semibold">
                    {cat.displayName}
                  </div>
                  {cat.description && (
                    <div className="text-gray-500 text-xs">
                      {cat.description}
                    </div>
                  )}
                </div>
                <span className="bg-gray-700/50 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                  {catSkills.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {catSkills.map((skill) => {
                  const desc =
                    skill.overrideDescription ?? skill.description ?? "";
                  return (
                    <button
                      key={skill.name}
                      data-skill={skill.name}
                      onClick={() =>
                        editMode
                          ? onEditSkill?.(skill.name)
                          : onLaunch(skill.name)
                      }
                      className={`text-left bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 hover:bg-gray-700/50 transition-colors ${
                        editMode && skill.isAutoAssigned
                          ? "border-dashed border-indigo-400"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-xs font-semibold truncate">
                            {skill.displayName}
                          </div>
                          {desc && (
                            <div className="text-gray-500 text-[11px] mt-0.5 truncate">
                              {desc}
                            </div>
                          )}
                        </div>
                        {editMode && (
                          <Pencil className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
