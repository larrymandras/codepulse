import { describe, test } from "vitest";

describe("forecasts", () => {
  test.todo("computeMovingAverage returns correct 7-day average from daily cost rows");
  test.todo("computeMovingAverage fills missing days with zero");
  test.todo("computeMovingAverage uses 7-day window when <30 days, 14-day when >=30");
  test.todo("projectSpend returns daily, weekly, monthly projections from average");
  test.todo("classifyBudgetStatus returns 'ok' when projected < 80% of cap");
  test.todo("classifyBudgetStatus returns 'warning' when projected 80-99% of cap");
  test.todo("classifyBudgetStatus returns 'exceeded' when projected >= 100% of cap");
  test.todo("classifyBudgetStatus returns 'ok' with no budget cap set (null)");
});
