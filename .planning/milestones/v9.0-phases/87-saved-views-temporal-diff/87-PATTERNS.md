# Phase 87: Saved Views + Temporal Diff — Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `convex/savedKgViews.ts` | service/Convex module | CRUD | `convex/teamPresets.ts` | exact |
| `convex/schema.ts` (modify) | config | CRUD | `convex/schema.ts` lines 1343-1352 (`teamPresets` table) | exact |
| `src/hooks/useSavedViews.ts` | hook | CRUD | `src/hooks/useTeamPresets.ts` | exact |
| `src/hooks/useKgDiff.ts` | hook | request-response | `src/hooks/useKnowledgeGraph.ts` (fetch + error gate pattern) | role-match |
| `src/hooks/useKgAnimation.ts` | hook | streaming/batch | `src/hooks/useKnowledgeGraph.ts` (reqRef monotonic token + fetch) | role-match |
| `src/components/kg/KGViewsPopover.tsx` | component | request-response | `src/components/ConnectionPopover.tsx` | exact |
| `src/components/kg/KGDiffControls.tsx` | component | request-response | `src/components/kg/KGControls.tsx` (temporal as-of row, lines 125-156) | exact |
| `src/components/kg/KGAnimateControls.tsx` | component | streaming | `src/components/kg/KGControls.tsx` (Slider pattern, lines 96-108) | role-match |
| `src/components/kg/KGControls.tsx` (modify) | component | request-response | `src/components/kg/KGControls.tsx` self (lens tab active style lines 57-64) | self-modify |
| `src/pages/KnowledgeGraph.tsx` (modify) | page | request-response | `src/pages/KnowledgeGraph.tsx` self (`?focus` guard lines 99-124, paintNode lines 212-256) | self-modify |
| `src/lib/kgApi.ts` (modify — add `fetchOverview` asOf call sites) | utility | request-response | `src/lib/kgApi.ts` self (lines 198-207) | self-modify |

---

## Pattern Assignments

---

### `convex/savedKgViews.ts` (Convex module, CRUD)

**Analog:** `convex/teamPresets.ts`

**Imports pattern** (`convex/teamPresets.ts` lines 1-2):
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
```

**Core CRUD pattern — list with index, insert, delete** (`convex/teamPresets.ts` lines 4-54, condensed):
```typescript
export const create = mutation({
  args: {
    name: v.string(),
    // ... typed args
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("teamPresets", {
      name: args.name,
      createdAt: Date.now() / 1000,
      // ...
    });
  },
});

export const remove = mutation({
  args: { id: v.id("teamPresets") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("teamPresets").collect();
  },
});
```

**Pattern delta for `savedKgViews.ts`:**
- `list` must use `.withIndex("by_createdAt").order("desc").collect()` — not a bare `.collect()` — so views appear newest-first.
- Add a `getByShareToken` query using `.withIndex("by_shareToken", q => q.eq("shareToken", args.shareToken)).first()` — no analog in teamPresets (single-field index lookup is established in `convex/schema.ts` lines 1366-1367 `by_requestId` on `approvalQueue`).
- `save` mutation args must include `shareToken: v.string()` — generate the UUID client-side in `useSavedViews` before calling the mutation (see RESEARCH.md Open Question 1).
- The `filters` arg should be typed as `v.any()` for flexibility (same as `rosterViewPrefs.ts` line 9), not a strict `v.object({...})`, unless the planner wants validator coverage on the shape.

---

### `convex/schema.ts` — `savedKgViews` table addition

**Analog:** `convex/schema.ts` lines 1343-1352 (`teamPresets` table definition with named index):
```typescript
// convex/schema.ts lines 1343-1352
teamPresets: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  agentIds: v.array(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  createdBy: v.optional(v.string()),
  lastUsedAt: v.optional(v.number()),
  warRoomCount: v.optional(v.number()),
}).index("by_name", ["name"]),
```

**Apply this shape for `savedKgViews`** (per D-05, RESEARCH.md Code Examples):
```typescript
savedKgViews: defineTable({
  name: v.string(),
  lens: v.string(),                          // KgLens value
  filters: v.any(),                          // KgFilters minus searchQuery
  focus: v.string(),                         // entityName for Entity/Temporal (D-05)
  hops: v.float64(),                         // hop depth (D-05)
  shareToken: v.string(),                    // opaque random UUID (D-03)
  createdAt: v.float64(),
})
  .index("by_shareToken", ["shareToken"])    // getByShareToken lookup
  .index("by_createdAt", ["createdAt"]),     // list newest-first
```

**Insertion point:** Add after the `kgSummary` table (around line 1028) — keeps KG-related tables co-located.

---

### `src/hooks/useSavedViews.ts` (hook, CRUD)

**Analog:** `src/hooks/useTeamPresets.ts` — exact structural match.

**Imports pattern** (`useTeamPresets.ts` lines 1-4):
```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
```

**Interface pattern** (`useTeamPresets.ts` lines 10-21):
```typescript
export interface TeamPreset {
  _id: Id<"teamPresets">;
  _creationTime: number;
  name: string;
  // ... domain fields
}
```
Mirror as:
```typescript
export interface SavedKgView {
  _id: Id<"savedKgViews">;
  _creationTime: number;
  name: string;
  lens: string;
  filters: Record<string, unknown>;   // KgFilters minus searchQuery
  focus: string;
  hops: number;
  shareToken: string;
  createdAt: number;
}
```

**Hook pattern — useQuery + useMutation + toast** (`useTeamPresets.ts` lines 27-97):
```typescript
export function useTeamPresets() {
  const teams = useQuery(api.teamPresets.list) as TeamPreset[] | undefined;
  const createMutation = useMutation(api.teamPresets.create);
  const removeMutation = useMutation(api.teamPresets.remove);

  const create = async (args: { name: string; ... }) => {
    try {
      const id = await createMutation(args);
      toast.success("Team created");
      return id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
      throw err;
    }
  };

  const remove = async (id: Id<"teamPresets">) => {
    try {
      await removeMutation({ id });
      toast.success("Team deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete team");
      throw err;
    }
  };

  return { teams: teams ?? [], isLoading: teams === undefined, create, remove };
}
```

**Pattern deltas for `useSavedViews`:**
- Toast messages per UI-SPEC Copywriting: `toast.success(\`View "${name}" saved\`)`, `toast.success("View link copied")`. No toast on delete (silent per UI-SPEC).
- `saveView(name, lens, filters, focus, hops)` must strip `searchQuery` before calling the mutation: `const { searchQuery: _sq, ...persistable } = filters;` (mirrors `useKnowledgeGraph.ts` line 149).
- Generate `shareToken` client-side: `const shareToken = crypto.randomUUID();` before calling mutation (RESEARCH.md Pattern 3).
- Expose `buildShareUrl(shareToken: string): string` returning `${window.location.origin}/knowledge-graph?view=${shareToken}`.
- The `delete` action should be silent (no toast) per UI-SPEC Copywriting Contract ("single trash-icon click, no confirmation").
- `useQuery(api.savedKgViews.list)` result is `undefined` while Convex is loading — the hook must expose `isLoading: views === undefined` for the `?view` hydration guard (RESEARCH.md Pitfall 1).

---

### `src/hooks/useKgDiff.ts` (hook, request-response)

**Analog:** `src/hooks/useKnowledgeGraph.ts` fetch + error-gate pattern (lines 101-230, not fully read here — use the pattern skeleton from RESEARCH.md).

**Imports pattern** — copy from `src/pages/KnowledgeGraph.tsx` lines 18-19:
```typescript
import { fetchOverview } from "../lib/kgApi";
import { AstridrApiError } from "../lib/astridrApi";
import { toGraphData, normalizeOverview, type KgGraphData } from "../lib/kg-graph";
```

**Core pattern — dual parallel fetch + graceful-degrade** (RESEARCH.md Code Examples):
```typescript
// Monotonic token for stale-drop (mirror useKnowledgeGraph.ts line 116)
const reqRef = useRef(0);

const compare = useCallback(async () => {
  if (!dateA || !dateB) return;
  const token = ++reqRef.current;
  setLoading(true);
  setError(null);
  try {
    const [respA, respB] = await Promise.all([
      fetchOverview({ asOf: dateA }),
      fetchOverview({ asOf: dateB }),
    ]);
    if (token !== reqRef.current) return;   // stale drop
    setGraphA(toGraphData(normalizeOverview(respA)));
    setGraphB(toGraphData(normalizeOverview(respB)));
  } catch (e) {
    if (token !== reqRef.current) return;
    // D-08 graceful-degrade
    setError(e instanceof AstridrApiError && e.status === 404
      ? `Could not load snapshot for ${dateA} or ${dateB}.`
      : "Could not reach Ástríðr.");
  } finally {
    if (token === reqRef.current) setLoading(false);
  }
}, [dateA, dateB]);
```

**Error handling pattern** — mirror `KnowledgeGraph.tsx` lines 321-330 (red-border banner for hard errors, inline copy for soft 404):
```typescript
// Red banner pattern from KnowledgeGraph.tsx:321-330:
{error && (
  <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3">
    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
    <div className="text-sm font-mono leading-relaxed">
      <p className="text-foreground">{error}</p>
    </div>
  </div>
)}
```

**Key export shape:**
```typescript
return { diff, graphB, loading, error, compare };
// diff: KgDiffSets | null  (added/removed/changed Sets over node.id + edge diff)
// graphB: KgGraphData | null  (the "To" snapshot, used for canvas render)
```

---

### `src/hooks/useKgAnimation.ts` (hook, batch/streaming)

**Analog:** `src/hooks/useKnowledgeGraph.ts` — reqRef monotonic token pattern (line 116) for stale-drop; `useEffect` with cleanup for playback timer.

**Imports pattern** — copy from `useKnowledgeGraph.ts` lines 1-7:
```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchOverview } from "../lib/kgApi";
import { toGraphData, normalizeOverview, type KgGraphData } from "../lib/kg-graph";
```

**Core pattern — LRU cache ref + prefetch + playback timer** (RESEARCH.md Pattern 5):
```typescript
const cacheRef = useRef<Map<string, KgGraphData>>(new Map());
const MAX_CACHE = 20;

// Monotonic token to drop stale in-flight frame fetches (mirrors useKnowledgeGraph.ts:116)
const frameReqRef = useRef(0);

// Playback timer via useEffect + setInterval (not requestAnimationFrame — 1fps cadence)
useEffect(() => {
  if (!isPlaying) return;
  const id = setInterval(() => {
    setCurrentFrameIndex((i) => Math.min(i + 1, frames.length - 1));
  }, 1000 / fps);
  return () => clearInterval(id);
}, [isPlaying, fps, frames.length]);
```

**Frame synthesis pattern** (D-07 — range + interval → evenly-spaced frames):
```typescript
// No fetchSnapshotDates(), no Ástríðr dependency (D-07)
const frames = useMemo(() => {
  if (!rangeStart || !rangeEnd) return [];
  // Synthesize evenly-spaced ISO date strings from rangeStart to rangeEnd
  const start = new Date(rangeStart).getTime();
  const end   = new Date(rangeEnd).getTime();
  const step  = intervalMs(interval);          // "day" | "week" | "month" → ms
  const result: string[] = [];
  for (let t = start; t <= end; t += step) {
    result.push(new Date(t).toISOString().slice(0, 10));
    if (result.length >= 60) break;            // cap for LRU sanity
  }
  return result;
}, [rangeStart, rangeEnd, interval]);
```

**Cache-check-before-fetch** (RESEARCH.md Pitfall 4):
```typescript
useEffect(() => {
  const key = frames[currentFrameIndex];
  if (!key) return;
  if (cacheRef.current.has(key)) {
    setCurrentGraph(cacheRef.current.get(key)!);
    return;
  }
  const token = ++frameReqRef.current;
  fetchOverview({ asOf: key })
    .then(resp => {
      if (token !== frameReqRef.current) return;   // stale drop
      const g = toGraphData(normalizeOverview(resp));
      cacheSet(key, g);
      setCurrentGraph(g);
    })
    .catch(/* D-08 graceful-degrade: set per-frame error, don't throw */);
}, [currentFrameIndex, frames]);
```

---

### `src/components/kg/KGViewsPopover.tsx` (component, CRUD)

**Analog:** `src/components/ConnectionPopover.tsx` — shadcn Popover usage (lines 170-266).

**Imports pattern** (`ConnectionPopover.tsx` lines 11-14):
```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
```
Add for this component:
```typescript
import { Bookmark, BookmarkPlus, Trash2, Link } from "lucide-react";
import { Input } from "@/components/ui/input";
```

**Core Popover pattern** (`ConnectionPopover.tsx` lines 171-181):
```typescript
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="sm" className="font-mono text-sm">
      <Bookmark className="h-3.5 w-3.5 mr-1.5" />
      Views
    </Button>
  </PopoverTrigger>

  <PopoverContent className="w-72 p-4" side="bottom" align="end">
    {/* Header */}
    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
      SAVED VIEWS
    </p>
    {/* scrollable list */}
    <div className="max-h-[320px] overflow-y-auto custom-scrollbar space-y-0.5">
      {/* KGViewRow items */}
    </div>
  </PopoverContent>
</Popover>
```

**View row pattern** — mirror `KGSearchResults.tsx` result-row (lines 135-158):
```typescript
// Source analog: KGSearchResults.tsx lines 135-158
<button
  onClick={() => onLoadView(view._id)}
  className={`w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer transition-colors rounded-[var(--radius-sm)] group ${
    activeViewId === view._id
      ? "border-l-2 border-primary bg-primary/5"
      : ""
  }`}
>
  <Bookmark className="h-3.5 w-3.5 text-primary/60 shrink-0" />
  <div className="min-w-0 flex-1">
    <p className="text-sm text-foreground truncate">{view.name}</p>
    <p className="text-xs font-mono text-muted-foreground">Saved {relativeTime(view.createdAt)}</p>
  </div>
  {/* hover-reveal action icons */}
  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
    <button
      onClick={(e) => { e.stopPropagation(); onCopyLink(view.shareToken); }}
      aria-label={`Copy link for ${view.name}`}
      className="p-1 hover:text-primary"
    >
      <Link className="h-3.5 w-3.5" />
    </button>
    <button
      onClick={(e) => { e.stopPropagation(); onDeleteView(view._id); }}
      aria-label={`Delete view ${view.name}`}
      className="p-1 text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  </div>
</button>
```

**Empty state pattern** — mirror `KGSearchResults.tsx` idle state (lines 101-111):
```typescript
<div className="flex flex-col items-center justify-center gap-2 text-center px-4 py-6">
  <Bookmark className="h-5 w-5 text-primary/30" />
  <p className="text-sm text-muted-foreground font-mono">No saved views yet</p>
  <p className="text-xs text-muted-foreground/60">
    Save the current lens, filters, and focus as a named view — retrieve it in any session.
  </p>
</div>
```

---

### `src/components/kg/KGDiffControls.tsx` (component, request-response)

**Analog:** `src/components/kg/KGControls.tsx` temporal as-of row (lines 125-156).

**Core date-picker pattern** (`KGControls.tsx` lines 125-156):
```typescript
// Source: KGControls.tsx lines 125-156 — temporal as-of Input pattern
{lens === "temporal" && (
  <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
    <label htmlFor="kg-asof" className="whitespace-nowrap">As of</label>
    <Input
      id="kg-asof"
      type="date"
      value={filters.asOf ? filters.asOf.slice(0, 10) : ""}
      onChange={(e) =>
        setFilter("asOf", e.target.value ? new Date(e.target.value).toISOString() : null)
      }
      className="w-40 font-mono text-sm"
    />
    {filters.asOf && (
      <Button variant="ghost" size="sm" className="h-7 px-2 text-sm"
        onClick={() => setFilter("asOf", null)}>
        Now
      </Button>
    )}
  </div>
)}
```

**Apply as `KGDiffControls`:**
```typescript
<div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
  <label className="whitespace-nowrap text-[10px] uppercase tracking-wide">From</label>
  <Input type="date" value={dateA ?? ""} onChange={...} className="w-40 font-mono text-sm" />
  <label className="whitespace-nowrap text-[10px] uppercase tracking-wide">To</label>
  <Input type="date" value={dateB ?? ""} onChange={...} className="w-40 font-mono text-sm" />
  <Button
    variant="secondary" size="sm" className="font-mono text-sm"
    disabled={!dateA || !dateB || dateA >= dateB}
    onClick={onCompare}
  >
    Compare
  </Button>
</div>
```

**Loading state pattern** — mirror `KnowledgeGraph.tsx` lines 431-435:
```typescript
// Source: KnowledgeGraph.tsx lines 431-435
<p className="text-primary/70 font-mono text-base animate-pulse">
  Querying knowledge graph…
</p>
// → For diff: "Diffing knowledge graph…" same classes
```

---

### `src/components/kg/KGAnimateControls.tsx` (component, streaming)

**Analog:** `src/components/kg/KGControls.tsx` Slider row (lines 96-108) + Select pattern (lines 159-198).

**Slider pattern** (`KGControls.tsx` lines 96-108):
```typescript
// Source: KGControls.tsx lines 96-108
<div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
  <span className="whitespace-nowrap">Hops {filters.hops}</span>
  <Slider
    value={[filters.hops]}
    min={1} max={3} step={1}
    onValueChange={(v) => setFilter("hops", v[0])}
    className="w-24"
    aria-label="ego hops"
  />
</div>
```

**Select pattern** (`KGControls.tsx` lines 159-180):
```typescript
// Source: KGControls.tsx lines 159-180
<Select value={...} onValueChange={...}>
  <SelectTrigger className="w-40 font-mono text-sm">
    <SelectValue placeholder="..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="0.5">0.5×</SelectItem>
    <SelectItem value="1">1×</SelectItem>
    <SelectItem value="2">2×</SelectItem>
  </SelectContent>
</Select>
```

**Button pattern** — copy ghost icon-button pattern from `KGControls.tsx` lines 67-78:
```typescript
// Source: KGControls.tsx lines 67-78
<Button variant="ghost" size="icon" onClick={...} aria-label="Play animation">
  <Play className="h-3.5 w-3.5" />
</Button>
```

**Apply as `KGAnimateControls`:**
```typescript
<div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
  <Button variant="ghost" size="icon" onClick={stepBack} aria-label="Step back">
    <StepBack className="h-3.5 w-3.5" />
  </Button>
  <Button variant="ghost" size="icon" onClick={isPlaying ? pause : play}
    aria-label={isPlaying ? "Pause animation" : "Play animation"}>
    {isPlaying ? <Pause className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5" />}
  </Button>
  <Button variant="ghost" size="icon" onClick={stepForward} aria-label="Step forward">
    <StepForward className="h-3.5 w-3.5" />
  </Button>
  <Slider
    value={[currentFrameIndex]}
    min={0} max={Math.max(frames.length - 1, 0)} step={1}
    onValueChange={([i]) => { pause(); setFrameIndex(i); }}
    className="flex-1 min-w-[120px]"
    aria-label="animation scrubber"
  />
  <span className="text-xs font-mono text-muted-foreground min-w-[80px]">
    {frames[currentFrameIndex] ?? "—"}
  </span>
  <span className="text-[10px] uppercase tracking-wide">Speed:</span>
  <Select value={String(fps)} onValueChange={(v) => setFps(Number(v))}>
    <SelectTrigger className="w-16 font-mono text-sm h-7">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="0.5">0.5×</SelectItem>
      <SelectItem value="1">1×</SelectItem>
      <SelectItem value="2">2×</SelectItem>
    </SelectContent>
  </Select>
</div>
```

---

### `src/components/kg/KGControls.tsx` (modify — Views/Save buttons + sub-mode toggle)

**Analog:** Self — existing lens tab pattern (lines 50-79).

**Lens tab active style** (`KGControls.tsx` lines 57-64) — reuse verbatim for sub-mode chips:
```typescript
// Source: KGControls.tsx lines 57-64
className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-mono border transition-colors ${
  lens === l.id
    ? "bg-primary/15 border-primary/50 text-primary"
    : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
}`}
```

**Refresh button placement** (`KGControls.tsx` lines 66-79) — Views + Save buttons slot in before Refresh in `ml-auto` group:
```typescript
// Source: KGControls.tsx lines 66-79
<div className="ml-auto">
  <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}
    className="font-mono text-sm">
    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
    Refresh
  </Button>
</div>
```
Modify to:
```typescript
<div className="ml-auto flex items-center gap-1.5">
  {/* Save view — inline expand on click */}
  {/* Views popover trigger */}
  <KGViewsPopover ... />
  {/* Refresh unchanged */}
  <Button variant="secondary" size="sm" ... />
</div>
```

**Props delta:** Add to `KGControlsProps`:
```typescript
onSaveView: () => void;           // triggers inline name-entry expand
onViews: () => void;              // open views popover (or handle inside component)
temporalSubMode: "point" | "diff" | "animate";
onSubMode: (m: "point" | "diff" | "animate") => void;
```

**Sub-mode toggle** — new secondary row under Temporal lens, same chip style:
```typescript
// Appears only when lens === "temporal"
{lens === "temporal" && (
  <div className="flex items-center gap-1.5">
    {(["point", "diff", "animate"] as const).map((m) => (
      <button key={m} onClick={() => onSubMode(m)} aria-pressed={temporalSubMode === m}
        className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-mono uppercase
          tracking-wide border transition-colors ${
          temporalSubMode === m
            ? "bg-primary/15 border-primary/50 text-primary"
            : "bg-card/60 border-border text-muted-foreground hover:text-foreground"
        }`}>
        {m}
      </button>
    ))}
  </div>
)}
```

---

### `src/pages/KnowledgeGraph.tsx` (modify — `?view` hydration + diff paint/legend)

**Analog:** Self — existing `?focus` guard (lines 99-124) and `paintNode` (lines 212-256).

**`?view` hydration guard** — copy and adapt `?focus` guard pattern (`KnowledgeGraph.tsx` lines 88-124):
```typescript
// Source: KnowledgeGraph.tsx lines 88-124 — mirror for ?view
const viewToken = searchParams.get("view");
const appliedViewRef = useRef(false);

useEffect(() => {
  if (!viewToken) return;
  if (appliedViewRef.current) return;
  if (!hydrated) return;              // wait for idb (from line 97-105)
  if (views === undefined) return;    // wait for Convex (RESEARCH Pitfall 1 — add this)

  const view = views.find(v => v.shareToken === viewToken);
  if (!view) return;                  // silent fallback, D-04

  appliedViewRef.current = true;
  appliedFocusRef.current = true;     // suppress ?focus guard (RESEARCH Pitfall 5)
  setLens(view.lens as KgLens);
  // apply each filter field via setFilter(k, v)
}, [viewToken, hydrated, views, setLens, setFilter]);
```

**`paintNodeDiff` function** — copy `paintNode` (lines 212-256), swap color logic:
```typescript
// Source: KnowledgeGraph.tsx lines 212-256 — copy full paintNode, modify color lines
const paintNodeDiff = useCallback(
  (node: any, ctx: CanvasRenderingContext2D, globalScale: number,
   opts: { hovered: boolean; dimmed: boolean },
   diffSets: { added: Set<string>; removed: Set<string>; changed: Set<string> }
  ) => {
    const n = node as KgNode & { x: number; y: number };
    const size = Math.max(n.val ?? 3, 3);
    const isSelected = n.id === selectedNodeId;

    // Diff color lookup (RESEARCH.md Pattern 6)
    const DIFF_COLORS = {
      added:     { fill: "#22c55e", alpha: 1.0 },
      removed:   { fill: "#ef4444", alpha: 1.0 },
      changed:   { fill: "#eab308", alpha: 1.0 },
      unchanged: { fill: n.color,   alpha: 0.35 },
    };
    const state = diffSets.added.has(n.id) ? "added"
      : diffSets.removed.has(n.id) ? "removed"
      : diffSets.changed.has(n.id) ? "changed"
      : "unchanged";
    const dc = DIFF_COLORS[state];

    ctx.globalAlpha = dc.alpha;   // 0.35 for unchanged (RESEARCH Pitfall 3)
    ctx.beginPath();
    ctx.arc(n.x, n.y, size, 0, 2 * Math.PI, false);
    ctx.shadowColor = dc.fill;
    ctx.shadowBlur = opts.hovered || isSelected ? 24 : 8;
    ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : dc.fill;
    ctx.fill();
    // ... rest identical to paintNode (selection ring, label, globalAlpha reset)
  },
  [selectedNodeId],
);
```

**Diff legend append** — extend existing legend div (`KnowledgeGraph.tsx` lines 379-429):
```typescript
// Append inside the legend div at line 429, after the existing legend entries:
{temporalSubMode === "diff" && diff && (
  <>
    <span className="mt-1 border-t border-border pt-1 text-muted-foreground uppercase tracking-wide text-[10px]">
      DIFF
    </span>
    {[
      { label: "added",     color: "#22c55e" },
      { label: "removed",   color: "#ef4444" },
      { label: "changed",   color: "#eab308" },
      { label: "unchanged", color: "#a1a1aa", alpha: 0.35 },
    ].map(({ label, color, alpha }) => (
      <span key={label} className="flex items-center gap-2 text-muted-foreground">
        <span className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: color, opacity: alpha ?? 1 }} />
        {label}
      </span>
    ))}
  </>
)}
```

**SectionErrorBoundary wrapping** (`KnowledgeGraph.tsx` lines 302-310) — wrap any new sub-mode panel in `<SectionErrorBoundary name="KG Diff">` / `<SectionErrorBoundary name="KG Animation">`.

---

### `src/lib/kgApi.ts` (modify — add `fetchOverview` asOf call sites)

**Analog:** Self — `fetchOverview` function (lines 198-207).

No new function needed. Both `useKgDiff` and `useKgAnimation` call the existing `fetchOverview({ asOf: dateString })` — the `OverviewParams.asOf` param is already typed as `string | null` (line 151). The only modification is documenting the diff/animation call sites in the file header comment block (lines 1-34). No source changes required if callers import directly.

---

## Shared Patterns

### One-Shot Guard (ref-based hydration)

**Source:** `src/hooks/useFocusParam.ts` lines 51-68 (generic) + `src/pages/KnowledgeGraph.tsx` lines 99-124 (in-page usage)

**Apply to:** `?view` hydration effect in `KnowledgeGraph.tsx`

```typescript
// Source: useFocusParam.ts lines 51-68
const appliedRef = useRef(false);

useEffect(() => {
  if (!focusParam) return;
  if (appliedRef.current) return;
  if (nodes === undefined) return;   // still loading

  appliedRef.current = true;
  // ... apply exactly once
}, [focusParam, nodes, getId, onFocus]);
```

The `?view` guard needs a THIRD condition (`views !== undefined`) not present in the `?focus` guard, because view resolution requires a Convex query result, not just idb hydration.

---

### searchQuery Exclusion from Persistence

**Source:** `src/hooks/useKnowledgeGraph.ts` line 149

```typescript
// Source: useKnowledgeGraph.ts line 149
const { searchQuery: _sq, ...persistableFilters } = filters;
idbSet(PERSIST_KEY, { lens, filters: persistableFilters } as PersistedState).catch(() => {});
```

**Apply to:** `useSavedViews.saveView()` before calling the Convex mutation (D-06).

---

### Graceful-Degrade Gate (AstridrApiError 404/501)

**Source:** `src/pages/KnowledgeGraph.tsx` lines 155-170 (search lens gate)

```typescript
// Source: KnowledgeGraph.tsx lines 155-170
} catch (e) {
  if (token !== searchReqRef.current) return;
  if (e instanceof AstridrApiError && (e.status === 404 || e.status === 501)) {
    setSearchGateState("not-deployed");
    setSearchResults([]);
  } else {
    setSearchGateState("error");
    setSearchErrorMessage(e instanceof Error ? e.message : "Unknown error");
  }
}
```

**Apply to:** `useKgDiff` and `useKgAnimation` per-frame fetch errors (D-08). Both hooks: catch `AstridrApiError` and set inline error copy; do not throw; keep other sub-modes working.

---

### Monotonic Request Token (stale-drop)

**Source:** `src/hooks/useKnowledgeGraph.ts` line 116

```typescript
// Source: useKnowledgeGraph.ts line 116
const reqRef = useRef(0);
// Inside async fetch:
const token = ++reqRef.current;
// After each await:
if (token !== reqRef.current) return;
```

**Apply to:** `useKgDiff.compare()` and `useKgAnimation` per-frame fetch effect (RESEARCH.md Pitfall 4).

---

### SectionErrorBoundary Wrapping

**Source:** `src/pages/KnowledgeGraph.tsx` lines 302-318

```typescript
// Source: KnowledgeGraph.tsx lines 302-318
<SectionErrorBoundary name="KG Summary">
  <KGSummaryCards />
</SectionErrorBoundary>
<SectionErrorBoundary name="KG Controls">
  <KGControls ... />
</SectionErrorBoundary>
```

**Apply to:** All new sub-panels: `KGViewsPopover`, `KGDiffControls`, `KGAnimateControls`.

---

### Toast Notifications via Sonner

**Source:** `src/hooks/useTeamPresets.ts` lines 43-50

```typescript
// Source: useTeamPresets.ts lines 43-50
import { toast } from "sonner";
// ...
toast.success("Team created");
// error path:
toast.error(err instanceof Error ? err.message : "Failed to create team");
```

**Apply to:** `useSavedViews` — `toast.success(\`View "${name}" saved\`)` on save; `toast.success("View link copied")` on share. `<Toaster />` is already mounted globally in `DashboardLayout.tsx` line 12 — no setup required.

---

### Popover (shadcn, Radix-backed)

**Source:** `src/components/ConnectionPopover.tsx` lines 171-266

```typescript
// Source: ConnectionPopover.tsx lines 171-181
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

<Popover>
  <PopoverTrigger asChild>
    <button ...>trigger</button>
  </PopoverTrigger>
  <PopoverContent className="w-[280px] p-3" side="top" align="start">
    {/* content */}
  </PopoverContent>
</Popover>
```

**Apply to:** `KGViewsPopover` — `w-72 p-4`, `side="bottom"`, `align="end"` to sit below the Views button aligned right.

---

## Test File Patterns

### Component test pattern

**Source:** `src/components/kg/KGControls.test.tsx` — full file read above.

Key conventions:
- `beforeAll` ResizeObserver mock (line 7-14) — required for Slider/Radix components in jsdom; copy verbatim into any test file using `Slider` or shadcn primitives.
- `renderControls(overrides)` helper pattern (lines 28-47) — define a `renderXxx(overrides)` factory per component to avoid boilerplate.
- `vi.fn()` for all callbacks (line 45), `screen.getByRole` / `screen.getByPlaceholderText` for queries.
- `fireEvent.click` / `fireEvent.change` for interactions.

**Apply to:** `KGViewsPopover.test.tsx` (CRUD interactions, share URL, empty state), `useKgDiff.test.ts` (pure diff function), `useKgAnimation.test.ts` (frame synthesis, LRU eviction).

---

## No Analog Found

All new files have close analogs in the codebase. No "no analog" entries.

However, the following patterns have **no existing precedent** and must be implemented fresh per RESEARCH.md:

| Pattern | File | Reason |
|---------|------|---------|
| `computeDiff()` pure function | `useKgDiff.ts` | No existing set-diff utility in codebase; implement as pure TypeScript (RESEARCH.md Pattern 4) |
| LRU cache via Map insertion-order | `useKgAnimation.ts` | No existing LRU in codebase; implement inline (RESEARCH.md Pattern 5) |
| `paintNodeDiff` canvas function | `KnowledgeGraph.tsx` | No existing diff paint function; copy `paintNode` and swap color logic |
| Frame synthesis (range+interval→dates) | `useKgAnimation.ts` | No existing client-synthesized frame sequence; implement with `Date` arithmetic |

---

## Metadata

**Analog search scope:** `convex/`, `src/hooks/`, `src/components/kg/`, `src/pages/`, `src/lib/`, `src/components/`
**Files read (source analogs):** 13
**Pattern extraction date:** 2026-06-23
