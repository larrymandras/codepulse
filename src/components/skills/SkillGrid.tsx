import { Pencil } from "lucide-react";

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

interface SkillGridProps {
  skills: EnrichedSkill[];
  editMode: boolean;
  onLaunch: (skillName: string) => void;
  onEditSkill?: (skillName: string) => void;
}

const COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-600/20 border-indigo-500/30",
  red: "bg-red-600/20 border-red-500/30",
  purple: "bg-purple-600/20 border-purple-500/30",
  amber: "bg-amber-600/20 border-amber-500/30",
  cyan: "bg-cyan-600/20 border-cyan-500/30",
  emerald: "bg-emerald-600/20 border-emerald-500/30",
  violet: "bg-violet-600/20 border-violet-500/30",
  blue: "bg-blue-600/20 border-blue-500/30",
  orange: "bg-orange-600/20 border-orange-500/30",
  pink: "bg-pink-600/20 border-pink-500/30",
  teal: "bg-teal-600/20 border-teal-500/30",
  rose: "bg-rose-600/20 border-rose-500/30",
  green: "bg-green-600/20 border-green-500/30",
  yellow: "bg-yellow-600/20 border-yellow-500/30",
  gray: "bg-gray-600/20 border-gray-500/30",
};

const ICON_BG_MAP: Record<string, string> = {
  indigo: "bg-indigo-600",
  red: "bg-red-600",
  purple: "bg-purple-600",
  amber: "bg-amber-600",
  cyan: "bg-cyan-600",
  emerald: "bg-emerald-600",
  violet: "bg-violet-600",
  blue: "bg-blue-600",
  orange: "bg-orange-600",
  pink: "bg-pink-600",
  teal: "bg-teal-600",
  rose: "bg-rose-600",
  green: "bg-green-600",
  yellow: "bg-yellow-600",
  gray: "bg-gray-600",
};

export function SkillGrid({
  skills,
  editMode,
  onLaunch,
  onEditSkill,
}: SkillGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {skills.map((skill) => {
        const colorClasses =
          COLOR_MAP[skill.categoryColor] ?? COLOR_MAP.gray;
        const iconBg =
          ICON_BG_MAP[skill.categoryColor] ?? ICON_BG_MAP.gray;
        const desc =
          skill.overrideDescription ?? skill.description ?? "";

        return (
          <button
            key={skill.name}
            data-skill={skill.name}
            onClick={() =>
              editMode ? onEditSkill?.(skill.name) : onLaunch(skill.name)
            }
            className={`relative text-left rounded-xl border p-4 transition-all hover:scale-[1.02] hover:shadow-lg ${colorClasses} ${
              editMode && skill.isAutoAssigned
                ? "border-dashed border-indigo-400"
                : ""
            }`}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div
                className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center text-xl`}
              >
                {skill.categoryIcon}
              </div>
              <div className="text-sm font-semibold text-white">
                {skill.displayName}
              </div>
              {desc && (
                <div className="text-xs text-gray-400 line-clamp-2">
                  {desc}
                </div>
              )}
            </div>
            {editMode && (
              <div className="absolute top-2 right-2 text-gray-500 hover:text-indigo-400">
                <Pencil className="w-3.5 h-3.5" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
