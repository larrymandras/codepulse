/**
 * MetricBlock — wraps MetricCard for use in the BlockRenderer generative UI system.
 *
 * Phase 03, Plan 02: IL-03 block rendering.
 */

import MetricCard from "@/components/MetricCard";
import type { MetricBlockData } from "@/types/generative-blocks";

interface MetricBlockProps {
  block: MetricBlockData;
}

export function MetricBlock({ block }: MetricBlockProps) {
  return (
    <MetricCard label={block.label} value={block.value} trend={block.trend} />
  );
}
