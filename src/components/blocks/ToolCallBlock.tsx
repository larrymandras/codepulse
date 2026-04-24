import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface ToolCallBlockProps {
  block: {
    type: string;
    tool_name?: string;
    arguments?: unknown;
    result?: string;
    status?: string;
  };
}

function truncateArgs(args: unknown, maxLen = 80): string {
  try {
    const s = JSON.stringify(args);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "…";
  } catch {
    return String(args);
  }
}

export function ToolCallBlock({ block }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const isError = block.status === "error";

  return (
    <div
      className="bg-(--muted) border border-(--border) border-l-4 border-l-(--primary) rounded cursor-pointer select-none"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      aria-expanded={expanded}
    >
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
          )}
          <span className="text-xs font-mono font-semibold text-(--foreground) shrink-0">
            {block.tool_name ?? "tool"}
          </span>
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              isError ? "bg-red-500" : "bg-green-500"
            }`}
            title={block.status ?? "unknown"}
          />
        </div>
        {!expanded && (
          <span className="text-xs text-(--muted-foreground) font-mono truncate">
            {truncateArgs(block.arguments)}
          </span>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0 flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          {block.arguments != null && (
            <div>
              <p className="text-xs font-semibold text-(--muted-foreground) mb-1">Arguments</p>
              <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2 overflow-x-auto">
                {JSON.stringify(block.arguments, null, 2)}
              </pre>
            </div>
          )}
          {block.result != null && (
            <div>
              <p className="text-xs font-semibold text-(--muted-foreground) mb-1">Result</p>
              <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2 overflow-x-auto max-h-48">
                {block.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
