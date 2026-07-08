/**
 * AvatarAura — the audio-reactive "cyber-Norse Ástríðr" voice avatar.
 *
 * Renders the stylized Nordic-woman avatar with a live glowing aura on a
 * <canvas> behind her. The aura's energy is driven by real audio amplitude via
 * Web Audio AnalyserNodes, mapped to the voice state machine:
 *
 *   - listening / transcribing → reacts to MY voice (a mic AnalyserNode this
 *       component owns; acquired only while listening, released otherwise).
 *   - speaking                 → reacts to HER voice (the TTS AnalyserNode from
 *       useTtsPlayback, passed in via props).
 *   - processing (thinking)    → idle shimmer: a slow rotating sweep, no audio.
 *   - idle / error-disabled    → minimal static glow.
 *
 * Design notes:
 *   - Colors are read live from the active theme (`--primary`) via a probe
 *     element, so it tracks the runtime theme switcher (cyan/emerald/…) and
 *     works whether the token is hex or oklch. Speaking tints cyan → emerald.
 *   - The canvas draws additively ('lighter') behind the avatar image; the
 *     image's own near-black background is faded at the edges with a radial
 *     mask so it melts into the panel rather than sitting in a box.
 *   - Respects `prefers-reduced-motion`: no rAF loop, no mic capture — a single
 *     static glow frame is drawn instead.
 *   - The mic tap NEVER throws (permission denial → synthetic idle pulse), and
 *     nothing here can take down a SectionErrorBoundary.
 *
 * Tier-2 avatar, 2026-07-08. See .planning/AVATAR-HANDOFF.md.
 */

import { useEffect, useRef } from "react";
import type { VoiceState } from "./voiceState";
import avatarSrc from "@/assets/avatar/astridr-avatar.png";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface AvatarAuraProps {
  state: VoiceState;
  /** TTS AnalyserNode (her voice) from useTtsPlayback; null when unavailable. */
  ttsAnalyser: AnalyserNode | null;
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const EMERALD: [number, number, number] = [16, 185, 129]; // #10b981 — "her" tint
const FALLBACK_CYAN: [number, number, number] = [6, 182, 212]; // #06b6d4

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];

/** RMS (0..1) of an analyser's time-domain data, or -1 if unreadable/flat. */
function analyserLevel(analyser: AnalyserNode, buf: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128; // −1..1
    sum += v * v;
  }
  const rms = Math.sqrt(sum / buf.length);
  return rms;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AvatarAura({ state, ttsAnalyser, className }: AvatarAuraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);

  // Latest state/analyser without restarting the rAF loop.
  const stateRef = useRef<VoiceState>(state);
  stateRef.current = state;
  const ttsAnalyserRef = useRef<AnalyserNode | null>(ttsAnalyser);
  ttsAnalyserRef.current = ttsAnalyser;

  // Mic analyser (my voice) — owned here, alive only while listening.
  const micCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Cached theme color (rgb), refreshed on theme change.
  const colorRef = useRef<[number, number, number]>(FALLBACK_CYAN);

  // ─── Acquire / release the mic tap based on state ─────────────────────────
  useEffect(() => {
    const wantMic =
      (state === "listening" || state === "transcribing") &&
      !prefersReducedMotion();

    let cancelled = false;

    const releaseMic = () => {
      if (micStreamRef.current) {
        for (const t of micStreamRef.current.getTracks()) t.stop();
        micStreamRef.current = null;
      }
      if (micCtxRef.current) {
        void micCtxRef.current.close().catch(() => {});
        micCtxRef.current = null;
      }
      micAnalyserRef.current = null;
    };

    if (wantMic && !micAnalyserRef.current) {
      (async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
          });
          if (cancelled) {
            for (const t of stream.getTracks()) t.stop();
            return;
          }
          const Ctor =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new Ctor();
          if (ctx.state !== "running") await ctx.resume().catch(() => {});
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.75;
          ctx.createMediaStreamSource(stream).connect(analyser);
          micStreamRef.current = stream;
          micCtxRef.current = ctx;
          micAnalyserRef.current = analyser;
        } catch {
          // Permission denied / no device → aura falls back to a synthetic
          // listening pulse. Never throw.
        }
      })();
    } else if (!wantMic) {
      releaseMic();
    }

    return () => {
      cancelled = true;
      if (!wantMic) releaseMic();
    };
  }, [state]);

  // Release mic on unmount.
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        for (const t of micStreamRef.current.getTracks()) t.stop();
        micStreamRef.current = null;
      }
      if (micCtxRef.current) {
        void micCtxRef.current.close().catch(() => {});
        micCtxRef.current = null;
      }
      micAnalyserRef.current = null;
    };
  }, []);

  // ─── Track theme color from the probe (handles hex & oklch) ───────────────
  useEffect(() => {
    const readColor = () => {
      const probe = probeRef.current;
      if (!probe) return;
      // Browser normalizes any color (hex/oklch/hsl) to rgb() here.
      const m = getComputedStyle(probe).color.match(/(\d+(?:\.\d+)?)/g);
      if (m && m.length >= 3) {
        colorRef.current = [+m[0], +m[1], +m[2]];
      }
    };
    readColor();
    const obs = new MutationObserver(readColor);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => obs.disconnect();
  }, []);

  // ─── Canvas sizing (DPR-aware) ────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();
    // Prefer ResizeObserver; fall back to window resize where it's absent
    // (e.g. jsdom) so we never hard-depend on it or perturb the test env.
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ─── Draw loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const micBuf = new Uint8Array(new ArrayBuffer(128));
    const ttsBuf = new Uint8Array(new ArrayBuffer(128));

    let raf = 0;
    let smoothed = 0; // eased amplitude 0..1
    let t = 0; // time accumulator (frames)

    const draw = () => {
      t += 1;
      const w = canvas.width;
      const h = canvas.height;
      const s = stateRef.current;
      const [cr, cg, cb] = colorRef.current;

      // ── Determine target amplitude for this state ──
      let target = 0;
      let herTint = 0; // 0 = cyan (me), 1 = emerald (her)
      if (s === "listening" || s === "transcribing") {
        const a = micAnalyserRef.current;
        const lvl = a ? analyserLevel(a, micBuf) : -1;
        // Mic RMS is small; scale up. Fallback: gentle breathing.
        target = lvl >= 0 ? Math.min(1, lvl * 6) : 0.18 + 0.12 * Math.sin(t * 0.05);
      } else if (s === "speaking") {
        herTint = 1;
        const a = ttsAnalyserRef.current;
        const lvl = a ? analyserLevel(a, ttsBuf) : -1;
        // If no real data (CORS-tainted / no analyser), synthesize a lively pulse.
        target =
          lvl > 0.01
            ? Math.min(1, lvl * 5)
            : 0.35 + 0.25 * Math.abs(Math.sin(t * 0.12));
      } else if (s === "processing") {
        // Thinking: slow contemplative breathing.
        target = 0.22 + 0.1 * Math.sin(t * 0.04);
      } else {
        target = 0.08; // idle / error — faint presence
      }

      // Ease toward target (fast attack, slower release feels responsive).
      const k = target > smoothed ? 0.4 : 0.12;
      smoothed = reduced ? 0.25 : lerp(smoothed, target, k);
      const level = smoothed;

      const [r, g, b] = mix([cr, cg, cb], EMERALD, herTint * 0.55);

      // ── Render ──
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const cx = w / 2;
      const cy = h * 0.46;
      const base = Math.min(w, h) * 0.28;

      // Soft central bloom.
      const bloomR = base * (1.6 + level * 1.1);
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
      bloom.addColorStop(0, `rgba(${r},${g},${b},${0.18 + level * 0.35})`);
      bloom.addColorStop(0.5, `rgba(${r},${g},${b},${0.06 + level * 0.12})`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
      ctx.fill();

      // Concentric reactive rings.
      const rings = 4;
      for (let i = 0; i < rings; i++) {
        const p = i / rings;
        const radius = base * (0.85 + p * 1.4) + level * base * (0.5 + p);
        const alpha = (0.5 - p * 0.34) * (0.35 + level * 0.9);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
        ctx.lineWidth = Math.max(1, (2.4 - p * 1.4) * (canvas.width / 400));
        ctx.shadowColor = `rgba(${r},${g},${b},0.9)`;
        ctx.shadowBlur = (10 + level * 26) * (canvas.width / 400);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Rotating scan arc — most visible while thinking, subtle otherwise.
      const scanAlpha = s === "processing" ? 0.55 : 0.2 + level * 0.3;
      const scanR = base * 1.7;
      const rot = t * (s === "processing" ? 0.03 : 0.012);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r},${g},${b},${scanAlpha})`;
      ctx.lineWidth = 2 * (canvas.width / 400);
      ctx.arc(cx, cy, scanR, rot, rot + Math.PI * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, scanR, rot + Math.PI, rot + Math.PI * 1.35);
      ctx.stroke();

      ctx.globalCompositeOperation = "source-over";

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto aspect-[4/5] w-full max-w-[200px] select-none ${className ?? ""}`}
      aria-hidden="true"
    >
      {/* Probe: resolves --primary to a normalized rgb() we can read. */}
      <span
        ref={probeRef}
        style={{ color: "var(--primary)", position: "absolute", width: 0, height: 0, opacity: 0 }}
      />
      {/* Aura (behind) */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Avatar (front), edges faded into the panel */}
      <img
        src={avatarSrc}
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 72% 78% at 50% 42%, #000 55%, transparent 82%)",
          maskImage:
            "radial-gradient(ellipse 72% 78% at 50% 42%, #000 55%, transparent 82%)",
        }}
      />
    </div>
  );
}
