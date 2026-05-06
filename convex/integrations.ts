import { query } from "./_generated/server";

type IntegrationStatus = "Connected" | "Idle" | "Degraded" | "Disconnected";

/**
 * Determine integration status with per-type thresholds.
 *
 * "polled" integrations (Supabase, Docker) have expected poll intervals,
 *   so missing a window means something is actually wrong.
 * "event-driven" integrations (GitHub, Telegram, Slack, Email) only
 *   produce data when the user acts, so absence of recent data is normal.
 */
function statusForPolled(
  lastActivity: number | null,
  nowMs: number,
  pollIntervalMs: number
): IntegrationStatus {
  if (lastActivity == null) return "Disconnected";
  const ageMs = nowMs - lastActivity;
  // Within 2× the poll interval → Connected
  if (ageMs <= pollIntervalMs * 2) return "Connected";
  // Within 4× → Degraded (missed a cycle)
  if (ageMs <= pollIntervalMs * 4) return "Degraded";
  return "Disconnected";
}

function statusForEventDriven(
  lastActivity: number | null,
  hasAnyRecords: boolean,
  nowMs: number
): IntegrationStatus {
  if (lastActivity == null && !hasAnyRecords) return "Disconnected";
  if (lastActivity == null) return "Idle";
  const ageMs = nowMs - lastActivity;
  // Active within the last hour → Connected
  if (ageMs <= 60 * 60 * 1000) return "Connected";
  // Has records but nothing recent → Idle (normal for event-driven)
  return "Idle";
}

export const healthStatus = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // GitHub: check gitCommits and events with git-related types
    const recentCommit = await ctx.db
      .query("gitCommits")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
    const gitEvent = await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
    // Use the most recent of gitCommits or events that look git-related
    let githubTs: number | null = null;
    if (recentCommit) githubTs = recentCommit.timestamp * 1000; // timestamps in schema are seconds
    if (gitEvent) {
      const evTs = gitEvent.timestamp * 1000;
      // If event is more recent, and it's from a git-related tool, use it
      if (
        gitEvent.toolName === "Bash" &&
        gitEvent.eventType?.toLowerCase().includes("git")
      ) {
        if (githubTs == null || evTs > githubTs) githubTs = evTs;
      }
    }

    // Supabase: check supabaseHealth for recent entries
    const sbHealthEntries = await ctx.db
      .query("supabaseHealth")
      .order("desc")
      .first();
    const supabaseTs = sbHealthEntries
      ? sbHealthEntries.checkedAt * 1000
      : null;

    // Docker: check dockerContainers for recent entries
    const dockerEntry = await ctx.db
      .query("dockerContainers")
      .order("desc")
      .first();
    const dockerTs = dockerEntry ? dockerEntry.updatedAt * 1000 : null;

    // Telegram, Slack, Email: use channelHealth table (emitted every 60s by Ástríðr)
    const telegramHealth = await ctx.db
      .query("channelHealth")
      .withIndex("by_channel", (q) => q.eq("channelId", "telegram"))
      .order("desc")
      .first();
    const slackHealth = await ctx.db
      .query("channelHealth")
      .withIndex("by_channel", (q) => q.eq("channelId", "slack"))
      .order("desc")
      .first();
    const emailHealth = await ctx.db
      .query("channelHealth")
      .withIndex("by_channel", (q) => q.eq("channelId", "email"))
      .order("desc")
      .first();

    return {
      // Event-driven: GitHub only produces data when user commits/pushes
      github: statusForEventDriven(githubTs, recentCommit != null, now),
      // Polled every 1 hour (3_600_000 ms)
      supabase: statusForPolled(supabaseTs, now, 3_600_000),
      // Polled every 2 minutes (120_000 ms)
      docker: statusForPolled(dockerTs, now, 120_000),
      // Polled every 60s by health emitter
      telegram: statusForPolled(telegramHealth?.timestamp ? telegramHealth.timestamp * 1000 : null, now, 60_000),
      slack: statusForPolled(slackHealth?.timestamp ? slackHealth.timestamp * 1000 : null, now, 60_000),
      email: statusForPolled(emailHealth?.timestamp ? emailHealth.timestamp * 1000 : null, now, 60_000),
    };
  },
});
