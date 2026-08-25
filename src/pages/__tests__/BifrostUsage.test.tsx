/**
 * Bifröst — link-open usage tracking, at the DOM wiring level.
 *
 * `src/pages/Bifrost.test.tsx` covers `livenessOf` as a pure function. This file
 * exists because the two defects it guards are NOT expressible as pure
 * functions: both are about which DOM events reach the handler.
 *
 *  1. Middle-click. Per the UI Events spec a `click` event fires only for the
 *     primary button; middle-button activation dispatches `auxclick`. React's
 *     `onClick` maps to `click`, so an onClick-only wiring misses every
 *     middle-click — one of the two normal ways to open a launcher link, and
 *     the one used for background tabs. A pure predicate could not catch a
 *     missing `onAuxClick` prop; only rendering and dispatching can.
 *
 *  2. Right-click must NOT count. `auxclick` covers the right button too, so
 *     the fix for (1) can over-correct into counting every context menu as a
 *     launch. That control is what keeps the fix honest.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { mockMutation } = vi.hoisted(() => ({
  mockMutation: vi.fn(() => Promise.resolve()),
}));

// The page renders no ConvexProvider, and `useRecordLinkOpen` (the real one,
// deliberately unmocked below) calls useMutation. Stub the client boundary only.
vi.mock("convex/react", () => ({
  useMutation: () => mockMutation,
  useQuery: () => undefined,
}));

const { mockToastWarning } = vi.hoisted(() => ({
  mockToastWarning: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: mockToastWarning,
  },
}));

const FIXTURE = [
  {
    _id: "l1",
    title: "Convex backend",
    url: "http://localhost:3210",
    category: "infrastructure",
    createdAt: 1_000,
  },
];

// Partial mock: the READ hooks are stubbed so the page renders without a
// backend, but `useRecordLinkOpen` is kept REAL — it is the thing under test,
// and mocking it would leave the wiring it owns completely unexercised.
vi.mock("@/hooks/useBifrostLinks", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/useBifrostLinks")
  >("@/hooks/useBifrostLinks");
  return {
    ...actual,
    useBifrostLinksState: () => ({ links: FIXTURE, isLoading: false }),
    useContainerStatusMap: () => ({}),
  };
});

import Bifrost from "@/pages/Bifrost";
import { __resetUsageFailureLatch } from "@/hooks/useBifrostLinks";

function linkAnchor() {
  return screen.getByText("http://localhost:3210").closest("a") as HTMLElement;
}

describe("Bifröst link-open usage tracking", () => {
  beforeEach(() => {
    mockMutation.mockClear();
    mockMutation.mockImplementation(() => Promise.resolve());
    mockToastWarning.mockClear();
    __resetUsageFailureLatch();
  });

  it("a normal left click records the open", () => {
    render(<Bifrost />);
    fireEvent.click(linkAnchor());
    expect(mockMutation).toHaveBeenCalledWith({ linkId: "l1" });
  });

  it("a MIDDLE click records the open", () => {
    render(<Bifrost />);
    // Dispatched as a real auxclick rather than via fireEvent.click, because
    // the whole defect is that a middle button never produces a `click` at all.
    fireEvent(
      linkAnchor(),
      new MouseEvent("auxclick", { bubbles: true, button: 1 })
    );
    expect(mockMutation).toHaveBeenCalledWith({ linkId: "l1" });
  });

  it("a RIGHT click records nothing — a context menu is not a launch", () => {
    render(<Bifrost />);
    fireEvent(
      linkAnchor(),
      new MouseEvent("auxclick", { bubbles: true, button: 2 })
    );
    expect(mockMutation).not.toHaveBeenCalled();
  });

  it("onClick alone would not have caught the middle click", () => {
    // The control for the control: proves `auxclick` and `click` really are
    // distinct events in this environment, so the middle-click test above is
    // measuring the onAuxClick wiring and not just re-testing onClick.
    const seen: string[] = [];
    const el = document.createElement("a");
    el.addEventListener("click", () => seen.push("click"));
    document.body.appendChild(el);
    el.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(seen).toEqual([]);
    document.body.removeChild(el);
  });
});

describe("Bifröst usage-write failures are observable", () => {
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockMutation.mockClear();
    // mockClear() resets CALLS but not the IMPLEMENTATION — without this line
    // the rejection set by an earlier case leaks into the success case below
    // and it fails for the wrong reason.
    mockMutation.mockImplementation(() => Promise.resolve());
    mockToastWarning.mockClear();
    __resetUsageFailureLatch();
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errSpy.mockRestore());

  it("a rejected write is logged, not swallowed", async () => {
    mockMutation.mockImplementation(() => Promise.reject(new Error("boom")));
    render(<Bifrost />);
    fireEvent.click(linkAnchor());
    await vi.waitFor(() => expect(errSpy).toHaveBeenCalled());
    expect(String(errSpy.mock.calls[0][0])).toContain("usage write failed");
  });

  it("a persistent failure warns ONCE, not once per click", async () => {
    mockMutation.mockImplementation(() => Promise.reject(new Error("boom")));
    render(<Bifrost />);
    const a = linkAnchor();
    fireEvent.click(a);
    fireEvent.click(a);
    fireEvent.click(a);
    await vi.waitFor(() => expect(mockToastWarning).toHaveBeenCalled());
    expect(mockToastWarning).toHaveBeenCalledTimes(1);
    // Control: every one of the three failures still reached the log, so the
    // single toast is deduplication and not three swallowed errors.
    expect(errSpy).toHaveBeenCalledTimes(3);
  });

  it("a successful write neither logs nor warns", async () => {
    render(<Bifrost />);
    fireEvent.click(linkAnchor());
    await Promise.resolve();
    expect(errSpy).not.toHaveBeenCalled();
    expect(mockToastWarning).not.toHaveBeenCalled();
  });
});
