import { describe, it, expect } from "vitest";

describe("agentMetrics", () => {
  describe("insertMetric", () => {
    it.todo("should insert a metric record with all required fields");
    it.todo("should accept optional responseTimeMs and modelUsed fields");
  });

  describe("forAgent", () => {
    it.todo("should return metrics for a specific agent within the time window");
    it.todo("should return empty array when no metrics exist for agent");
    it.todo("should order results by timestamp ascending");
  });
});
