/**
 * RunHistorySelector — dropdown to select a past run session for replay.
 *
 * Uses a native <select> element styled to match the design system.
 * First option is always "Latest" (live/most recent).
 *
 * Phase 56, Plan 03: CPCC-03 Live Run panel.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunHistorySelectorProps {
  sessions: Array<{ sessionId: string; timestamp: number }>;
  selectedSessionId: string | null;
  onSelect: (sessionId: string | null) => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function shortSessionId(sessionId: string): string {
  return sessionId.slice(0, 8);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RunHistorySelector({
  sessions,
  selectedSessionId,
  onSelect,
}: RunHistorySelectorProps) {
  const value = selectedSessionId ?? "__latest__";

  return (
    <select
      className="text-sm bg-(--muted) border border-(--border) text-(--foreground) rounded px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-(--primary)"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        onSelect(v === "__latest__" ? null : v);
      }}
      aria-label="Select run session"
    >
      <option value="__latest__">Latest</option>
      {sessions.map((s) => (
        <option key={s.sessionId} value={s.sessionId}>
          {shortSessionId(s.sessionId)} — {relativeTime(s.timestamp)}
        </option>
      ))}
    </select>
  );
}
