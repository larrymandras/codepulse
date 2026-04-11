/**
 * Time utilities for CodePulse.
 */

/**
 * Format a Unix timestamp (seconds) as a relative human-readable string.
 * e.g. "2h ago", "just now", "3d ago"
 */
export function formatRelativeTime(unixSeconds: number): string {
  const nowMs = Date.now();
  const diffMs = nowMs - unixSeconds * 1000;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}
