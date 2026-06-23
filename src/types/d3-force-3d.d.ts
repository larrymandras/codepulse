/**
 * Minimal ambient type declarations for d3-force-3d (no @types package available).
 * Only declares the subset used by ForceGraphCanvas.tsx (Phase 86, KG-09).
 */
declare module "d3-force-3d" {
  export interface ForceWithStrength<This> {
    strength(s: number): This;
  }

  export interface ForceX<NodeDatum> extends ForceWithStrength<ForceX<NodeDatum>> {
    (alpha: number): void;
  }

  export interface ForceY<NodeDatum> extends ForceWithStrength<ForceY<NodeDatum>> {
    (alpha: number): void;
  }

  export interface ForceCollide<NodeDatum>
    extends ForceWithStrength<ForceCollide<NodeDatum>> {
    (alpha: number): void;
  }

  export function forceX<NodeDatum = any>(
    x?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number | undefined),
  ): ForceX<NodeDatum>;

  export function forceY<NodeDatum = any>(
    y?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number | undefined),
  ): ForceY<NodeDatum>;

  export function forceCollide<NodeDatum = any>(
    radius?: number | ((node: NodeDatum, i: number, nodes: NodeDatum[]) => number),
  ): ForceCollide<NodeDatum>;
}
