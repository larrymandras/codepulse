import { describe, it, expect } from "vitest";
import { eventTypeToHue, HUE_TOKEN, type EventHue } from "./eventHue";
import { TOPIC_EVENT_MAP } from "../contexts/AstridrWSContext";

/**
 * D-06 parity guard: asserts eventTypeToHue against the LIVE TOPIC_EVENT_MAP
 * (imported, not transcribed), so a new Ástríðr event type added to that map
 * cannot silently go uncoloured. See this plan's SUMMARY for the mutation
 * proof (temporarily swallowing `run.error` into the `run.` prefix rule,
 * confirming case (b) goes RED, then reverting).
 */

const VALID_HUES: EventHue[] = ["astridr", "machine", "error"];

describe("eventTypeToHue (D-06)", () => {
  it("(a) every event type in every topic set of the live TOPIC_EVENT_MAP resolves to a valid hue and none throw", () => {
    for (const [topic, events] of Object.entries(TOPIC_EVENT_MAP)) {
      for (const eventType of events) {
        let hue: EventHue | undefined;
        expect(() => {
          hue = eventTypeToHue(eventType);
        }, `topic "${topic}", eventType "${eventType}" threw`).not.toThrow();
        expect(VALID_HUES, `topic "${topic}", eventType "${eventType}" resolved to "${hue}"`).toContain(hue);
      }
    }
  });

  it("(b) the live-runs set resolves entirely to astridr EXCEPT run.error, which resolves to error", () => {
    const liveRuns = TOPIC_EVENT_MAP["live-runs"];
    expect(liveRuns, "live-runs topic must exist in the live map for this test to assert anything").toBeDefined();
    expect(liveRuns.has("run.error"), "run.error must be a live-runs member for this test to assert anything").toBe(
      true,
    );

    for (const eventType of liveRuns) {
      if (eventType === "run.error") {
        expect(eventTypeToHue(eventType), `${eventType} must be error, not astridr`).toBe("error");
      } else {
        expect(eventTypeToHue(eventType), `${eventType} must be astridr`).toBe("astridr");
      }
    }
  });

  it("(c) the executions and health sets resolve entirely to machine", () => {
    for (const topic of ["executions", "health"]) {
      const events = TOPIC_EVENT_MAP[topic];
      expect(events, `${topic} topic must exist in the live map for this test to assert anything`).toBeDefined();
      expect(events.size, `${topic} topic must be non-empty for this test to assert anything`).toBeGreaterThan(0);
      for (const eventType of events) {
        expect(eventTypeToHue(eventType), `${topic}'s ${eventType} must be machine`).toBe("machine");
      }
    }
  });

  it("(d) unrecognised event types resolve to machine, never astridr", () => {
    for (const eventType of ["totally.unknown.type", "astridr", ""]) {
      const hue = eventTypeToHue(eventType);
      expect(hue, `"${eventType}" must not resolve to astridr`).not.toBe("astridr");
      expect(hue, `"${eventType}" must resolve to machine`).toBe("machine");
    }
  });

  it("(e) HUE_TOKEN values are all var(--token) references, never a hex", () => {
    for (const hue of VALID_HUES) {
      expect(HUE_TOKEN[hue]).toMatch(/^var\(--[a-z-]+\)$/);
    }
  });
});
