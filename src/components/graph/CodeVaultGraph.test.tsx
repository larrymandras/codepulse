/**
 * CodeVaultGraph tests (Phase 84, plan 02, GH-02)
 *
 * Wave 0 scaffold — all behaviors enumerated per 84-VALIDATION.md.
 * Implemented assertions arrive in plan 02. This file runs clean (exit 0)
 * in Wave 0; todos are pending, not failing.
 *
 * Behaviors under test (9 rows from 84-VALIDATION.md):
 *   1. Render with data — nodes painted, legend visible
 *   2. Loading state on undefined (Convex resolving)
 *   3. Empty state on null (no snapshot ingested, D-12)
 *   4. Source filter drops vault nodes + dangling links when "code" selected
 *   5. Truncation header "X of Y nodes" from nodeCount vs storedNodeCount
 *   6. Stale badge when generatedAt*1000 > 36 h ago
 *   7. Integrity warning when storedNodeCount < nodeCount
 *   8. Detail panel on node click (id/label/type/source/community/neighbors)
 *   9. colorFn → #10b981 for code-source nodes, #8b5cf6 for vault-source nodes
 */

import { describe, it, vi, beforeEach } from "vitest";
import { makeProjectGraphFixture } from "@/test/projectGraphFixture";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

// Mock convex/react so useProjectGraph never hits a real Convex backend
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    graphSnapshots: {
      getProjectGraph: "graphSnapshots:getProjectGraph",
    },
  },
}));

// Mock ForceGraphCanvas — heavy canvas dep not available in jsdom
vi.mock("@/components/graph/ForceGraphCanvas", () => ({
  ForceGraphCanvas: ({
    "data-testid": testId,
  }: {
    "data-testid"?: string;
  }) => (
    <div data-testid={testId ?? "force-graph-canvas"} />
  ),
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

// Keep a reference to re-use across tests; individual tests override as needed
const _defaultFixture = makeProjectGraphFixture();

// Suppress unused warning — fixture will be used when todos are implemented
void _defaultFixture;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CodeVaultGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo(
    "renders nodes and legend when snapshot data is available (render-with-data)"
  );

  it.todo(
    "shows loading pulse when useQuery returns undefined (loading state)"
  );

  it.todo(
    "shows empty/explainer state when useQuery returns null (no snapshot, D-12)"
  );

  it.todo(
    "source filter 'code' drops vault nodes and removes dangling links from data passed to ForceGraphCanvas"
  );

  it.todo(
    "truncation header shows 'X of Y nodes' when sources[].truncated is true or emittedNodeCount > nodeCount"
  );

  it.todo(
    "stale freshness badge renders when generatedAt*1000 is more than 36 hours ago"
  );

  it.todo(
    "integrity warning renders when storedNodeCount < nodeCount or storedLinkCount < linkCount (D-08)"
  );

  it.todo(
    "clicking a node opens the detail panel showing id, label, type, source, community, and neighbors"
  );

  it.todo(
    "colorFn returns #10b981 for graphify/code-source nodes and #8b5cf6 for vault-source nodes"
  );
});
