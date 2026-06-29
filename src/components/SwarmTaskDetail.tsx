/**
 * SwarmTaskDetail — right-side Sheet showing the FULL detail of a swarm subtask.
 *
 * Opened by clicking a node in SwarmGraph or a row in BlackboardPanel. Shows the
 * complete (un-truncated) subtask text plus state, agent, model, and dependencies.
 * This is the canonical "read everything" surface — graph nodes / blackboard rows
 * stay compact 2-line summaries and defer to this panel for the full text.
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ExternalLink } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { modelBadgeClass } from "./AgentNode";

export interface SwarmTaskDetailData {
  subtaskId: string;
  subtask: string;
  state: string;
  dependsOn?: string[];
  claimedBy?: string;
  model?: string;
  agentId?: string;
}

interface SwarmTaskDetailProps {
  task: SwarmTaskDetailData | null;
  onClose: () => void;
  /**
   * Cross-graph link: focus this subtask's agent on the Code/Vault graph.
   * Injected by the page (keeps this panel presentational). Omitted = plain text.
   */
  onAgentNav?: (agent: string) => void;
}

const eyebrow =
  "text-xs font-mono uppercase tracking-widest text-muted-foreground";

function MetaTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 p-2.5 flex flex-col gap-1 min-w-0">
      <span className={eyebrow}>{label}</span>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  );
}

export default function SwarmTaskDetail({ task, onClose, onAgentNav }: SwarmTaskDetailProps) {
  const agent = task?.agentId || task?.claimedBy;
  const deps = task?.dependsOn ?? [];

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto bg-background/95 backdrop-blur border-border/60"
      >
        <SheetHeader className="pr-10 border-b border-border/40">
          <SheetTitle className="flex items-center gap-2.5">
            <span className={eyebrow}>Subtask</span>
            {task && <StatusBadge status={task.state} />}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Full details for the selected swarm subtask.
          </SheetDescription>
        </SheetHeader>

        {task && (
          <div className="px-4 pb-6 flex flex-col gap-5">
            {/* Full subtask text — no clamp, no truncate, in a readable card */}
            <section className="flex flex-col gap-2">
              <span className={eyebrow}>Description</span>
              <p className="rounded-lg border border-border/40 bg-muted/20 p-3 text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
                {task.subtask}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <MetaTile label="Agent">
                {agent ? (
                  onAgentNav ? (
                    <button
                      type="button"
                      onClick={() => onAgentNav(agent)}
                      title="Open this agent on the Code/Vault graph"
                      className="inline-flex items-center gap-1.5 font-mono break-all text-foreground hover:text-primary transition-colors"
                    >
                      {agent}
                      <ExternalLink className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                    </button>
                  ) : (
                    <span className="font-mono break-all">{agent}</span>
                  )
                ) : (
                  <span className="text-muted-foreground italic">Unassigned</span>
                )}
              </MetaTile>
              <MetaTile label="Model">
                {task.model ? (
                  <span
                    className={`inline-block text-sm px-1.5 py-0.5 rounded ${modelBadgeClass(task.model)}`}
                  >
                    {task.model}
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">Default</span>
                )}
              </MetaTile>
            </div>

            <section className="flex flex-col gap-2">
              <span className={eyebrow}>Depends on ({deps.length})</span>
              {deps.length === 0 ? (
                <span className="text-sm text-muted-foreground italic">
                  No dependencies
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {deps.map((d) => (
                    <span
                      key={d}
                      className="rounded border border-border/40 bg-muted/20 px-1.5 py-0.5 font-mono text-sm text-muted-foreground break-all"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-1.5">
              <span className={eyebrow}>Subtask ID</span>
              <span className="font-mono text-sm break-all text-muted-foreground">
                {task.subtaskId}
              </span>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
