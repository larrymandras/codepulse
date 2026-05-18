import { Zap } from "lucide-react";

interface SkillLike {
  name: string;
  description?: string;
  useCount?: number;
}

interface FrequentSkillsProps {
  skills: SkillLike[];
  onLaunchSkill: (name: string) => void;
}

const MAX_FREQUENT = 6;

export function FrequentSkills({ skills, onLaunchSkill }: FrequentSkillsProps) {
  const frequent = skills
    .filter((s) => (s.useCount ?? 0) >= 1)
    .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
    .slice(0, MAX_FREQUENT);

  if (frequent.length === 0) return null;

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5" />
        Frequently Used
      </h2>
      <div className="flex flex-wrap gap-2">
        {frequent.map((skill) => (
          <button
            key={skill.name}
            onClick={() => onLaunchSkill(skill.name)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 hover:border-indigo-500/50 transition-all text-sm text-indigo-300"
          >
            {skill.name}
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-600/30 text-indigo-400">
              {skill.useCount}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
