/**
 * useAstridrChat — the conversation engine behind the Ástríðr presence page
 * (/chat). Extracted from Chat.tsx so the streaming/dedup/TTS/approval logic
 * has ONE home. Owns: messages, send, the run.text/run.blocks/run.tts/
 * run.completed/run.error WS subscriptions, TTS enable + playback,
 * interrupt (barge-in), and approve/reject. UI concerns (scroll, transcript,
 * input box) stay in the consumer; voice orchestration is useAstridrVoice.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useTtsPlayback } from "@/hooks/useTtsPlayback";
import { useApprovalActions } from "@/components/ApprovalActions";
import type { ChatMessage, GenerativeBlock } from "@/types/generative-blocks";
import type { ScreenShareState, CaptureFrameOptions, CapturedFrame } from "@/hooks/useScreenShare";

function generateId(): string {
  return crypto.randomUUID();
}

// ─── vision.frame_request round-trip (VISION-01, D-01 backend half + D-02) ──
// Closes the backend-initiated `see_screen` loop: the server pushes
// `vision.frame_request` (T-184-17/18) when the model calls the tool for a
// phrasing the client regex missed; this hook captures a FRESH frame and
// replies with `vision.frame_reply`. Chat.tsx creates `chat` BEFORE the
// page's SOLE `useScreenShare()` instance (voice needs it too), so the live
// instance can't be passed as a call-time option — `registerScreenShare` lets
// useAstridrVoice.ts (which receives both `chat` and `screenShare`) hand it
// over post-mount. Never opens the picker itself — read-only over an
// already-consented share.
export interface ScreenShareLike {
  state: ScreenShareState;
  captureFrame: (options?: CaptureFrameOptions) => Promise<CapturedFrame>;
}

const NOOP_SCREEN_SHARE: ScreenShareLike = {
  state: "idle",
  captureFrame: async () => {
    throw new Error("screenShare not registered on useAstridrChat");
  },
};

export function useAstridrChat() {
  const { status, sendCommand, subscribeEvent } = useAstridrWS();
  const { approve, reject } = useApprovalActions(sendCommand);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Synchronous mirror of isStreaming for the send guard: interrupt() must
  // unblock sendMessage IN THE SAME TICK (the voice layer interrupts and then
  // immediately sends the barged-in utterance — a state read would still see
  // the pre-interrupt value and silently drop the message).
  const isStreamingRef = useRef(false);
  const setStreaming = useCallback((v: boolean) => {
    isStreamingRef.current = v;
    setIsStreaming(v);
  }, []);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const { play: playAudio, stop: stopAudio, isPlaying: ttsIsPlaying } = useTtsPlayback();

  const activeSessionRef = useRef<string | null>(null);

  // VISION-01: the live screenShare instance, handed over post-mount by
  // useAstridrVoice.ts (see registerScreenShare doc comment above).
  const screenShareRef = useRef<ScreenShareLike>(NOOP_SCREEN_SHARE);
  const registerScreenShare = useCallback((share: ScreenShareLike) => {
    screenShareRef.current = share;
  }, []);

  // Mirrors the active streaming reply's text for use inside callbacks without
  // a stale closure — interrupt() needs the LATEST streamed text at the moment
  // a barge-in fires (D-11: sourced only from her own streamed text).
  const streamingTextRef = useRef("");

  // Interrupt latch: after a barge-in, TTS chunks from the CANCELLED turn can
  // still arrive (server in flight) — without this they auto-play and she
  // "keeps talking" right after being stopped. Cleared on the next send.
  const ttsSuppressedRef = useRef(false);

  // ─── Send ────────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (
      text: string,
      opts?: {
        interruptedReply?: string;
        voice?: boolean;
        /** D-05: a fresh captured frame (base64 JPEG, no `data:` prefix) to attach to this turn. */
        frame?: string;
        /** e.g. "image/jpeg" — required alongside `frame`. */
        frameMimeType?: string;
      }
    ) => {
      if (!text.trim() || isStreamingRef.current || status !== "connected") return;

      setMessages((prev) => [
        ...prev,
        { id: generateId(), role: "user", content: text, streaming: false, timestamp: Date.now() },
      ]);

      try {
        // D-12: thread the barged-in partial reply (if any) into this turn so
        // "continue" resumes the interrupted reply server-side. voice:true
        // marks a SPOKEN turn — the backend answers in short conversational
        // speech instead of full-detail text. frame/frame_mime_type (D-05)
        // attach a fresh vision-intent capture to this SAME turn — no extra
        // hop, same single chat.send.
        const ack = await sendCommand({
          type: "chat.send",
          message: text,
          ...(opts?.interruptedReply ? { interrupted_reply: opts.interruptedReply } : {}),
          ...(opts?.voice ? { voice: true } : {}),
          ...(opts?.frame ? { frame: opts.frame, frame_mime_type: opts.frameMimeType } : {}),
        });

        if (ack.status !== "ok") {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: "assistant",
              content: `Error: ${ack.error ?? "Command failed"}`,
              streaming: false,
              timestamp: Date.now(),
            },
          ]);
          return;
        }

        const sessionId =
          (ack.session_id as string | undefined) ??
          (ack.data?.session_id as string | undefined) ??
          generateId();
        activeSessionRef.current = sessionId;
        streamingTextRef.current = "";
        ttsSuppressedRef.current = false; // new turn — her voice is welcome again

        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant", content: "", streaming: true, timestamp: Date.now(), sessionId },
        ]);
        setStreaming(true);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            streaming: false,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [status, sendCommand, setStreaming]
  );

  // ─── Receive (streaming events) ──────────────────────────────────────────
  useEffect(() => {
    const unsubText = subscribeEvent("run.text", (event) => {
      const data = event.data as
        | { session_id?: string; text?: string; text_chunk?: string; done?: boolean }
        | undefined;
      if (!data) return;
      const { session_id, done } = data;
      const text = data.text_chunk ?? data.text;
      if (session_id && session_id !== activeSessionRef.current) return;

      if (text) streamingTextRef.current += text;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "assistant" && msg.streaming
            ? { ...msg, content: msg.content + (text ?? ""), streaming: done ? false : true }
            : msg
        )
      );

      if (done) {
        setIsStreaming(false);
        activeSessionRef.current = null;
      }
    });

    // run.blocks — accumulate GenerativeBlocks; approval-resolution blocks update
    // in place by requestId; identical blocks within one message are deduped
    // (the backend double-delivers run.blocks; see Chat.tsx history).
    const unsubBlocks = subscribeEvent("run.blocks", (event) => {
      const data = (event as { data?: unknown }).data ?? event;
      const payload = data as { session_id?: string; blocks?: GenerativeBlock[] };
      const blocks = payload?.blocks;
      if (!blocks || blocks.length === 0) return;

      setMessages((prev) => {
        const seenRequestIds = new Set<string>();
        for (const msg of prev) {
          for (const block of msg.blocks ?? []) {
            if (block.type === "approval") {
              seenRequestIds.add((block as { requestId: string }).requestId);
            }
          }
        }

        const updateMap = new Map<string, GenerativeBlock>();
        const appends: GenerativeBlock[] = [];
        for (const block of blocks) {
          if (block.type === "approval") {
            const requestId = (block as { requestId: string }).requestId;
            if (seenRequestIds.has(requestId)) {
              updateMap.set(requestId, block);
              continue;
            }
          }
          appends.push(block);
        }

        const updateApplied =
          updateMap.size === 0
            ? prev
            : prev.map((msg) => {
                if (!msg.blocks || msg.blocks.length === 0) return msg;
                let changed = false;
                const nextBlocks = msg.blocks.map((block) => {
                  if (block.type !== "approval") return block;
                  const requestId = (block as { requestId: string }).requestId;
                  const incoming = updateMap.get(requestId);
                  if (!incoming) return block;
                  changed = true;
                  return { ...block, ...incoming };
                });
                return changed ? { ...msg, blocks: nextBlocks } : msg;
              });

        if (appends.length === 0) return updateApplied;

        const last = updateApplied[updateApplied.length - 1];
        if (last && last.role === "assistant" && last.streaming && last.sessionId === payload.session_id) {
          const existing = last.blocks ?? [];
          const seen = new Set(existing.map((bl) => JSON.stringify(bl)));
          const fresh = appends.filter((bl) => {
            const s = JSON.stringify(bl);
            if (seen.has(s)) return false;
            seen.add(s);
            return true;
          });
          if (fresh.length === 0) return updateApplied;
          return [...updateApplied.slice(0, -1), { ...last, blocks: [...existing, ...fresh] }];
        } else {
          const seen = new Set<string>();
          const fresh = appends.filter((bl) => {
            const s = JSON.stringify(bl);
            if (seen.has(s)) return false;
            seen.add(s);
            return true;
          });
          return [
            ...updateApplied,
            {
              id: generateId(),
              role: "assistant" as const,
              blocks: fresh,
              streaming: true,
              timestamp: Date.now(),
              sessionId: payload.session_id,
            },
          ];
        }
      });
    });

    const unsubTts = subscribeEvent("run.tts", (event) => {
      const data = event.data as { session_id?: string; audio_url?: string } | undefined;
      if (!data?.audio_url) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === "assistant" && msg.sessionId && msg.sessionId === data.session_id
            ? { ...msg, audioUrl: data.audio_url }
            : msg
        )
      );
      setTtsEnabled((current) => {
        // Post-interrupt suppression: a barged-in turn's late TTS must never
        // play ("she would not stop"). The bubble still gets its replay URL.
        if (current && !ttsSuppressedRef.current) {
          playAudio(data.audio_url!);
        } else if (current) {
          // eslint-disable-next-line no-console
          console.log("[voice] tts.suppressed — late chunk from an interrupted turn");
        }
        return current;
      });
    });

    const unsubCompleted = subscribeEvent("run.completed", (event) => {
      const data = event.data as { session_id?: string } | undefined;
      if (data?.session_id && data.session_id !== activeSessionRef.current) return;
      setMessages((prev) => prev.map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg)));
      setStreaming(false);
      activeSessionRef.current = null;
    });

    const unsubError = subscribeEvent("run.error", (event) => {
      const data = event.data as { session_id?: string; error?: string } | undefined;
      if (data?.session_id && data.session_id !== activeSessionRef.current) return;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.streaming
            ? {
                ...msg,
                content: msg.content + (msg.content ? "\n\n" : "") + `Error: ${data?.error ?? "Unknown error"}`,
                streaming: false,
              }
            : msg
        )
      );
      setStreaming(false);
      activeSessionRef.current = null;
    });

    // vision.frame_request (server→client push): the pending frame request's
    // OWN id (in `request_id`) becomes `frame_request_id` on the reply — it is
    // NEVER reused as the reply's envelope `request_id` (sendCommand assigns
    // that itself). `session_id` is REQUIRED on VisionFrameReplyCommand
    // (astridr/api/ws_commands.py) and must be echoed back verbatim from this
    // same push — it scopes resolve() to the originating session (T-184-11);
    // omitting it fails Pydantic validation and silently breaks the whole
    // round-trip. No active share, or a capture failure (ended track), still
    // gets a prompt reply with no `frame` so the backend's
    // PendingFrameRequests.resolve() returns None and see_screen fails
    // honestly instead of hanging the turn (T-184-18).
    const unsubFrameRequest = subscribeEvent("vision.frame_request", async (event) => {
      const data = event.data as { request_id?: string; session_id?: string } | undefined;
      const frameRequestId = data?.request_id;
      const sessionId = data?.session_id;
      if (!frameRequestId || !sessionId) return;
      // 184 code-review CR-02: frame_request pushes fan out to EVERY connected
      // WS client — only the tab whose active session was asked may answer.
      // Echoing a foreign session_id would defeat the backend's session-scoped
      // resolve (T-184-11) and answer with the WRONG screen. Drop silently:
      // the requesting tab replies; an empty reply from us would prematurely
      // honest-fail its legit turn.
      if (sessionId !== activeSessionRef.current) return;

      const share = screenShareRef.current;
      if (share.state !== "active") {
        await sendCommand({
          type: "vision.frame_reply",
          frame_request_id: frameRequestId,
          session_id: sessionId,
        }).catch(() => {});
        return;
      }

      try {
        const frame = await share.captureFrame();
        await sendCommand({
          type: "vision.frame_reply",
          frame_request_id: frameRequestId,
          session_id: sessionId,
          frame: frame.base64,
          frame_mime_type: frame.mimeType,
        });
      } catch {
        await sendCommand({
          type: "vision.frame_reply",
          frame_request_id: frameRequestId,
          session_id: sessionId,
        }).catch(() => {});
      }
    });

    return () => {
      unsubText();
      unsubBlocks();
      unsubTts();
      unsubCompleted();
      unsubError();
      unsubFrameRequest();
    };
  }, [subscribeEvent, sendCommand, playAudio, setStreaming]);

  // ─── Interrupt (barge-in, CONV-01) ───────────────────────────────────────
  // Cuts TTS instantly, cancels the in-flight server turn, finalizes the
  // streaming message in the thread, and returns the partial reply text so the
  // caller can thread it into the next send (D-11/D-12). Safe to call when
  // nothing is streaming — returns "".
  const interrupt = useCallback((): string => {
    stopAudio();
    ttsSuppressedRef.current = true; // late chunks from this turn stay silent
    const partial = streamingTextRef.current;
    const session = activeSessionRef.current;
    if (session) {
      void sendCommand({
        type: "agent.stop",
        request_id: generateId(),
        session_id: session,
      }).catch(() => {
        /* run may already be over — the interrupt still happened locally */
      });
    }
    setMessages((prev) => prev.map((msg) => (msg.streaming ? { ...msg, streaming: false } : msg)));
    setStreaming(false);
    activeSessionRef.current = null;
    streamingTextRef.current = "";
    return partial;
  }, [stopAudio, sendCommand, setStreaming]);

  // ─── Local-only transcript entry (D-03/D-11 text+audio, never voice-only) ──
  // Appends a purely local assistant message — NO chat.send, no server turn.
  // Used for client-synthesized system lines (the D-03 no-share refusal and
  // the D-11 lost-screen acknowledgement) so each spoken line also gets a
  // durable chat-log entry (accessibility, logging, searchability) rather than
  // being voice-only.
  const appendLocalAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: generateId(), role: "assistant", content: text, streaming: false, timestamp: Date.now() },
    ]);
  }, []);

  const handleApprove = useCallback((requestId: string) => approve(requestId), [approve]);
  const handleReject = useCallback(
    (requestId: string, reason?: string) => reject(requestId, reason),
    [reject]
  );

  return {
    status,
    messages,
    sendMessage,
    isStreaming,
    ttsEnabled,
    setTtsEnabled,
    playAudio,
    stopAudio,
    ttsIsPlaying,
    interrupt,
    appendLocalAssistantMessage,
    handleApprove,
    handleReject,
    /** VISION-01: hands the page's SOLE useScreenShare instance to the
     *  vision.frame_request round-trip (see doc comment above). */
    registerScreenShare,
    /** Expose the active session so the voice layer can target barge-in. */
    activeSessionRef,
    /** Her current/last reply text — the voice layer fingerprints recognized
     *  speech against this to tell mic echo from a real user interjection. */
    streamingReplyRef: streamingTextRef,
  };
}

export type AstridrChat = ReturnType<typeof useAstridrChat>;
