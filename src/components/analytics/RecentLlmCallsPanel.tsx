import { Link } from "react-router";
import { useLlmMetrics } from "../../hooks/useLlmMetrics";
import { formatCost, formatDurationMs, formatTimestamp } from "../../lib/formatters";
import { SectionHeader } from "../SectionHeader";
import { Badge } from "../ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";

/**
 * Deep-link into the session's Trace tab (TRACE-02, D-08). Null-guarded and
 * encoded, mirrors KGDetailsPanel's provenanceHref. Moved here from
 * Analytics.tsx — it is used only by this table.
 */
function traceHref(sessionId?: string | null): string | null {
  return sessionId ? `/sessions/${encodeURIComponent(sessionId)}?tab=trace` : null;
}

/**
 * GlassPanel ownership: the PAGE owns the outer GlassPanel (pure layout),
 * matching the pre-move nesting (`<GlassPanel><SectionHeader/>{table}</GlassPanel>`).
 * This component renders the SectionHeader, the empty state, the table, and
 * the Load more affordance.
 *
 * Self-fetching: owns useLlmMetrics (a usePaginatedQuery). No error handling
 * here (D-02) — relies entirely on the error-boundary wrapper its parent
 * supplies.
 */
export default function RecentLlmCallsPanel() {
  const { calls: llmCalls, status: llmStatus, loadMore: loadMoreLlm } = useLlmMetrics();

  return (
    <>
      <SectionHeader title="Recent LLM Calls" />
      {llmCalls.length === 0 ? (
        <p className="text-sm text-muted-foreground">No LLM calls recorded yet.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Cache</TableHead>
                <TableHead>Trace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {llmCalls.map((call, i) => {
                const href = traceHref(call.sessionId);
                return (
                  <TableRow key={call._id ?? i}>
                    <TableCell className="font-mono text-sm tabular-nums">
                      {formatTimestamp(call.timestamp)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{call.model}</TableCell>
                    <TableCell className="tabular-nums">
                      {call.cost != null ? formatCost(call.cost) : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDurationMs(call.latencyMs)}
                    </TableCell>
                    <TableCell>
                      {call.cacheReadInputTokens === undefined ? (
                        "—"
                      ) : call.cacheReadInputTokens > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: "var(--status-ok)", color: "var(--status-ok)" }}
                        >
                          cached
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ borderColor: "var(--status-warn)", color: "var(--status-warn)" }}
                        >
                          miss
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {href ? (
                        <Link
                          to={href}
                          style={{ color: "var(--primary)" }}
                          className="hover:underline text-sm font-medium"
                        >
                          View Trace
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {llmStatus === "CanLoadMore" && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => loadMoreLlm(25)}
                className="px-3 py-1.5 text-sm font-mono text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
