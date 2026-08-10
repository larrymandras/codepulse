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

// ─── D-14a: profile passthrough on sendMessage → chat.send ──────────────────
// Scopes SecurityContext.profile_id server-side only (Phase 99 Plan 01,
// LAUNCH-03 groundwork) — never a persona-voice switch. astridr's
// ChatSendCommand already declares `profile: str | None = None`.

describe("useAstridrChat — sendMessage profile passthrough (D-14a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-profile" });
  });

  it("sendMessage(text, { profile }) sends chat.send with profile set", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("hi", { profile: "business" });
    });
    expect(mockSendCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat.send", profile: "business" })
    );
  });

  it("sendMessage(text) with no opts sends chat.send with NO profile key", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("hi");
    });
    const call = mockSendCommand.mock.calls[0][0] as Record<string, unknown>;
    expect(call.type).toBe("chat.send");
    expect("profile" in call).toBe(false);
  });
});

// ─── CR-01 (99-07): sendMessage's success/failure return contract ───────────
// The caller (Chat.tsx auto-send) cannot tell "resolved" from "succeeded"
// unless sendMessage itself reports it. recordSkillLaunch must never fire on
// a dropped/rejected/errored send (D-12 honesty invariant).

describe("useAstridrChat — sendMessage return contract (CR-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
  });

  it("resolves true when the server ack is ok (real send)", async () => {
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-ok" });
    const { result } = renderHook(() => useAstridrChat());
    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.sendMessage("hi");
    });
    expect(sent).toBe(true);
  });

  it("resolves false when the server ack is rejected (ack.status !== 'ok')", async () => {
    mockSendCommand.mockResolvedValue({ status: "error", error: "nope" });
    const { result } = renderHook(() => useAstridrChat());
    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.sendMessage("hi");
    });
    expect(sent).toBe(false);
  });

  it("resolves false on the early guard (blank text never reaches sendCommand)", async () => {
    const { result } = renderHook(() => useAstridrChat());
    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.sendMessage("   ");
    });
    expect(sent).toBe(false);
    expect(mockSendCommand).not.toHaveBeenCalled();
  });

  it("resolves false when sendCommand throws (network failure)", async () => {
    mockSendCommand.mockRejectedValue(new Error("ws down"));
    const { result } = renderHook(() => useAstridrChat());
    let sent: boolean | undefined;
    await act(async () => {
      sent = await result.current.sendMessage("hi");
    });
    expect(sent).toBe(false);
  });
});

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

// ─── run.tts sessionMatches trace fix (2026-07-31) ───────────────────────────
// activeSessionRef is a TURN-LIFECYCLE ref, nulled by whichever terminal event
// ends a turn (run.completed / run.error / interrupt()). run.tts audio is a
// SEPARATE, asynchronously-arriving side-channel event (synthesis is slower
// than text delivery) that can legitimately arrive AFTER the terminal event
// already nulled activeSessionRef — so the sessionMatches trace diagnostic
// must compare against lastSessionRef (set alongside activeSessionRef, never
// cleared), not activeSessionRef itself. Confirmed against the REAL backend
// contract (astridr/agent/post_turn_pipeline.py): run.text is emitted once
// with the full final text and no `done` field at all (that branch is
// unreachable in production) — run.completed is the actual sole terminal
// event for a normal turn, matching the sequence exercised here.

describe("useAstridrChat — run.tts sessionMatches trace (2026-07-31 live finding)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-1" });
    (window as unknown as { __astridrVoiceTrace?: unknown[] }).__astridrVoiceTrace = [];
  });

  function lastTtsTraceEntry(): { sessionMatches?: unknown } {
    const buf = (window as unknown as { __astridrVoiceTrace?: Array<{ ev: string; d: Record<string, unknown> }> })
      .__astridrVoiceTrace;
    const entries = (buf ?? []).filter((e) => e.ev === "run.tts.received");
    return entries[entries.length - 1]?.d ?? {};
  }

  it("sessionMatches reads true when run.tts arrives AFTER run.completed already nulled activeSessionRef", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    // The real terminal event for a normal turn — nulls activeSessionRef.
    act(() => {
      getHandler("run.completed")?.({ data: { session_id: "sess-1" } });
    });

    // run.tts arrives afterward, same session — this is the normal case,
    // not an edge case, since TTS synthesis is slower than text delivery.
    act(() => {
      getHandler("run.tts")?.({ data: { session_id: "sess-1", audio_url: "http://a/reply.mp3" } });
    });

    expect(lastTtsTraceEntry().sessionMatches).toBe(true);
  });

  it("sessionMatches reads false when run.tts belongs to a DIFFERENT (stale/foreign) session", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      getHandler("run.completed")?.({ data: { session_id: "sess-1" } });
    });

    act(() => {
      getHandler("run.tts")?.({ data: { session_id: "sess-999-foreign", audio_url: "http://a/foreign.mp3" } });
    });

    expect(lastTtsTraceEntry().sessionMatches).toBe(false);
  });

  // ─── 188.1 UAT finding (2026-08-06 live, 21:35:39.784) ───────────────────
  // The two tests above assert only the TRACE FIELD. They passed the whole
  // time while a foreign session's audio played anyway, because `willPlay`
  // (useAstridrChat.ts:368) never included the session comparison that the
  // line below it already computes for the trace. Live evidence:
  //   run.tts.received {"sessionMatches":false,"activeSession":"f2a1cc4d…","willPlay":true}
  //   tts.audio.replace {"currentTime":0.41,"duration":4.88}
  // — a superseded turn's reply started speaking and was cut 0.41s in.
  //
  // These two assert the BEHAVIOR (playAudio called / not called), not the
  // diagnostic. A test that only checks the trace field cannot catch this.
  it("does NOT play audio when run.tts belongs to a DIFFERENT (stale/foreign) session", async () => {
    const { result } = renderHook(() => useAstridrChat());
    // ttsEnabled defaults to false (useAstridrChat.ts:58), which would make
    // `willPlay` false for EVERY session and this assertion vacuous. Turn it
    // on so the only thing under test is the session comparison.
    act(() => {
      result.current.setTtsEnabled(true);
    });
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      getHandler("run.completed")?.({ data: { session_id: "sess-1" } });
    });

    act(() => {
      getHandler("run.tts")?.({ data: { session_id: "sess-999-foreign", audio_url: "http://a/foreign.mp3" } });
    });

    expect(mockTtsPlay).not.toHaveBeenCalled();
  });

  // The control that keeps the fix from over-blocking: the NORMAL case is
  // run.tts arriving after run.completed already nulled activeSessionRef.
  // If the gate compared against activeSessionRef instead of lastSessionRef
  // it would suppress every ordinary reply — this test fails loudly if so.
  it("DOES play audio for the active session even when run.tts lands after run.completed", async () => {
    const { result } = renderHook(() => useAstridrChat());
    act(() => {
      result.current.setTtsEnabled(true);
    });
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      getHandler("run.completed")?.({ data: { session_id: "sess-1" } });
    });

    act(() => {
      getHandler("run.tts")?.({ data: { session_id: "sess-1", audio_url: "http://a/reply.mp3" } });
    });

    expect(mockTtsPlay).toHaveBeenCalledWith("http://a/reply.mp3");
  });
});

// ─── 186-01 follow-up (Defect A, fresh live trace, 186-09 swap testing) ──────
// ws_commands.py::_handle_chat_send's control-verb fast-path short-circuit
// (swap refusals/confirmations, focus/quiet-hours toggles, catalogue
// answers) NEVER emits run.text — only run.blocks with a single TextBlockData
// (confirmed by reading the actual backend source, not assumed). Without a
// backfill, streamingReplyRef stays "" for the whole reply, and useAstridrVoice's
// echo fingerprint has nothing to compare against — the live trace: her own
// deterministic refusal ("I couldn't find...") barged itself 0.9s after
// tts.start, because isEchoOfReply's `if (!reply) return false` treated the
// growing interim as "definitely not echo".

describe("useAstridrChat — run.blocks text backfill for streamingReplyRef (186-01 Defect A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-1" });
  });

  it("a control-verb fast-path reply (run.blocks only, no run.text) populates streamingReplyRef", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("change your brain to Kimmy K3");
    });

    // No run.text at all for this reply shape — only run.blocks, mirroring
    // ws_commands.py's exact fast-path payload shape.
    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "text", text: "I couldn't find a 'Kimmy K3' brain." }],
          round_num: 0,
        },
      });
    });

    let partial = "";
    act(() => {
      partial = result.current.interrupt();
    });
    expect(partial).toBe("I couldn't find a 'Kimmy K3' brain.");
  });

  it("a normal turn's run.blocks (arriving AFTER run.text already populated it) does NOT double-append", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    act(() => {
      getHandler("run.text")?.({ data: { session_id: "sess-1", text_chunk: "Tomorrow brings rain" } });
      // post_turn_pipeline.py emits run.text THEN run.blocks with the
      // identical final text, in that order, over the same turn.
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "text", text: "Tomorrow brings rain" }],
          round_num: 0,
        },
      });
    });

    let partial = "";
    act(() => {
      partial = result.current.interrupt();
    });
    expect(partial).toBe("Tomorrow brings rain"); // NOT "Tomorrow brings rainTomorrow brings rain"
  });

  it("run.blocks with a non-text block (e.g. tool_use) does not populate streamingReplyRef", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("do something");
    });

    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "tool_use", name: "some_tool", arguments: {} }],
          round_num: 0,
        },
      });
    });

    let partial = "";
    act(() => {
      partial = result.current.interrupt();
    });
    expect(partial).toBe("");
  });

  // ─── 188.3-06 (D-10/D-11/T-188.3-17..20): run.blocks session gate ─────────
  // Modeled directly on the run.tts foreign-session suite above (:258-328) —
  // same swap of event name and observable. The direct predecessor bug on
  // run.tts was a session check computed as a TRACE FIELD only, with a test
  // asserting the diagnostic instead of the behavior; that test stayed green
  // while a foreign session's audio played anyway. These assert BEHAVIOR
  // (message count + the streamingTextRef mirror via interrupt()), never a
  // trace field.

  it("BLOCKS-FOREIGN: a run.blocks event carrying a foreign session_id appends no bubble and leaves streamingTextRef untouched", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    // The real terminal event for a normal turn — nulls activeSessionRef, so
    // the state matches how a foreign run.blocks actually arrives in
    // production (after the turn's own text/completion already landed).
    act(() => {
      getHandler("run.completed")?.({ data: { session_id: "sess-1" } });
    });

    const messagesBefore = result.current.messages.length;

    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-999-foreign",
          blocks: [{ type: "text", text: "a foreign reply that must not land" }],
          round_num: 0,
        },
      });
    });

    // Behavior 1: no new assistant bubble was appended.
    expect(result.current.messages.length).toBe(messagesBefore);

    // Behavior 2: streamingTextRef was NOT mutated by the foreign event —
    // observed through interrupt(), the same observable the existing
    // control-verb fast-path test (:349-372) uses.
    let partial = "";
    act(() => {
      partial = result.current.interrupt();
    });
    expect(partial).toBe("");
  });

  it("CTRL-BLOCKS-NO-SESSION: a run.blocks event with no session_id key at all still backfills and appends (fail open)", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("change your brain to Kimmy K3");
    });

    const messagesBefore = result.current.messages.length;

    // No session_id key at all — an absent session_id must fail OPEN,
    // exactly as the run.tts gate does (:437).
    act(() => {
      getHandler("run.blocks")?.({
        data: {
          blocks: [{ type: "text", text: "I couldn't find a 'Kimmy K3' brain." }],
          round_num: 0,
        },
      });
    });

    // The backfill DID happen and the bubble WAS appended.
    expect(result.current.messages.length).toBe(messagesBefore + 1);

    let partial = "";
    act(() => {
      partial = result.current.interrupt();
    });
    expect(partial).toBe("I couldn't find a 'Kimmy K3' brain.");
  });

  // The control that keeps the fix from over-blocking: the NORMAL case is
  // run.blocks arriving after run.completed already nulled activeSessionRef
  // (TTS/blocks synthesis can trail run.completed the same way run.tts does).
  // If the gate compared against activeSessionRef instead of lastSessionRef
  // it would suppress this in-session event — the direct run.blocks analogue
  // of the run.tts control at :311-328. This fixture is what makes the ref
  // choice load-bearing: added after Task 3's mutation proved the prior three
  // fixtures alone could not distinguish the two refs (both reject a foreign
  // session_id equally, and both accept when session_id is absent).
  it("CTRL-BLOCKS-AFTER-COMPLETED: an in-session run.blocks event arriving AFTER run.completed still backfills and appends", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      getHandler("run.completed")?.({ data: { session_id: "sess-1" } });
    });

    const messagesBefore = result.current.messages.length;

    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "text", text: "a late in-session reply" }],
          round_num: 0,
        },
      });
    });

    expect(result.current.messages.length).toBe(messagesBefore + 1);

    let partial = "";
    act(() => {
      partial = result.current.interrupt();
    });
    expect(partial).toBe("a late in-session reply");
  });
});

// ─── 186-09 deferred item option (b): correctAssistantMessage ───────────────
// Pairs with the backend's chat.correction WS event (wiring.py's
// _generate_chat_tts sink) -- Chat.tsx's subscription (Chat.test.tsx covers
// the wiring) calls this to patch the matching assistant bubble in place.

describe("useAstridrChat — correctAssistantMessage (186-09 deferred item)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-1" });
  });

  it("replaces the matching assistant message's content by sessionId", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("swap to sonnet 5");
    });

    // sendMessage appends BOTH the user message (index 0, no sessionId) and
    // the streaming assistant placeholder (index 1, carries sessionId).
    expect(result.current.messages).toHaveLength(2);
    const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
    expect(assistantMsg?.sessionId).toBe("sess-1");

    act(() => {
      result.current.correctAssistantMessage("sess-1", "Swapped to Claude Sonnet 5.");
    });

    expect(result.current.messages).toHaveLength(2);
    const corrected = result.current.messages.find((m) => m.role === "assistant");
    expect(corrected?.content).toBe("Swapped to Claude Sonnet 5.");
  });

  it("clears any generative blocks so the corrected plain text renders", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("swap to sonnet 5");
    });

    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "text", text: "stale fabricated model name" }],
          round_num: 0,
        },
      });
    });
    const beforeCorrection = result.current.messages.find((m) => m.role === "assistant");
    expect(beforeCorrection?.blocks).toBeDefined();

    act(() => {
      result.current.correctAssistantMessage("sess-1", "Swapped to Claude Sonnet 5.");
    });

    const afterCorrection = result.current.messages.find((m) => m.role === "assistant");
    expect(afterCorrection?.blocks).toBeUndefined();
    expect(afterCorrection?.content).toBe("Swapped to Claude Sonnet 5.");
  });

  it("is a no-op when no message matches the sessionId", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("swap to sonnet 5");
    });

    act(() => {
      result.current.correctAssistantMessage("some-other-session", "Should not apply.");
    });

    const assistantMsg = result.current.messages.find((m) => m.role === "assistant");
    expect(assistantMsg?.content).toBe("");
  });

  it("never touches the user's own message, only the assistant reply", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("swap to sonnet 5");
    });

    const userMsgBefore = result.current.messages.find((m) => m.role === "user");
    expect(userMsgBefore?.content).toBe("swap to sonnet 5");

    act(() => {
      result.current.correctAssistantMessage("sess-1", "Corrected.");
    });

    const userMsgAfter = result.current.messages.find((m) => m.role === "user");
    expect(userMsgAfter?.content).toBe("swap to sonnet 5"); // unchanged
  });
});

// ─── D-08 (188.3-05): continuation-merge supersedes the prior user bubble ───
// Live trace, 22:16:51.639 / 22:16:56.437: two utterances produced TWO user
// bubbles ("Right now." / "Right now. Right now.") and THREE assistant
// replies. flushSend's continuation-merge branch already cancels the prior
// turn via interrupt("continuation-merge") before resending the merged text —
// but sendMessage always APPENDS, so the merge still shows up as a second
// bubble. This closes that gap: a caller-supplied `supersedes` id patches the
// prior user message in place instead of appending a second one.
//
// SUPERSEDE-1 is the signal (one bubble survives, same id, merged content).
// CTRL-NORMAL-APPENDS is the negative-space control (no supersede option ⇒
// both sends append) — without it, a supersede implementation that swallowed
// EVERY send would pass SUPERSEDE-1 and this file would never know.
//
// Mechanism used to get the second send past sendMessage's
// `isStreamingRef.current` early return (:133): call `interrupt()` between
// the two sends, mirroring flushSend's OWN real ordering — the merge branch
// calls `chatRef.current.interrupt("continuation-merge")` immediately before
// `sendMessage` (useAstridrVoice.ts flushSend), which is what clears
// `isStreamingRef` so the guard is passable at all.

describe("useAstridrChat — continuation-merge supersede path (D-08/188.3-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-1" });
  });

  it("SUPERSEDE-1: a continuation-merge send patches the prior user bubble in place instead of appending a second one", async () => {
    const { result } = renderHook(() => useAstridrChat());

    await act(async () => {
      await result.current.sendMessage("do I have any calendar entries this afternoon", {
        clientMessageId: "voice-msg-1",
      });
    });
    const userMessagesAfterFirst = result.current.messages.filter((m) => m.role === "user");
    expect(userMessagesAfterFirst).toHaveLength(1);
    const firstId = userMessagesAfterFirst[0].id;

    // Mirror flushSend's real ordering: the continuation-merge branch calls
    // interrupt() BEFORE sendMessage, which is what clears isStreamingRef so
    // the second send's guard (:133) is passable at all.
    act(() => {
      result.current.interrupt("continuation-merge");
    });

    await act(async () => {
      await result.current.sendMessage(
        "do I have any calendar entries this afternoon for my personal",
        { clientMessageId: "voice-msg-2", supersedes: firstId }
      );
    });

    const userMessagesAfterSecond = result.current.messages.filter((m) => m.role === "user");
    // RED before the production edit: the supersede option does not exist
    // yet, so the second send appends and this is 2, not 1.
    expect(userMessagesAfterSecond).toHaveLength(1);
    // The surviving bubble keeps the FIRST message's id — same-id patch-in-
    // place is what keeps Chat.tsx's key={msg.id} stable across the merge.
    expect(userMessagesAfterSecond[0].id).toBe(firstId);
    expect(userMessagesAfterSecond[0].content).toBe(
      "do I have any calendar entries this afternoon for my personal"
    );
    // Only reachable once the assertions above pass (i.e. post-implementation):
    // confirms the caller-supplied id, not generateId(), became the message id.
    expect(firstId).toBe("voice-msg-1");
  });

  it("CTRL-NORMAL-APPENDS: two ordinary sends with no supersede option both append distinct bubbles", async () => {
    const { result } = renderHook(() => useAstridrChat());

    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      result.current.interrupt("flush-send");
    });
    await act(async () => {
      await result.current.sendMessage("what about tomorrow");
    });

    const userMessages = result.current.messages.filter((m) => m.role === "user");
    expect(userMessages).toHaveLength(2);
    expect(userMessages[0].content).toBe("what's the weather");
    expect(userMessages[1].content).toBe("what about tomorrow");
    expect(userMessages[0].id).not.toBe(userMessages[1].id);
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

// 184 code-review CR-02: the handler only answers frame_requests for its OWN
// active session, so every round-trip test must first establish one via a
// real chat.send ack (mirrors production: sendMessage always precedes the
// see_screen push for the same session).
async function establishSession(
  result: { current: ReturnType<typeof useAstridrChat> },
  sess: string
): Promise<void> {
  mockSendCommand.mockResolvedValueOnce({ status: "ok", session_id: sess });
  await act(async () => {
    await result.current.sendMessage("establish session");
  });
  mockSendCommand.mockClear();
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
    await establishSession(result, "sess-1");

    await act(async () => {
      await getHandler("vision.frame_request")?.({
        data: { request_id: "freq-1", session_id: "sess-1" },
      });
    });

    expect(mockCaptureFrame).toHaveBeenCalledTimes(1);
    const call = findFrameReplyCall();
    expect(call).toEqual(
      expect.objectContaining({
        type: "vision.frame_reply",
        frame_request_id: "freq-1",
        session_id: "sess-1",
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
      await getHandler("vision.frame_request")?.({ data: { session_id: "sess-x" } });
    });

    expect(mockCaptureFrame).not.toHaveBeenCalled();
    expect(findFrameReplyCall()).toBeUndefined();
  });

  it("ignores a vision.frame_request with no session_id (VisionFrameReplyCommand requires it — T-184-11)", async () => {
    const mockCaptureFrame = vi.fn();
    const { result } = renderHook(() => useAstridrChat());
    act(() => {
      result.current.registerScreenShare({ state: "active", captureFrame: mockCaptureFrame });
    });

    await act(async () => {
      await getHandler("vision.frame_request")?.({ data: { request_id: "freq-x" } });
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
    await establishSession(result, "sess-2");

    await act(async () => {
      await getHandler("vision.frame_request")?.({
        data: { request_id: "freq-2", session_id: "sess-2" },
      });
    });

    expect(mockCaptureFrame).not.toHaveBeenCalled();
    const call = findFrameReplyCall();
    expect(call?.frame_request_id).toBe("freq-2");
    expect(call?.session_id).toBe("sess-2");
    expect(call?.frame).toBeUndefined();
  });

  it("Task 2: a captureFrame failure (ended track) still replies honestly with no frame", async () => {
    const mockCaptureFrame = vi.fn().mockRejectedValue(new Error("Screen share track is not live"));
    const { result } = renderHook(() => useAstridrChat());

    act(() => {
      result.current.registerScreenShare({ state: "active", captureFrame: mockCaptureFrame });
    });
    await establishSession(result, "sess-3");

    await act(async () => {
      await getHandler("vision.frame_request")?.({
        data: { request_id: "freq-3", session_id: "sess-3" },
      });
    });

    expect(mockCaptureFrame).toHaveBeenCalledTimes(1);
    const call = findFrameReplyCall();
    expect(call?.frame_request_id).toBe("freq-3");
    expect(call?.session_id).toBe("sess-3");
    expect(call?.frame).toBeUndefined();
  });

  it("with no registered screenShare (default), still replies honestly with no frame", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await establishSession(result, "sess-4");

    await act(async () => {
      await getHandler("vision.frame_request")?.({
        data: { request_id: "freq-4", session_id: "sess-4" },
      });
    });

    const call = findFrameReplyCall();
    expect(call?.frame_request_id).toBe("freq-4");
    expect(call?.session_id).toBe("sess-4");
    expect(call?.frame).toBeUndefined();
  });

  it("CR-02: DROPS a frame_request for a different session — no reply, no capture (T-184-11 client half)", async () => {
    // frame_request pushes fan out to every connected WS client; a tab whose
    // active session was NOT asked must stay silent. Replying (even empty)
    // would resolve the pending Future and prematurely honest-fail the
    // requesting tab's legit turn; capturing would answer with the WRONG
    // screen and defeat the backend's session-scoped resolve (T-184-11).
    const mockCaptureFrame = vi.fn();
    const { result } = renderHook(() => useAstridrChat());
    act(() => {
      result.current.registerScreenShare({ state: "active", captureFrame: mockCaptureFrame });
    });
    await establishSession(result, "sess-mine");

    await act(async () => {
      await getHandler("vision.frame_request")?.({
        data: { request_id: "freq-hijack", session_id: "sess-other-tab" },
      });
    });

    expect(mockCaptureFrame).not.toHaveBeenCalled();
    expect(findFrameReplyCall()).toBeUndefined();
  });
});

// ─── D-01 (188.4-01): merge-path empty assistant bubble prune ───────────────
// 188.3-SMOKE.md's Open table recorded this as "Found live this plan, NOT
// fixed… cosmetic, reproducible, unowned": an empty ÁSTRÍÐR bubble renders
// ahead of every merged-continuation reply because interrupt() only ever
// FLIPS every streaming message to streaming:false — it never removes one
// that never received any content or blocks. This closes it at the site that
// creates the artifact (interrupt()'s own setMessages pass), without
// touching the control-verb fast-path (content:"" WITH blocks) or the
// legitimate thinking cursor (content:"" streaming:true, no interrupt yet).

describe("useAstridrChat — interrupt() prunes the empty merge-path assistant bubble (D-01, 188.4-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-1" });
  });

  it("PRUNE-MERGE-PATH-EMPTY: interrupt() on the merge path removes the still-empty assistant placeholder outright", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    const placeholder = result.current.messages.find((m) => m.role === "assistant");
    expect(placeholder).toBeDefined();
    expect(placeholder?.content).toBe("");
    expect(placeholder?.streaming).toBe(true);

    // Nothing has streamed yet — mirrors useAstridrVoice.ts's real merge-path
    // ordering (chatRef.current.interrupt("continuation-merge") fires before
    // the merged resend, sometimes before any run.text chunk has arrived).
    act(() => {
      result.current.interrupt("continuation-merge");
    });

    const assistantMessagesAfter = result.current.messages.filter((m) => m.role === "assistant");
    expect(assistantMessagesAfter).toHaveLength(0);
    expect(result.current.messages.some((m) => m.id === placeholder!.id)).toBe(false);
  });

  it('CTRL-PRUNE-KEEPS-BLOCKS: a control-verb fast-path reply (content:"" WITH blocks) survives interrupt(), merely flipped to streaming:false', async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("change your brain to Kimmy K3");
    });

    // Drive the blocks arrival through the REAL run.blocks handler — the
    // control-verb fast-path shape (ws_commands.py) — not hand-constructed
    // state, per the plan's action instructions.
    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "text", text: "I couldn't find a 'Kimmy K3' brain." }],
          round_num: 0,
        },
      });
    });

    const beforeInterrupt = result.current.messages.find((m) => m.role === "assistant");
    expect(beforeInterrupt?.content).toBe("");
    expect(beforeInterrupt?.blocks?.length).toBeGreaterThan(0);

    act(() => {
      result.current.interrupt("continuation-merge");
    });

    const afterInterrupt = result.current.messages.find((m) => m.role === "assistant");
    expect(afterInterrupt).toBeDefined();
    expect(afterInterrupt?.blocks?.length).toBeGreaterThan(0);
    expect(afterInterrupt?.streaming).toBe(false);
  });

  it('CTRL-PRUNE-KEEPS-THINKING-CURSOR: a still in-flight {content:"", streaming:true} placeholder is untouched when no interrupt has run', async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    const placeholder = result.current.messages.find((m) => m.role === "assistant");
    expect(placeholder).toBeDefined();
    expect(placeholder?.content).toBe("");
    expect(placeholder?.streaming).toBe(true);
  });

  it("CTRL-PRUNE-KEEPS-CONTENT: an assistant message that HAS content is never pruned by any interrupt, including a barge-in", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    act(() => {
      getHandler("run.text")?.({ data: { session_id: "sess-1", text_chunk: "Tomorrow brings rain" } });
    });

    act(() => {
      result.current.interrupt(); // unattributed — same barge-in code path
    });

    const survivor = result.current.messages.find((m) => m.role === "assistant");
    expect(survivor).toBeDefined();
    expect(survivor?.content).toBe("Tomorrow brings rain");
    expect(survivor?.streaming).toBe(false);
  });
});

// ─── D-02 (188.4-01): a late run.blocks after interrupt() resurrects with ────
// streaming:false, not a dangling cursor. Once D-01's prune removes the
// merge-path placeholder, a `run.blocks` frame that arrives afterward for the
// same session no longer finds a matching streaming message to merge into —
// it falls into the else-branch's brand-new-message append (:395-411), whose
// literal `streaming: true` would leave an orphaned stream-cursor with
// nothing left to ever clear it (interrupt() already ran; no further
// run.completed/run.error is coming for a superseded turn). This section
// pins that the append instead reads `activeSessionRef.current !== null` —
// true while a turn is genuinely in flight, false once interrupt() has
// nulled it — while leaving the run.blocks session GATE (:306) untouched.

describe("useAstridrChat — late run.blocks after interrupt() resurrects with streaming:false (D-02, 188.4-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeEvent.mockImplementation(() => () => {});
    mockSendCommand.mockResolvedValue({ status: "ok", session_id: "sess-1" });
  });

  it("LATE-BLOCKS-AFTER-INTERRUPT-RESURRECT: a run.blocks frame whose session_id matches lastSessionRef, arriving after interrupt() pruned the placeholder, still appends but with streaming:false", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    // D-01's prune removes the empty placeholder outright — nulls
    // activeSessionRef but leaves lastSessionRef set, exactly the asymmetry
    // this resurrect branch reads.
    act(() => {
      result.current.interrupt("continuation-merge");
    });

    const messagesBefore = result.current.messages.length;

    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "text", text: "a late block arriving after interrupt" }],
          round_num: 0,
        },
      });
    });

    expect(result.current.messages.length).toBe(messagesBefore + 1);
    const appended = result.current.messages[result.current.messages.length - 1];
    expect(appended.role).toBe("assistant");
    expect(appended.blocks?.[0]).toMatchObject({
      type: "text",
      text: "a late block arriving after interrupt",
    });
    // The behavior under test: no dangling cursor.
    expect(appended.streaming).toBe(false);
  });

  it("CTRL-BLOCKS-STILL-IN-FLIGHT: a run.blocks frame that hits the else-branch while a turn is genuinely in flight still appends with streaming:true", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });

    // Force the else-branch WITHOUT completing or interrupting the turn:
    // append a local, non-streaming assistant message (a real hook API —
    // appendLocalAssistantMessage) so it becomes `last` and no longer
    // matches the if-branch's (streaming && sessionId===payload.session_id)
    // predicate. activeSessionRef stays non-null throughout — the turn is
    // genuinely still in flight, which is the over-block this control
    // guards: the fix must not flatten the normal streaming append.
    act(() => {
      result.current.appendLocalAssistantMessage("a local aside, unrelated to the streaming turn");
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-1",
          blocks: [{ type: "text", text: "still streaming reply chunk" }],
          round_num: 1,
        },
      });
    });

    const appended = result.current.messages[result.current.messages.length - 1];
    expect(appended.blocks?.[0]).toMatchObject({ type: "text", text: "still streaming reply chunk" });
    expect(appended.streaming).toBe(true);
  });

  it("CTRL-BLOCKS-UNKNOWN-SESSION-STILL-GATED: a run.blocks frame whose session_id matches NEITHER ref is still dropped after interrupt() (the gate is unchanged)", async () => {
    const { result } = renderHook(() => useAstridrChat());
    await act(async () => {
      await result.current.sendMessage("what's the weather");
    });
    act(() => {
      result.current.interrupt("continuation-merge");
    });

    const messagesBefore = result.current.messages.length;

    act(() => {
      getHandler("run.blocks")?.({
        data: {
          session_id: "sess-totally-unrelated",
          blocks: [{ type: "text", text: "must not land" }],
          round_num: 0,
        },
      });
    });

    expect(result.current.messages.length).toBe(messagesBefore);
  });
});
