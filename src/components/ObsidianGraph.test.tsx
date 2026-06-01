import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ObsidianGraph } from './ObsidianGraph';
import type { GraphData } from '../lib/obsidian';

/**
 * ForceGraph2D renders to a <canvas> via d3-force/WebGL, which jsdom can't run.
 * We mock it with a stub that captures the props ObsidianGraph computes, so we
 * can assert the color mapping, data passthrough, and link/paint callbacks
 * without a real canvas. The native graph render is covered by browser UAT.
 */
const h = vi.hoisted(() => ({ props: null as Record<string, any> | null }));
vi.mock('react-force-graph-2d', () => ({
  default: (props: Record<string, any>) => {
    h.props = props;
    return null;
  },
}));

function graph(nodes: GraphData['nodes'], links: GraphData['links'] = []): GraphData {
  return { nodes, links };
}
const node = (id: string, group: string, extra: Partial<GraphData['nodes'][number]> = {}) =>
  ({ id, name: id, path: `${id}.md`, group, val: 1, ...extra });

beforeEach(() => {
  h.props = null;
});

describe('ObsidianGraph', () => {
  it('renders without crashing and passes graphData straight through', () => {
    const g = graph([node('a', 'root'), node('b', 'root')], [{ source: 'a', target: 'b' }]);
    render(<ObsidianGraph data={g} />);
    expect(h.props).not.toBeNull();
    expect(h.props!.graphData).toBe(g);
  });

  it('colors the first two non-unresolved groups from the neon palette', () => {
    // Iteration order of data.nodes drives palette assignment.
    const g = graph([node('a', 'root'), node('b', 'projects')]);
    render(<ObsidianGraph data={g} />);
    const nodeColor = h.props!.nodeColor as (n: { group: string }) => string;
    expect(nodeColor({ group: 'root' })).toBe('#00ffcc'); // palette[0]
    expect(nodeColor({ group: 'projects' })).toBe('#ff00ff'); // palette[1]
  });

  it('always colors the "unresolved" group gray, regardless of palette cycling', () => {
    const g = graph([node('a', 'root'), node('ghost', 'unresolved')]);
    render(<ObsidianGraph data={g} />);
    const nodeColor = h.props!.nodeColor as (n: { group: string }) => string;
    expect(nodeColor({ group: 'unresolved' })).toBe('#4b5563');
  });

  it('falls back to cyan for a group not present in the data', () => {
    render(<ObsidianGraph data={graph([node('a', 'root')])} />);
    const nodeColor = h.props!.nodeColor as (n: { group: string }) => string;
    expect(nodeColor({ group: 'not-in-data' })).toBe('#00ffcc');
  });

  it('renders links dim/thin when nothing is hovered', () => {
    render(<ObsidianGraph data={graph([node('a', 'root'), node('b', 'root')], [{ source: 'a', target: 'b' }])} />);
    const link = { source: { id: 'a' }, target: { id: 'b' } };
    expect((h.props!.linkColor as (l: unknown) => string)(link)).toBe('rgba(0, 255, 204, 0.15)');
    expect((h.props!.linkWidth as (l: unknown) => number)(link)).toBe(0.5);
  });

  it('paintNode draws a node circle and (when zoomed in) its label without throwing', () => {
    render(<ObsidianGraph data={graph([node('a', 'root', { val: 5 })])} />);
    const paint = h.props!.nodeCanvasObject as (n: any, ctx: any, scale: number) => void;

    const ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      roundRect: vi.fn(),
      measureText: vi.fn(() => ({ width: 24 })),
      shadowColor: '',
      shadowBlur: 0,
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
    };
    const n = { id: 'a', name: 'Alpha', x: 10, y: 20, val: 5, group: 'root' };

    // globalScale > 1.5 → label branch is taken
    expect(() => paint(n, ctx as unknown as CanvasRenderingContext2D, 2)).not.toThrow();
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, 2 * Math.PI, false);
    expect(ctx.fillText).toHaveBeenCalledWith('Alpha', 10, expect.any(Number));
  });

  it('paintNode skips the label when zoomed out', () => {
    render(<ObsidianGraph data={graph([node('a', 'root')])} />);
    const paint = h.props!.nodeCanvasObject as (n: any, ctx: any, scale: number) => void;
    const ctx = {
      beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillText: vi.fn(),
      roundRect: vi.fn(), measureText: vi.fn(() => ({ width: 24 })),
      shadowColor: '', shadowBlur: 0, fillStyle: '', font: '', textAlign: '', textBaseline: '',
    };
    const n = { id: 'a', name: 'Alpha', x: 0, y: 0, val: 3, group: 'root' };

    // globalScale < 1.5 and not hovered → no text drawn
    paint(n, ctx as unknown as CanvasRenderingContext2D, 0.5);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
