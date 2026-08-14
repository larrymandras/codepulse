import { describe, it, expect } from "vitest";
import { buildTree, computeRollups, layoutNodes, nodeKey, type WorkspaceDirRow } from "./workspaceMapLayout";
import { makeWorkspaceMapFixture } from "../test/workspaceMapFixture";

// Plain describe/it, no mocks — following skillVault.test.ts / this module's
// zero-React-zero-Convex contract.

const FIXTURE_DIRS: WorkspaceDirRow[] = makeWorkspaceMapFixture().dirs;

// ---------------------------------------------------------------------------
// Scaled synthetic fixture for layoutNodes — the small structural fixture
// above (11 rows) cannot produce D-01's 391-node first paint. 53 roots
// across the 4 departments, 333 depth-1 children spread over those roots,
// and depth-2/depth-3 descendants under exactly one root (which must NOT
// appear with an empty expandedSet). All names invented — never a real
// workspace root or directory name (Phase 115 D-17, carried by 114 D-16).
// ---------------------------------------------------------------------------

const SCALED_DEPARTMENTS = ["Personal", "Consulting", "Work", "Unclassified"] as const;
/** Sums to 53 — the measured 114-CONTEXT.md root count. */
const ROOTS_PER_DEPARTMENT = [20, 15, 10, 8];
/** Sums to 333 — the measured 114-CONTEXT.md depth-1 count. */
const TOTAL_DEPTH1_CHILDREN = 333;

function makeScaledFixture(): { dirs: WorkspaceDirRow[]; rootIds: string[] } {
  const dirs: WorkspaceDirRow[] = [];
  const rootIds: string[] = [];
  const rootDeptById = new Map<string, string>();
  let rootIndex = 0;

  SCALED_DEPARTMENTS.forEach((dept, deptIdx) => {
    for (let i = 0; i < ROOTS_PER_DEPARTMENT[deptIdx]; i++) {
      const rootId = `root-${String(rootIndex).padStart(2, "0")}`;
      rootIds.push(rootId);
      rootDeptById.set(rootId, dept);
      dirs.push({
        rootId,
        dirPath: "",
        department: dept,
        access: rootIndex % 2 === 0 ? "astridr-reachable" : "local-only",
        fileCount: 1 + (rootIndex % 5),
        totalSize: 100 * (rootIndex + 1),
        latestMtime: 1_755_000_000 + rootIndex,
        withheldCount: rootIndex % 3,
      });
      rootIndex++;
    }
  });

  // Distribute 333 depth-1 children across the 53 roots deterministically:
  // base count each, plus one extra for the first `remainder` roots.
  const base = Math.floor(TOTAL_DEPTH1_CHILDREN / rootIds.length);
  const remainder = TOTAL_DEPTH1_CHILDREN - base * rootIds.length;
  const childCounts = rootIds.map((_, i) => base + (i < remainder ? 1 : 0));

  rootIds.forEach((rootId, i) => {
    const dept = rootDeptById.get(rootId)!;
    for (let c = 0; c < childCounts[i]; c++) {
      dirs.push({
        rootId,
        dirPath: `dir-${c}`,
        department: dept,
        access: c % 2 === 0 ? "astridr-reachable" : "local-only",
        fileCount: c,
        totalSize: c * 10,
        latestMtime: 1_755_000_000 + c,
        withheldCount: c % 2,
      });
    }
  });

  // Depth-2 and depth-3 descendants under root-00's first depth-1 child
  // ("dir-0") only — must not appear on first paint (D-01), and must be
  // revealable one level at a time (D-03).
  const firstRootDept = rootDeptById.get("root-00")!;
  dirs.push({
    rootId: "root-00",
    dirPath: "dir-0/sub-a",
    department: firstRootDept,
    access: "local-only",
    fileCount: 2,
    totalSize: 20,
    latestMtime: 1_755_000_000,
    withheldCount: 0,
  });
  dirs.push({
    rootId: "root-00",
    dirPath: "dir-0/sub-a/leaf-a",
    department: firstRootDept,
    access: "local-only",
    fileCount: 1,
    totalSize: 10,
    latestMtime: 1_755_000_000,
    withheldCount: 0,
  });

  return { dirs, rootIds };
}

describe("nodeKey", () => {
  it("joins rootId and dirPath with a pipe", () => {
    expect(nodeKey("root-a", "child-1")).toBe("root-a|child-1");
    expect(nodeKey("root-a", "")).toBe("root-a|");
  });
});

describe("buildTree", () => {
  it("loses no row and duplicates none: every non-root row appears in exactly one parent's child list", () => {
    const tree = buildTree(FIXTURE_DIRS);

    const nonRootRows = FIXTURE_DIRS.filter((d) => d.dirPath !== "");
    const allChildren = [...tree.childrenByParent.values()].flat();

    // No duplication: the total count across all child lists equals the
    // number of non-root input rows.
    expect(allChildren.length).toBe(nonRootRows.length);

    // No loss: every non-root row is present in exactly one parent's list.
    for (const row of nonRootRows) {
      const occurrences = allChildren.filter(
        (c) => c.rootId === row.rootId && c.dirPath === row.dirPath
      );
      expect(occurrences.length).toBe(1);
    }

    // Root count + total children == total input rows (nothing lost, nothing duplicated).
    expect(tree.roots.length + allChildren.length).toBe(FIXTURE_DIRS.length);
  });

  it("makes a depth-3 row reachable by walking the adjacency map from its root", () => {
    const tree = buildTree(FIXTURE_DIRS);

    const rootKey = nodeKey("root-a", "");
    const depth1Children = tree.childrenByParent.get(rootKey) ?? [];
    const child1 = depth1Children.find((d) => d.dirPath === "child-1");
    expect(child1).toBeDefined();

    const depth1Key = nodeKey("root-a", "child-1");
    const depth2Children = tree.childrenByParent.get(depth1Key) ?? [];
    const sub1 = depth2Children.find((d) => d.dirPath === "child-1/sub-1");
    expect(sub1).toBeDefined();

    const depth2Key = nodeKey("root-a", "child-1/sub-1");
    const depth3Children = tree.childrenByParent.get(depth2Key) ?? [];
    const leaf1 = depth3Children.find((d) => d.dirPath === "child-1/sub-1/leaf-1");
    expect(leaf1).toBeDefined();
    expect(leaf1?.withheldCount).toBe(4);
  });

  it("attaches an orphaned row to its root and increments orphanCount instead of dropping it", () => {
    const orphanRow: WorkspaceDirRow = {
      rootId: "root-a",
      // "missing-parent" is never enumerated as its own row anywhere in
      // FIXTURE_DIRS, so this row's computed parent is absent from the payload.
      dirPath: "missing-parent/orphan-child",
      department: "Personal",
      access: "local-only",
      fileCount: 1,
      totalSize: 100,
      latestMtime: 1_755_000_000,
      withheldCount: 0,
    };
    const dirsWithOrphan = [...FIXTURE_DIRS, orphanRow];

    const healthyTree = buildTree(FIXTURE_DIRS);
    const orphanTree = buildTree(dirsWithOrphan);

    expect(healthyTree.orphanCount).toBe(0);
    expect(orphanTree.orphanCount).toBe(1);

    // The orphan is not dropped — it is attached to its root's child list.
    const rootKey = nodeKey("root-a", "");
    const rootChildren = orphanTree.childrenByParent.get(rootKey) ?? [];
    expect(rootChildren.some((d) => d.dirPath === "missing-parent/orphan-child")).toBe(true);
  });
});

describe("computeRollups — D-04 correctness proof", () => {
  /** Sum a field across every row belonging to a root, independently of computeRollups. */
  function independentSum(
    dirs: WorkspaceDirRow[],
    rootId: string,
    field: "fileCount" | "totalSize" | "withheldCount"
  ): number {
    return dirs.filter((d) => d.rootId === rootId).reduce((sum, d) => sum + d[field], 0);
  }

  it("rolls up fileCount for a known root to the independently-summed total of every descendant plus its own", () => {
    const tree = buildTree(FIXTURE_DIRS);
    const rollups = computeRollups(tree);
    const rootRollup = rollups.get(nodeKey("root-a", ""));

    expect(rootRollup?.fileCount).toBe(independentSum(FIXTURE_DIRS, "root-a", "fileCount"));
  });

  it("rolls up totalSize for the same root to the independently-summed total", () => {
    const tree = buildTree(FIXTURE_DIRS);
    const rollups = computeRollups(tree);
    const rootRollup = rollups.get(nodeKey("root-a", ""));

    expect(rootRollup?.totalSize).toBe(independentSum(FIXTURE_DIRS, "root-a", "totalSize"));
  });

  it("rolls up withheldCount for the same root to the independently-summed total", () => {
    const tree = buildTree(FIXTURE_DIRS);
    const rollups = computeRollups(tree);
    const rootRollup = rollups.get(nodeKey("root-a", ""));

    expect(rootRollup?.withheldCount).toBe(independentSum(FIXTURE_DIRS, "root-a", "withheldCount"));
  });

  it("a leaf node's rollup equals its own direct values exactly (degenerate control)", () => {
    const tree = buildTree(FIXTURE_DIRS);
    const rollups = computeRollups(tree);
    const leafKey = nodeKey("root-a", "child-1/sub-1/leaf-1");
    const leafRow = FIXTURE_DIRS.find(
      (d) => d.rootId === "root-a" && d.dirPath === "child-1/sub-1/leaf-1"
    )!;
    const leafRollup = rollups.get(leafKey);

    expect(leafRollup).toEqual({
      fileCount: leafRow.fileCount,
      totalSize: leafRow.totalSize,
      withheldCount: leafRow.withheldCount,
    });
  });

  it("does not mutate the input dirs rows", () => {
    const preCallClone = structuredClone(FIXTURE_DIRS);
    const tree = buildTree(FIXTURE_DIRS);
    computeRollups(tree);

    expect(FIXTURE_DIRS).toEqual(preCallClone);
  });

  it("is order-independent: a reversed input produces a deep-equal RollupMap", () => {
    const forwardTree = buildTree(FIXTURE_DIRS);
    const forwardRollups = computeRollups(forwardTree);

    const reversedTree = buildTree(FIXTURE_DIRS.slice().reverse());
    const reversedRollups = computeRollups(reversedTree);

    expect([...reversedRollups.entries()].sort()).toEqual([...forwardRollups.entries()].sort());
  });

  it("derives no withheld-bytes figure (only a count is ever produced)", () => {
    const tree = buildTree(FIXTURE_DIRS);
    const rollups = computeRollups(tree);
    for (const totals of rollups.values()) {
      expect(Object.keys(totals).sort()).toEqual(["fileCount", "totalSize", "withheldCount"]);
    }
  });
});

describe("layoutNodes — 391 nodes (D-01)", () => {
  const { dirs } = makeScaledFixture();
  const tree = buildTree(dirs);
  const rollups = computeRollups(tree);

  it("returns exactly 391 nodes with an empty expandedSet", () => {
    const { nodes } = layoutNodes(tree, rollups, new Set());
    expect(nodes.length).toBe(391);
  });

  it("breaks the 391 down by kind and depth: 1 center, 4 department, 53 root, 333 dir@depth1", () => {
    // A bare total of 391 could be reached by the wrong mixture — this is
    // what actually pins D-01.
    const { nodes } = layoutNodes(tree, rollups, new Set());
    expect(nodes.filter((n) => n.kind === "center").length).toBe(1);
    expect(nodes.filter((n) => n.kind === "department").length).toBe(4);
    expect(nodes.filter((n) => n.kind === "root").length).toBe(53);
    expect(nodes.filter((n) => n.kind === "dir" && n.depth === 1).length).toBe(333);
  });

  it("shows zero nodes at depth >= 2 with an empty expandedSet", () => {
    const { nodes } = layoutNodes(tree, rollups, new Set());
    expect(nodes.filter((n) => n.kind === "dir" && n.depth >= 2).length).toBe(0);
  });

  it("carries a correct dirCount and rolled.fileCount on every department hub, independently summed", () => {
    // Expected values computed here by filtering the flat input directly —
    // never by calling layoutNodes — so this is a producer proof, not a
    // self-comparison. Without it a 0/undefined render on plan 114-08's
    // department-hub panel would be invisible until a human opens it.
    const { nodes } = layoutNodes(tree, rollups, new Set());
    const departmentNodes = nodes.filter((n) => n.kind === "department");
    expect(departmentNodes.length).toBe(4);

    for (const deptNode of departmentNodes) {
      const rowsForDept = dirs.filter((d) => d.department === deptNode.department);
      const expectedDirCount = rowsForDept.length;
      const expectedFileCount = rowsForDept.reduce((sum, d) => sum + d.fileCount, 0);

      expect(deptNode.dirCount).toBe(expectedDirCount);
      expect(deptNode.dirCount).toBeGreaterThan(0);
      expect(deptNode.rolled.fileCount).toBe(expectedFileCount);
      expect(deptNode.rolled.fileCount).toBeGreaterThan(0);
    }
  });
});

describe("layoutNodes — one level per click (D-03)", () => {
  const { dirs } = makeScaledFixture();
  const tree = buildTree(dirs);
  const rollups = computeRollups(tree);

  const depth1Key = nodeKey("root-00", "dir-0");
  const depth2Key = nodeKey("root-00", "dir-0/sub-a");
  const depth3Key = nodeKey("root-00", "dir-0/sub-a/leaf-a");
  // root-00's other depth-1 children (dir-1, dir-2, ...) carry no descendants
  // anywhere in the fixture — expanding one must be a true no-op.
  const leafDepth1Key = nodeKey("root-00", "dir-1");

  it("expanding a depth-1 node reveals exactly its direct children, and none of its grandchildren", () => {
    const baseline = layoutNodes(tree, rollups, new Set()).nodes;
    const expanded = layoutNodes(tree, rollups, new Set([depth1Key])).nodes;

    expect(expanded.length).toBe(baseline.length + 1); // "sub-a" only
    expect(expanded.some((n) => n.id === depth2Key)).toBe(true);
    expect(expanded.some((n) => n.id === depth3Key)).toBe(false);
  });

  it("expanding a depth-2 node reveals its own direct children — the one-level property holds below depth 1 too", () => {
    const oneLevel = layoutNodes(tree, rollups, new Set([depth1Key])).nodes;
    const twoLevels = layoutNodes(tree, rollups, new Set([depth1Key, depth2Key])).nodes;

    expect(twoLevels.length).toBe(oneLevel.length + 1); // "leaf-a" only
    expect(twoLevels.some((n) => n.id === depth3Key)).toBe(true);
  });

  it("collapsing (removing the key) returns the node set to deep-equality with the pre-expansion set", () => {
    const baseline = layoutNodes(tree, rollups, new Set()).nodes;

    const expandedSet = new Set([depth1Key]);
    layoutNodes(tree, rollups, expandedSet); // pure function — does not mutate expandedSet
    expandedSet.delete(depth1Key); // the collapse toggle a real component performs
    const afterCollapse = layoutNodes(tree, rollups, expandedSet).nodes;

    const sortById = (arr: typeof baseline) => arr.slice().sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(afterCollapse)).toEqual(sortById(baseline));
  });

  it("expanding a leaf (no children in the payload) changes the node count by exactly 0", () => {
    const baseline = layoutNodes(tree, rollups, new Set()).nodes;
    const expandedLeaf = layoutNodes(tree, rollups, new Set([leafDepth1Key])).nodes;

    expect(expandedLeaf.length).toBe(baseline.length);
  });
});
