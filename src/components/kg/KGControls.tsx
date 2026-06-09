import { Search, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { entityTypeColor } from "../../lib/kg-graph";
import type { KgLens, KgFilters } from "../../hooks/useKnowledgeGraph";

const LENSES: { id: KgLens; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "Bounded top-N entities + relationships" },
  { id: "entity", label: "Entity (ego)", hint: "Search an entity → its ego graph" },
  { id: "temporal", label: "Temporal", hint: "Scrub an as-of date; superseded facts dashed" },
  { id: "contradiction", label: "Contradictions", hint: "Conflicting current beliefs" },
];

const ALL = "__all__";

export interface KGControlsProps {
  lens: KgLens;
  onLens: (l: KgLens) => void;
  filters: KgFilters;
  setFilter: <K extends keyof KgFilters>(key: K, value: KgFilters[K]) => void;
  entityTypes: string[];
  predicates: string[];
  loading: boolean;
  onRefresh: () => void;
}

export default function KGControls({
  lens,
  onLens,
  filters,
  setFilter,
  entityTypes,
  predicates,
  loading,
  onRefresh,
}: KGControlsProps) {
  return (
    <div className="space-y-3">
      {/* Lens switch */}
      <div className="flex flex-wrap items-center gap-1.5">
        {LENSES.map((l) => (
          <button
            key={l.id}
            onClick={() => onLens(l.id)}
            title={l.hint}
            aria-pressed={lens === l.id}
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-mono border transition-colors ${
              lens === l.id
                ? "bg-primary/15 border-primary/50 text-primary"
                : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {l.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="font-mono text-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter row — lens-aware */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Entity search — entity lens only */}
        {lens === "entity" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={filters.entityName}
                onChange={(e) => setFilter("entityName", e.target.value)}
                placeholder="Search entity by name…"
                className="pl-8 w-56 font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="whitespace-nowrap">Hops {filters.hops}</span>
              <Slider
                value={[filters.hops]}
                min={1}
                max={3}
                step={1}
                onValueChange={(v) => setFilter("hops", v[0])}
                className="w-24"
                aria-label="ego hops"
              />
            </div>
          </div>
        )}

        {/* As-of scrubber — temporal lens only */}
        {lens === "temporal" && (
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <label htmlFor="kg-asof" className="whitespace-nowrap">
              As of
            </label>
            <Input
              id="kg-asof"
              type="date"
              value={filters.asOf ? filters.asOf.slice(0, 10) : ""}
              onChange={(e) =>
                setFilter(
                  "asOf",
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                )
              }
              className="w-40 font-mono text-xs"
            />
            {filters.asOf && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setFilter("asOf", null)}
              >
                Now
              </Button>
            )}
          </div>
        )}

        {/* Entity-type filter — all lenses (acts client-side + server for overview) */}
        <Select
          value={filters.entityType ?? ALL}
          onValueChange={(v) => setFilter("entityType", v === ALL ? null : v)}
        >
          <SelectTrigger className="w-40 font-mono text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t} className="font-mono">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: entityTypeColor(t) }}
                  />
                  {t}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Predicate filter (client-side) */}
        <Select
          value={filters.predicate ?? ALL}
          onValueChange={(v) => setFilter("predicate", v === ALL ? null : v)}
        >
          <SelectTrigger className="w-44 font-mono text-xs">
            <SelectValue placeholder="All predicates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All predicates</SelectItem>
            {predicates.map((p) => (
              <SelectItem key={p} value={p} className="font-mono">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agent scope */}
        <Input
          value={filters.agentId ?? ""}
          onChange={(e) => setFilter("agentId", e.target.value || null)}
          placeholder="agent (blank = shared)"
          className="w-44 font-mono text-xs"
          aria-label="agent scope filter"
        />
      </div>
    </div>
  );
}
