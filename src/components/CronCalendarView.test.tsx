import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUseDailyRhythm = vi.fn(() => [] as any[]);

vi.mock("../hooks/useDailyRhythm", () => ({
  useDailyRhythm: () => mockUseDailyRhythm(),
}));

const mockCronSchedules: any[] = [];

vi.mock("../lib/cronSchedules", () => ({
  get CRON_SCHEDULES() {
    return mockCronSchedules;
  },
  estimateNextRun: () => Math.floor(Date.now() / 1000) + 3600,
}));

import CronCalendarView from "./CronCalendarView";

function withRhythmEntry() {
  mockUseDailyRhythm.mockReturnValue([
    {
      agentTypeId: "astridr",
      action: "morning briefing",
      channel: "telegram",
      days: "mon-sun",
      time: "09:00",
      syncedAt: Date.now(),
    },
  ]);
}

describe("CronCalendarView", () => {
  beforeEach(() => {
    mockUseDailyRhythm.mockReturnValue([]);
    mockCronSchedules.length = 0;
  });

  it("renders the 'Cron Calendar -- 7 Days' heading text", () => {
    render(<CronCalendarView />);
    expect(screen.getByText("Cron Calendar -- 7 Days")).toBeInTheDocument();
  });

  it("renders day column headers", () => {
    withRhythmEntry();
    render(<CronCalendarView />);
    expect(screen.getByText(/Mon/)).toBeInTheDocument();
    expect(screen.getByText(/Tue/)).toBeInTheDocument();
    expect(screen.getByText(/Wed/)).toBeInTheDocument();
    expect(screen.getByText(/Thu/)).toBeInTheDocument();
    expect(screen.getByText(/Fri/)).toBeInTheDocument();
    expect(screen.getByText(/Sat/)).toBeInTheDocument();
    expect(screen.getByText(/Sun/)).toBeInTheDocument();
  });

  it("shows 'System crons' toggle checkbox", () => {
    render(<CronCalendarView />);
    expect(screen.getByText("System crons")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("toggle checkbox is checked by default", () => {
    render(<CronCalendarView />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("shows 'No scheduled tasks' when no rhythm entries and no cron schedules", () => {
    render(<CronCalendarView />);
    expect(screen.getByText("No scheduled tasks")).toBeInTheDocument();
  });

  it("(D-07) slot click shows detail panel with full action text", () => {
    withRhythmEntry();

    const { container } = render(<CronCalendarView />);

    // Find the slot cell that contains the entry (hour 9, all days)
    // The entry is at hour 9, dayIndex 0 (Monday)
    const slotCell = container.querySelector('[data-slot="0-9"]');
    expect(slotCell).toBeTruthy();
    fireEvent.click(slotCell!);

    // Slot detail should appear
    const detail = screen.getByTestId("slot-detail");
    expect(detail).toBeInTheDocument();
    expect(screen.getByText("morning briefing")).toBeInTheDocument();
  });

  it("(D-12) renders calendar from stored Convex data without live connection", () => {
    mockUseDailyRhythm.mockReturnValue([
      {
        agentTypeId: "astridr",
        action: "health check",
        channel: "telegram",
        days: "mon-sun",
        time: "06:00",
        syncedAt: Date.now(),
      },
      {
        agentTypeId: "astridr",
        action: "PR digest",
        channel: "telegram",
        days: "mon-fri",
        time: "17:00",
        syncedAt: Date.now(),
      },
    ]);

    render(<CronCalendarView />);

    // Both entries should appear as badges in the grid
    expect(screen.getAllByText(/health/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PR dige/i).length).toBeGreaterThan(0);
  });
});
