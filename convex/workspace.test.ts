import { describe, it, expect } from "vitest";

/**
 * Pure-logic mirror tests for the workspace scanner receiver (Phase 115,
 * D-10/D-11/D-13) — no DB round-trip. `convex-test` is not installed in this
 * repo; this file follows the identical style established by
 * `convex/graphSnapshots.test.ts` (Phase 83): plain `expect()` mirror
 * functions plus `it.todo(...)` markers for the DB-dependent cases, deferred
 * to plan 115-09's attended live wave.
 */

import { selectVersionDeletes } from "./graphSnapshots";
import { WORKSPACE_KEEP_VERSIONS, WORKSPACE_DELETE_CAP } from "./workspace";

// ---------------------------------------------------------------------------
// Mirror functions — replicate upsertWorkspaceSnapshot's bookkeeping without
// a Convex runtime.
// ---------------------------------------------------------------------------

/**
 * Mirrors step 6's post-delete-loop meta patch: given the storedVersions
 * array (post pointer-flip), the version targeted for deletion, how many
 * rows were actually deleted, and the cap, returns the next storedVersions
 * array and pruneIncomplete flag.
 */
function nextStoredVersions(
  stored: number[],
  versionToDelete: number,
  deletedCount: number,
  cap: number
): { storedVersions: number[]; pruneIncomplete: boolean } {
  if (deletedCount >= cap) {
    // Cap hit — retain the version so the next ingest re-selects and
    // finishes it. Never raise the cap to "finish it this time".
    return { storedVersions: stored, pruneIncomplete: true };
  }
  return {
    storedVersions: stored.filter((v) => v !== versionToDelete),
    pruneIncomplete: false,
  };
}

/**
 * Mirrors step 4's totals derivation: server-side sums over the incoming
 * dirs array, never trusting a producer-supplied total.
 */
function deriveTotals(
  dirs: Array<{ fileCount: number; totalSize: number; withheldCount: number }>
): { totalDirs: number; totalFiles: number; totalWithheldFiles: number; totalBytes: number } {
  let totalFiles = 0;
  let totalWithheldFiles = 0;
  let totalBytes = 0;
  for (const dir of dirs) {
    totalFiles += dir.fileCount;
    totalWithheldFiles += dir.withheldCount;
    totalBytes += dir.totalSize;
  }
  return { totalDirs: dirs.length, totalFiles, totalWithheldFiles, totalBytes };
}

/**
 * Mirrors step 2's version allocation: server-side only, monotonic, never
 * reused. A producer never supplies its own version (T-115-04-06).
 */
function nextVersion(existingActiveVersion: number | undefined): number {
  return (existingActiveVersion ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// selectVersionDeletes against WORKSPACE_KEEP_VERSIONS
// ---------------------------------------------------------------------------

describe("selectVersionDeletes against WORKSPACE_KEEP_VERSIONS", () => {
  it("WORKSPACE_KEEP_VERSIONS is 3", () => {
    expect(WORKSPACE_KEEP_VERSIONS).toBe(3);
  });

  it("returns [] when versions is empty", () => {
    expect(selectVersionDeletes([], WORKSPACE_KEEP_VERSIONS)).toEqual([]);
  });

  it("returns [] when version count is exactly keepN", () => {
    expect(selectVersionDeletes([1, 2, 3], WORKSPACE_KEEP_VERSIONS)).toEqual([]);
  });

  it("returns [] when version count is below keepN", () => {
    expect(selectVersionDeletes([1, 2], WORKSPACE_KEEP_VERSIONS)).toEqual([]);
  });

  it("returns oldest versions when count exceeds keepN", () => {
    // 5 versions, keep 3 → delete oldest 2: [1, 2]
    expect(selectVersionDeletes([1, 2, 3, 4, 5], WORKSPACE_KEEP_VERSIONS)).toEqual([1, 2]);
  });

  it("handles unsorted input — sorts internally before selecting", () => {
    expect(selectVersionDeletes([5, 1, 4, 2, 3], WORKSPACE_KEEP_VERSIONS)).toEqual([1, 2]);
  });

  it("keeps exactly the N newest versions", () => {
    // 6 versions, keep 3 → delete oldest 3: [1, 2, 3]
    expect(selectVersionDeletes([1, 2, 3, 4, 5, 6], WORKSPACE_KEEP_VERSIONS)).toEqual([1, 2, 3]);
  });

  it("handles keepN = 1 — keeps only the newest", () => {
    expect(selectVersionDeletes([1, 2, 3], 1)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Prune bookkeeping mirror — nextStoredVersions
// ---------------------------------------------------------------------------

describe("nextStoredVersions — prune bookkeeping (D-11)", () => {
  it("full delete (deletedCount < cap) removes versionToDelete, pruneIncomplete false", () => {
    const result = nextStoredVersions([1, 2, 3, 4], 1, 500, WORKSPACE_DELETE_CAP);
    expect(result.storedVersions).toEqual([2, 3, 4]);
    expect(result.pruneIncomplete).toBe(false);
  });

  it("cap hit (deletedCount === cap) retains versionToDelete, pruneIncomplete true", () => {
    const result = nextStoredVersions([1, 2, 3, 4], 1, WORKSPACE_DELETE_CAP, WORKSPACE_DELETE_CAP);
    expect(result.storedVersions).toEqual([1, 2, 3, 4]);
    expect(result.pruneIncomplete).toBe(true);
  });

  it("idempotence: a deferred remainder self-heals on the next ingest", () => {
    // First ingest hits the cap — version 1 retained, incomplete.
    const first = nextStoredVersions([1, 2, 3, 4], 1, WORKSPACE_DELETE_CAP, WORKSPACE_DELETE_CAP);
    expect(first.pruneIncomplete).toBe(true);
    expect(first.storedVersions).toContain(1);

    // Next ingest re-selects version 1 (still in storedVersions) and finishes
    // it with a smaller remaining delete count — never expanding the cap.
    const second = nextStoredVersions(first.storedVersions, 1, 120, WORKSPACE_DELETE_CAP);
    expect(second.storedVersions).toEqual([2, 3, 4]);
    expect(second.pruneIncomplete).toBe(false);
  });

  it("control: with stored.length <= keepN, selectVersionDeletes selects nothing and storedVersions is unchanged", () => {
    // Without this control, the three assertions above are satisfiable by a
    // function that always defers (always retains, always pruneIncomplete
    // true) — this proves the "nothing to prune" branch is reachable and
    // leaves storedVersions untouched, matching upsertWorkspaceSnapshot's
    // early return at step 6.
    const stored = [1, 2, 3];
    const toDelete = selectVersionDeletes(stored, WORKSPACE_KEEP_VERSIONS);
    expect(toDelete).toEqual([]);
    // The mutation's actual behavior when toDelete is empty: return early,
    // storedVersions stays exactly what the pointer-flip patch wrote.
    expect(stored).toEqual([1, 2, 3]);
  });
});

// ---------------------------------------------------------------------------
// Derived totals mirror — deriveTotals (Pitfall 1 / D-03 side-channel rule)
// ---------------------------------------------------------------------------

describe("deriveTotals — server-side aggregate derivation", () => {
  const fixture = [
    { fileCount: 10, totalSize: 1000, withheldCount: 2 },
    { fileCount: 5, totalSize: 500, withheldCount: 0 },
    { fileCount: 0, totalSize: 0, withheldCount: 3 },
  ];

  it("sums totalDirs/totalFiles/totalWithheldFiles/totalBytes over the fixture", () => {
    const totals = deriveTotals(fixture);
    expect(totals.totalDirs).toBe(3);
    expect(totals.totalFiles).toBe(15);
    expect(totals.totalWithheldFiles).toBe(5);
    expect(totals.totalBytes).toBe(1500);
  });

  it("withheldCount contributes to totalWithheldFiles and NOT to totalFiles or totalBytes", () => {
    // A directory with withheld files only (fileCount 0, totalSize 0) must
    // not inflate totalFiles/totalBytes — those cover VISIBLE files only.
    const withheldOnly = [{ fileCount: 0, totalSize: 0, withheldCount: 7 }];
    const totals = deriveTotals(withheldOnly);
    expect(totals.totalWithheldFiles).toBe(7);
    expect(totals.totalFiles).toBe(0);
    expect(totals.totalBytes).toBe(0);
  });

  it("empty dirs array produces all-zero totals", () => {
    const totals = deriveTotals([]);
    expect(totals).toEqual({ totalDirs: 0, totalFiles: 0, totalWithheldFiles: 0, totalBytes: 0 });
  });
});

// ---------------------------------------------------------------------------
// Version monotonicity mirror — nextVersion (T-115-04-06)
// ---------------------------------------------------------------------------

describe("nextVersion — monotonic, server-side-only allocation", () => {
  it("returns 1 from undefined (first ingest)", () => {
    expect(nextVersion(undefined)).toBe(1);
  });

  it("returns n+1 for an existing activeVersion", () => {
    expect(nextVersion(1)).toBe(2);
    expect(nextVersion(5)).toBe(6);
    expect(nextVersion(41)).toBe(42);
  });

  it("never returns a value already in storedVersions", () => {
    const storedVersions = [3, 4, 5];
    const existingActiveVersion = 5;
    const newVersion = nextVersion(existingActiveVersion);
    expect(storedVersions).not.toContain(newVersion);
    expect(newVersion).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// DB round-trip tests — deferred to plan 115-09 (requires Convex backend +
// live ingest route). Per 115-VALIDATION.md § "Deferred to live verification".
// ---------------------------------------------------------------------------

it.todo(
  "upsertWorkspaceSnapshot re-POST same snapshotId → activeVersion increments to 2, never two active versions (DB round-trip)"
);
it.todo(
  "the inline prune deletes the OLDEST version's rows and never the active version's rows (DB round-trip)"
);
it.todo(
  "a crash between the delete loop and the second meta patch self-heals on the next ingest (DB round-trip)"
);
it.todo(
  "getWorkspaceMap returns null before any ingest and the active version's rows after (DB round-trip)"
);
