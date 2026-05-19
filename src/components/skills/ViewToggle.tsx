import { LayoutGrid, List } from "lucide-react";

export type SkillsView = "grid" | "list";

interface ViewToggleProps {
  view: SkillsView;
  onChange: (view: SkillsView) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="flex bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        title="Grid view"
        onClick={() => onChange("grid")}
        className={`p-1.5 transition-colors ${
          view === "grid"
            ? "bg-indigo-600 text-white"
            : "text-gray-500 hover:text-gray-300"
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        title="List view"
        onClick={() => onChange("list")}
        className={`p-1.5 transition-colors ${
          view === "list"
            ? "bg-indigo-600 text-white"
            : "text-gray-500 hover:text-gray-300"
        }`}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}
