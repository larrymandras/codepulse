import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useQuery } from "convex/react";
import { classifyCapStatus, projectDayEndSpend } from "./SDKSpendGuard";
import { useCostBudget } from "../hooks/useCostBudgets";
import SDKSpendGuard from "./SDKSpendGuard";

// D-12: the budget row now comes from convex/costBudgets via useCostBudget,
// not a hardcoded module constant — mock the hook directly rather than
// convex/react's useQuery a second time.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../hooks/useCostBudgets", () => ({
  useCostBudget: vi.fn(),
}));

const MOCK_THEME = {
  statusOk: "rgb(10,20,30)",
  statusWarn: "rgb(40,50,60)",
  statusError: "rgb(70,80,90)",
};
vi.mock("../hooks/useThemeColors", () => ({
  useThemeColors: () => MOCK_THEME,
}));

// Sparkline's SVG stroke can't be asserted meaningfully from jsdom geometry
// (UI constraints: assert on the prop, not rendered SVG geometry) — mock it
// to a testid div exposing the `color` prop it was actually called with.
vi.mock("./Sparkline", () => ({
  default: ({ color, data }: { color: string; data: number[] }) => (
    <div data-testid="sparkline" data-color={color} data-points={data.length} />
  ),
}));

function renderGuard() {
  return render(
    <MemoryRouter>
      <SDKSpendGuard />
    </MemoryRouter>
  );
}

const CONFIGURED_BUDGET = {
  _id: "budget_1" as never,
  scope: "global" as const,
  scopeKey: "",
  period: "daily" as const,
  limit: 12,
  warnFraction: 0.5,
  unit: "usd" as const,
  enabled: true,
  createdAt: 0,
  updatedAt: 0,
};

describe("SDKSpendGuard", () => {
  describe("classifyCapStatus (regression)", () => {
    it("returns 'ok' when spend is well under threshold", () => {
      expect(classifyCapStatus(2.00, 5.00, 0.8)).toBe("ok");
    });
    it("returns 'warning' at exactly 80% ($4 of $5)", () => {
      expect(classifyCapStatus(4.00, 5.00, 0.8)).toBe("warning");
    });
    it("returns 'exceeded' at exactly the cap", () => {
      expect(classifyCapStatus(5.00, 5.00, 0.8)).toBe("exceeded");
    });
  });

  describe("projectDayEndSpend", () => {
    it("returns projected total based on elapsed hours, current spend and the passed cap", () => {
      const result = projectDayEndSpend(2.50, 12, 5);
      expect(result.projectedTotal).toBe(5.00);
      expect(result.willExceedCap).toBe(false);
    });

    it("returns 0 when elapsedHours is 0", () => {
      const result = projectDayEndSpend(2.50, 0, 5);
      expect(result.projectedTotal).toBe(0);
      expect(result.willExceedCap).toBe(false);
      expect(result.projectedHitTime).toBeNull();
    });

    it("flags willExceedCap against the CALLER-SUPPLIED cap, not a fixed value", () => {
      // projectedTotal is $9.00 for both — only the cap differs.
      const lowCap = projectDayEndSpend(3.00, 8, 5);
      expect(lowCap.projectedTotal).toBe(9.00);
      expect(lowCap.willExceedCap).toBe(true);

      const highCap = projectDayEndSpend(3.00, 8, 20);
      expect(highCap.projectedTotal).toBe(9.00);
      // A reintroduced module-level DAILY_CAP=5 would make this also flip
      // to true; passing 20 here would then wrongly report willExceedCap.
      expect(highCap.willExceedCap).toBe(false);
    });
  });

  describe("rendering", () => {
    const dayStart = Math.floor(Date.now() / 1000 / 86400) * 86400;
    // CR-01: the gauge now reads api.costDerived.billedOverTime, whose shape is
    // { buckets: [{ bucket_start, billedUsd }], unpricedTokens } -- derived from
    // tokens x live rates rather than the legacy pre-baked "cost" aggregate.
    const buckets = {
      buckets: [
        { bucket_start: dayStart + 3600, billedUsd: 1.5 },
        { bucket_start: dayStart + 7200, billedUsd: 1.5 },
      ],
      unpricedTokens: 0,
    };

    it("renders the loading skeleton while the budget query is undefined", () => {
      vi.mocked(useQuery).mockReturnValue(buckets);
      vi.mocked(useCostBudget).mockReturnValue(undefined);
      const { container } = renderGuard();
      expect(container.querySelector(".animate-pulse")).not.toBeNull();
      expect(screen.queryByTestId("sparkline")).toBeNull();
    });

    it("renders the loading skeleton while the aggregates query is undefined", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      vi.mocked(useCostBudget).mockReturnValue(null);
      const { container } = renderGuard();
      expect(container.querySelector(".animate-pulse")).not.toBeNull();
    });

    it("renders an honest no-budget state — no gauge bar, no percentage, no $5 anywhere", () => {
      vi.mocked(useQuery).mockReturnValue(buckets);
      vi.mocked(useCostBudget).mockReturnValue(null);
      renderGuard();

      expect(screen.getByText(/No daily budget set/)).toBeInTheDocument();
      expect(screen.queryByText(/Cap Reached|Near Limit|On Track/)).toBeNull();
      expect(document.body.textContent).not.toContain("$5");
      // sparkline (and today's spend figure) still render honestly
      expect(screen.getByTestId("sparkline")).toBeInTheDocument();
    });

    it("classifies against the configured budget's limit and warnFraction, not 5/0.8", () => {
      vi.mocked(useQuery).mockReturnValue(buckets);
      vi.mocked(useCostBudget).mockReturnValue(CONFIGURED_BUDGET);
      renderGuard();

      // today's spend = 1.5 + 1.5 = $3.00, of a $12.0000 cap (not $5.0000)
      expect(screen.getByText(/of \$12\.0000 today/)).toBeInTheDocument();
      // $3.00 is under 50% of $12 (warnFraction 0.5) => "ok" => "On Track"
      expect(screen.getByText("On Track")).toBeInTheDocument();
    });

    it("passes the theme's statusOk color to the sparkline for an ok status", () => {
      vi.mocked(useQuery).mockReturnValue(buckets);
      vi.mocked(useCostBudget).mockReturnValue(CONFIGURED_BUDGET);
      renderGuard();

      expect(screen.getByTestId("sparkline").getAttribute("data-color")).toBe(MOCK_THEME.statusOk);
    });
  });
});
