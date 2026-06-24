import { Link } from "react-router-dom";
import { useActiveSessions } from "../hooks/useActiveSessions";
import { formatTimestamp } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";
import { Badge } from "./ui/badge";
import { PROVIDER_COLORS, PROVIDER_DISPLAY_NAMES } from "../lib/providers";
import { ScrollArea } from "./ui/scroll-area";

export default function ActiveSessions() {
  const sessions = useActiveSessions();

  return (
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 hover:border-primary/50 transition-colors shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)]">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Active Sessions
        <InfoTooltip text="Currently active Claude Code sessions with event counts and last activity" />
      </h2>
      {sessions.length === 0 ? (
        <p className="text-sm font-mono text-muted-foreground py-6 text-center">
          No active sessions
        </p>
      ) : (
        <ScrollArea className="h-[300px] pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sessions.map((session: any) => (
              <Link
                key={session._id}
                to={`/sessions/${session.sessionId}`}
                className="bg-background/80 border-l-2 border-l-primary border border-border/30 rounded-r-lg p-3 hover:border-primary/50 hover:bg-card/80 transition-all hover-glitch group shadow-[0_0_10px_rgba(0,0,0,0.3)] hover:shadow-[var(--glow-sm)] flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-primary font-mono font-bold text-base group-hover:animate-pulse">{'>'}</span>
                  <span className="sr-only">Active session:</span>
                  <span className="text-sm font-mono text-foreground truncate tracking-tight">
                    {session.sessionId}
                  </span>
                  {session.provider && (
                    <Badge
                      variant="outline"
                      className="text-xs font-mono uppercase px-1.5 py-0.5 shrink-0"
                      style={{
                        borderColor: PROVIDER_COLORS[session.provider] ?? "#6b7280",
                        color: PROVIDER_COLORS[session.provider] ?? "#6b7280",
                      }}
                    >
                      {PROVIDER_DISPLAY_NAMES[session.provider] ?? session.provider}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs uppercase font-mono tracking-widest text-muted-foreground">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-primary/70">Events</span>
                    <span className="text-foreground">{session.eventCount ?? 0}</span>
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-primary/70">Model</span>
                    <span className="text-foreground truncate">
                      {session.model ? session.model : <span className="text-muted-foreground italic text-sm">untagged</span>}
                    </span>
                  </span>
                  {session.lastEventAt && (
                    <span className="col-span-2 flex items-center gap-1.5 mt-1 pt-2 border-t border-border/30 text-primary/60">
                      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-pulse" />
                      Last: {formatTimestamp(session.lastEventAt)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
