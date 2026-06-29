/**
 * Cross-graph focus centering helper (Phase 85, WR-02).
 *
 * The force layout assigns node.x/.y asynchronously after a graph mounts, so a
 * focus-on-mount apply (useFocusParam) usually runs BEFORE coordinates exist.
 * The previous inline guard (`if (node.x != null) centerAt(...)`) skipped
 * centering in that window and never retried — the deep-linked node got
 * selected but never centered.
 *
 * This polls the live node object (react-force-graph mutates x/y in place on the
 * same reference) via requestAnimationFrame until coordinates are assigned, then
 * centers + zooms exactly once. Bounded by `maxFrames` so it gives up cleanly if
 * the node never lays out. Returns a cancel fn for callers that want to abort.
 */

export interface CenterableHandle {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
}

export interface CenterWhenReadyOptions {
  /** Pan/zoom animation duration in ms. */
  ms?: number;
  /** Target zoom level. */
  zoom?: number;
  /** Max frames to wait for x/y before giving up (~1.5s at 60fps). */
  maxFrames?: number;
}

export function centerNodeWhenReady(
  fgRef: { current: CenterableHandle | null },
  node: { x?: number; y?: number } | null | undefined,
  opts: CenterWhenReadyOptions = {},
): () => void {
  const { ms = 800, zoom = 3, maxFrames = 90 } = opts;
  let cancelled = false;
  let frames = 0;

  const schedule: (cb: () => void) => void =
    typeof requestAnimationFrame === "function"
      ? (cb) => requestAnimationFrame(() => cb())
      : (cb) => {
          setTimeout(cb, 16);
        };

  const tick = () => {
    if (cancelled || !node) return;
    if (node.x != null && node.y != null) {
      fgRef.current?.centerAt(node.x, node.y, ms);
      fgRef.current?.zoom(zoom, ms);
      return;
    }
    if (frames++ < maxFrames) schedule(tick);
  };

  tick();

  return () => {
    cancelled = true;
  };
}

// ---------------------------------------------------------------------------
// 3D centering helper (Phase 91, D-01b)
// ---------------------------------------------------------------------------

/**
 * Minimal handle surface required by centerNode3DWhenReady. Matches the
 * relevant subset of ForceGraph3DHandle from ForceGraph3D.tsx so callers
 * don't need to import the full handle type.
 */
export interface Centerable3DHandle {
  cameraPosition: (
    position: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number } | null,
    ms?: number
  ) => void;
  zoomToFit: (ms?: number, px?: number) => void;
}

/**
 * 3D analog of centerNodeWhenReady for the `?focus=` deep-link branch.
 *
 * Polls the live node object (react-force-graph-3d mutates x/y/z in place)
 * via requestAnimationFrame until coordinates are assigned, then calls
 * `cameraPosition` exactly once with:
 *   - position: { x, y, z: (node.z ?? 0) + 150 }  — pull the camera back
 *   - lookAt:   { x, y, z: node.z ?? 0 }           — aim at the node
 *
 * The explicit lookAt prevents the camera from defaulting to scene origin
 * when the node is far from (0,0,0) (Pitfall 6).
 *
 * Returns a cancel fn for callers that want to abort (e.g. on unmount or
 * before the effect deps change).
 */
export function centerNode3DWhenReady(
  fgRef: { current: Centerable3DHandle | null },
  node: { x?: number; y?: number; z?: number } | null | undefined,
  ms = 800,
  maxFrames = 90,
): () => void {
  let cancelled = false;
  let frames = 0;

  const schedule: (cb: () => void) => void =
    typeof requestAnimationFrame === "function"
      ? (cb) => requestAnimationFrame(() => cb())
      : (cb) => {
          setTimeout(cb, 16);
        };

  const tick = () => {
    if (cancelled || !node) return;
    if (node.x != null && node.y != null) {
      fgRef.current?.cameraPosition(
        { x: node.x, y: node.y, z: (node.z ?? 0) + 150 },
        { x: node.x, y: node.y, z: node.z ?? 0 },
        ms,
      );
      return;
    }
    if (frames++ < maxFrames) schedule(tick);
  };

  tick();

  return () => {
    cancelled = true;
  };
}
