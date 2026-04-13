import { describe, vi } from "vitest";

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: "connected",
    sendCommand: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: vi.fn(() => vi.fn()),
  })),
}));

describe("ConnectionPopover", () => {
  test.todo("renders CONNECTION DETAILS header"); // RT-02
  test.todo("shows Disconnected status with --status-error dot when disconnected"); // RT-02
  test.todo("shows auth error message when auth failure detected"); // RT-02, D-07
  test.todo("shows Reconnect button only when disconnected"); // D-11
  test.todo("hides Reconnect button when connected"); // D-11
  test.todo("renders URL, uptime, latency, topics, last event rows"); // D-10
});
