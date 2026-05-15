import { Play } from "lucide-react";

interface SkillButtonProps {
  displayName: string;
  description?: string;
  onLaunch: () => void;
}

export function SkillButton({ displayName, description, onLaunch }: SkillButtonProps) {
  return (
    <button
      onClick={onLaunch}
      className="flex items-center gap-3 w-full p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:border-indigo-500/50 hover:bg-gray-700/50 transition-all duration-200 text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{displayName}</div>
        {description && (
          <div className="text-xs text-gray-400 truncate">{description}</div>
        )}
      </div>
      <Play className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
    </button>
  );
}
