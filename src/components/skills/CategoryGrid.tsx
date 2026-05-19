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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((cat) => (
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
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-600 p-6 text-gray-500 transition-colors hover:border-indigo-500 hover:text-indigo-400"
        data-testid="add-category-card"
        style={{ minHeight: "200px" }}
      >
        <Plus className="w-8 h-8" />
        <span className="text-sm font-medium">Add Category</span>
      </button>
    </div>
  );
}
