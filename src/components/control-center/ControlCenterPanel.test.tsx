import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import * as jsYaml from "js-yaml";

const mockSendCommand = vi.fn();
const mockSubscribeEvent = vi.fn(() => vi.fn());

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: mockSubscribeEvent,
    reconnect: vi.fn(),
  })),
}));

import {
  ControlCenterPanel,
  isWithinQuietHours,
  DEFAULT_PROACTIVE_PREFS,
  type ProactivePrefs,
} from "./ControlCenterPanel";

function configGetAck(prefs: Partial<ProactivePrefs>) {
  const merged = { ...DEFAULT_PROACTIVE_PREFS, ...prefs };
  return {
    type: "ack" as const,
    request_id: "r1",
    status: "ok" as const,
    section: "proactive-prefs",
    content: jsYaml.dump(merged),
  };
}

function baseProps() {
  return {
    disconnected: false,
    voiceState: "idle" as const,
    strictMode: false,
    onStrictModeChange: vi.fn(),
    screenShareState: "idle" as const,
    onScreenShareStart: vi.fn(),
    onScreenShareStop: vi.fn(),
    swapModelOverride: null,
    swapVoiceOverride: null,
    lastTurnModel: null,
  };
}

describe("ControlCenterPanel", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockSubscribeEvent.mockReset();
    mockSubscribeEvent.mockImplementation(() => vi.fn());
    localStorage.clear();

    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "readiness.get") {
        return { type: "ack", request_id: "r1", status: "ok", ready: true };
      }
      if (cmd.type === "config.get" && cmd.section === "proactive-prefs") {
        return configGetAck({});
      }
      if (cmd.type === "config.update") {
        return { type: "ack", request_id: "r1", status: "ok", section: cmd.section };
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });
  });

  it("persists focus mode via config.update with section proactive-prefs", async () => {
    render(<ControlCenterPanel {...baseProps()} />);

    // Wait for the mount-time config.get hydration to settle.
    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith(
        expect.objectContaining({ type: "config.get", section: "proactive-prefs" })
      )
    );

    const toggle = await screen.findByRole("switch", { name: "Enable focus mode" });
    await act(async () => {
      fireEvent.click(toggle);
    });

    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "config.update",
          section: "proactive-prefs",
          changes: { focus_mode: true },
        })
      )
    );
  });

  it("renders QUIET HOURS only when the hydrated window is active", async () => {
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "readiness.get") {
        return { type: "ack", request_id: "r1", status: "ok", ready: true };
      }
      if (cmd.type === "config.get" && cmd.section === "proactive-prefs") {
        return configGetAck({ quiet_hours_override: true });
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<ControlCenterPanel {...baseProps()} />);

    expect(await screen.findByText("QUIET HOURS")).toBeInTheDocument();
  });

  it("does not render QUIET HOURS when the hydrated window is inactive", async () => {
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "readiness.get") {
        return { type: "ack", request_id: "r1", status: "ok", ready: true };
      }
      if (cmd.type === "config.get" && cmd.section === "proactive-prefs") {
        return configGetAck({ quiet_hours_override: false });
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<ControlCenterPanel {...baseProps()} />);

    await waitFor(() =>
      expect(mockSendCommand).toHaveBeenCalledWith(
        expect.objectContaining({ type: "config.get", section: "proactive-prefs" })
      )
    );
    expect(screen.queryByText("QUIET HOURS")).not.toBeInTheDocument();
  });

  it("shows OFFLINE instead of the readiness pill when disconnected", () => {
    render(<ControlCenterPanel {...baseProps()} disconnected />);
    expect(screen.getByText("OFFLINE")).toBeInTheDocument();
  });
});

describe("isWithinQuietHours", () => {
  it("returns true for a same-day window that contains now", () => {
    const now = new Date(2026, 0, 1, 12, 0);
    const prefs: ProactivePrefs = {
      ...DEFAULT_PROACTIVE_PREFS,
      quiet_hours_start: "09:00",
      quiet_hours_end: "17:00",
    };
    expect(isWithinQuietHours(prefs, now)).toBe(true);
  });

  it("returns false for a same-day window that does not contain now", () => {
    const now = new Date(2026, 0, 1, 20, 0);
    const prefs: ProactivePrefs = {
      ...DEFAULT_PROACTIVE_PREFS,
      quiet_hours_start: "09:00",
      quiet_hours_end: "17:00",
    };
    expect(isWithinQuietHours(prefs, now)).toBe(false);
  });

  it("handles an overnight window (22:00 -> 06:00) that wraps midnight", () => {
    const prefs: ProactivePrefs = {
      ...DEFAULT_PROACTIVE_PREFS,
      quiet_hours_start: "22:00",
      quiet_hours_end: "06:00",
    };
    expect(isWithinQuietHours(prefs, new Date(2026, 0, 1, 23, 0))).toBe(true);
    expect(isWithinQuietHours(prefs, new Date(2026, 0, 1, 3, 0))).toBe(true);
    expect(isWithinQuietHours(prefs, new Date(2026, 0, 1, 12, 0))).toBe(false);
  });

  it("lets an explicit override win outright over the clock window", () => {
    const prefs: ProactivePrefs = {
      ...DEFAULT_PROACTIVE_PREFS,
      quiet_hours_start: "09:00",
      quiet_hours_end: "17:00",
      quiet_hours_override: true,
    };
    expect(isWithinQuietHours(prefs, new Date(2026, 0, 1, 20, 0))).toBe(true);

    const prefsOff: ProactivePrefs = { ...prefs, quiet_hours_override: false };
    expect(isWithinQuietHours(prefsOff, new Date(2026, 0, 1, 12, 0))).toBe(false);
  });
});
