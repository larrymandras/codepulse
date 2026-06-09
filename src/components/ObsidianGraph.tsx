import { useCallback, useMemo } from 'react';
import { GraphData, GraphNode } from '../lib/obsidian';
import { ForceGraphCanvas } from './graph/ForceGraphCanvas';

interface ObsidianGraphProps {
  data: GraphData;
}

export function ObsidianGraph({ data }: ObsidianGraphProps) {
  // Vibrant, cyberpunk/neon palette
  const colors = [
    '#00ffcc', // Neon Cyan
    '#ff00ff', // Neon Magenta
    '#00ff00', // Neon Green
    '#ffff00', // Neon Yellow
    '#ff3366', // Neon Pink/Red
    '#9933ff', // Neon Purple
    '#00ccff', // Bright Sky Blue
    '#ff9900', // Neon Orange
  ];

  const groupColors = useMemo(() => {
    const map = new Map<string, string>();
    let colorIndex = 0;
    data.nodes.forEach(node => {
      if (!map.has(node.group)) {
        if (node.group === 'unresolved') {
          map.set(node.group, '#4b5563'); // gray-600
        } else {
          map.set(node.group, colors[colorIndex % colors.length]);
          colorIndex++;
        }
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.nodes]);

  const colorFn = useCallback(
    (n: any) => groupColors.get(n.group) || '#00ffcc',
    [groupColors],
  );

  const paintNode = useCallback(
    (
      node: any,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
      opts: { hovered: boolean },
    ) => {
      const isHovered = opts.hovered;
      const size = Math.max(node.val, 2); // Ensure minimum size
      const color = groupColors.get(node.group) || '#00ffcc';

      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);

      // Vibrant Glow Effect
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered ? 25 : 12;
      ctx.fillStyle = isHovered ? '#ffffff' : color;
      ctx.fill();

      // Reset shadow so text and other elements aren't blurred
      ctx.shadowBlur = 0;

      // Draw text
      if (globalScale > 1.5 || isHovered) {
        const fontSize = isHovered ? 14 / globalScale : 12 / globalScale;
        ctx.font = `${isHovered ? 'bold ' : ''}${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text Background for readability
        const textWidth = ctx.measureText(node.name).width;
        const bgHeight = fontSize + 4;
        const bgY = node.y + size + fontSize - bgHeight / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.roundRect(node.x - textWidth / 2 - 4, bgY, textWidth + 8, bgHeight, 4);
        ctx.fill();

        ctx.fillStyle = isHovered ? '#ffffff' : color;
        ctx.fillText(node.name, node.x, node.y + size + fontSize);
      }
    },
    [groupColors],
  );

  // Link styling matches the previous inline behavior: dim/thin by default,
  // bright cyan when an endpoint is hovered. Hover is owned by ForceGraphCanvas;
  // react-force-graph resolves link.source/target to node objects at runtime.
  const linkColorFn = useCallback(
    (link: any) =>
      link.__hoverId &&
      (link.source.id === link.__hoverId || link.target.id === link.__hoverId)
        ? '#00ffcc'
        : 'rgba(0, 255, 204, 0.15)',
    [],
  );
  const linkWidthFn = useCallback(() => 0.5, []);

  return (
    <ForceGraphCanvas
      data={data}
      colorFn={colorFn}
      labelFn={(n: any) => n.name}
      paintNode={paintNode as any}
      linkColorFn={linkColorFn}
      linkWidthFn={linkWidthFn}
      nodeRelSize={1}
      className="w-full h-[600px] border border-[#00ffcc]/20 rounded-xl overflow-hidden bg-gray-950 shadow-[0_0_30px_rgba(0,255,204,0.1)] relative"
    />
  );
}

// Re-export the node type so existing imports keep resolving.
export type { GraphNode };
