import { describe, test } from "vitest";

describe("aggregates", () => {
  describe("computeHourly", () => {
    test.todo("writes cost aggregate rows grouped by provider+model for the last completed hour");
    test.todo("writes event count aggregate rows grouped by event_type for the last completed hour");
    test.todo("writes error rate aggregate rows grouped by error category for the last completed hour");
    test.todo("skips rows where archived === true");
    test.todo("uses bucket_start truncated to the hour boundary in epoch seconds");
  });

  describe("rollupDaily", () => {
    test.todo("sums 24 hourly aggregate rows into one daily row per metric_type+dimensions");
    test.todo("reads from aggregates table, not raw tables");
    test.todo("uses yesterday UTC midnight as dayStart");
  });

  describe("aggregate read queries", () => {
    test.todo("costByProviderAggregate returns cost grouped by provider from aggregates table");
    test.todo("errorRateTrendAggregate returns hourly error counts from aggregates table");
    test.todo("activityHeatmapAggregate returns day-hour cells from aggregates table");
  });
});
