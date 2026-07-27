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

  it("shows DISCONNECTED instead of the readiness pill when disconnected", () => {
    // The Phase 186 3-column redesign (commit 565cef36) changed the
    // disconnected-state pill text from "OFFLINE" to "DISCONNECTED" --
    // "OFFLINE" now only appears in a code comment, never in rendered JSX.
    // This assertion was stale against the actual current markup.
    render(<ControlCenterPanel {...baseProps()} disconnected />);
    expect(screen.getByText("DISCONNECTED")).toBeInTheDocument();
  });

  it("shows a labeled BRAIN row falling back to Auto before any turn completes", () => {
    render(<ControlCenterPanel {...baseProps()} />);
    expect(screen.getByText("BRAIN")).toBeInTheDocument();
    // BrainControl AND VoiceControl (Plan 09: VOICE is now always visible)
    // both default to "Auto" -- assert at least one Auto label renders.
    expect(screen.getAllByText("Auto").length).toBeGreaterThanOrEqual(1);
  });

  it("shows the last completed turn's model in the BRAIN row when no override is active", () => {
    render(<ControlCenterPanel {...baseProps()} lastTurnModel="claude-sonnet-5" />);
    expect(screen.getByText("BRAIN")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-5")).toBeInTheDocument();
  });

  it("prefers an active swap override over the last completed turn's model", () => {
    render(
      <ControlCenterPanel {...baseProps()} swapModelOverride="grok-4.5" lastTurnModel="claude-sonnet-5" />
    );
    expect(screen.getByText("grok-4.5")).toBeInTheDocument();
    expect(screen.queryByText("claude-sonnet-5")).not.toBeInTheDocument();
  });

  it("VOICE row is always visible (Plan 09: browsable even at default), reflecting the active override", () => {
    const { rerender } = render(<ControlCenterPanel {...baseProps()} />);
    // Always visible now (D-17: "see what voices exist" without an active swap).
    expect(screen.getByText("VOICE")).toBeInTheDocument();

    rerender(<ControlCenterPanel {...baseProps()} swapVoiceOverride="Rachel" />);
    expect(screen.getByText("VOICE")).toBeInTheDocument();
    expect(screen.getByText("Rachel")).toBeInTheDocument();
  });

  it("renders visible text labels for the strict mode, focus mode, and screen toggles", () => {
    render(<ControlCenterPanel {...baseProps()} />);
    expect(screen.getByText("STRICT MODE")).toBeInTheDocument();
    expect(screen.getByText("FOCUS MODE")).toBeInTheDocument();
    expect(screen.getByText("SCREEN")).toBeInTheDocument();
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
