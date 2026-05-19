interface EnrichedSkill {
  name: string;
  displayName: string;
  categoryColor: string;
  useCount?: number;
}

interface FrequentSkillsProps {
  skills: EnrichedSkill[];
  onLaunch: (skillName: string) => void;
}

const PILL_COLORS: Record<string, string> = {
  indigo: "from-indigo-600 to-indigo-500",
  red: "from-red-600 to-red-500",
  purple: "from-purple-600 to-purple-500",
  amber: "from-amber-600 to-amber-500",
  cyan: "from-cyan-600 to-cyan-500",
  emerald: "from-emerald-600 to-emerald-500",
  violet: "from-violet-600 to-violet-500",
  blue: "from-blue-600 to-blue-500",
  orange: "from-orange-600 to-orange-500",
  pink: "from-pink-600 to-pink-500",
  teal: "from-teal-600 to-teal-500",
  rose: "from-rose-600 to-rose-500",
  green: "from-green-600 to-green-500",
  yellow: "from-yellow-600 to-yellow-500",
  gray: "from-gray-600 to-gray-500",
};

export function FrequentSkills({ skills, onLaunch }: FrequentSkillsProps) {
  const frequent = skills
    .filter((s) => (s.useCount ?? 0) >= 1)
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
    .slice(0, 6);

  if (frequent.length === 0) return null;

  return (
    <div>
      <div className="text-gray-500 text-[11px] uppercase tracking-wider mb-2">
        Frequently Used
      </div>
      <div className="flex gap-2 flex-wrap">
        {frequent.map((skill) => {
          const gradient =
            PILL_COLORS[skill.categoryColor] ?? PILL_COLORS.gray;
          return (
            <button
              key={skill.name}
              onClick={() => onLaunch(skill.name)}
              className={`bg-gradient-to-r ${gradient} text-white text-xs font-medium px-3 py-1.5 rounded-full hover:opacity-90 transition-opacity`}
            >
              {skill.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
