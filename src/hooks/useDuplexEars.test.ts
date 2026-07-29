/**
 * useDuplexEars.test.ts
 *
 * Fast, network-free coverage of connect, event fan-out, failure semantics
 * and teardown for the WebRTC realtime-transcription ears hook (188-05).
 *
 * Every fetch is a vi.fn() — no real network is exercised. RTCPeerConnection
 * and navigator.mediaDevices.getUserMedia are fully stubbed and controllable
 * per-test via module-scope handles (`lastPc` / `lastDc`).
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDuplexEars, type UseDuplexEarsReturn } from "./useDuplexEars";

// ---------------------------------------------------------------------------
// Controllable fake RTCDataChannel / RTCPeerConnection
// ---------------------------------------------------------------------------

interface FakeDataChannel {
  label: string;
  onmessage: ((e: { data: string }) => void) | null;
  onclose: (() => void) | null;
  close: Mock;
  triggerMessage: (data: unknown) => void;
  triggerClose: () => void;
}

interface FakePeerConnection {
  createDataChannel: Mock;
  addTrack: Mock;
  createOffer: Mock;
  setLocalDescription: Mock;
  setRemoteDescription: Mock;
  close: Mock;
  connectionState: string;
  onconnectionstatechange: (() => void) | null;
  triggerConnectionState: (state: string) => void;
}

let lastPc: FakePeerConnection | null = null;
let lastDc: FakeDataChannel | null = null;
let pcConstructorCallCount = 0;

function makeFakeDataChannel(label: string): FakeDataChannel {
  const dc: FakeDataChannel = {
    label,
    onmessage: null,
    onclose: null,
    close: vi.fn(() => {
      dc.onclose?.();
    }),
    triggerMessage(data: unknown) {
      dc.onmessage?.({ data: JSON.stringify(data) });
    },
    triggerClose() {
      dc.onclose?.();
    },
  };
  return dc;
}

function makePeerConnectionClass() {
  function FakePC(this: FakePeerConnection) {
    pcConstructorCallCount += 1;
    this.createDataChannel = vi.fn((label: string) => {
      const dc = makeFakeDataChannel(label);
      lastDc = dc;
      return dc;
    });
    this.addTrack = vi.fn();
    this.createOffer = vi.fn(() =>
      Promise.resolve({ type: "offer", sdp: "fake-offer-sdp" })
    );
    this.setLocalDescription = vi.fn(() => Promise.resolve());
    this.setRemoteDescription = vi.fn(() => Promise.resolve());
    this.close = vi.fn();
    this.connectionState = "new";
    this.onconnectionstatechange = null;
    this.triggerConnectionState = (state: string) => {
      this.connectionState = state;
      this.onconnectionstatechange?.();
    };
    lastPc = this;
  }
  return FakePC as unknown as typeof RTCPeerConnection;
}

// ---------------------------------------------------------------------------
// Mock mic capture
// ---------------------------------------------------------------------------

interface FakeTrack {
  kind: string;
  stop: Mock;
  onended: (() => void) | null;
}

function makeMockTrack(kind = "audio"): FakeTrack {
  return { kind, stop: vi.fn(), onended: null };
}

function makeMockStream(tracks: FakeTrack[]) {
  return { getTracks: vi.fn(() => tracks) } as unknown as MediaStream;
}

let getUserMediaMock: Mock;
let mockTracks: FakeTrack[];
let mockStream: MediaStream;

// ---------------------------------------------------------------------------
// Mock fetch responses
// ---------------------------------------------------------------------------

function makeMintResponse(
  overrides: Partial<{ ok: boolean; status: number; body: Record<string, unknown> }> = {}
) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 200,
    json: vi.fn().mockResolvedValue(
      overrides.body ?? {
        value: "ek_test_secret_abc123",
        expiresAt: Math.floor(Date.now() / 1000) + 60,
        model: "gpt-4o-transcribe",
        persona: "astridr",
      }
    ),
  };
}

function makeCallsResponse(
  overrides: Partial<{ ok: boolean; status: number; sdp: string }> = {}
) {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? 201,
    text: vi.fn().mockResolvedValue(overrides.sdp ?? "fake-answer-sdp"),
  };
}

let fetchMock: Mock;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

function baseOptions(overrides: Partial<Parameters<typeof useDuplexEars>[0]> = {}) {
  return {
    enabled: true,
    onSpeechStart: vi.fn(),
    onFinalTranscript: vi.fn(),
    onInterimTranscript: vi.fn(),
    onUnavailable: vi.fn(),
    onSessionEnd: vi.fn(),
    ...overrides,
  };
}

async function driveToConnected(
  result: { current: UseDuplexEarsReturn }
): Promise<void> {
  fetchMock.mockResolvedValueOnce(makeMintResponse());
  fetchMock.mockResolvedValueOnce(makeCallsResponse());
  act(() => {
    result.current.start();
  });
  await waitFor(() => expect(result.current.status).toBe("connected"));
}

beforeEach(() => {
  lastPc = null;
  lastDc = null;
  pcConstructorCallCount = 0;

  vi.stubGlobal("RTCPeerConnection", makePeerConnectionClass());

  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  mockTracks = [makeMockTrack()];
  mockStream = makeMockStream(mockTracks);
  getUserMediaMock = vi.fn(() => Promise.resolve(mockStream));

  Object.defineProperty(globalThis, "navigator", {
    value: { mediaDevices: { getUserMedia: getUserMediaMock } },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useDuplexEars", () => {
  it("happy-path connect reaches status connected", async () => {
    const { result } = renderHook(() => useDuplexEars(baseOptions()));
    await driveToConnected(result);
    expect(result.current.status).toBe("connected");
    expect(lastPc?.setRemoteDescription).toHaveBeenCalled();
  });

  it("the mint request carries the admin Bearer header", async () => {
    const { result } = renderHook(() => useDuplexEars(baseOptions()));
    await driveToConnected(result);

    const [, mintInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = mintInit.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-api-key");
  });

  it("a speech_started data-channel message invokes onSpeechStart", async () => {
    const options = baseOptions();
    const { result } = renderHook(() => useDuplexEars(options));
    await driveToConnected(result);

    act(() => {
      lastDc?.triggerMessage({ type: "input_audio_buffer.speech_started" });
    });

    expect(options.onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it("a transcription.completed message invokes onFinalTranscript with the transcript text", async () => {
    const options = baseOptions();
    const { result } = renderHook(() => useDuplexEars(options));
    await driveToConnected(result);

    act(() => {
      lastDc?.triggerMessage({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "where are my children today",
      });
    });

    expect(options.onFinalTranscript).toHaveBeenCalledWith(
      "where are my children today"
    );
  });

  it("mint 503 resolves to unavailable with mint_unavailable and creates no peer connection", async () => {
    const options = baseOptions();
    fetchMock.mockResolvedValueOnce(makeMintResponse({ ok: false, status: 503 }));
    const { result } = renderHook(() => useDuplexEars(options));

    act(() => {
      result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    expect(options.onUnavailable).toHaveBeenCalledWith("mint_unavailable");
    expect(pcConstructorCallCount).toBe(0);
  });

  it("mint 402 resolves to unavailable with budget_exceeded and creates no peer connection", async () => {
    const options = baseOptions();
    fetchMock.mockResolvedValueOnce(makeMintResponse({ ok: false, status: 402 }));
    const { result } = renderHook(() => useDuplexEars(options));

    act(() => {
      result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    expect(options.onUnavailable).toHaveBeenCalledWith("budget_exceeded");
    expect(pcConstructorCallCount).toBe(0);
  });

  it("mint 401 resolves to unavailable with unauthorized and creates no peer connection", async () => {
    const options = baseOptions();
    fetchMock.mockResolvedValueOnce(makeMintResponse({ ok: false, status: 401 }));
    const { result } = renderHook(() => useDuplexEars(options));

    act(() => {
      result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    expect(options.onUnavailable).toHaveBeenCalledWith("unauthorized");
    expect(pcConstructorCallCount).toBe(0);
  });

  it("a failed connection state produces exactly one onUnavailable call", async () => {
    const options = baseOptions();
    const { result } = renderHook(() => useDuplexEars(options));
    await driveToConnected(result);

    act(() => {
      lastPc?.triggerConnectionState("failed");
    });
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    // A second, late-arriving event on the same (already torn-down) peer
    // connection must not fire a second onUnavailable call.
    act(() => {
      lastPc?.triggerConnectionState("failed");
    });

    expect(options.onUnavailable).toHaveBeenCalledTimes(1);
    expect(options.onUnavailable).toHaveBeenCalledWith("connection_failed");
  });

  it("stop() calls .stop() on every mic track and closes the peer connection", async () => {
    const { result } = renderHook(() => useDuplexEars(baseOptions()));
    await driveToConnected(result);

    act(() => {
      result.current.stop();
    });

    expect(mockTracks[0].stop).toHaveBeenCalledTimes(1);
    expect(lastPc?.close).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
  });

  it("stop() before any start() is a safe no-op and does not fire onSessionEnd", () => {
    const options = baseOptions();
    const { result } = renderHook(() => useDuplexEars(options));

    act(() => {
      result.current.stop();
    });

    expect(options.onSessionEnd).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("stop() fires onSessionEnd with a positive seconds only once the session actually connected", async () => {
    const dateNowSpy = vi.spyOn(Date, "now");
    dateNowSpy.mockReturnValueOnce(1_000_000); // sessionStartedAtRef set here
    dateNowSpy.mockReturnValueOnce(1_005_000); // teardown reads Date.now() here

    const options = baseOptions();
    const { result } = renderHook(() => useDuplexEars(options));
    await driveToConnected(result);

    act(() => {
      result.current.stop();
    });

    const onSessionEndMock = options.onSessionEnd as Mock;
    expect(onSessionEndMock).toHaveBeenCalledTimes(1);
    const info = onSessionEndMock.mock.calls[0][0] as { seconds: number };
    expect(info.seconds).toBeGreaterThan(0);
  });

  it("unmount performs the same teardown as stop() — no leaked mic, no leaked peer connection", async () => {
    const { result, unmount } = renderHook(() => useDuplexEars(baseOptions()));
    await driveToConnected(result);

    unmount();

    expect(mockTracks[0].stop).toHaveBeenCalledTimes(1);
    expect(lastPc?.close).toHaveBeenCalledTimes(1);
  });

  it("the ephemeral secret never appears in localStorage, sessionStorage, or the console", async () => {
    // jsdom's Storage instances do not honor vi.spyOn (its setItem is not a
    // plain own-property function vi.spyOn can wrap in this environment) —
    // verified empirically: a spyOn-based version of this assertion stayed
    // green even with a deliberate window.localStorage.setItem(secret) call
    // injected into the hook. vi.stubGlobal replaces the whole object with a
    // fully controllable fake, which DOES record calls reliably.
    const localStorageSetItem = vi.fn();
    const sessionStorageSetItem = vi.fn();
    vi.stubGlobal("localStorage", {
      setItem: localStorageSetItem,
      getItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("sessionStorage", {
      setItem: sessionStorageSetItem,
      getItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useDuplexEars(baseOptions()));
    await driveToConnected(result);

    const secret = "ek_test_secret_abc123";
    expect(localStorageSetItem).not.toHaveBeenCalled();
    expect(sessionStorageSetItem).not.toHaveBeenCalled();
    for (const spy of [consoleLogSpy, consoleWarnSpy, consoleErrorSpy]) {
      for (const call of spy.mock.calls) {
        for (const arg of call) {
          expect(String(arg)).not.toContain(secret);
        }
      }
    }
  });
});
