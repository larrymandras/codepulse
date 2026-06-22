# Phase 84: Graphs Hub + Code/Vault Render - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-22
**Phase:** 84-graphs-hub-code-vault-render
**Areas discussed:** Hub IA & landing, Code/vault encoding, Truncation & freshness, Interactions & states

---

## Hub IA & landing

### Hub shape

| Option | Description | Selected |
|--------|-------------|----------|
| Index + code/vault hero | Hub landing: tiles linking to 4 surfaces + hosts the code/vault render inline as hero; standalone routes untouched | ✓ |
| Tabbed shell | `/graphs` absorbs all 4 graphs as tabs; standalone routes redirect in | |
| Code/vault-first page | `/graphs` IS just the code/vault render; others stay separate | |

**User's choice:** Index + code/vault hero
**Notes:** Lowest churn, matches HivePage composition, satisfies GH-03 non-destructively.

### Tile content

| Option | Description | Selected |
|--------|-------------|----------|
| Live summary tiles | icon + title + live metric from existing hook + click-through | ✓ |
| Simple nav cards | icon + title + description + link, no live data | |
| Mini-preview cards | tiny live graph thumbnail per tile | |

**User's choice:** Live summary tiles
**Notes:** useToolGalaxy / useMcpHealth / useKgSummary already exist — cheap, makes the hub a real at-a-glance index.

### Hero layout

| Option | Description | Selected |
|--------|-------------|----------|
| Tiles row + large hero + expand | Compact tile row on top, large full-width graph below, expand-to-fullscreen button | ✓ |
| Tiles sidebar + hero fills rest | Tiles in a narrow rail, graph fills remaining canvas | |
| Hero + separate full route | Hub shows preview + tiles; dedicated `/graphs/code-vault` route for full graph | |

**User's choice:** Tiles row + large hero + expand
**Notes:** No extra route; expand affordance handles dense exploration.

---

## Code/vault encoding

### Node color

| Option | Description | Selected |
|--------|-------------|----------|
| By source (code vs vault) | Color by source family — graphify vs vault | ✓ |
| By community | Color by the community field | |
| By type | Color by node type | |

**User's choice:** By source (code vs vault)
**Notes:** The headline distinction; community-based coloring/layout deferred to Phase 86.

### Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Dual Matrix palette | Emerald for code, contrasting accent for vault | ✓ |
| Reuse ObsidianGraph neon | Reuse existing vault palette wholesale | |
| Per-community gradient | Gradient keyed to community field | |

**User's choice:** Dual Matrix palette
**Notes:** On-theme (Matrix Emerald), clear two-family split.

### Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Code / Vault / Both chips | Client-side toggle chips, no reload (GAL-04 precedent) | ✓ |
| No filter (show all) | Render whole graph, no toggles | |
| Full filter panel | Filter by source + type + community | |

**User's choice:** Code / Vault / Both chips
**Notes:** Cheap, high-value on a mixed graph; full panel overlaps Phase 86.

---

## Truncation & freshness

### Truncation

| Option | Description | Selected |
|--------|-------------|----------|
| Summary line + per-source chips | Total "X of Y" + per-source chip with truncated badge | ✓ |
| Single banner only | One line shown when any source truncated | |
| Canvas corner badge | Small overlay badge | |

**User's choice:** Summary line + per-source chips
**Notes:** Uses authoritative `sources[]` (Phase 83 D-05); shows which source got capped.

### Integrity (storedNodeCount divergence)

| Option | Description | Selected |
|--------|-------------|----------|
| Only on divergence | Warn only when stored < emitted (dropped dangling links) | ✓ |
| Always show stored vs emitted | Display both counts always | |
| Don't surface (debug only) | Keep internal/console-only | |

**User's choice:** Only on divergence
**Notes:** Integrity signal, not normal-state noise.

### Freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Relative time + stale badge | "Updated 6h ago" + amber stale badge past ~36h | ✓ |
| Relative time only | Timestamp, no threshold | |
| No freshness indicator | Don't show generatedAt | |

**User's choice:** Relative time + stale badge
**Notes:** ~36h ≈ a missed nightly; threshold tunable at plan time.

---

## Interactions & states

### Node click

| Option | Description | Selected |
|--------|-------------|----------|
| Side detail panel | Panel with id/label/type/source/community + neighbors; no cross-graph links | ✓ |
| Center + highlight only | centerAt + focusSet dimming, no panel | |
| Read-only (pan/zoom) | No click interaction | |

**User's choice:** Side detail panel
**Notes:** Mirrors KG Explorer; cross-graph links are Phase 85.

### Hover

| Option | Description | Selected |
|--------|-------------|----------|
| Label + type + source | Tooltip with all three | ✓ |
| Label only | Just the label | |
| Rich tooltip | + neighbor count + community | |

**User's choice:** Label + type + source

### Find box

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 86 | No search box; overlaps KG-08 | ✓ |
| Include simple find | Client-side name-substring highlight/center | |

**User's choice:** Defer to Phase 86

### Empty state

| Option | Description | Selected |
|--------|-------------|----------|
| Explainer + diagnostic | "No snapshot yet" + names the nightly cron; tiles still render | ✓ |
| Generic empty state | Plain "No data yet" | |
| Hide hero until data | Render only tiles when null | |

**User's choice:** Explainer + diagnostic
**Notes:** Reads as a pipeline state, not a bug.

---

## Claude's Discretion

- Loading state: skeleton hero + independently-loading tiles (SectionErrorBoundary) — not asked, standard practice.
- Exact contrasting vault hue, precise stale threshold (~36h default), tile metric phrasing, detail-panel field ordering.
- `useProjectGraph` hook shape; whether to wrap `listSnapshots` (likely unused — single snapshot).
- Whether to reuse `ObsidianGraph` directly or compose `ForceGraphCanvas` fresh for the code/vault graph.

## Deferred Ideas

- In-graph node-name find/focus box → Phase 86 (with KG-08).
- Cross-graph deep-linking from detail panel → Phase 85 (GH-04).
- Community/cluster-aware layout & coloring → Phase 86 (KG-09).
- Mini-graph preview thumbnails on tiles → rejected for landing (render cost).
- Dedicated `/graphs/code-vault` full route → folded into expand-to-fullscreen.
