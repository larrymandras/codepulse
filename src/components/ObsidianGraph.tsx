import { useCallback, useRef, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GraphData, GraphNode } from '../lib/obsidian';

interface ObsidianGraphProps {
  data: GraphData;
}

export function ObsidianGraph({ data }: ObsidianGraphProps) {
  const fgRef = useRef<any>();
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);

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
  }, [data.nodes]);

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isHovered = node.id === hoverNode?.id;
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
        const bgY = node.y + size + fontSize - bgHeight/2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.roundRect(node.x - textWidth/2 - 4, bgY, textWidth + 8, bgHeight, 4);
        ctx.fill();

        ctx.fillStyle = isHovered ? '#ffffff' : color;
        ctx.fillText(node.name, node.x, node.y + size + fontSize);
      }
    },
    [hoverNode, groupColors]
  );

  return (
    <div className="w-full h-[600px] border border-[#00ffcc]/20 rounded-xl overflow-hidden bg-gray-950 shadow-[0_0_30px_rgba(0,255,204,0.1)] relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black opacity-80 pointer-events-none" />
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel="name"
        nodeColor={(n: any) => groupColors.get(n.group) || '#00ffcc'}
        nodeRelSize={1}
        nodeCanvasObject={paintNode}
        linkColor={(link: any) => (link.source.id === hoverNode?.id || link.target.id === hoverNode?.id) ? '#00ffcc' : 'rgba(0, 255, 204, 0.15)'}
        linkWidth={(link: any) => (link.source.id === hoverNode?.id || link.target.id === hoverNode?.id ? 2 : 0.5)}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={(link: any) => (link.source.id === hoverNode?.id || link.target.id === hoverNode?.id ? 4 : 1.5)}
        linkDirectionalParticleSpeed={0.008}
        linkDirectionalParticleColor={(link: any) => {
          const sourceGroup = data.nodes.find(n => n.id === link.source.id || n.id === link.source)?.group;
          return groupColors.get(sourceGroup as string) || '#00ffcc';
        }}
        onNodeHover={(node: any) => setHoverNode(node || null)}
        onNodeClick={(node: any) => {
          // Center on clicked node
          fgRef.current?.centerAt(node.x, node.y, 1000);
          fgRef.current?.zoom(4, 1000);
        }}
        cooldownTicks={100}
        d3VelocityDecay={0.3}
        backgroundColor="transparent"
      />
    </div>
  );
}
