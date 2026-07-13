import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// cmdk (used by CommandDialog) requires ResizeObserver and scrollIntoView — polyfill for jsdom
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Mock dependencies before imports
vi.mock("@/hooks/useCommandPaletteSearch", () => ({
  useCommandPaletteSearch: () => ({
    agents: [{ id: "a1", name: "Builder" }],
    sessions: [{ id: "s1", label: "Session #1" }],
    alerts: [{ id: "al1", title: "Cost spike" }],
    cronJobs: [{ id: "cj1", name: "health-check" }],
  }),
}));

vi.mock("@/hooks/useCommandCatalog", () => ({
  useCommandCatalog: () => ({
    commands: [],
    status: "loading",
  }),
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    sendCommand: vi.fn().mockResolvedValue({ ack: "ok" }),
    status: "connected",
    subscribe: vi.fn(),
    subscribeEvent: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

import { CommandPalette } from "@/components/CommandPalette";

function renderPalette(props: { open: boolean; onOpenChange?: (v: boolean) => void }) {
  const onOpenChange = props.onOpenChange ?? vi.fn();
  return render(
    <MemoryRouter>
      <CommandPalette open={props.open} onOpenChange={onOpenChange} />
    </MemoryRouter>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("renders CommandDialog when open=true", () => {
    renderPalette({ open: true });
    // CommandDialog renders a dialog with role="dialog"
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render visible dialog content when open=false", () => {
    renderPalette({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows CommandInput with placeholder 'Search pages, agents, sessions, commands...'", () => {
    renderPalette({ open: true });
    const input = screen.getByPlaceholderText("Search pages, agents, sessions, commands...");
    expect(input).toBeInTheDocument();
  });

  it("renders CommandGroup sections: Pages, Agents, Sessions, Alerts, Cron Jobs, Quick Actions, Actions, Commands per D-01/D-03", () => {
    renderPalette({ open: true });
    // Use getAllByText since group headings and nav items may share the same text
    expect(screen.getAllByText("Pages").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Agents").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sessions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Alerts").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Cron Jobs")).toBeInTheDocument();
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Commands")).toBeInTheDocument();
  });

  it("renders CommandEmpty with 'No results found.' when search has no matches", () => {
    renderPalette({ open: true });
    // Type a query that won't match any mock data — cmdk will show CommandEmpty
    const input = screen.getByPlaceholderText("Search pages, agents, sessions, commands...");
    fireEvent.change(input, { target: { value: "xyzzy-no-match-abc123" } });
    expect(screen.getByText("No results found.")).toBeInTheDocument();
  });

  it("Quick Actions group contains all four required actions per D-02", () => {
    renderPalette({ open: true });
    expect(screen.getByText("Send task to agent")).toBeInTheDocument();
    expect(screen.getByText("View Unified Inbox")).toBeInTheDocument();
    expect(screen.getByText("Mute all alerts")).toBeInTheDocument();
    expect(screen.getByText("Navigate to Insights Chat")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when a CommandItem is selected", () => {
    const onOpenChange = vi.fn();
    renderPalette({ open: true, onOpenChange });
    // Click the "Send task to agent" item
    const item = screen.getByText("Send task to agent");
    fireEvent.click(item);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Cron Jobs group renders cron job items from useCommandPaletteSearch", () => {
    renderPalette({ open: true });
    // The mock provides cronJobs: [{ id: "cj1", name: "health-check" }]
    expect(screen.getByText("health-check")).toBeInTheDocument();
  });

  // F2: CommandPalette must source pages from the single navItems registry
  // (DashboardLayout), not a hardcoded, drifted NAV_PAGES list.
  it("renders previously-missing routes sourced from navItems (F2)", () => {
    renderPalette({ open: true });
    // These routes existed in the sidebar's navItems but were absent from the
    // old hardcoded NAV_PAGES array — proves the registry import, not drift.
    expect(screen.getByText("Forge")).toBeInTheDocument();
    expect(screen.getByText("Graphs Hub")).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument(); // an /hr/* route
  });

  it("does not navigate to stale /agents or /profiles routes anywhere in the palette", () => {
    renderPalette({ open: true });

    // No page in the registry-sourced Pages group is labeled "Profiles" —
    // that route was removed/redirected (F2).
    expect(screen.queryByText("Profiles")).not.toBeInTheDocument();

    // The Agents-group entity item (mocked agent "Builder") must navigate to
    // /hr/roster, never the stale /agents deep link.
    fireEvent.click(screen.getByText("Builder"));
    expect(mockNavigate).toHaveBeenCalledWith("/hr/roster");
    expect(mockNavigate).not.toHaveBeenCalledWith("/agents");
    expect(mockNavigate).not.toHaveBeenCalledWith("/profiles");
  });

  it("navigates to the correct target when a registry-sourced Pages item is clicked", () => {
    renderPalette({ open: true });
    fireEvent.click(screen.getByText("Forge"));
    expect(mockNavigate).toHaveBeenCalledWith("/forge");
  });

  it("resolves each navItems entry to a rendered icon (guards Pitfall 1 string-key regression)", () => {
    const { container } = renderPalette({ open: true });
    // Every Pages-group CommandItem should render an svg icon element,
    // proving iconComponents[item.icon] resolved to a real component instead
    // of silently rendering nothing (Pitfall 1: treating the string key as
    // if it were already a component).
    const forgeLabel = screen.getByText("Forge");
    const forgeItem = forgeLabel.closest("[cmdk-item]");
    expect(forgeItem).not.toBeNull();
    expect(forgeItem?.querySelector("svg")).not.toBeNull();

    const graphsLabel = screen.getByText("Graphs Hub");
    const graphsItem = graphsLabel.closest("[cmdk-item]");
    expect(graphsItem).not.toBeNull();
    expect(graphsItem?.querySelector("svg")).not.toBeNull();

    void container;
  });
});
