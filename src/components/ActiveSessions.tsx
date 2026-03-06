import { Link } from "react-router-dom";
import { useActiveSessions } from "../hooks/useActiveSessions";
import { formatTimestamp } from "../lib/formatters";

export default function ActiveSessions() {
  const sessions = useActiveSessions();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Active Sessions</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No active sessions</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sessions.map((session: any) => (
            <Link
              key={session._id}
              to={`/sessions/${session.sessionId}`}
              className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3 hover:border-gray-600/50 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-mono text-gray-300 truncate">
                  {session.sessionId}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                <span>Events: {session.eventCount ?? 0}</span>
                <span>Model: {session.model ?? "N/A"}</span>
                {session.lastEventAt && (
                  <span className="col-span-2">
                    Last: {formatTimestamp(session.lastEventAt)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
