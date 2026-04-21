import { Search } from "lucide-react";

const TIER_OPTIONS = [
  { value: undefined, label: "All" },
  { value: "command", label: "Command" },
  { value: "domain", label: "Domain" },
  { value: "shared", label: "Shared" },
] as const;

interface CatalogFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  tier: string | undefined;
  onTierChange: (t: string | undefined) => void;
}

export default function CatalogFilters({
  query,
  onQueryChange,
  tier,
  onTierChange,
}: CatalogFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search archetypes..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>
      <div className="flex items-center gap-1 bg-background/60 border border-border/40 rounded-lg p-0.5">
        {TIER_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onTierChange(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              tier === opt.value
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
