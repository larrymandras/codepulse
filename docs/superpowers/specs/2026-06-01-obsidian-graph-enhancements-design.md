# Obsidian Graph Enhancements — Design

**Date:** 2026-06-01
**Status:** DEFERRED (design complete, not scheduled) — 2026-06-01. Obsidian's native Graph
view already provides folder coloring, filters, search, and local-graph focus, so these
enhancements would largely duplicate it. The base Obsidian vault graph (merged `50e8e42`)
stays as a finished personal utility. Enhancement effort redirected to visualizing
**Ástríðr's temporal knowledge graph** (v16.0 entities/triples) in CodePulse — the
on-mission, novel observability view. This document is retained as a design record.
**Component:** CodePulse — Memory page, Obsidian tab
**Builds on:** the Obsidian vault graph view merged in `50e8e42`

## Problem

The Obsidian tab renders an entire vault as a single force-directed graph with no
controls. At real-vault scale (hundreds of notes) this produces one dense hub blob
plus a wide scatter of orphan dots — it is a good-looking picture but offers no way
to drill in, find a note, or read structure. The legend problem compounds it: folder
colors cycle and repeat with no key, so "what is what?" is unanswerable.

## Goals

Make the graph good at all three of: **(1) navigation/exploration**, **(2) structural
insight**, and **(3) staying a legible at-a-glance picture**. Concretely, ship eight
capabilities in two groups:

**Declutter controls**
1. Folder filter + legend (color↔folder key with per-folder show/hide toggles)
2. Hide-orphans toggle (drop zero-link notes)
3. Search box (find a note by name → highlight + focus)
4. Min-links slider (degree threshold to peel away weakly-connected nodes)

**Drill-down (node selection)**
5. Focus / isolate neighborhood (dim everything outside a node's 1-hop neighbors)
6. Details side panel (path, folder, in/out link counts, clickable neighbor list)
7. Open note in Obsidian (`obsidian://` deep link)
8. In-app markdown preview (read-only, rendered from the note's file content)

## Non-Goals (YAGNI)

- Editing notes from CodePulse
- Live vault file-watching / auto-refresh (manual "Change Vault" / reconnect only)
- Clustering / community-detection layouts; saved or named views
- A vault-name override UI (we assume the Obsidian vault name equals the folder name;
  revisit only if the deep link fails in practice)
- 3D rendering
- Tag/frontmatter graph edges — the graph remains `[[wikilink]]`-only, as today

## Architecture (decomposed + pure view layer)

The tested `parseVault` stays the raw-data source. All filtering/derivation moves into
a pure, unit-tested module. UI splits into small focused units coordinated by one hook.

```
src/lib/obsidian.ts            EXISTING. parseVault unchanged in behavior; additively
                               returns fileHandles: Map<id, FileSystemFileHandle> so the
                               details panel can read note content lazily.
src/lib/obsidian-view.ts       NEW, pure. All view derivation (filter, color, focus,
                               neighbors, search, folder listing). No React, no I/O.
src/hooks/useObsidianGraph.ts  NEW. Owns: directory handle, raw data, fileHandles,
                               filter state (persisted to idb), selectedId, focusId,
                               loading/error. Exposes derived view + handlers.
src/components/obsidian/
  ObsidianGraph.tsx            MOVED here + refactored: consumes a shared color map and a
                               focus set (dims out-of-focus nodes); paint logic otherwise
                               as-is. (Update the existing test import path.)
  GraphControls.tsx            NEW. Search + hide-orphans + min-links + legend/toggles.
  NodeDetailsPanel.tsx         NEW. Details + neighbors + Open-in-Obsidian + md preview.
src/pages/Memory.tsx           Obsidian tab composes the three components via the hook;
                               the current inline obsidian state moves into the hook.
```

### Data flow (unidirectional)

```
vault → parseVault → raw{ nodes, links, fileHandles }            (once, on connect)
                          │
filters{ hiddenFolders, hideOrphans, minLinks } ─► deriveGraphView(raw, filters) ─► view
                          │                                                          │
selection{ selectedId, focusId } ─────────────────────────────────────────────────►│
                                                                                     ▼
                              ObsidianGraph (renders view; dims nodes outside focus set)
                              GraphControls (drives filters)
                              NodeDetailsPanel (reads selectedId + lazy file content)
```

- **Filters remove nodes** (and any link whose endpoint disappeared) and re-run the
  force layout. **Focus dims** (≈10% opacity) without removing nodes or re-laying out,
  preserving spatial context.

## `obsidian-view.ts` contract

```ts
interface GraphFilters {
  hiddenFolders: Set<string>; // top-level folders to exclude
  hideOrphans: boolean;       // drop degree-0 nodes
  minLinks: number;           // drop nodes with degree < minLinks (default 0)
}

// Drop hidden-folder nodes, then degree-0 (if hideOrphans), then degree<minLinks;
// finally drop links whose source or target no longer exists. Returns a new GraphData.
function deriveGraphView(raw: GraphData, filters: GraphFilters): GraphData;

// Single source of truth for color, shared by the renderer AND the legend (fixes the
// "colors repeat with no key" problem). unresolved → '#4b5563'; others cycle the palette
// in stable folder-encounter order.
function assignGroupColors(folders: string[]): Map<string, string>;

// Focus node + its directly-linked neighbors (1 hop), for dimming the rest.
function computeFocusSet(raw: GraphData, focusId: string): Set<string>;

// Split neighbor ids for the details panel.
function getNeighbors(raw: GraphData, id: string): { incoming: string[]; outgoing: string[] };

// Case-insensitive substring match on node name.
function searchNodes(raw: GraphData, query: string): string[];

// Legend rows: folder + node count. Color is NOT returned here — the legend reads it
// from assignGroupColors so there is exactly one color source of truth.
function listFolders(raw: GraphData): { folder: string; count: number }[];
```

Degree is `incoming + outgoing` link count. "Orphan" = degree 0. `hideOrphans` is kept
as an explicit toggle (not folded into `minLinks`) because it is the clearest one-click
fix for the orphan scatter.

## `parseVault` extension

`parseVault` additionally collects `fileHandles: Map<noteId, FileSystemFileHandle>` during
its existing directory walk and returns it alongside `{ nodes, links }`. Note content is
**not** loaded eagerly — the details panel reads a single file on demand via its handle,
keeping memory low and previews fresh. Existing parser tests continue to pass (return
shape is extended, not changed); a new test asserts the map is populated per note.

## `useObsidianGraph` hook

Centralizes obsidian-tab state (moved out of `Memory.tsx`):
- `connect()` / auto-reconnect (existing logic), `rawData`, `fileHandles`, `loading`, `error`
- `filters` (persisted to idb under a dedicated key; restored on mount), `setFilter(...)`
- `selectedId`, `focusId`, `select(id)`, `clearSelection()`
- `view` = memoized `deriveGraphView(rawData, filters)`
- `colorMap` = memoized `assignGroupColors(listFolders(rawData).map(f => f.folder))`
- `focusSet` = memoized `computeFocusSet(rawData, focusId)`
- `readNoteContent(id)` → `fileHandles.get(id)?.getFile().then(f => f.text())`

Filters persist; selection/focus are transient (not persisted).

## Components

### GraphControls (top-left overlay, collapsible)
- `ui/input` search (debounced via `searchNodes`): matching nodes highlight in-graph, and
  a short results list under the input lets you click one — or Enter picks the top match —
  → `select` + center/zoom. Empty query clears the highlight.
- `ui/switch` hide-orphans; `ui/slider` min-links (0…max node degree in the raw data).
- Legend: one row per folder from `listFolders` — color chip (`ui/badge`, color pulled from
  the shared `colorMap`) + folder name + count + a `ui/toggle` to add/remove it from
  `hiddenFolders`.
- Hosts the "Change Vault" button (moved from its current floating position).

### NodeDetailsPanel (right slide-over, shown when `selectedId` set)
- Header: note name + close ✕ (clears selection).
- Metadata: `path`, folder badge (using `colorMap`), incoming/outgoing counts.
- Neighbor list: clickable rows (incoming/outgoing) → `select(neighborId)`.
- **Open in Obsidian**: anchor with
  `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(path.replace(/\.md$/, ''))}`.
  `vaultName` = stored directory-handle `.name`. Disabled when the node is unresolved
  (`path === ''`).
- **Preview**: lazily `readNoteContent(id)` → `react-markdown` (the renderer already used
  by `BlockRenderer`/`ChatBubble`). States: loading / loaded / unresolved ("no file") /
  error. Long notes scroll within the panel.

### ObsidianGraph (refactor)
- Accepts `data` (the derived view), `colorMap`, `focusSet`, `onNodeClick`, `onBackgroundClick`.
- `assignGroupColors` logic removed (now passed in via `colorMap`).
- When `focusSet` is non-empty, nodes/links outside it render at ≈10% opacity; inside it
  render normally. Click background → `onBackgroundClick` (clears selection/focus).
- Existing hover, particle, click-to-zoom behavior retained.

## Interaction summary

| Action | Result |
|--------|--------|
| Click node | `select(id)` → opens panel + sets focus (dims non-neighborhood) |
| Click background | clear selection + focus |
| Search → pick result | select + focus + center/zoom on the node |
| Toggle folder in legend | add/remove from `hiddenFolders` → re-derive (layout re-runs) |
| Hide-orphans switch | drop degree-0 nodes |
| Min-links slider | drop nodes with degree < N |
| Neighbor click in panel | `select(neighborId)` |
| Open in Obsidian | launches the note via `obsidian://` |

## Testing strategy

- **`obsidian-view.test.ts`** (pure, highest value): `deriveGraphView` (folder-hide drops
  nodes and dangling links; hide-orphans; min-links; combined filters), `assignGroupColors`
  (palette cycle + unresolved gray + stable order + legend parity), `computeFocusSet`,
  `getNeighbors` (in/out split), `searchNodes` (case-insensitive, partial), `listFolders`
  (counts + colors).
- **`obsidian.ts`**: extend to assert `fileHandles` is populated per note.
- **Component tests** (mock `react-force-graph-2d`, use `@testing-library/react` — same
  pattern as the existing `ObsidianGraph.test.tsx`): `GraphControls` (search/switch/slider
  fire callbacks; legend renders folders+colors+counts), `NodeDetailsPanel` (renders
  metadata; neighbor-click calls `select`; Open-in-Obsidian builds the correct href and is
  disabled for unresolved; preview loading→loaded and unresolved states), `ObsidianGraph`
  (out-of-focus dimming applied when `focusSet` provided).
- **Browser UAT** (re-run): drive the Memory→Obsidian tab against the real
  `C:\Users\mandr\Mandras` vault; verify legend matches colors, filters thin the graph,
  search focuses, and the details panel + preview + Open-in-Obsidian work.

## Phasing

One spec, built in two waves so the readability win lands first:

- **Wave 1 — Declutter + structure:** `obsidian-view.ts`, `useObsidianGraph`, `GraphControls`
  (legend + folder toggles + hide-orphans + min-links + search), `ObsidianGraph` refactor
  (shared colors + focus dimming), `Memory.tsx` wiring. Solves the original blob/orphan
  problem on its own.
- **Wave 2 — Drill-down:** `parseVault` `fileHandles` extension, `NodeDetailsPanel` (details
  + neighbors + Open-in-Obsidian + markdown preview), selection/focus wiring.

## Assumptions

- The Obsidian vault name equals the picked folder name (e.g., `Mandras`). The
  `obsidian://` link depends on this; if it fails, add a vault-name field (currently a
  non-goal).
- Current vault scale (hundreds of notes) renders acceptably in `react-force-graph-2d`,
  as confirmed by the real-vault UAT. No virtualization needed.
- The File System Access API remains Chrome/Edge-only; the empty-state copy already sets
  this expectation.
