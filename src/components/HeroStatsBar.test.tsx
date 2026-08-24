import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ── convex/react + api mocks ────────────────────────────────────────────────
// `useQuery` is differentiated by the query-ref string (see the api mock
// below) so each of the component's four `useQuery` call sites can be driven
// independently -- needed both to isolate the Memory Hit Rate tile (proving
// it renders exactly once) and to move every tile out of its default
// "loading" state (MetricCard's `loading` case renders no label text at
// all, only a skeleton -- see MetricCard.tsx's state switch).
type QueryValues = {
  heroStatsSummary: unknown;
  memoryPreflightStats: unknown;
  dreamingRecentFacts: unknown;
  advisorSavings: unknown;
};

let mockQueryValues: QueryValues = {
  heroStatsSummary: undefined,
  memoryPreflightStats: undefined,
  dreamingRecentFacts: undefined,
  advisorSavings: undefined,
};

vi.mock("convex/react", () => ({
  useQuery: vi.fn((queryRef: unknown) => {
    switch (queryRef) {
      case "heroStats:summary":
        return mockQueryValues.heroStatsSummary;
      case "memoryPreflight:stats":
        return mockQueryValues.memoryPreflightStats;
      case "dreaming:recentFacts":
        return mockQueryValues.dreamingRecentFacts;
      case "advisorEvents:savingsSummary":
        return mockQueryValues.advisorSavings;
      default:
        return undefined;
    }
  }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    heroStats: { summary: "heroStats:summary" },
    memoryPreflight: { stats: "memoryPreflight:stats" },
    dreaming: { recentFacts: "dreaming:recentFacts" },
    advisorEvents: { savingsSummary: "advisorEvents:savingsSummary" },
  },
}));

// ── useHeroStats mock — controllable per test so all three health tiers can
// be exercised without depending on live Convex data. ─────────────────────
type Health = "green" | "yellow" | "red";
let mockStats = {
  activeSessions: 3,
  runningAgents: 2,
  errorRate: 5,
  errorsThisHour: 1,
  eventsThisHour: 40,
  eventSparkline: [] as number[],
  activeAlerts: 0,
  criticalAlerts: 0,
  errorAlerts: 0,
  hourlyCost: 0,
  hourlyTokens: 0,
  costSparkline: [] as number[],
  knownTools: 0,
  securityEvents: 0,
  health: "green" as Health,
};
vi.mock("../hooks/useHeroStats", () => ({
  useHeroStats: () => mockStats,
}));

import HeroStatsBar from "./HeroStatsBar";

function renderBar() {
  return render(
    <MemoryRouter>
      <HeroStatsBar />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockStats = { ...mockStats, health: "green" };
  mockQueryValues = {
    heroStatsSummary: undefined,
    memoryPreflightStats: undefined,
    dreamingRecentFacts: undefined,
    advisorSavings: undefined,
  };
});

// 125-11 (D-09): the fabricated SYSTEM LOAD top card -- its health dot, its
// `100 - errorRate*2` numeral/gradient bar, and its duplicate memory readout
// -- is deleted outright. The KPI grid (8 `MetricCard` tiles) is the only
// remaining output. These tests replace the pre-125-11 top-card coverage
// (status-dot dead-class fix, top-card token-layer checks, and the old
// "System Load survives" scope control), which no longer apply because the
// element under test no longer exists.
describe("HeroStatsBar — fabricated top card removed (D-09 / POLISH-04)", () => {
  it("renders no System Load label or LIVE / 5H WINDOW eyebrow", () => {
    renderBar();
    expect(screen.queryByText("System Load")).not.toBeInTheDocument();
    expect(screen.queryByText("LIVE / 5H WINDOW")).not.toBeInTheDocument();
  });

  it("renders no Status eyebrow or health dot", () => {
    renderBar();
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("renders no element derived from the 100 - errorRate*2 composite", () => {
    // activeSessions > 0 and errorRate = 13 would have produced the old
    // top card's numeral/gradient-bar width as 100 - (13 * 2) = 74 -- a
    // percentage distinct from every other value on the page (Error Rate's
    // own KPI tile renders "13%", not "74%"). Its absence is the evidence
    // the composite itself is gone, not just relabelled.
    mockStats = { ...mockStats, activeSessions: 3, errorRate: 13 };
    renderBar();
    expect(screen.queryByText("74%")).not.toBeInTheDocument();
  });

  it("renders the memory hit-rate KPI tile exactly once, with the deleted card's OWN 'Memory' readout label gone", () => {
    // Before 125-11 the memory hit-rate value rendered under two DIFFERENT
    // labels: the deleted card's plain "Memory" readout ("X% / 100%") and
    // the KPI grid's "Memory Hit Rate" tile. `getByText` itself throws if
    // more than one match exists, so a successful single call IS the
    // exactly-once evidence for the surviving tile; the exact-text query
    // for the deleted card's own distinct label proves that half of the
    // duplicate is gone.
    mockQueryValues = { ...mockQueryValues, memoryPreflightStats: { hitRate: 0.82 } };
    renderBar();
    expect(screen.queryByText("Memory", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText("Memory Hit Rate")).toBeInTheDocument();
  });
});

describe("HeroStatsBar — KPI grid (unchanged by this plan)", () => {
  it("renders all eight KPI tiles across both slice ranges", () => {
    // Every underlying query needs a defined (non-loading) value: MetricCard's
    // `loading` state renders a skeleton and withholds the label text
    // entirely, so a tile still on its default `loading` state would make
    // this assertion pass or fail on animation/query timing rather than on
    // the grid's actual composition.
    mockQueryValues = {
      heroStatsSummary: {},
      memoryPreflightStats: { hitRate: 0.5 },
      dreamingRecentFacts: [{ id: "fact-1" }],
      advisorSavings: { totalSavings: 1.5 },
    };
    renderBar();
    for (const label of [
      "Sessions",
      "Error Rate",
      "Alerts",
      "Security",
      "Memory Hit Rate",
      "Durable Facts",
      "Advisor Savings",
      "Startup Time",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
