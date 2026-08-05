import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";

// Counter lives in a hoisted block because vi.mock factories are hoisted above
// every other statement in the file.
const toneMock = vi.hoisted(() => ({ loads: 0 }));

vi.mock("tone", () => {
  toneMock.loads++;

  class FakeParam {
    value = 0;
    rampTo = vi.fn();
    setValueAtTime = vi.fn();
  }
  class FakeNode {
    volume = new FakeParam();
    frequency = new FakeParam();
    connect = vi.fn(() => this);
    toDestination = vi.fn(() => this);
    dispose = vi.fn();
    start = vi.fn(() => this);
    stop = vi.fn(() => this);
    triggerAttackRelease = vi.fn();
  }

  return {
    start: vi.fn(async () => {}),
    now: vi.fn(() => 0),
    Volume: FakeNode,
    Noise: FakeNode,
    Oscillator: FakeNode,
    Synth: FakeNode,
    MetalSynth: FakeNode,
  };
});

import { AmbientProvider, useAmbient } from "./AmbientContext";

const STORAGE_KEY = "codepulse-ambient";

/** Preset "silent" keeps the assertions about *loading* free of preset noise. */
function storePrefs(enabled: boolean) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      enabled,
      volume: 0.08,
      preset: "silent",
      categoryVolumes: {
        alerts: 0.8,
        ambience: 0.3,
        events: 0.2,
        transitions: 0.3,
      },
    }),
  );
}

function Consumer() {
  const { enabled, toggle } = useAmbient();
  return (
    <button onClick={toggle} data-testid="toggle">
      {enabled ? "on" : "off"}
    </button>
  );
}

describe("AmbientProvider synthesis-library deferral (DEBT-03)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mounts without loading the synthesis library", () => {
    storePrefs(false);
    render(
      <AmbientProvider>
        <Consumer />
      </AmbientProvider>,
    );
    expect(screen.getByTestId("toggle")).toHaveTextContent("off");
    // main.tsx mounts this provider on every page view. If mounting alone
    // pulled the library in, deferring it would buy nothing.
    expect(toneMock.loads).toBe(0);
  });

  it("loads the library exactly once when ambient audio is switched on", async () => {
    storePrefs(false);
    render(
      <AmbientProvider>
        <Consumer />
      </AmbientProvider>,
    );
    expect(toneMock.loads).toBe(0);

    await act(async () => {
      screen.getByTestId("toggle").click();
    });

    await waitFor(() => expect(toneMock.loads).toBe(1));
    expect(screen.getByTestId("toggle")).toHaveTextContent("on");
  });

  it("does not re-fetch the library when audio is toggled off and back on", async () => {
    storePrefs(false);
    render(
      <AmbientProvider>
        <Consumer />
      </AmbientProvider>,
    );

    const toggle = screen.getByTestId("toggle");
    await act(async () => {
      toggle.click();
    });
    await waitFor(() => expect(toneMock.loads).toBe(1));

    await act(async () => {
      toggle.click();
    });
    await act(async () => {
      toggle.click();
    });
    await waitFor(() => expect(toggle).toHaveTextContent("on"));

    expect(toneMock.loads).toBe(1);
  });

  it("keeps the provider alive when the engine fails to start", async () => {
    const tone = await import("tone");
    vi.mocked(tone.start).mockRejectedValueOnce(new Error("no user gesture"));

    storePrefs(false);
    render(
      <AmbientProvider>
        <Consumer />
      </AmbientProvider>,
    );

    await act(async () => {
      screen.getByTestId("toggle").click();
    });

    // The provider swallows the init rejection on purpose (an AudioContext
    // needs a user gesture); what must not happen is the app unmounting.
    await waitFor(() =>
      expect(screen.getByTestId("toggle")).toHaveTextContent("on"),
    );
  });
});
