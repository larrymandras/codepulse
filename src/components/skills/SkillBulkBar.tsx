import { useState } from "react";
import { Star, FolderInput, Archive, X } from "lucide-react";

export interface BulkCategoryOption {
  name: string;
  displayName: string;
}

interface SkillBulkBarProps {
  count: number;
  categories: BulkCategoryOption[];
  onFavorite: () => void;
  onMoveToCategory: (categoryName: string) => void;
  onArchive: () => void;
  onClear: () => void;
}

/**
 * SkillBulkBar — the batch-action bar shown when one or more rows are selected
 * (control-surface redesign, increment 3). Favorite and Move-to-category apply
 * immediately (both reversible); Archive is routed through a confirm in the
 * parent (real lifecycle mutation on live skills). Presentational only — the
 * parent owns selection state and every mutation.
 */
export function SkillBulkBar({
  count,
  categories,
  onFavorite,
  onMoveToCategory,
  onArchive,
  onClear,
}: SkillBulkBarProps) {
  const [moveOpen, setMoveOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="sticky bottom-0 z-10 mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 shadow-[var(--glow-sm)] backdrop-blur"
    >
      <span className="font-mono text-xs font-bold text-primary tabular-nums">
        {count} selected
      </span>
      <span className="text-xs text-muted-foreground hidden sm:inline">Act on all at once</span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onFavorite}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground/80 hover:border-amber-400/50 hover:text-amber-400 transition-colors"
        >
          <Star className="w-3.5 h-3.5" /> Favorite
        </button>

        {/* Move-to-category: a tiny inline picker so the bar stays self-contained. */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={moveOpen}
            onClick={() => setMoveOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground/80 hover:border-primary/50 hover:text-primary transition-colors"
          >
            <FolderInput className="w-3.5 h-3.5" /> Move…
          </button>
          {moveOpen && (
            <div
              role="listbox"
              className="absolute bottom-full right-0 mb-1 max-h-64 w-52 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg"
            >
              {categories.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No categories</p>
              ) : (
                categories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      setMoveOpen(false);
                      onMoveToCategory(c.name);
                    }}
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-foreground/85 hover:bg-primary/15 hover:text-primary transition-colors"
                  >
                    {c.displayName}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onArchive}
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15 transition-colors"
        >
          <Archive className="w-3.5 h-3.5" /> Archive
        </button>

        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
