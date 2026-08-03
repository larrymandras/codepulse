import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Convex mocks (must precede the component import) ────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    toolExecutions: {
      recentExecutions: "toolExecutions:recentExecutions",
    },
  },
}));

import { useQuery } from "convex/react";
import PermissionDecisionsChart from "./PermissionDecisionsChart";

const mockUseQuery = vi.mocked(useQuery);

describe("PermissionDecisionsChart (Phase 105 D-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes excludeProvider: 'astridr' to toolExecutions.recentExecutions", () => {
    mockUseQuery.mockReturnValue([]);

    render(<PermissionDecisionsChart />);

    expect(mockUseQuery).toHaveBeenCalledWith(
      "toolExecutions:recentExecutions",
      { excludeProvider: "astridr" }
    );
  });

  it("renders the empty state when there is no decision data", () => {
    mockUseQuery.mockReturnValue([]);

    render(<PermissionDecisionsChart />);

    expect(screen.getByText("No permission decision data yet")).toBeInTheDocument();
  });

  it("renders decision totals from the (already excludeProvider-filtered) executions returned by the query", () => {
    mockUseQuery.mockReturnValue([
      { toolName: "Bash", success: true, decision: "accept", decisionSource: "user", timestamp: 1 },
      { toolName: "Edit", success: false, decision: "reject", decisionSource: "policy", timestamp: 2 },
    ]);

    render(<PermissionDecisionsChart />);

    expect(screen.getByText(/2 total decisions/)).toBeInTheDocument();
  });
});
