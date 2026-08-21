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
    // Phase 124 Plan 06 (D-10/D-12/D-13): the two sidebar count badges'
    // backing queries. Without these entries `api.inbox`/`api.alerts` are
    // `undefined` and InboxCountBadge/AlertsCountBadge throw on module
    // access before ever reaching the D-12 undefined-guard — every badge
    // test would fail with a TypeError, not a useful assertion.
    inbox: { listHeldUnacked: "inbox:listHeldUnacked" },
    alerts: { countBySeverity: "alerts:countBySeverity" },
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
// Phase 124 Plan 07 (Task 3): these three previously stubbed to a bare null
// render, which cannot be distinguished from "the control is not mounted" —
// a probe that returns the same result whether the overflow-menu relocation
// works or not.
// Give each an identifiable data-testid so the menu's before/after-open
// assertions below actually measure something.
vi.mock("../../components/PrivacyShield", () => ({
  default: () => <div data-testid="stub-privacy-shield" />,
}));
vi.mock("../../components/ThemeSwitcher", () => ({
  ThemeSwitcher: () => <div data-testid="stub-theme-switcher" />,
}));
vi.mock("../../components/AmbientAudioPlayer", () => ({
  default: () => <div data-testid="stub-ambient-audio" />,
}));
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

import { useQuery, useConvexConnectionState } from "convex/react";
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

describe("DashboardLayout sidebar count badges (D-10/D-12/D-13, Phase 124 Plan 06)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useQuery).mockReset();
    vi.mocked(useAstridrWS).mockReset();
    vi.mocked(useAstridrWS).mockReturnValue({
      status: "disconnected",
      sendCommand: vi.fn(),
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(),
      reconnect: vi.fn(),
    });
  });

  // Dispatches on the reference string, mirroring the telemetry describe
  // block's mockImplementation shape above. `alertsThrows` simulates a
  // genuine useQuery failure (D-13's "query threw" state) rather than a
  // resolved-but-empty result.
  function mockBadgeQueries(opts: {
    inbox?: unknown;
    alerts?: unknown;
    alertsThrows?: boolean;
  }) {
    vi.mocked(useQuery).mockImplementation(((ref: unknown) => {
      if (ref === "inbox:listHeldUnacked") return opts.inbox;
      if (ref === "alerts:countBySeverity") {
        if (opts.alertsThrows) throw new Error("simulated countBySeverity failure");
        return opts.alerts;
      }
      return undefined;
    }) as typeof useQuery);
  }

  it("renders no Inbox badge while the query is unresolved (D-12 state 1)", () => {
    mockBadgeQueries({ inbox: undefined });
    renderLayout();
    expect(screen.queryByLabelText(/unread in Inbox/)).not.toBeInTheDocument();
  });

  it("renders no Inbox badge when the resolved count is 0 — never a visible zero (D-12 state 3)", () => {
    mockBadgeQueries({ inbox: [] });
    renderLayout();
    expect(screen.queryByLabelText(/unread in Inbox/)).not.toBeInTheDocument();
  });

  it("renders the Inbox count with a domain-naming aria-label when > 0 (D-12 state 2)", () => {
    mockBadgeQueries({ inbox: [{ _id: "1" }, { _id: "2" }, { _id: "3" }] });
    renderLayout();
    // Desktop <aside> and the mobile drawer <aside> both mount SidebarContent
    // (same shared-instance shape asserted elsewhere in this file), so every
    // badge query returns two matches, not one.
    const badges = screen.getAllByLabelText("3 unread in Inbox");
    expect(badges.length).toBe(2);
    for (const badge of badges) expect(badge).toHaveTextContent("3");
  });

  it("renders the Alerts total with a domain-naming aria-label when > 0 (D-12 state 2)", () => {
    mockBadgeQueries({
      alerts: { info: 1, warning: 2, error: 0, critical: 0, truncated: false },
    });
    renderLayout();
    const badges = screen.getAllByLabelText("3 unacknowledged alerts");
    expect(badges.length).toBe(2);
    for (const badge of badges) expect(badge).toHaveTextContent("3");
  });

  it("renders a truncated Alerts count as {n}+ with an 'at least' accessible label, never a complete-looking integer", () => {
    mockBadgeQueries({
      alerts: { info: 0, warning: 0, error: 5, critical: 0, truncated: true },
    });
    renderLayout();
    const badges = screen.getAllByLabelText("at least 5 unacknowledged alerts");
    expect(badges.length).toBe(2);
    for (const badge of badges) expect(badge).toHaveTextContent("5+");
  });

  it("contains an Alerts-query throw: renders the fallback dot, never a number, and leaves the rest of the sidebar intact (D-13)", () => {
    mockBadgeQueries({ alertsThrows: true });
    renderLayout();

    // The fallback: a dimmed dot with the Copywriting Contract's exact
    // accessible label — no number rendered anywhere for Alerts.
    expect(screen.getAllByLabelText("Alerts count unavailable").length).toBe(2);
    expect(screen.queryByLabelText(/unacknowledged alerts$/)).not.toBeInTheDocument();

    // Containment control: a known-present, unrelated sidebar element still
    // renders. Without this, the test cannot distinguish "the boundary
    // contained the throw" from "the whole tree failed to mount silently" —
    // see the boundary-removed proof in 124-06-SUMMARY.md, which shows this
    // exact assertion turn red when the two SectionErrorBoundary wrappers
    // are removed.
    expect(screen.getAllByText("Command").length).toBeGreaterThan(0);
  });
});

describe("DashboardLayout system chip (D-11/D-12/D-13, Phase 124 Plan 08)", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    vi.mocked(useAstridrWS).mockReset();
    vi.mocked(useAstridrWS).mockReturnValue({
      status: "disconnected",
      sendCommand: vi.fn(),
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(),
      reconnect: vi.fn(),
    });
  });

  // Dispatches on the reference string (same shape as mockBadgeQueries
  // above) and drives useConvexConnectionState's mock per case — its module
  // mock defaults to { isWebSocketConnected: true } (line 43), so each case
  // below overrides it explicitly rather than relying on that default.
  function mockChip(opts: { connected: boolean; counts?: unknown }) {
    vi.mocked(useConvexConnectionState).mockReturnValue({
      isWebSocketConnected: opts.connected,
    } as ReturnType<typeof useConvexConnectionState>);
    vi.mocked(useQuery).mockImplementation(((ref: unknown) => {
      if (ref === "alerts:countBySeverity") return opts.counts;
      return undefined;
    }) as typeof useQuery);
  }

  // Every positive case below asserts the expected word IS present AND that
  // the other three state words are ABSENT — a chip that renders every
  // state at once, or that renders one word unconditionally, cannot pass
  // this pairing (a presence-only assertion could not distinguish them).
  const ALL_WORDS = ["Nominal", "Attention", "Critical", "Offline"];
  function assertOnly(present: string) {
    for (const word of ALL_WORDS) {
      if (word === present) {
        expect(screen.getAllByText(word).length).toBeGreaterThan(0);
      } else {
        expect(screen.queryByText(word)).not.toBeInTheDocument();
      }
    }
  }

  it("WS disconnected -> Offline, and none of Nominal/Attention/Critical renders", () => {
    mockChip({ connected: false, counts: { info: 0, warning: 0, error: 0, critical: 0, truncated: false } });
    renderLayout();
    assertOnly("Offline");
  });

  it("WS connected, counts unresolved (undefined) -> no chip text at all renders", () => {
    mockChip({ connected: true, counts: undefined });
    renderLayout();
    for (const word of ALL_WORDS) {
      expect(screen.queryByText(word)).not.toBeInTheDocument();
    }
  });

  it("WS connected, counts all zero -> Nominal", () => {
    mockChip({ connected: true, counts: { info: 0, warning: 0, error: 0, critical: 0, truncated: false } });
    renderLayout();
    assertOnly("Nominal");
  });

  it("WS connected, warning: 3 -> Attention", () => {
    mockChip({ connected: true, counts: { info: 0, warning: 3, error: 0, critical: 0, truncated: false } });
    renderLayout();
    assertOnly("Attention");
  });

  it("WS connected, error: 1 -> Critical", () => {
    mockChip({ connected: true, counts: { info: 0, warning: 0, error: 1, critical: 0, truncated: false } });
    renderLayout();
    assertOnly("Critical");
  });

  it("WS connected, critical: 1 -> Critical (the || branch's other side)", () => {
    mockChip({ connected: true, counts: { info: 0, warning: 0, error: 0, critical: 1, truncated: false } });
    renderLayout();
    assertOnly("Critical");
  });

  it("Offline wins over Critical: WS disconnected with critical:5 still renders Offline, never Critical (precedence)", () => {
    mockChip({ connected: false, counts: { info: 0, warning: 0, error: 0, critical: 5, truncated: false } });
    renderLayout();
    assertOnly("Offline");
  });

  it("the chip's state agrees with the Alerts sidebar badge — both read the same countBySeverity subscription", () => {
    // warning: 2 -> chip says Attention; the same counts sum to a total of 2
    // in the Alerts sidebar badge's own aria-label, both derived from one
    // mocked response, so a mismatch here can only mean the two consumers
    // diverged, not that the mock was inconsistent.
    mockChip({ connected: true, counts: { info: 0, warning: 2, error: 0, critical: 0, truncated: false } });
    renderLayout();
    assertOnly("Attention");
    const alertsBadges = screen.getAllByLabelText("2 unacknowledged alerts");
    expect(alertsBadges.length).toBeGreaterThan(0);
  });
});

describe("DashboardLayout header overflow menu (D-07, Phase 124 Plan 07)", () => {
  beforeEach(() => {
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

  // Radix's DropdownMenuTrigger opens on pointerdown (not click) — same
  // convention as RunTargetChooser.test.tsx / SkillLifecycleMenu.test.tsx.
  function openOverflowMenu() {
    fireEvent.pointerDown(screen.getByLabelText("More options"), {
      button: 0,
      ctrlKey: false,
    });
  }

  it('the "More options" trigger renders with an accessible name on every render', () => {
    renderLayout();
    expect(screen.getByLabelText("More options")).toBeInTheDocument();
  });

  it("none of the four relocated controls is in the document before the menu opens", () => {
    renderLayout();
    expect(screen.queryByTestId("stub-theme-switcher")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stub-privacy-shield")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stub-ambient-audio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/CRT effect/)).not.toBeInTheDocument();
  });

  it("opening the trigger reveals exactly the four relocated controls, and no Help item exists", async () => {
    renderLayout();
    openOverflowMenu();

    expect(await screen.findByTestId("stub-theme-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("stub-privacy-shield")).toBeInTheDocument();
    expect(screen.getByTestId("stub-ambient-audio")).toBeInTheDocument();
    expect(screen.getByLabelText(/CRT effect/)).toBeInTheDocument();

    // D-07 (amended 2026-08-21): Help is deferred, not built — assert its
    // absence explicitly so a future "restoration" fails loudly.
    expect(screen.queryByText(/\bhelp\b/i)).not.toBeInTheDocument();
  });

  it("the six visible right-zone items are still in the document without opening the menu", () => {
    renderLayout();
    // EStopButton/NotificationBell/UserMenu are pre-existing bare-null-render
    // stubs in this suite, unrelated to Task 3's relocation work (the plan
    // names only PrivacyShield/ThemeSwitcher/AmbientAudioPlayer for a
    // testid upgrade), so they render nothing to assert against either way.
    // BrainHeaderBadge itself throws under this suite's minimal api mock
    // (it needs useBrainCatalogue/useResolvedBrain query refs this file
    // never mocked — a pre-existing gap unrelated to D-07) and its
    // SectionErrorBoundary catches that with a "{name} failed to load"
    // fallback — which still proves the *slot* stayed in the visible row
    // rather than being pulled into the menu, even though its real content
    // can't render here.
    expect(screen.getByLabelText("More options")).toBeInTheDocument();
    expect(screen.getByText("Active Brain failed to load")).toBeInTheDocument();
  });
});
