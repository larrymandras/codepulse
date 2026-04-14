import { describe, test, expect } from "vitest";
import {
  computeMovingAverage,
  projectSpend,
  classifyBudgetStatus,
} from "./forecasts";

describe("forecasts", () => {
  test("computeMovingAverage returns correct 7-day average from daily cost rows", () => {
    // 7-day window: mean of [10, 20, 30, 40, 50, 60, 70] = 280/7 = 40
    expect(computeMovingAverage([10, 20, 30, 40, 50, 60, 70], 7)).toBe(40);
  });

  test("computeMovingAverage fills missing days with zero", () => {
    // When only 4 values exist and window=7, the window IS those 4 values
    // [10, 0, 0, 20] / 4 = 7.5
    expect(computeMovingAverage([10, 0, 0, 20], 4)).toBe(7.5);
  });

  test("computeMovingAverage uses 7-day window when <30 days, 14-day when >=30", () => {
    // With 29 days available: windowSize=7, use last 7 of a 10-element array
    const values10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    // last 7: [4,5,6,7,8,9,10] => mean = 49/7 = 7
    expect(computeMovingAverage(values10, 29)).toBe(7);

    // With 30 days available: windowSize=14, use last 14 of a 20-element array
    const values20 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    // last 14: [7,8,9,10,11,12,13,14,15,16,17,18,19,20] => sum=189, mean=189/14=13.5
    expect(computeMovingAverage(values20, 30)).toBe(13.5);
  });

  test("projectSpend returns daily, weekly, monthly projections from average", () => {
    expect(projectSpend(10)).toEqual({ daily: 10, weekly: 70, monthly: 300 });
    expect(projectSpend(0)).toEqual({ daily: 0, weekly: 0, monthly: 0 });
  });

  test("classifyBudgetStatus returns 'ok' when projected < 80% of cap", () => {
    expect(classifyBudgetStatus(50, 100)).toBe("ok");
    expect(classifyBudgetStatus(79, 100)).toBe("ok");
  });

  test("classifyBudgetStatus returns 'warning' when projected 80-99% of cap", () => {
    expect(classifyBudgetStatus(85, 100)).toBe("warning");
    expect(classifyBudgetStatus(80, 100)).toBe("warning");
    expect(classifyBudgetStatus(99, 100)).toBe("warning");
  });

  test("classifyBudgetStatus returns 'exceeded' when projected >= 100% of cap", () => {
    expect(classifyBudgetStatus(105, 100)).toBe("exceeded");
    expect(classifyBudgetStatus(100, 100)).toBe("exceeded");
  });

  test("classifyBudgetStatus returns 'ok' with no budget cap set (null)", () => {
    expect(classifyBudgetStatus(50, null)).toBe("ok");
    expect(classifyBudgetStatus(9999, null)).toBe("ok");
  });
});
