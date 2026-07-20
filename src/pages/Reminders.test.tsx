import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { format } from "date-fns";

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

// ─── Task 3: read-only calendar overlay + reminder chips (CAL-02) ─────────

describe("Reminders — calendar overlay (CAL-02)", () => {
  test("switching profile swaps both the reminder list and the calendar overlay", () => {
    mockUseQuery.mockImplementation((ref: { toString(): string }, args?: { profileId?: string }) => {
      const path = ref.toString();
      if (path.includes("calendarEvents")) {
        return args?.profileId === "consulting"
          ? [makeEvent({ _id: "consulting-evt", title: "Consulting-only event" })]
          : [makeEvent({ _id: "personal-evt", title: "Personal-only event" })];
      }
      // reminders.listByProfile
      return args?.profileId === "consulting"
        ? [makeReminder({ _id: "consulting-rem", title: "Consulting-only reminder", dueAt: NOW + DAY })]
        : [makeReminder({ _id: "personal-rem", title: "Personal-only reminder", dueAt: NOW + DAY })];
    });

    render(<Reminders />);

    expect(screen.getAllByText("Personal-only reminder").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Personal-only event").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Consulting" }));

    expect(screen.queryByText("Personal-only reminder")).not.toBeInTheDocument();
    expect(screen.queryByText("Personal-only event")).not.toBeInTheDocument();
    expect(screen.getAllByText("Consulting-only reminder").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Consulting-only event").length).toBeGreaterThan(0);
  });

  test("a day with more items than fit never silently drops one — overflow is always accounted for", () => {
    // Regression: chips were sliced per-list (2 events + 2 reminders) but the
    // "+N more" indicator was gated on a COMBINED `> 4`. With 3 events and no
    // reminders, only 2 rendered, 3 > 4 was false, and the third vanished with
    // no indicator at all. Every item must be either rendered or counted.
    const EVENT_COUNT = 7;
    mockUseQuery.mockImplementation((ref: { toString(): string }) => {
      const path = ref.toString();
      if (path.includes("calendarEvents")) {
        return Array.from({ length: EVENT_COUNT }, (_, i) =>
          makeEvent({ _id: `evt-${i}`, title: `Event ${i}`, start: NOW + DAY })
        );
      }
      return [];
    });

    const { container } = render(<Reminders />);

    const eventChips = container.querySelectorAll('[data-testid="calendar-event-chip"]');
    const overflow = Array.from(container.querySelectorAll("span")).find((el) =>
      /^\+\d+ more$/.test(el.textContent ?? "")
    );

    expect(eventChips.length).toBeGreaterThan(0);
    expect(eventChips.length).toBeLessThan(EVENT_COUNT);
    expect(overflow).toBeDefined();

    const hidden = Number((overflow!.textContent ?? "").match(/\+(\d+) more/)![1]);
    // Rendered + hidden must equal the truth. This is what the old code broke.
    expect(eventChips.length + hidden).toBe(EVENT_COUNT);
  });

  test("clicking a day that holds only a calendar event shows that event, not a blank pane", async () => {
    // The list renders reminders only, so selecting a day whose sole content is
    // a Google event used to filter everything away and leave an empty pane with
    // no explanation — it read as a broken click.
    mockUseQuery.mockImplementation((ref: { toString(): string }) => {
      const path = ref.toString();
      if (path.includes("calendarEvents")) {
        return [makeEvent({ _id: "evt-only", title: "LM Dermatologist", start: NOW + DAY })];
      }
      return []; // no reminders anywhere
    });

    const { container } = render(<Reminders />);

    // Select the day the event falls on, via its calendar cell.
    const chip = container.querySelector('[data-testid="calendar-event-chip"]');
    expect(chip).toBeTruthy();
    const cell = chip!.closest("[aria-pressed]") as HTMLElement;
    expect(cell).toBeTruthy();
    fireEvent.click(cell);

    // The event must now be visible in the left pane.
    const dayEvents = await screen.findAllByTestId("day-calendar-event");
    expect(dayEvents.length).toBe(1);
    expect(dayEvents[0].textContent).toContain("LM Dermatologist");
  });

  test("on an overloaded day the reminder is never the thing that gets hidden", () => {
    // Reminders are the only actionable item on this page; Google events are
    // read-only context. Events used to claim chip slots first, so a day with
    // enough meetings buried the reminder inside "+N more".
    mockUseQuery.mockImplementation((ref: { toString(): string }) => {
      const path = ref.toString();
      if (path.includes("calendarEvents")) {
        return Array.from({ length: 8 }, (_, i) =>
          makeEvent({ _id: `evt-${i}`, title: `Meeting ${i}`, start: NOW + DAY })
        );
      }
      return [makeReminder({ _id: "rem-buried", title: "Pay the tax bill", dueAt: NOW + DAY })];
    });

    const { container } = render(<Reminders />);

    const reminderChips = Array.from(
      container.querySelectorAll('[data-testid="calendar-reminder-chip"]')
    );
    expect(reminderChips.some((el) => el.textContent === "Pay the tax bill")).toBe(true);

    // And it must not be visually buried below the events either.
    const cell = container.querySelector('[data-testid="calendar-reminder-chip"]')?.parentElement;
    const firstChip = cell?.querySelector("[data-testid]");
    expect(firstChip?.getAttribute("data-testid")).toBe("calendar-reminder-chip");
  });

  test("a due-dated reminder renders a distinct chip on its day, and a Google event renders as a distinct outline event", () => {
    mockUseQuery.mockImplementation((ref: { toString(): string }) => {
      const path = ref.toString();
      if (path.includes("calendarEvents")) {
        return [makeEvent({ _id: "evt-tomorrow", title: "Board sync", start: NOW + DAY })];
      }
      return [makeReminder({ _id: "rem-tomorrow", title: "Renew passport", dueAt: NOW + DAY })];
    });

    const { container } = render(<Reminders />);

    const reminderChips = container.querySelectorAll('[data-testid="calendar-reminder-chip"]');
    const eventChips = container.querySelectorAll('[data-testid="calendar-event-chip"]');
    expect(reminderChips.length).toBeGreaterThan(0);
    expect(eventChips.length).toBeGreaterThan(0);

    expect(Array.from(reminderChips).some((el) => el.textContent === "Renew passport")).toBe(true);
    expect(Array.from(eventChips).some((el) => el.textContent === "Board sync")).toBe(true);

    // Visually distinct: reminder chips carry a solid priority background,
    // event chips are outline-only (no backgroundColor style).
    const reminderChip = Array.from(reminderChips).find((el) => el.textContent === "Renew passport");
    const eventChip = Array.from(eventChips).find((el) => el.textContent === "Board sync");
    expect((reminderChip as HTMLElement).style.backgroundColor).not.toBe("");
    expect((eventChip as HTMLElement).style.backgroundColor).toBe("");
  });

  test("an all-day event lands on its own calendar date, not the previous local day (WR-05)", async () => {
    // All-day events are cached as UTC midnight of their calendar date
    // (calendar_cache.py). Local-midnight bucketing put them one day EARLY in
    // any negative-UTC-offset timezone (July 21 00:00 UTC = July 20 evening
    // US Central) — they must bucket by their UTC calendar date instead.
    const today = new Date();
    const allDayStart =
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 1000;
    mockUseQuery.mockImplementation((ref: { toString(): string }) => {
      const path = ref.toString();
      if (path.includes("calendarEvents")) {
        return [
          makeEvent({
            _id: "evt-allday",
            title: "Company Holiday",
            start: allDayStart,
            end: allDayStart + DAY,
            allDay: true,
          }),
        ];
      }
      return [];
    });

    render(<Reminders />);

    // The chip must sit in TODAY's cell (its calendar date), never yesterday's.
    const cell = screen.getByRole("button", {
      name: format(
        new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        "PPPP"
      ),
    });
    const chip = within(cell).getByTestId("calendar-event-chip");
    expect(chip.textContent).toBe("Company Holiday");

    // And clicking its real day must show it in the left pane, marked All day.
    fireEvent.click(cell);
    const dayEvents = await screen.findAllByTestId("day-calendar-event");
    expect(dayEvents).toHaveLength(1);
    expect(dayEvents[0].textContent).toContain("Company Holiday");
    expect(dayEvents[0].textContent).toContain("All day");
  });

  test("no Google-write handler or calendarEvents mutation import exists in CalendarOverlay (D-02)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../components/reminders/CalendarOverlay.tsx"),
      "utf-8"
    );
    expect(src).not.toMatch(/upsertBatch|calendarIngest|useMutation/);
  });

  test("the two-pane grid is single-column by default and only expands at the lg breakpoint (responsive collapse)", () => {
    mockUseQuery.mockImplementation(() => []);
    const { container } = render(<Reminders />);

    const grid = container.querySelector(".grid.grid-cols-1");
    expect(grid).not.toBeNull();
    expect(grid?.className).toMatch(/lg:grid-cols-/);
  });

  test("an undated reminder stays visible when a calendar day is selected (regression: UAT test 8)", () => {
    mockUseQuery.mockImplementation((ref: { toString(): string }) => {
      const path = ref.toString();
      if (path.includes("calendarEvents")) {
        return [makeEvent({ _id: "evt-day", title: "Dentist", start: NOW + DAY })];
      }
      // reminders.listByProfile — no dueAt at all.
      return [makeReminder({ _id: "rem-undated", title: "Call the accountant" })];
    });

    const { container } = render(<Reminders />);

    const upcomingSection = screen.getByRole("region", { name: "Upcoming" });
    expect(within(upcomingSection).getByText("Call the accountant")).toBeInTheDocument();

    // Select the day the calendar event falls on.
    const chip = container.querySelector('[data-testid="calendar-event-chip"]');
    expect(chip).toBeTruthy();
    const cell = chip!.closest("[aria-pressed]") as HTMLElement;
    expect(cell).toBeTruthy();
    fireEvent.click(cell);

    // Day filter is now active...
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    // ...but the undated reminder belongs to no day, so it must still be there.
    expect(within(upcomingSection).getByText("Call the accountant")).toBeInTheDocument();
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
