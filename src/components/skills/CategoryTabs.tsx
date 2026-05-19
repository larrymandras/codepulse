import { Doc } from "../../../convex/_generated/dataModel";

type Category = Doc<"skillCategories">;

interface CategoryTabsProps {
  categories: Category[];
  activeCategory: string | null;
  onSelect: (categoryName: string | null) => void;
  editMode: boolean;
  onEditCategory?: (category: Category) => void;
  onAddCategory?: () => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onSelect,
  editMode,
  onEditCategory,
  onAddCategory,
}: CategoryTabsProps) {
  const isAllActive = activeCategory === null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <div className="flex gap-1.5 flex-1 min-w-0">
        <button
          onClick={() => onSelect(null)}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
            isAllActive
              ? "bg-indigo-600 text-white"
              : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
          }`}
        >
          All
        </button>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.name;
          return (
            <div key={cat.name} className="relative flex items-center">
              <button
                onClick={() => onSelect(cat.name)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? `bg-indigo-600 text-white`
                    : "bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                }`}
              >
                {cat.icon} {cat.displayName}
              </button>
              {editMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCategory?.(cat);
                  }}
                  className="ml-1 p-0.5 text-gray-500 hover:text-indigo-400 transition-colors"
                  title={`Edit ${cat.displayName}`}
                >
                  ✏️
                </button>
              )}
            </div>
          );
        })}
        {editMode && (
          <button
            onClick={onAddCategory}
            className="px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap bg-gray-800/50 text-gray-500 hover:text-indigo-400 hover:bg-gray-700/50 border border-dashed border-gray-600 transition-colors"
          >
            + Add
          </button>
        )}
      </div>
    </div>
  );
}
