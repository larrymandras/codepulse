import type { Page } from "@playwright/test";

/**
 * Shared, sentinel-guarded rasterisation + WCAG contrast module.
 *
 * THE COLOUR MEASUREMENT LAW (122-CONTEXT.md, 122-TOKEN-LAW.md,
 * `[[tailwind-v4-oklch-defeats-css-color-scraping]]`): Tailwind v4 emits
 * `oklch()`/`oklab()`. A number-extraction regex over a computed colour
 * string reads the HUE ANGLE as a channel — Phase 120's withdrawn
 * measurement's tell was an impossible `rgb(0,0,262)`. Every colour claim
 * that consumes this module goes through `sampleColor`/`compositeSample`,
 * which hand the raw string straight to `canvas.fillStyle` (a real browser
 * colour parser) and read back true sRGB bytes via `getImageData`. Reading a
 * computed string (`getComputedStyle(...).color`) to hand to the sampler is
 * fine; running a NUMBER-EXTRACTING REGEX over one is the forbidden thing.
 *
 * `canvas.fillStyle` silently KEEPS its prior value on unparseable input —
 * it does not throw. Every sampler below sets a magenta sentinel first,
 * verifies the fill actually moved off it, and returns `null` (never a
 * guess) if it did not. Every consumer MUST refuse to report (assert
 * `.not.toBeNull()`) rather than substituting a default.
 *
 * Moved verbatim (cut, not copied) from `e2e/theme-rendered-result.spec.ts`
 * as part of 123-02 (D-02/D-03) — a second rasteriser or a second luminance
 * formula is forbidden by `123-RESEARCH.md`'s Don't Hand-Roll table.
 */

export const SENTINEL = "#ff00ff";

export type RGB = [number, number, number];

/**
 * Sentinel-guarded rasterised sampler (122-RESEARCH.md's verified pattern).
 * Hands `cssColorString` directly to canvas.fillStyle -- the browser's real
 * colour parser, immune to the oklch-as-regex trap because nothing here
 * extracts numbers from a string with a regex.
 */
export async function sampleColor(page: Page, cssColorString: string): Promise<RGB | null> {
  return page.evaluate(
    ({ color, SENTINEL }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = SENTINEL;
      ctx.fillStyle = color; // unparseable input silently leaves fillStyle at SENTINEL
      if (ctx.fillStyle.toLowerCase() === SENTINEL) return null;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b] as [number, number, number];
    },
    { color: cssColorString, SENTINEL },
  );
}

/**
 * Composites `topColor` (which may carry alpha) over `bottomColor` on the
 * same 1x1 canvas via two sequential fillRect calls -- real browser
 * "source-over" alpha compositing, the same method 122-BADGE-LAW.md §8 used
 * to measure the translucent old Forge `failed` pairing. Each fillStyle
 * assignment is sentinel-guarded independently.
 */
export async function compositeSample(page: Page, bottomColor: string, topColor: string): Promise<RGB | null> {
  return page.evaluate(
    ({ bottom, top, SENTINEL }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = SENTINEL;
      ctx.fillStyle = bottom;
      if (ctx.fillStyle.toLowerCase() === SENTINEL) return null;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = SENTINEL;
      ctx.fillStyle = top;
      if (ctx.fillStyle.toLowerCase() === SENTINEL) return null;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r, g, b] as [number, number, number];
    },
    { bottom: bottomColor, top: topColor, SENTINEL },
  );
}

/**
 * Injects a throwaway element carrying `className` into the live page,
 * reads its computed `color` or `backgroundColor`, then removes it. This is
 * how a token's REAL rendered resolution is measured without depending on
 * live Convex data existing for a given badge/chip to appear on screen --
 * the class string is real, shipped source (Tailwind's Vite plugin scans
 * all of src/ regardless of what's currently mounted, per this repo's own
 * `@source not "../.planning"` directive), so the synthetic element paints
 * through the exact same compiled CSS rule a real one would.
 */
export async function paintedColorOfClass(
  page: Page,
  className: string,
  prop: "color" | "backgroundColor",
): Promise<string> {
  return page.evaluate(
    ({ className, prop }) => {
      const el = document.createElement("div");
      el.className = className;
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const value = prop === "color" ? cs.color : cs.backgroundColor;
      document.body.removeChild(el);
      return value;
    },
    { className, prop },
  );
}

/** Resolved value of a CSS custom property on <html>, read as declared text
 *  (NOT resolved through getComputedStyle on an element, since a property
 *  that itself aliases another var() would return the literal "var(...)"
 *  string via getPropertyValue -- every token consumed here is declared as
 *  a direct literal, verified against src/index.css before use). */
export async function getThemeTokenText(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim(), token);
}

export function relativeLuminance([r, g, b]: RGB): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(fg: RGB, bg: RGB): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [lighter, darker] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Euclidean distance in sRGB byte space. Not a WCAG figure -- this answers
 *  "are these two rendered colours visibly the same swatch or not", which is
 *  what D-27's surface-distinctness and status-ok/primary-separation checks
 *  need. Threshold rationale is stated at each call site. */
export function channelDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * D-03: resolves the TARGET element's own computed font-size/weight, never
 * `document.documentElement`'s. Returns `null` -- never a default -- when
 * `selector` matches nothing in the live page, per this module's sentinel
 * discipline (a consumer must refuse to report rather than substitute a
 * guessed metric).
 */
export async function readTextMetrics(
  page: Page,
  selector: string,
): Promise<{ fontSizePx: number; fontWeight: number } | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      fontSizePx: parseFloat(cs.fontSize),
      fontWeight: parseInt(cs.fontWeight, 10),
    };
  }, selector);
}

/**
 * D-03's WCAG large-text allowance, mirroring axe verbatim: 3:1 applies only
 * to text >=24px, OR >=18.66px at font-weight >=700; every other occurrence
 * owes the normal-text 4.5:1 floor. Do NOT flatten this to a bare 4.5 --
 * that flags compliant large display text and makes pass 1 (axe) and pass 2
 * (this harness) disagree about the identical element.
 */
export function wcagThresholdFor({ fontSizePx, fontWeight }: { fontSizePx: number; fontWeight: number }): number {
  if (fontSizePx >= 24) return 3;
  if (fontSizePx >= 18.66 && fontWeight >= 700) return 3;
  return 4.5;
}
