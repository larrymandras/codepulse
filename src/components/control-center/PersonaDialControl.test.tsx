import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

// Real PersonaDialSlider and real src/lib/dialBands.ts are used throughout
// -- mocking the slider would make the render assertions vacuous (the
// point of SC3's control is that the WIDGET is a real backend consumer).
import { PersonaDialControl } from "./PersonaDialControl";

// Radix UI Slider uses ResizeObserver internally; jsdom doesn't provide it.
// Same polyfill as PersonaDialSlider.test.tsx / KGControls.test.tsx.
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendCommand = vi.fn();
vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: vi.fn(() => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribe: vi.fn(() => vi.fn()),
    subscribeEvent: vi.fn(() => vi.fn()),
    reconnect: vi.fn(),
  })),
}));

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));
// Cloned from useActiveEngine.test.ts's header: a string stand-in for the
// generated api id, resolved from this file's own directory (same depth as
// PersonaDialControl.tsx itself, so the relative path is identical).
vi.mock("../../../convex/_generated/api", () => ({
  api: { personaDials: { get: "personaDials:get" } },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HUMOR_ERROR_COPY = "Couldn’t save that humor change — try again in a moment.";
const CANDOR_ERROR_COPY = "Couldn’t save that candor change — try again in a moment.";
const SEEDED_PROFILE = "seeded-profile";
const FIXED_TS = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago

function getContextAck() {
  return {
    type: "ack" as const,
    request_id: "r1",
    status: "ok" as const,
    profileId: SEEDED_PROFILE,
    personaId: "astridr",
  };
}

function openPopover() {
  fireEvent.click(screen.getByRole("button", { name: "Persona tone" }));
}

function getHumorThumb() {
  return screen.getByRole("slider", { name: "Humor dial, 0 to 100" });
}

beforeEach(() => {
  mockSendCommand.mockReset();
  mockUseQuery.mockReset();
});

// ---------------------------------------------------------------------------
// 1. SC1 / SC3 / D-14 -- the seeded value renders
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- SC1/SC3/D-14 seeded render", () => {
  it("renders 83 and 17 with band summary High / Low when Convex holds 83/17", async () => {
    mockUseQuery.mockReturnValue({ humor: 83, candor: 17, updatedAt: FIXED_TS });
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<PersonaDialControl />);
    openPopover();

    expect(await screen.findByText("83")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    // 83 and 17 are chosen precisely because no default (50/50) and no
    // mock fallback could produce them -- a 50/50 probe would pass
    // identically against a hardcoded widget.
    expect(await screen.findByText("High / Low")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. D-11 -- the profile is never guessed
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- D-11 profile resolution", () => {
  it("gates the Convex read on 'skip' until get_context resolves, then uses the ack's profileId", async () => {
    mockUseQuery.mockReturnValue(null);
    let resolveGetContext: (v: unknown) => void = () => {};
    mockSendCommand.mockImplementation((cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") {
        return new Promise((resolve) => {
          resolveGetContext = resolve;
        });
      }
      return Promise.resolve({ type: "ack", request_id: "r1", status: "ok" });
    });

    render(<PersonaDialControl />);

    await waitFor(() => {
      expect(mockUseQuery).toHaveBeenCalledWith("personaDials:get", "skip");
    });
    expect(mockSendCommand).toHaveBeenCalledWith({ type: "persona_dials.get_context" });

    resolveGetContext(getContextAck());

    await waitFor(() => {
      expect(mockUseQuery).toHaveBeenCalledWith("personaDials:get", {
        profileId: SEEDED_PROFILE,
        personaId: "astridr",
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 3. D-01 changed-axis-only + 3b. Ack reconciliation
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- D-01 changed-axis-only + ack reconciliation", () => {
  it("a humor commit sends ONLY humor, never candor, and reconciles both axes from the ack", async () => {
    mockUseQuery.mockReturnValue({ humor: 83, candor: 17, updatedAt: FIXED_TS });
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      if (cmd.type === "persona_dials.set") {
        // Ack carries humor: 95 (the committed value) AND candor: 40 -- a
        // value this client never sent, simulating a concurrent spoken
        // change merged server-side inside astridr's own lock.
        return {
          type: "ack",
          request_id: "r1",
          status: "ok",
          profileId: SEEDED_PROFILE,
          personaId: "astridr",
          humor: cmd.humor,
          candor: 40,
        };
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<PersonaDialControl />);
    openPopover();
    await screen.findByText("83");

    // 83 -> 93 (PageUp, +10) -> 95 (2x ArrowRight, +1 each).
    const humorThumb = getHumorThumb();
    fireEvent.keyDown(humorThumb, { key: "PageUp" });
    fireEvent.keyDown(humorThumb, { key: "ArrowRight" });
    fireEvent.keyDown(humorThumb, { key: "ArrowRight" });

    await waitFor(() => {
      const setCalls = mockSendCommand.mock.calls
        .map(([c]) => c as Record<string, unknown>)
        .filter((c) => c.type === "persona_dials.set");
      expect(setCalls.length).toBeGreaterThan(0);
      expect(setCalls[setCalls.length - 1]).toEqual({ type: "persona_dials.set", humor: 95 });
    });

    // NO call sent a candor payload -- not merely "not 17", but the key
    // must be absent entirely. A payload carrying candor: 17 is exactly
    // the stale-sibling send this design exists to prevent.
    for (const [call] of mockSendCommand.mock.calls) {
      const c = call as Record<string, unknown>;
      if (c.type === "persona_dials.set") {
        expect(c).not.toHaveProperty("candor");
      }
    }

    // The ack's candor: 40 (a value never sent) is reflected immediately,
    // proving the merge result is consumed rather than waiting on the
    // Convex subscription to catch up.
    expect(await screen.findByText("40")).toBeInTheDocument();
    expect(screen.queryByText("17")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. D-13 -- reset sends 50/50 once
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- D-13 reset", () => {
  it("Reset to default dispatches exactly one persona_dials.set with {humor:50, candor:50}", async () => {
    mockUseQuery.mockReturnValue({ humor: 83, candor: 17, updatedAt: FIXED_TS });
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      if (cmd.type === "persona_dials.set") {
        return {
          type: "ack",
          request_id: "r1",
          status: "ok",
          profileId: SEEDED_PROFILE,
          personaId: "astridr",
          humor: cmd.humor,
          candor: cmd.candor,
        };
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<PersonaDialControl />);
    openPopover();
    await screen.findByText("83");

    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));

    await waitFor(() => {
      const setCalls = mockSendCommand.mock.calls
        .map(([c]) => c as Record<string, unknown>)
        .filter((c) => c.type === "persona_dials.set");
      expect(setCalls).toHaveLength(1);
    });
    expect(mockSendCommand).toHaveBeenCalledWith({
      type: "persona_dials.set",
      humor: 50,
      candor: 50,
    });
  });
});

// ---------------------------------------------------------------------------
// 5. D-03 -- a rejected write AND an error ack both revert
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- D-03 revert on failure", () => {
  it("reverts to the last confirmed value and shows the error copy on a rejected write", async () => {
    mockUseQuery.mockReturnValue({ humor: 83, candor: 17, updatedAt: FIXED_TS });
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      if (cmd.type === "persona_dials.set") throw new Error("network down");
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<PersonaDialControl />);
    openPopover();
    await screen.findByText("83");

    fireEvent.keyDown(getHumorThumb(), { key: "ArrowRight" }); // 83 -> 84, rejected

    expect(await screen.findByText(HUMOR_ERROR_COPY)).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.queryByText("84")).not.toBeInTheDocument();
  });

  it("reverts identically on an error-status ack -- not just a rejection", async () => {
    mockUseQuery.mockReturnValue({ humor: 83, candor: 17, updatedAt: FIXED_TS });
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      if (cmd.type === "persona_dials.set") {
        return { type: "ack", request_id: "r1", status: "error", error: "boom" };
      }
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<PersonaDialControl />);
    openPopover();
    await screen.findByText("83");

    fireEvent.keyDown(getHumorThumb(), { key: "ArrowRight" }); // 83 -> 84, error-acked

    expect(await screen.findByText(HUMOR_ERROR_COPY)).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.queryByText("84")).not.toBeInTheDocument();
    // The server's raw error string is never rendered (T-195-12) -- only
    // the component's own fixed per-axis copy.
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. D-16 -- relative time from epoch seconds
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- D-16 relative timestamp", () => {
  it("renders relative time from epoch SECONDS, never a 1970 date", async () => {
    const updatedAt = Math.floor(Date.now() / 1000) - 180; // 3 minutes ago
    mockUseQuery.mockReturnValue({ humor: 50, candor: 50, updatedAt });
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<PersonaDialControl />);
    openPopover();

    const timestamp = await screen.findByText(/3m ago/);
    expect(timestamp.textContent).not.toContain("1970");
    expect(timestamp.textContent).not.toContain("Jan");
  });
});

// ---------------------------------------------------------------------------
// 7. Empty state
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- empty state", () => {
  it("renders 50/50 and 'Not yet adjusted' when the Convex row is null, with no error", async () => {
    mockUseQuery.mockReturnValue(null);
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      return { type: "ack", request_id: "r1", status: "ok" };
    });

    render(<PersonaDialControl />);
    openPopover();

    expect(await screen.findByText("Not yet adjusted")).toBeInTheDocument();
    expect(screen.getAllByText("50")).toHaveLength(2); // humor + candor readouts
    expect(screen.queryByText(HUMOR_ERROR_COPY)).not.toBeInTheDocument();
    expect(screen.queryByText(CANDOR_ERROR_COPY)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. Loading
// ---------------------------------------------------------------------------

describe("PersonaDialControl -- loading state", () => {
  it("shows the loading skeleton, findable by its aria-label, before get_context resolves", async () => {
    mockUseQuery.mockReturnValue(undefined);
    let resolveGetContext: (v: unknown) => void = () => {};
    mockSendCommand.mockImplementation((cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") {
        return new Promise((resolve) => {
          resolveGetContext = resolve;
        });
      }
      return Promise.resolve({ type: "ack", request_id: "r1", status: "ok" });
    });

    render(<PersonaDialControl />);
    openPopover();

    expect(await screen.findByLabelText("Loading persona tone")).toBeInTheDocument();

    // Resolve so the pending promise/timer doesn't leak across tests.
    resolveGetContext(getContextAck());
  });
});

// ---------------------------------------------------------------------------
// 4. Out-of-order ack reconciliation
//
// PersonaDialSlider fires onCommit PER KEYSTROKE (Radix `onValueCommit` at
// `step={1}`), so a held arrow key puts several `persona_dials.set` writes in
// flight simultaneously. The original suite could not observe this: its mock
// resolved every ack immediately, in invocation order. These cases resolve
// DEFERRED acks explicitly out of order.
// ---------------------------------------------------------------------------

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushMicrotasks() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe("PersonaDialControl -- out-of-order ack reconciliation", () => {
  it("a STALE ack landing after a newer one does not roll the dial backwards", async () => {
    mockUseQuery.mockReturnValue({ humor: 83, candor: 17, updatedAt: FIXED_TS });

    const acks: Array<ReturnType<typeof deferred<Record<string, unknown>>>> = [];
    mockSendCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
      if (cmd.type === "persona_dials.get_context") return getContextAck();
      const d = deferred<Record<string, unknown>>();
      acks.push(d);
      // Capture the value THIS write carried, so its ack echoes it back --
      // exactly as astridr's persona_dials.set does.
      d.promise.then(() => {});
      return d.promise.then(() => ({
        type: "ack",
        request_id: "r1",
        status: "ok",
        profileId: SEEDED_PROFILE,
        personaId: "astridr",
        humor: cmd.humor,
        candor: 17,
      }));
    });

    render(<PersonaDialControl />);
    openPopover();
    await screen.findByText("83");

    // Two writes in flight: 93 (PageUp) then 94 (ArrowRight).
    const thumb = getHumorThumb();
    fireEvent.keyDown(thumb, { key: "PageUp" });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    await waitFor(() => expect(acks.length).toBe(2));

    // Settle the NEWER write first, then the OLDER one.
    acks[1].resolve({});
    await flushMicrotasks();
    acks[0].resolve({});
    await flushMicrotasks();

    // The stale 93 ack must be discarded. Without the sequence guard the
    // dial visibly rolls back to 93 even though 94 is what is stored.
    expect(screen.queryByText("93")).toBeNull();
    expect(screen.getByText("94")).toBeInTheDocument();
  });

  // DELIBERATELY NOT TESTED: the pending-COUNT fix (pendingAxisRef holding a
  // count rather than a boolean, so it only clears when the LAST in-flight
  // write for an axis settles).
  //
  // A test for it was written, ran green, and was DELETED as vacuous: mutating
  // the count back to boolean early-release left it passing. Two reasons it
  // cannot be observed through rendered output here, both verified rather than
  // assumed:
  //   1. PersonaDialSlider's `displayValue` is `dragValue ?? value`, and a
  //      superseded commit's `.then` now returns early WITHOUT clearing
  //      dragValue -- so the readout keeps showing the in-flight number
  //      regardless of what the host's localHumor actually is. The rendered
  //      text is simply not a window onto the state under test.
  //   2. The defect is self-healing: a mid-burst Convex clobber is overwritten
  //      when the final ack lands, so the user-visible symptom is a transient
  //      flicker, not a wrong resting value.
  //
  // The fix is retained because it is strictly correct and costs nothing, but
  // it is UNPROVEN BY TEST and must not be described as covered. Proving it
  // needs an observation point on the host's state that the slider does not
  // mask -- exposing the pending count for assertion, or a host-level test
  // that renders without the real slider.
});
