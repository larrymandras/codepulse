/**
 * ChartBlock — wraps FlexBarChart for use in the BlockRenderer generative UI system.
 *
 * Phase 03, Plan 02: IL-03 block rendering.
 */

import { FlexBarChart } from "@/components/FlexBarChart";
import type { ChartBlockData } from "@/types/generative-blocks";

interface ChartBlockProps {
  block: ChartBlockData;
}

export function ChartBlock({ block }: ChartBlockProps) {
  const segments = block.data.map((d) => ({ label: d.label, value: d.value }));

  return (
    <div>
      {block.title && (
        <p className="text-sm uppercase tracking-wide text-(--muted-foreground) mb-1">
          {block.title}
        </p>
      )}
      <FlexBarChart data={segments} />
    </div>
  );
}
