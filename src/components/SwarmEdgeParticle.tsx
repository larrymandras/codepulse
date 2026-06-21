/**
 * SwarmEdgeParticle — CSS particle overlay for running-state edges.
 *
 * Phase 149-03 — PULSE-03.
 * Renders a 6px emerald dot animated along the SVG edge path via offsetPath/offsetDistance.
 * MUST return null when prefers-reduced-motion is active (UI-SPEC Accessibility + Motion spec).
 * Rendered inside React Flow's EdgeLabelRenderer (Pitfall 7 from RESEARCH).
 *
 * Only mount this component on edges where target node state === "running".
 * @keyframes particle-flow is defined in index.css.
 */

import { EdgeLabelRenderer } from "@xyflow/react";

interface SwarmEdgeParticleProps {
  /** SVG path string from the React Flow edge (passed as edgePath from getBezierPath/getSmoothStepPath) */
  path: string;
}

export default function SwarmEdgeParticle({ path }: SwarmEdgeParticleProps) {
  // Mandatory prefers-reduced-motion check — UI-SPEC Accessibility section
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) return null;

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: "absolute",
          pointerEvents: "none",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#22c55e",
          // CSS Motion Path: animate the dot along the SVG edge path
          offsetPath: `path('${path}')`,
          offsetDistance: "0%",
          animation: "particle-flow 1.2s ease-in-out infinite",
        }}
      />
    </EdgeLabelRenderer>
  );
}
