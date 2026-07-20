// Dependency-free circle packing for the 2D "Orchard" (circle-packing) vault view.
//
// We deliberately avoid pulling in d3-hierarchy. This is a greedy phyllotaxis-style
// packer: place each circle (largest first) at the first spiral position where it
// doesn't overlap any already-placed circle. Not as tight as d3.pack, but correct
// (guaranteed non-overlapping) and easy to reason about. Pure — no DOM, no three.

export interface Packable {
  r: number;
  x?: number;
  y?: number;
}

/**
 * Pack `items` (each with a radius `r`) around the origin without overlaps.
 * Mutates each item's `x`/`y` and returns the enclosing radius (max distance from
 * the recentered origin to any circle's far edge). `gap` is the min spacing.
 */
export function packCircles<T extends Packable>(items: T[], gap = 2): number {
  if (items.length === 0) return 0;
  const order = [...items].sort((a, b) => b.r - a.r);
  const placed: { r: number; x: number; y: number }[] = [];

  for (const c of order) {
    let px = 0;
    let py = 0;
    if (placed.length > 0) {
      let found = false;
      // Spiral outward until a free spot is found. Step scales with this circle's
      // size so large circles probe at a coarser resolution.
      const step = Math.max(c.r * 0.35, 1.5);
      for (let t = 1; t < 200000 && !found; t++) {
        const ang = t * 0.35;
        const rad = Math.sqrt(t) * step;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad;
        let ok = true;
        for (let i = 0; i < placed.length; i++) {
          const p = placed[i]!;
          const dx = p.x - x;
          const dy = p.y - y;
          const rr = p.r + c.r + gap;
          if (dx * dx + dy * dy < rr * rr) {
            ok = false;
            break;
          }
        }
        if (ok) {
          px = x;
          py = y;
          found = true;
        }
      }
    }
    c.x = px;
    c.y = py;
    placed.push({ r: c.r, x: px, y: py });
  }

  // Recenter to the bounding-box center and compute the enclosing radius.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of placed) {
    minX = Math.min(minX, p.x - p.r);
    maxX = Math.max(maxX, p.x + p.r);
    minY = Math.min(minY, p.y - p.r);
    maxY = Math.max(maxY, p.y + p.r);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let R = 0;
  for (const c of order) {
    c.x = (c.x ?? 0) - cx;
    c.y = (c.y ?? 0) - cy;
    R = Math.max(R, Math.hypot(c.x, c.y) + c.r);
  }
  return R;
}
