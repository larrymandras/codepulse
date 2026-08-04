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
      successRate: "toolExecutions:successRate",
    },
  },
}));

import { useQuery } from "convex/react";
import ToolExecutionPanel from "./ToolExecutionPanel";

const mockUseQuery = vi.mocked(useQuery);

// D-15 — this file exists purely to assert the "View in Tools ->" cross-link
// added by 105-08 (ToolExecutionPanel had no prior test file — grep-confirmed
// before this plan). This suite does not re-test the panel's own filtering
// or chart logic, out of this plan's scope.
function renderPanel() {
  return render(
    <MemoryRouter>
      <ToolExecutionPanel />
    </MemoryRouter>
  );
}

describe("ToolExecutionPanel (Phase 105 D-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a 'View in Tools ->' link pointing at /tools when executions are present", () => {
    mockUseQuery.mockImplementation(((query: unknown) => {
      if (query === "toolExecutions:recentExecutions") {
        return [
          {
            _id: "e1",
            toolName: "Bash",
            success: true,
            durationMs: 12,
            timestamp: Date.now() / 1000,
          },
        ];
      }
      if (query === "toolExecutions:successRate") {
        return { tools: [{ toolName: "Bash", success: 1 }] };
      }
      return undefined;
    }) as typeof useQuery);

    renderPanel();

    const link = screen.getByRole("link", { name: /View in Tools/ });
    expect(link).toHaveAttribute("href", "/tools");
  });

  it("renders the awaiting-telemetry empty state when there are no executions", () => {
    mockUseQuery.mockReturnValue(undefined);

    renderPanel();

    expect(screen.getByText("Awaiting Telemetry")).toBeInTheDocument();
  });
});
