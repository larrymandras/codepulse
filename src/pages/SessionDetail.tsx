import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatTimestamp } from "../lib/formatters";
import { getEventIcon, getEventColor } from "../lib/eventIcons";
import MetricCard from "../components/MetricCard";
import SessionHeader from "../components/SessionHeader";
import GanttTimeline from "../components/GanttTimeline";
import ContextGauge from "../components/ContextGauge";
import FileTree from "../components/FileTree";
import SessionTimeline from "../components/SessionTimeline";
import BashLog from "../components/BashLog";
import SessionCapabilities from "../components/SessionCapabilities";
import { TraceWaterfall } from "../components/TraceWaterfall";
import SectionErrorBoundary from "../components/SectionErrorBoundary";

type Tab = "overview" | "timeline" | "files" | "bash" | "errors" | "trace";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "timeline", label: "Timeline" },
  { key: "files", label: "Files" },
  { key: "bash", label: "Bash" },
  { key: "errors", label: "Errors" },
  { key: "trace", label: "Trace" },
];

const TAB_KEYS = new Set<Tab>(TABS.map((t) => t.key));

function isTab(value: string | null): value is Tab {
  return value !== null && TAB_KEYS.has(value as Tab);
}

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    isTab(initialTabParam) ? initialTabParam : "overview"
  );

  const session = useQuery(api.sessions.getById, id ? { sessionId: id } : "skip");
  const events = useQuery(api.events.listBySession, id ? { sessionId: id, limit: 200 } : "skip") ?? [];
  const agents = useQuery(api.agents.topology, id ? { sessionId: id } : "skip") ?? [];
  const toolExecutions = useQuery(
    api.toolExecutions.listBySession,
    id ? { sessionId: id } : "skip"
  ) ?? [];
  const errors = useQuery(
    api.events.listErrors,
    id && activeTab === "errors" ? { sessionId: id } : "skip"
  ) ?? [];

  if (!id) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-muted-foreground">Select a session to view details</p>
      </div>
    );
  }

  const toolCount = new Set(events.filter((e) => e.toolName).map((e) => e.toolName)).size;
  const errorCount = events.filter(
    (e) => e.eventType === "Error" || e.eventType === "ToolError"
  ).length;
  const fileCount = new Set(events.filter((e) => e.filePath).map((e) => e.filePath)).size;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-base rounded-lg transition-colors ${
              activeTab === tab.key
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {session && <SessionHeader session={session} />}

          <SessionCapabilities sessionId={id} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Events" value={session?.eventCount ?? 0} />
            <MetricCard label="Tools Used" value={toolCount} />
            <MetricCard label="Errors" value={errorCount} />
            <MetricCard label="Files Touched" value={fileCount} />
          </div>

          {/* Context Gauge + Gantt side by side on large screens */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ContextGauge sessionId={id} />
            <div className="lg:col-span-2">
              <GanttTimeline
                events={events}
                agents={agents}
                sessionStart={session?.startedAt ?? 0}
              />
            </div>
          </div>

          {agents.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
                Agents ({agents.length})
              </h2>
              <div className="space-y-2">
                {agents.map((a: any) => (
                  <div
                    key={a._id}
                    className="flex items-center justify-between bg-background rounded-lg px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base font-mono text-foreground">{a.agentId}</span>
                      <span className="text-sm px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {a.agentType}
                      </span>
                    </div>
                    <span
                      className={`text-sm ${
                        a.status === "running" ? "text-green-400" : "text-muted-foreground"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          <GanttTimeline
            events={events}
            agents={agents}
            sessionStart={session?.startedAt ?? 0}
          />
          <SessionTimeline events={events} agents={agents} toolExecutions={toolExecutions} />
        </div>
      )}

      {/* Files Tab */}
      {activeTab === "files" && <FileTree sessionId={id} />}

      {/* Bash Tab */}
      {activeTab === "bash" && <BashLog sessionId={id} />}

      {/* Errors Tab */}
      {activeTab === "errors" && (
        <ErrorsList errors={errors} />
      )}

      {/* Trace Tab */}
      {activeTab === "trace" && (
        <SectionErrorBoundary name="Trace">
          <TraceWaterfall sessionId={id} />
        </SectionErrorBoundary>
      )}
    </div>
  );
}

function ErrorsList({ errors }: { errors: any[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Errors ({errors.length})
      </h2>
      {errors.length === 0 ? (
        <p className="text-base text-muted-foreground py-8 text-center">No errors recorded</p>
      ) : (
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {errors.map((e: any) => {
            const isExpanded = expanded.has(e._id);
            return (
              <div key={e._id}>
                <button
                  onClick={() => toggle(e._id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-accent text-left"
                >
                  <span className="text-red-400">{getEventIcon(e.eventType)}</span>
                  <span className="text-sm font-mono text-red-300 shrink-0">
                    {e.eventType}
                  </span>
                  {e.toolName && (
                    <span className="text-sm text-muted-foreground">{e.toolName}</span>
                  )}
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {e.payload?.message ?? e.payload?.error ?? ""}
                  </span>
                  <span className="text-sm font-mono text-muted-foreground shrink-0">
                    {formatTimestamp(e.timestamp)}
                  </span>
                </button>
                {isExpanded && e.payload && (
                  <pre className="mx-3 mb-2 p-3 bg-background rounded text-sm text-muted-foreground font-mono max-h-48 overflow-auto whitespace-pre-wrap break-all">
                    {typeof e.payload === "string"
                      ? e.payload
                      : JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
