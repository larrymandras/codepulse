import { useState } from "react";

interface CategoryOption {
  name: string;
  displayName: string;
  icon: string;
}

interface SkillEditPopoverProps {
  skillName: string;
  displayName: string;
  description: string;
  categoryName: string;
  hidden: boolean;
  categories: CategoryOption[];
  onSave: (updates: {
    displayName: string;
    description: string;
    categoryName: string;
    hidden: boolean;
  }) => void;
  onCancel: () => void;
}

export function SkillEditPopover({
  displayName: initialName,
  description: initialDesc,
  categoryName: initialCategory,
  hidden: initialHidden,
  categories,
  onSave,
  onCancel,
}: SkillEditPopoverProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [categoryName, setCategoryName] = useState(initialCategory);
  const [hidden, setHidden] = useState(initialHidden);

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
        <label className="text-xs text-gray-400 block mb-1">Category</label>
        <select
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.icon} {cat.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">Hidden</label>
        <button
          onClick={() => setHidden(!hidden)}
          className={`w-10 h-5 rounded-full transition-colors ${
            hidden ? "bg-indigo-600" : "bg-gray-700"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              hidden ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onSave({ displayName, description, categoryName, hidden })
          }
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
    </div>
  );
}
