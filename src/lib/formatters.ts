export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function formatCost(dollars: number): string {
  return `$${dollars.toFixed(4)}`;
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return formatDuration(ms / 1000);
}

export function relativeTime(epochSeconds: number): string {
  const diff = Date.now() / 1000 - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function truncatePath(path: string, maxLen = 40): string {
  if (path.length <= maxLen) return path;
  return "..." + path.slice(path.length - maxLen + 3);
}

/**
 * Format a count with a correctly-pluralized noun: `pluralize(1, "agent")` →
 * "1 agent", `pluralize(3, "agent")` → "3 agents". Pass an explicit `plural`
 * for irregulars: `pluralize(2, "entity", "entities")` → "2 entities".
 */
export function pluralize(count: number, noun: string, plural?: string): string {
  const word = count === 1 ? noun : plural ?? `${noun}s`;
  return `${count} ${word}`;
}
