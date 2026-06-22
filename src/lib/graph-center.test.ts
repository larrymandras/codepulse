import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { centerNodeWhenReady } from "./graph-center";

function makeRef() {
  return { current: { centerAt: vi.fn(), zoom: vi.fn() } };
}

describe("centerNodeWhenReady", () => {
  let rafCbs: Array<() => void>;
  beforeEach(() => {
    rafCbs = [];
    // Deterministic rAF: queue callbacks, flush manually via flush().
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      rafCbs.push(cb);
      return rafCbs.length;
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const flush = () => {
    const batch = rafCbs;
    rafCbs = [];
    batch.forEach((cb) => cb());
  };

  it("centers + zooms immediately when coords are already assigned", () => {
    const ref = makeRef();
    centerNodeWhenReady(ref, { x: 10, y: 20 }, { ms: 800, zoom: 3 });
    expect(ref.current.centerAt).toHaveBeenCalledWith(10, 20, 800);
    expect(ref.current.zoom).toHaveBeenCalledWith(3, 800);
    expect(rafCbs.length).toBe(0); // no retry scheduled
  });

  it("waits for the layout to assign x/y, then centers once", () => {
    const ref = makeRef();
    const node: { x?: number; y?: number } = {};
    centerNodeWhenReady(ref, node, { ms: 500, zoom: 2 });
    // Coords not ready → nothing yet, a retry is queued.
    expect(ref.current.centerAt).not.toHaveBeenCalled();
    expect(rafCbs.length).toBe(1);

    flush(); // still not ready
    expect(ref.current.centerAt).not.toHaveBeenCalled();

    node.x = 5;
    node.y = 7;
    flush(); // now coords exist
    expect(ref.current.centerAt).toHaveBeenCalledWith(5, 7, 500);
    expect(ref.current.zoom).toHaveBeenCalledWith(2, 500);
    flush(); // no further centering after success
    expect(ref.current.centerAt).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxFrames without centering", () => {
    const ref = makeRef();
    centerNodeWhenReady(ref, {}, { maxFrames: 3 });
    for (let i = 0; i < 10; i++) flush();
    expect(ref.current.centerAt).not.toHaveBeenCalled();
    expect(rafCbs.length).toBe(0); // stopped scheduling
  });

  it("cancel() stops a pending retry", () => {
    const ref = makeRef();
    const node: { x?: number; y?: number } = {};
    const cancel = centerNodeWhenReady(ref, node);
    cancel();
    node.x = 1;
    node.y = 2;
    flush();
    expect(ref.current.centerAt).not.toHaveBeenCalled();
  });

  it("no-ops on a null node", () => {
    const ref = makeRef();
    centerNodeWhenReady(ref, null);
    expect(ref.current.centerAt).not.toHaveBeenCalled();
    expect(rafCbs.length).toBe(0);
  });
});
