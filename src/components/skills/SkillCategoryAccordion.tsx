import { ChevronRight } from "lucide-react";
import { SkillButton } from "./SkillButton";

interface SkillDisplay {
  name: string;
  displayName: string;
  description?: string;
}

interface SkillCategoryAccordionProps {
  category: string;
  skills: SkillDisplay[];
  isOpen: boolean;
  onToggle: () => void;
  onLaunchSkill: (skillName: string) => void;
}

export function SkillCategoryAccordion({
  category,
  skills,
  isOpen,
  onToggle,
  onLaunchSkill,
}: SkillCategoryAccordionProps) {
  return (
    <div className="rounded-lg bg-gray-800/50 border border-gray-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="flex items-center w-full px-4 py-3 hover:bg-gray-700/30 transition-colors"
      >
        <ChevronRight
          className={`w-4 h-4 text-gray-400 mr-3 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
        <span className="text-sm font-semibold text-white flex-1 text-left">
          {category}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
          {skills.length}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {skills.map((skill) => (
            <SkillButton
              key={skill.name}
              displayName={skill.displayName}
              description={skill.description}
              onLaunch={() => onLaunchSkill(skill.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
