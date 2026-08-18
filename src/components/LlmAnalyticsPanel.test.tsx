/**
 * Tests for LlmAnalyticsPanel's Model Breakdown money column and D-11 freshness
 * label.
 *
 * CR-01 follow-up (2026-08-03, found by the phase verifier). This table used to
 * render `formatCost(row.cost)` straight from `api.llm.costByModel`, which sums
 * the RAW ingested `llmMetrics.cost` field. D-01 says that value is stored but is
 * no longer the displayed truth, and on the live instance it under-reported by
 * ~13% versus the derived figure. Calls and tokens still come from llmMetrics
 * (raw measurements are fine); only the dollar column moved to costDerived.
 *
 * Phase 121 D-07 follow-up (2026-08-18). `providerBreakdown`/`costByModel` were
 * migrated onto rollup reads and now return
 * `{ rows, asOf, expectedBuckets, presentBuckets, rowsRead, truncated }` instead
 * of a bare array / bare record. Fixtures below use the real object shape.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    llm: { providerBreakdown: "llm:providerBreakdown", costByModel: "llm:costByModel" },
    costDerived: { costBreakdown: "costDerived:costBreakdown" },
  },
}));

vi.mock("./FlexBarChart", () => ({
  FlexBarChart: () => <div data-testid="flexbar" />,
}));

vi.mock("./InfoTooltip", () => ({ default: () => null }));

import LlmAnalyticsPanel from "./LlmAnalyticsPanel";

/** Calls/tokens come from llmMetrics via the rollup; migrated shape, no `cost` field. */
const MODEL_RESULT = {
  rows: [
    { model: "claude-sonnet-5", calls: 10, tokens: 5000 },
    { model: "mystery-model", calls: 3, tokens: 700 },
  ],
  asOf: 1755000000, // arbitrary fixed epoch-seconds fixture; overridden per-test below
  expectedBuckets: 720,
  presentBuckets: 700,
  rowsRead: 2,
  truncated: false,
};

const PROVIDER_RESULT = {
  rows: [],
  asOf: 1755000000,
  expectedBuckets: 720,
  presentBuckets: 700,
  rowsRead: 0,
  truncated: false,
};

/**
 * Wires the three queries. `providerResult`/`modelResult` default to the
 * fixtures above (callers override `asOf` per test); `breakdown` is the
 * `costDerived.costBreakdown` fixture under test.
 */
function wire(
  breakdown: unknown,
  overrides: { providerResult?: unknown; modelResult?: unknown } = {}
) {
  // `?? DEFAULT` would treat an explicitly-passed `undefined` (the "still
  // loading" fixture) as "not overridden" and silently fall back to the
  // default — use `in` so an explicit undefined override is honoured.
  const providerResult = "providerResult" in overrides ? overrides.providerResult : PROVIDER_RESULT;
  const modelResult = "modelResult" in overrides ? overrides.modelResult : MODEL_RESULT;
  mockUseQuery.mockImplementation((ref: string) => {
    if (ref === "llm:providerBreakdown") return providerResult;
    if (ref === "llm:costByModel") return modelResult;
    if (ref === "costDerived:costBreakdown") return breakdown;
    return undefined;
  });
}

beforeEach(() => mockUseQuery.mockReset());

describe("LlmAnalyticsPanel — Model Breakdown money column (D-01)", () => {
  it("renders the DERIVED cost, not a legacy llmMetrics.cost value", () => {
    wire({
      rows: [
        { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 4000, completionTokens: 1000, billedUsd: 1.2345, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
      ],
      billedTotal: 1.2345, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0,
    });

    render(<LlmAnalyticsPanel />);

    // The derived figure is shown...
    expect(screen.getByText("$1.2345")).toBeInTheDocument();
    // ...and no legacy value (the migrated queries carry no `cost` field at all
    // now, so there is nothing legacy left to leak — this asserts the absence).
    expect(screen.queryByText(/99\.99/)).toBeNull();
  });

  it("sums the derived cost across providers for the same model id", () => {
    wire({
      rows: [
        { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 1000, completionTokens: 0, billedUsd: 1.0, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
        { provider: "anthropic_advisor", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 1000, completionTokens: 0, billedUsd: 0.5, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
      ],
      billedTotal: 1.5, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0,
    });

    render(<LlmAnalyticsPanel />);
    expect(screen.getByText("$1.5000")).toBeInTheDocument();
  });

  it('shows "Unpriced" for a model with no derived price — never $0.00 (D-03)', () => {
    wire({
      rows: [
        { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 4000, completionTokens: 1000, billedUsd: 1.2345, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
      ],
      billedTotal: 1.2345, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0,
    });

    render(<LlmAnalyticsPanel />);

    // "mystery-model" has calls/tokens but no row in the derived breakdown.
    expect(screen.getByText("Unpriced")).toBeInTheDocument();
    expect(screen.queryByText("$0.0000")).toBeNull();
  });

  it('renders "--" while the derivation is loading, not a fabricated $0.00', () => {
    wire(undefined);
    render(<LlmAnalyticsPanel />);
    expect(screen.queryByText("$0.0000")).toBeNull();
    expect(screen.getAllByText("--").length).toBeGreaterThan(0);
  });

  it("still shows calls and tokens from the rollup — those are raw measurements", () => {
    wire({ rows: [], billedTotal: 0, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0 });
    render(<LlmAnalyticsPanel />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5,000")).toBeInTheDocument();
  });

  it("does not import the legacy cost value into the money column at source level", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/components/LlmAnalyticsPanel.tsx"), "utf-8");
    // The regression was literally `formatCost(row.cost)`.
    expect(src).not.toMatch(/formatCost\(\s*row\.cost\s*\)/);
    expect(src).toContain("costDerived.costBreakdown");
  });
});

describe("freshness label (Phase 121 D-11)", () => {
  it("shows the OLDER of the two queries' asOf values, formatted HH:MM", () => {
    // 2026-01-15T14:03:00Z and 2026-01-15T13:47:00Z (an hour+ apart) — the
    // older (13:47 UTC) must win. Compute local HH:MM the same way the
    // component does, so the assertion is timezone-agnostic.
    const olderEpochSeconds = Math.floor(new Date("2026-01-15T13:47:00Z").getTime() / 1000);
    const newerEpochSeconds = Math.floor(new Date("2026-01-15T14:03:00Z").getTime() / 1000);
    const expectedLabel = (() => {
      const d = new Date(olderEpochSeconds * 1000);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `as of ${hh}:${mm}`;
    })();

    wire(undefined, {
      providerResult: { ...PROVIDER_RESULT, asOf: newerEpochSeconds },
      modelResult: { ...MODEL_RESULT, asOf: olderEpochSeconds },
    });

    render(<LlmAnalyticsPanel />);
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it("would render 1970 on a seconds/millis mix-up — the control for that bug", () => {
    // The panel only ever renders HH:MM, never a year, so a bare
    // `expect(...).not.toBeInTheDocument()` on the string "1970" is VACUOUS
    // here: it would pass whether or not the component gets asOf's units
    // right, because the year never reaches the DOM either way (verified:
    // this exact non-discriminating form was tried first, passed against a
    // deliberately mutated `new Date(asOf)` component, and was rejected for
    // that reason — see 121-06-SUMMARY.md deviations).
    //
    // The real control: compute the label BOTH ways — correctly
    // (`asOf * 1000`) and as a millisecond misread (`asOf` bare) — confirm
    // they differ (and that the buggy interpretation really does land in
    // 1970, proving what "1970" names), then assert the DOM shows the
    // correct one and never the buggy one.
    const asOfSeconds = Math.floor(new Date("2026-08-18T09:15:00Z").getTime() / 1000);
    const pad = (n: number) => String(n).padStart(2, "0");

    const correctDate = new Date(asOfSeconds * 1000);
    const correctLabel = `as of ${pad(correctDate.getHours())}:${pad(correctDate.getMinutes())}`;

    const buggyDate = new Date(asOfSeconds); // the seconds/millis mix-up
    const buggyLabel = `as of ${pad(buggyDate.getHours())}:${pad(buggyDate.getMinutes())}`;

    // Sanity on the control itself: if these ever collided, "does not equal
    // buggyLabel" would prove nothing.
    expect(buggyDate.getFullYear()).toBe(1970);
    expect(correctLabel).not.toBe(buggyLabel);

    wire(undefined, {
      providerResult: { ...PROVIDER_RESULT, asOf: asOfSeconds },
      modelResult: { ...MODEL_RESULT, asOf: asOfSeconds },
    });

    render(<LlmAnalyticsPanel />);
    expect(screen.getByText(correctLabel)).toBeInTheDocument();
    expect(screen.queryByText(buggyLabel)).toBeNull();
  });

  it('renders "no data yet" when asOf is null on both queries, and no HH:MM time', () => {
    wire(undefined, {
      providerResult: { ...PROVIDER_RESULT, asOf: null },
      modelResult: { ...MODEL_RESULT, asOf: null },
    });

    render(<LlmAnalyticsPanel />);
    expect(screen.getByText("no data yet")).toBeInTheDocument();
    expect(screen.queryByText(/as of \d{2}:\d{2}/)).toBeNull();
  });

  it("renders neither a time nor \"no data yet\" while both queries are still loading", () => {
    wire(undefined, {
      providerResult: undefined,
      modelResult: undefined,
    });

    render(<LlmAnalyticsPanel />);
    expect(screen.queryByText(/as of \d{2}:\d{2}/)).toBeNull();
    expect(screen.queryByText("no data yet")).toBeNull();
  });

  it("renders the chart and table normally when truncated is true (truncation is unsurfaced by design in this phase)", () => {
    wire(
      { rows: [], billedTotal: 0, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0 },
      {
        providerResult: { ...PROVIDER_RESULT, truncated: true },
        modelResult: { ...MODEL_RESULT, truncated: true },
      }
    );

    render(<LlmAnalyticsPanel />);
    // Table still renders model rows; `truncated` itself is not rendered
    // anywhere (T-121-26 — deliberately deferred to Phase 122's TOKEN-04).
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.queryByText(/truncat/i)).toBeNull();
  });
});
