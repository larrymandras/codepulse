/**
 * KanbanCard tests — TDD for Phase 04 Plan 02 Task 2.
 * Tests priority stripe, labels, due date, time-in-column, finding badge, drag opacity.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { KanbanCard } from "../KanbanCard";
import type { KanbanTask } from "../../types/kanban";

// Mock @dnd-kit/sortable
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

// Mock @dnd-kit/utilities
vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: { toString: () => "" },
  },
}));

// Mock formatRelativeTime if imported
vi.mock("../../lib/time", () => ({
  formatRelativeTime: () => "2h ago",
}));

const NOW_EPOCH = 1776121000;

const baseTask: KanbanTask = {
  id: "task-1",
  title: "Fix the critical bug in auth module",
  priority: "high",
  column: "backlog",
  columnEnteredAt: NOW_EPOCH - 3600 * 25, // 25 hours ago => 1d 1h
  createdAt: NOW_EPOCH - 7200,
};

describe("KanbanCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_EPOCH * 1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders title with line-clamp-2 and font-medium", () => {
    const { container } = render(<KanbanCard task={baseTask} isDragging={false} />);
    const title = container.querySelector(".line-clamp-2");
    expect(title).toBeTruthy();
    expect(title?.className).toContain("font-medium");
    expect(title?.textContent).toBe("Fix the critical bug in auth module");
  });

  it("renders border-l-2 with --status-error color for high priority", () => {
    const { container } = render(<KanbanCard task={{ ...baseTask, priority: "high" }} isDragging={false} />);
    const card = container.firstChild as HTMLElement;
    // Find the element with border-l-2
    const el = container.querySelector(".border-l-2");
    expect(el).toBeTruthy();
    // Check that the class contains the error border
    expect(el?.className).toContain("border-l-2");
    // Check inline style or class references --status-error
    const html = container.innerHTML;
    expect(html).toContain("status-error");
  });

  it("renders border-l-2 with --status-warn color for medium priority", () => {
    const { container } = render(
      <KanbanCard task={{ ...baseTask, priority: "medium" }} isDragging={false} />
    );
    const el = container.querySelector(".border-l-2");
    expect(el).toBeTruthy();
    const html = container.innerHTML;
    expect(html).toContain("status-warn");
  });

  it("renders border-l-2 with --status-ok color for low priority", () => {
    const { container } = render(
      <KanbanCard task={{ ...baseTask, priority: "low" }} isDragging={false} />
    );
    const el = container.querySelector(".border-l-2");
    expect(el).toBeTruthy();
    const html = container.innerHTML;
    expect(html).toContain("status-ok");
  });

  it("renders label chips as text-xs elements when labels array is non-empty", () => {
    const task: KanbanTask = {
      ...baseTask,
      labels: ["urgent", "backend"],
    };
    const { container } = render(<KanbanCard task={task} isDragging={false} />);
    const chips = container.querySelectorAll(".text-\\[10px\\]");
    // At least the label chips should be present
    const labelsEl = Array.from(chips).filter(
      (el) => el.textContent === "urgent" || el.textContent === "backend"
    );
    expect(labelsEl.length).toBe(2);
  });

  it("renders due date when dueAt is set", () => {
    const dueAt = NOW_EPOCH + 86400; // tomorrow
    const task: KanbanTask = { ...baseTask, dueAt };
    render(<KanbanCard task={task} isDragging={false} />);
    // Should render a date string — check for month abbreviation pattern
    const dueText = screen.getByText(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    expect(dueText).toBeInTheDocument();
  });

  it("calculates and renders time-in-column in Xd Xh format from columnEnteredAt", () => {
    // columnEnteredAt is 25 hours ago => 1d 1h
    render(<KanbanCard task={baseTask} isDragging={false} />);
    expect(screen.getByText("1d 1h")).toBeInTheDocument();
  });

  it("renders linked finding badge when findingId is present", () => {
    const task: KanbanTask = { ...baseTask, findingId: "find-abc" };
    render(<KanbanCard task={task} isDragging={false} />);
    expect(screen.getByText("Finding")).toBeInTheDocument();
  });

  it("applies opacity-40 class when isDragging prop is true", () => {
    const { container } = render(<KanbanCard task={baseTask} isDragging={true} />);
    const card = container.querySelector(".opacity-40");
    expect(card).toBeTruthy();
  });

  it("renders agent avatar circle with first character initial when agentName set", () => {
    const task: KanbanTask = { ...baseTask, agentName: "Ástríðr" };
    render(<KanbanCard task={task} isDragging={false} />);
    // Avatar shows first char uppercase
    expect(screen.getByText("Á")).toBeInTheDocument();
  });
});
