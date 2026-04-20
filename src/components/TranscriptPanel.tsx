/**
 * TranscriptPanel — scrollable transcript bubble list with auto-scroll
 * for War Room (live) and Meeting Bot (replay) views.
 *
 * In live mode, auto-scrolls to bottom on new chunks. If user scrolls up,
 * auto-scroll pauses and a "Jump to latest" pill appears.
 *
 * Phase 72, Plan 02: D-05/D-06
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TranscriptBubble } from "./TranscriptBubble";
import { JumpToLatestPill } from "./JumpToLatestPill";
import { useLiveFlash } from "@/hooks/useLiveFlash";

export interface TranscriptChunk {
  id: string;
  speaker: string;
  speakerId?: string;
  text: string;
  timestamp: number;
  isUser: boolean;
  agentColor?: string;
}

export interface TranscriptPanelProps {
  chunks: TranscriptChunk[];
  live: boolean; // true = War Room (auto-scroll on), false = Meeting Bot replay
}

export function TranscriptPanel({ chunks, live }: TranscriptPanelProps) {
  const [showPill, setShowPill] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(live);
  const { flashRef, triggerFlash } = useLiveFlash<HTMLDivElement>();
  const prevChunkCountRef = useRef(chunks.length);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (isAutoScrollingRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
    // Flash on new chunk in live mode
    if (live && chunks.length > prevChunkCountRef.current) {
      triggerFlash();
    }
    prevChunkCountRef.current = chunks.length;
  }, [chunks.length, live, triggerFlash]);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    if (el.scrollTop + el.clientHeight < el.scrollHeight - 100) {
      // User scrolled up — pause auto-scroll
      isAutoScrollingRef.current = false;
      setShowPill(true);
    } else {
      // Near bottom — resume auto-scroll
      isAutoScrollingRef.current = true;
      setShowPill(false);
    }
  }, []);

  const jumpToLatest = useCallback(() => {
    isAutoScrollingRef.current = true;
    setShowPill(false);
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  return (
    <div className="relative flex-1" ref={flashRef}>
      <ScrollArea className="h-full">
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="space-y-3 p-4"
        >
          {chunks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Waiting for conversation to begin.
            </p>
          ) : (
            chunks.map((chunk) => (
              <TranscriptBubble
                key={chunk.id}
                speaker={chunk.speaker}
                text={chunk.text}
                timestamp={chunk.timestamp}
                isUser={chunk.isUser}
                agentColor={chunk.agentColor}
              />
            ))
          )}
        </div>
      </ScrollArea>
      <JumpToLatestPill visible={showPill} onClick={jumpToLatest} />
    </div>
  );
}
