import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useSubagentJobs", () => ({
  useSubagentJobs: vi.fn(() => []),
}));

import { useSubagentJobs } from "@/hooks/useSubagentJobs";
import { ActiveAgentsPanel } from "./ActiveAgentsPanel";

const mockUseSubagentJobs = vi.mocked(useSubagentJobs);

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "job-1",
    agentTypeId: "researcher",
    status: "running",
    taskSnippet: "Digging through the archive",
    submittedAt: Date.now() / 1000,
    ...overrides,
  };
}

describe("ActiveAgentsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one tile per running sub-agent job", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeJob({ jobId: "j1", agentTypeId: "researcher" }),
      makeJob({ jobId: "j2", agentTypeId: "writer" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    render(<ActiveAgentsPanel />);

    const tiles = screen.getAllByTestId("agent-tile");
    expect(tiles).toHaveLength(2);
    expect(screen.getByText("researcher")).toBeInTheDocument();
    expect(screen.getByText("writer")).toBeInTheDocument();
  });

  it("excludes non-running jobs from the tile row", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeJob({ jobId: "j1", agentTypeId: "researcher", status: "completed" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    render(<ActiveAgentsPanel />);

    expect(screen.queryByTestId("agent-tile")).not.toBeInTheDocument();
    expect(screen.getByText("No agents running.")).toBeInTheDocument();
  });

  it('renders "No agents running." when there are no jobs', () => {
    mockUseSubagentJobs.mockReturnValue([]);

    render(<ActiveAgentsPanel />);

    expect(screen.getByText("No agents running.")).toBeInTheDocument();
  });

  it("renders the chrome safely from the hook's always-array (never undefined) default", () => {
    mockUseSubagentJobs.mockReturnValue([]);

    render(<ActiveAgentsPanel />);

    expect(screen.getByText("ACTIVE AGENTS")).toBeInTheDocument();
    expect(screen.getByText("No agents running.")).toBeInTheDocument();
  });
});
