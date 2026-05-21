import { Star } from "lucide-react";

interface EnrichedSkill {
  name: string;
  displayName: string;
  categoryIcon: string;
  categoryColor: string;
  favorite: boolean;
}

interface FavoriteSkillsProps {
  skills: EnrichedSkill[];
  onLaunch: (skillName: string) => void;
  onToggleFavorite: (skillName: string) => void;
}

const COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1", red: "#ef4444", purple: "#a855f7", amber: "#f59e0b",
  cyan: "#06b6d4", emerald: "#10b981", violet: "#8b5cf6", blue: "#3b82f6",
  orange: "#f97316", pink: "#ec4899", teal: "#14b8a6", rose: "#f43f5e",
  green: "#22c55e", yellow: "#eab308", gray: "#6b7280",
};

export function FavoriteSkills({ skills, onLaunch, onToggleFavorite }: FavoriteSkillsProps) {
  const favorites = skills.filter((s) => s.favorite);

  if (favorites.length === 0) return null;

  return (
    <div>
      <h2 className="text-[10px] font-mono font-bold text-amber-400/70 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
        Favorites
      </h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
        {favorites.map((skill) => {
          const hex = COLOR_HEX[skill.categoryColor] ?? COLOR_HEX.gray;
          return (
            <div
              key={skill.name}
              className="group relative flex items-center gap-2 rounded border px-3 py-2 transition-all cursor-pointer hover:scale-[1.02]"
              style={{
                backgroundColor: hex + "12",
                borderColor: hex + "30",
                boxShadow: `0 0 10px ${hex}10`,
              }}
              onClick={() => onLaunch(skill.name)}
            >
              <span className="text-sm flex-shrink-0">{skill.categoryIcon}</span>
              <span className="text-xs font-mono font-bold text-white truncate flex-1">
                {skill.displayName}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(skill.name);
                }}
                className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/30"
                aria-label="Remove from favorites"
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
