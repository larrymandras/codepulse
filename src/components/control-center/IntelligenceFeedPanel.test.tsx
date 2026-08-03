import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { inbox: { listAll: "inbox:listAll" } },
}));

import { useQuery } from "convex/react";
import { IntelligenceFeedPanel } from "./IntelligenceFeedPanel";

const mockUseQuery = vi.mocked(useQuery);

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: "row-1",
    profileId: "personal",
    priority: "normal",
    title: "Something happened",
    body: "Details here",
    createdAt: Date.now() / 1000 - 30,
    itemType: "notification",
    ...overrides,
  };
}

describe("IntelligenceFeedPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders rows from api.inbox.listAll, newest first", () => {
    mockUseQuery.mockReturnValue([
      makeRow({ _id: "r1", title: "Older", createdAt: 1000 }),
      makeRow({ _id: "r2", title: "Newer", createdAt: 2000 }),
    ]);

    render(<IntelligenceFeedPanel />);

    const rows = screen.getAllByTestId("feed-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Newer");
    expect(rows[1]).toHaveTextContent("Older");
  });

  it("applies the money/high stripe to money- and high-priority rows only", () => {
    mockUseQuery.mockReturnValue([
      makeRow({ _id: "r1", title: "Money item", priority: "money" }),
      makeRow({ _id: "r2", title: "High item", priority: "high" }),
      makeRow({ _id: "r3", title: "Normal item", priority: "normal" }),
    ]);

    render(<IntelligenceFeedPanel />);

    const rows = screen.getAllByTestId("feed-row");
    expect(rows[0].className).toContain("border-l-(--status-error)");
    expect(rows[1].className).toContain("border-l-(--status-error)");
    expect(rows[2].className).not.toContain("border-l-(--status-error)");
  });

  it('renders "Nothing needs you right now." when there are no items', () => {
    mockUseQuery.mockReturnValue([]);

    render(<IntelligenceFeedPanel />);

    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-row")).not.toBeInTheDocument();
  });

  it("renders the chrome and empty state, not a crash, when the query is still loading (undefined)", () => {
    mockUseQuery.mockReturnValue(undefined);

    render(<IntelligenceFeedPanel />);

    expect(screen.getByText("INTELLIGENCE FEED")).toBeInTheDocument();
    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
  });
});
