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
const mockSubscribeEvent = vi.fn(() => () => {});

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
