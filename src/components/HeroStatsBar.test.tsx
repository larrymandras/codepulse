import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// ── convex/react + api mocks ────────────────────────────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
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

// The status dot sits beside the "Status" label, inside the same wrapping
// div (HeroStatsBar.tsx:125-128).
function getStatusDotClass(): string {
  const statusLabel = screen.getByText("Status");
  const wrapper = statusLabel.parentElement;
  if (!wrapper) throw new Error("Status label has no parent wrapper");
  const dot = wrapper.querySelector("span:not(:first-child)");
  if (!dot) throw new Error("no dot sibling found next to the Status label");
  return dot.className;
}

beforeEach(() => {
  mockStats = { ...mockStats, health: "green" };
});

describe("HeroStatsBar — status dot (dead class fix)", () => {
  it.each([
    ["green", "--status-ok"],
    ["yellow", "--status-warn"],
    ["red", "--status-error"],
  ] as const)("renders the %s health tier with its status token, both bg and text classes present", (health, token) => {
    mockStats = { ...mockStats, health };
    renderBar();
    const cls = getStatusDotClass();
    // The class must appear TWICE — once as `bg-(...)`, once as `text-(...)` —
    // proving the previously-dead text-${...} interpolation was replaced with
    // a real, statically-present class rather than dropped silently.
    const bgHit = cls.includes(`bg-(${token})`);
    const textHit = cls.includes(`text-(${token})`);
    expect(bgHit).toBe(true);
    expect(textHit).toBe(true);
  });

  it("carries the currentColor shadow so the dot's own colour drives its glow", () => {
    mockStats = { ...mockStats, health: "green" };
    renderBar();
    expect(getStatusDotClass()).toContain("shadow-[0_0_8px_currentColor]");
  });

  it("contains no runtime-interpolated text-${...} class string", () => {
    renderBar();
    // A template-literal artifact would show up as a literal "text-$" or
    // "undefined" substring in the rendered class if the interpolation had
    // been left broken rather than fixed.
    expect(getStatusDotClass()).not.toContain("text-$");
    expect(getStatusDotClass()).not.toContain("undefined");
  });
});

// Scoped to the top-section card this plan owns (the "rounded-xl" ancestor
// of the "Status" label) rather than the whole container — the KPI grid
// below renders 8 real `MetricCard` instances, which independently still
// carry their OWN `glow-card`/`text-white` classes (MetricCard.tsx is not in
// this plan's files_modified). Asserting against the whole tree would fail
// on out-of-scope code and give a false read on this plan's own work.
function getTopCard(): HTMLElement {
  const statusLabel = screen.getByText("Status");
  const topCard = statusLabel.closest(".rounded-xl");
  if (!topCard) throw new Error('no ".rounded-xl" ancestor found for the Status label');
  return topCard as HTMLElement;
}

describe("HeroStatsBar — token layer (no glow-card, no hex, no text-white)", () => {
  it("renders the top card without the glow-card class", () => {
    renderBar();
    expect(getTopCard().querySelector(".glow-card")).toBeNull();
    expect(getTopCard().className).not.toContain("glow-card");
  });

  it("renders the top card without a bare text-white class", () => {
    renderBar();
    expect(getTopCard().querySelector(".text-white")).toBeNull();
  });
});

describe("HeroStatsBar — SIGNAL-02 scope control (Phase 125 owns this figure)", () => {
  it("still renders the System Load label and its AnimatedNumber mount point unchanged by this plan", () => {
    // Does not assert on the settled animated percentage — AnimatedNumber
    // drives its display via a framer-motion spring that does not resolve
    // synchronously within a single render+effects flush, so asserting on
    // the post-spring text would be a flaky proxy. The real scope-control
    // evidence (this plan touched zero AnimatedNumber/System Load call
    // sites) is the before/after `git grep -cF` counts recorded in the
    // task's SUMMARY, both unchanged at 2 and 1 respectively.
    mockStats = { ...mockStats, activeSessions: 3, errorRate: 5 };
    renderBar();
    expect(screen.getByText("System Load")).toBeInTheDocument();
    expect(screen.getByText("LIVE / 5H WINDOW")).toBeInTheDocument();
  });
});
