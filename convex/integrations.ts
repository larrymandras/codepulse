import { query } from "./_generated/server";

type IntegrationStatus = "Connected" | "Degraded" | "Disconnected";

function statusFromTimestamp(
  lastActivity: number | null,
  nowMs: number
): IntegrationStatus {
  if (lastActivity == null) return "Disconnected";
  const ageMs = nowMs - lastActivity;
  if (ageMs <= 15 * 60 * 1000) return "Connected";
  if (ageMs <= 60 * 60 * 1000) return "Degraded";
  return "Disconnected";
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

    // Telegram, Slack, Email: check webhookEvents or events for matching source
    const webhooks = await ctx.db
      .query("webhookEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);

    let telegramTs: number | null = null;
    let slackTs: number | null = null;
    let emailTs: number | null = null;

    for (const wh of webhooks) {
      const src = (wh.source ?? "").toLowerCase();
      const ts = wh.timestamp * 1000;
      if (src.includes("telegram") && (telegramTs == null || ts > telegramTs))
        telegramTs = ts;
      if (src.includes("slack") && (slackTs == null || ts > slackTs))
        slackTs = ts;
      if (src.includes("email") && (emailTs == null || ts > emailTs))
        emailTs = ts;
    }

    // Also check proactiveMessages for telegram/slack activity
    const messages = await ctx.db
      .query("proactiveMessages")
      .withIndex("by_timestamp")
      .order("desc")
      .take(20);

    for (const msg of messages) {
      const ts = msg.timestamp * 1000;
      if (msg.chatId && telegramTs == null) telegramTs = ts;
      if (msg.channelId && slackTs == null) slackTs = ts;
    }

    return {
      github: statusFromTimestamp(githubTs, now),
      supabase: statusFromTimestamp(supabaseTs, now),
      docker: statusFromTimestamp(dockerTs, now),
      telegram: statusFromTimestamp(telegramTs, now),
      slack: statusFromTimestamp(slackTs, now),
      email: statusFromTimestamp(emailTs, now),
    };
  },
});
