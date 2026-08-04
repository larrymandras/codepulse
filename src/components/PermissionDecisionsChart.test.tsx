import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

function renderChart() {
  return render(
    <MemoryRouter>
      <PermissionDecisionsChart />
    </MemoryRouter>
  );
}

describe("PermissionDecisionsChart (Phase 105 D-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes excludeProvider: 'astridr' to toolExecutions.recentExecutions", () => {
    mockUseQuery.mockReturnValue([]);

    renderChart();

    expect(mockUseQuery).toHaveBeenCalledWith(
      "toolExecutions:recentExecutions",
      { excludeProvider: "astridr" }
    );
  });

  it("renders the empty state when there is no decision data", () => {
    mockUseQuery.mockReturnValue([]);

    renderChart();

    expect(screen.getByText("No permission decision data yet")).toBeInTheDocument();
  });

  it("renders decision totals from the (already excludeProvider-filtered) executions returned by the query", () => {
    mockUseQuery.mockReturnValue([
      { toolName: "Bash", success: true, decision: "accept", decisionSource: "user", timestamp: 1 },
      { toolName: "Edit", success: false, decision: "reject", decisionSource: "policy", timestamp: 2 },
    ]);

    renderChart();

    expect(screen.getByText(/2 total decisions/)).toBeInTheDocument();
  });

  it("renders a 'View in Tools ->' link pointing at /tools when decisions are present (Phase 105-08)", () => {
    mockUseQuery.mockReturnValue([
      { toolName: "Bash", success: true, decision: "accept", decisionSource: "user", timestamp: 1 },
    ]);

    renderChart();

    const link = screen.getByRole("link", { name: /View in Tools/ });
    expect(link).toHaveAttribute("href", "/tools");
  });
});
