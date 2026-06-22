/**
 * Shared fixture + mock helper for Phase 84 tests.
 *
 * `makeProjectGraphFixture(overrides?)` — returns an object exactly matching
 * the getProjectGraph return shape from convex/graphSnapshots.ts:260-281.
 *
 * `mockGetProjectGraph(value)` — configures the vi.mock("convex/react")
 * useQuery mock to return `value` when called for api.graphSnapshots.getProjectGraph.
 * Import and call this inside describe/beforeEach in consumer test files.
 */

import { vi } from "vitest";
import { useQuery } from "convex/react";

// ---------------------------------------------------------------------------
// Shape types (mirrored from the Convex handler return)
// ---------------------------------------------------------------------------

export interface SourceEntry {
  source: string;
  kind: string;
  nodeCount: number;
  linkCount: number;
  emittedNodeCount: number;
  emittedLinkCount: number;
  truncated: boolean;
}

export interface FixtureNode {
  id: string;
  label: string;
  type: string;
  community: number | null | undefined;
  source: string;
}

export interface FixtureLink {
  source: string;
  target: string;
  relation: string;
}

export interface ProjectGraphFixture {
  snapshotId: string;
  sources: SourceEntry[];
  nodeCount: number;
  linkCount: number;
  storedNodeCount: number;
  storedLinkCount: number;
  generatedAt: number;
  nodes: FixtureNode[];
  links: FixtureLink[];
}

// ---------------------------------------------------------------------------
// Fixture factory
// ---------------------------------------------------------------------------

export function makeProjectGraphFixture(
  overrides: Partial<ProjectGraphFixture> & {
    truncated?: boolean;
    staleGeneratedAt?: number;
    storedNodeCountOverride?: number;
    storedLinkCountOverride?: number;
  } = {}
): ProjectGraphFixture {
  const {
    truncated = false,
    staleGeneratedAt,
    storedNodeCountOverride,
    storedLinkCountOverride,
    ...rest
  } = overrides;

  // NOTE: `source` is a BARE source name ("codepulse" | "vault"), matching the
  // real getProjectGraph payload. The `vault:` / `graphify:` prefix lives in the
  // node `id`, which is the reliable code/vault discriminator (see isVaultNode).
  const defaultNodes: FixtureNode[] = [
    {
      id: "graphify:codepulse:src/a.ts",
      label: "a.ts",
      type: "file",
      community: 0,
      source: "codepulse",
    },
    {
      id: "graphify:codepulse:src/b.ts",
      label: "b.ts",
      type: "file",
      community: 0,
      source: "codepulse",
    },
    {
      id: "vault:Note.md",
      label: "Note.md",
      type: "note",
      community: null,
      source: "vault",
    },
  ];

  const defaultLinks: FixtureLink[] = [
    {
      source: "graphify:codepulse:src/a.ts",
      target: "graphify:codepulse:src/b.ts",
      relation: "imports",
    },
    {
      source: "graphify:codepulse:src/a.ts",
      target: "vault:Note.md",
      relation: "references",
    },
  ];

  const defaultSources: SourceEntry[] = [
    {
      source: "codepulse",
      kind: "graphify",
      // Truncation means the source held MORE than was emitted/stored, so the
      // total (nodeCount/linkCount) is the larger number — the chip renders
      // "emitted / total" and must read "2 / 5", never the inverted "5 / 2" (WR-03).
      nodeCount: truncated ? 5 : 2,
      linkCount: truncated ? 3 : 1,
      emittedNodeCount: 2,
      emittedLinkCount: 1,
      truncated,
    },
    {
      source: "vault",
      kind: "vault",
      nodeCount: 1,
      linkCount: 1,
      emittedNodeCount: 1,
      emittedLinkCount: 1,
      truncated: false,
    },
  ];

  const nodeCount = 3;
  const linkCount = 2;
  const storedNodeCount =
    storedNodeCountOverride !== undefined ? storedNodeCountOverride : nodeCount;
  const storedLinkCount =
    storedLinkCountOverride !== undefined ? storedLinkCountOverride : linkCount;
  // generatedAt is Unix SECONDS (float64) — multiply by 1000 before Date.now() comparison
  const generatedAt =
    staleGeneratedAt !== undefined ? staleGeneratedAt : Date.now() / 1000;

  return {
    snapshotId: "astridr-project-graph",
    sources: defaultSources,
    nodeCount,
    linkCount,
    storedNodeCount,
    storedLinkCount,
    generatedAt,
    nodes: defaultNodes,
    links: defaultLinks,
    ...rest,
  };
}

// ---------------------------------------------------------------------------
// Mock helper — call inside vi.mock("convex/react") consumer tests
// ---------------------------------------------------------------------------

/**
 * Configures the mocked useQuery (from `vi.mock("convex/react")`) to return
 * `value` for all calls (typically scoped to api.graphSnapshots.getProjectGraph).
 *
 * Usage in consumer test files:
 *
 *   vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
 *   import { mockGetProjectGraph } from "@/test/projectGraphFixture";
 *
 *   beforeEach(() => {
 *     mockGetProjectGraph(makeProjectGraphFixture());
 *   });
 */
export function mockGetProjectGraph(
  value: ProjectGraphFixture | null | undefined
): void {
  const mockUseQuery = vi.mocked(useQuery);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockUseQuery as any).mockReturnValue(value);
}
