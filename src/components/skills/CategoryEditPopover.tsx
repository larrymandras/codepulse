import { useState } from "react";

const COLORS = [
  "indigo",
  "emerald",
  "amber",
  "red",
  "purple",
  "cyan",
  "pink",
  "orange",
  "gray",
  "violet",
];

const COLOR_CLASSES: Record<string, string> = {
  indigo: "bg-indigo-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  cyan: "bg-cyan-500",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  gray: "bg-gray-500",
  violet: "bg-violet-500",
};

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
}: CategoryEditPopoverProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [icon, setIcon] = useState(initialIcon);
  const [color, setColor] = useState(initialColor);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 shadow-2xl w-72 space-y-3">
      <div>
        <label className="text-xs text-gray-400 block mb-1">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Icon (emoji)</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          maxLength={4}
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full ${COLOR_CLASSES[c]} ${
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
          className="flex-1 bg-indigo-600 text-white text-sm py-1.5 rounded-lg hover:bg-indigo-500 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-800 text-gray-300 text-sm py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={`w-full text-xs py-1.5 rounded-lg transition-colors ${
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
