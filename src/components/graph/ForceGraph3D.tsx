import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import ForceGraph3DLib from "react-force-graph-3d";
import * as THREE from "three";

/**
 * 3D render surface for the Memory Galaxy mode (Phase 91, G3D-01/G3D-02).
 *
 * ISOLATION RULE: This is the ONLY file permitted to import `react-force-graph-3d`,
 * `three`, or `3d-force-graph`. The dynamic-import boundary (`React.lazy` in
 * CodeVaultGraph.tsx) keeps Three.js out of the main bundle (SC#2). Importing
 * any of those packages from any file statically reachable from main would break
 * chunk isolation. `three` itself is a transitive dep of `react-force-graph-3d`
 * (not in package.json) — `SkillVaultScene.tsx` established the same import
 * precedent; `src/types/three.d.ts` is the hand-maintained ambient shim.
 *
 * Key differences from the 2D surface (ForceGraphCanvas.tsx):
 *   - `cooldownTicks={150}` — finite so `onEngineStop` fires and zoomToFit runs
 *     (Pitfall 3: the default is Infinity; onEngineStop never fires otherwise)
 *   - `backgroundColor="#09090b"` instead of an inner radial-gradient backdrop div
 *     (the library owns its own canvas; an overlay div would just cover it)
 *   - `nodeResolution={6}` — icosphere segment count (quality vs. GPU trade-off)
 *   - All node/link colors must be plain hex strings — no rgba, because Three.js
 *     Color drops rgba alpha silently, producing black nodes (Pitfall 1)
 */

// ---------------------------------------------------------------------------
// Lit-node halo ring (Phase 190 Plan 05, GLXY-03 — 190-UI-SPEC.md §"The halo
// ring"). A gold, camera-facing halo sprite marking a "lit" node — a resting
// presence signal that coexists with (never overwrites) the node's own
// type-color fill sphere. Built here, inside the isolation boundary, from a
// data-shaped prop (Set<string>) — never from an Object3D factory passed down
// by the page (that would defeat the isolation rule above).
// ---------------------------------------------------------------------------

const HALO_COLOR = "#fde047";
const HALO_OPACITY = 0.55;
/** Outer diameter relative to the node's own rendered sphere diameter. */
const HALO_DIAMETER_RATIO = 1.6;
/** Above the scene's default render order — paired with depthTest:false so the
 *  ring never disappears behind occluding geometry (T-190-13, accepted risk). */
const HALO_RENDER_ORDER = 999;
/** px — the procedurally generated annulus texture is square and small; it is
 *  scaled onto each sprite via sprite.scale, not regenerated per node. */
const HALO_TEXTURE_SIZE = 128;
/** Fallback only, used if a caller omits `litRestingMultiplier` — must match
 *  KnowledgeGraph.tsx's own `LIT_RESTING_MULTIPLIER` (currently 1.8). Callers
 *  should pass the real constant explicitly to avoid the two values drifting
 *  apart; this exists so the prop can stay optional. */
const DEFAULT_LIT_RESTING_MULTIPLIER = 1.8;
/** Mirrors the `nodeRelSize={NODE_REL_SIZE}` prop passed to ForceGraph3DLib
 *  below — one constant so the ring-sizing math (which re-derives the
 *  library's own `radius = Math.cbrt(val) * nodeRelSize` formula, verified
 *  against `three-forcegraph.mjs:1157`) can never drift from the actual prop. */
const NODE_REL_SIZE = 4;

// Lazily memoized and shared across every sprite/node/call — a bloom that
// re-runs the node-object build on every animation frame (T-190-11) must not
// allocate a canvas texture per node per frame. `undefined` = not yet built;
// `null` = built and jsdom (no 2D canvas context) said it can't be.
let haloTexture: THREE.CanvasTexture | null | undefined;

/** @internal test-only — resets the module-level halo texture memo so a test
 *  can assert the "allocated once" property without depending on suite order. */
export function __resetHaloTextureForTests(): void {
  haloTexture = undefined;
}

function getHaloTexture(): THREE.CanvasTexture | null {
  if (haloTexture !== undefined) return haloTexture;

  const canvas = document.createElement("canvas");
  canvas.width = HALO_TEXTURE_SIZE;
  canvas.height = HALO_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // jsdom (unit tests) has no 2D canvas context — degrade to a mapless
    // sprite rather than throw. Real browsers always have one.
    haloTexture = null;
    return haloTexture;
  }

  const center = HALO_TEXTURE_SIZE / 2;
  const outerRadius = center - 2; // small margin so the ring isn't clipped
  const gradient = ctx.createRadialGradient(
    center,
    center,
    0,
    center,
    center,
    outerRadius
  );
  // Transparent center, bright band at ~mid-to-outer radius (~20% of the
  // outer radius wide per the UI-SPEC ring-band width), fading back to
  // transparent at the edge — an annulus, not a filled disc (the core
  // type-color sphere must stay fully visible inside it).
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0)");
  gradient.addColorStop(0.86, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
  ctx.fill();

  haloTexture = new THREE.CanvasTexture(canvas);
  return haloTexture;
}

/**
 * Pure ring builder — exported so it can be unit-tested without mounting the
 * canvas. Returns a camera-facing `THREE.Sprite` for a node in `litNodeIds`,
 * `undefined` for one that is not. Never throws (jsdom-safe).
 *
 * Sized off the RESTING (un-pulsed) sphere diameter, not the live/animated
 * one (D-09): the ring must look identical mid-bloom and thirty seconds
 * later, so it is deliberately NOT driven by the same `litSizeMultiplier`
 * that animates the sphere through the 800ms arrival bloom. `node.val` is
 * multiplied by `litRestingMultiplier` (the steady-state ×1.8 the bloom
 * settles to, passed down by the caller) rather than by whatever the live
 * multiplier currently is.
 */
export function buildLitHaloSprite(
  node: { id: string; val?: number },
  litNodeIds: Set<string> | undefined,
  litRestingMultiplier: number = DEFAULT_LIT_RESTING_MULTIPLIER
): THREE.Sprite | undefined {
  if (!litNodeIds || !litNodeIds.has(node.id)) return undefined;

  const material = new THREE.SpriteMaterial({
    map: getHaloTexture() ?? undefined,
    color: HALO_COLOR,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: HALO_OPACITY,
    blending: THREE.AdditiveBlending,
  });

  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = HALO_RENDER_ORDER;

  const restingVal = (node.val ?? 1) * litRestingMultiplier;
  const sphereDiameter = 2 * Math.cbrt(restingVal) * NODE_REL_SIZE;
  sprite.scale.setScalar(sphereDiameter * HALO_DIAMETER_RATIO);

  return sprite;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ForceGraph3DHandle {
  cameraPosition: (
    position: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number } | null,
    ms?: number
  ) => void;
  zoomToFit: (
    ms?: number,
    px?: number,
    nodeFilterFn?: (node: any) => boolean
  ) => void;
  refresh: () => void;
  scene: () => any;
  renderer: () => any;
  d3Force: (name: string, force?: any) => any;
  d3ReheatSimulation: () => void;
  pauseAnimation: () => void;
  resumeAnimation: () => void;
}

export interface ForceGraph3DProps {
  data: { nodes: any[]; links: any[] };
  /** Node sphere color — must be a hex string; rgba is ignored by Three.js Color. */
  colorFn?: (node: any) => string;
  /** Hover tooltip label. */
  labelFn?: (node: any) => string;
  /** Controls sphere radius multiplier for selected/highlighted nodes. */
  nodeValFn?: (node: any) => number;
  /** Link cylinder color — must be a hex string; use linkOpacity for transparency. */
  linkColorFn?: (link: any) => string;
  onNodeClick?: (node: any) => void;
  onNodeHover?: (node: any | null) => void;
  onBackgroundClick?: () => void;
  /** Fired once the force simulation settles (cooldownTicks reached). */
  onEngineStop?: () => void;
  /**
   * GLXY-03 (Phase 190): ids of nodes that render the gold halo ring — a
   * resting presence signal, separate from and coexisting with `colorFn`'s
   * type-color fill. Data-shaped (`Set<string>`), deliberately never an
   * `Object3D` factory: this file is the only one permitted to import
   * `three` (see isolation rule above), and threading a Three.js object down
   * from the page would defeat that.
   */
  litNodeIds?: Set<string>;
  /**
   * The steady-state (post-bloom) size multiplier a lit node's sphere rests
   * at, used ONLY to size the halo ring so it never pulses with the live
   * arrival-bloom animation (D-09). Must match the caller's own resting
   * multiplier constant (`KnowledgeGraph.tsx`'s `LIT_RESTING_MULTIPLIER`);
   * defaults to 1.8 if omitted.
   */
  litRestingMultiplier?: number;
  /** Tailwind classes for the outer container (sizing / border). */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Default export allows `React.lazy(() => import("./ForceGraph3D"))` to work
 * correctly in CodeVaultGraph.tsx (lazy() requires a default export). The named
 * export is preserved for type imports (e.g. `import type { ForceGraph3DHandle }`).
 */
export const ForceGraph3D = forwardRef<ForceGraph3DHandle, ForceGraph3DProps>(
  function ForceGraph3D(props, ref) {
    const {
      data,
      colorFn,
      labelFn,
      nodeValFn,
      linkColorFn,
      onNodeClick,
      onNodeHover,
      onBackgroundClick,
      onEngineStop,
      litNodeIds,
      litRestingMultiplier,
      className,
    } = props;

    // Internal ref to the react-force-graph-3d instance — typed as any because
    // the library uses any-typed internals (per RESEARCH.md, do not import its types).
    const fgRef3dInner = useRef<any>(null);

    // GLXY-03: accessor forwarded as `nodeThreeObject`, paired with
    // `nodeThreeObjectExtend={true}` below so the library's default sphere is
    // EXTENDED (both render) rather than replaced (see buildLitHaloSprite doc).
    const nodeThreeObjectFn = useCallback(
      (node: any) => buildLitHaloSprite(node, litNodeIds, litRestingMultiplier),
      [litNodeIds, litRestingMultiplier]
    );

    // ── Container sizing (187-05 checkpoint fix) ────────────────────────────
    // react-force-graph-3d defaults width/height to window.innerWidth/innerHeight
    // when not supplied, so without these the library builds a canvas sized to
    // the whole window instead of the (smaller, clipped) wrapper div — the graph
    // ends up centered in the oversized canvas, which visually crops it into the
    // bottom-right corner of the visible box. zoomToFit(...) then frames the lit
    // sources relative to that wrong canvas too, so a "correct" camera fly can
    // still park nodes off-screen (blocks SC#1).
    //
    // containerRef measures the SAME div that owns className (so fullscreen
    // toggling in CodeVaultGraph.tsx, which swaps canvasClass on this element
    // without unmounting it, is picked up by the ResizeObserver below).
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState<{
      width: number;
      height: number;
    } | null>(null);

    useLayoutEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      // Skip zero/degenerate measurements (unmounted, display:none, or jsdom's
      // default all-zero layout) — passing 0 to the library renders a blank
      // canvas instead of the "wait for a real measurement" behavior we want.
      const applyRect = (rect: { width: number; height: number }) => {
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
        }
      };

      // Synchronous initial measure via useLayoutEffect (not useEffect) so the
      // first commit already carries real dimensions, before the browser paints —
      // otherwise the library's window-size fallback would flash for one frame.
      applyRect(el.getBoundingClientRect());

      // ResizeObserver may be unavailable in some test environments — degrade to
      // the single initial measurement above rather than throw.
      if (typeof ResizeObserver === "undefined") return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          applyRect(entry.contentRect);
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Expose a typed subset of the library's imperative API.
    useImperativeHandle(ref, () => ({
      cameraPosition: (position, lookAt, ms) =>
        fgRef3dInner.current?.cameraPosition(position, lookAt, ms),
      zoomToFit: (ms, px, nodeFilterFn) =>
        fgRef3dInner.current?.zoomToFit(ms, px, nodeFilterFn),
      refresh: () => fgRef3dInner.current?.refresh(),
      scene: () => fgRef3dInner.current?.scene(),
      renderer: () => fgRef3dInner.current?.renderer(),
      d3Force: (name, force) => fgRef3dInner.current?.d3Force(name, force),
      d3ReheatSimulation: () => fgRef3dInner.current?.d3ReheatSimulation(),
      pauseAnimation: () => fgRef3dInner.current?.pauseAnimation(),
      resumeAnimation: () => fgRef3dInner.current?.resumeAnimation(),
    }));

    return (
      <div
        ref={containerRef}
        className={
          className ??
          "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]"
        }
        style={{ boxShadow: "var(--glow-lg)" }}
      >
        {/*
         * Prop baseline from UI-SPEC §3D Sphere Geometry Props + PATTERNS.md core baseline.
         * Colors arrive as hex strings via props — hardcoded values here are:
         *   backgroundColor="#09090b"  (dark background matching the design system)
         * width/height come from the ResizeObserver above (187-05 checkpoint fix) —
         * left undefined until a real measurement lands so the library doesn't
         * momentarily fall back to window.innerWidth/innerHeight.
         */}
        <ForceGraph3DLib
          ref={fgRef3dInner}
          graphData={data}
          width={dimensions?.width}
          height={dimensions?.height}
          nodeId="id"
          nodeLabel={labelFn}
          nodeColor={colorFn}
          nodeVal={nodeValFn}
          nodeRelSize={NODE_REL_SIZE}
          nodeResolution={6}
          // Cast: the library's own bundled types declare nodeThreeObject as
          // `(node) => Object3D` (no `| undefined`), but its runtime accessor
          // is checked as falsy (`three-forcegraph.mjs:1133`, `if (customObj
          // && ...)`) — returning undefined for "no custom object" is the
          // documented pattern this ring builder relies on; the type is
          // simply too strict for its own behavior.
          nodeThreeObject={nodeThreeObjectFn as (node: any) => THREE.Object3D}
          nodeThreeObjectExtend={true}
          linkColor={linkColorFn}
          linkOpacity={0.2}
          linkWidth={0.6}
          backgroundColor="#09090b"
          cooldownTicks={150}
          warmupTicks={0}
          d3VelocityDecay={0.3}
          onNodeClick={(node: any) => onNodeClick?.(node)}
          onNodeHover={(node: any | null) => onNodeHover?.(node ?? null)}
          onBackgroundClick={() => onBackgroundClick?.()}
          onEngineStop={() => onEngineStop?.()}
        />
      </div>
    );
  }
);

// Default export for React.lazy() in CodeVaultGraph.tsx (lazy() requires default export).
// Named export is preserved above for type imports.
export default ForceGraph3D;
