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
import { RunSummary } from "../components/RunSummary";
import JobsPanel from "../components/JobsPanel";
import { Square } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type Block = { type: string; [key: string]: unknown };
type ActiveTab = "timeline" | "summary";
type RunStatus = "idle" | "running" | "completed" | "error";

const BLOCK_CAP = 500;

export function appendBlocksWithDedup(prev: Block[], incoming: Block[]): Block[] {
  const filtered = incoming.filter(
    (b) => b.type !== "tool_use" && b.type !== "tool_result"
  );
  const combined = [...prev, ...filtered];
  if (combined.length > BLOCK_CAP) {
    return combined.slice(combined.length - BLOCK_CAP);
  }
  return combined;
}

interface RunMeta {
  status: RunStatus;
  rounds: number;
  startedAt: number | undefined;
  completedAt: number | undefined;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  cost: number | undefined;
}

const INITIAL_META: RunMeta = {
  status: "idle",
  rounds: 0,
  startedAt: undefined,
  completedAt: undefined,
  inputTokens: undefined,
  outputTokens: undefined,
  cost: undefined,
};

export default function LiveRun() {
  const { status, subscribeEvent, sendCommand } = useAstridrWS();

  const [liveBlocks, setLiveBlocks] = useState<Block[]>([]);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  const [runDone, setRunDone] = useState(false);
  const [runMeta, setRunMeta] = useState<RunMeta>(INITIAL_META);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessions = useQuery(api.runBlocks.listSessions) ?? [];
  const historyRecords = useQuery(
    api.runBlocks.getBySession,
    !isLive && selectedSessionId ? { sessionId: selectedSessionId } : "skip"
  );
  const historicalBlocks: Block[] = historyRecords
    ? historyRecords.flatMap((r) => (r.blocks as Block[]) ?? [])
    : [];

  useEffect(() => {
    const unsubStarted = subscribeEvent("run.started", (event) => {
      const data = event.data as { session_id?: string } | undefined;
      setLiveSessionId(data?.session_id ?? null);
      setLiveBlocks([]);
      setRunDone(false);
      setIsLive(true);
      setAutoScroll(true);
      setRunMeta({ ...INITIAL_META, status: "running", startedAt: Date.now() });
    });

    const unsubBlocks = subscribeEvent("run.blocks", (event) => {
      const data = event.data as { blocks?: Block[] } | undefined;
      if (!data?.blocks) return;
      setLiveBlocks((prev) => appendBlocksWithDedup(prev, data.blocks!));
    });

    const unsubThinking = subscribeEvent("run.thinking", (event) => {
      const data = event.data as { round_num?: number; thinking_text?: string } | undefined;
      if (!data) return;
      setLiveBlocks((prev) =>
        appendBlocksWithDedup(prev, [
          { type: "thinking", round_num: data.round_num, thinking_text: data.thinking_text },
        ])
      );
      setRunMeta((prev) => ({ ...prev, rounds: data.round_num ?? prev.rounds + 1 }));
    });

    const unsubToolCall = subscribeEvent("run.tool_call", (event) => {
      const data = event.data as {
        tool_name?: string; arguments?: unknown; status?: string; result?: string;
      } | undefined;
      if (!data) return;
      setLiveBlocks((prev) =>
        appendBlocksWithDedup(prev, [
          { type: "tool_call", tool_name: data.tool_name, arguments: data.arguments, status: data.status, result: data.result },
        ])
      );
    });

    const unsubCompleted = subscribeEvent("run.completed", (event) => {
      const data = event.data as {
        rounds?: number; tokens?: { input?: number; output?: number }; cost?: number;
      } | undefined;
      setRunDone(true);
      setRunMeta((prev) => ({
        ...prev,
        status: "completed",
        completedAt: Date.now(),
        rounds: data?.rounds ?? prev.rounds,
        inputTokens: data?.tokens?.input,
        outputTokens: data?.tokens?.output,
        cost: data?.cost,
      }));
    });

    const unsubError = subscribeEvent("run.error", (event) => {
      const data = event.data as { error_type?: string; message?: string } | undefined;
      setRunDone(true);
      setRunMeta((prev) => ({ ...prev, status: "error", completedAt: Date.now() }));
      if (data) {
        setLiveBlocks((prev) =>
          appendBlocksWithDedup(prev, [
            { type: "error", error_type: data.error_type ?? "Error", message: data.message ?? "" },
          ])
        );
      }
    });

    const unsubFailover = subscribeEvent("self_healing", (event) => {
      const data = event.data as {
        failedProvider?: string; errorMessage?: string; remainingProviders?: number; healEventType?: string;
      } | undefined;
      if (!data || data.healEventType !== "failover_activated") return;
      setLiveBlocks((prev) =>
        appendBlocksWithDedup(prev, [
          { type: "failover", failedProvider: data.failedProvider, newProvider: "next provider", errorMessage: data.errorMessage },
        ])
      );
    });

    return () => {
      unsubStarted(); unsubBlocks(); unsubThinking(); unsubToolCall();
      unsubCompleted(); unsubError(); unsubFailover();
    };
  }, [subscribeEvent]);

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

  const handleSelectSession = useCallback((sid: string | null) => {
    if (sid === null) { setIsLive(true); setSelectedSessionId(null); }
    else { setIsLive(false); setSelectedSessionId(sid); }
  }, []);

  const handleStop = useCallback(() => {
    void sendCommand({ type: "run.stop" });
  }, [sendCommand]);

  const displayBlocks = isLive ? liveBlocks : historicalBlocks;
  const displayStreaming = isLive && !runDone;
  const hasActiveRun = isLive && !runDone && liveBlocks.length > 0;

  const summaryStatus: RunStatus = isLive ? runMeta.status : "completed";
  const summaryRounds = isLive
    ? runMeta.rounds
    : displayBlocks.filter((b) => b.type === "thinking" || b.type === "reasoning").length || undefined;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-(--border) shrink-0">
        <PageHeader
          title="Live Run"
          className="mb-0"
          actions={
            <div className="flex items-center gap-3">
              <RunHistorySelector
                sessions={sessions}
                selectedSessionId={isLive ? null : selectedSessionId}
                onSelect={handleSelectSession}
              />
              <WSStatusIndicator status={status} />
            </div>
          }
        />
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-(--border) shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-3 py-1 text-base ${activeTab === "timeline" ? "bg-(--primary) text-(--primary-foreground)" : "bg-(--secondary) text-(--foreground)"}`}
          >Timeline</button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1 text-base ${activeTab === "summary" ? "bg-(--primary) text-(--primary-foreground)" : "bg-(--secondary) text-(--foreground)"}`}
          >Summary</button>
        </div>
        <button
          onClick={handleStop}
          disabled={!hasActiveRun}
          className="flex items-center gap-1 px-3 py-1 text-base bg-(--destructive) text-white disabled:opacity-50"
          title="Stop Run"
        ><Square className="h-4 w-4" />Stop</button>
      </div>
      {isLive && liveSessionId && (
        <div className="px-4 py-1.5 border-b border-(--border) shrink-0">
          <span className="text-sm text-(--muted-foreground) font-mono">
            Session: {liveSessionId.slice(0, 16)}…{runDone ? " — completed" : " — live"}
          </span>
        </div>
      )}
      {/* Background subagent jobs (Phase 168 SC-2/SC-3): live-query-driven,
          surfaces job completion without manual polling regardless of
          which tab or WS run is active. */}
      <div className="px-4 py-3 border-b border-(--border) shrink-0">
        <JobsPanel />
      </div>
      {activeTab === "timeline" ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" onScroll={handleScroll}>
          {displayBlocks.length === 0 && !displayStreaming ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-base text-(--muted-foreground) text-center">
                {isLive ? "No active run. Start a task from Agent Chat." : "No blocks found for this session."}
              </p>
            </div>
          ) : (
            <RunTimeline blocks={displayBlocks} streaming={displayStreaming} />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <RunSummary
            status={summaryStatus}
            rounds={summaryRounds}
            inputTokens={isLive ? runMeta.inputTokens : undefined}
            outputTokens={isLive ? runMeta.outputTokens : undefined}
            cost={isLive ? runMeta.cost : undefined}
            startedAt={isLive ? runMeta.startedAt : undefined}
            completedAt={isLive ? runMeta.completedAt : undefined}
            blocks={displayBlocks}
          />
        </div>
      )}
      {activeTab === "timeline" && !autoScroll && (
        <div className="flex justify-center py-2 shrink-0">
          <button
            className="text-sm px-3 py-1 bg-(--primary) text-(--primary-foreground) rounded-full"
            onClick={() => { setAutoScroll(true); scrollToBottom(); }}
          >↓ Latest</button>
        </div>
      )}
    </div>
  );
}
