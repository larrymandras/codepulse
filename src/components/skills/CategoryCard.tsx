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
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-testid="category-edit-btn"]')) return;
        onSelect(category.name);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(category.name);
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative rounded-lg border p-5 cursor-pointer transition-all duration-300 ${
        isDropTarget ? "border-dashed scale-[1.03]" : "hover:scale-[1.02]"
      }`}
      style={{
        boxShadow: isDropTarget 
          ? `0 0 30px ${hex}40, inset 0 0 20px ${hex}20` 
          : `0 0 15px ${hex}10, inset 0 0 10px ${hex}05`,
        borderColor: isDropTarget ? `${hex}80` : `${hex}30`,
        backgroundColor: isDropTarget ? `${hex}15` : `${hex}05`,
        minHeight: "160px",
      }}
    >
      {/* Background scanline effect on hover */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden rounded-lg">
        <div className="w-full h-[1px] opacity-30 animate-scanline" style={{ backgroundColor: hex }} />
      </div>

      <button
        data-testid="category-edit-btn"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(category);
        }}
        className="absolute top-2 left-2 p-2.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-background/80 transition-colors z-20"
        aria-label={`Edit ${category.displayName}`}
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      <span 
        className="absolute top-3 right-3 text-xs font-mono font-bold uppercase tracking-widest rounded px-2 py-0.5 border text-white"
        style={{
          borderColor: `${hex}50`,
          backgroundColor: `${hex}30`,
        }}
      >
        {skillCount} {skillCount === 1 ? "skill" : "skills"}
      </span>

      <div className="flex flex-col items-center justify-center text-center gap-2.5 pt-6 relative z-10">
        <span 
          className="text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1"
          style={{ textShadow: `0 0 15px ${hex}80` }}
        >
          {category.icon}
        </span>
        <div className="text-sm font-bold font-mono uppercase tracking-widest text-white mt-1">
          {category.displayName}
        </div>
        {category.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 max-w-[90%] leading-relaxed">
            {category.description}
          </div>
        )}
      </div>

      {isDropTarget && (
        <div className="absolute inset-x-0 bottom-3 text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold" style={{ color: hex }}>
            Drop to assign
          </span>
        </div>
      )}
    </div>
  );
}
