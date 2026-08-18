import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { FlexBarChart } from "../FlexBarChart";
import { SectionHeader } from "../SectionHeader";
import { GlassPanel } from "../GlassPanel";

/**
 * GlassPanel ownership: this COMPONENT owns the GlassPanel that wraps the
 * chart/empty-state, matching the pre-move nesting where SectionHeader sits
 * outside the GlassPanel as a sibling, both inside the same boundary. The
 * page's call site after 121-04 is just a boundary wrapping this component
 * directly, with no outer GlassPanel from the page.
 *
 * Self-fetching: owns advisorEvents.executionDepthHistogram. No error
 * handling here (D-02) — relies entirely on the error-boundary wrapper its
 * parent supplies.
 */
export default function ExecutionDepthPanel() {
  const depthHistogram = useQuery(api.advisorEvents.executionDepthHistogram);

  return (
    <>
      <SectionHeader title="Execution Depth Distribution" />
      <GlassPanel className="p-4">
        {depthHistogram && depthHistogram.length > 0 ? (
          <FlexBarChart
            data={depthHistogram.map((d) => ({ label: d.label, value: d.count }))}
            height={120}
          />
        ) : (
          <p className="text-base text-muted-foreground">No execution depth data yet.</p>
        )}
      </GlassPanel>
    </>
  );
}
