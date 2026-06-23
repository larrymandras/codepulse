import { useState } from "react";
import { AlertTriangle, ChevronRight, ChevronDown } from "lucide-react";

interface FailoverBlockProps {
  block: {
    type: string;
    failedProvider?: string;
    newProvider?: string;
    errorMessage?: string;
  };
}

export function FailoverBlock({ block }: FailoverBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-yellow-500/5 border border-(--border) border-l-4 border-l-(--status-warn) rounded cursor-pointer select-none"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-(--status-warn)" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-(--status-warn)" />
        )}
        <AlertTriangle className="h-4 w-4 shrink-0 text-(--status-warn)" />
        <span className="text-sm text-(--foreground)">
          <span className="font-mono font-semibold">{block.failedProvider ?? "unknown"}</span>
          {" failed → "}
          <span className="font-mono font-semibold">{block.newProvider ?? "unknown"}</span>
        </span>
      </div>
      {expanded && block.errorMessage && (
        <div className="px-3 pb-3 pt-0">
          <pre className="font-mono text-sm whitespace-pre-wrap text-(--muted-foreground) bg-(--card) rounded p-2">
            {block.errorMessage}
          </pre>
        </div>
      )}
    </div>
  );
}
