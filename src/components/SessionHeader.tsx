import { formatTimestamp, formatDuration, truncatePath } from "../lib/formatters";
import { usePrivacyMask } from "../hooks/usePrivacyMask";
import { InlineMetricState } from "./EmptyState";

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
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-mono text-foreground">{redact(session.sessionId, `S-${session.sessionId.slice(-4)}`)}</span>
        <span
          className={`text-sm px-2 py-1 rounded ${
            session.status === "active"
              ? "bg-green-400/10 text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {session.status}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Model</p>
          <p className="text-base font-mono text-foreground mt-0.5">
            {session.model ? session.model : <span className="text-muted-foreground italic text-sm">untagged</span>}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">CWD</p>
          <p className="text-base font-mono text-foreground mt-0.5" title={session.cwd ? maskFilePath(session.cwd) : undefined}>
            {session.cwd ? (
              truncatePath(maskFilePath(session.cwd))
            ) : (
              <InlineMetricState state="empty" label="not reported" />
            )}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Duration</p>
          <p className="text-base text-foreground mt-0.5">
            {formatDuration(session.lastEventAt - session.startedAt)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Events</p>
          <p className="text-base text-foreground mt-0.5">{session.eventCount}</p>
        </div>
      </div>
    </div>
  );
}
