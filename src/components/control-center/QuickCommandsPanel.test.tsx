import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickCommandsPanel } from "./QuickCommandsPanel";
import type { ScreenShareState } from "@/hooks/useScreenShare";

interface Props {
  strictMode: boolean;
  onStrictModeChange: (v: boolean) => void;
  focusMode: boolean;
  onFocusModeChange: (v: boolean) => void;
  screenShareState: ScreenShareState;
  onScreenShareStart: () => unknown;
  onScreenShareStop: () => void;
  onStop: () => void;
}

function renderPanel(overrides: Partial<Props> = {}) {
  const props: Props = {
    strictMode: false,
    onStrictModeChange: vi.fn(),
    focusMode: false,
    onFocusModeChange: vi.fn(),
    screenShareState: "idle",
    onScreenShareStart: vi.fn(),
    onScreenShareStop: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  };
  render(<QuickCommandsPanel {...props} />);
  return props;
}

describe("QuickCommandsPanel", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the panel chrome and all four locked labels", () => {
    renderPanel();
    expect(screen.getByText("QUICK COMMANDS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Strict Mode/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Focus Mode/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Share Screen/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop/ })).toBeInTheDocument();
  });

  it("calls onStrictModeChange with the flipped value when Strict Mode is clicked", () => {
    const props = renderPanel({ strictMode: false });
    fireEvent.click(screen.getByRole("button", { name: /Strict Mode/ }));
    expect(props.onStrictModeChange).toHaveBeenCalledTimes(1);
    expect(props.onStrictModeChange).toHaveBeenCalledWith(true);
  });

  it("calls onFocusModeChange with the flipped value when Focus Mode is clicked", () => {
    const props = renderPanel({ focusMode: true });
    fireEvent.click(screen.getByRole("button", { name: /Focus Mode/ }));
    expect(props.onFocusModeChange).toHaveBeenCalledTimes(1);
    expect(props.onFocusModeChange).toHaveBeenCalledWith(false);
  });

  it("calls onScreenShareStart (not stop) when idle and Share Screen is clicked", () => {
    const props = renderPanel({ screenShareState: "idle" });
    fireEvent.click(screen.getByRole("button", { name: /Share Screen/ }));
    expect(props.onScreenShareStart).toHaveBeenCalledTimes(1);
    expect(props.onScreenShareStop).not.toHaveBeenCalled();
  });

  it("calls onScreenShareStop (not start) when active and Share Screen is clicked", () => {
    const props = renderPanel({ screenShareState: "active" });
    fireEvent.click(screen.getByRole("button", { name: /Share Screen/ }));
    expect(props.onScreenShareStop).toHaveBeenCalledTimes(1);
    expect(props.onScreenShareStart).not.toHaveBeenCalled();
  });

  it("calls onStop directly, with no confirmation dialog, when Stop is clicked", () => {
    const props = renderPanel();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }));
    expect(props.onStop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reflects strictMode and focusMode via aria-pressed", () => {
    renderPanel({ strictMode: true, focusMode: false });
    expect(screen.getByRole("button", { name: /Strict Mode/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /Focus Mode/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("never attempts a network call from any button click (no parallel command path)", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Strict Mode/ }));
    fireEvent.click(screen.getByRole("button", { name: /Focus Mode/ }));
    fireEvent.click(screen.getByRole("button", { name: /Share Screen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
