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
import avatarSpeakingSrc from "@/assets/avatar/astridr-avatar-speaking.png";

// Shared mask so both the calm and speaking frames fade into the panel
// identically — the crossfade reads as one figure changing expression.
const AVATAR_MASK =
  "radial-gradient(ellipse 72% 78% at 50% 42%, #000 55%, transparent 82%)";

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

  // Cached theme color (rgb), refreshed on theme change.
  const colorRef = useRef<[number, number, number]>(FALLBACK_CYAN);

  // NOTE: this component intentionally opens NO getUserMedia and NO mic
  // AudioContext. A 3rd concurrent mic capture (on top of the wake-word engine
  // and speech recognition) reconfigured the input device and left the
  // wake-word worklet dead after a voice session (wake word "worked then
  // stopped" until reload). The "listening" aura is therefore driven
  // synthetically. True mic-amplitude reactivity, when re-added, must REUSE the
  // wake-word engine's existing stream (an exposed AnalyserNode), never a new
  // capture. See .planning/AVATAR-HANDOFF.md.

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
      // The aura is a soft, low-frequency glow — it does not need retina
      // backing. Cap DPR at 1.25 to keep the per-frame fill/stroke area small
      // (the canvas is redrawn every frame). Higher DPR was a real cost.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
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
  // Performance-critical: this runs continuously while the panel is open on a
  // busy /chat page. It must stay cheap. Deliberately:
  //   - NO ctx.shadowBlur (the single most expensive 2D op) — glow comes from
  //     additive 'lighter' compositing + a radial bloom gradient instead.
  //   - throttled to ~30fps (plenty for a soft breathing glow),
  //   - paused when the tab is hidden,
  //   - fps-independent timing so animation speed is constant regardless.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = prefersReducedMotion();
    const ttsBuf = new Uint8Array(new ArrayBuffer(128));
    const FRAME_MS = 1000 / 30;

    // Ember motes — sparks drifting up through the aura; density/brightness
    // scale with the live amplitude. Seeded once per mount.
    const motes = Array.from({ length: 18 }, () => ({
      x: Math.random() * 2 - 1, // −1..1 of base radius
      sp: 0.25 + Math.random() * 0.5, // rise speed
      ph: Math.random() * 1000, // phase offset
      r: 0.8 + Math.random() * 1.5, // size
    }));

    let raf = 0;
    let smoothed = 0; // eased amplitude 0..1
    let lastDraw = -Infinity;

    const render = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const s = stateRef.current;
      const [cr, cg, cb] = colorRef.current;

      // ── Determine target amplitude for this state ──
      let target = 0;
      let herTint = 0; // 0 = cyan (me), 1 = emerald (her)
      if (s === "listening" || s === "transcribing") {
        target = 0.28 + 0.16 * Math.sin(t * 0.06) + 0.06 * Math.sin(t * 0.17);
      } else if (s === "speaking") {
        herTint = 1;
        const a = ttsAnalyserRef.current;
        const lvl = a ? analyserLevel(a, ttsBuf) : -1;
        target =
          lvl > 0.01
            ? Math.min(1, lvl * 5)
            : 0.35 + 0.25 * Math.abs(Math.sin(t * 0.12));
      } else if (s === "processing") {
        target = 0.22 + 0.1 * Math.sin(t * 0.04);
      } else {
        target = 0.08; // idle / error — faint presence
      }

      const k = target > smoothed ? 0.45 : 0.14;
      smoothed = reduced ? 0.25 : lerp(smoothed, target, k);
      const level = smoothed;

      const [r, g, b] = mix([cr, cg, cb], EMERALD, herTint * 0.55);

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const cx = w / 2;
      const cy = h * 0.46;
      const base = Math.min(w, h) * 0.28;
      const px = canvas.width / 400;

      // Soft central bloom (carries most of the glow now that shadowBlur is gone).
      const bloomR = base * (1.7 + level * 1.2);
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
      bloom.addColorStop(0, `rgba(${r},${g},${b},${0.22 + level * 0.4})`);
      bloom.addColorStop(0.45, `rgba(${r},${g},${b},${0.08 + level * 0.16})`);
      bloom.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
      ctx.fill();

      // Concentric additive rings — plain strokes, no shadow.
      const rings = 3;
      for (let i = 0; i < rings; i++) {
        const p = i / rings;
        const radius = base * (0.9 + p * 1.3) + level * base * (0.5 + p);
        const alpha = (0.55 - p * 0.32) * (0.4 + level * 0.9);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
        ctx.lineWidth = Math.max(1, (2.6 - p * 1.4) * px);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ember motes — small additive sparks rising through the aura. Cheap:
      // 18 tiny arcs, no shadows; brightness rides the live amplitude.
      if (!reduced) {
        const span = base * 2.3;
        for (const m of motes) {
          const prog = ((t * m.sp + m.ph) % 260) / 260; // 0..1 rising
          const my = cy + base * 1.05 - prog * span;
          const mx =
            cx + m.x * base * (0.95 + 0.25 * Math.sin(t * 0.012 + m.ph));
          // Fade in low, peak mid-rise, fade out high.
          const alpha =
            Math.max(0, prog * (1 - prog) * 4) * (0.10 + level * 0.45);
          if (alpha <= 0.01) continue;
          ctx.beginPath();
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.arc(mx, my, m.r * px * (1 + level * 0.8), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Rotating scan arc — most visible while thinking.
      const scanAlpha = s === "processing" ? 0.6 : 0.22 + level * 0.3;
      const scanR = base * 1.7;
      const rot = t * (s === "processing" ? 0.03 : 0.012);
      ctx.strokeStyle = `rgba(${r},${g},${b},${scanAlpha})`;
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.arc(cx, cy, scanR, rot, rot + Math.PI * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, scanR, rot + Math.PI, rot + Math.PI * 1.35);
      ctx.stroke();

      ctx.globalCompositeOperation = "source-over";
    };

    // Reduced motion → one static frame, no loop at all.
    if (reduced) {
      render(0);
      return;
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastDraw < FRAME_MS) return; // throttle to ~30fps
      lastDraw = now;
      if (typeof document !== "undefined" && document.hidden) return; // pause when hidden
      // fps-independent phase: express `now` as 60fps-equivalent frame count so
      // the sine multipliers keep their original visual speed.
      render(now / 16.67);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto aspect-[4/5] w-full max-w-[260px] select-none ${className ?? ""}`}
      aria-hidden="true"
    >
      {/* Probe: resolves --primary to a normalized rgb() we can read. */}
      <span
        ref={probeRef}
        style={{ color: "var(--primary)", position: "absolute", width: 0, height: 0, opacity: 0 }}
      />
      {/* Aura (behind) */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* Orbital rings — counter-rotating, each carrying a glowing satellite. */}
      <div className="aura-ring aura-ring-1" aria-hidden="true" />
      <div className="aura-ring aura-ring-2" aria-hidden="true" />
      {/* The figure floats gently; both frames bob together. */}
      <div className="aura-float absolute inset-0">
        {/* Calm frame — always present as the base layer. */}
        <img
          src={avatarSrc}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            WebkitMaskImage: AVATAR_MASK,
            maskImage: AVATAR_MASK,
            filter:
              "drop-shadow(0 0 18px color-mix(in oklab, var(--primary) 35%, transparent))",
          }}
        />
        {/* Speaking frame — crossfades in over the calm frame during her turn. */}
        <img
          src={avatarSpeakingSrc}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-out"
          style={{
            WebkitMaskImage: AVATAR_MASK,
            maskImage: AVATAR_MASK,
            opacity: state === "speaking" ? 1 : 0,
            filter: "drop-shadow(0 0 22px rgba(16,185,129,0.35))",
          }}
        />
      </div>
    </div>
  );
}
