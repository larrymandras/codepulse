import { describe, test } from "vitest";

describe("archival", () => {
  describe("markStaleArchived", () => {
    test.todo("marks rows older than retention threshold as archived: true");
    test.todo("does not mark rows newer than retention threshold");
    test.todo("reads retention_days from agentConfigs table");
    test.todo("defaults to 30 days when no config exists");
    test.todo("processes events, runtime_events, llmMetrics, and toolExecutions tables");
    test.todo("limits batch to 500 rows per table per run");
  });

  describe("setRetentionDays", () => {
    test.todo("clamps input to minimum 1 day");
    test.todo("clamps input to maximum 365 days");
    test.todo("upserts retention_days in agentConfigs table");
  });
});
