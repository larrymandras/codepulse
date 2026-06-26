/**
 * useWarRoomVoice.test.ts — Phase 90 Wave-0 RED gate (ROOM-03).
 *
 * Tests the voice hook behavioral contracts:
 *   voice-join-flow  (T-90-AUTH): join() fetches POST /api/war-room/{room}/token
 *                                  with Authorization: Bearer header
 *   voice-join-muted (T-90-MIC):  join() does NOT call setMicrophoneEnabled(true)
 *   voice-toggle-mute:             toggleMute() calls setMicrophoneEnabled
 *
 * All tests are EXPECTED to fail RED until Plan 04 implements useWarRoomVoice.ts.
 * RED condition: join() / toggleMute() throw "not implemented (Plan 04)".
 *
 * The livekit-client mock is registered globally in src/test/setup.ts.
 * We re-declare it here so this file is self-documenting and to satisfy the
 * Vitest module-mock hoisting contract when these tests run in isolation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWarRoomVoice } from "./useWarRoomVoice";

// Ensure the livekit-client mock is active for this test file.
// The factory below matches src/__mocks__/livekit-client.ts (canonical reference).
vi.mock("livekit-client");

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_TOKEN_RESPONSE = {
  token: "eyJhbGciOiJIUzI1NiJ9.test",
  url: "wss://livekit.example.com",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useWarRoomVoice — ROOM-03 voice join flow (RED gate, Plan 04)", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Stub global fetch so token fetch assertions work once implemented.
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_TOKEN_RESPONSE,
    });
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Initial state (should be stable even with skeleton) ────────────────────

  it("connectionState is 'disconnected' on mount", () => {
    const { result } = renderHook(() => useWarRoomVoice());
    // Skeleton correctly initialises to 'disconnected' — this PASSES.
    expect(result.current.connectionState).toBe("disconnected");
  });

  it("isMuted is false on mount", () => {
    const { result } = renderHook(() => useWarRoomVoice());
    // Skeleton correctly initialises to false — this PASSES.
    expect(result.current.isMuted).toBe(false);
  });

  // ── join() behavioral contract (all RED until Plan 04) ─────────────────────

  it("join() resolves and fetches POST /api/war-room/{room}/token (T-90-AUTH)", async () => {
    const { result } = renderHook(() => useWarRoomVoice());

    // RED: skeleton join() rejects with "not implemented (Plan 04)".
    // Test fails here — the assertions below are the GREEN contract for Plan 04.
    await act(async () => {
      await result.current.join("test-room");
    });

    // GREEN contract: fetch must have been called exactly once.
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // GREEN contract: the URL must include the room name.
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/war-room/test-room/token");
    expect(url).toContain("/api/war-room/");
  });

  it("join() includes Authorization: Bearer header in token request (T-90-AUTH)", async () => {
    const { result } = renderHook(() => useWarRoomVoice());

    // RED: skeleton join() rejects before calling fetch.
    await act(async () => {
      await result.current.join("test-room");
    });

    // GREEN contract: Authorization header must be present and Bearer-prefixed.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts?.headers as Record<string, string> | undefined;
    expect(headers?.["Authorization"]).toMatch(/^Bearer /);
  });

  it("join() uses POST method for token fetch (T-90-AUTH)", async () => {
    const { result } = renderHook(() => useWarRoomVoice());

    // RED: skeleton join() rejects before calling fetch.
    await act(async () => {
      await result.current.join("test-room");
    });

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(opts?.method).toBe("POST");
  });

  it("join() does NOT enable mic on connect — join muted (T-90-MIC)", async () => {
    const { Room } = await import("livekit-client") as any;
    const { result } = renderHook(() => useWarRoomVoice());

    // RED: skeleton join() rejects before connecting Room.
    await act(async () => {
      await result.current.join("test-room");
    });

    // GREEN contract: setMicrophoneEnabled(true) must NOT be called during join.
    // (Mic stays muted; operator enables explicitly via toggleMute.)
    for (const instance of Room.mock?.instances ?? []) {
      expect(instance.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalledWith(true);
    }
  });

  // ── toggleMute() behavioral contract (RED until Plan 04) ─────────────────

  it("toggleMute() calls setMicrophoneEnabled (ROOM-03)", async () => {
    const { result } = renderHook(() => useWarRoomVoice());

    // RED: skeleton toggleMute() rejects with "not implemented (Plan 04)".
    // Test fails here — assertions below are the GREEN contract.
    await act(async () => {
      await result.current.toggleMute();
    });

    // GREEN contract: setMicrophoneEnabled must have been invoked.
    const { Room } = await import("livekit-client") as any;
    const room = Room.mock?.instances?.[0];
    expect(room?.localParticipant.setMicrophoneEnabled).toHaveBeenCalled();
  });

  // ── leave() behavioral contract (RED until Plan 04) ──────────────────────

  it("leave() resolves without error", async () => {
    const { result } = renderHook(() => useWarRoomVoice());

    // RED: skeleton leave() rejects with "not implemented (Plan 04)".
    await act(async () => {
      await result.current.leave();
    });

    // GREEN contract: leave() resolves cleanly; no lingering error.
    expect(result.current.connectionState).toBe("disconnected");
  });
});
