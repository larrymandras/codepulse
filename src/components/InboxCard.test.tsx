/**
 * InboxCard.test.tsx — Phase 186 Plan 07 (TDD, GOV-01/WATCH-01)
 *
 * Covers the new "card" and "held" InboxItemType branches (D-12/D-14/D-15):
 *   - card:  ambient info stripe, per-card profile badge, NO action buttons
 *   - held:  dimmest (muted-foreground) stripe, held reason copy, profile badge
 *   - existing approval/alert/notification rendering stays unaffected
 *     (regression check: an alert item still renders its AlertInlineActions).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InboxCard, type InboxItem } from "./InboxCard";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: new Proxy(
    {},
    {
      get: () => new Proxy({}, { get: () => "mock-fn-ref" }),
    }
  ),
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({ status: "connected" }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeCardItem = (overrides: Partial<InboxItem> = {}): InboxItem => ({
  id: "card-1",
  type: "card",
  title: "New email from a client",
  message: "Looks like it needs a reply today.",
  timestamp: Date.now(),
  read: false,
  profileId: "business",
  source: "mail",
  ...overrides,
});

const makeHeldItem = (overrides: Partial<InboxItem> = {}): InboxItem => ({
  id: "held-1",
  type: "held",
  title: "Calendar reminder: 1:1 with Sam",
  message: "Starts in 15 minutes.",
  timestamp: Date.now(),
  read: false,
  profileId: "personal",
  heldReason: "focus",
  ...overrides,
});

const makeAlertItem = (overrides: Partial<InboxItem> = {}): InboxItem => ({
  id: "alert-1",
  type: "alert",
  title: "[HIGH] disk-monitor",
  message: "Disk usage above threshold.",
  timestamp: Date.now(),
  read: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alertId: "alert-1" as any,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("InboxCard — card item type (D-14)", () => {
  it("renders the calm info stripe", () => {
    const { container } = render(<InboxCard item={makeCardItem()} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-l-(--status-info)");
  });

  it("renders its per-card profile badge (D-12)", () => {
    render(<InboxCard item={makeCardItem({ profileId: "business" })} />);
    expect(screen.getByText("Business")).toBeInTheDocument();
  });

  it("renders no approve/reject action buttons", () => {
    render(<InboxCard item={makeCardItem()} />);
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();
  });
});

describe("InboxCard — held item type (D-07/D-15)", () => {
  it("renders the dimmest (muted-foreground) stripe", () => {
    const { container } = render(<InboxCard item={makeHeldItem()} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-l-(--muted-foreground)");
  });

  it("shows why it was held (focus mode)", () => {
    render(<InboxCard item={makeHeldItem({ heldReason: "focus" })} />);
    expect(screen.getByText(/held during focus mode/)).toBeInTheDocument();
  });

  it("shows why it was held (quiet hours)", () => {
    render(<InboxCard item={makeHeldItem({ heldReason: "quiet-hours" })} />);
    expect(screen.getByText(/held during quiet hours/)).toBeInTheDocument();
  });

  it("renders its per-card profile badge (D-12)", () => {
    render(<InboxCard item={makeHeldItem({ profileId: "consulting" })} />);
    expect(screen.getByText("Consulting")).toBeInTheDocument();
  });

  it("renders no approve/reject action buttons", () => {
    render(<InboxCard item={makeHeldItem()} />);
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();
  });
});

describe("InboxCard — existing alert rendering is unchanged (regression)", () => {
  it("still renders AlertInlineActions for an alert item", () => {
    render(<InboxCard item={makeAlertItem()} />);
    expect(screen.getByText("Acknowledge")).toBeInTheDocument();
    expect(screen.getByText("Mute")).toBeInTheDocument();
  });

  it("still renders the alert (error) stripe", () => {
    const { container } = render(<InboxCard item={makeAlertItem()} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-l-(--status-error)");
  });
});
