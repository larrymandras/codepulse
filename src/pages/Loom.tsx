/**
 * Loom — curated pipelines (Phase 119).
 *
 * Definition-first: a pipeline describes what the system is DESIGNED to do, and
 * a run lights it up. Per-step docs live in the row (`steps[].docMd`), so this
 * page never reads the filesystem.
 *
 * D-07 boundary: Phase 111's Mission Board is post-hoc job HISTORY; Loom is the
 * curated definition, optionally live. They cross-link rather than merge — and
 * since 111 is deliberately removing its live chrome, this is now the only
 * live-progress surface in CodePulse.
 */
import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Waypoints } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import LoomStepNode from "@/components/loom/LoomStepNode";
import {
  useLoomPipelinesState,
  useLoomRuns,
  type LoomPipeline,
  type LoomRun,
} from "@/hooks/useLoom";
import { stepStateFrom, isRunActive } from "@/lib/loomStepState";

const nodeTypes = { loomStep: LoomStepNode } as const;

const NODE_X_GAP = 220;

function buildGraph(
  pipeline: LoomPipeline,
  run: LoomRun | null
): { nodes: Node[]; edges: Edge[] } {
  const events = run?.stepEvents ?? [];
  const nodes: Node[] = pipeline.steps.map((step, i) => ({
    id: step.id,
    type: "loomStep",
    position: { x: i * NODE_X_GAP, y: 0 },
    data: {
      label: step.name,
      icon: step.icon,
      state: stepStateFrom(events, step.id),
      isCurrent: run?.currentStep === step.id && isRunActive(run?.status),
    },
  }));

  const edges: Edge[] = pipeline.steps.slice(1).map((step, i) => ({
    id: `${pipeline.steps[i].id}->${step.id}`,
    source: pipeline.steps[i].id,
    target: step.id,
    // Animate only the edge feeding the step currently executing.
    animated:
      isRunActive(run?.status) && run?.currentStep === step.id,
  }));

  return { nodes, edges };
}

function PipelineView({ pipeline }: { pipeline: LoomPipeline }) {
  const runs = useLoomRuns(pipeline.slug);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [openStepId, setOpenStepId] = useState<string | null>(null);

  const run =
    runs.find((r) => r._id === selectedRunId) ?? runs[0] ?? null;

  const { nodes, edges } = useMemo(
    () => buildGraph(pipeline, run),
    [pipeline, run]
  );

  const openStep = pipeline.steps.find((s) => s.id === openStepId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground text-lg font-bold">{pipeline.name}</h2>
        {pipeline.description && (
          <p className="text-muted-foreground text-sm">{pipeline.description}</p>
        )}
        {pipeline.sourceRef && (
          <p className="text-muted-foreground font-mono text-xs">
            {pipeline.sourceRef}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 h-80 p-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            onNodeClick={(_e, node) => setOpenStepId(node.id)}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </Card>

        <Card className="max-h-80 overflow-y-auto p-4">
          {openStep ? (
            <>
              <h3 className="mb-2 font-mono text-xs font-bold tracking-widest uppercase">
                {openStep.name}
              </h3>
              {openStep.description && (
                <p className="text-muted-foreground mb-2 text-sm">
                  {openStep.description}
                </p>
              )}
              {/* Plain text, never a markdown/HTML renderer: docMd is authored
                  by a skill from source files and rendering it as HTML would be
                  a stored-XSS surface for zero benefit. */}
              <pre className="text-muted-foreground font-mono text-xs whitespace-pre-wrap">
                {openStep.docMd ?? "No docs for this step yet."}
              </pre>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Select a step to read its docs.
            </p>
          )}
        </Card>
      </div>

      <section className="space-y-2">
        <h3 className="text-muted-foreground font-mono text-xs font-bold tracking-widest uppercase">
          Runs ({runs.length})
        </h3>
        {runs.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No runs yet. Drive one with{" "}
            <code className="font-mono">node hooks/loom-emit.mjs step:start 1</code>.
          </p>
        ) : (
          <div className="space-y-1">
            {runs.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => setSelectedRunId(r._id)}
                data-testid={`loom-run-${r.status}`}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left font-mono text-xs ${
                  r._id === run?._id ? "border-primary" : "border-border"
                }`}
              >
                <span>{new Date(r.startedAt).toLocaleString()}</span>
                <span>{r.status}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LoomBody() {
  const { pipelines, isLoading } = useLoomPipelinesState();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="border-primary/20 bg-primary/5 rounded border border-dashed p-10 text-center">
        <p className="text-foreground mb-1 text-lg font-bold">
          No pipelines yet
        </p>
        <p className="text-muted-foreground text-sm">
          Author one with <code className="font-mono">/loom-author</code>, or
          upsert it directly with{" "}
          <code className="font-mono">loom:upsertPipeline</code>.
        </p>
      </div>
    );
  }

  const selected =
    pipelines.find((p) => p.slug === selectedSlug) ?? pipelines[0];

  return (
    <div className="space-y-4">
      {pipelines.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {pipelines.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => setSelectedSlug(p.slug)}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs font-bold ${
                p.slug === selected.slug
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      <PipelineView pipeline={selected} />
    </div>
  );
}

export default function Loom() {
  return (
    <div className="p-6">
      <PageHeader title="Loom" icon={Waypoints} />
      <SectionErrorBoundary name="Pipelines">
        <LoomBody />
      </SectionErrorBoundary>
    </div>
  );
}
