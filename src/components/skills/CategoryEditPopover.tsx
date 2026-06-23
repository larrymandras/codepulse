import { useState } from "react";

const COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1",
  red: "#ef4444",
  purple: "#a855f7",
  amber: "#f59e0b",
  cyan: "#06b6d4",
  emerald: "#10b981",
  violet: "#8b5cf6",
  blue: "#3b82f6",
  orange: "#f97316",
  pink: "#ec4899",
  teal: "#14b8a6",
  rose: "#f43f5e",
  green: "#22c55e",
  yellow: "#eab308",
  gray: "#6b7280",
};

const COLORS = Object.keys(COLOR_HEX);

const EMOJI_PICKS = [
  "📋", "⚖️", "📈", "💼", "🌐", "🖥️", "⚡", "💻",
  "🔧", "🎨", "🧩", "🐛", "🚀", "🔍", "📦", "🎯",
];

interface CategoryEditPopoverProps {
  displayName: string;
  description: string;
  icon: string;
  color: string;
  onSave: (updates: {
    displayName: string;
    description: string;
    icon: string;
    color: string;
  }) => void;
  onCancel: () => void;
  onDelete: () => void;
  canDelete: boolean;
  isNew?: boolean;
}

export function CategoryEditPopover({
  displayName: initialName,
  description: initialDesc,
  icon: initialIcon,
  color: initialColor,
  onSave,
  onCancel,
  onDelete,
  canDelete,
  isNew = false,
}: CategoryEditPopoverProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl w-80 space-y-3">
      <h3 className="text-base font-semibold text-white">
        {isNew ? "New Category" : "Edit Category"}
      </h3>
      <div>
        <label className="text-sm text-gray-400 block mb-1">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-base text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 block mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-base text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-gray-400 block mb-1">Icon (emoji)</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-base text-white focus:border-indigo-500 focus:outline-none"
          maxLength={4}
        />
        <div className="flex gap-1 flex-wrap mt-1.5">
          {EMOJI_PICKS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setIcon(emoji)}
              className="w-7 h-7 text-base rounded hover:bg-gray-700 transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm text-gray-400 block mb-1">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: COLOR_HEX[c] }}
              className={`w-6 h-6 rounded-full ${
                color === c
                  ? "ring-2 ring-white ring-offset-2 ring-offset-gray-900"
                  : ""
              }`}
              title={c}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ displayName, description, icon, color })}
          className="flex-1 bg-indigo-600 text-white text-base py-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-800 text-gray-300 text-base py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={`w-full text-sm py-1.5 rounded-lg transition-colors ${
          canDelete
            ? "text-red-400 hover:bg-red-900/30"
            : "text-gray-600 cursor-not-allowed"
        }`}
      >
        Delete
      </button>
    </div>
  );
}
