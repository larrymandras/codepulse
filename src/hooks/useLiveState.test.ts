import { describe, vi } from "vitest";

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: "connected",
    sendCommand: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: vi.fn(() => vi.fn()),
  })),
}));

describe("useLiveState", () => {
  test.todo("updates agentStatus when agent_status_change event received"); // RT-08
  test.todo("clears all state to null/empty when wsStatus transitions to disconnected"); // RT-04, D-05
  test.todo("clears all state when wsStatus transitions to reconnecting"); // RT-04
  test.todo("sets connectionHealth from wsStatus"); // RT-03
  test.todo("subscribes to agent_status_change event via subscribeEvent"); // RT-03
  test.todo("updates liveMetricDeltas when metric delta event received"); // RT-03
  test.todo("returns isLive=true only when connectionHealth is connected"); // RT-03
  test.todo("validates payload shape before updating state"); // T-02-01
});
