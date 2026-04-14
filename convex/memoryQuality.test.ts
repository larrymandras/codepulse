import { describe, test, expect } from "vitest";
import { computeDeduplicationRate, identifyStaleMemories } from "./memoryQuality";

describe("memoryQuality", () => {
  // computeDeduplicationRate tests
  test("computeDeduplicationRate returns 0 when no pruned events", () => {
    expect(computeDeduplicationRate(100, 0)).toBe(0);
  });

  test("computeDeduplicationRate returns correct ratio of pruned/total", () => {
    expect(computeDeduplicationRate(100, 15)).toBe(0.15);
  });

  test("computeDeduplicationRate returns 0 when totalStored is 0", () => {
    expect(computeDeduplicationRate(0, 0)).toBe(0);
  });

  // identifyStaleMemories tests
  test("identifyStaleMemories flags memories not accessed beyond threshold", () => {
    const now = Date.now() / 1000; // epoch seconds
    const thirtyOneDaysAgo = now - 31 * 86400;
    const twoDaysAgo = now - 2 * 86400;

    const events = [
      { eventType: "memory_stored", data: { memoryId: "mem-old" }, timestamp: thirtyOneDaysAgo },
      { eventType: "memory_stored", data: { memoryId: "mem-new" }, timestamp: twoDaysAgo },
    ];

    const stale = identifyStaleMemories(events, 30, now);
    expect(stale).toContain("mem-old");
    expect(stale).not.toContain("mem-new");
  });

  test("identifyStaleMemories with all recent memories returns empty array", () => {
    const now = Date.now() / 1000;
    const oneHourAgo = now - 3600;

    const events = [
      { eventType: "memory_stored", data: { memoryId: "mem-1" }, timestamp: oneHourAgo },
      { eventType: "memory_recalled", data: { memoryId: "mem-2" }, timestamp: oneHourAgo },
    ];

    const stale = identifyStaleMemories(events, 30, now);
    expect(stale).toHaveLength(0);
  });

  test("identifyStaleMemories uses most recent access timestamp per memory", () => {
    const now = Date.now() / 1000;
    const thirtyOneDaysAgo = now - 31 * 86400;
    const oneDayAgo = now - 1 * 86400;

    const events = [
      // stored 31 days ago
      { eventType: "memory_stored", data: { memoryId: "mem-X" }, timestamp: thirtyOneDaysAgo },
      // but recalled recently — should NOT be stale
      { eventType: "memory_recalled", data: { memoryId: "mem-X" }, timestamp: oneDayAgo },
    ];

    const stale = identifyStaleMemories(events, 30, now);
    expect(stale).not.toContain("mem-X");
  });

  test("identifyStaleMemories uses configurable staleness_days from agentConfigs", () => {
    const now = Date.now() / 1000;
    const sixDaysAgo = now - 6 * 86400;

    const events = [
      { eventType: "memory_stored", data: { memoryId: "mem-Y" }, timestamp: sixDaysAgo },
    ];

    // With 7-day threshold: 6 days old = not stale
    expect(identifyStaleMemories(events, 7, now)).not.toContain("mem-Y");
    // With 5-day threshold: 6 days old = stale
    expect(identifyStaleMemories(events, 5, now)).toContain("mem-Y");
  });
});
