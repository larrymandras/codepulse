import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { usePrivacyMask } from "../hooks/usePrivacyMask";
import { SectionHeader } from "./SectionHeader";
import Sparkline from "./Sparkline";

/**
 * MessageRoutingSummary — Phase 112's D-13 follow-up, closed.
 *
 * D-13 routed `message_routed` WITHOUT a UI because its channel/sender/session
 * metadata "needs its own design pass rather than a reskin of the
 * governor_decision surface". This is that design pass, and it deliberately is
 * NOT a row table.
 *
 * Measured live 2026-08-26 over the whole 13-day table: 53 rows, ONE profile,
 * TWO channels (telegram 51, whatsapp 2), TWO senders, 16 sessions. A last-50
 * row table over that renders fifty near-identical telegram/personal/Larry
 * lines — it varies on nothing a reader is looking at. Channel mix and volume
 * over time are what this data actually varies on, so that is what this shows.
 *
 * Reads `api.messageRoutes.channelSummary`, which aggregates SERVER-side over
 * an index-bounded 14-day window (guarded by `convex/messageRoutesBounded.test.ts`).
 * `windowDays` and `atCap` arrive as DATA rather than as imported constants:
 * importing from `convex/messageRoutes.ts` would drag the Convex server runtime
 * into the client bundle (the documented 108-06 defect that
 * `governorDecisionsFilters.ts` exists to avoid on the sibling axis).
 *
 * Colours come from CSS tokens via `currentColor` — never a hardcoded hex, and
 * deliberately not `useThemeColors()`, which reads `getComputedStyle` for
 * canvas consumers that cannot resolve CSS vars. An SVG stroke can, so the
 * sparkline inherits `text-(--chart-bar-accent)` from its wrapper and follows
 * the runtime theme switcher for free.
 *
 * The visible marks use `--chart-bar-ACCENT`, not `--chart-bar`. `--chart-bar`
 * is the dark neutral a chart's BASE series/track uses — measured in the cyan
 * theme it is `#1e1e24`, byte-identical to `--muted`, so painting the bar fill
 * with it renders the fill invisible against its own track (that was this
 * component's first rendered state). `TokenUsageChart.tsx:123-129` uses the two
 * as the pair they are: `--chart-bar` for the base series, `--chart-bar-accent`
 * for the highlighted one. jsdom does not resolve CSS custom properties, so no
 * unit test here can catch a regression of this — it takes a rendered probe.
 */

interface ChannelSlice {
  channel: string;
  count: number;
  senders: string[];
}

interface Summary {
  windowDays: number;
  since: number;
  total: number;
  atCap: boolean;
  channels: ChannelSlice[];
  profiles: string[];
  sessionCount: number;
  daily: number[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function MessageRoutingSummary() {
  const summary = useQuery(api.messageRoutes.channelSummary, {}) as
    | Summary
    | undefined;
  const { maskHandle } = usePrivacyMask();

  // Loading: `undefined` result. Distinguished from the zero-rows state below
  // — collapsing the two would make a still-loading section look like it had
  // already confirmed no messages were routed (the sibling's T-112-17 rule).
  if (summary === undefined) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Message Routing" />
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (summary.total === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Message Routing" />
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-base font-semibold text-foreground mb-1">
            No messages routed in the last {summary.windowDays} days
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Channel activity appears here once Ástríðr routes a message on a
            connected channel — Telegram, WhatsApp, or any other configured
            inbound surface.
          </p>
        </div>
      </div>
    );
  }

  const perDay = summary.total / summary.windowDays;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Message Routing"
        action={
          <span className="text-xs text-muted-foreground tabular-nums">
            Last {summary.windowDays} days
          </span>
        }
      />

      {/* Channel mix — one proportional bar per channel, busiest first (the
          server sorts; this preserves that order rather than re-sorting). */}
      <div className="space-y-4">
        {summary.channels.map((slice) => {
          // `total` is guaranteed > 0 here by the early return above, so this
          // share can never be NaN.
          const share = (slice.count / summary.total) * 100;
          return (
            <div key={slice.channel} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  data-testid="message-route-channel-name"
                  className="text-sm font-medium text-foreground"
                >
                  {slice.channel}
                </span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-sm font-semibold text-foreground">
                    {slice.count}
                  </span>
                  <span className="text-xs text-muted-foreground w-9 text-right">
                    {Math.round(share)}%
                  </span>
                </span>
              </div>

              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
              >
                <div
                  data-testid="message-route-bar"
                  className="h-full rounded-full bg-(--chart-bar-accent)"
                  style={{ width: `${share}%` }}
                />
              </div>

              {slice.senders.length > 0 && (
                <p
                  data-testid="message-route-senders"
                  // The app's own privacy CSS keys off this attribute:
                  // `.privacy-screenshot [data-sensitive] { visibility: hidden }`
                  // and `.privacy-demo [data-sensitive] { filter: blur(4px) }`
                  // (index.css:649-661). Without it those rules cannot reach
                  // this element at all. The mask below is the primary defence
                  // and does not depend on CSS having loaded; this is the
                  // second layer.
                  data-sensitive=""
                  className="text-xs text-muted-foreground font-mono"
                >
                  {slice.senders.map((s) => maskHandle(s)).join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Volume over the window. */}
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Volume
        </span>
        <span
          data-testid="message-route-sparkline"
          role="img"
          aria-label={`Messages routed per day over the last ${summary.windowDays} days`}
          className="text-(--chart-bar-accent) leading-none"
        >
          <Sparkline data={summary.daily} width={140} height={24} color="currentColor" />
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {perDay.toFixed(1)} / day
        </span>
      </div>

      <div className="space-y-1">
        <p
          data-testid="message-route-footer"
          className="text-xs text-muted-foreground tabular-nums"
        >
          {plural(summary.profiles.length, "profile", "profiles")} ·{" "}
          {plural(summary.sessionCount, "session", "sessions")} ·{" "}
          {plural(summary.total, "message", "messages")}
        </p>
        {summary.atCap && (
          <p className="text-xs text-muted-foreground">
            Read capped — earlier messages in this window exist but are not
            counted above.
          </p>
        )}
      </div>
    </div>
  );
}
