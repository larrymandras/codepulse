/**
 * hexToRgba — convert a CSS hex color string to rgba(r, g, b, alpha).
 *
 * Handles:
 *  - 6-digit hex  (#rrggbb)
 *  - 3-digit shorthand (#rgb → #rrggbb)
 *  - Leading whitespace (getComputedStyle returns " #06b6d4" in some browsers)
 *  - Defensive pass-through for non-hex values (oklch, named colors, etc.)
 *    so canvas code silently passes through rather than corrupting fillStyle.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const trimmed = hex.trim();

  // Match 3 or 6 hex digits (with or without leading #)
  const match = trimmed.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) {
    // Non-hex value (oklch, rgb(), etc.) — return unchanged (Pitfall 3 defence)
    return trimmed;
  }

  let hex6 = match[1];
  if (hex6.length === 3) {
    // Expand #abc → #aabbcc
    hex6 = hex6[0] + hex6[0] + hex6[1] + hex6[1] + hex6[2] + hex6[2];
  }

  const r = parseInt(hex6.slice(0, 2), 16);
  const g = parseInt(hex6.slice(2, 4), 16);
  const b = parseInt(hex6.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
