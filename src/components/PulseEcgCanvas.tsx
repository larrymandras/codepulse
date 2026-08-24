/**
 * PulseEcgCanvas.tsx — the Pulse ECG's render layer (SIGNAL-02, Phase 125
 * Plan 06).
 *
 * A native `<canvas>` trace: a breathing baseline plus up to 60s of coloured
 * blips, no charting library. Pure render, props-driven — this plan does
 * NOT fetch, subscribe, count, or mount anything; plan 125-09 owns the data
 * feed (backfill + live merge) and plan 125-11 owns the mount site. 125-09
 * composes against exactly the exports declared in 125-06-PLAN.md's
 * `<interfaces>` block — do not change this file's public signature without
 * updating that contract.
 *
 * Gating (D-11): the rAF loop never runs behind a hidden tab, under
 * `prefers-reduced-motion`, or in the `readable` theme — this repo has
 * prior CPU-drift history on long-lived sessions (see AvatarAura.tsx's own
 * mount/unmount counter surface, built for exactly that class of bug).
 * `readable`'s blanket `animation: none !important` (src/index.css) is
 * CSS-only and cannot reach a rAF loop, so the gate here is explicit JS,
 * re-evaluated on mount, on `prefers-reduced-motion` changing, and on every
 * `data-theme`/`class` mutation.
 *
 * Colour (D-06): every stroke colour is a `getComputedStyle`-resolved CSS
 * custom property handed straight to `strokeStyle` — never regex-scraped.
 * Tailwind v4 emits `oklch()`/`oklab()` strings; a number-scrape reads the
 * hue angle as a channel (this repo's documented defect class, see
 * AvatarAura.tsx:239-257 for the pattern this file deliberately does NOT
 * copy). `fillStyle` does not throw on unparseable input — it silently
 * keeps its previous value — so a one-time sentinel round-trip detects a
 * token that failed to parse and reports it loudly instead of painting the
 * wrong colour forever.
 */
import { useEffect, useRef } from "react";
import { HUE_TOKEN, type EventHue } from "@/lib/eventHue";
import { METRIC_STATE_COPY } from "@/lib/metricState";

export type EcgFeedState = "unavailable" | "idle" | "live";

export interface EcgBlip {
  /** epoch ms of the event, already normalised by the caller */
  t: number;
  hue: EventHue;
}

export interface EcgPalette {
  astridr: string;
  machine: string;
  error: string;
  baseline: string;
}

// Fixed by the sketch (UI-SPEC:196) — 5min was tried and made the trace
// look empty. Not threaded as a parameter: `drawEcgFrame`'s exported
// contract has no `windowMs` argument (125-09 composes against exactly
// that signature), so this constant is the single source of truth for both
// the age->x mapping and the "drop blips older than the window" rule.
const WINDOW_MS = 60_000;

// Breathing baseline, opacity 0.5<->0.8. The divisor is written EXACTLY as the
// validated sketch writes it — `.planning/sketches/001-dashboard-quiet-control-
// room/index.html:592`, `Math.sin(now / 2000)` — deliberately NOT as a derived
// period constant.
//
// Why the literal form matters: that argument is already in radians, so the true
// period is 2*PI*2000 ~= 12,566ms, and 125-06-PLAN.md's prose misread the 2000
// divisor as a half-period and wrote "a 4s sine" (twice). Shipping that would
// have made the baseline breathe 3.14x faster than the design that was actually
// validated, on a page whose whole intent is "quiet control room". Larry chose
// the sketch on 2026-08-24 after the executor flagged the discrepancy rather
// than silently resolving it. Writing `now / 2000` inside a raw sin() keeps this
// byte-identical to the sketch so the misreading cannot recur; a rounded 12566
// constant would invite exactly the same re-derivation error.
const BREATHE_DIVISOR_MS = 2000;

// Deliberately not a real theme colour — used only as a round-trip probe to
// detect a CSS custom property that failed to parse. `fillStyle` silently
// keeps its previous value on unparseable input rather than throwing, so
// setting this then the resolved token and comparing the readback is what
// makes a failure detectable at all.
const SENTINEL_COLOR = "#ff00ff";

function breatheAlpha(now: number): number {
  return 0.5 + 0.3 * (0.5 + 0.5 * Math.sin(now / BREATHE_DIVISOR_MS));
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const computeAnimate = () =>
  !prefersReducedMotion() && document.documentElement.dataset.theme !== "readable";

/**
 * `HUE_TOKEN`'s values are always `var(--x)` literals (eventHue.ts's own
 * contract) — strip the wrapper to get the custom property name for
 * `getComputedStyle`. This is a fixed-offset slice on a static, hardcoded
 * literal from this repo's own source, never on a browser-resolved colour
 * string — D-06's no-regex-on-colour rule is about the latter.
 */
function cssVarName(token: string): string {
  return token.slice(4, -1);
}

/**
 * Resolve one CSS custom property to a colour string, proving it actually
 * parsed. Sets `fillStyle` to a sentinel, then to the resolved token; if the
 * readback still equals the sentinel, the token was empty or unparseable
 * (`fillStyle` no-ops rather than throwing), so this logs a single
 * `console.error` naming the property and falls back to `currentColor`
 * instead of silently painting the previous colour forever.
 */
function resolveToken(ctx: CanvasRenderingContext2D, cssVar: string, label: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  ctx.fillStyle = SENTINEL_COLOR;
  const sentinelReadback = ctx.fillStyle;
  ctx.fillStyle = raw;
  if (ctx.fillStyle === sentinelReadback) {
    console.error(
      `[PulseEcgCanvas] palette token "${label}" (${cssVar}) failed to parse: "${raw}"`,
    );
    return "currentColor";
  }
  return raw;
}

function resolvePalette(ctx: CanvasRenderingContext2D): EcgPalette {
  return {
    astridr: resolveToken(ctx, cssVarName(HUE_TOKEN.astridr), "astridr"),
    machine: resolveToken(ctx, cssVarName(HUE_TOKEN.machine), "machine"),
    error: resolveToken(ctx, cssVarName(HUE_TOKEN.error), "error"),
    baseline: resolveToken(ctx, "--muted-foreground", "baseline"),
  };
}

/**
 * Pure draw step — no React, no DOM lookups beyond the passed context.
 * Exported for direct testing against a recording 2D context.
 */
export function drawEcgFrame(
  ctx: CanvasRenderingContext2D,
  opts: {
    width: number;
    height: number;
    dpr: number;
    now: number;
    blips: readonly EcgBlip[];
    feedState: EcgFeedState;
    palette: EcgPalette;
    animate: boolean;
  },
): void {
  const { width: w, height: h, dpr, now, blips, feedState, palette, animate } = opts;
  const mid = h * 0.62;

  ctx.clearRect(0, 0, w, h);

  if (feedState === "unavailable") {
    // D-08: feed down/absent — dotted baseline, fixed opacity, no
    // breathing, no blips. The italic empty-state copy (METRIC_STATE_COPY's
    // `empty` entry) is rendered as a DOM element by the component below,
    // never as canvas text.
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = palette.baseline;
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
    ctx.setLineDash([]); // reset — must not leak into the next frame
    ctx.globalAlpha = 1;
    return;
  }

  // idle/live: breathing baseline. D-08: a quiet system genuinely is
  // nominal, so `idle` draws this and nothing else — no text, no dashing.
  // `animate` false (reduced-motion/readable) freezes at a fixed mid-range
  // alpha instead of stopping mid-breath at an arbitrary phase.
  ctx.globalAlpha = animate ? breatheAlpha(now) : 0.55;
  ctx.strokeStyle = palette.baseline;
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (feedState !== "live") return; // idle: no blips to draw

  for (const blip of blips) {
    const age = (now - blip.t) / WINDOW_MS;
    if (age < 0 || age >= 1) continue; // outside the 60s window
    const x = w - age * w;
    const decay = Math.max(0, 1 - age * 1.15);
    const spike = h * 0.34 * decay;
    // Errors spike DOWN; machine and astridr both spike up — the sign is
    // the only difference in the four-point path (sketch reference,
    // index.html:601-616).
    const dir = blip.hue === "error" ? 1 : -1;
    const color =
      blip.hue === "error" ? palette.error : blip.hue === "astridr" ? palette.astridr : palette.machine;
    ctx.globalAlpha = 0.25 + 0.75 * decay;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4 * dpr;
    ctx.beginPath();
    ctx.moveTo(x - 8 * dpr, mid);
    ctx.lineTo(x - 3 * dpr, mid + dir * spike);
    ctx.lineTo(x + 1 * dpr, mid - dir * spike * 0.35);
    ctx.lineTo(x + 6 * dpr, mid);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function PulseEcgCanvas(props: {
  blips: readonly EcgBlip[];
  feedState: EcgFeedState;
  windowMs?: number; // default 60_000
  height?: number; // default 96
}) {
  const { blips, feedState, windowMs = WINDOW_MS, height = 96 } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest props without restarting the rAF loop or its observers — same
  // pattern as AvatarAura.tsx's stateRef.
  const blipsRef = useRef(blips);
  blipsRef.current = blips;
  const feedStateRef = useRef(feedState);
  feedStateRef.current = feedState;

  const paletteRef = useRef<EcgPalette>({
    astridr: "currentColor",
    machine: "currentColor",
    error: "currentColor",
    baseline: "currentColor",
  });

  // ─── Canvas sizing (DPR-aware, AvatarAura.tsx:260-283 pattern) ───────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const { width } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [height]);

  // ─── Gated render loop + palette resolution ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = false;

    const dpr = () => Math.min(window.devicePixelRatio || 1, 1.25);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // D-11: the loop must reschedule itself to be resumable, but paints
      // nothing while the tab is hidden — this repo's prior CPU-drift
      // history on long-lived sessions.
      if (typeof document !== "undefined" && document.hidden) return;
      drawEcgFrame(ctx, {
        width: canvas.width,
        height: canvas.height,
        dpr: dpr(),
        now,
        blips: blipsRef.current,
        feedState: feedStateRef.current,
        palette: paletteRef.current,
        animate: true,
      });
    };

    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    };

    const startLoop = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };

    const drawStatic = () => {
      drawEcgFrame(ctx, {
        width: canvas.width,
        height: canvas.height,
        dpr: dpr(),
        now: performance.now(),
        blips: blipsRef.current,
        feedState: feedStateRef.current,
        palette: paletteRef.current,
        animate: false,
      });
    };

    // D-11: re-evaluated on mount, on the reduced-motion media query
    // changing, and on every theme mutation — switching INTO `readable`
    // must stop a running loop, not leave it running behind a
    // frozen-looking UI.
    const syncGate = () => {
      if (computeAnimate()) {
        startLoop();
      } else {
        stopLoop();
        drawStatic();
      }
    };

    paletteRef.current = resolvePalette(ctx);
    syncGate();

    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    mq?.addEventListener?.("change", syncGate);

    const onVisibility = () => {
      // Repaint promptly on return rather than showing a frame frozen from
      // before the tab was hidden.
      if (!document.hidden && running) {
        drawEcgFrame(ctx, {
          width: canvas.width,
          height: canvas.height,
          dpr: dpr(),
          now: performance.now(),
          blips: blipsRef.current,
          feedState: feedStateRef.current,
          palette: paletteRef.current,
          animate: true,
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Kept from AvatarAura.tsx — the OTHER idea, per the plan's
    // planner_corrections (not the regex colour probe): re-resolve the
    // palette on theme change, and re-evaluate the animate gate alongside
    // it, since `readable` both changes colours AND must stop the loop.
    const themeObs = new MutationObserver(() => {
      paletteRef.current = resolvePalette(ctx);
      syncGate();
    });
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => {
      stopLoop();
      mq?.removeEventListener?.("change", syncGate);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObs.disconnect();
    };
  }, []);

  const showEmptyCopy = feedState === "unavailable";
  const conditionWord =
    feedState === "unavailable" ? "unavailable" : feedState === "idle" ? "idle, no events" : "live";

  return (
    <div ref={containerRef} className="relative w-full" style={{ height }} data-ecg-state={feedState}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Pulse trace, last ${Math.round(windowMs / 1000)}s, ${conditionWord}`}
        className="absolute inset-0 h-full w-full"
      />
      {showEmptyCopy && (
        <div
          aria-live="polite"
          className="absolute inset-0 flex items-center justify-center text-[13px] italic"
          style={{ opacity: 0.55, color: "var(--muted-foreground)" }}
        >
          {METRIC_STATE_COPY.empty.label}
        </div>
      )}
    </div>
  );
}
