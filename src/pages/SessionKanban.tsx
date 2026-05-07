import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import SectionErrorBoundary from "../components/SectionErrorBoundary";

const KANBAN_COLUMNS = [
  { status: "received",       label: "Received",       color: "text-yellow-400" },
  { status: "processing",     label: "Processing",     color: "text-blue-400" },
  { status: "awaiting_human", label: "Awaiting Human", color: "text-amber-400" },
  { status: "complete",       label: "Complete",       color: "text-green-400" },
] as const;

function elapsedLabel(lastEventAt: number): string {
  const seconds = Math.floor(Date.now() / 1000 - lastEventAt);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function KanbanColumn({
  label,
  color,
  sessions,
  onCardClick,
}: {
  label: string;
  color: string;
  sessions: any[];
  onCardClick: (id: string) => void;
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-3 space-y-2 min-h-[400px]">
      <div className="flex items-center gap-2 px-1">
        <span className={`w-2 h-2 rounded-full ${color.replace("text-", "bg-")}`} />
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {label}
        </h2>
        <span className="bg-gray-700 text-gray-300 text-xs rounded-full px-2">
          {sessions.length}
        </span>
      </div>
      {sessions.length === 0 ? (
        <p className="text-xs text-gray-600 italic text-center pt-8">No sessions</p>
      ) : (
        sessions.map((s: any) => (
          <div
            key={s._id}
            className="bg-gray-900/60 border border-gray-700/30 rounded-lg px-3 py-2 cursor-pointer hover:border-gray-600/70 transition-colors"
            onClick={() => onCardClick(s.sessionId)}
          >
            <p className="text-xs font-mono text-gray-400 truncate">
              {s.sessionId.slice(0, 8)}...
            </p>
            <p className="text-xs text-gray-300">{s.model ?? "---"}</p>
            <p className="text-xs text-gray-500">{elapsedLabel(s.lastEventAt)}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default function SessionKanban() {
  const navigate = useNavigate();
  const received      = useQuery(api.sessions.listByStatus, { status: "received" })       ?? [];
  const processing    = useQuery(api.sessions.listByStatus, { status: "processing" })     ?? [];
  const awaitingHuman = useQuery(api.sessions.listByStatus, { status: "awaiting_human" }) ?? [];
  const complete      = useQuery(api.sessions.listByStatus, { status: "complete" })       ?? [];

  const columnData: Record<string, any[]> = {
    received,
    processing,
    awaiting_human: awaitingHuman,
    complete,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Sessions</h1>
      <div className="grid grid-cols-4 gap-6">
        {KANBAN_COLUMNS.map((col) => (
          <SectionErrorBoundary key={col.status} name={col.label}>
            <KanbanColumn
              label={col.label}
              color={col.color}
              sessions={columnData[col.status]}
              onCardClick={(sessionId) => navigate(`/sessions/${sessionId}`)}
            />
          </SectionErrorBoundary>
        ))}
      </div>
    </div>
  );
}
