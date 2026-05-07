import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";
import SectionErrorBoundary from "./SectionErrorBoundary";
import { ChevronDown, ChevronUp } from "lucide-react";

function TurnMetricsTableInner({ sessionId }: { sessionId: string }) {
  const [expanded, setExpanded] = useState(false);
  const turns = useQuery(
    api.agentMetrics.turnMetrics,
    expanded ? { sessionId } : "skip"
  ) ?? [];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-300 hover:text-gray-100 transition-colors"
      >
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Turn Metrics
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {turns.length === 0 ? (
            <p className="text-gray-500 text-sm">No turn data for this session.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Turn</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-center">Tools</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turns.map((t: any, i: number) => (
                  <TableRow key={t._id} className={i % 2 === 0 ? "bg-gray-800/30" : ""}>
                    <TableCell className="text-center">#{t.turnNumber ?? i + 1}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-[180px]">
                      {t.modelUsed ?? "---"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {t.inputTokens?.toLocaleString() ?? 0} in / {t.outputTokens?.toLocaleString() ?? 0} out
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {t.costUsd != null ? `$${t.costUsd.toFixed(4)}` : "---"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {t.responseTimeMs != null
                        ? `${Math.round(t.responseTimeMs).toLocaleString()} ms`
                        : "---"}
                    </TableCell>
                    <TableCell className="text-center">
                      {t.toolCallCount != null && t.toolCallCount > 0 ? t.toolCallCount : "---"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

export function TurnMetricsTable({ sessionId }: { sessionId: string }) {
  return (
    <SectionErrorBoundary name="Turn Metrics">
      <TurnMetricsTableInner sessionId={sessionId} />
    </SectionErrorBoundary>
  );
}
