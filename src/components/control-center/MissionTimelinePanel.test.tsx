import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { reminders: { listByProfile: "reminders:listByProfile" } },
}));

vi.mock("@/hooks/useRecentEvents", () => ({
  useRecentEvents: vi.fn(() => ({ events: [], status: "Exhausted", loadMore: () => {} })),
}));

import { useQuery } from "convex/react";
import { useRecentEvents } from "@/hooks/useRecentEvents";
import { MissionTimelinePanel } from "./MissionTimelinePanel";

const mockUseQuery = vi.mocked(useQuery);
const mockUseRecentEvents = vi.mocked(useRecentEvents);

describe("MissionTimelinePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([]);
    mockUseRecentEvents.mockReturnValue({
      events: [],
      status: "Exhausted",
      loadMore: () => {},
    });
  });

  it("renders markers time-sorted oldest to newest, left to right", () => {
    mockUseQuery.mockImplementation((..._args: unknown[]) => {
      const args = _args[1] as { profileId?: string } | undefined;
      if (args?.profileId === "personal") {
        return [{ _id: "r1", title: "Older reminder", notifiedAt: 1000 }];
      }
      return [];
    });
    mockUseRecentEvents.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events: [{ _id: "e1", eventType: "watch_pulse", timestamp: 2000 }] as any,
      status: "Exhausted",
      loadMore: () => {},
    });

    render(<MissionTimelinePanel />);

    const markers = screen.getAllByTestId("timeline-marker");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveTextContent("Older reminder");
    expect(markers[1]).toHaveTextContent("watch_pulse");
  });

  it("caps the rendered markers at the explicit MAX_MARKERS bound, keeping the most recent", () => {
    const manyEvents = Array.from({ length: 60 }, (_, i) => ({
      _id: `e${i}`,
      eventType: `event-${i}`,
      timestamp: i,
    }));
    mockUseRecentEvents.mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events: manyEvents as any,
      status: "Exhausted",
      loadMore: () => {},
    });

    render(<MissionTimelinePanel />);

    const markers = screen.getAllByTestId("timeline-marker");
    expect(markers).toHaveLength(40);
    expect(screen.getByText("event-59")).toBeInTheDocument();
    expect(screen.queryByText("event-0")).not.toBeInTheDocument();
    expect(screen.queryByText("event-19")).not.toBeInTheDocument();
    expect(screen.getByText("event-20")).toBeInTheDocument();
  });

  it('renders "No mission activity yet." when there are no reminders or events', () => {
    render(<MissionTimelinePanel />);

    expect(screen.getByText("No mission activity yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline-marker")).not.toBeInTheDocument();
  });

  it("renders the chrome and empty state, not a crash, while queries are still loading (undefined)", () => {
    mockUseQuery.mockReturnValue(undefined);

    render(<MissionTimelinePanel />);

    expect(screen.getByText("MISSION TIMELINE")).toBeInTheDocument();
    expect(screen.getByText("No mission activity yet.")).toBeInTheDocument();
  });
});
