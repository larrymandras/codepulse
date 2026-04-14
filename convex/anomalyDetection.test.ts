import { describe, test } from "vitest";

describe("anomalyDetection", () => {
  test.todo("computeZScore returns 0 when stdDev is 0");
  test.todo("computeZScore returns correct z-score for known values");
  test.todo("detectAnomalies flags value at 2sigma as warning");
  test.todo("detectAnomalies flags value at 3sigma as critical");
  test.todo("detectAnomalies does not flag value within 2sigma");
  test.todo("evaluateInternal creates alert for critical anomaly via api.alerts.create");
  test.todo("evaluateInternal creates anomalyEvents row with correct fields");
});
