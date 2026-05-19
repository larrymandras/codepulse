import { Settings } from "lucide-react";

interface EditModeToggleProps {
  editMode: boolean;
  onToggle: () => void;
}

export function EditModeToggle({ editMode, onToggle }: EditModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      title={editMode ? "Exit edit mode" : "Edit skills & categories"}
      className={`p-1.5 rounded-lg transition-colors ${
        editMode
          ? "bg-indigo-600 text-white"
          : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
      }`}
    >
      <Settings className="w-4 h-4" />
    </button>
  );
}
