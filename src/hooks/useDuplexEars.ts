/**
 * useDuplexEars — WebRTC realtime-transcription ears (Phase 188, DUPLEX-01).
 *
 * A pure event source: mint an ephemeral secret from the existing astridr
 * admin surface, open a WebRTC session against the OpenAI Realtime
 * transcription endpoint, and surface exactly two events the caller needs —
 * a speech-start signal (for barge-in) and a finalized transcript (for
 * dispatch). It owns ZERO conversation logic: no interrupt decision, no
 * message dispatch, no state machine. The composing hook (188-08) is
 * responsible for wiring these events into the existing orchestration.
 *
 * Session lifecycle (D-10): opens only on an explicit start() and is fully
 * torn down by stop() — peer connection closed, data channel closed, every
 * mic track stopped. No always-open session, no idle-warm extension.
 *
 * Security (T-188-60/T-188-17): the ephemeral secret lives only in a ref for
 * the lifetime of one session. It is never persisted to browser storage, the
 * URL, or the console — the shared window.__astridrVoiceTrace ring buffer is
 * the only channel permitted to disclose duplex activity, and even that
 * never carries the secret or transcript text (lengths only).
 *
 * Failure semantics (D-08): any mint, connect, ICE or data-channel failure
 * resolves to status "unavailable" plus exactly one onUnavailable(reason)
 * call (latched per start() cycle) — this hook never throws into the React
 * tree and never auto-retries; retry policy belongs to the composing hook.
 *
 * Shape mirrors src/hooks/useSpeechRecognition.ts (start/stop + status,
 * callback-ref pattern) so the composing hook can swap ear sources without a
 * second orchestration idiom.
 *
 * @see .planning/phases/188-single-assistant-full-duplex-voice/188-SMOKE.md
 *      for the verified wire contract (event literals, endpoints, status
 *      codes) this hook implements against.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Trace buffer (shared, existing) ──────────────────────────────────────────

declare global {
  interface Window {
    __astridrVoiceTrace?: Array<{ t: string; ev: string; d?: unknown }>;
  }
}

/** Pushes a lifecycle event into the shared trace ring buffer. Never emits to
 *  the console and never carries the ephemeral secret or transcript text. */
function trace(ev: string, d?: unknown): void {
  if (typeof window === "undefined") return;
  const entry = { t: new Date().toISOString().slice(11, 23), ev: `duplex.${ev}`, d };
  const buf = (window.__astridrVoiceTrace ??= []);
  buf.push(entry);
  if (buf.length > 500) buf.shift();
}

// ─── astridr API access (verified idiom, src/lib/astridrApi.ts) ──────────────

const ASTRIDR_API_BASE = import.meta.env.VITE_ASTRIDR_API_URL ?? "";
const ASTRIDR_API_KEY = import.meta.env.VITE_ASTRIDR_API_KEY ?? "";

const REALTIME_MINT_PATH = "/api/realtime/session";

// ─── Verified upstream contract (188-SMOKE.md, live-verified 2026-07-29) ─────

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DUPLEX_DATA_CHANNEL_LABEL = "oai-events";

/** Verbatim data-channel event `type` literals observed in 188-SMOKE.md. A
 *  future API rename is a one-line change here. */
const DUPLEX_EVENT_SPEECH_STARTED = "input_audio_buffer.speech_started";
// Traced only (2026-07-31, tail-hallucination investigation) -- not otherwise handled.
// Never subscribed before; gives a repro trace the wall-clock moment OpenAI's server_vad
// decided speech stopped, to compare against duplex.transcript / tts.end timestamps in the
// ring buffer and see whether hallucinated finals land inside or outside ECHO_TAIL_MS.
const DUPLEX_EVENT_SPEECH_STOPPED = "input_audio_buffer.speech_stopped";
const DUPLEX_EVENT_TRANSCRIPT_COMPLETED =
  "conversation.item.input_audio_transcription.completed";
const DUPLEX_EVENT_TRANSCRIPT_DELTA =
  "conversation.item.input_audio_transcription.delta";

// ─── Hook options / return ────────────────────────────────────────────────────

export type DuplexEarsStatus = "idle" | "connecting" | "connected" | "unavailable";

export interface UseDuplexEarsOptions {
  /** Mirrors the orchestrator's overall enabled gate. When false, start() is
   * a no-op — the caller owns calling stop() if it disables mid-session. */
  enabled: boolean;
  /** D-06 persona seam. Defaults to "astridr", the only wired persona this
   * phase. */
  persona?: string;
  onSpeechStart: () => void;
  /** durationMs is the elapsed ms between the speech_started/speech_stopped
   * pair that produced this final, measured locally via Date.now() deltas —
   * never a value read from the remote payload (T-188.1-03). undefined when
   * no matching speech_started preceded this transcript (never 0 — 0 would
   * read as "impossibly short" rather than "unknown", 188.1-02 D-03). */
  onFinalTranscript: (text: string, durationMs?: number) => void;
  /** Interim/partial text. Never persisted, never treated as final (D-15). */
  onInterimTranscript?: (text: string) => void;
  /** Fires at most once per start() cycle (latched — never a storm). */
  onUnavailable: (reason: string) => void;
  /** Fires once per real (successfully connected) session, on teardown. */
  onSessionEnd: (info: { seconds: number }) => void;
  debug?: boolean;
}

export interface UseDuplexEarsReturn {
  start: () => void;
  stop: () => void;
  status: DuplexEarsStatus;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDuplexEars(options: UseDuplexEarsOptions): UseDuplexEarsReturn {
  const [status, setStatus] = useState<DuplexEarsStatus>("idle");

  // Callback + option refs to avoid stale closures (mirrors
  // useSpeechRecognition.ts) — the composing hook's callbacks are long-lived
  // closures and a stale one here would silently deafen the ears.
  const onSpeechStartRef = useRef(options.onSpeechStart);
  const onFinalTranscriptRef = useRef(options.onFinalTranscript);
  const onInterimTranscriptRef = useRef(options.onInterimTranscript);
  const onUnavailableRef = useRef(options.onUnavailable);
  const onSessionEndRef = useRef(options.onSessionEnd);
  const personaRef = useRef(options.persona);
  const enabledRef = useRef(options.enabled);
  const debugRef = useRef(options.debug);

  useEffect(() => {
    onSpeechStartRef.current = options.onSpeechStart;
  }, [options.onSpeechStart]);
  useEffect(() => {
    onFinalTranscriptRef.current = options.onFinalTranscript;
  }, [options.onFinalTranscript]);
  useEffect(() => {
    onInterimTranscriptRef.current = options.onInterimTranscript;
  }, [options.onInterimTranscript]);
  useEffect(() => {
    onUnavailableRef.current = options.onUnavailable;
  }, [options.onUnavailable]);
  useEffect(() => {
    onSessionEndRef.current = options.onSessionEnd;
  }, [options.onSessionEnd]);
  useEffect(() => {
    personaRef.current = options.persona;
  }, [options.persona]);
  useEffect(() => {
    enabledRef.current = options.enabled;
  }, [options.enabled]);
  useEffect(() => {
    debugRef.current = options.debug;
  }, [options.debug]);

  // Resource refs — held only in memory, never state, never storage.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const secretRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  // 188.1-02 (D-05): utterance duration plumbing. speechStartedAtRef records
  // when the CURRENT utterance began; lastUtteranceDurationMsRef holds the
  // computed elapsed ms once speech_stopped arrives, consumed-and-cleared by
  // the transcript.completed branch so a later transcript with no fresh
  // speech pair cannot inherit a stale value.
  const speechStartedAtRef = useRef<number | null>(null);
  const lastUtteranceDurationMsRef = useRef<number | undefined>(undefined);

  // Synchronous re-entry guard for start() — a state-only check can race a
  // second start() call within the same async window (same pattern as
  // useWakeWord.ts's startingRef).
  const startingRef = useRef(false);
  // Latches onUnavailable to at most one call per start() cycle (T-188-19 —
  // the 2026-07-20 restart-storm lesson: no naive retry loop here).
  const unavailableFiredRef = useRef(false);

  /** The single teardown implementation, reached from stop(), the unmount
   * cleanup effect, and every failure branch. Closes the data channel and
   * peer connection, stops every mic track, clears the ephemeral secret
   * unconditionally, and reports session duration exactly once for a
   * session that actually connected. */
  const teardown = useCallback((traceEvent: string, failureReason?: string) => {
    const dc = dcRef.current;
    const pc = pcRef.current;
    const stream = streamRef.current;

    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    secretRef.current = null;

    if (dc) {
      try {
        dc.close();
      } catch {
        // already closed
      }
    }
    if (pc) {
      try {
        pc.close();
      } catch {
        // already closed
      }
    }
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }

    const startedAt = sessionStartedAtRef.current;
    sessionStartedAtRef.current = null;

    trace(traceEvent, failureReason ? { failureReason } : undefined);

    if (failureReason) {
      setStatus("unavailable");
      if (!unavailableFiredRef.current) {
        unavailableFiredRef.current = true;
        onUnavailableRef.current(failureReason);
      }
    } else {
      setStatus("idle");
    }

    if (startedAt !== null) {
      const seconds = (Date.now() - startedAt) / 1000;
      onSessionEndRef.current({ seconds });
    }
  }, []);

  const stop = useCallback(() => {
    teardown("stop");
  }, [teardown]);

  const start = useCallback(() => {
    if (startingRef.current) return;
    if (status === "connecting" || status === "connected") return;
    if (!enabledRef.current) return;

    startingRef.current = true;
    unavailableFiredRef.current = false;
    setStatus("connecting");

    const persona = personaRef.current ?? "astridr";
    trace("mint", { persona });

    void (async () => {
      try {
        const res = await fetch(`${ASTRIDR_API_BASE}${REALTIME_MINT_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(ASTRIDR_API_KEY ? { Authorization: `Bearer ${ASTRIDR_API_KEY}` } : {}),
          },
          body: JSON.stringify({ persona }),
        });

        if (res.status === 503) {
          teardown("mint_unavailable", "mint_unavailable");
          return;
        }
        if (res.status === 402) {
          teardown("mint_budget_exceeded", "budget_exceeded");
          return;
        }
        if (res.status === 401) {
          teardown("mint_unauthorized", "unauthorized");
          return;
        }
        if (!res.ok) {
          teardown("mint_failed", "mint_failed");
          return;
        }

        const mint = (await res.json()) as {
          value: string;
          expiresAt: number;
          model: string;
          persona: string;
        };
        secretRef.current = mint.value;

        trace("connect");

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: { ideal: 16_000 }, channelCount: 1, echoCancellation: true },
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { channelCount: 1, echoCancellation: true },
            });
          } catch {
            teardown("mic_unavailable", "mic_unavailable");
            return;
          }
        }
        streamRef.current = stream;
        for (const track of stream.getTracks()) {
          track.onended = () => trace("track_ended", { kind: track.kind });
        }

        const pc = new RTCPeerConnection();
        pcRef.current = pc;
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }

        const dc = pc.createDataChannel(DUPLEX_DATA_CHANNEL_LABEL);
        dcRef.current = dc;

        dc.onmessage = (event: MessageEvent<string>) => {
          let data: { type?: string; transcript?: string; delta?: string } | null = null;
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          const type = data?.type;
          if (type === DUPLEX_EVENT_SPEECH_STARTED) {
            trace("speech_started");
            speechStartedAtRef.current = Date.now();
            onSpeechStartRef.current();
            return;
          }
          if (type === DUPLEX_EVENT_SPEECH_STOPPED) {
            // 188.1-02 (D-05): computes the real elapsed ms for the utterance
            // that just stopped and hands it to the transcript branch below.
            // Also still serves the tail-hallucination repro this trace was
            // originally added for (2026-07-31): read against duplex.transcript's
            // timestamp for the SAME utterance to see OpenAI's own server_vad +
            // inference + WebRTC round-trip latency, and against the nearest
            // tts.end to see whether it lands inside or outside ECHO_TAIL_MS.
            const startedAt = speechStartedAtRef.current;
            speechStartedAtRef.current = null; // clear so the pair cannot be double-consumed
            let durationMs: number | undefined;
            if (startedAt !== null) {
              const elapsed = Date.now() - startedAt;
              // Never clamp to zero and never pass a negative value -- undefined
              // means "unknown", 0 would read as "impossibly short" (D-03).
              durationMs = elapsed >= 0 ? elapsed : undefined;
            }
            lastUtteranceDurationMsRef.current = durationMs;
            trace("speech_stopped", { durationMs });
            return;
          }
          if (type === DUPLEX_EVENT_TRANSCRIPT_COMPLETED) {
            const text = data?.transcript ?? "";
            const durationMs = lastUtteranceDurationMsRef.current;
            lastUtteranceDurationMsRef.current = undefined; // consume-and-clear (D-03)
            trace("transcript", { length: text.length, durationMs });
            onFinalTranscriptRef.current(text, durationMs);
            return;
          }
          if (type === DUPLEX_EVENT_TRANSCRIPT_DELTA) {
            onInterimTranscriptRef.current?.(data?.delta ?? "");
            return;
          }
          // Unrecognized event types are ignored silently by default and
          // only traced when debug is on.
          if (debugRef.current) {
            trace("unhandled", { type });
          }
        };

        dc.onclose = () => {
          if (pcRef.current !== pc) return; // already torn down by another path
          teardown("datachannel_closed", "datachannel_closed");
        };

        pc.onconnectionstatechange = () => {
          if (pcRef.current !== pc) return; // already torn down by another path
          const state = pc.connectionState;
          trace("connectionstatechange", { state });
          if (state === "failed" || state === "disconnected") {
            teardown(`connection_${state}`, `connection_${state}`);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const callRes = await fetch(REALTIME_CALLS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretRef.current ?? ""}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        });

        if (!callRes.ok) {
          teardown("connect_failed", "connect_failed");
          return;
        }

        const answerSdp = await callRes.text();
        await pc.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        } as RTCSessionDescriptionInit);

        sessionStartedAtRef.current = Date.now();
        setStatus("connected");
        trace("connected");
      } catch (err) {
        trace("start_exception", {
          message: err instanceof Error ? err.message : String(err),
        });
        teardown("start_exception", "start_exception");
      } finally {
        startingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, teardown]);

  // Unmount performs the same teardown as stop() — no leaked mic, no leaked
  // peer connection (D-10).
  useEffect(() => {
    return () => {
      teardown("unmount");
    };
  }, [teardown]);

  return { start, stop, status };
}
