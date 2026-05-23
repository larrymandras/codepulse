import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDuration } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";
import { useNavigate } from "react-router-dom";

export default function SessionComparison() {
  const rawSessions = useQuery(api.sessions.listAll, { limit: 50 });
  const navigate = useNavigate();

  if (rawSessions === undefined) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Session Comparison<InfoTooltip text="Side-by-side comparison of recent sessions by model, events, duration, and status" /></h2>
        <p className="text-gray-500 text-sm animate-pulse">Loading...</p>
      </div>
    );
  }

  if (rawSessions.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Session Comparison<InfoTooltip text="Side-by-side comparison of recent sessions by model, events, duration, and status" /></h2>
        <p className="text-gray-500 text-sm">No sessions yet.</p>
      </div>
    );
  }

  const sessions = rawSessions;

  // Find most active session by eventCount (use reduce to avoid spread argument-count limit)
  const maxEvents = sessions.reduce((max, s) => Math.max(max, s.eventCount), 0);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Session Comparison</h2>
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
                  onClick={() => navigate(`/sessions/${session.sessionId}`)}
                >
                  <td className="py-2 pr-3 text-gray-200 font-mono text-xs">
                    {session.sessionId.length > 12
                      ? session.sessionId.slice(0, 12) + "..."
                      : session.sessionId}
                  </td>
                  <td className="py-2 px-3 text-gray-300 text-xs">
                    {session.model ? session.model : <span className="text-muted-foreground italic text-xs">untagged</span>}
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
