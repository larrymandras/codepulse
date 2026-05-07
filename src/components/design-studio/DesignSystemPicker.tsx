import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchDesignSystems } from "@/lib/openDesignApi";
import type { DesignSystem } from "@/lib/openDesignTypes";

interface DesignSystemPickerProps {
  selectedDesignSystemId: string | null;
  onSelect: (designSystemId: string) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-card/60 border border-border/40 rounded-xl p-4 animate-pulse">
      <div className="space-y-2 mb-3">
        <div className="h-4 w-3/4 rounded bg-muted/50" />
        <div className="h-3 w-1/3 rounded bg-muted/50" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted/50" />
        <div className="h-3 w-2/3 rounded bg-muted/50" />
      </div>
    </div>
  );
}

export default function DesignSystemPicker({
  selectedDesignSystemId,
  onSelect,
}: DesignSystemPickerProps) {
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    fetchDesignSystems()
      .then((data) => {
        setDesignSystems(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load design systems",
        );
        setLoading(false);
      });
  }, []);

  const categories = ["All", ...Array.from(new Set(designSystems.map((ds) => ds.category))).sort()];

  const filtered = designSystems
    .filter((ds) => {
      const matchesSearch =
        ds.title.toLowerCase().includes(search.toLowerCase()) ||
        ds.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        activeCategory === "All" || ds.category === activeCategory;
      return matchesSearch && matchesCategory;
    });

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder={`Search ${designSystems.length} design systems...`}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setVisibleCount(50);
        }}
        className="w-full px-3 py-2 text-sm bg-card/60 border border-border/40 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />

      {/* Category filter row */}
      {!loading && categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setVisibleCount(50);
              }}
              className={cn(
                "px-3 py-1 text-xs rounded-lg border transition-colors",
                cat === activeCategory
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "bg-card/60 text-muted-foreground border-border/40 hover:border-primary/30",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : visible.map((ds) => (
              <div
                key={ds.id}
                onClick={() => onSelect(ds.id)}
                role="radio"
                aria-checked={selectedDesignSystemId === ds.id}
                className={cn(
                  "bg-card/60 backdrop-blur-sm border rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-all",
                  selectedDesignSystemId === ds.id
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/40 hover:border-primary/40",
                )}
              >
                <h3 className="text-sm font-medium text-foreground">
                  {ds.title}
                </h3>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit">
                  {ds.category}
                </span>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {ds.summary}
                </p>
              </div>
            ))}
      </div>

      {!loading && !error && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No design systems match your filters
        </p>
      )}

      {!loading && !error && filtered.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((c) => c + 50)}
          className="w-full py-2 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          Show more design systems
        </button>
      )}
    </div>
  );
}
