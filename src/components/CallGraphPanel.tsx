import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { GlassPanel } from "./GlassPanel";
import { SectionHeader } from "./SectionHeader";
import { Skeleton } from "./ui/skeleton";
import CallGraphSVG from "./CallGraphSVG";
import type { GraphEdge } from "./CallGraphSVG";

const LEGEND_ITEMS = [
  { label: "Healthy", color: "#27272a" },
  { label: "Errored", color: "#ef4444" },
  { label: "Pending", color: "#eab308" },
];

export default function CallGraphPanel() {
  const rawEdges = useQuery(api.callGraphEdges.listEdges);

  // Loading state
  if (rawEdges === undefined) {
    return (
      <GlassPanel>
        <div className="p-4">
          <SectionHeader title="AGENT CALL GRAPH" />
          <div className="space-y-3">
            <Skeleton className="h-[320px] w-full" />
          </div>
        </div>
      </GlassPanel>
    );
  }

  // Map Convex docs to GraphEdge shape
  const edges: GraphEdge[] = rawEdges.map((e) => ({
    agentId: e.agentId,
    toolName: e.toolName,
    status: e.status,
    callCount: e.callCount,
    errorCount: e.errorCount,
  }));

  // Empty state
  if (edges.length === 0) {
    return (
      <GlassPanel>
        <div className="p-4">
          <SectionHeader title="AGENT CALL GRAPH" />
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-base font-semibold text-gray-300 mb-1">No call graph data</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Call graph appears here after Ástríðr agents run with call graph telemetry enabled.
            </p>
          </div>
        </div>
      </GlassPanel>
    );
  }

  return (
    <GlassPanel>
      <div className="p-4">
        <SectionHeader title="AGENT CALL GRAPH" />
        <div className="overflow-auto" style={{ maxHeight: "600px" }}>
          <CallGraphSVG edges={edges} />
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          {LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}
