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
  // Mirror of ttsEnabled for use OUTSIDE React state updaters. The run.tts
  // handler previously read the current value by calling setTtsEnabled with a
  // side-effecting updater — see the run.tts subscription below for why that
  // was a real bug, not a style nit.
  const ttsEnabledRef = useRef(false);
  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);
  // Phase 188 / D-16: analyser opt-in enabled here is scoped by construction —
  // useAstridrChat has exactly one production consumer (Chat.tsx), so this
  // does not turn the analyser on globally. See useTtsPlayback.ts:11-27 for
  // the transparent-degradation contract this relies on.
  const {
    play: playAudio,
    stop: stopAudio,
    isPlaying: ttsIsPlaying,
    analyser: ttsAnalyser,
  } = useTtsPlayback({ analyser: true });

  const activeSessionRef = useRef<string | null>(null);
  // Deliberately separate from activeSessionRef, which is a TURN-LIFECYCLE ref
  // (valid only while text is streaming, nulled the instant it finishes — see
  // the four clear sites below). run.tts audio is synthesized from the
  // finished text, so it structurally arrives AFTER activeSessionRef has
  // already gone null; comparing against it always reads sessionMatches:false
  // (live 2026-07-30, see commit e66712a9's note on why that filter was never
  // added). lastSessionRef mirrors the same assignment but is never cleared,
  // so it answers "does this audio belong to the turn we just had" instead of
  // "is a turn currently streaming" — the question run.tts actually needs
  // answered. Mirrors the never-cleared per-message `sessionId` already used
  // correctly for the audioUrl match below.
  const lastSessionRef = useRef<string | null>(null);

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
        /** SWAP-03/D-11: set when the client's own swap-verb fast-path (useAstridrVoice.ts)
         *  already recognized+dispatched a brain/voice swap for this turn — spread onto
         *  chat.send as `swap_handled` so the backend's own inbound fast-path (185-05)
         *  treats it as already handled and does not re-fire the swap a second time. */
        swapHandled?: boolean;
        /** D-07/D-14a: scopes SecurityContext.profile_id server-side only — NOT a persona-voice switch. */
        profile?: string;
        /** D-08 (188.3-05): caller-supplied id for the appended/patched user
         *  message. useAstridrVoice's flushSend generates one per send so a
         *  LATER continuation-merge can name this exact message as its
         *  supersede target. When absent, behavior is unchanged (generateId()
         *  as before). Threaded IN only — never returned OUT, so it cannot
         *  touch the locked Promise<boolean> contract (CR-01, 99-07). */
        clientMessageId?: string;
        /** D-08 (188.3-05): supersede path. When set, PATCHES the prior user
         *  message with this id in place instead of appending a new one — the
         *  fix for "one utterance produces two bubbles" on a legitimate
         *  continuation merge (flushSend cancels the prior turn via
         *  interrupt() but sendMessage always appended). Same-id patch keeps
         *  Chat.tsx's key={msg.id} stable (no remount/scroll-jump) — mirrors
         *  correctAssistantMessage's patch-in-place shape (:558-566) with
         *  role: "user" in place of role: "assistant". Fail-safe: if the
         *  target id is not found in the current list, APPENDS rather than
         *  silently dropping the utterance (188.1 D-03 fail-toward-sending —
         *  a user's words disappearing is strictly worse than an extra
         *  bubble). This is a client-DISPLAY-ONLY supersede: the wire payload
         *  below carries no id, so astridr's own session.messages history
         *  still holds both turns (cancel_session() never prunes it). */
        supersedes?: string;
      }
    ): Promise<boolean> => {
      // CR-01 (99-07): callers (Chat.tsx auto-send) need a real success signal
      // to gate recordSkillLaunch on — "the promise resolved" is NOT "the send
      // succeeded". Every early-return/error path below resolves `false`;
      // only the confirmed-ok path resolves `true`.
      if (!text.trim() || isStreamingRef.current || status !== "connected") return false;

      if (opts?.supersedes) {
        const supersedeTarget = opts.supersedes;
        setMessages((prev) => {
          const targetExists = prev.some((msg) => msg.role === "user" && msg.id === supersedeTarget);
          if (targetExists) {
            return prev.map((msg) =>
              msg.role === "user" && msg.id === supersedeTarget ? { ...msg, content: text } : msg
            );
          }
          // Fail-safe (188.1 D-03, fail-toward-sending): the supersede target
          // is gone — append rather than silently dropping the user's words.
          return [
            ...prev,
            {
              id: opts?.clientMessageId ?? generateId(),
              role: "user",
              content: text,
              streaming: false,
              timestamp: Date.now(),
            },
          ];
        });
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: opts?.clientMessageId ?? generateId(),
            role: "user",
            content: text,
            streaming: false,
            timestamp: Date.now(),
          },
        ]);
      }

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
          ...(opts?.swapHandled ? { swap_handled: true } : {}),
          ...(opts?.profile ? { profile: opts.profile } : {}),
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
          return false;
        }

        const sessionId =
          (ack.session_id as string | undefined) ??
          (ack.data?.session_id as string | undefined) ??
          generateId();
        activeSessionRef.current = sessionId;
        lastSessionRef.current = sessionId;
        streamingTextRef.current = "";
        ttsSuppressedRef.current = false; // new turn — her voice is welcome again

        setMessages((prev) => [
          ...prev,
          { id: generateId(), role: "assistant", content: "", streaming: true, timestamp: Date.now(), sessionId },
        ]);
        setStreaming(true);
        return true;
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
        return false;
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

      // D-10 (188.3-06, T-188.3-17..20): session gate, mirroring the run.tts
      // gate above verbatim in shape (:437) — NOT the four activeSessionRef
      // siblings (:212/:416/:424/:462). run.blocks sits in the same
      // structural position as run.tts: it typically arrives AFTER run.text
      // for a normal reply, and activeSessionRef is nulled the instant
      // run.text's done:true lands (:226/:278) — gating on it here would
      // suppress the control-verb fast-path reply, which emits ONLY
      // run.blocks with no preceding run.text at all. lastSessionRef is
      // never cleared, so it answers "does this belong to the turn we just
      // had" instead of "is a turn currently streaming" — the question this
      // handler actually needs answered. Fails OPEN on an absent
      // session_id, same as run.tts. Early return BEFORE both the backfill
      // and the append below — the predecessor bug on run.tts was exactly a
      // session check computed as a trace field that never entered the
      // gate, with a test asserting the diagnostic instead of the behavior.
      const sessionOk = !payload.session_id || payload.session_id === lastSessionRef.current;
      if (!sessionOk) return;

      // 186-01 follow-up (fresh live trace, 186-09 swap testing): the
      // control-verb fast-path short-circuit (ws_commands.py::_handle_chat_
      // send — swap refusals/confirmations, focus/quiet-hours toggles,
      // catalogue answers) NEVER emits run.text, only run.blocks with a
      // single TextBlockData. Without this backfill, streamingReplyRef stays
      // "" for the whole reply, and useAstridrVoice's isEchoOfReply falls
      // through its `if (!reply) return false` branch — treating ANY
      // substantive interim heard during her TTS as "not echo", a
      // guaranteed self-barge on her own voice (live trace: her deterministic
      // refusal "I couldn't find..." barged itself 0.9s after tts.start). A
      // normal LLM turn ALSO emits run.blocks with the identical final text,
      // but only AFTER its own run.text has already populated the ref
      // (post_turn_pipeline.py emits run.text then run.blocks, in that
      // order, over the same ordered WS connection) — so only backfill when
      // NOTHING has streamed yet this turn, never double-append onto an
      // already-populated ref.
      if (!streamingTextRef.current) {
        for (const block of blocks) {
          if (block.type === "text") {
            streamingTextRef.current += block.text;
          }
        }
      }

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
      // ROOT CAUSE of the intermittent "she got cut off while I was silent"
      // (live 2026-07-30, found via the playback trace):
      //
      // This used to be `setTtsEnabled((current) => { ...playAudio(current)... })`
      // — reading state through an updater purely to get `current`, with
      // side effects inside it. React StrictMode (enabled in main.tsx:42)
      // DOUBLE-INVOKES state updaters in development precisely to surface
      // impure ones, so a single run.tts event produced TWO playAudio()
      // calls ~8ms apart. Playback is replacement-based, so the second call
      // tore down the first element. It was survivable only when the
      // duplicate landed at currentTime:0; once audio had begun it cut her
      // mid-sentence — and because no barge-in ran, tts.end logged
      // barged:false, which sent four rounds of fixes after echo and
      // barge-in instead of this.
      //
      // The current value now comes from a ref, and the side effect runs
      // once, outside any updater.
      const current = ttsEnabledRef.current;
      // 188.1 UAT finding (live 2026-08-06 21:35:39.784): this gate used to be
      // `current && !ttsSuppressedRef.current` — it never consulted the session
      // at all, even though the comparison was already being computed one block
      // below FOR THE TRACE ONLY. A superseded turn's audio therefore played:
      //   run.tts.received {"sessionMatches":false,"activeSession":"f2a1cc4d…","willPlay":true}
      //   tts.audio.replace {"currentTime":0.41,"duration":4.88}
      // — she began a stale reply and was cut 0.41s in when the real one landed.
      //
      // Compared against lastSessionRef, NOT activeSessionRef: activeSessionRef
      // is nulled by run.completed, and TTS synthesis is slower than text
      // delivery, so the NORMAL case is run.tts arriving after that null. Gating
      // on activeSessionRef would suppress nearly every ordinary reply — the
      // "DOES play audio for the active session" control test pins this.
      //
      // FAILS OPEN on an absent session_id: the sole emitter
      // (astridr wiring.py:244) always sets it, so this branch should be
      // unreachable — but silence is a worse failure than a stale clip.
      const sessionOk = !data.session_id || data.session_id === lastSessionRef.current;
      const willPlay = current && !ttsSuppressedRef.current && sessionOk;
      if (typeof window !== "undefined") {
        const buf = ((window as unknown as { __astridrVoiceTrace?: unknown[] })
          .__astridrVoiceTrace ??= []);
        buf.push({
          t: new Date().toISOString().slice(11, 23),
          ev: "run.tts.received",
          d: {
            sessionMatches: data.session_id === lastSessionRef.current,
            eventSession: data.session_id,
            activeSession: lastSessionRef.current,
            ttsEnabled: current,
            ttsSuppressed: ttsSuppressedRef.current,
            willPlay,
          },
        });
        if (buf.length > 500) buf.shift();
      }
      // Post-interrupt suppression: a barged-in turn's late TTS must never
      // play ("she would not stop"). The bubble still gets its replay URL.
      if (willPlay) {
        playAudio(data.audio_url!);
      } else if (current) {
        // eslint-disable-next-line no-console
        console.log("[voice] tts.suppressed — late chunk from an interrupted turn");
      }
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
  const interrupt = useCallback((reason: string = "unattributed"): string => {
    // `reason` threads the CALLER's identity down to the playback trace. Only
    // one of the six call sites is a real barge-in; the rest (flushSend,
    // continuation-merge, vision-capture, pure-barge-processing,
    // swap-dispatch) also stop audio but never set bargeInFiredRef, so
    // tts.end reported barged:false for a cut that definitely happened.
    stopAudio(`interrupt:${reason}`);
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

  // 186-09 deferred item option (b), pairs with the backend's chat.correction
  // WS event (wiring.py's _generate_chat_tts sink): patches the matching
  // ALREADY-RENDERED assistant bubble's displayed text IN PLACE, never
  // appending a new/duplicate bubble (that caused the 185-08 regression).
  // The DISPLAYED chat transcript is a pure parse_and_strip_tags emission
  // with no dispatch, so it can render the model's own (possibly fabricated)
  // prose about a swap before the tag ever resolves -- this replaces that
  // prose with the verb's real deterministic confirmation once the backend
  // sink learns it. Matches by sessionId; clears any generative blocks so
  // the corrected plain text is what renders (ChatBubble prefers blocks over
  // content when both are present). No-op if no message with that sessionId
  // is currently rendered (e.g. the page wasn't mounted at receipt time).
  const correctAssistantMessage = useCallback((sessionId: string, correctedText: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.role === "assistant" && msg.sessionId === sessionId
          ? { ...msg, content: correctedText, blocks: undefined }
          : msg
      )
    );
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
    /** Phase 188 / D-16: real TTS amplitude AnalyserNode for the avatar's
     *  mouth-region motion; null when unavailable (degrades transparently). */
    ttsAnalyser,
    interrupt,
    appendLocalAssistantMessage,
    correctAssistantMessage,
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
