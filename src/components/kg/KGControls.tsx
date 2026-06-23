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
import KGViewsPopover from "./KGViewsPopover";
import KGDiffControls from "./KGDiffControls";
import KGAnimateControls from "./KGAnimateControls";
import type { SavedKgView } from "../../hooks/useSavedViews";
import type { Id } from "../../../convex/_generated/dataModel";

const LENSES: { id: KgLens; label: string; hint: string }[] = [
  { id: "overview", label: "Overview", hint: "Bounded top-N entities + relationships" },
  { id: "entity", label: "Entity (ego)", hint: "Search an entity → its ego graph" },
  { id: "temporal", label: "Temporal", hint: "Scrub an as-of date; superseded facts dashed" },
  { id: "contradiction", label: "Contradictions", hint: "Conflicting current beliefs" },
  // 5th lens — Phase 86 KG-08 full-text search
  { id: "search", label: "Search", hint: "Full-text across fact text + relationship labels" },
];

const ALL = "__all__";

export type TemporalSubMode = "point" | "diff" | "animate";

export interface KGControlsProps {
  lens: KgLens;
  onLens: (l: KgLens) => void;
  filters: KgFilters;
  setFilter: <K extends keyof KgFilters>(key: K, value: KgFilters[K]) => void;
  entityTypes: string[];
  predicates: string[];
  loading: boolean;
  onRefresh: () => void;
  // Saved-views surface (KG-10)
  views: SavedKgView[];
  activeViewId: string | null;
  onLoadView: (view: SavedKgView) => void;
  onDeleteView: (id: Id<"savedKgViews">) => void;
  onCopyLink: (shareToken: string) => void;
  onSaveView: (name: string) => void;
  // Temporal sub-mode toggle (KG-11, Plan 03)
  temporalSubMode: TemporalSubMode;
  onSubMode: (m: TemporalSubMode) => void;
  // Diff controls (KG-11, Plan 03)
  diffDateA: string | null;
  diffDateB: string | null;
  onChangeDiffDateA: (d: string | null) => void;
  onChangeDiffDateB: (d: string | null) => void;
  onCompare: () => void;
  diffLoading: boolean;
  // Animate controls (KG-11, Plan 04)
  animRangeStart: string | null;
  animRangeEnd: string | null;
  animInterval: "day" | "week" | "month";
  onChangeAnimRange: (start: string | null, end: string | null) => void;
  onChangeAnimInterval: (i: "day" | "week" | "month") => void;
  animFrames: string[];
  animCurrentFrameIndex: number;
  animIsPlaying: boolean;
  animFps: number;
  animFrameError: string | null;
  onAnimPlay: () => void;
  onAnimPause: () => void;
  onAnimStepBack: () => void;
  onAnimStepForward: () => void;
  onAnimSetFrameIndex: (i: number) => void;
  onAnimSetFps: (n: number) => void;
}

const TEMPORAL_SUB_MODES: { id: TemporalSubMode; label: string }[] = [
  { id: "point", label: "Point" },
  { id: "diff", label: "Diff" },
  { id: "animate", label: "Animate" },
];

export default function KGControls({
  lens,
  onLens,
  filters,
  setFilter,
  entityTypes,
  predicates,
  loading,
  onRefresh,
  views,
  activeViewId,
  onLoadView,
  onDeleteView,
  onCopyLink,
  onSaveView,
  temporalSubMode,
  onSubMode,
  diffDateA,
  diffDateB,
  onChangeDiffDateA,
  onChangeDiffDateB,
  onCompare,
  diffLoading,
  animRangeStart,
  animRangeEnd,
  animInterval,
  onChangeAnimRange,
  onChangeAnimInterval,
  animFrames,
  animCurrentFrameIndex,
  animIsPlaying,
  animFps,
  animFrameError,
  onAnimPlay,
  onAnimPause,
  onAnimStepBack,
  onAnimStepForward,
  onAnimSetFrameIndex,
  onAnimSetFps,
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
            className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-mono border transition-colors ${
              lens === l.id
                ? "bg-primary/15 border-primary/50 text-primary"
                : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {l.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <KGViewsPopover
            views={views}
            activeViewId={activeViewId}
            onLoadView={onLoadView}
            onDeleteView={onDeleteView}
            onCopyLink={onCopyLink}
            onSaveView={onSaveView}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="font-mono text-sm"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Temporal sub-mode toggle (KG-11) — appears only when lens === "temporal" */}
      {lens === "temporal" && (
        <div className="flex items-center gap-1.5">
          {TEMPORAL_SUB_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onSubMode(m.id)}
              aria-pressed={temporalSubMode === m.id}
              className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-mono uppercase tracking-wide border transition-colors ${
                temporalSubMode === m.id
                  ? "bg-primary/15 border-primary/50 text-primary"
                  : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

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
                className="pl-8 w-56 font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
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

        {/* Full-text search input — search lens only (SC#1: mutually exclusive with entity-name input) */}
        {lens === "search" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filters.searchQuery}
              onChange={(e) => setFilter("searchQuery", e.target.value)}
              placeholder="Search facts & relationships…"
              className="pl-8 w-64 font-mono text-sm"
              aria-label="full-text knowledge graph search"
            />
          </div>
        )}

        {/* Temporal lens body — branches by sub-mode */}
        {lens === "temporal" && temporalSubMode === "point" && (
          /* Point sub-mode: existing single as-of behavior — NO REGRESSION (SC) */
          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
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
              className="w-40 font-mono text-sm"
            />
            {filters.asOf && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-sm"
                onClick={() => setFilter("asOf", null)}
              >
                Now
              </Button>
            )}
          </div>
        )}

        {lens === "temporal" && temporalSubMode === "diff" && (
          /* Diff sub-mode: From/To date pickers + Compare button */
          <KGDiffControls
            dateA={diffDateA}
            dateB={diffDateB}
            onChangeA={onChangeDiffDateA}
            onChangeB={onChangeDiffDateB}
            onCompare={onCompare}
            loading={diffLoading}
          />
        )}

        {/* Animate sub-mode: KGAnimateControls (KG-11, Plan 04) */}
        {lens === "temporal" && temporalSubMode === "animate" && (
          <KGAnimateControls
            rangeStart={animRangeStart}
            rangeEnd={animRangeEnd}
            interval={animInterval}
            onChangeRange={onChangeAnimRange}
            onChangeInterval={onChangeAnimInterval}
            frames={animFrames}
            currentFrameIndex={animCurrentFrameIndex}
            isPlaying={animIsPlaying}
            fps={animFps}
            frameError={animFrameError}
            onPlay={onAnimPlay}
            onPause={onAnimPause}
            onStepBack={onAnimStepBack}
            onStepForward={onAnimStepForward}
            onSetFrameIndex={onAnimSetFrameIndex}
            onSetFps={onAnimSetFps}
          />
        )}

        {/* Entity-type filter — all lenses (acts client-side + server for overview) */}
        <Select
          value={filters.entityType ?? ALL}
          onValueChange={(v) => setFilter("entityType", v === ALL ? null : v)}
        >
          <SelectTrigger className="w-40 font-mono text-sm">
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
          <SelectTrigger className="w-44 font-mono text-sm">
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
          className="w-44 font-mono text-sm"
          aria-label="agent scope filter"
        />
      </div>
    </div>
  );
}
