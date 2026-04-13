/**
 * LiveRun — real-time agent run visualizer with typed block streaming
 * and history replay from Convex run_blocks table.
 *
 * Live mode: subscribes to run.* WebSocket events and accumulates blocks.
 * History mode: replays blocks from Convex for a selected past session.
 *
 * Tabs:
 *   Timeline — nested accordion RunTimeline (rounds > tool calls)
 *   Flow     — React Flow DAG of tool calls via dagre layout
 *
 * Phase 03, Plan 05: D-07 (accordion), D-08 (Flow tab), D-09 (stop button).
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type UIEvent,
} from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { RunTimeline } from "../components/RunTimeline";
import { RunHistorySelector } from "../components/RunHistorySelector";
import { ReactFlow, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Square } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Block = { type: string; [key: string]: unknown };
type ActiveTab = "timeline" | "flow";

// ─── Cap blocks to 500 entries (T-56-10 DoS mitigation) ───────────────────────
const BLOCK_CAP = 500;

// ─── Cap Flow tab blocks (T-03-09 dagre DoS mitigation) ───────────────────────
const FLOW_BLOCK_CAP = 200;

function appendBlocks(prev: Block[], incoming: Block[]): Block[] {
  const combined = [...prev, ...incoming];
  if (combined.length > BLOCK_CAP) {
    return combined.slice(combined.length - BLOCK_CAP);
  }
  return combined;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveRun() {
  const { status, subscribeEvent, sendCommand } = useAstridrWS();

  // Live streaming state
  const [liveBlocks, setLiveBlocks] = useState<Block[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [runDone, setRunDone] = useState(false);

  // History / selector state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline");

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

  // ─── Stop button ───────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    void sendCommand({ type: "run.stop" });
  }, [sendCommand]);

  // ─── Determine displayed blocks ───────────────────────────────────────────
  const displayBlocks = isLive ? liveBlocks : historicalBlocks;
  const displayStreaming = isLive && !runDone;
  const hasActiveRun = isLive && !runDone && liveBlocks.length > 0;

  // ─── Flow graph (memoized, T-03-09: cap at FLOW_BLOCK_CAP blocks) ─────────
  const flowGraph = useMemo(() => {
    if (activeTab !== "flow") return { nodes: [], edges: [] };

    // Limit blocks fed to dagre to prevent UI freeze on large runs
    const cappedBlocks = displayBlocks.slice(-FLOW_BLOCK_CAP);

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60 });

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const toolCallIds = new Map<string, string>();

    cappedBlocks.forEach((block: Block, i: number) => {
      if (block.type === "tool_use") {
        const id = `tool_use_${i}`;
        const callId = (block.tool_call_id as string | undefined) ?? `tc_${i}`;
        toolCallIds.set(callId, id);
        g.setNode(id, { width: 160, height: 40 });
        nodes.push({
          id,
          type: "default",
          data: {
            label: (block.name as string | undefined) ??
              (block.tool_name as string | undefined) ??
              "Tool",
          },
          position: { x: 0, y: 0 },
          style: {
            background: "var(--secondary)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            fontSize: "12px",
            borderRadius: "0px",
          },
        });
      }
      if (block.type === "tool_result") {
        const callId = (block.tool_call_id as string | undefined) ?? `tc_${i}`;
        const sourceId = toolCallIds.get(callId);
        const id = `tool_result_${i}`;
        g.setNode(id, { width: 160, height: 40 });
        if (sourceId) {
          g.setEdge(sourceId, id);
          edges.push({
            id: `e_${sourceId}_${id}`,
            source: sourceId,
            target: id,
            style: { stroke: "var(--muted-foreground)" },
          });
        }
        nodes.push({
          id,
          type: "default",
          data: { label: "Result" },
          position: { x: 0, y: 0 },
          style: {
            background: "var(--secondary)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
            fontSize: "12px",
            borderRadius: "0px",
          },
        });
      }
    });

    if (nodes.length > 0) {
      dagre.layout(g);
      nodes.forEach((n) => {
        const nodeWithPos = g.node(n.id);
        if (nodeWithPos) {
          n.position = { x: nodeWithPos.x - 80, y: nodeWithPos.y - 20 };
        }
      });
    }

    return { nodes, edges };
  }, [displayBlocks, activeTab]);

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

      {/* Tab bar + stop button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-(--border) shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-3 py-1 text-sm ${
              activeTab === "timeline"
                ? "bg-(--primary) text-(--primary-foreground)"
                : "bg-(--secondary) text-(--foreground)"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setActiveTab("flow")}
            className={`px-3 py-1 text-sm ${
              activeTab === "flow"
                ? "bg-(--primary) text-(--primary-foreground)"
                : "bg-(--secondary) text-(--foreground)"
            }`}
          >
            Flow
          </button>
        </div>
        <button
          onClick={handleStop}
          disabled={!hasActiveRun}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-(--destructive) text-white disabled:opacity-50"
          title="Stop Run"
        >
          <Square className="h-4 w-4" />
          Stop
        </button>
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

      {/* Content area */}
      {activeTab === "timeline" ? (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4"
          onScroll={handleScroll}
        >
          {displayBlocks.length === 0 && !displayStreaming ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-(--muted-foreground) text-center">
                {isLive
                  ? "No active run. Start a task from Agent Chat."
                  : "No blocks found for this session."}
              </p>
            </div>
          ) : (
            <RunTimeline blocks={displayBlocks} streaming={displayStreaming} />
          )}
        </div>
      ) : (
        <div className="flex-1 p-4">
          <div style={{ height: "400px", width: "100%" }}>
            {flowGraph.nodes.length > 0 ? (
              <ReactFlow
                nodes={flowGraph.nodes}
                edges={flowGraph.edges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                panOnDrag
                zoomOnScroll
              />
            ) : (
              <div className="flex items-center justify-center h-full text-(--muted-foreground) text-sm">
                No tool calls to visualize yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scroll-to-bottom button when auto-scroll suppressed (Timeline only) */}
      {activeTab === "timeline" && !autoScroll && (
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
