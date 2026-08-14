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
    // `byKey` alone is sufficient: the loop above inserts EVERY row, roots
    // included, so a separate root-key set could never match a key `byKey`
    // misses. An earlier `|| rootKeys.has(...)` disjunct here was dead code
    // (IN-01, Phase 114 code review) and implied roots were tracked
    // separately, which they are not.
    const parentPresent = byKey.has(candidateParentKey);

    const parentKey = parentPresent ? candidateParentKey : rootKey;
    if (!parentPresent) orphanCount += 1;

    const siblings = childrenByParent.get(parentKey);
    if (siblings) siblings.push(row);
    else childrenByParent.set(parentKey, [row]);
  }

  return { childrenByParent, roots, byKey, orphanCount };
}

// ---------------------------------------------------------------------------
// Rollup types
// ---------------------------------------------------------------------------

export interface RollupTotals {
  fileCount: number;
  totalSize: number;
  withheldCount: number;
}

export type RollupMap = Map<string, RollupTotals>;

/** Depth is derivable from dirPath: "" (a root) is depth 0. */
function depthOf(dirPath: string): number {
  return dirPath === "" ? 0 : dirPath.split("/").length;
}

/**
 * Subtree-inclusive rollup of fileCount/totalSize/withheldCount, keyed by
 * `nodeKey`. Order-independent, non-mutating, O(n), no recursion.
 *
 * Algorithm (114-RESEARCH.md § Pattern 4): sort node keys once by
 * DESCENDING depth, then walk that order accumulating each node's own direct
 * values plus its already-computed children's rolled-up totals. Because
 * children are strictly deeper than their parent, every child is finished
 * before its parent is visited, so this never revisits a node twice and
 * never needs a recursive self-call — depth is not a stack-size dependency.
 *
 * Does not mutate the input rows: the direct-contents values from the
 * payload must remain readable unchanged, because the side panel (D-09)
 * shows BOTH the direct figure and the rolled-up figure, explicitly
 * labeled — rollups are a parallel derived map, never an overwrite.
 *
 * Deliberately does NOT roll up a byte figure for withheld files — the
 * schema carries none (schema.ts:2385-2389's side-channel rule) and deriving
 * one client-side would reconstruct exactly the higher-resolution channel
 * the producer refused to emit.
 */
export function computeRollups(tree: DirTree): RollupMap {
  const rollups: RollupMap = new Map();

  // Every row in the tree, sorted by descending depth so a child is always
  // resolved before its parent is visited. tree.byKey.values() is read-only
  // iteration over the existing rows — no row is copied or mutated.
  const rowsDeepestFirst = [...tree.byKey.values()].sort(
    (a, b) => depthOf(b.dirPath) - depthOf(a.dirPath)
  );

  for (const row of rowsDeepestFirst) {
    const key = nodeKey(row.rootId, row.dirPath);
    const children = tree.childrenByParent.get(key) ?? [];

    let fileCount = row.fileCount;
    let totalSize = row.totalSize;
    let withheldCount = row.withheldCount;

    for (const child of children) {
      const childKey = nodeKey(child.rootId, child.dirPath);
      const childRollup = rollups.get(childKey);
      // Deepest-first ordering guarantees childRollup is already populated.
      if (childRollup) {
        fileCount += childRollup.fileCount;
        totalSize += childRollup.totalSize;
        withheldCount += childRollup.withheldCount;
      }
    }

    rollups.set(key, { fileCount, totalSize, withheldCount });
  }

  return rollups;
}

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

// ---------------------------------------------------------------------------
// layoutNodes — deterministic radial layout (plan 114-07)
//
// Turns a `DirTree` + `RollupMap` + `expandedSet` into the flat
// `WorkspaceMapNode[]` / `WorkspaceMapLink[]` the interfaces above already
// declare the shape of. Every node carries BOTH `fx`/`fy` (which pin the
// react-force-graph simulation) AND a plain `x`/`y` mirror, assigned in a
// dedicated final pass — `fx`/`fy` alone only pins the sim; d3-force still
// assigns its own initial `x`/`y` on first tick otherwise, and at
// `cooldownTicks={0}` there is no tick budget left to correct that before
// first paint (`skillVault.ts:382-388`, the precedent this follows exactly).
// ---------------------------------------------------------------------------

const CENTER_ID = "__workspace_center__";

const RING_RADIUS_DEPARTMENT = 140;
const RING_RADIUS_ROOT = 300;
const RING_RADIUS_DIR_BASE = 460; // depth 1; ring for depth d is BASE + STEP*(d-1)
const RING_RADIUS_DIR_STEP = 130;

const MIN_DEPARTMENT_SECTOR_DEG = 8;
const MIN_ROOT_SECTOR_DEG = 1.5;
/** Below this per-node arc length (force-space units), stagger onto a secondary radius. */
const MIN_ARC_LENGTH = 14;
const COLLISION_STAGGER_RADIUS_OFFSET = 65;

const VAL_CENTER = 14;
const VAL_DEPARTMENT = 10;
const VAL_ROOT_FLOOR = 5;
const VAL_ROOT_RANGE = 5;
const VAL_DIR_FLOOR = 2;
const VAL_DIR_RANGE = 4;

function zeroTotals(): RollupTotals {
  return { fileCount: 0, totalSize: 0, withheldCount: 0 };
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Clockwise from 12 o'clock: angle 0 -> (0, r); angle increasing rotates toward +x. */
function polarToXY(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRad = degToRad(angleDeg);
  return { x: radius * Math.sin(angleRad), y: radius * Math.cos(angleRad) };
}

/**
 * Splits `totalDegrees` across `weights.length` sectors proportionally to
 * `weights`, enforcing a `minDegrees` floor per sector via iterative
 * water-filling: any sector whose proportional share would land under the
 * floor is clamped to the floor and removed from the proportional pool,
 * then the remaining degrees are re-distributed among the still-unclamped
 * sectors. `weights` must already be in the caller's deterministic,
 * content-derived order (never raw payload-array order) — this function is
 * pure arithmetic over whatever order it is given.
 */
function allocateSectors(weights: number[], totalDegrees: number, minDegrees: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (minDegrees * n >= totalDegrees) {
    // Degenerate: the floors alone don't fit inside the available span.
    // Fall back to an equal split rather than producing a negative remainder.
    const equalShare = totalDegrees / n;
    return weights.map(() => equalShare);
  }

  const result = new Array<number>(n).fill(0);
  const clamped = new Array<boolean>(n).fill(false);
  let remainingDegrees = totalDegrees;
  let remainingWeightSum = 0;
  for (const w of weights) remainingWeightSum += w;
  let remainingCount = n;

  let clampedAny = true;
  while (clampedAny) {
    clampedAny = false;
    for (let i = 0; i < n; i++) {
      if (clamped[i]) continue;
      const share =
        remainingWeightSum > 0
          ? (weights[i] / remainingWeightSum) * remainingDegrees
          : remainingDegrees / remainingCount;
      if (share < minDegrees) {
        result[i] = minDegrees;
        clamped[i] = true;
        remainingDegrees -= minDegrees;
        remainingWeightSum -= weights[i];
        remainingCount -= 1;
        clampedAny = true;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (clamped[i]) continue;
    result[i] =
      remainingWeightSum > 0
        ? (weights[i] / remainingWeightSum) * remainingDegrees
        : remainingDegrees / remainingCount;
  }

  return result;
}

interface SectorSlot {
  midDeg: number;
  radius: number;
}

/**
 * Places each of `widths` (already-allocated angular widths, in order)
 * starting at `startDeg`, returning each one's midpoint angle plus its
 * assigned radius. Index-based collision handling, not force-based: when a
 * slot's own arc length at `baseRadius` would fall below `MIN_ARC_LENGTH`,
 * odd-indexed siblings stagger onto `baseRadius + COLLISION_STAGGER_RADIUS_OFFSET`
 * (even-indexed siblings stay at `baseRadius`) — deterministic and
 * screenshot-testable exactly like the primary layout.
 */
function placeWithCollision(widths: number[], startDeg: number, baseRadius: number): SectorSlot[] {
  const slots: SectorSlot[] = [];
  let cursor = startDeg;
  for (let idx = 0; idx < widths.length; idx++) {
    const width = widths[idx];
    const midDeg = cursor + width / 2;
    const arcLength = baseRadius * degToRad(width);
    const radius =
      arcLength < MIN_ARC_LENGTH && idx % 2 === 1 ? baseRadius + COLLISION_STAGGER_RADIUS_OFFSET : baseRadius;
    slots.push({ midDeg, radius });
    cursor += width;
  }
  return slots;
}

interface SubtreeMeta {
  /** Directory rows in this node's subtree, itself included. */
  dirCount: number;
  maxLatestMtime: number;
}

/**
 * Deepest-first single pass over the WHOLE tree (every row, not just the
 * currently visible subset) — same algorithm shape as `computeRollups`
 * (114-05), but producing the subtree directory COUNT plus a max-mtime
 * aggregate rather than file/byte/withheld totals. Traverses
 * `tree.childrenByParent`/`tree.byKey`, never the flat `dirs` array.
 */
function computeSubtreeMeta(tree: DirTree): Map<string, SubtreeMeta> {
  const meta = new Map<string, SubtreeMeta>();
  const rowsDeepestFirst = [...tree.byKey.values()].sort(
    (a, b) => depthOf(b.dirPath) - depthOf(a.dirPath)
  );

  for (const row of rowsDeepestFirst) {
    const key = nodeKey(row.rootId, row.dirPath);
    const children = tree.childrenByParent.get(key) ?? [];

    let dirCount = 1;
    let maxLatestMtime = row.latestMtime;

    for (const child of children) {
      const childMeta = meta.get(nodeKey(child.rootId, child.dirPath));
      if (childMeta) {
        dirCount += childMeta.dirCount;
        if (childMeta.maxLatestMtime > maxLatestMtime) maxLatestMtime = childMeta.maxLatestMtime;
      }
    }

    meta.set(key, { dirCount, maxLatestMtime });
  }

  return meta;
}

/**
 * The deterministic ring/angle/size assignment. Visibility floor: the
 * center hub, the 4 department hubs, all 53 root hubs and every root's
 * direct (depth-1) children are ALWAYS included — this is what makes D-01's
 * 391-node first paint need zero clicks. Deeper directories are included
 * only when their immediate parent's `nodeKey` is present in `expandedSet`
 * (D-03: one level per click, at every depth). Traverses
 * `tree.childrenByParent` top-down; never filters the flat `dirs` array
 * (114-RESEARCH.md § Pattern 4's named anti-pattern).
 *
 * `options` is reserved for future geometry tuning; no fields are read this
 * phase.
 */
export function layoutNodes(
  tree: DirTree,
  rollups: RollupMap,
  expandedSet: Set<string>,
  _options?: unknown
): { nodes: WorkspaceMapNode[]; links: WorkspaceMapLink[] } {
  const nodes: WorkspaceMapNode[] = [];
  const links: WorkspaceMapLink[] = [];

  const meta = computeSubtreeMeta(tree);

  // Payload-relative size scalers — computed once from the WHOLE supplied
  // rollups/tree (every root, every directory), never from the currently
  // visible subset, so a node's size never shifts just because an unrelated
  // sibling was expanded or collapsed.
  let maxRootRolledUpFiles = 0;
  for (const root of tree.roots) {
    const fc = rollups.get(nodeKey(root.rootId, root.dirPath))?.fileCount ?? 0;
    if (fc > maxRootRolledUpFiles) maxRootRolledUpFiles = fc;
  }
  let maxDirRolledUpFiles = 0;
  for (const row of tree.byKey.values()) {
    if (row.dirPath === "") continue; // roots use their own max above
    const fc = rollups.get(nodeKey(row.rootId, row.dirPath))?.fileCount ?? 0;
    if (fc > maxDirRolledUpFiles) maxDirRolledUpFiles = fc;
  }

  function rootVal(fileCount: number): number {
    const ratio = maxRootRolledUpFiles > 0 ? Math.sqrt(fileCount / maxRootRolledUpFiles) : 0;
    return VAL_ROOT_FLOOR + VAL_ROOT_RANGE * ratio;
  }
  function dirVal(fileCount: number): number {
    const ratio = maxDirRolledUpFiles > 0 ? Math.sqrt(fileCount / maxDirRolledUpFiles) : 0;
    return VAL_DIR_FLOOR + VAL_DIR_RANGE * ratio;
  }

  // Group roots by department. NOT relied on for ORDER — `rootsByDept`'s
  // per-department array order mirrors `tree.roots`' order, which mirrors
  // the input `dirs` array order; every placement below re-sorts by a
  // content-derived key before using it, which is what keeps the layout
  // identical regardless of `dirs`' input order (D-08).
  const rootsByDept = new Map<string, WorkspaceDirRow[]>();
  for (const root of tree.roots) {
    const list = rootsByDept.get(root.department);
    if (list) list.push(root);
    else rootsByDept.set(root.department, [root]);
  }

  function deptDirCount(dept: string): number {
    let total = 0;
    for (const r of rootsByDept.get(dept) ?? []) {
      total += meta.get(nodeKey(r.rootId, r.dirPath))?.dirCount ?? 0;
    }
    return total;
  }
  function deptMaxMtime(dept: string): number {
    let max = 0;
    for (const r of rootsByDept.get(dept) ?? []) {
      const m = meta.get(nodeKey(r.rootId, r.dirPath))?.maxLatestMtime ?? 0;
      if (m > max) max = m;
    }
    return max;
  }
  function deptRolled(dept: string): RollupTotals {
    const totals = zeroTotals();
    for (const r of rootsByDept.get(dept) ?? []) {
      const rr = rollups.get(nodeKey(r.rootId, r.dirPath));
      if (rr) {
        totals.fileCount += rr.fileCount;
        totals.totalSize += rr.totalSize;
        totals.withheldCount += rr.withheldCount;
      }
    }
    return totals;
  }

  // Deterministic department order: descending total directory count, then
  // ascending department name as a content-derived tiebreak — required so
  // the layout is identical for `dirs` fed in any order.
  const departments = [...rootsByDept.keys()].sort((a, b) => {
    const diff = deptDirCount(b) - deptDirCount(a);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  const departmentWeights = departments.map((dept) => deptDirCount(dept));
  const departmentWidths = allocateSectors(departmentWeights, 360, MIN_DEPARTMENT_SECTOR_DEG);
  const departmentSlots = placeWithCollision(departmentWidths, 0, RING_RADIUS_DEPARTMENT);

  // --- center hub ---
  let centerDirCount = 0;
  let centerMaxMtime = 0;
  const centerRolled = zeroTotals();
  for (const dept of departments) {
    centerDirCount += deptDirCount(dept);
    const m = deptMaxMtime(dept);
    if (m > centerMaxMtime) centerMaxMtime = m;
    const dr = deptRolled(dept);
    centerRolled.fileCount += dr.fileCount;
    centerRolled.totalSize += dr.totalSize;
    centerRolled.withheldCount += dr.withheldCount;
  }

  nodes.push({
    id: CENTER_ID,
    kind: "center",
    label: "Workspace",
    rootId: "",
    dirPath: "",
    depth: 0,
    department: "",
    access: "",
    direct: zeroTotals(),
    rolled: centerRolled,
    dirCount: centerDirCount,
    latestMtime: centerMaxMtime,
    val: VAL_CENTER,
    fx: 0,
    fy: 0,
  });

  // Reveals `parentKey`'s direct children, split evenly across its own
  // angular sector, and recurses into a child's own children ONLY when that
  // child's key is already in `expandedSet` — D-03's one-level-per-click
  // property, enforced at every depth. Called unconditionally for a root's
  // own depth-1 children (D-01's visibility floor); conditionally for every
  // deeper level.
  function layoutDirChildren(parentKey: string, startDeg: number, widthDeg: number, depth: number): void {
    const children = (tree.childrenByParent.get(parentKey) ?? [])
      .slice()
      .sort((a, b) => a.dirPath.localeCompare(b.dirPath));
    if (children.length === 0) return;

    const widthEach = widthDeg / children.length;
    const radius = RING_RADIUS_DIR_BASE + RING_RADIUS_DIR_STEP * (depth - 1);
    const slots = placeWithCollision(
      children.map(() => widthEach),
      startDeg,
      radius
    );

    children.forEach((row, idx) => {
      const key = nodeKey(row.rootId, row.dirPath);
      const childStart = startDeg + idx * widthEach;
      const { x, y } = polarToXY(slots[idx].midDeg, slots[idx].radius);
      const rolled = rollups.get(key) ?? zeroTotals();
      const nodeMeta = meta.get(key);

      nodes.push({
        id: key,
        kind: "dir",
        label: row.dirPath.slice(row.dirPath.lastIndexOf("/") + 1),
        rootId: row.rootId,
        dirPath: row.dirPath,
        depth,
        department: row.department,
        access: row.access,
        direct: { fileCount: row.fileCount, totalSize: row.totalSize, withheldCount: row.withheldCount },
        rolled,
        dirCount: nodeMeta?.dirCount ?? 1,
        latestMtime: row.latestMtime,
        val: dirVal(rolled.fileCount),
        fx: x,
        fy: y,
      });
      links.push({ source: parentKey, target: key });

      if (expandedSet.has(key)) {
        layoutDirChildren(key, childStart, widthEach, depth + 1);
      }
    });
  }

  let deptCursor = 0;
  departments.forEach((dept, deptIdx) => {
    const deptWidth = departmentWidths[deptIdx];
    const deptStart = deptCursor;
    deptCursor += deptWidth;

    const deptSlot = departmentSlots[deptIdx];
    const { x: dx, y: dy } = polarToXY(deptSlot.midDeg, deptSlot.radius);

    nodes.push({
      id: `dept:${dept}`,
      kind: "department",
      label: dept,
      rootId: "",
      dirPath: "",
      depth: 0,
      department: dept,
      access: "",
      direct: zeroTotals(),
      rolled: deptRolled(dept),
      dirCount: deptDirCount(dept),
      latestMtime: deptMaxMtime(dept),
      val: VAL_DEPARTMENT,
      fx: dx,
      fy: dy,
    });
    links.push({ source: CENTER_ID, target: `dept:${dept}` });

    // Roots within this department — descending dirCount, then ascending
    // rootId as a content-derived tiebreak (never array position).
    const rootsSorted = (rootsByDept.get(dept) ?? []).slice().sort((a, b) => {
      const diff =
        (meta.get(nodeKey(b.rootId, b.dirPath))?.dirCount ?? 0) -
        (meta.get(nodeKey(a.rootId, a.dirPath))?.dirCount ?? 0);
      return diff !== 0 ? diff : a.rootId.localeCompare(b.rootId);
    });

    const rootWeights = rootsSorted.map(
      (r) => Math.sqrt(meta.get(nodeKey(r.rootId, r.dirPath))?.dirCount ?? 0)
    );
    const rootWidths = allocateSectors(rootWeights, deptWidth, MIN_ROOT_SECTOR_DEG);
    const rootSlots = placeWithCollision(rootWidths, deptStart, RING_RADIUS_ROOT);

    let rootCursor = deptStart;
    rootsSorted.forEach((row, rootIdx) => {
      const rootWidth = rootWidths[rootIdx];
      const rootStart = rootCursor;
      rootCursor += rootWidth;

      const key = nodeKey(row.rootId, row.dirPath); // dirPath === "" for a root row
      const rootSlot = rootSlots[rootIdx];
      const { x: rx, y: ry } = polarToXY(rootSlot.midDeg, rootSlot.radius);
      const rolled = rollups.get(key) ?? zeroTotals();
      const nodeMeta = meta.get(key);

      nodes.push({
        id: key,
        kind: "root",
        label: row.rootId,
        rootId: row.rootId,
        dirPath: "",
        depth: 0,
        department: row.department,
        access: row.access,
        direct: { fileCount: row.fileCount, totalSize: row.totalSize, withheldCount: row.withheldCount },
        rolled,
        dirCount: nodeMeta?.dirCount ?? 1,
        latestMtime: row.latestMtime,
        val: rootVal(rolled.fileCount),
        fx: rx,
        fy: ry,
      });
      links.push({ source: `dept:${dept}`, target: key });

      // Depth-1 children are ALWAYS visible (D-01's floor) — unconditional.
      layoutDirChildren(key, rootStart, rootWidth, 1);
    });
  });

  // The pitfall that silently half-works if skipped: fx/fy alone only pins
  // the simulation; d3-force still assigns its own initial x/y on first
  // tick unless one is already present, and cooldownTicks=0 leaves no time
  // to correct it before first paint. Mirror pass, exactly skillVault.ts:382-388.
  for (const n of nodes) {
    n.x = n.fx;
    n.y = n.fy;
  }

  return { nodes, links };
}
