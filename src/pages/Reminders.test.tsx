import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockComplete = vi.fn().mockResolvedValue(undefined);
const mockSnooze = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockResolvedValue(undefined);
const mockCreate = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (ref: unknown) => {
    // Distinguish which mutation is being requested via the mock-fn-ref path
    // baked into the api proxy below (e.g. "reminders.complete").
    const path = String(ref);
    if (path.includes("complete")) return mockComplete;
    if (path.includes("snooze")) return mockSnooze;
    if (path.includes("update")) return mockUpdate;
    if (path.includes("create")) return mockCreate;
    return vi.fn().mockResolvedValue(undefined);
  },
}));

// Build a Proxy so `api.reminders.listByProfile` etc. resolve to a stable,
// path-describing string ref (used above to route useMutation) while also
// being usable as a useQuery arg (identity doesn't matter — only distinctness).
function makeApiProxy(path: string[] = []): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "toString" || prop === Symbol.toPrimitive) {
          return () => path.join(".");
        }
        if (typeof prop === "symbol") return undefined;
        return makeApiProxy([...path, prop]);
      },
    }
  );
}

vi.mock("../../convex/_generated/api", () => ({
  api: makeApiProxy(["api"]),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// Import after mocks
import Reminders from "./Reminders";

// ─── Fixtures ───────────────────────────────────────────────────────────────

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

function makeReminder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "rem-1",
    profileId: "personal",
    title: "Water the plants",
    status: "open",
    priority: "med",
    source: "dashboard",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: "evt-1",
    profileId: "personal",
    calendarAccount: "mandrasle@gmail.com",
    googleEventId: "g-1",
    title: "Team sync",
    start: NOW + 3600,
    end: NOW + 7200,
    allDay: false,
    fetchedAt: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockComplete.mockResolvedValue(undefined);
  mockSnooze.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue(undefined);
  window.localStorage.clear();
});

// ─── Task 2: profile-segmented shell + reminder list ───────────────────────

describe("Reminders — profile segmentation (UI-01)", () => {
  test("selecting Business re-queries listByProfile with profileId 'business'", () => {
    mockUseQuery.mockImplementation(() => []);
    render(<Reminders />);

    fireEvent.click(screen.getByRole("tab", { name: "Business" }));

    const remindersCalls = mockUseQuery.mock.calls.filter(
      (call) => call[1] && (call[1] as { profileId?: string }).profileId !== undefined
    );
    expect(
      remindersCalls.some((call) => (call[1] as { profileId: string }).profileId === "business")
    ).toBe(true);
  });

  // NOTE: the profile-swap-both-panes test (list AND calendar overlay
  // together) lives in the "Calendar overlay" describe block below —
  // written alongside CalendarOverlay itself (Task 3).
});

describe("Reminders — quick actions (UI-02)", () => {
  test("complete triggers api.reminders.complete and the row moves to Done optimistically", async () => {
    mockUseQuery.mockImplementation(() => [
      makeReminder({ _id: "rem-1", title: "Finish report", dueAt: NOW + DAY }),
    ]);
    render(<Reminders />);

    const upcomingSection = screen.getByRole("region", { name: "Upcoming" });
    const completeBtn = within(upcomingSection).getByRole("button", { name: /complete finish report/i });
    fireEvent.click(completeBtn);

    expect(mockComplete).toHaveBeenCalledWith({ id: "rem-1" });

    // Optimistic: the row leaves the open Upcoming group immediately (no
    // await needed — the override is applied synchronously in state)...
    expect(within(upcomingSection).queryByText("Finish report")).not.toBeInTheDocument();

    // ...and lands in the (collapsed-by-default) Done group, marked complete.
    fireEvent.click(screen.getByText("Done"));
    expect(
      screen.getByRole("button", { name: /finish report completed/i })
    ).toBeInTheDocument();
  });

  test("an overdue reminder renders overdue styling and is in the Overdue group", () => {
    mockUseQuery.mockImplementation(() => [
      makeReminder({ _id: "rem-overdue", title: "Pay invoice", dueAt: NOW - 3 * DAY }),
    ]);
    render(<Reminders />);

    const overdueSection = screen.getByRole("region", { name: "Overdue" });
    const row = within(overdueSection).getByText("Pay invoice").closest('[data-testid="reminder-row"]');
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("data-overdue", "true");
    expect(within(overdueSection).getByText(/3d overdue/)).toBeInTheDocument();
  });
});

describe("Reminders — quick-add", () => {
  test("submitting the quick-add bar calls create with the selected profile and source dashboard", () => {
    mockUseQuery.mockImplementation(() => []);
    render(<Reminders />);

    fireEvent.change(screen.getByLabelText("Reminder title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Buy milk", profileId: "personal", source: "dashboard" })
    );
  });
});

// ─── Injection guard (T-101-03) ─────────────────────────────────────────────

describe("Reminders — injection guard (T-101-03)", () => {
  test("reminder title with markup-like text renders as plain text, not HTML", () => {
    mockUseQuery.mockImplementation(() => [
      makeReminder({
        _id: "rem-html",
        title: "<img src=x onerror=alert(1)>",
        dueAt: NOW + DAY,
      }),
    ]);
    const { container } = render(<Reminders />);

    // The literal string renders as text content (in the row AND its
    // calendar chip) — never as an actual injected <img> element.
    expect(screen.getAllByText("<img src=x onerror=alert(1)>").length).toBeGreaterThan(0);
    expect(container.querySelector("img")).toBeNull();
  });

  test("no dangerouslySetInnerHTML anywhere in the reminders component tree source", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../components/reminders");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    for (const file of files) {
      const contents = fs.readFileSync(path.join(dir, file), "utf-8");
      expect(contents).not.toMatch(/dangerouslySetInnerHTML/);
    }
    const pageSrc = fs.readFileSync(path.resolve(__dirname, "./Reminders.tsx"), "utf-8");
    expect(pageSrc).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
