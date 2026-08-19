import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import InfoTooltip from "./InfoTooltip";
import { ScrollArea } from "./ui/scroll-area";

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ApiErrorPanel() {
  const errors = useQuery(api.apiErrors.recent) ?? [];
  const byStatusCode = useQuery(api.apiErrors.byStatusCode) ?? [];

  const now = Date.now() / 1000;
  const errorsLast24h = errors.filter((e: any) => e.timestamp >= now - 86400);
  const mostCommon = byStatusCode.length > 0 ? byStatusCode[0] : null;

  if (errors.length === 0) {
    return (
      <div className="bg-card/50 border border-border/50 rounded-xl p-5">
        <h2 className="text-base font-semibold text-foreground uppercase tracking-wide mb-4">
          API Errors<InfoTooltip text="API errors in the last 24 hours: status codes, error messages, and frequency" />
        </h2>
        <p className="text-base text-muted-foreground py-4 text-center">
          No API errors recorded
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-5">
      <h2 className="text-base font-semibold text-foreground uppercase tracking-wide mb-4">
        API Errors
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
          <p className="text-sm text-muted-foreground">Last 24h</p>
          <p className="text-lg font-bold text-red-400">
            {errorsLast24h.length}
          </p>
        </div>
        <div className="bg-muted/50 rounded-lg px-3 py-2 text-center">
          <p className="text-sm text-muted-foreground">Most Common</p>
          <p className="text-lg font-bold text-amber-400">
            {mostCommon ? `${mostCommon.statusCode} (${mostCommon.count})` : "--"}
          </p>
        </div>
      </div>

      {/* Status code breakdown */}
      {byStatusCode.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {byStatusCode.slice(0, 6).map((sc: any) => (
            <span
              key={sc.statusCode}
              className="text-xs font-mono bg-muted/60 text-foreground px-2 py-1 rounded"
            >
              {sc.statusCode}:{" "}
              <span className="text-red-400 font-semibold">{sc.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Error list */}
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-1.5">
          {errors.slice(0, 20).map((err: any) => (
            <div
              key={err._id}
              className="bg-muted/30 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2 mb-1">
                {err.statusCode && (
                  <span className="text-xs font-mono font-semibold text-red-400 bg-red-600/10 rounded px-1.5 py-0.5">
                    {err.statusCode}
                  </span>
                )}
                {err.model && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {err.model}
                  </span>
                )}
                {err.attempt != null && (
                  <span className="text-xs text-muted-foreground">
                    attempt #{err.attempt}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  {relativeTime(err.timestamp)}
                </span>
              </div>
              <p className="text-sm text-foreground truncate">
                {err.errorMessage}
              </p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
