import { useSessionList } from "../hooks/useAnalytics";
import { formatDuration, formatTimestamp } from "../lib/formatters";

export default function SessionComparison() {
  const sessions = useSessionList(50);

  if (sessions.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Session Comparison</h2>
        <p className="text-gray-500 text-sm">No sessions yet.</p>
      </div>
    );
  }

  // Find most active session by eventCount
  const maxEvents = Math.max(...sessions.map((s) => s.eventCount));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Session Comparison</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2 pr-3 font-medium">Session ID</th>
              <th className="text-left py-2 px-3 font-medium">Model</th>
              <th className="text-right py-2 px-3 font-medium">Events</th>
              <th className="text-right py-2 px-3 font-medium">Duration</th>
              <th className="text-left py-2 pl-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => {
              const duration = session.lastEventAt - session.startedAt;
              const isTop = session.eventCount === maxEvents;
              return (
                <tr
                  key={session.sessionId}
                  className={`border-b border-gray-700/50 cursor-pointer transition-colors ${
                    isTop
                      ? "bg-blue-900/20 hover:bg-blue-900/30"
                      : "hover:bg-gray-700/20"
                  }`}
                  onClick={() => {
                    window.location.href = `/sessions/${session.sessionId}`;
                  }}
                >
                  <td className="py-2 pr-3 text-gray-200 font-mono text-xs">
                    {session.sessionId.length > 12
                      ? session.sessionId.slice(0, 12) + "..."
                      : session.sessionId}
                  </td>
                  <td className="py-2 px-3 text-gray-300 text-xs">
                    {session.model ?? "unknown"}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300">
                    {session.eventCount}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300 font-mono">
                    {formatDuration(duration)}
                  </td>
                  <td className="py-2 pl-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        session.status === "active"
                          ? "bg-green-900/40 text-green-400"
                          : session.status === "completed"
                            ? "bg-gray-700/50 text-gray-400"
                            : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {session.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
