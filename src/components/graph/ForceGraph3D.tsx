import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import ForceGraph3DLib from "react-force-graph-3d";

/**
 * 3D render surface for the Memory Galaxy mode (Phase 91, G3D-01/G3D-02).
 *
 * ISOLATION RULE: This is the ONLY file permitted to import `react-force-graph-3d`,
 * `three`, or `3d-force-graph`. The dynamic-import boundary (`React.lazy` in
 * CodeVaultGraph.tsx) keeps Three.js out of the main bundle (SC#2). Importing
 * any of those packages from any file statically reachable from main would break
 * chunk isolation.
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
      className,
    } = props;

    // Internal ref to the react-force-graph-3d instance — typed as any because
    // the library uses any-typed internals (per RESEARCH.md, do not import its types).
    const fgRef3dInner = useRef<any>(null);

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
         */}
        <ForceGraph3DLib
          ref={fgRef3dInner}
          graphData={data}
          nodeId="id"
          nodeLabel={labelFn}
          nodeColor={colorFn}
          nodeVal={nodeValFn}
          nodeRelSize={4}
          nodeResolution={6}
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
