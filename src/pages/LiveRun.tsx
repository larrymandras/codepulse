/**
 * LiveRun — real-time agent run visualizer with typed block streaming
 * and history replay from Convex run_blocks table.
 *
 * Live mode: subscribes to run.* WebSocket events and accumulates blocks.
 * History mode: replays blocks from Convex for a selected past session.
 *
 * Phase 56, Plan 03: CPCC-03.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type UIEvent,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { RunTimeline } from "../components/RunTimeline";
import { RunHistorySelector } from "../components/RunHistorySelector";

// ─── Types ────────────────────────────────────────────────────────────────────

type Block = { type: string; [key: string]: unknown };

// ─── Cap blocks to 500 entries (T-56-10 DoS mitigation) ───────────────────────
const BLOCK_CAP = 500;

function appendBlocks(prev: Block[], incoming: Block[]): Block[] {
  const combined = [...prev, ...incoming];
  if (combined.length > BLOCK_CAP) {
    return combined.slice(combined.length - BLOCK_CAP);
  }
  return combined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveRun() {
  const { status, subscribeEvent } = useAstridrWS();

  // Live streaming state
  const [liveBlocks, setLiveBlocks] = useState<Block[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [runDone, setRunDone] = useState(false);

  // History / selector state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Convex queries ────────────────────────────────────────────────────────
  const sessions = useQuery(api.runBlocks.listSessions) ?? [];

  // History replay — only active when a specific session is selected
  const historyRecords = useQuery(
    api.runBlocks.getBySession,
    !isLive && selectedSessionId ? { sessionId: selectedSessionId } : "skip"
  );

  // Flatten historical records into block array
  const historicalBlocks: Block[] = historyRecords
    ? historyRecords.flatMap((r) => (r.blocks as Block[]) ?? [])
    : [];

  // ─── WS subscriptions ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsubStarted = subscribeEvent("run.started", (event) => {
      const data = event.data as { session_id?: string } | undefined;
      const sid = data?.session_id ?? null;
      setLiveSessionId(sid);
      setLiveBlocks([]);
      setRunDone(false);
      setIsLive(true);
      setAutoScroll(true);
    });

    const unsubBlocks = subscribeEvent("run.blocks", (event) => {
      const data = event.data as
        | { session_id?: string; blocks?: Block[] }
        | undefined;
      if (!data?.blocks) return;
      setLiveBlocks((prev) => appendBlocks(prev, data.blocks!));
    });

    const unsubCompleted = subscribeEvent("run.completed", () => {
      setRunDone(true);
    });

    const unsubError = subscribeEvent("run.error", (event) => {
      const data = event.data as
        | { error_type?: string; message?: string }
        | undefined;
      setRunDone(true);
      if (data) {
        setLiveBlocks((prev) =>
          appendBlocks(prev, [
            { type: "error", error_type: data.error_type ?? "Error", message: data.message ?? "" },
          ])
        );
      }
    });

    return () => {
      unsubStarted();
      unsubBlocks();
      unsubCompleted();
      unsubError();
    };
  }, [subscribeEvent]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
  }, [liveBlocks, historicalBlocks, autoScroll, scrollToBottom]);

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
      if (!atBottom && autoScroll) setAutoScroll(false);
      if (atBottom && !autoScroll) setAutoScroll(true);
    },
    [autoScroll]
  );

  // ─── History selection ─────────────────────────────────────────────────────
  const handleSelectSession = useCallback((sid: string | null) => {
    if (sid === null) {
      setIsLive(true);
      setSelectedSessionId(null);
    } else {
      setIsLive(false);
      setSelectedSessionId(sid);
    }
  }, []);

  // ─── Determine displayed blocks ───────────────────────────────────────────
  const displayBlocks = isLive ? liveBlocks : historicalBlocks;
  const displayStreaming = isLive && !runDone;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-(--border) shrink-0">
        <h1 className="text-xl font-semibold text-(--foreground)">Live Run</h1>
        <div className="flex items-center gap-3">
          <RunHistorySelector
            sessions={sessions}
            selectedSessionId={isLive ? null : selectedSessionId}
            onSelect={handleSelectSession}
          />
          <WSStatusIndicator status={status} />
        </div>
      </div>

      {/* Session label */}
      {isLive && liveSessionId && (
        <div className="px-4 py-1.5 border-b border-(--border) shrink-0">
          <span className="text-xs text-(--muted-foreground) font-mono">
            Session: {liveSessionId.slice(0, 16)}…
            {runDone ? " — completed" : " — live"}
          </span>
        </div>
      )}

      {/* Timeline scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {displayBlocks.length === 0 && !displayStreaming ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-(--muted-foreground) text-center">
              {isLive
                ? "No runs recorded. Start a session with Ástríðr to see live blocks here."
                : "No blocks found for this session."}
            </p>
          </div>
        ) : (
          <RunTimeline blocks={displayBlocks} streaming={displayStreaming} />
        )}
      </div>

      {/* Scroll-to-bottom button when auto-scroll suppressed */}
      {!autoScroll && (
        <div className="flex justify-center py-2 shrink-0">
          <button
            className="text-xs px-3 py-1 bg-(--primary) text-(--primary-foreground) rounded-full"
            onClick={() => {
              setAutoScroll(true);
              scrollToBottom();
            }}
          >
            ↓ Latest
          </button>
        </div>
      )}
    </div>
  );
}
