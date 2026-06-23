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
    <div className="mb-8">
      <h2 className="text-xs font-mono font-bold text-amber-400/80 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
        </span>
        Priority Assets
      </h2>
      
      <div className="flex flex-wrap gap-3">
        {favorites.map((skill) => {
          const hex = COLOR_HEX[skill.categoryColor] ?? COLOR_HEX.gray;
          return (
            <div
              key={skill.name}
              className="group relative flex items-center gap-3 rounded border bg-background/50 px-3 py-2 transition-all cursor-pointer overflow-hidden"
              style={{
                borderColor: `${hex}40`,
                boxShadow: `inset 0 0 15px ${hex}00`,
              }}
              onClick={() => onLaunch(skill.name)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = hex;
                e.currentTarget.style.boxShadow = `inset 0 0 15px ${hex}15, 0 0 10px ${hex}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${hex}40`;
                e.currentTarget.style.boxShadow = `inset 0 0 15px ${hex}00`;
              }}
            >
              {/* Scanline on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-1000 pointer-events-none" />
              
              <div className="flex items-center justify-center w-6 h-6 rounded bg-background border shadow-sm shrink-0" style={{ borderColor: `${hex}30` }}>
                <span className="text-base">{skill.categoryIcon}</span>
              </div>
              
              <div className="flex flex-col min-w-0 pr-4">
                <span className="text-sm font-mono font-bold text-white truncate">
                  {skill.displayName}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider truncate">
                  {skill.name}
                </span>
              </div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(skill.name);
                }}
                className="absolute right-2 shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-amber-400/20 hover:scale-110"
                aria-label="Remove from priority"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
              </button>
              
              {/* Corner tech accents */}
              <div className="absolute top-0 left-0 w-1 h-1 border-t border-l opacity-50 group-hover:opacity-100 transition-opacity" style={{ borderColor: hex }} />
              <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r opacity-50 group-hover:opacity-100 transition-opacity" style={{ borderColor: hex }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
