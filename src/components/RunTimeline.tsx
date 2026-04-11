/**
 * RunTimeline — scrollable vertical stack of RunBlocks with a left gutter line.
 *
 * Props:
 *   blocks    — ordered array of typed response blocks
 *   streaming — when true and no blocks yet, shows pulsing thinking indicator
 *
 * Phase 56, Plan 03: CPCC-03 Live Run panel.
 */

import { RunBlock } from "./RunBlock";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunTimelineProps {
  blocks: Array<{ type: string; [key: string]: unknown }>;
  streaming?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RunTimeline({ blocks, streaming = false }: RunTimelineProps) {
  const showThinking = streaming && blocks.length === 0;

  return (
    <div className="relative pl-8">
      {/* Vertical connector line in gutter */}
      <div className="absolute left-3 top-0 bottom-0 w-px bg-(--border)" />

      <div className="space-y-2 py-2">
        {blocks.map((block, i) => (
          <div key={i} className="relative">
            {/* Gutter dot */}
            <div className="absolute -left-5 top-3 w-2 h-2 rounded-full bg-(--border)" />
            <RunBlock block={block} />
          </div>
        ))}

        {/* Thinking indicator — shown while streaming and no blocks yet */}
        {showThinking && (
          <div className="relative flex items-center gap-2 py-1">
            <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-(--primary) animate-pulse" />
            <span className="text-xs text-(--muted-foreground) animate-pulse">
              Thinking…
            </span>
          </div>
        )}

        {/* Streaming pulse dot — shown when streaming but blocks are arriving */}
        {streaming && blocks.length > 0 && (
          <div className="relative flex items-center gap-2 py-1">
            <div className="absolute -left-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-(--primary) animate-pulse" />
            <span className="text-xs text-(--muted-foreground)">…</span>
          </div>
        )}
      </div>
    </div>
  );
}
