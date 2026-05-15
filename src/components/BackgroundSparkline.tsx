import { memo, useId } from "react";
import { motion, useReducedMotion } from "motion/react";

// --- Types -------------------------------------------------------------------

export interface BackgroundSparklineProps {
  /** Array of numeric values (exactly 12 for morphing compatibility) */
  data: number[];
  /** CSS color string for stroke and gradient fill, e.g. "var(--accent-cost)" */
  accentColor: string;
  /** Index of this tile in the grid for stagger delay (0-6) */
  tileIndex?: number;
}

// --- Catmull-Rom -> Cubic Bezier SVG Path (centripetal, alpha=0.5) -----------

interface Point { x: number; y: number; }

/**
 * Converts an array of {x,y} points to a smooth SVG cubic Bezier path string.
 * Uses centripetal Catmull-Rom interpolation (alpha=0.5) to avoid self-intersections.
 * Adapted from: gist.github.com/nicholaswmin/c2661eb11cad5671d816 (MIT)
 */
export function catmullRomPath(pts: Point[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const alpha = 0.5;
    const d1 = Math.pow(Math.hypot(p1.x - p0.x, p1.y - p0.y), alpha);
    const d2 = Math.pow(Math.hypot(p2.x - p1.x, p2.y - p1.y), alpha);
    const d3 = Math.pow(Math.hypot(p3.x - p2.x, p3.y - p2.y), alpha);
    const d1sq = d1 * d1;
    const d2sq = d2 * d2;
    const d3sq = d3 * d3;
    const A = 2 * d1sq + 3 * d1 * d2 + d2sq;
    const B = 2 * d3sq + 3 * d3 * d2 + d2sq;
    const N = 3 * d1 * (d1 + d2) || 1;
    const M = 3 * d3 * (d3 + d2) || 1;
    const cp1 = {
      x: (-d2sq * p0.x + A * p1.x + d1sq * p2.x) / N,
      y: (-d2sq * p0.y + A * p1.y + d1sq * p2.y) / N,
    };
    const cp2 = {
      x: (d3sq * p1.x + B * p2.x - d2sq * p3.x) / M,
      y: (d3sq * p1.y + B * p2.y - d2sq * p3.y) / M,
    };
    d += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

// --- Data Normalization -------------------------------------------------------

const VIEWBOX_W = 100;
const VIEWBOX_H = 72;
const PAD = { top: 4, bottom: 4, left: 8, right: 8 };

function normalizeData(data: number[]): Point[] {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1; // guard: prevents NaN on flat/all-zero data
  const drawW = VIEWBOX_W - PAD.left - PAD.right;
  const drawH = VIEWBOX_H - PAD.top - PAD.bottom;
  const step = drawW / (data.length - 1 || 1);

  return data.map((val, i) => ({
    x: PAD.left + i * step,
    y: PAD.top + drawH - ((val - min) / range) * drawH,
  }));
}

function makeAreaPath(strokePath: string, pts: Point[]): string {
  if (!strokePath || pts.length === 0) return '';
  const last = pts[pts.length - 1];
  const first = pts[0];
  const bottom = VIEWBOX_H - PAD.bottom;
  return `${strokePath} L ${last.x},${bottom} L ${first.x},${bottom} Z`;
}

// --- Helper: pad data to 12 points -------------------------------------------

/** Pad a scalar value to 12 buckets for consistent path command count (morph compatibility) */
export function flatSparkline(value: number, length = 12): number[] {
  return Array.from({ length }, () => value ?? 0);
}

// --- Component ---------------------------------------------------------------

function BackgroundSparklineInner({ data, accentColor, tileIndex = 0 }: BackgroundSparklineProps) {
  const id = useId().replace(/:/g, '');
  const shouldReduce = useReducedMotion();

  const pts = normalizeData(data);
  const strokeD = catmullRomPath(pts);
  const areaD = makeAreaPath(strokeD, pts);

  if (!strokeD) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      <defs>
        <linearGradient
          id={`sg-${id}`}
          x1="0" y1="0"
          x2="0" y2={VIEWBOX_H}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={accentColor} stopOpacity={0.08} />
          <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Fill area -- fades in on mount, morphs on data change */}
      <motion.path
        d={areaD}
        fill={`url(#sg-${id})`}
        initial={shouldReduce ? undefined : { opacity: 0 }}
        animate={shouldReduce ? undefined : { opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: tileIndex * 0.1 }}
      />
      {/* Stroke curve -- draws in on mount via pathLength, morphs on data change */}
      <motion.path
        d={strokeD}
        fill="none"
        stroke={accentColor}
        strokeWidth={1.5}
        strokeOpacity={0.2}
        initial={shouldReduce ? undefined : { pathLength: 0, opacity: 0 }}
        animate={shouldReduce ? undefined : { pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.6, ease: "easeOut", delay: tileIndex * 0.1 },
          opacity: { duration: 0.01 },
          d: { duration: 0.4, ease: "easeInOut" },
        }}
      />
    </svg>
  );
}

export const BackgroundSparkline = memo(BackgroundSparklineInner);
