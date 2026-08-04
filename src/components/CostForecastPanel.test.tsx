import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery } from "convex/react";
import CostForecastPanel from "./CostForecastPanel";

// D-19: CostForecastPanel's data now comes from costForecast's rewired
// costBudgets-sourced fields (budgetCap/budgetStatus), mocked directly here.
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

function renderPanel() {
  return render(
    <MemoryRouter>
      <CostForecastPanel />
    </MemoryRouter>
  );
}

const BASE_DATA = {
  projectedDaily: 10,
  projectedWeekly: 70,
  projectedMonthly: 300,
  currentMonthSpend: 90,
  dailyHistory: [
    { date: "2026-07-25", value: 10 },
    { date: "2026-07-26", value: 12 },
  ],
  insufficientData: false,
};

describe("CostForecastPanel", () => {
  it("renders the loading state while the query is undefined", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    renderPanel();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders the progress bar and a status label when a monthly budget is configured", () => {
    vi.mocked(useQuery).mockReturnValue({
      ...BASE_DATA,
      budgetCap: 120,
      warnFraction: 0.8,
      budgetStatus: "warning",
    });
    renderPanel();

    expect(screen.getByText("Near limit")).toBeInTheDocument();
    expect(screen.getByText(/\$90\.0000 \/ \$120\.0000/)).toBeInTheDocument();
    expect(screen.queryByText(/No monthly budget set/)).toBeNull();
  });

  it("renders no progress bar or status label when budgetCap is null, and never shows a fabricated $0.00 cap", () => {
    vi.mocked(useQuery).mockReturnValue({
      ...BASE_DATA,
      budgetCap: null,
      warnFraction: 0.8,
      budgetStatus: "ok",
    });
    renderPanel();

    expect(screen.getByText(/No monthly budget set/)).toBeInTheDocument();
    expect(screen.queryByText("On track")).toBeNull();
    expect(screen.queryByText("Near limit")).toBeNull();
    expect(screen.queryByText("Over budget")).toBeNull();
    expect(document.body.textContent).not.toContain("$0.00");
    expect(document.body.textContent).not.toContain("$0.0000");
  });
});
