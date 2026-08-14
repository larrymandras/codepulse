import { describe, it, expect } from "vitest";
import { buildTree, computeRollups, nodeKey, type WorkspaceDirRow } from "./workspaceMapLayout";
import { makeWorkspaceMapFixture } from "../test/workspaceMapFixture";

// Plain describe/it, no mocks — following skillVault.test.ts / this module's
// zero-React-zero-Convex contract.

const FIXTURE_DIRS: WorkspaceDirRow[] = makeWorkspaceMapFixture().dirs;

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
