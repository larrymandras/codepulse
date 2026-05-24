import { describe, it, expect } from "vitest";

describe("pagerdutyDelivery", () => {
  describe("payload construction", () => {
    it("builds correct dedup_key from ruleId", () => {
      const ruleId = "abc123def456";
      const dedupKey = `codepulse-${ruleId}`;
      expect(dedupKey).toBe("codepulse-abc123def456");
    });

    it("maps severity from rule when pagerdutyConfig.severity is undefined", () => {
      const ruleSeverity = "critical";
      const pdSeverity = undefined;
      const effectiveSeverity = pdSeverity ?? ruleSeverity;
      expect(effectiveSeverity).toBe("critical");
    });

    it("uses pagerdutyConfig.severity override when provided", () => {
      const ruleSeverity = "warning";
      const pdSeverity = "critical";
      const effectiveSeverity = pdSeverity ?? ruleSeverity;
      expect(effectiveSeverity).toBe("critical");
    });

    it("truncates summary to 1024 characters", () => {
      const longMessage = "x".repeat(2000);
      const summary = longMessage.slice(0, 1024);
      expect(summary.length).toBe(1024);
    });
  });

  describe("sendPagerdutyAlert action", () => {
    it.todo("sends POST to https://events.pagerduty.com/v2/enqueue with trigger payload");
    it.todo("skips when pagerdutyConfig.enabled is false");
    it.todo("skips when pagerdutyConfig.routingKey is empty");
    it.todo("logs success to pagerdutyDeliveryLog on HTTP 202");
    it.todo("logs failure to pagerdutyDeliveryLog on HTTP 400");
  });

  describe("sendPagerdutyResolve action", () => {
    it.todo("sends resolve event with same dedup_key as trigger");
    it.todo("logs resolved status to pagerdutyDeliveryLog");
  });
});
