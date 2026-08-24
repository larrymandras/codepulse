import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import { PersonaDialSlider } from "./PersonaDialSlider";

// Radix UI Slider uses ResizeObserver internally; jsdom doesn't provide it.
// Same polyfill as KGControls.test.tsx, this repo's existing Slider-consumer
// test precedent.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const SAME_BAND_COPY = "Saved — same range, no tone change.";
const HUMOR_ERROR_COPY = "Couldn’t save that humor change — try again in a moment.";
const CANDOR_ERROR_COPY = "Couldn’t save that candor change — try again in a moment.";

/**
 * Drives the real Radix `Slider.Thumb`'s keyboard interaction
 * (`onStepKeyDown`) — a genuine, un-mocked DOM interaction. Each key
 * commits immediately (Radix fires `onValueCommit` per keypress, not
 * once per "gesture"), so a multi-step move produces one `onCommit` call
 * per key; the LAST call carries the final value. `ArrowRight`/`PageUp`
 * increase, step 1 / 10 respectively (horizontal, LTR, default
 * `inverted=false` — verified against
 * `node_modules/@radix-ui/react-slider/dist/index.mjs`'s `BACK_KEYS`
 * table, which puts `ArrowRight`/`PageUp` on the forward side for
 * `from-left`).
 */
function pressSteps(thumb: HTMLElement, steps: Array<{ key: "ArrowRight" | "PageUp"; count: number }>) {
  for (const { key, count } of steps) {
    for (let i = 0; i < count; i++) {
      fireEvent.keyDown(thumb, { key });
    }
  }
}

function getHumorThumb() {
  return screen.getByRole("slider", { name: "Humor dial, 0 to 100" });
}

describe("PersonaDialSlider — D-08 boundary transitions (band label)", () => {
  const cases: Array<[number, string]> = [
    [29, "Low"],
    [30, "Mid"],
    [59, "Mid"],
    [60, "High"],
    [89, "High"],
    [90, "Max"],
  ];

  it("renders the correct band label at every boundary and its immediate neighbour", () => {
    for (const [value, expectedBand] of cases) {
      const { unmount } = render(
        <PersonaDialSlider axisLabel="HUMOR" value={value} onCommit={vi.fn()} />
      );
      // Asserted through the RENDERED component's visible band label, not
      // by calling resolveBand in isolation -- this proves both that the
      // thresholds are right and that the component actually consumes
      // them.
      expect(screen.getByText(expectedBand)).toBeInTheDocument();
      unmount();
    }
  });

  it("carries the same band information on aria-valuetext, for the screen-reader path", () => {
    const { unmount: unmount1 } = render(
      <PersonaDialSlider axisLabel="HUMOR" value={89} onCommit={vi.fn()} />
    );
    expect(getHumorThumb().getAttribute("aria-valuetext")).toContain("High");
    unmount1();

    const { unmount: unmount2 } = render(
      <PersonaDialSlider axisLabel="HUMOR" value={90} onCommit={vi.fn()} />
    );
    expect(getHumorThumb().getAttribute("aria-valuetext")).toContain("Max");
    unmount2();
  });
});

describe("PersonaDialSlider — D-09 same-band confirmation copy", () => {
  it("shows the exact same-range copy when a commit lands in the same band (61 -> 89, both High)", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<PersonaDialSlider axisLabel="HUMOR" value={61} onCommit={onCommit} />);

    // 61 -> 81 (2x PageUp, +10 each) -> 89 (8x ArrowRight, +1 each). Every
    // intermediate value (61..89) stays within the High band (>=60, <90).
    pressSteps(getHumorThumb(), [
      { key: "PageUp", count: 2 },
      { key: "ArrowRight", count: 8 },
    ]);

    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith(89));
    expect(await screen.findByText(SAME_BAND_COPY)).toBeInTheDocument();
  });

  it("does NOT show the same-range copy when a commit crosses a band (61 -> 95, High -> Max)", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<PersonaDialSlider axisLabel="HUMOR" value={61} onCommit={onCommit} />);

    // 61 -> 91 (3x PageUp) -> 95 (4x ArrowRight). Crosses the 90 boundary.
    pressSteps(getHumorThumb(), [
      { key: "PageUp", count: 3 },
      { key: "ArrowRight", count: 4 },
    ]);

    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith(95));
    expect(screen.queryByText(SAME_BAND_COPY)).not.toBeInTheDocument();
  });
});

describe("PersonaDialSlider — D-06 no snapping", () => {
  it("commits the exact dragged value, never a band edge", async () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    render(<PersonaDialSlider axisLabel="HUMOR" value={80} onCommit={onCommit} />);

    pressSteps(getHumorThumb(), [{ key: "ArrowRight", count: 3 }]); // 80 -> 83

    await waitFor(() => expect(onCommit).toHaveBeenLastCalledWith(83));
    expect(onCommit).not.toHaveBeenCalledWith(90);
    expect(onCommit).not.toHaveBeenCalledWith(60);
    expect(onCommit).not.toHaveBeenCalledWith(30);
  });
});

describe("PersonaDialSlider — D-03 revert on failure, per axis", () => {
  it("reverts the readout to the last confirmed value and shows the humor error copy", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("network down"));
    render(<PersonaDialSlider axisLabel="HUMOR" value={50} onCommit={onCommit} />);

    pressSteps(screen.getByRole("slider", { name: "Humor dial, 0 to 100" }), [
      { key: "ArrowRight", count: 1 },
    ]); // 50 -> 51, rejected

    expect(await screen.findByText(HUMOR_ERROR_COPY)).toBeInTheDocument();
    // (a) the visible numeric readout returns to the original value prop.
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByText("51")).not.toBeInTheDocument();
    // The reverted case must not also claim a same-band save.
    expect(screen.queryByText(SAME_BAND_COPY)).not.toBeInTheDocument();
  });

  it("reverts and shows the candor-specific error copy for axisLabel=CANDOR", async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error("network down"));
    render(<PersonaDialSlider axisLabel="CANDOR" value={50} onCommit={onCommit} />);

    pressSteps(screen.getByRole("slider", { name: "Candor dial, 0 to 100" }), [
      { key: "ArrowRight", count: 1 },
    ]); // 50 -> 51, rejected

    expect(await screen.findByText(CANDOR_ERROR_COPY)).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.queryByText(HUMOR_ERROR_COPY)).not.toBeInTheDocument();
  });
});

describe("PersonaDialSlider — D-03 status-line liveness", () => {
  it("wraps the status line in a role=status live region, even before the first update", () => {
    render(<PersonaDialSlider axisLabel="HUMOR" value={50} onCommit={vi.fn()} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("PersonaDialSlider — disabled suppression", () => {
  it("does not call onCommit when disabled", () => {
    const onCommit = vi.fn();
    render(<PersonaDialSlider axisLabel="HUMOR" value={50} onCommit={onCommit} disabled />);

    pressSteps(getHumorThumb(), [{ key: "ArrowRight", count: 1 }]);

    expect(onCommit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Concurrency: PersonaDialSlider fires onCommit PER KEYSTROKE (Radix
// `onValueCommit` at `step={1}`), so several commits are in flight at once.
// These two cases were added after an adversarial review found the original
// suite structurally unable to observe either defect: its mock resolved every
// commit immediately, in invocation order, and asserted only
// `toHaveBeenLastCalledWith`, never the call count or the resolution order.
// ---------------------------------------------------------------------------

/**
 * Let queued microtasks (promise continuations) and React's state flush run.
 * `waitFor` is wrong for asserting that something NEVER appears: it succeeds on
 * its first poll, which can land before the rejection's continuation has even
 * been scheduled -- the assertion then passes vacuously. Verified: with
 * `waitFor` here, deleting the guard under test left the suite green.
 */
async function flushMicrotasks() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** A promise whose settlement this test controls explicitly. */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("PersonaDialSlider — out-of-order commit resolution", () => {
  it("a STALE rejection landing after a newer success does not revert the thumb or paint an error", async () => {
    const first = deferred();
    const second = deferred();
    const calls: number[] = [];
    const onCommit = vi.fn((v: number) => {
      calls.push(v);
      return calls.length === 1 ? first.promise : second.promise;
    });

    render(<PersonaDialSlider axisLabel="HUMOR" value={83} onCommit={onCommit} />);
    const thumb = getHumorThumb();

    // Two commits in flight: 93 (PageUp) then 94 (ArrowRight).
    fireEvent.keyDown(thumb, { key: "PageUp" });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(2));
    expect(calls).toEqual([93, 94]);

    // Resolve the NEWER commit first, then reject the OLDER one.
    second.resolve();
    await second.promise;
    await flushMicrotasks();

    first.reject(new Error("stale failure"));
    // Swallow the rejection at the source so an unhandled-rejection warning
    // cannot mask the assertion, then let the component's .catch actually run.
    await first.promise.catch(() => {});
    await flushMicrotasks();

    // The stale rejection must be swallowed by the sequence guard: no error
    // copy, and no revert out from under the newer, successful write.
    // CONTROL for this negative assertion: the "synchronous throw" case below
    // asserts this SAME string positively and passes, so the string is
    // findable and a null result here means the error genuinely was not
    // painted -- not that the query is broken.
    expect(screen.queryByText(HUMOR_ERROR_COPY)).toBeNull();
  });

  it("a SYNCHRONOUS throw from onCommit still triggers the D-03 revert and error copy", async () => {
    // The prop contract says onCommit "Rejects (or throws) on failure".
    // A sync throw previously escaped the .catch entirely, leaving the
    // unconfirmed thumb on screen with no error rendered.
    const onCommit = vi.fn(() => {
      throw new Error("synchronous failure");
    }) as unknown as (v: number) => Promise<void>;

    render(<PersonaDialSlider axisLabel="HUMOR" value={83} onCommit={onCommit} />);
    fireEvent.keyDown(getHumorThumb(), { key: "PageUp" });

    await waitFor(() => {
      expect(screen.getByText(HUMOR_ERROR_COPY)).toBeInTheDocument();
    });
  });
});
