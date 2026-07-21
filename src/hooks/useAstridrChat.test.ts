/**
 * useAstridrChat.test.ts — interrupt/TTS contract of the chat engine.
 *
 * Regression (2026-07-20 live, "she would not stop"): run.tts chunks from a
 * turn that was already interrupted must NOT auto-play — the server can still
 * have audio in flight when agent.stop lands. run.text has an active-session
 * gate; run.tts auto-play needed its own latch (cleared on the next send).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAstridrChat } from "./useAstridrChat";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSendCommand = vi.fn();
const mockSubscribeEvent = vi.fn((_eventType?: string) => () => {});

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({
    status: "connected",
    sendCommand: mockSendCommand,
    subscribeEvent: mockSubscribeEvent,
  }),
}));

const mockTtsPlay = vi.fn();
const mockTtsStop = vi.fn();

vi.mock("@/hooks/useTtsPlayback", () => ({
  useTtsPlayback: () => ({
    play: mockTtsPlay,
    stop: mockTtsStop,
    isPlaying: false,
    analyser: null,
  }),
}));

vi.mock("@/components/ApprovalActions", () => ({
  useApprovalActions: () => ({ approve: vi.fn(), reject: vi.fn() }),
}));

function getHandler(eventType: string): ((event: Record<string, unknown>) => void) | null {
  for (const call of mockSubscribeEvent.mock.calls as unknown as [
    string,
    (event: Record<string, unknown>) => void,
  ][]) {
    if (call[0] === eventType) return call[1];
  }
  return null;
}

describe("useAstridrChat — post-interrupt TTS suppression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-1" });
  });

  it("a run.tts chunk arriving AFTER interrupt() does not auto-play (she stays stopped)", async () => {
    const { result } = renderHook(() => useAstridrChat());
    act(() => {
      result.current.setTtsEnabled(true);
    });
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    act(() => {
      result.current.interrupt(); // barge-in
    });
    expect(mockTtsStop).toHaveBeenCalled();

    // Late chunk from the cancelled turn lands
    act(() => {
      getHandler("run.tts")?.({ data: { session_id: "sess-1", audio_url: "http://a/late.mp3" } });
    });
    expect(mockTtsPlay).not.toHaveBeenCalled();
  });

  it("the suppression clears on the next send — her next reply plays normally", async () => {
    const { result } = renderHook(() => useAstridrChat());
    act(() => {
      result.current.setTtsEnabled(true);
    });
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      result.current.interrupt();
    });

    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-2" });
    await act(async () => {
      await result.current.sendMessage("continue");
    });
    act(() => {
      getHandler("run.tts")?.({ data: { session_id: "sess-2", audio_url: "http://a/next.mp3" } });
    });
    expect(mockTtsPlay).toHaveBeenCalledWith("http://a/next.mp3");
  });

  it("interrupt() returns the streamed partial and finalizes the thread", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      getHandler("run.text")?.({ data: { session_id: "sess-1", text_chunk: "Tomorrow brings " } });
      getHandler("run.text")?.({ data: { session_id: "sess-1", text_chunk: "rain" } });
    });

    let partial = "";
    act(() => {
      partial = result.current.interrupt();
    });
    expect(partial).toBe("Tomorrow brings rain");
    expect(result.current.isStreaming).toBe(false);
    expect(mockSendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "agent.stop", session_id: "sess-1" })
    );
  });
});

// ─── VISION-01: vision.frame_request round-trip (backend-initiated see_screen) ──
// Closes the backend-initiated loop: the server pushes vision.frame_request
// (T-184-17/18) when the model calls see_screen for a phrasing the client
// regex missed; the client must reply with a fresh frame — or an honest empty
// reply when there's no active share / capture fails — so the turn never hangs.

function findFrameReplyCall(): Record<string, unknown> | undefined {
  return mockSendCommand.mock.calls
    .map((call) => call[0] as Record<string, unknown>)
    .find((cmd) => cmd.type === "vision.frame_reply");
}

describe("useAstridrChat — vision.frame_request round-trip (VISION-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok" });
  });

  it("Task 1: an active share captures a FRESH frame and replies with the matching frame_request_id", async () => {
    const mockCaptureFrame = vi.fn().mockResolvedValue({
      blob: new Blob(),
      base64: "ZmFrZWZyYW1l",
      mimeType: "image/jpeg",
    });
    const { result } = renderHook(() => useAstridrChat());

    act(() => {
      result.current.registerScreenShare({ state: "active", captureFrame: mockCaptureFrame });
    });

    await act(async () => {
      await getHandler("vision.frame_request")?.({ data: { request_id: "freq-1" } });
    });

    expect(mockCaptureFrame).toHaveBeenCalledTimes(1);
    const call = findFrameReplyCall();
    expect(call).toEqual(
      expect.objectContaining({
        type: "vision.frame_reply",
        frame_request_id: "freq-1",
        frame: "ZmFrZWZyYW1l",
        frame_mime_type: "image/jpeg",
      })
    );
    // The frame request's push id must never be reused as the reply's own
    // envelope request_id — sendCommand's envelope layer assigns that itself.
    expect(call?.request_id).toBeUndefined();
  });

  it("cleans up the vision.frame_request subscription on unmount", () => {
    const unsub = vi.fn();
    mockSubscribeEvent.mockImplementation((eventType?: string) =>
      eventType === "vision.frame_request" ? unsub : () => {}
    );
    const { unmount } = renderHook(() => useAstridrChat());
    unmount();
    expect(unsub).toHaveBeenCalled();
  });

  it("ignores a vision.frame_request with no request_id", async () => {
    const mockCaptureFrame = vi.fn();
    const { result } = renderHook(() => useAstridrChat());
    act(() => {
      result.current.registerScreenShare({ state: "active", captureFrame: mockCaptureFrame });
    });

    await act(async () => {
      await getHandler("vision.frame_request")?.({ data: {} });
    });

    expect(mockCaptureFrame).not.toHaveBeenCalled();
    expect(findFrameReplyCall()).toBeUndefined();
  });

  it("Task 2: no active share replies honestly with no frame (backend resolves promptly, no hang)", async () => {
    const mockCaptureFrame = vi.fn();
    const { result } = renderHook(() => useAstridrChat());

    act(() => {
      result.current.registerScreenShare({ state: "idle", captureFrame: mockCaptureFrame });
    });

    await act(async () => {
      await getHandler("vision.frame_request")?.({ data: { request_id: "freq-2" } });
    });

    expect(mockCaptureFrame).not.toHaveBeenCalled();
    const call = findFrameReplyCall();
    expect(call?.frame_request_id).toBe("freq-2");
    expect(call?.frame).toBeUndefined();
  });

  it("Task 2: a captureFrame failure (ended track) still replies honestly with no frame", async () => {
    const mockCaptureFrame = vi.fn().mockRejectedValue(new Error("Screen share track is not live"));
    const { result } = renderHook(() => useAstridrChat());

    act(() => {
      result.current.registerScreenShare({ state: "active", captureFrame: mockCaptureFrame });
    });

    await act(async () => {
      await getHandler("vision.frame_request")?.({ data: { request_id: "freq-3" } });
    });

    expect(mockCaptureFrame).toHaveBeenCalledTimes(1);
    const call = findFrameReplyCall();
    expect(call?.frame_request_id).toBe("freq-3");
    expect(call?.frame).toBeUndefined();
  });

  it("with no registered screenShare (default), still replies honestly with no frame", async () => {
    renderHook(() => useAstridrChat());

    await act(async () => {
      await getHandler("vision.frame_request")?.({ data: { request_id: "freq-4" } });
    });

    const call = findFrameReplyCall();
    expect(call?.frame_request_id).toBe("freq-4");
    expect(call?.frame).toBeUndefined();
  });
});
