import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { WSStatus } from "@/contexts/AstridrWSContext";

// Mutable state for controlling mock behavior across tests
let mockStatus: WSStatus = "connected";
const eventCallbacks: Map<string, ((msg: Record<string, unknown>) => void)[]> = new Map();

const mockSubscribeEvent = vi.fn((eventType: string, cb: (msg: Record<string, unknown>) => void) => {
  if (!eventCallbacks.has(eventType)) eventCallbacks.set(eventType, []);
  eventCallbacks.get(eventType)!.push(cb);
  return () => {
    const arr = eventCallbacks.get(eventType);
    if (arr) {
      const idx = arr.indexOf(cb);
      if (idx !== -1) arr.splice(idx, 1);
    }
  };
});

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: mockStatus,
    sendCommand: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: mockSubscribeEvent,
    reconnect: vi.fn(),
  })),
}));

// Helper: fire a registered event callback
function fireEvent(eventType: string, msg: Record<string, unknown>) {
  const cbs = eventCallbacks.get(eventType) ?? [];
  for (const cb of cbs) cb(msg);
}

import { useLiveState } from "./useLiveState";
import { useAstridrWS } from "@/contexts/AstridrWSContext";

describe("useLiveState", () => {
  beforeEach(() => {
    mockStatus = "connected";
    eventCallbacks.clear();
    mockSubscribeEvent.mockClear();
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    }));
  });

  it("returns initial state with all null/empty values and connectionHealth matching wsStatus", () => {
    const { result } = renderHook(() => useLiveState({ topics: ["agents"] }));
    expect(result.current.state.agentStatus).toBeNull();
    expect(result.current.state.activeRunId).toBeNull();
    expect(result.current.state.activeRunProgress).toBeNull();
    expect(result.current.state.liveMetricDeltas).toEqual({});
    expect(result.current.state.connectionHealth).toBe("connected");
  });

  it("clears all state to null/empty when wsStatus transitions to disconnected", () => {
    mockStatus = "connected";
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    }));

    const { result, rerender } = renderHook(() => useLiveState({ topics: ["agents"] }));

    // First set some state via an event
    act(() => {
      fireEvent("agent_status_change", { data: { status: "running" } });
    });
    expect(result.current.state.agentStatus).toBe("running");

    // Now simulate disconnect
    mockStatus = "disconnected";
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    }));

    rerender();

    expect(result.current.state.agentStatus).toBeNull();
    expect(result.current.state.activeRunId).toBeNull();
    expect(result.current.state.activeRunProgress).toBeNull();
    expect(result.current.state.liveMetricDeltas).toEqual({});
    expect(result.current.state.connectionHealth).toBe("disconnected");
  });

  it("clears all state when wsStatus transitions to reconnecting", () => {
    mockStatus = "connected";
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    }));

    const { result, rerender } = renderHook(() => useLiveState({ topics: ["agents"] }));

    act(() => {
      fireEvent("agent_status_change", { data: { status: "running" } });
    });
    expect(result.current.state.agentStatus).toBe("running");

    mockStatus = "reconnecting";
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    }));

    rerender();

    expect(result.current.state.agentStatus).toBeNull();
    expect(result.current.state.connectionHealth).toBe("reconnecting");
  });

  it("updates agentStatus when agent_status_change event fires with valid payload", () => {
    const { result } = renderHook(() => useLiveState({ topics: ["agents"] }));

    act(() => {
      fireEvent("agent_status_change", { data: { status: "running" } });
    });

    expect(result.current.state.agentStatus).toBe("running");
  });

  it("does NOT update state when agent_status_change fires with malformed payload (missing status)", () => {
    const { result } = renderHook(() => useLiveState({ topics: ["agents"] }));

    act(() => {
      fireEvent("agent_status_change", { data: {} });
    });

    expect(result.current.state.agentStatus).toBeNull();
  });

  it("returns isLive=true only when connectionHealth is connected", () => {
    const { result } = renderHook(() => useLiveState({ topics: ["agents"] }));
    expect(result.current.isLive).toBe(true);

    mockStatus = "disconnected";
    (useAstridrWS as Mock).mockImplementation(() => ({
      status: mockStatus,
      sendCommand: vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
      subscribeEvent: mockSubscribeEvent,
      reconnect: vi.fn(),
    }));

    const { result: result2 } = renderHook(() => useLiveState({ topics: ["agents"] }));
    expect(result2.current.isLive).toBe(false);
  });

  it("updates liveMetricDeltas when metric_delta event fires with valid payload", () => {
    const { result } = renderHook(() => useLiveState({ topics: ["health"] }));

    act(() => {
      fireEvent("metric_delta", { data: { key: "cpu_pct", value: 42 } });
    });

    expect(result.current.state.liveMetricDeltas).toEqual({ cpu_pct: 42 });
  });

  it("does not subscribe to agent_status_change when topics does not include agents", () => {
    renderHook(() => useLiveState({ topics: ["health"] }));

    // subscribeEvent should not have been called with "agent_status_change"
    const agentSubCall = mockSubscribeEvent.mock.calls.find(
      ([eventType]) => eventType === "agent_status_change"
    );
    expect(agentSubCall).toBeUndefined();
  });
});
