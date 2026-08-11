import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── useSubagentJobs mock ─────────────────────────────────────────────────────
// JobsPanel.tsx imports from the relative specifier "../hooks/useSubagentJobs"
// — mock that exact specifier, not convex/react. JobsPanel needs no provider
// wrapper once the hook is mocked: it composes only EntityRow, StatusBadge,
// and Badge, all provider-free.
vi.mock("../hooks/useSubagentJobs", () => ({
  useSubagentJobs: vi.fn(() => []),
}));

import { useSubagentJobs, type SubagentJobRow } from "../hooks/useSubagentJobs";
import JobsPanel from "./JobsPanel";

const mockUseSubagentJobs = vi.mocked(useSubagentJobs);

function makeRow(
  jobId: string,
  status: SubagentJobRow["status"],
  finishedAgoSeconds: number
): SubagentJobRow {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    jobId,
    agentTypeId: "agent-1",
    status,
    taskSnippet: `Do task ${jobId}`,
    submittedAt: nowSeconds - finishedAgoSeconds - 5,
    finishedAt: nowSeconds - finishedAgoSeconds,
  };
}

describe("JobsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders MISSION HISTORY header and no animate-pulse element", () => {
    mockUseSubagentJobs.mockReturnValue([]);

    const { container } = render(<JobsPanel />);

    expect(screen.getByText("MISSION HISTORY")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBe(0);
  });

  it('renders "{n} missions" badge with correct count', () => {
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j1", "completed", 300),
      makeRow("j2", "failed", 10),
    ]);

    render(<JobsPanel />);

    expect(screen.getByText("2 missions")).toBeInTheDocument();
  });

  it("renders empty-state heading and body when there are no rows", () => {
    mockUseSubagentJobs.mockReturnValue([]);

    render(<JobsPanel />);

    expect(screen.getByText("No mission history")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Background missions run via delegate_task(background=True) will appear here once they finish."
      )
    ).toBeInTheDocument();
  });

  // ── Day tier + epoch-seconds guard (D-09) ──────────────────────────────────
  // subagentJobs timestamps are Unix epoch SECONDS. Without the
  // `ref < 1e12 ? ref * 1000 : ref` guard, a 34-day-old row would render a
  // ~56-year age instead of "finished 34d ago".

  it("renders 'finished 34d ago' for a row finished 34 days ago, with no bogus hours value", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j-day", "completed", 34 * 86400),
    ]);

    const { container } = render(<JobsPanel />);

    expect(screen.getByText("finished 34d ago")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/finished \d{3,}h ago/);
  });

  it("renders 'finished 5m ago' for a row finished 300s ago (epoch guard control)", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j-min", "completed", 300),
    ]);

    render(<JobsPanel />);

    expect(screen.getByText("finished 5m ago")).toBeInTheDocument();
  });

  it("renders 'finished moments ago' for a row finished 10s ago", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j-sec", "completed", 10),
    ]);

    render(<JobsPanel />);

    expect(screen.getByText("finished moments ago")).toBeInTheDocument();
  });

  // ── Unmapped-status fallback (MISSION-03: absent, not fabricated) ──────────

  it("renders an UNKNOWN badge with the muted idle class for an unmapped status, and no animate-pulse", () => {
    // convex/subagentJobs.ts:28 declares status: v.string(), and
    // convex/runtimeIngest.ts:615 writes `d.status ?? "unknown"` — the
    // runtime value set is genuinely wider than the SubagentJobStatus union.
    // This cast is honest, not a widening of the read-only hook's type.
    const row = {
      ...makeRow("j-unknown", "completed", 60),
      status: "unknown",
    } as unknown as SubagentJobRow;
    mockUseSubagentJobs.mockReturnValue([row]);

    const { container } = render(<JobsPanel />);

    const badge = screen.getByText("UNKNOWN");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-muted");
    expect(container.querySelectorAll(".animate-pulse").length).toBe(0);
  });

  it("renders no animate-pulse element for a 'running' status row (removed affordance)", () => {
    // "running" is no longer a stateIcon key (D-08) — it must fall through
    // to the same muted Clock default as any other unmapped status, with no
    // colored/live-looking substitute.
    const row = {
      ...makeRow("j-running", "completed", 60),
      status: "running",
    } as unknown as SubagentJobRow;
    mockUseSubagentJobs.mockReturnValue([row]);

    const { container } = render(<JobsPanel />);

    expect(container.querySelectorAll(".animate-pulse").length).toBe(0);
    expect(container.querySelectorAll(".text-\\(--status-ok\\)").length).toBe(0);
  });
});
