/**
 * Shared fixture + mock helper for Phase 114 (Workspace Map view) tests.
 *
 * `makeWorkspaceMapFixture(overrides?)` — returns an object exactly matching
 * the `getWorkspaceMap` return shape from convex/workspace.ts:320-345.
 *
 * `mockGetWorkspaceMap(value)` / `mockArmsProbe(value)` — configure the
 * `vi.mock("convex/react")` `useQuery` mock to return the right value for
 * `api.workspace.getWorkspaceMap` vs `api.graphSnapshots.listSnapshots`
 * respectively, discriminating by the query FUNCTION REFERENCE rather than a
 * blanket `mockReturnValue`. A page test may need to mock both simultaneously
 * (the workspace-map page also probes `listSnapshots` for D-11's Ástríðr-lens
 * empty state) — a blanket return would hand the workspace payload to the
 * arms probe and vice versa, producing a green test that measured the wrong
 * thing.
 *
 * ---------------------------------------------------------------------------
 * SYNTHETIC ROOT AND DIRECTORY NAMES ONLY — Phase 115 D-17 (carried forward
 * verbatim by 114's D-16).
 *
 * `larrymandras/codepulse` is a PUBLIC repo. Several of the real root
 * directory names in Larry's live workspace tree read like client
 * engagements; committing one here would be a new, permanent, one-way
 * disclosure (git history survives deletion). Every root id, dirPath
 * segment, and label below is INVENTED — `root-a`, `child-1`, `acme-client`-
 * shaped placeholders only. Do NOT "improve" this fixture with real names
 * from the live snapshot, even though aggregate counts (root count, dirs per
 * department, etc.) are already published in 114-CONTEXT.md § Specific Ideas
 * and are safe to reference. Names are not.
 * ---------------------------------------------------------------------------
 */

import { vi } from "vitest";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Shape types (mirrored from the Convex handler return, convex/workspace.ts:320-345)
// ---------------------------------------------------------------------------

export interface WorkspaceMapDir {
  rootId: string;
  dirPath: string; // "" means the root itself; forward-slash relative otherwise
  department: string; // "Work" | "Consulting" | "Personal" | "Unclassified"
  access: string; // "astridr-reachable" | "local-only"
  fileCount: number; // VISIBLE files directly in this directory only
  totalSize: number; // bytes of VISIBLE files only
  latestMtime: number; // epoch seconds
  withheldCount: number; // count-only — no byte total (side-channel rule, schema.ts:2385-2389)
}

export interface WorkspaceMapFixture {
  snapshotId: string;
  activeVersion: number;
  generatedAt: number; // epoch SECONDS (schema.ts:2400)
  receivedAt: number; // epoch SECONDS
  rootCount: number;
  coveredRoots: string[]; // array of root ids, NOT a count
  scannedRootsComplete: boolean;
  unclassifiedRootIds: string[];
  accessDerivationOk: boolean;
  localConfigStatus: string; // "merged" | "absent" | "version-mismatch" (bare string, schema.ts:2411)
  totalDirs: number;
  totalFiles: number;
  totalWithheldFiles: number;
  totalBytes: number;
  dirs: WorkspaceMapDir[];
}

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

const DEFAULT_ROOT_IDS = ["root-a", "root-b", "root-c", "root-d"];

// A fixed epoch-seconds timestamp so non-staleness tests are deterministic
// without depending on wall-clock time at test-run.
const FIXED_MTIME = 1_755_000_000; // ~2025-08, plausible epoch seconds

function defaultDirs(): WorkspaceMapDir[] {
  return [
    // --- root-a (Personal) — carries depth-1, depth-2 AND depth-3 descendants ---
    {
      rootId: "root-a",
      dirPath: "",
      department: "Personal",
      access: "astridr-reachable",
      fileCount: 5,
      totalSize: 5_000,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },
    {
      // depth 1 — withheldCount > 0 (D-09's notice case)
      rootId: "root-a",
      dirPath: "child-1",
      department: "Personal",
      access: "astridr-reachable",
      fileCount: 3,
      totalSize: 3_000,
      latestMtime: FIXED_MTIME,
      withheldCount: 2,
    },
    {
      // depth 2 — fileCount: 0, withheldCount: 0 (pure-structure directory)
      rootId: "root-a",
      dirPath: "child-1/sub-1",
      department: "Personal",
      access: "local-only",
      fileCount: 0,
      totalSize: 0,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },
    {
      // depth 3 — fileCount: 0, withheldCount > 0 (everything here was withheld,
      // a fact the map must not conflate with the depth-2 sibling above)
      rootId: "root-a",
      dirPath: "child-1/sub-1/leaf-1",
      department: "Personal",
      access: "local-only",
      fileCount: 0,
      totalSize: 0,
      latestMtime: FIXED_MTIME,
      withheldCount: 4,
    },
    {
      // depth 1 sibling, astridr-reachable
      rootId: "root-a",
      dirPath: "child-2",
      department: "Personal",
      access: "astridr-reachable",
      fileCount: 2,
      totalSize: 200,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },

    // --- root-b (Consulting) ---
    {
      rootId: "root-b",
      dirPath: "",
      department: "Consulting",
      access: "local-only",
      fileCount: 4,
      totalSize: 4_000,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },
    {
      rootId: "root-b",
      dirPath: "child-1",
      department: "Consulting",
      access: "local-only",
      fileCount: 1,
      totalSize: 100,
      latestMtime: FIXED_MTIME,
      withheldCount: 1,
    },

    // --- root-c (Work) ---
    {
      rootId: "root-c",
      dirPath: "",
      department: "Work",
      access: "astridr-reachable",
      fileCount: 6,
      totalSize: 6_000,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },
    {
      rootId: "root-c",
      dirPath: "child-1",
      department: "Work",
      access: "local-only",
      fileCount: 2,
      totalSize: 200,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },

    // --- root-d (Unclassified) ---
    {
      rootId: "root-d",
      dirPath: "",
      department: "Unclassified",
      access: "local-only",
      fileCount: 1,
      totalSize: 10,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },
    {
      rootId: "root-d",
      dirPath: "child-1",
      department: "Unclassified",
      access: "local-only",
      fileCount: 0,
      totalSize: 0,
      latestMtime: FIXED_MTIME,
      withheldCount: 0,
    },
  ];
}

function sumField(dirs: WorkspaceMapDir[], field: "fileCount" | "totalSize" | "withheldCount"): number {
  return dirs.reduce((sum, d) => sum + d[field], 0);
}

/**
 * Returns an object matching `getWorkspaceMap`'s exact return shape.
 *
 * The bare no-argument call is the HEALTHY CONTROL — all four honesty
 * signals green: `scannedRootsComplete: true`, `accessDerivationOk: true`,
 * `localConfigStatus: "merged"`, `unclassifiedRootIds: []`, and
 * `coveredRoots.length === rootCount`.
 *
 * `generatedAt` defaults to `Date.now() / 1000` (epoch SECONDS, matching the
 * `workspaceSnapshots.generatedAt` convention at schema.ts:2400) so the
 * healthy fixture is never stale. Pass `staleGeneratedAt` to pin an exact
 * value for D-17 boundary tests (mirrors `projectGraphFixture.ts:145-147`).
 */
export function makeWorkspaceMapFixture(
  overrides: Partial<WorkspaceMapFixture> & { staleGeneratedAt?: number } = {}
): WorkspaceMapFixture {
  const { staleGeneratedAt, dirs: dirsOverride, ...rest } = overrides;

  const dirs = dirsOverride ?? defaultDirs();

  // generatedAt is Unix SECONDS (float64) — multiply by 1000 before Date.now()
  // comparison. A `/1000` error here yields 1970 dates and makes D-17's whole
  // staleness check pass vacuously (see project LESSONS).
  const generatedAt = staleGeneratedAt !== undefined ? staleGeneratedAt : Date.now() / 1000;

  return {
    snapshotId: "larry-workspace",
    activeVersion: 1,
    generatedAt,
    receivedAt: generatedAt,
    rootCount: DEFAULT_ROOT_IDS.length,
    coveredRoots: [...DEFAULT_ROOT_IDS],
    scannedRootsComplete: true,
    unclassifiedRootIds: [],
    accessDerivationOk: true,
    localConfigStatus: "merged",
    totalDirs: dirs.length,
    totalFiles: sumField(dirs, "fileCount"),
    totalWithheldFiles: sumField(dirs, "withheldCount"),
    totalBytes: sumField(dirs, "totalSize"),
    dirs,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Four degraded presets — one per D-16 honesty flag. Each flips EXACTLY one
// signal and leaves the other three green, so a downstream test consuming a
// preset is a control, not a confound.
// ---------------------------------------------------------------------------

/** D-16 flag 1: the walk did not finish — one declared root never enumerated. */
export function makeScannedRootsIncompleteFixture(
  overrides: Partial<WorkspaceMapFixture> & { staleGeneratedAt?: number } = {}
): WorkspaceMapFixture {
  return makeWorkspaceMapFixture({
    scannedRootsComplete: false,
    coveredRoots: DEFAULT_ROOT_IDS.slice(0, DEFAULT_ROOT_IDS.length - 1), // shorter than rootCount
    ...overrides,
  });
}

/** D-16 flag 2: the compose parse failed and every directory fell back to local-only. */
export function makeAccessDerivationFailedFixture(
  overrides: Partial<WorkspaceMapFixture> & { staleGeneratedAt?: number } = {}
): WorkspaceMapFixture {
  return makeWorkspaceMapFixture({
    accessDerivationOk: false,
    ...overrides,
  });
}

/** D-16 flag 3a: the local config loader found no config file at all. */
export function makeLocalConfigAbsentFixture(
  overrides: Partial<WorkspaceMapFixture> & { staleGeneratedAt?: number } = {}
): WorkspaceMapFixture {
  return makeWorkspaceMapFixture({
    localConfigStatus: "absent",
    ...overrides,
  });
}

/** D-16 flag 3b: the local config loader found a config file at an unexpected schema version. */
export function makeLocalConfigVersionMismatchFixture(
  overrides: Partial<WorkspaceMapFixture> & { staleGeneratedAt?: number } = {}
): WorkspaceMapFixture {
  return makeWorkspaceMapFixture({
    localConfigStatus: "version-mismatch",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Mock helpers — call inside describe/beforeEach in consumer test files.
// Discriminate by QUERY REFERENCE (api.workspace.getWorkspaceMap vs
// api.graphSnapshots.listSnapshots) via mockImplementation, not a blanket
// mockReturnValue — see file header for why.
// ---------------------------------------------------------------------------

/** Row shape mirrored from `listSnapshots` (convex/graphSnapshots.ts) post-D-13. */
export interface ArmsProbeSnapshotRow {
  snapshotId: string;
  nodeCount: number;
  linkCount: number;
  generatedAt: number;
  updatedAt: number;
  sources: Array<{
    source: string;
    kind: string; // useArmsProbe filters on kind === "arms"
    nodeCount: number;
    linkCount: number;
    emittedNodeCount: number;
    emittedLinkCount: number;
    truncated: boolean;
  }>;
}

let workspaceMapValue: WorkspaceMapFixture | null | undefined;
let workspaceMapConfigured = false;
let armsProbeValue: ArmsProbeSnapshotRow[] | undefined;
let armsProbeConfigured = false;

function installDiscriminatingMockImplementation(): void {
  const mockUseQuery = vi.mocked(useQuery);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseQuery.mockImplementation((queryFn: any, ..._args: any[]) => {
    if (queryFn === api.workspace.getWorkspaceMap) {
      return workspaceMapConfigured ? workspaceMapValue : undefined;
    }
    if (queryFn === api.graphSnapshots.listSnapshots) {
      return armsProbeConfigured ? armsProbeValue : undefined;
    }
    return undefined;
  });
}

/**
 * Configures the mocked `useQuery` to return `value` for
 * `api.workspace.getWorkspaceMap` specifically. Safe to call alongside
 * `mockArmsProbe` in the same test file — the two are discriminated by
 * query reference, not order of the last call.
 */
export function mockGetWorkspaceMap(value: WorkspaceMapFixture | null | undefined): void {
  workspaceMapValue = value;
  workspaceMapConfigured = true;
  installDiscriminatingMockImplementation();
}

/**
 * Configures the mocked `useQuery` to return `value` for
 * `api.graphSnapshots.listSnapshots` specifically — the query D-11's arms
 * probe reads. Pass an array containing a row with `sources` containing
 * `kind: "arms"` to simulate the Ástríðr lens having data; pass `[]` to
 * simulate the honest-empty state; pass `undefined` to simulate loading.
 */
export function mockArmsProbe(value: ArmsProbeSnapshotRow[] | undefined): void {
  armsProbeValue = value;
  armsProbeConfigured = true;
  installDiscriminatingMockImplementation();
}
