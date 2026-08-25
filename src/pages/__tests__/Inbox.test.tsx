import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { useQuery } from "convex/react";
import type { InboxItem } from "@/components/InboxCard";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
}));

// Each module.function pair resolves to a distinct, stable string (e.g.
// "inbox.listAll") rather than one shared "mock-fn-ref" — lets tests give
// the mocked useQuery a per-query implementation (D-12 aggregate merge test
// below needs to seed api.inbox.listAll specifically without perturbing
// api.alerts.listActive / api.notifications.bellAll, which stay []).
//
// Rule 1 fix: this specifier is resolved relative to THIS file
// (src/pages/__tests__/), so it must be "../../../convex/..." to reach the
// repo-root convex/ dir — the pre-existing "../../convex/..." (one level
// short) silently resolved to nothing and Vite fell through to importing
// the REAL generated Convex api module unmocked. That was harmless while
// no test depended on the mocked ref's identity, but it directly breaks the
// D-12 per-query mock below (api.inbox.listAll never matched the seeded
// mock because it was the real FunctionReference object, not our string).
vi.mock("../../../convex/_generated/api", () => ({
  api: new Proxy(
    {},
    {
      get: (_t, mod) =>
        new Proxy({}, { get: (_t2, fn) => `${String(mod)}.${String(fn)}` }),
    }
  ),
}));

const mockSendCommand = vi.fn().mockResolvedValue({ status: "ok" });
const mockSubscribeEvent = vi.fn(() => () => {});

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribeEvent: mockSubscribeEvent,
  }),
}));

vi.mock("@/hooks/useLiveFlash", () => ({
  useLiveFlash: () => ({ flashRef: { current: null }, triggerFlash: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks
import Inbox from "../Inbox";

// ─── Fixture items ────────────────────────────────────────────────────────────

const makeApprovalItem = (id: string): InboxItem => ({
  id,
  type: "approval",
  title: `Action ${id}`,
  message: `Details for ${id}`,
  timestamp: Date.now(),
  read: false,
  riskLevel: "low",
  agentName: "Ástríðr",
  action: `action_${id}`,
  requestId: id,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Capture the approval_request subscription callback so tests can inject items.
 */
function getApprovalCallback(): ((event: Record<string, unknown>) => void) | null {
  for (const call of mockSubscribeEvent.mock.calls as unknown as [string, (event: Record<string, unknown>) => void][]) {
    if (call[0] === "approval_request") return call[1];
  }
  return null;
}

function injectApprovalItem(item: InboxItem) {
  const cb = getApprovalCallback();
  if (!cb) throw new Error("approval_request subscription not found");
  act(() => {
    cb({
      id: item.id,
      action: item.action ?? item.title,
      details: { agent_name: item.agentName },
      timestamp: item.timestamp / 1000,
    });
  });
}

function renderInbox() {
  return render(<Inbox />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

// Keyboard-navigation tests removed: commit 123416a4 deliberately deleted the
// Inbox keyboard-nav layer (arrow-focus, keydown handler, focus ring, 'a'/'r'
// shortcuts, "↑↓ navigate" hint) because it advertised actions that no-op'd on
// the notifications inbox. Actions are now purely click-driven; those tests
// covered a feature that no longer exists.

// ─── D-11 gap closure: server-rejected approve/reject must never render as
// success (T-96-13-01 — mirrors the T-96-03-01 fix already in ApprovalBlock).
describe("Inbox — approval false-success gating (D-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok" });
  });

  test("server-rejected approve leaves the card pending — no false success", async () => {
    mockSendCommand.mockRejectedValueOnce(new Error("No pending request found"));
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-1"));

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    // Still pending: Approve button remains, no "Approved" indicator rendered.
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.queryByText("Approved")).toBeNull();
  });

  test("server-rejected reject leaves the card pending — no false success", async () => {
    mockSendCommand.mockRejectedValueOnce(new Error("No pending request found"));
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-2"));

    // Open the inline reject textarea, then submit.
    fireEvent.click(screen.getByText("Reject"));
    const rejectButtons = screen.getAllByText("Reject");
    const submitButton = rejectButtons[rejectButtons.length - 1];
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Still pending: Approve button remains, no "Rejected" indicator rendered.
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.queryByText("Rejected")).toBeNull();
  });

  test("server-ok approve commits the card to approved", async () => {
    mockSendCommand.mockResolvedValueOnce({ status: "ok" });
    renderInbox();
    injectApprovalItem(makeApprovalItem("item-3"));

    await act(async () => {
      fireEvent.click(screen.getByText("Approve"));
    });

    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).toBeNull();
  });
});

// ─── D-12: aggregate all-profiles inbox merge (Plan 07, GOV-01/WATCH-01) ──────
// Seeds api.inbox.listAll (the ONE merged stream, NOT a per-profile read)
// with card/held rows under personal, business, AND consulting, and asserts
// none are dropped — the concrete proof that the Inbox needs no profile
// switcher because every row is self-labelling via its own profileId.
describe("Inbox — aggregate all-profiles card/held merge (D-12)", () => {
  const seededRows = [
    {
      _id: "inbox-personal-card",
      profileId: "personal",
      title: "Personal card",
      body: "Needs you: personal follow-up.",
      createdAt: Date.now() / 1000,
      itemType: "card",
      source: "mail",
    },
    {
      _id: "inbox-business-card",
      profileId: "business",
      title: "Business card",
      body: "Needs you: business follow-up.",
      createdAt: Date.now() / 1000,
      itemType: "card",
      source: "calendar",
    },
    {
      _id: "inbox-consulting-held",
      profileId: "consulting",
      title: "Consulting held item",
      body: "Client ping held during focus mode.",
      createdAt: Date.now() / 1000,
      itemType: "held",
      heldReason: "focus",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useQuery).mockImplementation(((...args: any[]) => {
      if (args[0] === "inbox.listAll") return seededRows;
      return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
  });

  afterEach(() => {
    vi.mocked(useQuery).mockReset();
  });

  test("cards/held from personal, business, AND consulting all render in the merged stream", () => {
    renderInbox();
    expect(screen.getByText("Personal card")).toBeInTheDocument();
    expect(screen.getByText("Business card")).toBeInTheDocument();
    expect(screen.getByText("Consulting held item")).toBeInTheDocument();
  });

  test("each row carries its own per-card profile badge — no profile switcher needed", () => {
    renderInbox();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Consulting")).toBeInTheDocument();
  });

  test("Cards tab shows only card items (business/consulting cards not dropped)", () => {
    renderInbox();
    fireEvent.click(screen.getByText("Cards"));
    expect(screen.getByText("Personal card")).toBeInTheDocument();
    expect(screen.getByText("Business card")).toBeInTheDocument();
    expect(screen.queryByText("Consulting held item")).toBeNull();
  });

  test("Held tab shows only held items", () => {
    renderInbox();
    fireEvent.click(screen.getByText("Held"));
    expect(screen.getByText("Consulting held item")).toBeInTheDocument();
    expect(screen.queryByText("Personal card")).toBeNull();
    expect(screen.queryByText("Business card")).toBeNull();
  });

  test("Cards/Held empty-state copy matches 186-UI-SPEC exactly when a tab is empty", () => {
    vi.mocked(useQuery).mockImplementation(() => []);
    renderInbox();
    fireEvent.click(screen.getByText("Cards"));
    expect(
      screen.getByText(
        "No cards yet — the hourly scan hasn't found anything that needs you."
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Held"));
    expect(
      screen.getByText(
        "Nothing held. Focus mode and quiet hours are both off, or nothing came in while they were on."
      )
    ).toBeInTheDocument();
  });
});

// ─── 126-06 (SWEEP-03, D-01/D-02/D-04): tab caps declare themselves ───────────
// The observed contradiction that motivates this: sidebar badge 46 vs page
// tabs "All 139 · Cards 130 · Held 9" simultaneously. This block proves the
// Held tab's "N of M" is derived from the SAME api.inbox.countHeldUnacked
// query the sidebar badge subscribes to (src/layouts/DashboardLayout.tsx),
// not a second independently-computed number — see 126-06-PLAN.md
// <planner_corrections> item 1 for why NOT api.inbox.listHeldUnacked.
describe("Inbox — tab cap declarations (126-06, D-01/D-02/D-04)", () => {
  // Page's own INBOX_LIST_LIMIT (src/pages/Inbox.tsx) — duplicated here
  // deliberately as a literal, not imported, so this test would catch the
  // page and the fixture drifting apart rather than silently tracking a
  // shared constant.
  const LIST_LIMIT = 200;

  // Generates `total` inbox rows with exactly `unackedHeld` of them
  // itemType="held" + ackedAt undefined (unacked); the rest are
  // itemType="card". Derived programmatically so the numbers asserted below
  // are never hand-typed against the fixture.
  function makeInboxWindow(total: number, unackedHeld: number) {
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < total; i++) {
      const isHeld = i < unackedHeld;
      rows.push({
        _id: `row-${i}`,
        profileId: "personal",
        title: `Row ${i}`,
        body: "body",
        createdAt: Date.now() / 1000,
        itemType: isHeld ? "held" : "card",
        heldReason: isHeld ? "focus" : undefined,
        // ackedAt intentionally omitted (undefined) -- every row is unacked,
        // matching the "N of M" semantics (M is the unacked-held total, not
        // the all-time held total).
      });
    }
    return rows;
  }

  function mockInboxQueries(opts: {
    listAll: Array<Record<string, unknown>>;
    countHeldUnacked?: { count: number; truncated: boolean };
  }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useQuery).mockImplementation(((...args: any[]) => {
      if (args[0] === "inbox.listAll") return opts.listAll;
      if (args[0] === "inbox.countHeldUnacked") return opts.countHeldUnacked;
      return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    vi.mocked(useQuery).mockReset();
  });

  test("Held tab renders the precise 'N of M' when countHeldUnacked has resolved and is untruncated", () => {
    const window_ = makeInboxWindow(LIST_LIMIT, 9);
    mockInboxQueries({
      listAll: window_,
      countHeldUnacked: { count: 46, truncated: false },
    });
    renderInbox();
    expect(screen.getByText("9 of 46")).toBeInTheDocument();
  });

  test("CONTROL for the above: a truncated countHeldUnacked does NOT render '9 of 46' -- falls back to the generic floor marker (D-04)", () => {
    const window_ = makeInboxWindow(LIST_LIMIT, 9);
    mockInboxQueries({
      listAll: window_,
      countHeldUnacked: { count: 46, truncated: true },
    });
    renderInbox();
    expect(screen.queryByText("9 of 46")).toBeNull();
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  test("Cards tab renders the generic truncation marker when listAll returns exactly the page's own limit", () => {
    const window_ = makeInboxWindow(LIST_LIMIT, 0); // all 200 rows are cards
    mockInboxQueries({
      listAll: window_,
      countHeldUnacked: { count: 0, truncated: false },
    });
    renderInbox();
    // "All" is also truncated in this fixture (same listAll window), so
    // scope to the Cards tab button specifically rather than a bare
    // screen-wide text query, which would ambiguously match both.
    const cardsButton = screen.getByRole("button", { name: /Cards/ });
    expect(within(cardsButton).getByText("200+")).toBeInTheDocument();
  });

  test("CONTROL for the above: no tab renders a truncation marker when listAll returns fewer rows than the page's limit", () => {
    const window_ = makeInboxWindow(12, 3); // well under LIST_LIMIT
    mockInboxQueries({
      listAll: window_,
      countHeldUnacked: { count: 3, truncated: false },
    });
    renderInbox();
    // Held: precise "3 of 3" is not rendered either, since total === count
    // (nothing more exists beyond what's already shown) -- plain "3" instead.
    expect(screen.queryByText(/\d\+/)).toBeNull();
    expect(screen.queryByText(/ of /)).toBeNull();
    expect(screen.getByText("3", { selector: "span" })).toBeInTheDocument();
  });

  test("Held tab renders its plain count with no 'of M' and no marker while countHeldUnacked is unresolved (undefined)", () => {
    const window_ = makeInboxWindow(12, 5); // under the limit, so listAll can't imply a cap either
    mockInboxQueries({ listAll: window_, countHeldUnacked: undefined });
    renderInbox();
    expect(screen.getByText("5", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText(/ of /)).toBeNull();
    expect(screen.queryByText("5+")).toBeNull();
  });
});
