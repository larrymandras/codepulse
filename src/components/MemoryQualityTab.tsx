import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ChevronDown, AlertTriangle, Clock, Copy } from "lucide-react";

function AccordionSection({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        className="flex items-center justify-between w-full py-3 border-b border-border"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-xs bg-gray-700/60 text-gray-400 px-2 py-0.5 rounded-full">
            {count}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && <div className="py-2">{children}</div>}
    </div>
  );
}

export default function MemoryQualityTab() {
  const data = useQuery(api.memoryQuality.getLatestQuality);

  // Loading state
  if (data === undefined) {
    return (
      <div className="text-xs text-muted-foreground py-4 text-center">
        Loading quality data...
      </div>
    );
  }

  // No quality data yet
  if (data === null) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm font-medium text-foreground mb-1">
          No quality issues detected
        </p>
        <p className="text-sm text-muted-foreground">
          Run memory quality evaluation to check for duplicates, stale entries,
          and contradictions.
        </p>
      </div>
    );
  }

  const staleIds: string[] = data.staleMemoryIds ?? [];
  const contradictions: Array<{
    memoryA: string;
    memoryB: string;
    reason?: string;
  }> = (data.contradictionPairs as any) ?? [];

  const nowEpoch = Date.now() / 1000;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Dedup Rate
          </p>
          <p className="text-2xl font-semibold tabular-nums text-gray-100">
            {(data.deduplicationRate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Stale Memories
          </p>
          <p className="text-2xl font-semibold tabular-nums text-gray-100">
            {data.staleCount}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Contradictions
          </p>
          <p className="text-2xl font-semibold tabular-nums text-gray-100">
            {data.contradictionCount}
          </p>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-1">
        {/* Duplicate Flags */}
        <AccordionSection
          icon={<Copy className="w-4 h-4 text-muted-foreground" />}
          title="Duplicate Flags"
          count={Math.round(data.deduplicationRate * 100)}
        >
          <p className="text-xs text-muted-foreground py-4">
            {data.deduplicationRate > 0
              ? `${(data.deduplicationRate * 100).toFixed(1)}% of stored memories were identified as duplicates and pruned.`
              : "No issues detected"}
          </p>
        </AccordionSection>

        {/* Stale Memories */}
        <AccordionSection
          icon={<Clock className="w-4 h-4 text-muted-foreground" />}
          title="Stale Memories"
          count={staleIds.length}
        >
          {staleIds.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              No issues detected
            </p>
          ) : (
            <div className="space-y-2 py-2">
              {staleIds.map((id) => (
                <div key={id} className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-gray-300 truncate flex-1">
                    {id}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Stale
                  </span>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>

        {/* Contradictions */}
        <AccordionSection
          icon={<AlertTriangle className="w-4 h-4 text-muted-foreground" />}
          title="Contradictions"
          count={contradictions.length}
        >
          {contradictions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              No issues detected
            </p>
          ) : (
            <div className="space-y-3 py-2">
              {contradictions.map((pair, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 font-mono truncate">
                      {pair.memoryA} vs {pair.memoryB}
                    </p>
                    {pair.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pair.reason}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AccordionSection>
      </div>
    </div>
  );
}
