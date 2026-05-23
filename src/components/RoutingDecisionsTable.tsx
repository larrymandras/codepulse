import { Fragment, useState } from "react";
import { useRoutingDecisionsPaginated } from "../hooks/useRoutingDecisions";
import { PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import LoadMoreButton from "./LoadMoreButton";
import InfoTooltip from "./InfoTooltip";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./ui/table";

export default function RoutingDecisionsTable() {
  const { decisions, status, loadMore } = useRoutingDecisionsPaginated(25);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fallbackFilter, setFallbackFilter] = useState<"all" | "fallback">("all");

  const filteredDecisions = fallbackFilter === "fallback"
    ? decisions.filter(d => d.fallbackUsed)
    : decisions;

  const heading = (
    <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
      Routing Decisions
      <InfoTooltip text="Shows why each provider was selected for a gateway task, with per-provider score breakdown" />
    </h2>
  );

  if (filteredDecisions.length === 0 && status !== "LoadingFirstPage") {
    return (
      <div>
        {heading}
        <div className="flex gap-2 mb-3">
          {(["all", "fallback"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFallbackFilter(f)}
              className={`text-xs px-2 py-1 font-mono transition-colors ${
                fallbackFilter === f
                  ? "bg-purple-400/20 text-purple-300 border border-purple-500/40"
                  : "bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-700/80"
              }`}
            >
              {f === "all" ? "All" : "Fallback only"}
            </button>
          ))}
        </div>
        {fallbackFilter === "fallback" ? (
          <p className="text-sm text-muted-foreground mt-2">No fallback routing decisions found.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No routing decisions recorded. Routing decisions are logged when gateway tasks are dispatched.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      {heading}
      <div className="flex gap-2 mb-3">
        {(["all", "fallback"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFallbackFilter(f)}
            className={`text-xs px-2 py-1 font-mono transition-colors ${
              fallbackFilter === f
                ? "bg-purple-400/20 text-purple-300 border border-purple-500/40"
                : "bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-700/80"
            }`}
          >
            {f === "all" ? "All" : "Fallback only"}
          </button>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task ID</TableHead>
            <TableHead>Requested Provider</TableHead>
            <TableHead>Selected Provider</TableHead>
            <TableHead>Fallback</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDecisions.map((d) => {
            const ago = Math.round((Date.now() / 1000 - d.timestamp) / 60);
            const timeStr =
              ago < 60
                ? `${ago}m ago`
                : ago < 1440
                  ? `${Math.round(ago / 60)}h ago`
                  : `${Math.round(ago / 1440)}d ago`;

            return (
              <Fragment key={d._id}>
                <TableRow
                  className={`cursor-pointer hover:bg-muted/50 ${d.fallbackUsed ? "border-l-2 border-yellow-500/70" : ""}`}
                  onClick={() =>
                    setExpanded(expanded === d._id ? null : d._id)
                  }
                >
                  <TableCell className="font-mono text-xs" title={d.taskId}>
                    {d.taskId.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    {PROVIDER_DISPLAY_NAMES[d.requestedProvider] ??
                      d.requestedProvider}
                  </TableCell>
                  <TableCell>
                    {PROVIDER_DISPLAY_NAMES[d.selectedProvider] ??
                      d.selectedProvider}
                  </TableCell>
                  <TableCell>
                    {d.fallbackUsed ? (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 font-mono uppercase">
                        FALLBACK
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-gray-400">
                    {d.finalScore?.toFixed(3) ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {timeStr}
                  </TableCell>
                </TableRow>
                {expanded === d._id && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="bg-gray-900/30 px-4 py-2"
                    >
                      <div className="grid grid-cols-4 gap-2 text-xs text-gray-400 font-mono tabular-nums">
                        <span>Quota: {d.quotaScore?.toFixed(3) ?? "—"}</span>
                        <span>
                          Latency: {d.latencyScore?.toFixed(3) ?? "—"}
                        </span>
                        <span>Cost: {d.costScore?.toFixed(3) ?? "—"}</span>
                        <span>Final: {d.finalScore?.toFixed(3) ?? "—"}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <LoadMoreButton status={status} loadMore={loadMore} pageSize={25} />
    </div>
  );
}
