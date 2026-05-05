import { useMemo, useState, useEffect } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import PipelineStageNode, { type PipelineStageNodeData } from "./PipelineStageNode";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { usePipelineStepEvents, useRecentPipelineExecutionIds } from "../hooks/usePipelineStepEvents";
import InfoTooltip from "./InfoTooltip";
import { formatDurationMs } from "../lib/formatters";

// MUST be outside component to prevent re-registration
const nodeTypes = { pipelineStage: PipelineStageNode };

const STAGE_NAMES = ["receive", "route", "process", "respond", "tts_followup"] as const;
const NODE_W = 160;
const NODE_GAP = 40;

type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface StepEvent {
  stepName: string;
  status: string;
  durationMs?: number;
  inputSize?: number;
  outputSize?: number;
  error?: string;
  timestamp: number;
}

function deriveStepStatus(stepName: string, events: StepEvent[]): StepStatus {
  const stepEvents = events.filter(e => e.stepName === stepName);
  if (stepEvents.length === 0) return "pending";
  const latest = stepEvents[stepEvents.length - 1];
  if (latest.status === "step_completed") return "completed";
  if (latest.status === "step_failed" || latest.error) return "failed";
  if (latest.status === "step_started") return "running";
  return "pending";
}

function getStepDuration(stepName: string, events: StepEvent[]): number | undefined {
  const completed = events.find(e => e.stepName === stepName && e.status === "step_completed");
  return completed?.durationMs;
}

function getStepDetail(stepName: string, events: StepEvent[]): StepEvent | undefined {
  const stepEvts = events.filter(e => e.stepName === stepName);
  return stepEvts[stepEvts.length - 1];
}

export default function PipelineFlowDiagram() {
  const recentIds = useRecentPipelineExecutionIds(10);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | "live">("live");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [liveEvents, setLiveEvents] = useState<StepEvent[]>([]);

  const convexEvents = usePipelineStepEvents(
    selectedExecutionId === "live" ? undefined : selectedExecutionId
  );

  const { subscribeEvent } = useAstridrWS();

  useEffect(() => {
    if (selectedExecutionId !== "live") return;
    const unsub1 = subscribeEvent("step_started", (e) => {
      setLiveEvents(prev => [...prev, {
        stepName: (e.stepName ?? e.step_name) as string,
        status: "step_started",
        timestamp: (e.timestamp as number) ?? Date.now() / 1000,
      }]);
    });
    const unsub2 = subscribeEvent("step_completed", (e) => {
      setLiveEvents(prev => [...prev, {
        stepName: (e.stepName ?? e.step_name) as string,
        status: "step_completed",
        durationMs: (e.durationMs ?? e.duration_ms) as number | undefined,
        inputSize: (e.inputSize ?? e.input_size) as number | undefined,
        outputSize: (e.outputSize ?? e.output_size) as number | undefined,
        error: e.error as string | undefined,
        timestamp: (e.timestamp as number) ?? Date.now() / 1000,
      }]);
    });
    return () => { unsub1(); unsub2(); };
  }, [subscribeEvent, selectedExecutionId]);

  const stepEvents: StepEvent[] = selectedExecutionId === "live" ? liveEvents : convexEvents;

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = STAGE_NAMES.map((name, i) => ({
      id: name,
      type: "pipelineStage",
      position: { x: i * (NODE_W + NODE_GAP), y: 0 },
      data: {
        stepName: name,
        status: deriveStepStatus(name, stepEvents),
        durationMs: getStepDuration(name, stepEvents),
        selected: selectedStage === name,
        onClick: () => setSelectedStage(prev => prev === name ? null : name),
      } satisfies PipelineStageNodeData,
    }));

    const edges: Edge[] = STAGE_NAMES.slice(0, -1).map((name, i) => {
      const targetStatus = deriveStepStatus(STAGE_NAMES[i + 1], stepEvents);
      const sourceStatus = deriveStepStatus(name, stepEvents);
      return {
        id: `${name}->${STAGE_NAMES[i + 1]}`,
        source: name,
        target: STAGE_NAMES[i + 1],
        type: "smoothstep",
        animated: targetStatus === "running",
        style: {
          stroke: sourceStatus === "completed" ? "#22c55e" :
                  sourceStatus === "failed" ? "#ef4444" : "#4b5563",
          strokeWidth: 2,
        },
      };
    });

    return { nodes, edges };
  }, [stepEvents, selectedStage]);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">
          Pipeline Flow
          <InfoTooltip text="Real-time pipeline execution: receive -> route -> process -> respond -> TTS" />
        </h2>
        <select
          value={selectedExecutionId}
          onChange={(e) => {
            setSelectedExecutionId(e.target.value);
            setLiveEvents([]);
            setSelectedStage(null);
          }}
          className="text-[11px] bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-300"
        >
          <option value="live">Live</option>
          {recentIds.map(id => (
            <option key={id} value={id}>Run {id.slice(0, 12)}</option>
          ))}
        </select>
      </div>

      {/* CRITICAL: explicit pixel height -- flex-1 alone renders invisible */}
      <div style={{ height: 400 }} className="rounded-lg overflow-hidden w-full">
        {stepEvents.length === 0 && selectedExecutionId === "live" ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-500">
            No pipeline runs — Waiting for Astridr to send pipeline events
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
            maxZoom={2}
          >
            <Background color="#374151" gap={20} />
            <Controls
              showInteractive={false}
              className="!bg-gray-800 !border-gray-700 !shadow-none [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-600"
            />
          </ReactFlow>
        )}
      </div>

      {/* Inline detail panel for selected stage */}
      {selectedStage && (() => {
        const detail = getStepDetail(selectedStage, stepEvents);
        return (
          <div className="mt-3 bg-gray-900/50 border border-gray-700/40 rounded-lg px-4 py-3 text-xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-200">{selectedStage} Detail</h3>
              <button onClick={() => setSelectedStage(null)} className="text-gray-500 hover:text-gray-300 text-xs">Close</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-gray-400">
              <div><span className="text-gray-500">Status:</span> {detail?.status ?? "pending"}</div>
              <div><span className="text-gray-500">Duration:</span> <span className="font-mono">{detail?.durationMs != null ? formatDurationMs(detail.durationMs) : "--"}</span></div>
              <div><span className="text-gray-500">Input:</span> <span className="font-mono">{detail?.inputSize != null ? `${detail.inputSize}B` : "--"}</span></div>
              <div><span className="text-gray-500">Output:</span> <span className="font-mono">{detail?.outputSize != null ? `${detail.outputSize}B` : "--"}</span></div>
            </div>
            {detail?.error && (
              <div className="mt-2 bg-red-950/30 border border-red-900/40 rounded px-3 py-2 text-red-300 font-mono text-[11px]">
                {detail.error}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
