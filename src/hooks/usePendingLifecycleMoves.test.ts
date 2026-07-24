/**
 * usePendingLifecycleMoves test (Plan 100-02, UX-03) — renderHook coverage of
 * the commandId-correlated pending map + status-aware reconcile, plus (Task 2)
 * the SkillControlSurfaceProvider context + reader hooks.
 *
 * Mocks @/hooks/useLifecycle's useLifecycleCommands (the reconcile effect's
 * sole dependency) and sonner's toast, mirroring useIntakeFeed.test.tsx's and
 * SkillLifecycleMenu.test.tsx's established module-mock conventions. JSX is
 * avoided (createElement instead) so this file can stay a plain .ts per the
 * plan's file list — no .tsx needed.
 */

import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, render, screen, fireEvent } from "@testing-library/react";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockUseLifecycleCommands = vi.fn();
vi.mock("@/hooks/useLifecycle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useLifecycle")>();
  return {
    ...actual,
    useLifecycleCommands: (...args: unknown[]) => mockUseLifecycleCommands(...args),
  };
});

import {
  usePendingLifecycleMoves,
  SkillControlSurfaceProvider,
  useSkillControlSurface,
  usePendingMove,
  useDraggingSkill,
  type PendingMove,
} from "./usePendingLifecycleMoves";
import type { LifecycleCommandRow } from "./useLifecycle";

const lifecycleRow = (over: Partial<LifecycleCommandRow> = {}): LifecycleCommandRow => ({
  commandId: "cmd-1",
  status: "queued",
  skillName: "foo",
  action: "archive",
  sourceOrigin: "claude-code",
  destination: "cold",
  workspaceId: null,
  error: null,
  createdAt: 1000,
  expiresAt: 999999,
  ...over,
});

const move = (over: Partial<PendingMove> = {}): PendingMove => ({
  commandId: "cmd-1",
  action: "archive",
  destination: "cold",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLifecycleCommands.mockReturnValue([]);
});

describe("usePendingLifecycleMoves", () => {
  it("beginPending sets an entry before any server row exists", () => {
    const { result } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move()));
    expect(result.current.pending.foo).toEqual(move());
  });

  it("a matching row with status done clears the entry, no toast", () => {
    const { result, rerender } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move()));
    expect(result.current.pending.foo).toEqual(move());

    mockUseLifecycleCommands.mockReturnValue([lifecycleRow({ status: "done" })]);
    rerender();

    expect(result.current.pending.foo).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("status queued leaves the entry in place", () => {
    const { result, rerender } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move()));

    mockUseLifecycleCommands.mockReturnValue([lifecycleRow({ status: "queued" })]);
    rerender();

    expect(result.current.pending.foo).toEqual(move());
  });

  it("status executing leaves the entry in place", () => {
    const { result, rerender } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move()));

    mockUseLifecycleCommands.mockReturnValue([lifecycleRow({ status: "executing" })]);
    rerender();

    expect(result.current.pending.foo).toEqual(move());
  });

  it("status failed clears the entry and toasts the stripped refusal reason (first line, token stripped)", () => {
    const { result, rerender } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move()));

    mockUseLifecycleCommands.mockReturnValue([
      lifecycleRow({ status: "failed", error: "lifecycle-refused:collision:name taken\nextra" }),
    ]);
    rerender();

    expect(result.current.pending.foo).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith("name taken");
  });

  it("status expired clears the entry and toasts the reused expiry copy", () => {
    const { result, rerender } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move()));

    mockUseLifecycleCommands.mockReturnValue([lifecycleRow({ status: "expired" })]);
    rerender();

    expect(result.current.pending.foo).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith("Expired — no daemon claimed this command.");
  });

  it("a row with a DIFFERENT commandId for the same skillName does not reconcile the entry (commandId precision)", () => {
    const { result, rerender } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move({ commandId: "cmd-1" })));

    mockUseLifecycleCommands.mockReturnValue([
      lifecycleRow({ commandId: "cmd-OTHER", status: "done" }),
    ]);
    rerender();

    expect(result.current.pending.foo).toEqual(move({ commandId: "cmd-1" }));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("clearPending removes an entry directly — the LAYER-1 .catch path, no row required", () => {
    const { result } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move()));
    expect(result.current.pending.foo).toEqual(move());

    act(() => result.current.clearPending("foo"));
    expect(result.current.pending.foo).toBeUndefined();
  });

  it("clearPending(name, staleCommandId) is a no-op when a newer command owns the slot (CR-01)", () => {
    const { result } = renderHook(() => usePendingLifecycleMoves());
    // First drag paints (cmd-1); a rapid second drag (cmd-2) overwrites the slot.
    act(() => result.current.beginPending("foo", move({ commandId: "cmd-1" })));
    act(() => result.current.beginPending("foo", move({ commandId: "cmd-2" })));
    // The stale cmd-1 now rejects at LAYER-1 and tries to clear — it must NOT
    // wipe cmd-2's still-in-flight optimistic paint.
    act(() => result.current.clearPending("foo", "cmd-1"));
    expect(result.current.pending.foo).toEqual(move({ commandId: "cmd-2" }));
  });

  it("clearPending(name, commandId) clears when the commandId matches the current entry (CR-01)", () => {
    const { result } = renderHook(() => usePendingLifecycleMoves());
    act(() => result.current.beginPending("foo", move({ commandId: "cmd-2" })));
    act(() => result.current.clearPending("foo", "cmd-2"));
    expect(result.current.pending.foo).toBeUndefined();
  });
});

describe("SkillControlSurfaceProvider + reader hooks", () => {
  function Consumer() {
    const pendingMove = usePendingMove("foo");
    const { draggingSkill, setDraggingSkill } = useDraggingSkill();
    return createElement(
      "div",
      null,
      createElement("span", { "data-testid": "move" }, pendingMove ? pendingMove.action : "none"),
      createElement(
        "span",
        { "data-testid": "dragging" },
        draggingSkill ? draggingSkill.name : "none"
      ),
      createElement(
        "button",
        { onClick: () => setDraggingSkill({ name: "bar" }) },
        "drag"
      )
    );
  }

  it("a consumer inside the provider reflects a beginPending call and setDraggingSkill", () => {
    function Harness() {
      const surface = useSkillControlSurface();
      return createElement(
        "div",
        null,
        createElement(
          "button",
          {
            "data-testid": "begin",
            onClick: () =>
              surface.beginPending("foo", { commandId: "cmd-1", action: "move", destination: "project" }),
          },
          "begin"
        ),
        createElement(Consumer)
      );
    }

    render(createElement(SkillControlSurfaceProvider, null, createElement(Harness)));

    expect(screen.getByTestId("move").textContent).toBe("none");
    fireEvent.click(screen.getByTestId("begin"));
    expect(screen.getByTestId("move").textContent).toBe("move");

    expect(screen.getByTestId("dragging").textContent).toBe("none");
    fireEvent.click(screen.getByText("drag"));
    expect(screen.getByTestId("dragging").textContent).toBe("bar");
  });

  it("a consumer with NO provider gets undefined pending + null draggingSkill without throwing", () => {
    expect(() => render(createElement(Consumer))).not.toThrow();
    expect(screen.getByTestId("move").textContent).toBe("none");
    expect(screen.getByTestId("dragging").textContent).toBe("none");
  });

  it("setDraggingSkill threads the origin lane; default is active (CR-02)", () => {
    function LaneConsumer() {
      const { draggingLane, setDraggingSkill } = useDraggingSkill();
      return createElement(
        "div",
        null,
        createElement("span", { "data-testid": "lane" }, draggingLane),
        createElement(
          "button",
          { "data-testid": "drag-cold", onClick: () => setDraggingSkill({ name: "bar" }, "cold") },
          "cold"
        ),
        createElement(
          "button",
          { "data-testid": "drag-active", onClick: () => setDraggingSkill({ name: "bar" }) },
          "active"
        )
      );
    }

    render(createElement(SkillControlSurfaceProvider, null, createElement(LaneConsumer)));

    // No drag yet → safe default.
    expect(screen.getByTestId("lane").textContent).toBe("active");
    // A Cold-Storage row reports its lane, so resolveScopeDrop treats a shadowed
    // row as dormant (not its active copy) — the CR-02 fix.
    fireEvent.click(screen.getByTestId("drag-cold"));
    expect(screen.getByTestId("lane").textContent).toBe("cold");
    // An active-lane drag (no lane arg) defaults back to "active".
    fireEvent.click(screen.getByTestId("drag-active"));
    expect(screen.getByTestId("lane").textContent).toBe("active");
  });
});
