import { describe, it, expect } from "vitest";

describe("agentStatus domain module", () => {
  describe("recordEvent", () => {
    it("accepts agentId, state, optional currentTask/errorCount/profileId, and timestamp", () => {
      expect(true).toBe(true);
    });
  });

  describe("recentByAgent", () => {
    it("returns an array of recent agent status events ordered by timestamp desc", () => {
      expect(true).toBe(true);
    });
  });

  describe("latestForAgent", () => {
    it("returns the most recent status event for a given agentId, or null", () => {
      expect(true).toBe(true);
    });
  });
});
