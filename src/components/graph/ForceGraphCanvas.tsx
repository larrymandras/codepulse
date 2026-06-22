import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ForceGraph2D from "react-force-graph-2d";

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
}

const DEFAULT_COLOR = "#10b981";

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
  } = props;

  const fgRef = useRef<any>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    centerAt: (x, y, ms) => fgRef.current?.centerAt(x, y, ms),
    zoom: (k, ms) => fgRef.current?.zoom(k, ms),
    zoomToFit: (ms, padding) => fgRef.current?.zoomToFit(ms, padding),
  }));

  const color = colorFn ?? (() => DEFAULT_COLOR);

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
      if (paintNode) {
        paintNode(node, ctx, globalScale, {
          hovered: node.id === hoverId,
          dimmed: isDimmed(node.id),
        });
      } else {
        defaultPaint(node, ctx, globalScale);
      }
    },
    [paintNode, defaultPaint, hoverId, isDimmed],
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
          linkColorFn ?? (() => "rgba(16, 185, 129, 0.18)")
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
