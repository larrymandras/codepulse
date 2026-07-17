import { useState } from "react";
import { Star } from "lucide-react";

interface CategoryOption {
  name: string;
  displayName: string;
  icon: string;
}

interface SkillEditPopoverProps {
  skillName: string;
  displayName: string;
  originalDescription: string;
  description: string;
  categoryName: string;
  hidden: boolean;
  favorite: boolean;
  categories: CategoryOption[];
  onSave: (updates: {
    displayName: string;
    description: string;
    categoryName: string;
    hidden: boolean;
    favorite: boolean;
  }) => void;
  onCancel: () => void;
}

export function SkillEditPopover({
  skillName,
  displayName: initialName,
  originalDescription,
  description: initialDesc,
  categoryName: initialCategory,
  hidden: initialHidden,
  favorite: initialFavorite,
  categories,
  onSave,
  onCancel,
}: SkillEditPopoverProps) {
  const [displayName, setDisplayName] = useState(initialName);
  const [description, setDescription] = useState(initialDesc);
  const [categoryName, setCategoryName] = useState(initialCategory);
  const [hidden, setHidden] = useState(initialHidden);
  const [favorite, setFavorite] = useState(initialFavorite);

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-2xl w-80 space-y-3">
      {/* About — read-only original description */}
      <div className="bg-muted/60 border border-border/50 rounded-lg px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-mono uppercase tracking-widest text-muted-foreground/70 font-bold">About</label>
          <span className="text-[11px] font-mono text-muted-foreground/70 border border-border/50 rounded px-1.5 py-0.5">{skillName}</span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {originalDescription || "No description available from skill registry."}
        </p>
      </div>
      <div>
        <label className="text-sm text-muted-foreground block mb-1">Display Name</label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-base text-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground block mb-1">Custom Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={originalDescription ? "Override the default..." : "Add a description..."}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground block mb-1">Category</label>
        <select
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-base text-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 focus:outline-none"
        >
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.icon} {cat.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Star className={`w-3.5 h-3.5 ${favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/70"}`} />
          Favorite
        </label>
        <button
          onClick={() => setFavorite(!favorite)}
          className={`w-10 h-5 rounded-full transition-colors ${
            favorite ? "bg-amber-500" : "bg-muted"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-background transition-transform ${
              favorite ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Hidden</label>
        <button
          onClick={() => setHidden(!hidden)}
          className={`w-10 h-5 rounded-full transition-colors ${
            hidden ? "bg-primary" : "bg-muted"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-background transition-transform ${
              hidden ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() =>
            onSave({ displayName, description, categoryName, hidden, favorite })
          }
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
    </div>
  );
}
