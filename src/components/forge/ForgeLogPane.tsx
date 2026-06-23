/**
 * ForgeLogPane — tail-style live log pane for a Forge job (Phase 81, FI-10).
 *
 * Mirrors TranscriptPanel.tsx's auto-follow / pause-on-scroll-up /
 * jump-to-latest machinery verbatim (D-02), adapted for terminal-style
 * monospace log lines instead of transcript bubbles.
 *
 * Auto-follow starts active (isAutoScrollingRef = true) — log streams
 * are always live; there is no replay mode.
 *
 * Convex reactivity IS the live stream — no polling, no websockets, no
 * EventSource. useForgeJobLogs returns a memoized, reactive array that
 * updates as chunks land. Gaps are normal (Forge delivery is lossy by
 * design); never render an error on a seq gap.
 *
 * Security (T-81-11): lines rendered as JSX text children only — no
 * dangerouslySetInnerHTML, no HTML interpolation. React escapes by default.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useForgeJobLogs } from "@/hooks/useForge";
import { JumpToLatestPill } from "@/components/JumpToLatestPill";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ForgeLogPaneProps {
  hostId: string;
  forgeJobId: string;
}

// ---------------------------------------------------------------------------
// ForgeLogPane
// ---------------------------------------------------------------------------

export function ForgeLogPane({ hostId, forgeJobId }: ForgeLogPaneProps) {
  const chunks = useForgeJobLogs(hostId, forgeJobId);

  const [showPill, setShowPill] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Logs always start live — auto-follow is on from the first render.
  const isAutoScrollingRef = useRef(true);
  const prevChunkCountRef = useRef(chunks.length);

  // Auto-scroll to bottom when new chunks arrive (keyed on chunk count).
  useEffect(() => {
    if (isAutoScrollingRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
    prevChunkCountRef.current = chunks.length;
  }, [chunks.length]);

  // Pause auto-follow when user scrolls up past 100px threshold;
  // resume when near-bottom. Mirror TranscriptPanel.tsx lines 51-64.
  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    if (el.scrollTop + el.clientHeight < el.scrollHeight - 100) {
      // Scrolled up — pause auto-follow
      isAutoScrollingRef.current = false;
      setShowPill(true);
    } else {
      // Near bottom — resume auto-follow
      isAutoScrollingRef.current = true;
      setShowPill(false);
    }
  }, []);

  // Jump to bottom and re-enable auto-follow.
  const jumpToLatest = useCallback(() => {
    isAutoScrollingRef.current = true;
    setShowPill(false);
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Scroll viewport — owned directly (not via ScrollArea wrapper) so
          onScroll fires on the element we hold a ref to. Mirror TranscriptPanel
          pattern: plain div with ref + onScroll, not the ScrollArea internal div. */}
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        data-testid="forge-log-viewport"
        className="flex-1 overflow-y-auto p-3 bg-background"
      >
        {chunks.length === 0 ? (
          <p className="text-base text-muted-foreground text-center py-8">
            Waiting for logs&hellip;
          </p>
        ) : (
          chunks.map((chunk) =>
            chunk.lines.map((line, lineIdx) => (
              <div
                key={`${chunk.id}-${lineIdx}`}
                className="font-mono text-sm whitespace-pre text-foreground leading-5"
              >
                {line}
              </div>
            ))
          )
        )}
      </div>

      {/* Jump-to-latest pill — floats over the viewport, visible when
          auto-follow is paused (user scrolled up). */}
      <JumpToLatestPill visible={showPill} onClick={jumpToLatest} />
    </div>
  );
}
