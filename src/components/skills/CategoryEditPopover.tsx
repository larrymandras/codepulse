import { useState } from "react";
import { COLOR_HEX } from "@/lib/categoryColors";

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
    <div className="bg-card border border-border rounded-xl p-4 shadow-2xl w-80 space-y-3">
      <h3 className="text-base font-semibold text-foreground">
        {isNew ? "New Category" : "Edit Category"}
      </h3>
      <div>
        <label className="text-sm text-muted-foreground block mb-1">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-base text-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground block mb-1">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-base text-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground block mb-1">Icon (emoji)</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-base text-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 focus:outline-none"
          maxLength={4}
        />
        <div className="flex gap-1 flex-wrap mt-1.5">
          {EMOJI_PICKS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setIcon(emoji)}
              className="w-7 h-7 text-base rounded hover:bg-muted transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm text-muted-foreground block mb-1">Color</label>
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
          className="flex-1 bg-primary text-primary-foreground text-base py-1.5 rounded-lg hover:bg-primary/80 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 bg-muted text-muted-foreground text-base py-1.5 rounded-lg hover:bg-muted/80 transition-colors"
        >
          Cancel
        </button>
      </div>
      {canDelete && (
        <button
          onClick={onDelete}
          className="w-full text-sm py-1.5 rounded-lg transition-colors text-destructive hover:bg-destructive/20"
        >
          Delete
        </button>
      )}
    </div>
  );
}
