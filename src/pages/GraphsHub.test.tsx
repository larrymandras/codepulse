/**
 * GraphsHub tests (Phase 84, plan 03, GH-03)
 *
 * Wave 0 scaffold — all behaviors enumerated per 84-VALIDATION.md.
 * Implemented assertions arrive in plan 03. This file runs clean (exit 0)
 * in Wave 0; todos are pending, not failing.
 *
 * Behaviors under test (2 rows from 84-VALIDATION.md):
 *   1. Three MetricCard summary tiles render (KG Explorer, Tool Galaxy, MCP Inventory)
 *   2. Clicking each tile navigates to its route (/knowledge-graph, /tool-galaxy, /mcp-inventory)
 */

import { describe, it, vi, beforeEach } from "vitest";
import { makeProjectGraphFixture } from "@/test/projectGraphFixture";

// ---------------------------------------------------------------------------
// Module mocks — declared before component import
// ---------------------------------------------------------------------------

// Mock convex/react — GraphsHub tiles derive counts from Convex hooks
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    graphSnapshots: {
      getProjectGraph: "graphSnapshots:getProjectGraph",
    },
    kg: {
      latestSummary: "kg:latestSummary",
    },
    toolGalaxy: {
      galaxySources: "toolGalaxy:galaxySources",
    },
    mcpHealth: {
      healthSources: "mcpHealth:healthSources",
    },
  },
}));

// Mock react-router-dom navigate — GraphsHub tiles call useNavigate on click
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock CodeVaultGraph — plan 02 implements it; plan 03 tests hub around it
vi.mock("@/components/graph/CodeVaultGraph", () => ({
  CodeVaultGraph: () => (
    <div data-testid="code-vault-graph-stub" />
  ),
}));

// Mock ForceGraphCanvas — canvas not available in jsdom
vi.mock("@/components/graph/ForceGraphCanvas", () => ({
  ForceGraphCanvas: () => (
    <div data-testid="force-graph-canvas-stub" />
  ),
}));

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const _defaultFixture = makeProjectGraphFixture();
void _defaultFixture;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GraphsHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo(
    "renders three MetricCard summary tiles: KG Explorer, Tool Galaxy, MCP Inventory"
  );

  it.todo(
    "clicking the KG Explorer tile navigates to /knowledge-graph"
  );

  it.todo(
    "clicking the Tool Galaxy tile navigates to /tool-galaxy"
  );

  it.todo(
    "clicking the MCP Inventory tile navigates to /mcp-inventory"
  );
});
