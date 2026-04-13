import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLiveFlash } from "./useLiveFlash";

describe("useLiveFlash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds live-update-flash class to element ref on triggerFlash", () => {
    const { result } = renderHook(() => useLiveFlash());

    // Create a mock DOM element
    const el = document.createElement("div");
    // Assign the ref manually
    Object.defineProperty(result.current.flashRef, "current", {
      value: el,
      writable: true,
    });

    act(() => {
      result.current.triggerFlash();
    });

    expect(el.classList.contains("live-update-flash")).toBe(true);
  });

  it("removes live-update-flash class after 620ms timeout", () => {
    const { result } = renderHook(() => useLiveFlash());

    const el = document.createElement("div");
    Object.defineProperty(result.current.flashRef, "current", {
      value: el,
      writable: true,
    });

    act(() => {
      result.current.triggerFlash();
    });

    expect(el.classList.contains("live-update-flash")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(620);
    });

    expect(el.classList.contains("live-update-flash")).toBe(false);
  });

  it("debounces — does not re-flash within 1 second of previous flash", () => {
    const { result } = renderHook(() => useLiveFlash());

    const el = document.createElement("div");
    Object.defineProperty(result.current.flashRef, "current", {
      value: el,
      writable: true,
    });

    // First flash
    act(() => {
      result.current.triggerFlash();
    });
    expect(el.classList.contains("live-update-flash")).toBe(true);

    // Remove the class to simulate the animation ending
    act(() => {
      vi.advanceTimersByTime(620);
    });
    expect(el.classList.contains("live-update-flash")).toBe(false);

    // Try to flash again within 1 second (only 620ms have passed)
    act(() => {
      result.current.triggerFlash();
    });

    // Should NOT add the class (debounce still active)
    expect(el.classList.contains("live-update-flash")).toBe(false);
  });

  it("allows flash after 1 second debounce window expires", () => {
    const { result } = renderHook(() => useLiveFlash());

    const el = document.createElement("div");
    Object.defineProperty(result.current.flashRef, "current", {
      value: el,
      writable: true,
    });

    // First flash
    act(() => {
      result.current.triggerFlash();
    });
    expect(el.classList.contains("live-update-flash")).toBe(true);

    // Advance past 1 second (debounce window)
    act(() => {
      vi.advanceTimersByTime(1001);
    });
    expect(el.classList.contains("live-update-flash")).toBe(false);

    // Flash again — should work now
    act(() => {
      result.current.triggerFlash();
    });

    expect(el.classList.contains("live-update-flash")).toBe(true);
  });
});
