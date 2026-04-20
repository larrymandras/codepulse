/**
 * TranscriptBubble — speaker-attributed chat bubble for War Room (live)
 * and Meeting Bot (replay) transcript views.
 *
 * User messages: right-aligned, muted background.
 * Agent messages: left-aligned, card background with optional left border accent.
 * No markdown — plain text only.
 *
 * Phase 72, Plan 02: D-05
 */

export interface TranscriptBubbleProps {
  speaker: string;
  text: string;
  timestamp: number;
  isUser: boolean;
  agentColor?: string; // OKLCH value for left border accent
}

export function TranscriptBubble({
  speaker,
  text,
  timestamp,
  isUser,
  agentColor,
}: TranscriptBubbleProps) {
  const wrapperClass = isUser
    ? "flex flex-col items-end w-full"
    : "flex flex-col items-start w-full";

  const bubbleClass = isUser
    ? "bg-(--muted) text-(--foreground) max-w-[70%] p-3 rounded-lg"
    : "bg-(--card) border border-(--border) text-(--foreground) max-w-[70%] p-3 rounded-lg";

  const agentBorderStyle =
    !isUser && agentColor
      ? { borderLeftColor: agentColor, borderLeftWidth: "2px" }
      : undefined;

  return (
    <div
      className={wrapperClass}
      role="article"
      aria-label={`${speaker}: ${text}`}
    >
      <div className={bubbleClass} style={agentBorderStyle}>
        <p className="text-xs font-semibold text-muted-foreground mb-1">
          {speaker}
        </p>
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
      <span className="text-xs text-muted-foreground mt-0.5 px-1">
        {new Date(timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
