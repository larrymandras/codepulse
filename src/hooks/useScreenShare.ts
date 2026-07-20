/**
 * useScreenShare — the SOLE caller of the screen-capture picker API in
 * codepulse (D-09/D-10).
 *
 * The live MediaStream is held in a ref, never React state (CONTEXT.md) — a
 * re-render must never risk re-triggering a picker prompt or being diffed away.
 * `arm()` flips a UI-only "armed" state without opening the picker at all,
 * because voice cannot invoke it (no user gesture) — a subsequent
 * user-gesture `start()` is what actually opens it (D-09). `start()` requests a
 * "monitor" displaySurface *preference* and never branches on what the picker
 * actually returns (D-10). `captureFrame()` always grabs a FRESH frame from the
 * live stream — nothing is cached or streamed (D-02) — downscaled to a bounded
 * longest edge before JPEG-encoding (D-06). The track's native `ended` event
 * (Chrome "Stop sharing", tab/window close) clears the ref, resets to idle, and
 * fires the caller's `onEnded` so the surface can announce lost screen (D-11).
 */

import { useCallback, useRef, useState } from "react";

export type ScreenShareState = "idle" | "armed" | "active";

export interface CaptureFrameOptions {
  /** Longest edge in pixels the captured frame is downscaled to. Never upscales. */
  maxEdge?: number;
  /** JPEG encode quality (0-1). */
  quality?: number;
}

export interface CapturedFrame {
  blob: Blob;
  /** base64-encoded JPEG bytes, no `data:` URL prefix — ready for chat.send's `frame` field. */
  base64: string;
  mimeType: string;
}

export interface UseScreenShareOptions {
  /** Fired when the shared track ends natively (Chrome "Stop sharing", tab/window close). */
  onEnded?: () => void;
}

const DEFAULT_MAX_EDGE = 1568;
const DEFAULT_QUALITY = 0.85;

// ─── Debug instrumentation (mirrors the VOICE_DEBUG convention in useAstridrVoice.ts) ──
const SCREEN_SHARE_DEBUG = false;

function trace(ev: string, d?: unknown) {
  if (!SCREEN_SHARE_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(`[screen-share] ${ev}`, d ?? "");
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read captured frame"));
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:<mime>;base64," prefix — chat.send's `frame` field wants raw base64.
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function useScreenShare(opts?: UseScreenShareOptions) {
  const [state, setState] = useState<ScreenShareState>("idle");
  // The live MediaStream lives ONLY here — never in React state.
  const streamRef = useRef<MediaStream | null>(null);
  const onEndedRef = useRef(opts?.onEnded);
  onEndedRef.current = opts?.onEnded;

  const handleEnded = useCallback(() => {
    trace("track ended");
    streamRef.current = null;
    setState("idle");
    onEndedRef.current?.();
  }, []);

  const arm = useCallback(() => {
    // D-09: voice cannot open the picker (no user gesture) — arm just flips UI
    // state. The picker API is NOT called here.
    trace("arm");
    setState("armed");
  }, []);

  const start = useCallback(async () => {
    // D-10: request a "monitor" preference; never branch on the surface the
    // picker actually returns.
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "monitor" },
    } as DisplayMediaStreamOptions);

    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    track?.addEventListener("ended", handleEnded);

    setState("active");
    trace("start");
    return stream;
  }, [handleEnded]);

  const stop = useCallback(() => {
    const stream = streamRef.current;
    stream?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setState("idle");
    trace("stop");
  }, []);

  const captureFrame = useCallback(
    async (options?: CaptureFrameOptions): Promise<CapturedFrame> => {
      const stream = streamRef.current;
      const track = stream?.getVideoTracks()[0];
      if (!stream || !track || track.readyState === "ended") {
        throw new Error("Screen share track is not live");
      }

      const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
      const quality = options?.quality ?? DEFAULT_QUALITY;

      // D-02: always grab a FRESH frame — a new video/canvas per call, nothing
      // cached or memoized.
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      if (video.videoWidth === 0) {
        // Pitfall 4: guard the 0x0 capture race — wait for real dimensions.
        await new Promise<void>((resolve) => {
          video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        });
      }

      // Never upscale: scale is clamped to at most 1.
      const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context unavailable");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          quality,
        );
      });

      const base64 = await blobToBase64(blob);
      trace("captureFrame", { width: canvas.width, height: canvas.height });
      return { blob, base64, mimeType: "image/jpeg" };
    },
    [],
  );

  return { state, arm, start, stop, captureFrame };
}
