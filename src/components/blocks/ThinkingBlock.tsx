import { ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";

interface ThinkingBlockProps {
  block: { type: string; round_num?: number; thinking_text?: string };
  streaming?: boolean;
}

export function ThinkingBlock({ block, streaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const text = block.thinking_text ?? "";
  const preview = text.length > 120 ? text.slice(0, 120) + "…" : text;

  return (
    <div
      className="bg-(--muted) border border-(--border) border-l-4 border-l-(--status-warn) rounded"
      role="group"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-(--muted-foreground)" />
        )}
        <span className="text-xs font-semibold text-(--foreground) bg-(--secondary) px-2 py-0.5 rounded">
          Round {block.round_num ?? "?"}
        </span>
        {streaming && (
          <span className="h-2 w-2 rounded-full bg-(--status-warn) animate-pulse" />
        )}
        {!expanded && text && (
          <span className="text-xs text-(--muted-foreground) truncate">
            {preview}
          </span>
        )}
      </div>
      {expanded && text && (
        <div className="px-3 pb-3 pt-0">
          <pre className="font-mono text-xs whitespace-pre-wrap text-(--foreground) bg-(--card) rounded p-2">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}
