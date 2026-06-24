import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDuration } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "./ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export default function SessionComparison() {
  const rawSessions = useQuery(api.sessions.listAll, { limit: 50 });
  const navigate = useNavigate();

  if (rawSessions === undefined) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Session Comparison<InfoTooltip text="Side-by-side comparison of recent sessions by model, events, duration, and status" /></h2>
        <p className="text-gray-500 text-base animate-pulse">Loading...</p>
      </div>
    );
  }

  if (rawSessions.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Session Comparison<InfoTooltip text="Side-by-side comparison of recent sessions by model, events, duration, and status" /></h2>
        <p className="text-gray-500 text-base">No sessions yet.</p>
      </div>
    );
  }

  const sessions = rawSessions;

  // Find most active session by eventCount (use reduce to avoid spread argument-count limit)
  const maxEvents = sessions.reduce((max, s) => Math.max(max, s.eventCount), 0);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Session Comparison</h2>
      <ScrollArea className="h-[400px] border border-gray-700/50 rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700/50 hover:bg-transparent">
              <TableHead className="w-[120px]">Session ID</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Duration</TableHead>
              <TableHead className="pl-3">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const duration = session.lastEventAt - session.startedAt;
              const isTop = session.eventCount === maxEvents;
              return (
                <TableRow
                  key={session.sessionId}
                  className={`cursor-pointer transition-colors border-gray-700/50 ${
                    isTop
                      ? "bg-blue-900/20 hover:bg-blue-900/30"
                      : "hover:bg-gray-700/20"
                  }`}
                  onClick={() => navigate(`/sessions/${session.sessionId}`)}
                >
                  <TableCell className="font-mono text-gray-200">
                    {session.sessionId.length > 12
                      ? session.sessionId.slice(0, 12) + "..."
                      : session.sessionId}
                  </TableCell>
                  <TableCell className="text-gray-300">
                    {session.model ? session.model : <span className="text-muted-foreground italic">untagged</span>}
                  </TableCell>
                  <TableCell className="text-right text-gray-300">
                    {session.eventCount}
                  </TableCell>
                  <TableCell className="text-right text-gray-300 font-mono">
                    {formatDuration(duration)}
                  </TableCell>
                  <TableCell className="pl-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-sm font-medium ${
                        session.status === "active"
                          ? "bg-green-900/40 text-green-400"
                          : session.status === "completed"
                            ? "bg-gray-700/50 text-gray-400"
                            : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {session.status}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
