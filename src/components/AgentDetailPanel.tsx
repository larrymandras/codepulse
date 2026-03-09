import { useAgentDetail } from "../hooks/useAgentTopology";
import { formatDuration } from "../lib/formatters";
import { usePrivacyMask } from "../hooks/usePrivacyMask";

const eventTypeColors: Record<string, string> = {
  handoff: "text-purple-400 bg-purple-400/10",
  message: "text-blue-400 bg-blue-400/10",
  delegation: "text-cyan-400 bg-cyan-400/10",
  result: "text-green-400 bg-green-400/10",
};

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface Props {
  agentId: string;
  onClose: () => void;
}

export default function AgentDetailPanel({ agentId, onClose }: Props) {
  const detail = useAgentDetail(agentId);
  const { redact } = usePrivacyMask();

  if (!detail) {
    return (
      <div className="bg-gray-800/90 border border-gray-700/50 rounded-xl p-4 w-72">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    );
  }

  const duration =
    detail.endedAt && detail.startedAt
      ? formatDuration(detail.endedAt - detail.startedAt)
      : detail.startedAt
        ? formatDuration(Date.now() / 1000 - detail.startedAt)
        : "—";

  const statusColor: Record<string, string> = {
    running: "text-green-400",
    completed: "text-yellow-400",
    failed: "text-red-400",
  };

  return (
    <div className="bg-gray-800/95 backdrop-blur border border-gray-700/50 rounded-xl p-4 w-72 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-200 truncate">{redact(detail.agentId, `A-${detail.agentId.slice(-4)}`)}</h3>
          <p className="text-[10px] text-gray-500">{detail.agentType}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-sm ml-2 shrink-0"
        >
          &times;
        </button>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-[9px] text-gray-500 uppercase">Status</p>
          <p className={`text-xs font-medium ${statusColor[detail.status] ?? "text-gray-400"}`}>
            {detail.status}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-gray-500 uppercase">Duration</p>
          <p className="text-xs text-gray-200">{duration}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-500 uppercase">Model</p>
          <p className="text-xs text-gray-200 truncate">{detail.model ?? "—"}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-500 uppercase">Session Events</p>
          <p className="text-xs text-gray-200">{detail.eventCount}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[9px] text-gray-500 uppercase">Session</p>
          <p className="text-[10px] text-gray-400 font-mono truncate">{redact(detail.sessionId, `S-${detail.sessionId.slice(-4)}`)}</p>
        </div>
        {detail.parentAgentId && (
          <div className="col-span-2">
            <p className="text-[9px] text-gray-500 uppercase">Parent</p>
            <p className="text-[10px] text-gray-400 font-mono truncate">{redact(detail.parentAgentId, `A-${detail.parentAgentId.slice(-4)}`)}</p>
          </div>
        )}
      </div>

      {/* Coordination events */}
      {detail.coordination.length > 0 && (
        <>
          <h4 className="text-[10px] text-gray-500 uppercase mb-1.5">Coordination</h4>
          <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
            {detail.coordination.map((c: any, i: number) => {
              const isOutgoing = c.fromAgent === agentId;
              const other = isOutgoing ? c.toAgent : c.fromAgent;
              const etClass = eventTypeColors[c.eventType] ?? "text-gray-400 bg-gray-700/30";

              return (
                <div key={i} className="flex items-start gap-1.5 py-1 border-b border-gray-700/30 last:border-0">
                  <span className="text-[9px] mt-0.5 shrink-0">
                    {isOutgoing ? "→" : "←"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-[9px] px-1 py-0.5 rounded ${etClass}`}>
                        {c.eventType}
                      </span>
                      <span className="text-[9px] text-gray-500 truncate">{other}</span>
                    </div>
                    {c.status && (
                      <p className="text-[8px] text-gray-600 mt-0.5">{c.status}</p>
                    )}
                  </div>
                  <span className="text-[8px] text-gray-600 shrink-0">{relativeTime(c.timestamp)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {detail.coordination.length === 0 && (
        <p className="text-[10px] text-gray-600">No coordination events</p>
      )}
    </div>
  );
}
