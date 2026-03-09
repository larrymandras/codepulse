import { formatTimestamp, formatDuration, truncatePath } from "../lib/formatters";
import { usePrivacyMask } from "../hooks/usePrivacyMask";

interface SessionHeaderProps {
  session: {
    sessionId: string;
    status: string;
    model?: string;
    cwd?: string;
    startedAt: number;
    lastEventAt: number;
    eventCount: number;
  };
}

export default function SessionHeader({ session }: SessionHeaderProps) {
  const { redact, maskFilePath } = usePrivacyMask();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-mono text-gray-200">{redact(session.sessionId, `S-${session.sessionId.slice(-4)}`)}</span>
        <span
          className={`text-xs px-2 py-1 rounded ${
            session.status === "active"
              ? "bg-green-400/10 text-green-400"
              : "bg-gray-400/10 text-gray-400"
          }`}
        >
          {session.status}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-gray-500">Model</p>
          <p className="text-sm font-mono text-gray-200 mt-0.5">{session.model ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">CWD</p>
          <p className="text-sm font-mono text-gray-200 mt-0.5" title={session.cwd ? maskFilePath(session.cwd) : undefined}>
            {session.cwd ? maskFilePath(truncatePath(session.cwd)) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm text-gray-200 mt-0.5">
            {formatDuration(session.lastEventAt - session.startedAt)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Events</p>
          <p className="text-sm text-gray-200 mt-0.5">{session.eventCount}</p>
        </div>
      </div>
    </div>
  );
}
