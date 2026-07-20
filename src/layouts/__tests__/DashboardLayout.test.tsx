/**
 * DashboardLayout.test.tsx — Phase 96 Plan 02 (F3/D-04: honest header telemetry).
 *
 * Covers the header SYS/LAT readouts: they must render REAL data only and be
 * HIDDEN entirely (never "—", never "0") when the underlying data is absent.
 *
 *   - SYS hidden when systemResources.current returns null
 *   - SYS shows the rounded cpu value when systemResources.current is present
 *   - LAT hidden when the WS is not connected / no measurement exists
 *
 * All heavy/side-effecting children (CommandPalette, audio, notifications,
 * avatar uploader, etc.) are stubbed so the layout mounts in
 * jsdom without pulling in their own contexts/dependencies — this test is
 * scoped to the header telemetry contract, not the full sidebar/palette UX
 * (see the original sidebar IA test.todo stubs below, still pending).
 */

import { describe, test, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Module mocks (declared before component import — Vitest hoisting) ──────

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useConvexConnectionState: vi.fn(() => ({ isWebSocketConnected: true })),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    systemResources: { current: "systemResources:current" },
    avatars: { getImageUrl: "avatars:getImageUrl" },
    notifications: { latestUnread: "notifications:latestUnread" },
  },
}));

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: "disconnected",
    sendCommand: vi.fn().mockResolvedValue({ type: "ack", request_id: "1", status: "ok" }),
    subscribe: vi.fn(),
    subscribeEvent: vi.fn(),
    reconnect: vi.fn(),
  })),
}));

// Stub heavy/side-effecting children so DashboardLayout mounts cleanly in jsdom.
vi.mock("../../components/AlertBanner", () => ({ default: () => null }));
vi.mock("../../components/ErrorBoundary", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../components/OnboardingGuide", () => ({ default: () => null }));
vi.mock("../../components/UserMenu", () => ({ default: () => null }));
vi.mock("../../components/PrivacyShield", () => ({ default: () => null }));
vi.mock("../../components/ThemeSwitcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("../../components/AmbientAudioPlayer", () => ({ default: () => null }));
vi.mock("../../hooks/useAudioEvents", () => ({ useAudioEvents: () => {} }));
vi.mock("../../components/NotificationBell", () => ({ default: () => null }));
vi.mock("../../hooks/useNotificationToasts", () => ({ useNotificationToasts: () => {} }));
vi.mock("../../components/EStopButton", () => ({ EStopButton: () => null }));
vi.mock("../../components/CommandPalette", () => ({
  CommandPalette: ({ open }: { open: boolean }) =>
    open ? <div data-testid="command-palette-open" /> : null,
}));
vi.mock("../../components/AvatarUploader", () => ({ default: () => null }));
vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { useQuery } from "convex/react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import DashboardLayout from "../DashboardLayout";

function renderLayout() {
  return render(
    <MemoryRouter>
      <DashboardLayout />
    </MemoryRouter>,
  );
}

describe("DashboardLayout header telemetry (F3/D-04 — honest, real-or-hidden)", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useAstridrWS).mockReset();
  });

  it("hides SYS when systemResources.current returns null", () => {
    vi.mocked(useQuery).mockReturnValue(null);
    vi.mocked(useAstridrWS).mockReturnValue({
      status: "disconnected",
      sendCommand: vi.fn(),
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(),
      reconnect: vi.fn(),
    });

    renderLayout();

    expect(screen.queryByText(/SYS:/)).not.toBeInTheDocument();
  });

  it("shows SYS with the rounded cpu value when systemResources.current is present", () => {
    vi.mocked(useQuery).mockImplementation(((ref: unknown) => {
      if (ref === "systemResources:current") return { cpu: 42.6, ram: null, disk: null };
      return undefined;
    }) as typeof useQuery);
    vi.mocked(useAstridrWS).mockReturnValue({
      status: "disconnected",
      sendCommand: vi.fn(),
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(),
      reconnect: vi.fn(),
    });

    renderLayout();

    expect(screen.getByText(/SYS:/)).toBeInTheDocument();
    expect(screen.getByText("43%")).toBeInTheDocument();
  });

  it("hides LAT when the WS is not connected (no measurement)", () => {
    vi.mocked(useQuery).mockReturnValue(null);
    vi.mocked(useAstridrWS).mockReturnValue({
      status: "disconnected",
      sendCommand: vi.fn(),
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(),
      reconnect: vi.fn(),
    });

    renderLayout();

    expect(screen.queryByText(/LAT:/)).not.toBeInTheDocument();
  });
});

describe("DashboardLayout keyboard shortcuts (global palette vs. Skills palette conflict)", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useAstridrWS).mockReset();
    vi.mocked(useQuery).mockReturnValue(null);
    vi.mocked(useAstridrWS).mockReturnValue({
      status: "disconnected",
      sendCommand: vi.fn(),
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(),
      reconnect: vi.fn(),
    });
  });

  it("does not open the global command palette on Ctrl+Shift+K (reserved for the Skills palette)", () => {
    renderLayout();

    // Uppercase "K" variant, as fired by real Shift+K keyboard events.
    fireEvent.keyDown(window, { key: "K", ctrlKey: true, shiftKey: true });
    expect(screen.queryByTestId("command-palette-open")).not.toBeInTheDocument();

    // Lowercase "k" variant (synthetic-event style) — same guard must catch it.
    fireEvent.keyDown(window, { key: "k", ctrlKey: true, shiftKey: true });
    expect(screen.queryByTestId("command-palette-open")).not.toBeInTheDocument();
  });

  it("still opens the global command palette on plain Ctrl+K", () => {
    renderLayout();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByTestId("command-palette-open")).toBeInTheDocument();
  });

  it("does not open the global command palette when the keydown's default was already prevented (e.g. a focused cmdk input's own Ctrl+K binding)", () => {
    // Registered on window before the layout mounts, so it runs first and
    // mirrors a focused cmdk input (vimBindings) consuming the event.
    const preventOnCtrlK = (e: KeyboardEvent) => {
      if (e.key === "k" && e.ctrlKey) e.preventDefault();
    };
    window.addEventListener("keydown", preventOnCtrlK);

    renderLayout();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByTestId("command-palette-open")).not.toBeInTheDocument();

    window.removeEventListener("keydown", preventOnCtrlK);
  });
});

describe("DashboardLayout Sidebar (UI-04)", () => {
  test.todo("renders 5 section groups: OVERVIEW, OPERATIONS, SYSTEM, INSIGHTS, ADMIN");
  test.todo("each nav item renders a Lucide icon, not ASCII text");
  test.todo("nav items with countQuery display a Badge with numeric count");
  test.todo("collapsed state shows icon-only with Tooltip labels");
  test.todo("collapsed icons have aria-label for accessibility");
  test.todo("sidebar width is 240px (w-60) when expanded");
});
