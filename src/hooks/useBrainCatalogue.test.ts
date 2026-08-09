/**
 * useBrainCatalogue.test.ts — Phase 109 Plan 03 (D-01/D-02/D-03).
 *
 * `@/contexts/AstridrWSContext` is mocked directly (controllable `status`/`sendCommand`, plus a
 * throw-mode for the out-of-provider case), mirroring the idiom `useResolvedBrain.test.tsx`
 * already establishes for `useGlobalBrainOverride`/`useGlobalModelNames`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBrainCatalogue } from "./useBrainCatalogue";

let mockStatus: "connected" | "reconnecting" | "disconnected" = "connected";
let mockAstridrWSThrows = false;
const mockSendCommand = vi.fn();

vi.mock("@/contexts/AstridrWSContext", () => ({
  useAstridrWS: () => {
    if (mockAstridrWSThrows) {
      throw new Error("useAstridrWS must be used within AstridrWSProvider");
    }
    return {
      status: mockStatus,
      sendCommand: mockSendCommand,
      subscribe: vi.fn(),
      subscribeEvent: vi.fn(() => vi.fn()),
      reconnect: vi.fn(),
    };
  },
}));

function okAck(overrides: Record<string, unknown> = {}) {
  return {
    type: "ack",
    request_id: "x",
    status: "ok",
    entries: [{ id: "codex-cli", name: "Codex CLI", vendor: "codex" }],
    default_profile_id: "assistant-default",
    ...overrides,
  };
}

beforeEach(() => {
  mockStatus = "connected";
  mockAstridrWSThrows = false;
  mockSendCommand.mockReset();
  mockSendCommand.mockResolvedValue(okAck());
});

describe("useBrainCatalogue — the one swap.catalogue fetcher", () => {
  it("sends exactly { type: 'swap.catalogue', target: 'brain' } once per connected transition", async () => {
    renderHook(() => useBrainCatalogue());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(1));
    expect(mockSendCommand).toHaveBeenCalledWith({ type: "swap.catalogue", target: "brain" });
  });

  it("does not fetch while status is not connected", async () => {
    mockStatus = "disconnected";
    renderHook(() => useBrainCatalogue());
    await Promise.resolve();
    await Promise.resolve();
    expect(mockSendCommand).not.toHaveBeenCalled();
  });

  it("re-fetches on a disconnected -> connected transition", async () => {
    const { rerender } = renderHook(() => useBrainCatalogue());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(1));

    mockStatus = "disconnected";
    rerender();
    await Promise.resolve();
    expect(mockSendCommand).toHaveBeenCalledTimes(1);

    mockStatus = "connected";
    rerender();
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(2));
  });

  it("entries starts null and becomes the real array on a successful ack", async () => {
    const { result } = renderHook(() => useBrainCatalogue());
    expect(result.current.entries).toBeNull();

    await waitFor(() =>
      expect(result.current.entries).toEqual([
        { id: "codex-cli", name: "Codex CLI", vendor: "codex" },
      ])
    );
    expect(result.current.error).toBe(false);
  });

  it("defaultProfileId starts '' and becomes the ack's real value on success", async () => {
    const { result } = renderHook(() => useBrainCatalogue());
    expect(result.current.defaultProfileId).toBe("");

    await waitFor(() => expect(result.current.defaultProfileId).toBe("assistant-default"));
  });

  it("a missing or non-string default_profile_id yields '', never a fabricated id", async () => {
    mockSendCommand.mockResolvedValue(okAck({ default_profile_id: undefined }));
    const { result } = renderHook(() => useBrainCatalogue());

    await waitFor(() => expect(result.current.entries).not.toBeNull());
    expect(result.current.defaultProfileId).toBe("");

    mockSendCommand.mockResolvedValue(okAck({ default_profile_id: 12345 }));
    result.current.refetch();
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(2));
    expect(result.current.defaultProfileId).toBe("");
  });

  it("a non-ok ack sets error:true and leaves entries null — an honest failure, never a fabricated empty catalogue", async () => {
    mockSendCommand.mockResolvedValue({ type: "ack", request_id: "x", status: "error", error: "boom" });
    const { result } = renderHook(() => useBrainCatalogue());

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.entries).toBeNull();
  });

  it("a thrown rejection sets error:true and leaves entries null, without throwing out of the hook", async () => {
    mockSendCommand.mockRejectedValue(new Error("socket blip"));
    const { result } = renderHook(() => useBrainCatalogue());

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.entries).toBeNull();
  });

  it("a malformed (non-array) entries field sets error:true rather than rendering a fabricated shape", async () => {
    mockSendCommand.mockResolvedValue(okAck({ entries: "not-an-array" }));
    const { result } = renderHook(() => useBrainCatalogue());

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.entries).toBeNull();
  });

  it("refetch() re-issues the command and supersedes an earlier still-in-flight response", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    mockSendCommand.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    const { result } = renderHook(() => useBrainCatalogue());
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(1));

    mockSendCommand.mockResolvedValueOnce(
      okAck({ entries: [{ id: "fresh", name: "Fresh Entry" }] })
    );
    act(() => {
      result.current.refetch();
    });
    await waitFor(() => expect(mockSendCommand).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.entries?.[0]?.id).toBe("fresh"));

    // The stale first response resolves late — it must never overwrite the fresher refetch result.
    act(() => {
      resolveFirst(okAck({ entries: [{ id: "stale", name: "Stale Entry" }] }));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.entries?.[0]?.id).toBe("fresh");
  });

  it("never throws when rendered outside AstridrWSProvider, degrading to entries: null", () => {
    mockAstridrWSThrows = true;
    let hookResult: ReturnType<typeof useBrainCatalogue> | undefined;
    expect(() => {
      const { result } = renderHook(() => useBrainCatalogue());
      hookResult = result.current;
    }).not.toThrow();
    expect(hookResult?.entries).toBeNull();
    expect(hookResult?.defaultProfileId).toBe("");
    expect(mockSendCommand).not.toHaveBeenCalled();
  });
});
