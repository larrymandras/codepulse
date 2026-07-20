/**
 * useWakeWord — main-thread orchestrator for the browser wake-word engine.
 *
 * Coordinates:
 *   1. getUserMedia mic capture (with 16kHz preference + fallback)
 *   2. AudioContext + AudioWorklet (public/micCapture.worklet.js)
 *   3. Web Worker (wakeWordWorker.ts) running the ONNX pipeline
 *
 * Lifecycle contract:
 *   - start(): transitions idle → loading → ready; rejects internally (no throw)
 *   - stop(): terminates Worker, closes AudioContext, stops mic tracks → idle
 *   - On any failure (getUserMedia, addModule, Worker error, 10s init timeout):
 *     → status:'error-disabled', errorReason set, NO mic stream left open (VOX-04)
 *   - Never throws; never lets errors reach a SectionErrorBoundary (CLAUDE.md)
 *
 * ref-for-stable-callback lifecycle follows src/hooks/useAudioEvents.ts pattern.
 *
 * @see RESEARCH.md §"Pattern 3: useWakeWord Hook" + §"Loading Models with Error Handling"
 * @see PATTERNS.md §useWakeWord.ts (lines 31–124)
 * @see src/workers/wakeWordWorker.ts (Worker receiving the frames)
 * @see public/micCapture.worklet.js (AudioWorklet posting the frames)
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export type WakeWordStatus = 'idle' | 'loading' | 'ready' | 'error-disabled';

export interface UseWakeWordOptions {
  /** Base URL for ONNX model files (e.g. '/openwakeword') */
  baseUrl: string;
  /** Called on the main thread when wake word is detected */
  onWake: () => void;
}

export interface UseWakeWordReturn {
  status: WakeWordStatus;
  errorReason: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

const WORKER_INIT_TIMEOUT_MS = 10_000;

export function useWakeWord({ baseUrl, onWake }: UseWakeWordOptions): UseWakeWordReturn {
  const [status, setStatus] = useState<WakeWordStatus>('idle');
  const [errorReason, setErrorReason] = useState<string | null>(null);

  // Stable ref for onWake — same pattern as useAudioEvents.ts (enabledRef)
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  // Resource refs — allow stop() to be called from any context without closures
  const workerRef = useRef<Worker | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  // Synchronous re-entry guard for start() — see the comment inside start().
  const startingRef = useRef(false);

  /** Stop all active resources and release the mic. Does NOT set status — caller does that. */
  const releaseResources = useCallback((): void => {
    // Remove the visibility keep-alive listener
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
    // Terminate Worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    // Disconnect and close AudioContext
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {
        // Ignore close errors
      });
      audioCtxRef.current = null;
    }
    // Stop mic tracks (CRITICAL: do not leave a hot mic — VOX-04, T-92-07)
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
  }, []);

  const stop = useCallback((): void => {
    releaseResources();
    setStatus('idle');
    setErrorReason(null);
  }, [releaseResources]);

  const start = useCallback(async (): Promise<void> => {
    // Guard against double-start. The status check alone is NOT enough: two
    // start() calls in the same tick (e.g. StrictMode re-running the gating
    // effect) both read the stale 'idle' status and spin up TWO workers + TWO
    // mic streams — the first pair is orphaned with a hot mic and fires
    // duplicate wake events. The ref guard is synchronous.
    if (startingRef.current) return;
    if (status === 'loading' || status === 'ready') return;
    startingRef.current = true;

    setStatus('loading');
    setErrorReason(null);

    try {
      // ---[ Step 1: Request mic — try 16kHz, fall back to default rate ]---
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: { ideal: 16_000 },
            channelCount: 1,
            echoCancellation: true,
          },
        });
      } catch {
        // Fallback: no sampleRate constraint (worklet will decimate if needed)
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true },
        });
      }
      micStreamRef.current = stream;

      // ---[ Step 2: Spin up the Worker FIRST so we can get its MessagePort ]---
      const worker = new Worker(
        new URL('../workers/wakeWordWorker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      // Set up wake event handler immediately (before init completes)
      worker.onmessage = (e: MessageEvent) => {
        const data = e.data as { type: string; score?: number; message?: string };
        if (data.type === 'wake') {
          onWakeRef.current();
        }
      };

      // ---[ Step 3: Worker init with 10s timeout ]---
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('Worker init timeout after 10s')),
          WORKER_INIT_TIMEOUT_MS,
        );

        // Wrap the existing onmessage to also handle init messages
        const prevOnMessage = worker.onmessage;
        worker.onmessage = (e: MessageEvent) => {
          const data = e.data as { type: string; score?: number; message?: string };
          if (data.type === 'ready') {
            clearTimeout(timeout);
            // Restore the steady-state onmessage handler
            worker.onmessage = prevOnMessage;
            resolve();
          } else if (data.type === 'error') {
            clearTimeout(timeout);
            worker.onmessage = prevOnMessage;
            reject(new Error(data.message ?? 'Worker init error'));
          } else {
            // Pass through any other messages (shouldn't occur during init)
            prevOnMessage?.call(worker, e);
          }
        };

        worker.onerror = (e) => {
          clearTimeout(timeout);
          reject(new Error(`Worker error: ${e.message}`));
        };

        worker.postMessage({ type: 'init', baseUrl });
      });

      // ---[ Step 4: Create AudioContext + AudioWorklet ]---
      // Request 16kHz if the browser supports multiple AudioContext rates;
      // the worklet's decimation fallback handles the case where it doesn't.
      let audioCtx: AudioContext;
      try {
        audioCtx = new AudioContext({ sampleRate: 16_000 });
      } catch {
        audioCtx = new AudioContext();
      }
      audioCtxRef.current = audioCtx;

      // Keep the wake-word AudioContext alive. Browsers suspend it on tab blur,
      // audio-focus changes, or around TTS playback, which silently stops the
      // worklet's process() → the wake word "works then stops". Auto-resume any
      // unwanted suspension. A real stop() closes the context ('closed'), which
      // resume() cannot revive, so this only ever revives a 'suspended' context.
      audioCtx.onstatechange = () => {
        if (audioCtx.state === 'suspended') {
          void audioCtx.resume().catch(() => {});
        }
      };
      // Also resume when the tab returns to the foreground (Chrome suspends
      // background-tab audio and does not always auto-resume on return).
      const onVisible = () => {
        if (
          document.visibilityState === 'visible' &&
          audioCtxRef.current?.state === 'suspended'
        ) {
          void audioCtxRef.current.resume().catch(() => {});
        }
      };
      visibilityHandlerRef.current = onVisible;
      document.addEventListener('visibilitychange', onVisible);

      // Add the worklet module. Served as PLAIN JS from /public (see
      // public/micCapture.worklet.js) rather than bundled from the .ts source:
      // Vite copies `new URL('*.ts', import.meta.url)` assets untranspiled in a
      // production build, which shipped raw TypeScript and broke addModule on the
      // Vercel deploy ("Unable to load a worklet's module"). BASE_URL is '/'.
      await audioCtx.audioWorklet.addModule(
        `${import.meta.env.BASE_URL}micCapture.worklet.js`,
      );

      // ---[ Step 5: Wire mic → AudioWorkletNode → Worker port ]---
      // The worklet reads frames from the mic; it posts them to the Worker via
      // the Worker's transferable MessagePort.
      const { port1: workerPort, port2: workletPort } = new MessageChannel();

      // Transfer workerPort to the Worker so it receives frames via port1
      worker.postMessage({ type: 'port', port: workerPort }, [workerPort]);

      // Create the AudioWorkletNode, then hand the worklet its end of the channel.
      // A MessagePort CANNOT be passed through processorOptions — that path is
      // structured-cloned and ports aren't cloneable ("could not be cloned because
      // it was not transferred"). Transfer it through the node's own .port instead.
      const workletNode = new AudioWorkletNode(audioCtx, 'mic-capture', {
        channelCount: 1,
        channelCountMode: 'explicit' as ChannelCountMode,
      });
      workletNodeRef.current = workletNode;
      workletNode.port.postMessage({ type: 'workerPort', port: workletPort }, [
        workletPort,
      ]);

      // Connect mic stream → worklet node (worklet's process() fires with mic data)
      const micSource = audioCtx.createMediaStreamSource(stream);
      micSource.connect(workletNode);
      // REQUIRED: an AudioWorkletNode that doesn't reach the destination is not part
      // of the render graph, so its process() is never called (→ no frames, no wake).
      // This worklet writes NOTHING to its outputs (it only reads mic input and posts
      // frames to the worker), so this connection is silent — there is no mic playback.
      workletNode.connect(audioCtx.destination);

      setStatus('ready');
    } catch (err) {
      // ---[ D-07: Graceful degradation — never throw, never leave hot mic ]---
      const message = err instanceof Error ? err.message : String(err);
      console.error('[useWakeWord] init failed:', message);
      // Release all resources including mic stream (VOX-04 — no silent hot mic)
      releaseResources();
      setStatus('error-disabled');
      setErrorReason(message);
    } finally {
      startingRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, releaseResources, status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseResources();
    };
  }, [releaseResources]);

  return { status, errorReason, start, stop };
}
