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

  // ── Hours tier + the day boundary (code-review WR-01) ─────────────────────
  // The hours branch had NO positive coverage: the only hours-related
  // assertion was the negative `not.toMatch(/finished \d{3,}h ago/)` above,
  // and the 34-day fixture (h=816) sits outside the range a broken `h < 24`
  // threshold would corrupt. Mutating `h < 24` to `h < 240` left the whole
  // suite green while silently rendering every 1–9-day-old row as
  // "finished 120h ago". The 25-hour case below is what actually kills that
  // mutant — it is the first value that must cross into the day tier.

  it("renders 'finished 3h ago' for a row finished 3 hours ago", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j-hour", "completed", 3 * 3600),
    ]);

    render(<JobsPanel />);

    expect(screen.getByText("finished 3h ago")).toBeInTheDocument();
  });

  it("renders 'finished 23h ago' at the top of the hours tier", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j-hour-max", "completed", 23 * 3600),
    ]);

    render(<JobsPanel />);

    expect(screen.getByText("finished 23h ago")).toBeInTheDocument();
  });

  it("crosses into the day tier at 25 hours, rendering 'finished 1d ago' not 'finished 25h ago'", () => {
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j-day-boundary", "completed", 25 * 3600),
    ]);

    const { container } = render(<JobsPanel />);

    expect(screen.getByText("finished 1d ago")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/finished 25h ago/);
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
    // code-review WR-02: assert the ICON too, not just the badge. Without
    // this, re-adding a `running:`/`unknown:` entry to stateIcon in any
    // colour would leave every other assertion in this test green while
    // directly violating D-08.
    expect(
      container.querySelectorAll('svg.lucide-clock').length
    ).toBe(1);
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
    // code-review WR-02: the positive half — "running" must render the muted
    // Clock fallback, not merely fail to render a live-looking one.
    expect(
      container.querySelectorAll('svg.lucide-clock').length
    ).toBe(1);
  });

  it("does NOT render the muted Clock fallback for a mapped status (WR-02 control)", () => {
    // The control for the two assertions above: it proves the selector
    // discriminates. A mapped status renders its own icon (`completed` ->
    // CheckCircle, `text-primary/80`), so the fallback selector must find
    // NOTHING here. Without this, a selector that matched everything — or
    // nothing — would satisfy both tests above and prove neither.
    mockUseSubagentJobs.mockReturnValue([
      makeRow("j-mapped", "completed", 60),
    ]);

    const { container } = render(<JobsPanel />);

    expect(
      container.querySelectorAll('svg.lucide-clock').length
    ).toBe(0);
  });

  // ── WCAG 2.1.1 / axe `scrollable-region-focusable` (Phase 123 closeout) ────
  //
  // The mission list scrolls (`overflow-y-auto max-h-[280px]`), so it must be
  // reachable by keyboard or its overflowed rows are unavailable to anyone not
  // using a pointer.
  //
  // These assertions live HERE, at the unit level, deliberately. The e2e
  // criterion gate could not verify this reliably: axe's rule only fires once
  // the LIVE `useSubagentJobs()` subscription happens to return enough rows to
  // overflow, so the gate failed on roughly half of runs and passed on the
  // rest against IDENTICAL code — and when the live table was short, a
  // deliberately un-fixed build passed 20/20 too. A probe that returns the same
  // answer whether or not the defect is present proves nothing. The mock below
  // removes the live-data dependency entirely, so this guard is deterministic
  // and fires on the attributes axe actually checks.
  describe("mission list is keyboard-reachable", () => {
    function renderWithRows() {
      mockUseSubagentJobs.mockReturnValue([
        makeRow("j1", "completed", 300),
        makeRow("j2", "failed", 120),
        makeRow("j3", "cancelled", 60),
      ]);
      return render(<JobsPanel />);
    }

    it("exposes the scrollable region to keyboard users", () => {
      const { container } = renderWithRows();
      const region = container.querySelector<HTMLElement>(".overflow-y-auto");

      expect(region).not.toBeNull();
      expect(region).toHaveAttribute("tabindex", "0");
    });

    it("gives that region an accessible name via the existing heading, not a bare aria-label", () => {
      const { container } = renderWithRows();
      const region = container.querySelector<HTMLElement>(".overflow-y-auto");

      // role first: `aria-label`/`aria-labelledby` on a role-less div is what
      // raised `aria-prohibited-attr` on /forge (fixed in 123-06). Naming by
      // reference also avoids duplicating the heading's text.
      expect(region).toHaveAttribute("role", "region");
      const labelledBy = region?.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();

      const heading = container.querySelector(`#${labelledBy}`);
      expect(heading).not.toBeNull();
      expect(heading?.textContent?.trim()).toBe("MISSION HISTORY");
    });

    it("control — the empty state renders no scrollable region at all, so the assertions above are about the list and not the panel wrapper", () => {
      mockUseSubagentJobs.mockReturnValue([]);
      const { container } = render(<JobsPanel />);

      expect(container.querySelector(".overflow-y-auto")).toBeNull();
    });
  });
});
