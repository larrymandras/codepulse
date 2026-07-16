import { useMemo } from "react";
import { Plus, Settings } from "lucide-react";
import { Doc } from "../../../convex/_generated/dataModel";
import { categoryHex } from "@/lib/categoryColors";

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
  selectedCategory?: string | null;
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
  selectedCategory,
}: CategoryGridProps) {
  const sorted = useMemo(
    () => [...categories].sort((a, b) => (skillCounts[b.name] ?? 0) - (skillCounts[a.name] ?? 0)),
    [categories, skillCounts]
  );

  return (
    <div className="flex flex-col gap-1 w-full">
      {sorted.map((cat) => {
        const hex = categoryHex(cat.color);
        const count = skillCounts[cat.name] ?? 0;
        const isActive = selectedCategory === cat.name;
        const isDropTarget = dropTargetCategory === cat.name;

        return (
          <div
            key={cat._id}
            data-testid="category-nav-item"
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('.edit-btn')) return;
              onSelectCategory(cat.name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectCategory(cat.name);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              onDragOverCategory?.(cat.name);
            }}
            onDragLeave={() => onDragLeaveCategory?.()}
            onDrop={(e) => {
              e.preventDefault();
              onDropOnCategory?.(cat.name, e);
            }}
            className={`group relative flex items-center gap-3 w-full px-3 py-2 rounded transition-all cursor-pointer overflow-hidden border ${
              isActive
                ? 'bg-primary/20 border-primary shadow-[var(--glow-xs)]'
                : isDropTarget
                ? 'bg-primary/30 border-dashed border-primary shadow-[var(--glow-sm)]'
                : 'bg-transparent border-transparent hover:bg-accent/50 hover:border-border'
            }`}
          >
            {/* Active glow indicator */}
            {isActive && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[var(--glow-sm)]" />
            )}

            <span className="text-lg flex-shrink-0">
              {cat.icon}
            </span>
            
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`text-sm font-mono font-bold truncate ${isActive ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors'}`}>
                {cat.displayName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="edit-btn opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-all focus:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCategory(cat);
                }}
                aria-label="Edit category"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              
              <span 
                className="text-xs font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0"
                style={{
                  color: isActive ? 'var(--primary-foreground)' : hex,
                  borderColor: isActive ? 'var(--primary-foreground)' : `${hex}50`,
                  backgroundColor: isActive ? hex : `${hex}10`,
                }}
              >
                {count}
              </span>
            </div>
          </div>
        );
      })}

      <button
        onClick={onAddCategory}
        className="mt-2 flex items-center gap-3 w-full px-3 py-2 rounded border border-dashed border-primary/30 text-primary/60 hover:text-primary hover:border-primary hover:bg-primary/10 transition-all group"
      >
        <Plus className="w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-90" />
        <span className="text-xs font-mono uppercase tracking-widest font-bold">New Category</span>
      </button>
    </div>
  );
}
