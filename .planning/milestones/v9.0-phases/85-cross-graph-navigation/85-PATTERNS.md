# Phase 85: Cross-Graph Navigation - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 5 new/modified files
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/focus-url.ts` (NEW) | utility | transform | `src/lib/tool-galaxy.ts` | role-match (pure data transform, framework-free) |
| `src/hooks/useFocusParam.ts` (NEW) | hook | request-response | `src/pages/Capabilities.tsx` L352-356 + `src/pages/Chat.tsx` L35-45 | role-match (useSearchParams + useEffect on mount) |
| `src/components/graph/CodeVaultGraph.tsx` (MODIFIED) | component | request-response | self (detail panel pattern at L411-528) | exact |
| `src/pages/ToolGalaxy.tsx` (MODIFIED) | page | request-response | `src/pages/KnowledgeGraph.tsx` + self | exact |
| `src/pages/KnowledgeGraph.tsx` (MODIFIED) | page | request-response | self + `src/pages/Chat.tsx` | exact |

---

## Pattern Assignments

### `src/lib/focus-url.ts` (utility, transform)

**Analog:** `src/lib/tool-galaxy.ts`

**Why:** The only other pure-data, framework-free lib file that builds namespaced id helpers and emits typed output consumed by pages. The header comment pattern, the `// id helpers — keep namespacing in one place` comment, and the const-exported function set are all directly copyable.

**File header + module doc pattern** (`src/lib/tool-galaxy.ts` lines 1-13):
```typescript
/**
 * Tool / Capability Galaxy — pure data-transform layer (Phase 72, GAL-01..04).
 *
 * ... framework-free and fully unit-testable: it does no
 * rendering and imports nothing from React or the graph library. The page
 * (ToolGalaxy.tsx) feeds raw query rows in and gets a render-ready model out.
 */
```

**Id namespace helper pattern** (`src/lib/tool-galaxy.ts` lines 121-124):
```typescript
// id helpers — keep namespacing in one place so links/nodes never drift.
export const toolId = (name: string) => `tool:${name}`;
export const mcpId = (name: string) => `mcp:${name}`;
export const agentId = (id: string) => `agent:${id}`;
export const kitId = (name: string) => `kit:${name}`;
```
Copy this structure for `buildFocusUrl` + normalization helpers. Each route target gets its own typed export; normalization helpers are named `normalizeFocusKey` or similar and kept in the same file.

**Template for `src/lib/focus-url.ts`:**
```typescript
/**
 * Cross-graph navigation helpers (Phase 85, GH-04).
 *
 * Pure, framework-free. Builds focus URLs for each graph surface and
 * provides the normalized-exact key used for eager match resolution (D-04).
 * No React imports. Fully unit-testable.
 */

export type FocusTarget =
  | { surface: "graphs"; nodeId: string }
  | { surface: "tool-galaxy"; nodeId: string }
  | { surface: "knowledge-graph"; entityName: string; hops?: number };

/** Strip graphify:<repo>: or vault: prefix, lowercase, trim. */
export function normalizeFocusKey(raw: string): string {
  return raw
    .replace(/^graphify:[^:]+:/, "")
    .replace(/^vault:/, "")
    .toLowerCase()
    .trim();
}

/** Returns true when two node identifiers resolve to the same normalized key. */
export function focusKeysMatch(a: string, b: string): boolean {
  return normalizeFocusKey(a) === normalizeFocusKey(b);
}

/** Emit the correct URL string for a cross-graph jump, including the from param. */
export function buildFocusUrl(target: FocusTarget, fromUrl?: string): string {
  const from = fromUrl ? `&from=${encodeURIComponent(fromUrl)}` : "";
  switch (target.surface) {
    case "graphs":
      return `/graphs?focus=${encodeURIComponent(target.nodeId)}${from}`;
    case "tool-galaxy":
      return `/tool-galaxy?focus=${encodeURIComponent(target.nodeId)}${from}`;
    case "knowledge-graph": {
      const hops = target.hops ?? 1;
      return `/knowledge-graph?focus=${encodeURIComponent(target.entityName)}&lens=entity&hops=${hops}${from}`;
    }
  }
}
```

---

### `src/hooks/useFocusParam.ts` (NEW) (hook, request-response)

**Analog:** `src/pages/Capabilities.tsx` lines 352-356 AND `src/pages/Chat.tsx` lines 35-45

Both show the `[searchParams] = useSearchParams()` + `useEffect(() => { const val = searchParams.get("key"); if (val) apply(val); }, [searchParams])` on-mount pattern. Chat also shows the `setSearchParams({}, { replace: true })` cleanup after consuming a param.

**Capabilities deep-link pattern** (`src/pages/Capabilities.tsx` lines 352-356):
```typescript
const [searchParams] = useSearchParams();
useEffect(() => {
  const tryName = searchParams.get("try");
  if (tryName) setTryCommand(tryName);
}, [searchParams]);
```

**Chat param consume + cleanup pattern** (`src/pages/Chat.tsx` lines 35-45):
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const skillParam = searchParams.get("skill");
const [skillBadge, setSkillBadge] = useState<string | null>(null);

useEffect(() => {
  if (skillParam) {
    setSkillBadge(skillParam);
    setSearchParams({}, { replace: true });
  }
}, [skillParam, setSearchParams]);
```

**Onboarding async-on-mount + cancellation pattern** (`src/pages/hr/Onboarding.tsx` lines 19-49):
```typescript
useEffect(() => {
  if (!cloneId) return;
  let cancelled = false;
  fetchAgentDetail(cloneId).then((agent) => {
    if (cancelled) return;
    wizard.form.reset({ ... });
  });
  return () => { cancelled = true; };
}, [cloneId]);
```
`useFocusParam` needs the same cancellation guard since it must wait for data to resolve before calling `centerAt`.

**Loading window tolerance** — mirrors `useToolGalaxy.ts` lines 30-31:
```typescript
const loading =
  tools === undefined || mcpServers === undefined || edges === undefined;
```
When the graph data is `undefined`, the hook must not attempt focus. Check `!== undefined` before resolving.

**Template for `src/hooks/useFocusParam.ts`:**
```typescript
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { ForceGraphHandle } from "../components/graph/ForceGraphCanvas";

export interface UseFocusParamOptions<N> {
  /** The already-loaded node list (undefined = still loading). */
  nodes: N[] | undefined;
  /** Extract a stable id from a node for matching. */
  getId: (node: N) => string;
  /** Called with the matched node when found (center + select it). */
  onFocus: (node: N, ref: React.RefObject<ForceGraphHandle | null>) => void;
  /** Ref to the canvas handle for centerAt/zoom. */
  fgRef: React.RefObject<ForceGraphHandle | null>;
}

/**
 * Read ?focus=<value> from the URL on mount. Once `nodes` resolves (not
 * undefined), locate the target node by id equality and call onFocus.
 * Falls back silently to no-op when the node is absent (D-04 / SC#3).
 */
export function useFocusParam<N>({
  nodes,
  getId,
  onFocus,
  fgRef,
}: UseFocusParamOptions<N>): { fromParam: string | null } {
  const [searchParams] = useSearchParams();
  const focusParam = searchParams.get("focus");
  const fromParam = searchParams.get("from");
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!focusParam || appliedRef.current) return;
    if (nodes === undefined) return; // still loading
    appliedRef.current = true;
    const target = nodes.find((n) => getId(n) === focusParam);
    if (target) onFocus(target, fgRef);
    // silent no-op when absent (SC#3)
  }, [focusParam, nodes, getId, onFocus, fgRef]);

  return { fromParam };
}
```

---

### `src/components/graph/CodeVaultGraph.tsx` (MODIFIED) (component, request-response)

**Analog:** self (existing detail panel + neighbor button pattern)

**Panel header pattern** (`src/components/graph/CodeVaultGraph.tsx` lines 417-428):
```typescript
{/* Panel header */}
<div className="flex items-center justify-between mb-3">
  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
    Node Details
  </span>
  <button
    aria-label="Close node details"
    onClick={() => setSelectedNodeId(null)}
    className="text-muted-foreground hover:text-foreground"
  >
    <X className="h-4 w-4" />
  </button>
</div>
```
The return chip slots in to the left of the "Node Details" label inside this header flex row.

**Section label chrome pattern** (`src/components/graph/CodeVaultGraph.tsx` line 419):
```typescript
<span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
```
Reuse verbatim for the "RELATED ACROSS GRAPHS" section heading.

**Neighbor button hover pattern** (`src/components/graph/CodeVaultGraph.tsx` lines 492-499):
```typescript
<button
  key={n.id}
  className="w-full text-left text-xs font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-primary/5 truncate block"
  onClick={() => setSelectedNodeId(n.id)}
  title={n.label}
>
  {n.label}
</button>
```
The "Related across graphs" link rows reuse the same `hover:bg-primary/5` base, but with `flex items-center gap-2` layout (not `text-left truncate block`) and `py-1.5 px-2` height.

**Neighbors block position** (`src/components/graph/CodeVaultGraph.tsx` lines 481-517) — the "Related across graphs" `<Separator />` + section attaches immediately **after** this block, inside the same `<div className="space-y-3">` container.

**Loading/empty state text pattern** (`src/components/graph/CodeVaultGraph.tsx` line 541):
```typescript
<p className="text-primary/70 font-mono text-sm animate-pulse">
  Loading graph snapshot…
</p>
```
Used verbatim for the loading overlay while `useFocusParam` waits for data.

**Skeleton import** — `Skeleton` from `../ui/skeleton` (not yet imported in CodeVaultGraph; add alongside existing ui imports at lines 37-44).

**Changes needed in `CodeVaultGraph.tsx`:**
1. Add `useSearchParams`, `useNavigate` from `react-router-dom` imports.
2. Add `ChevronLeft`, `ArrowRight`, `ExternalLink` to the Lucide import block (lines 26-31).
3. Add `Separator` to the shadcn/ui imports.
4. Add `Skeleton` to the shadcn/ui imports.
5. Import `useFocusParam` from `../../hooks/useFocusParam`.
6. Import `buildFocusUrl`, `focusKeysMatch`, `normalizeFocusKey` from `../../lib/focus-url`.
7. Inside `GraphContent`, call `useFocusParam` after `fgRef` is declared (line 124).
8. Insert return chip into the panel header div (line 418), gated on `fromParam`.
9. Insert "Related across graphs" section after the neighbors `</div>` (after line 517), inside `SectionErrorBoundary`.

---

### `src/pages/ToolGalaxy.tsx` (MODIFIED) (page, request-response)

**Analog:** `src/pages/KnowledgeGraph.tsx` (focus param read pattern) + self

**Focus animation pattern — the primary analog** (`src/pages/ToolGalaxy.tsx` lines 266-268):
```typescript
onNodeClick={(n: any) => {
  fgRef.current?.centerAt(n.x, n.y, 800);
  fgRef.current?.zoom(3, 800);
}}
```
This is the exact `centerAt` + `zoom` 800ms animation that inbound focus jumps will replay. `useFocusParam.onFocus` should call `fgRef.current?.centerAt(node.x, node.y, 800)` + `fgRef.current?.zoom(3, 800)`.

**`GalaxyNode` id + name shape** (`src/lib/tool-galaxy.ts` lines 63-64, 121-124):
```typescript
export interface GalaxyNode {
  id: string; // namespaced: "tool:Read" | "mcp:github" | "agent:skuld"
  name: string;
  kind: NodeKind;
  ...
}
export const agentId = (id: string) => `agent:${id}`;
```
Agent-node ids in the Galaxy are `"agent:<name>"`. Normalizing for match: strip the `agent:` prefix. The CodeVaultGraph node `label` (not `id`) holds the bare name. Match is: `normalizeFocusKey(galaxyNode.name)` === `normalizeFocusKey(codeVaultNode.label)`.

**`fgRef` type** (`src/pages/ToolGalaxy.tsx` line 65): `const fgRef = useRef<any>(null)` — the Galaxy uses raw `ForceGraph2D` ref, not `ForceGraphHandle`. The focus animation goes directly via `fgRef.current?.centerAt / zoom` (same API surface as `ForceGraphHandle` — it's the underlying react-force-graph-2d ref). No change needed to ref type.

**`SectionErrorBoundary` + `InfoTooltip` import** (`src/pages/ToolGalaxy.tsx` lines 4-5):
```typescript
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
```
Wrap the new "Related across graphs" section in `<SectionErrorBoundary name="Cross-graph links">`.

**`GalaxyCanvas` component boundary** — `GalaxyCanvas` is an inner component inside `ToolGalaxy.tsx`. The focus-param reading and the "Related across graphs" section BOTH live inside `GalaxyCanvas` (where `fgRef` and `graph.nodes` are in scope). The `[selectedNodeId]` state is currently absent from `GalaxyCanvas` — it tracks only `hoverId`. A `selectedNodeId` state must be added for the detail panel + link section.

**Changes needed in `ToolGalaxy.tsx`:**
1. Add `useState` to the React import (line 1 already has it via spread; confirm).
2. Add `useSearchParams`, `useNavigate` from `react-router-dom`.
3. Add `ChevronLeft`, `ArrowRight`, `ExternalLink` to Lucide imports (line 3).
4. Import `useFocusParam` from `../hooks/useFocusParam`.
5. Import `buildFocusUrl`, `focusKeysMatch` from `../lib/focus-url`.
6. Add `selectedNodeId` state + `selectedNode` memo inside `GalaxyCanvas`.
7. Wire `onNodeClick` to also `setSelectedNodeId` (in addition to existing `centerAt/zoom`).
8. Render a detail panel (or an inline panel) when `selectedNodeId` is set; insert "Related across graphs" section inside it.
9. Call `useFocusParam` with the Galaxy nodes list.

---

### `src/pages/KnowledgeGraph.tsx` (MODIFIED) (page, request-response)

**Analog:** self + `src/pages/Chat.tsx` (URL param on mount)

**`setFilter` / `setLens` API for inbound focus param** (`src/hooks/useKnowledgeGraph.ts` lines 151-156, 145-149):
```typescript
const setLens = useCallback((l: KgLens) => {
  setLensState(l);
  setSelectedNodeId(null);
  setSelectedEdgeId(null);
}, []);

const setFilter = useCallback(
  <K extends keyof KgFilters>(key: K, value: KgFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
  },
  [],
);
```
An inbound `?focus=<entityName>&lens=entity&hops=1` triggers: `kg.setLens("entity")` + `kg.setFilter("entityName", entityName)` + `kg.setFilter("hops", 1)`. This drives the name-driven entity fetch without any imperative data loading.

**idb persistence guard** (`src/hooks/useKnowledgeGraph.ts` lines 117-137) — the KG hydrates from idb before the first fetch. An inbound focus param MUST be applied AFTER hydration (`hydrated === true`) so the entity lens override isn't clobbered by the saved state restore. The hook's `hydrated` flag is internal; `loading` starts false and goes true once `hydrated` fires the first fetch. The safest pattern: apply the focus params in a `useEffect` that depends on a stable "ready" signal. Use `kg.loading === false && kg.graph.nodes.length > 0` OR a one-shot flag.

**`selectNode` + `focusSet` for centering** (`src/hooks/useKnowledgeGraph.ts` lines 259-266, 251-254):
```typescript
const focusSet = useMemo(
  () => computeFocusSet(graph, selectedNodeId),
  [graph, selectedNodeId],
);
// ...
const selectNode = useCallback((id: string | null) => {
  setSelectedNodeId(id);
  setSelectedEdgeId(null);
}, []);
```
After the entity lens fetch resolves and the node appears in `kg.graph.nodes`, call `kg.selectNode(node.id)` to highlight it, then `fgRef.current?.centerAt(node.x, node.y, 800); fgRef.current?.zoom(3, 800)`.

**`ForceGraphCanvas` ref usage** (`src/pages/KnowledgeGraph.tsx` lines 38-39):
```typescript
const kg = useKnowledgeGraph();
const fgRef = useRef<ForceGraphHandle>(null);
```
`fgRef` is already `ForceGraphHandle` typed — use directly.

**`KGDetailsPanel` component** (`src/pages/KnowledgeGraph.tsx` lines 261-270):
```typescript
<KGDetailsPanel
  graph={graph}
  selectedNodeId={selectedNodeId}
  selectedEdgeId={selectedEdgeId}
  onClose={() => { selectNode(null); selectEdge(null); }}
  onSelectNode={selectNode}
/>
```
The return chip and "Related across graphs" section go inside `KGDetailsPanel` (passed as a prop or via a slot). KG is a focus **destination** for this phase, not a forward-link source (D-03 — two forward links only: Tool→agent and agent→KG). So it needs: (a) read `?focus` + `?from` params, (b) render return chip if `from` present, (c) does NOT need a "Related across graphs" section.

**`SectionErrorBoundary` already used** (`src/pages/KnowledgeGraph.tsx` line 272):
```typescript
</SectionErrorBoundary>
```
The return chip inside `KGDetailsPanel` should also be wrapped in `SectionErrorBoundary` to isolate match-resolution errors.

**Changes needed in `KnowledgeGraph.tsx`:**
1. Add `useSearchParams`, `useNavigate` from `react-router-dom`.
2. Add `ChevronLeft` to Lucide imports.
3. Import `useFocusParam` from `../hooks/useFocusParam`.
4. Call `useFocusParam` with `{ nodes: kg.graph.nodes, getId: n => n.name, onFocus: ..., fgRef }` — the KG entity lens matches on `entityName` (name-driven), so `getId` should return `node.name`.
5. Pass `fromParam` down to `KGDetailsPanel` for return chip rendering.

---

## Shared Patterns

### `useSearchParams` on-mount read pattern
**Source:** `src/pages/Capabilities.tsx` lines 352-356 AND `src/pages/Chat.tsx` lines 35-45
**Apply to:** `useFocusParam.ts` (the shared hook), `src/pages/KnowledgeGraph.tsx` (direct param read for lens override)
```typescript
const [searchParams] = useSearchParams();
useEffect(() => {
  const val = searchParams.get("focus");
  if (val) applyFocus(val);
}, [searchParams]);
```

### `useNavigate` for programmatic navigation
**Source:** `src/pages/GraphsHub.tsx` lines 14, 32, 53
**Apply to:** All three modified pages + `useFocusParam.ts`
```typescript
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();
// ...
navigate(buildFocusUrl(target, currentUrl));
```

### `ForceGraphHandle.centerAt` + `zoom` focus animation
**Source:** `src/pages/ToolGalaxy.tsx` lines 266-268
**Apply to:** `useFocusParam.ts` `onFocus` callback, all three graph pages
```typescript
fgRef.current?.centerAt(node.x, node.y, 800);
fgRef.current?.zoom(3, 800);
```

### Panel section-label chrome
**Source:** `src/components/graph/CodeVaultGraph.tsx` line 419
**Apply to:** "RELATED ACROSS GRAPHS" heading in CodeVaultGraph and ToolGalaxy detail panels
```typescript
<span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
  RELATED ACROSS GRAPHS
</span>
```

### Neighbor/link button hover row
**Source:** `src/components/graph/CodeVaultGraph.tsx` lines 492-499
**Apply to:** Each link row in the "Related across graphs" section
```typescript
className="w-full text-left text-xs font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-primary/5 truncate block"
```
Extend with `flex items-center gap-2` and icons per UI-SPEC.

### `SectionErrorBoundary` wrap
**Source:** `src/components/SectionErrorBoundary.tsx` (class component, `name` prop)
**Apply to:** Every new section rendered in a panel ("Related across graphs", return chip)
```typescript
import SectionErrorBoundary from "../components/SectionErrorBoundary";
// ...
<SectionErrorBoundary name="Cross-graph links">
  {/* link rows */}
</SectionErrorBoundary>
```

### Loading pulse text
**Source:** `src/components/graph/CodeVaultGraph.tsx` line 541
**Apply to:** Canvas area while `useFocusParam` resolves
```typescript
<p className="text-primary/70 font-mono text-sm animate-pulse">
  Loading graph…
</p>
```

### `useQuery` undefined-as-loading tolerance
**Source:** `src/hooks/useToolGalaxy.ts` lines 30-31, `src/hooks/useProjectGraph.ts` lines 8-12
**Apply to:** `useFocusParam` — must check `nodes !== undefined` before trying to find the focus target
```typescript
// Three-state: undefined = loading, [] = no data, [...] = data
if (nodes === undefined) return; // still loading — do not attempt focus
```

---

## No Analog Found

All five files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `src/components/graph/`, `src/pages/`, `src/hooks/`, `src/lib/`, `src/components/`
**Files scanned:** 15 source files read
**Pattern extraction date:** 2026-06-22
