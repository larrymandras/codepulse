import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
import { forceX, forceY, forceCollide } from "d3-force-3d";

/**
 * Generic force-graph canvas extracted from ObsidianGraph (Phase 74).
 *
 * A thin, reusable wrapper over `react-force-graph-2d` that owns hover state,
 * the click-to-center behavior, and the dark glow container, while delegating
 * ALL domain encoding to callbacks:
 *   - `colorFn(node)`           → node fill color
 *   - `paintNode(node,ctx,scale,{hovered})` → optional custom canvas paint
 *   - `linkColorFn` / `linkWidthFn` → edge styling
 *   - `linkLineDashFn`          → dashed edges (e.g. superseded KG triples)
 *   - `focusSet`               → ids to keep bright; everything else dims
 *
 * Both ObsidianGraph (its neon obsidian palette) and the KG Explorer (type
 * colors + temporal/contradiction edge styling) render through this. The
 * component is intentionally `any`-typed at the graph boundary because
 * react-force-graph mutates node objects (adds x/y) at runtime.
 */

export interface ForceGraphHandle {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  /** Get/set/remove a named d3 force on the running simulation. */
  d3Force: (name: string, force?: any) => any;
  /** Restart the force simulation (call after injecting new forces). */
  d3ReheatSimulation: () => void;
}

export interface ForceGraphCanvasProps {
  data: { nodes: any[]; links: any[] };
  /** node fill color (also used for default circle paint + glow). */
  colorFn?: (node: any) => string;
  /** force-graph hover tooltip text. */
  labelFn?: (node: any) => string;
  /** optional fully-custom node paint. Receives hover state in opts. */
  paintNode?: (
    node: any,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
    opts: { hovered: boolean; dimmed: boolean },
  ) => void;
  linkColorFn?: (link: any) => string;
  linkWidthFn?: (link: any) => number;
  /** return a [dash,gap] array for dashed links (e.g. superseded), or null. */
  linkLineDashFn?: (link: any) => number[] | null;
  linkDirectionalArrow?: boolean;
  /** ids to keep fully bright; non-members are dimmed. null = no dimming. */
  focusSet?: Set<string> | null;
  onNodeClick?: (node: any) => void;
  onNodeHover?: (node: any | null) => void;
  onBackgroundClick?: () => void;
  /** fired once the force simulation settles (cooldown reached). Use to
      zoomToFit on initial layout / after data changes. */
  onEngineStop?: () => void;
  /** nodeRelSize passthrough (default 1). */
  nodeRelSize?: number;
  /** Tailwind classes for the outer container (sizing/border). */
  className?: string;
  /** show the radial dark-space backdrop (default true). */
  backdrop?: boolean;
  /** When true and nodes carry community, inject forceX/forceY cluster forces.
   *  No-op when no node has a non-null community (SC#4 no-regression). */
  clusterForce?: boolean;
  /** When supplied, draws a halo arc around each node where this returns non-null.
   *  Halo sits between the fill and the selection ring (caller's paintNode owns the selection ring). */
  communityColorFn?: (node: any) => string | null;
  /** Default node fill color when no colorFn is provided. Parent supplies a
   *  theme-resolved value (e.g. from useThemeColors().primary). Falls back to
   *  reading --primary from the document if omitted. */
  defaultNodeColor?: string;
  /** Default link color when no linkColorFn is provided. Parent supplies a
   *  theme-resolved value (e.g. from useThemeColors().primaryAlpha18). Falls
   *  back to reading --primary@0.18 from the document if omitted. */
  defaultLinkColor?: string;
}

export const ForceGraphCanvas = forwardRef<
  ForceGraphHandle,
  ForceGraphCanvasProps
>(function ForceGraphCanvas(props, ref) {
  const {
    data,
    colorFn,
    labelFn,
    paintNode,
    linkColorFn,
    linkWidthFn,
    linkLineDashFn,
    linkDirectionalArrow,
    focusSet = null,
    onNodeClick,
    onNodeHover,
    onBackgroundClick,
    onEngineStop,
    nodeRelSize = 1,
    className,
    backdrop = true,
    clusterForce,
    communityColorFn,
    defaultNodeColor,
    defaultLinkColor,
  } = props;

  // Resolve the fallback node color: prefer parent-supplied defaultNodeColor (theme-aware),
  // then try reading --primary from the live CSSOM, then fall back to a safe neutral.
  // This path is only hit when no colorFn AND no defaultNodeColor is supplied.
  const resolvedDefaultNodeColor =
    defaultNodeColor ??
    (typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#6b7280"
      : "#6b7280");

  // Resolve the fallback link color: prefer parent-supplied defaultLinkColor (theme-aware).
  // When no defaultLinkColor is supplied, read --primary from CSSOM and build an alpha variant.
  // Falls back to a transparent zinc if CSSOM is unavailable or returns an unsupported format.
  const resolvedDefaultLinkColor =
    defaultLinkColor ??
    (typeof document !== "undefined"
      ? (() => {
          const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
          if (primary && primary.startsWith("#") && primary.length >= 7) {
            const r = parseInt(primary.slice(1, 3), 16);
            const g = parseInt(primary.slice(3, 5), 16);
            const b = parseInt(primary.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, 0.18)`;
          }
          return "rgba(107, 114, 128, 0.18)"; // zinc neutral fallback (never emerald)
        })()
      : "rgba(107, 114, 128, 0.18)");

  const fgRef = useRef<any>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    centerAt: (x, y, ms) => fgRef.current?.centerAt(x, y, ms),
    zoom: (k, ms) => fgRef.current?.zoom(k, ms),
    zoomToFit: (ms, padding) => fgRef.current?.zoomToFit(ms, padding),
    d3Force: (name, force) => fgRef.current?.d3Force(name, force),
    d3ReheatSimulation: () => fgRef.current?.d3ReheatSimulation(),
  }));

  // ── Cluster force injection (KG-09 SC#3 / SC#4) ──────────────────────────
  // Gate on community data presence; remove forces when absent (SC#4 no-regression).
  useEffect(() => {
    if (!clusterForce) return;
    const fg = fgRef.current;
    if (!fg) return;

    const hasCommunity = data.nodes.some((n: any) => n.community != null);
    if (!hasCommunity) {
      // SC#4: no community data — remove forces so layout is unchanged.
      fg.d3Force("clusterX", null);
      fg.d3Force("clusterY", null);
      fg.d3Force("clusterCollide", null);
      return;
    }

    // Compute dynamic centroids on a ring for each unique community id.
    const communities = [
      ...new Set(
        data.nodes
          .filter((n: any) => n.community != null)
          .map((n: any) => n.community as number),
      ),
    ];
    const R = 150;
    const centroids = new Map(
      communities.map((c, i) => {
        const angle = (i / communities.length) * 2 * Math.PI;
        return [c, { x: Math.cos(angle) * R, y: Math.sin(angle) * R }];
      }),
    );

    // Honor prefers-reduced-motion: skip reheating the simulation (static halo colors suffice).
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    fg.d3Force(
      "clusterX",
      forceX((node: any) =>
        node.community != null
          ? (centroids.get(node.community)?.x ?? 0)
          : undefined,
      ).strength(reducedMotion ? 0 : 0.15),
    );
    fg.d3Force(
      "clusterY",
      forceY((node: any) =>
        node.community != null
          ? (centroids.get(node.community)?.y ?? 0)
          : undefined,
      ).strength(reducedMotion ? 0 : 0.15),
    );
    fg.d3Force(
      "clusterCollide",
      forceCollide((node: any) => (node.val ?? 3) + 2).strength(0.7),
    );

    if (!reducedMotion) {
      fg.d3ReheatSimulation();
    }
  }, [data.nodes, clusterForce]);

  const color = colorFn ?? (() => resolvedDefaultNodeColor);

  const isDimmed = useCallback(
    (nodeId: string) => !!focusSet && !focusSet.has(nodeId),
    [focusSet],
  );

  // Default circle+glow paint when no custom paintNode is supplied.
  const defaultPaint = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const hovered = node.id === hoverId;
      const dimmed = isDimmed(node.id);
      const size = Math.max(node.val ?? 3, 2);
      const c = color(node);
      ctx.globalAlpha = dimmed ? 0.2 : 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
      ctx.shadowColor = c;
      ctx.shadowBlur = hovered ? 24 : 10;
      ctx.fillStyle = hovered ? "#ffffff" : c;
      ctx.fill();
      ctx.shadowBlur = 0;
      if (globalScale > 1.4 || hovered) {
        const fontSize = (hovered ? 13 : 11) / globalScale;
        ctx.font = `${hovered ? "bold " : ""}${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = node.name ?? node.id;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
        ctx.fillRect(node.x - tw / 2 - 4, node.y + size + 2, tw + 8, fontSize + 4);
        ctx.fillStyle = hovered ? "#ffffff" : c;
        ctx.fillText(label, node.x, node.y + size + 2 + (fontSize + 4) / 2);
      }
      ctx.globalAlpha = 1;
    },
    [hoverId, isDimmed, color],
  );

  const paint = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const dimmed = isDimmed(node.id);
      if (paintNode) {
        paintNode(node, ctx, globalScale, {
          hovered: node.id === hoverId,
          dimmed,
        });
      } else {
        defaultPaint(node, ctx, globalScale);
      }
      // Community halo — drawn after the node fill/ring, before labels.
      // Sits under the selection ring (caller's paintNode owns that layer).
      if (communityColorFn) {
        const haloColor = communityColorFn(node);
        if (haloColor) {
          const size = Math.max(node.val ?? 3, 2);
          ctx.beginPath();
          ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI, false);
          ctx.strokeStyle = haloColor;
          ctx.lineWidth = 2;
          ctx.globalAlpha = dimmed ? 0.08 : 0.7;
          ctx.shadowColor = haloColor;
          ctx.shadowBlur = 6;
          ctx.stroke();
          // Reset to avoid bleeding state into the next node's paint.
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }
      }
    },
    [paintNode, defaultPaint, hoverId, isDimmed, communityColorFn],
  );

  return (
    <div
      className={
        className ??
        "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]"
      }
      style={{ boxShadow: "var(--glow-lg)" }}
    >
      {backdrop && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 via-[#09090b] to-black opacity-80 pointer-events-none" />
      )}
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeId="id"
        nodeLabel={labelFn ?? ((n: any) => n.name ?? n.id)}
        nodeColor={(n: any) => color(n)}
        nodeRelSize={nodeRelSize}
        nodeCanvasObject={paint}
        linkColor={
          linkColorFn ?? (() => resolvedDefaultLinkColor)
        }
        linkWidth={linkWidthFn ?? (() => 0.6)}
        linkLineDash={
          linkLineDashFn ? (l: any) => linkLineDashFn(l) : undefined
        }
        linkDirectionalArrowLength={linkDirectionalArrow ? 3.5 : 0}
        linkDirectionalArrowRelPos={1}
        onNodeHover={(n: any) => {
          setHoverId(n?.id ?? null);
          onNodeHover?.(n ?? null);
        }}
        onNodeClick={(n: any) => {
          fgRef.current?.centerAt(n.x, n.y, 800);
          fgRef.current?.zoom(3, 800);
          onNodeClick?.(n);
        }}
        onBackgroundClick={() => onBackgroundClick?.()}
        onEngineStop={() => onEngineStop?.()}
        cooldownTicks={120}
        d3VelocityDecay={0.3}
        backgroundColor="transparent"
      />
    </div>
  );
});
