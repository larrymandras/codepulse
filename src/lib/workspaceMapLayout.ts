/**
 * Pure layout module for Phase 114 (Workspace Map view).
 *
 * Zero React and zero Convex imports — plain data in, plain data out. This is
 * what lets `workspaceMapLayout.test.ts` be a plain Vitest suite with no DOM
 * or canvas mock, following the `skillVault.ts` / `skillVault.test.ts`
 * precedent (`src/lib/skillVault.ts:226-397`).
 *
 * This plan (114-05) builds `buildTree` and `computeRollups`. Plan 114-07
 * completes this file additively with `layoutNodes`, which turns a `DirTree`
 * plus a `RollupMap` plus an `expandedSet` into the `WorkspaceMapNode[]` /
 * `WorkspaceMapLink[]` this file already declares the shape of.
 */

// ---------------------------------------------------------------------------
// Input shape — mirrors the `dirs` element of `getWorkspaceMap`'s return,
// verified against convex/workspace.ts:303-347 (114-05-PLAN.md <interfaces>).
// ---------------------------------------------------------------------------

export interface WorkspaceDirRow {
  rootId: string;
  /** "" for the root itself; "/"-joined segments below it otherwise. */
  dirPath: string;
  department: string; // "Personal" | "Consulting" | "Work" | "Unclassified"
  access: string; // "astridr-reachable" | "local-only"
  /** DIRECT contents only — never subdirectories, never withheld files. */
  fileCount: number;
  /** DIRECT contents only, bytes. */
  totalSize: number;
  /** epoch SECONDS. */
  latestMtime: number;
  /** count only — the schema deliberately carries no byte total for this. */
  withheldCount: number;
}

// ---------------------------------------------------------------------------
// Stable node key
// ---------------------------------------------------------------------------

/**
 * Canonical node key for every map keyed by directory identity in this
 * module (and by every later plan's `expandedSet`). `|` is not a legal path
 * character on either platform's directory names in this dataset, so it
 * cannot collide with a real path segment.
 *
 * This is the ONLY place the `${rootId}|${dirPath}` template literal
 * appears — every other function in this module calls `nodeKey` rather than
 * re-constructing the key inline, so a divergence between two inlined copies
 * can never happen silently.
 */
export function nodeKey(rootId: string, dirPath: string): string {
  return `${rootId}|${dirPath}`;
}

// ---------------------------------------------------------------------------
// buildTree
// ---------------------------------------------------------------------------

export interface DirTree {
  /** Adjacency map keyed by the PARENT's node key. */
  childrenByParent: Map<string, WorkspaceDirRow[]>;
  /** Root rows (`dirPath === ""`), keyed by rootId. */
  roots: WorkspaceDirRow[];
  /** O(1) lookup from node key to row. */
  byKey: Map<string, WorkspaceDirRow>;
  /**
   * Rows whose computed parent key was not present anywhere in the payload
   * (a malformed snapshot). Attached to their root rather than dropped, so a
   * partial payload degrades visibly instead of quietly shrinking the map.
   */
  orphanCount: number;
}

/** Parent's dirPath: the input with the final `/`-segment removed, or "" at depth 1. */
function parentDirPath(dirPath: string): string {
  const idx = dirPath.lastIndexOf("/");
  return idx === -1 ? "" : dirPath.slice(0, idx);
}

/**
 * Builds a parent -> children adjacency map over the flat `dirs` array in a
 * single O(n) pass. Never scan the flat array to find a node's children
 * anywhere else in this module — that is the anti-pattern
 * 114-RESEARCH.md § Pattern 4 names explicitly; the adjacency map here is
 * what keeps every later traversal bounded by the visible node count rather
 * than by the full payload.
 */
export function buildTree(dirs: WorkspaceDirRow[]): DirTree {
  const childrenByParent = new Map<string, WorkspaceDirRow[]>();
  const roots: WorkspaceDirRow[] = [];
  const byKey = new Map<string, WorkspaceDirRow>();

  for (const row of dirs) {
    byKey.set(nodeKey(row.rootId, row.dirPath), row);
    if (row.dirPath === "") roots.push(row);
  }

  const rootKeys = new Set(roots.map((r) => nodeKey(r.rootId, r.dirPath)));

  let orphanCount = 0;

  for (const row of dirs) {
    if (row.dirPath === "") continue; // roots have no parent row to attach to

    const parentPath = parentDirPath(row.dirPath);
    const candidateParentKey = nodeKey(row.rootId, parentPath);
    const rootKey = nodeKey(row.rootId, "");

    // A row is well-formed when its computed parent is present in the
    // payload (either the root itself, at depth 1, or another directory row
    // at deeper depths). Otherwise it is an orphan: attach it to its root so
    // it stays visible, and count it so a malformed snapshot is provable.
    const parentPresent =
      byKey.has(candidateParentKey) || rootKeys.has(candidateParentKey);

    const parentKey = parentPresent ? candidateParentKey : rootKey;
    if (!parentPresent) orphanCount += 1;

    const siblings = childrenByParent.get(parentKey);
    if (siblings) siblings.push(row);
    else childrenByParent.set(parentKey, [row]);
  }

  return { childrenByParent, roots, byKey, orphanCount };
}

// ---------------------------------------------------------------------------
// Rollup types (implementation lands in Task 2 — declared here alongside the
// rest of the module's shared types since later plans build against this
// interface before computeRollups exists).
// ---------------------------------------------------------------------------

export interface RollupTotals {
  fileCount: number;
  totalSize: number;
  withheldCount: number;
}

export type RollupMap = Map<string, RollupTotals>;

// ---------------------------------------------------------------------------
// Rendered-node contract — declared here even though `layoutNodes` (plan
// 114-07) is what populates it, so plan 114-07 (canvas geometry) and plan
// 114-08 (side panel) build against one shared definition instead of two
// drifting copies.
// ---------------------------------------------------------------------------

export type WorkspaceMapNodeKind = "center" | "department" | "root" | "dir";

export interface WorkspaceMapNode {
  id: string; // the nodeKey
  kind: WorkspaceMapNodeKind;
  label: string;
  rootId: string;
  dirPath: string;
  depth: number;
  department: string;
  access: string;
  direct: RollupTotals;
  rolled: RollupTotals;
  /**
   * Number of directory rows in this node's subtree, itself included.
   * `layoutNodes` (plan 114-07) is its sole producer, populating it for
   * every node kind; on a "department" hub it carries that department's
   * total directory count, the figure plan 114-08's hub panel displays
   * alongside `rolled.fileCount`. The panel must read this named field off
   * the node, never recompute an aggregate the layout already holds.
   */
  dirCount: number;
  latestMtime: number;
  val: number;
  fx: number;
  fy: number;
  x?: number;
  y?: number;
}

export interface WorkspaceMapLink {
  source: string;
  target: string;
}
