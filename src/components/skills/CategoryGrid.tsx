import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";
import { CategoryCard } from "./CategoryCard";

type Category = Doc<"skillCategories">;

interface CategoryGridProps {
  categories: Category[];
  skillCounts: Record<string, number>;
  onSelectCategory: (categoryName: string) => void;
  onEditCategory: (category: Category) => void;
  onAddCategory: () => void;
  dropTargetCategory?: string | null;
  onDragOverCategory?: (categoryName: string) => void;
  onDragLeaveCategory?: () => void;
  onDropOnCategory?: (categoryName: string, e: React.DragEvent) => void;
}

export function CategoryGrid({
  categories,
  skillCounts,
  onSelectCategory,
  onEditCategory,
  onAddCategory,
  dropTargetCategory,
  onDragOverCategory,
  onDragLeaveCategory,
  onDropOnCategory,
}: CategoryGridProps) {
  const sorted = useMemo(
    () => [...categories].sort((a, b) => (skillCounts[b.name] ?? 0) - (skillCounts[a.name] ?? 0)),
    [categories, skillCounts]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((cat) => (
        <CategoryCard
          key={cat._id}
          category={cat}
          skillCount={skillCounts[cat.name] ?? 0}
          onSelect={(name) => onSelectCategory(name)}
          onEdit={() => onEditCategory(cat)}
          isDropTarget={dropTargetCategory === cat.name}
          onDragOver={(e) => {
            e.preventDefault();
            onDragOverCategory?.(cat.name);
          }}
          onDragLeave={() => onDragLeaveCategory?.()}
          onDrop={(e) => {
            e.preventDefault();
            onDropOnCategory?.(cat.name, e);
          }}
        />
      ))}

      <button
        onClick={onAddCategory}
        className="group relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-primary/60 transition-all duration-300 hover:border-primary hover:text-primary hover:bg-primary/10 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
        data-testid="add-category-card"
        style={{ minHeight: "160px" }}
      >
        {/* Subtle scanline on hover */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 overflow-hidden rounded-lg">
          <div className="w-full h-[1px] opacity-20 animate-scanline bg-primary" />
        </div>
        
        <Plus className="w-8 h-8 transition-transform duration-300 group-hover:scale-110" />
        <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Add Category</span>
      </button>
    </div>
  );
}
