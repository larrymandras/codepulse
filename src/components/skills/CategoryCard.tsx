import { Settings } from "lucide-react";

interface Category {
  _id: any;
  name: string;
  displayName: string;
  description?: string | null;
  icon: string;
  color: string;
}

interface CategoryCardProps {
  category: Category;
  skillCount: number;
  onSelect: (categoryName: string) => void;
  onEdit: (category: Category) => void;
  isDropTarget?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

const COLOR_HEX: Record<string, string> = {
  indigo: "#6366f1", red: "#ef4444", purple: "#a855f7", amber: "#f59e0b",
  cyan: "#06b6d4", emerald: "#10b981", violet: "#8b5cf6", blue: "#3b82f6",
  orange: "#f97316", pink: "#ec4899", teal: "#14b8a6", rose: "#f43f5e",
  green: "#22c55e", yellow: "#eab308", gray: "#6b7280",
};

export function CategoryCard({
  category,
  skillCount,
  onSelect,
  onEdit,
  isDropTarget = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: CategoryCardProps) {
  const hex = COLOR_HEX[category.color] ?? COLOR_HEX.gray;

  return (
    <div
      data-testid="category-card"
      data-category={category.name}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(category.name)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(category.name);
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative rounded-xl border p-5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg ${
        isDropTarget
          ? "border-2 border-dashed border-indigo-400 scale-[1.03] shadow-lg shadow-indigo-500/20"
          : "border border-gray-700/50"
      }`}
      style={{
        backgroundColor: hex + (isDropTarget ? "30" : "15"),
        minHeight: "200px",
      }}
    >
      <button
        data-testid="category-edit-btn"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(category);
        }}
        className="absolute top-3 left-3 p-1.5 rounded-lg text-gray-400 hover:text-indigo-400 hover:bg-gray-700/50 transition-colors"
        aria-label={`Edit ${category.displayName}`}
      >
        <Settings className="w-4 h-4" />
      </button>

      <span className="absolute top-3 right-3 text-xs font-medium text-gray-300 bg-gray-700/60 rounded-full px-2.5 py-0.5">
        {skillCount} {skillCount === 1 ? "skill" : "skills"}
      </span>

      <div className="flex flex-col items-center justify-center text-center gap-2 pt-6">
        <span className="text-3xl">{category.icon}</span>
        <div className="text-base font-bold text-white">
          {category.displayName}
        </div>
        {category.description && (
          <div className="text-sm text-gray-400 line-clamp-2">
            {category.description}
          </div>
        )}
      </div>

      {isDropTarget && (
        <div className="absolute inset-x-0 bottom-3 text-center">
          <span className="text-xs text-indigo-300 font-medium">Drop here to assign</span>
        </div>
      )}
    </div>
  );
}
