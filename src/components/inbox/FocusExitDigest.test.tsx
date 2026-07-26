/**
 * FocusExitDigest.test.tsx — Phase 186 Plan 13 (D-07)
 *
 * Covers: exactly one toast per NEW focus_exit_digest row, dedup by row
 * _id (no re-fire on re-render with the same rows), no toast for
 * non-focus_exit_digest rows (e.g. the individual `held` items the digest
 * summarizes), and no replay of a pre-existing digest row already in the
 * stream at mount time.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useQuery } from "convex/react";
import { FocusExitDigest } from "./FocusExitDigest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: new Proxy(
    {},
    {
      get: () => new Proxy({}, { get: () => "mock-fn-ref" }),
    }
  ),
}));

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));
vi.mock("sonner", () => ({
  toast: toastMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useQuery).mockImplementation(() => []);
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const digestRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  _id: "digest-1",
  emitter: "focus_exit_digest",
  title: "Focus mode off",
  body: "While you were focused: 2 things.",
  ...overrides,
});

const heldRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  _id: "held-1",
  emitter: "watch_pulse",
  title: "Email from boss",
  body: "Held while focused.",
  itemType: "held",
  heldReason: "focus",
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("FocusExitDigest", () => {
  it("renders nothing (headless)", () => {
    const { container } = render(<FocusExitDigest />);
    expect(container.firstChild).toBeNull();
  });

  it("fires exactly one toast when a NEW focus_exit_digest row appears", () => {
    const { rerender } = render(<FocusExitDigest />);
    expect(toastMock).not.toHaveBeenCalled();

    vi.mocked(useQuery).mockImplementation(() => [digestRow()]);
    act(() => {
      rerender(<FocusExitDigest />);
    });

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      "While you were focused: 2 things.",
      expect.objectContaining({ duration: expect.any(Number) })
    );
  });

  it("does not re-fire for the same row on a subsequent re-render", () => {
    vi.mocked(useQuery).mockImplementation(() => []);
    const { rerender } = render(<FocusExitDigest />);

    vi.mocked(useQuery).mockImplementation(() => [digestRow()]);
    act(() => {
      rerender(<FocusExitDigest />);
    });
    expect(toastMock).toHaveBeenCalledTimes(1);

    // Same row re-supplied (e.g. an unrelated Convex re-render) — no second toast.
    act(() => {
      rerender(<FocusExitDigest />);
    });
    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("fires nothing for a non-focus_exit_digest row (the held items it summarizes)", () => {
    const { rerender } = render(<FocusExitDigest />);

    vi.mocked(useQuery).mockImplementation(() => [heldRow()]);
    act(() => {
      rerender(<FocusExitDigest />);
    });

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("does not replay a digest row already present at mount (no history replay on reload)", () => {
    vi.mocked(useQuery).mockImplementation(() => [digestRow()]);
    render(<FocusExitDigest />);

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("fires a second toast for a genuinely SECOND digest row (different _id)", () => {
    const { rerender } = render(<FocusExitDigest />);

    vi.mocked(useQuery).mockImplementation(() => [digestRow({ _id: "digest-1" })]);
    act(() => {
      rerender(<FocusExitDigest />);
    });
    expect(toastMock).toHaveBeenCalledTimes(1);

    vi.mocked(useQuery).mockImplementation(() => [
      digestRow({ _id: "digest-1" }),
      digestRow({ _id: "digest-2", body: "While you were focused: 1 thing." }),
    ]);
    act(() => {
      rerender(<FocusExitDigest />);
    });
    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(toastMock).toHaveBeenLastCalledWith(
      "While you were focused: 1 thing.",
      expect.objectContaining({ duration: expect.any(Number) })
    );
  });
});
