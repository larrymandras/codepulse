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
 * (see the sidebar IA block below — Phase 124 replaced two of the original
 * six placeholder stubs with real assertions; the remaining four cover
 * icons, count badges and the collapsed-rail affordances, out of this
 * phase's scope).
 */

import { describe, test, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Radix Collapsible measures internally and jsdom doesn't provide
// ResizeObserver — same shim as RunTargetChooser.test.tsx / RunChatPopover.test.tsx
// / SkillLifecycleMenu.test.tsx. Without this, Collapsible's internal
// measurement surfaces as a runtime error rather than a clean test failure.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

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

function renderLayout(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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

describe("DashboardLayout Sidebar (UI-04, Phase 124 SHELL-02)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useQuery).mockReset();
    vi.mocked(useQuery).mockReturnValue(null);
    vi.mocked(useAstridrWS).mockReset();
    vi.mocked(useAstridrWS).mockReturnValue({
      status: "disconnected",
      sendCommand: vi.fn(),
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(),
      reconnect: vi.fn(),
    });
  });

  // Source-level only — jsdom does not do layout, so this cannot measure a
  // rendered pixel width. The RENDERED 232px is measured by plan 124-09's
  // Playwright geometry block; this assertion and that one are complementary,
  // not duplicates.
  it("desktop sidebar carries the w-[232px] expanded-width class, not w-60 (D-17)", () => {
    const { container } = renderLayout();
    const desktopAside = container.querySelector('aside[class*="hidden"][class*="md:flex"]');
    expect(desktopAside).toBeTruthy();
    expect(desktopAside?.className).toContain("w-[232px]");
    expect(desktopAside?.className).not.toContain("w-60");
  });

  test.todo("each nav item renders a Lucide icon, not ASCII text");
  test.todo("nav items with countQuery display a Badge with numeric count");
  test.todo("collapsed state shows icon-only with Tooltip labels");
  test.todo("collapsed icons have aria-label for accessibility");

  it("renders exactly the four domain headers Command, Observe, Agents, System — the old 5-group labels are gone", () => {
    renderLayout();
    for (const domain of ["Command", "Observe", "Agents", "System"]) {
      expect(screen.getAllByText(domain).length).toBeGreaterThan(0);
    }
    // The old placeholder test above this block named these 5 groups — they
    // never matched any shipped registry (stale before this phase touched
    // it) and must not reappear now that the regroup has landed.
    for (const staleLabel of ["OVERVIEW", "OPERATIONS", "SYSTEM", "INSIGHTS", "ADMIN"]) {
      expect(screen.queryByText(staleLabel)).not.toBeInTheDocument();
    }
  });

  it("all four domains are open by default when no stored value exists (D-15)", () => {
    renderLayout();
    // One item from each domain, per navRegistry.ts's live mapping.
    expect(screen.getAllByText("Chat").length).toBeGreaterThan(0); // Command
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0); // Observe
    expect(screen.getAllByText("Roster").length).toBeGreaterThan(0); // Agents
    expect(screen.getAllByText("Config").length).toBeGreaterThan(0); // System
  });

  it("the active nav item carries aria-current=\"page\" against a real mounted route", () => {
    renderLayout(["/alerts"]);
    const alertsLinks = screen.getAllByRole("link", { name: "Alerts" });
    expect(alertsLinks.length).toBeGreaterThan(0);
    for (const link of alertsLinks) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("collapsing a domain hides its items, writes codepulse-nav-domains, and a later render honors the stored closed state (D-14/D-15)", () => {
    renderLayout();
    const commandTriggers = screen.getAllByRole("button", { name: "Command" });
    expect(commandTriggers.length).toBeGreaterThan(0);
    fireEvent.click(commandTriggers[0]);

    expect(screen.queryAllByText("Chat").length).toBe(0);

    const stored = JSON.parse(localStorage.getItem("codepulse-nav-domains") ?? "{}");
    expect(stored.command).toBe(false);

    cleanup();
    renderLayout();
    // A fresh mount reading the same localStorage value keeps Command closed.
    expect(screen.queryAllByText("Chat").length).toBe(0);
    // An untouched domain is unaffected by the write.
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });

  it("toggling a domain in one sidebar instance keeps the desktop and mobile instances in sync (shared lifted state)", () => {
    renderLayout();
    const commandTriggers = screen.getAllByRole("button", { name: "Command" });
    // Desktop <aside> and the mobile drawer <aside> are both mounted
    // simultaneously, so there are two Collapsible triggers per domain.
    expect(commandTriggers.length).toBe(2);

    fireEvent.click(commandTriggers[0]);

    // Both instances share the lifted state — neither is left stale.
    expect(screen.queryAllByText("Chat").length).toBe(0);
  });
});
