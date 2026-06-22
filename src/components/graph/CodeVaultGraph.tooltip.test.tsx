/**
 * CodeVaultGraph — TooltipProvider regression test (Phase 84 UAT gap).
 *
 * The main CodeVaultGraph.test.tsx mocks "@/components/ui/tooltip", so it
 * cannot catch a missing TooltipProvider. This file renders with the REAL
 * Radix-backed tooltip module: Radix's <Tooltip> throws
 * "`Tooltip` must be used within `TooltipProvider`" at render time when no
 * provider is an ancestor. Routed pages render outside DashboardLayout's
 * provider (its <Outlet/> is outside the provider subtree), so CodeVaultGraph
 * must supply its own local TooltipProvider. This test fails if that regresses.
 */

import { describe, it, vi, beforeEach, afterEach, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  makeProjectGraphFixture,
  mockGetProjectGraph,
} from "@/test/projectGraphFixture";

// Mock convex/react so useProjectGraph never hits a real backend
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

// Mock only the heavy canvas dep — NOT @/components/ui/tooltip (use real Radix)
vi.mock("@/components/graph/ForceGraphCanvas", () => ({
  ForceGraphCanvas: () => <div data-testid="force-graph-canvas" />,
}));

import { CodeVaultGraph } from "./CodeVaultGraph";

describe("CodeVaultGraph — TooltipProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the fullscreen toggle without a 'must be used within TooltipProvider' crash", () => {
    mockGetProjectGraph(makeProjectGraphFixture());

    // With the real Radix tooltip, a missing TooltipProvider ancestor throws
    // synchronously during render. A successful render proves the component
    // supplies its own provider.
    expect(() => render(<CodeVaultGraph />)).not.toThrow();

    // The toggle (which lives inside the Tooltip/TooltipTrigger) is present.
    expect(
      screen.getByRole("button", { name: "Expand graph" })
    ).toBeDefined();
  });
});
