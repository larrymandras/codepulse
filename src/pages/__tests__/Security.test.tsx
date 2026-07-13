import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// NOTE: relative mock paths are resolved from THIS file's location
// (src/pages/__tests__/), so they must use one extra ".." vs. the paths used
// inside src/pages/Security.tsx itself, to land on the same absolute module.

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
  usePaginatedQuery: vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    security: {
      rlsStats: "rlsStats",
      hitlStats: "hitlStats",
      webhookStats: "webhookStats",
      vaultStats: "vaultStats",
      recentEvents: "recentEvents",
      recentEventsPaginated: "recentEventsPaginated",
      severityCounts: "severityCounts",
      acknowledgeEvent: "acknowledgeEvent",
    },
    sandboxViolations: {
      overview: "sandboxOverview",
      recent: "sandboxRecent",
    },
  },
}));

const mockSubscribeEvent = vi.fn(() => () => {});
vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: vi.fn(),
    subscribeEvent: mockSubscribeEvent,
  }),
}));

vi.mock("@/hooks/useLiveFlash", () => ({
  useLiveFlash: () => ({ flashRef: { current: null }, triggerFlash: vi.fn() }),
}));

import { useQuery, usePaginatedQuery } from "convex/react";
const mockUseQuery = vi.mocked(useQuery);
const mockUsePaginatedQuery = vi.mocked(usePaginatedQuery);

import Security from "../Security";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SECURITY_EVENTS = Array.from({ length: 7 }).map((_, i) => ({
  _id: `evt-${i}`,
  eventType: "sandbox_violation",
  category: "general",
  severity: "low",
  description: `event ${i}`,
  timestamp: Date.now() / 1000 - i * 60,
}));

function setupQueries() {
  (mockUseQuery as any).mockImplementation((ref: unknown) => {
    switch (ref) {
      case "rlsStats":
        return { lastTest: null, crossProfileBlocked: 0 };
      case "hitlStats":
        return { pending: 0, resolvedToday: 0 };
      case "webhookStats":
        return { totalReceived: 0, forgedBlocked: 0, lastReceived: null };
      case "vaultStats":
        return { totalAccesses: 0, denied: 0, lastAccess: null };
      case "recentEvents":
        return SECURITY_EVENTS;
      case "severityCounts":
        return { critical: 0, high: 0, medium: 0, low: 0 };
      case "sandboxOverview":
        return { totalViolations: 0, strictBlocked: 0, lastViolation: null };
      case "sandboxRecent":
        return [];
      default:
        return undefined;
    }
  });
  mockUsePaginatedQuery.mockReturnValue({
    results: SECURITY_EVENTS,
    status: "Exhausted",
    loadMore: vi.fn(),
    isLoading: false,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscribeEvent.mockImplementation(() => () => {});
  setupQueries();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Security — F4 honesty (D-05/D-07)", () => {
  test("no hardcoded 'Valid' chain-integrity text or 'Chain integrity' row", () => {
    render(<Security />);
    expect(screen.queryByText("Chain integrity")).not.toBeInTheDocument();
    expect(screen.queryByText("Valid")).not.toBeInTheDocument();
  });

  test("audit entry count is labeled as loaded events, not a bare 'Entry count' integrity proxy", () => {
    render(<Security />);
    expect(screen.queryByText("Entry count")).not.toBeInTheDocument();
    expect(screen.getByText(/7 events loaded/)).toBeInTheDocument();
  });

  test("no 'Provider Allowlist' placeholder; 'Network Access Log' still renders", () => {
    render(<Security />);
    const trigger = screen.getByText("Network Policy");
    // Radix Tabs' Trigger activates on the mousedown/mouseup pair preceding
    // click in jsdom (a bare fireEvent.click does not flip aria-selected).
    fireEvent.mouseDown(trigger);
    fireEvent.mouseUp(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByText("Provider Allowlist")).not.toBeInTheDocument();
    expect(screen.getByText("Network Access Log")).toBeInTheDocument();
  });
});
