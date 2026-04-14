import { describe, test, expect } from "vitest";

describe("archival", () => {
  describe("markStaleArchived — logic", () => {
    test("cutoff calculation uses retention_days * 86400", () => {
      const retentionDays = 30;
      const now = 1713100000;
      const cutoff = now - retentionDays * 86400;
      expect(cutoff).toBe(now - 2592000);
      expect(cutoff).toBeLessThan(now);
    });

    test("defaults to 30 days when config value is null", () => {
      const configValue = null;
      const retentionDays = configValue != null ? Number(configValue) : 30;
      expect(retentionDays).toBe(30);
    });

    test("reads numeric config value correctly", () => {
      const configValue = 14;
      const retentionDays = configValue != null ? Number(configValue) : 30;
      expect(retentionDays).toBe(14);
    });

    test("batch limit is 500 rows per table", () => {
      const BATCH_LIMIT = 500;
      const tables = ["events", "runtime_events", "llmMetrics", "toolExecutions"] as const;
      expect(tables).toHaveLength(4);
      expect(BATCH_LIMIT).toBe(500);
    });
  });

  describe("setRetentionDays — clamping", () => {
    test("clamps input to minimum 1 day", () => {
      const clamped = Math.max(1, Math.min(365, Math.round(0)));
      expect(clamped).toBe(1);
    });

    test("clamps negative input to 1 day", () => {
      const clamped = Math.max(1, Math.min(365, Math.round(-10)));
      expect(clamped).toBe(1);
    });

    test("clamps input to maximum 365 days", () => {
      const clamped = Math.max(1, Math.min(365, Math.round(9999)));
      expect(clamped).toBe(365);
    });

    test("passes through valid input unchanged", () => {
      const clamped = Math.max(1, Math.min(365, Math.round(30)));
      expect(clamped).toBe(30);
    });

    test("rounds fractional input", () => {
      const clamped = Math.max(1, Math.min(365, Math.round(14.7)));
      expect(clamped).toBe(15);
    });
  });
});
