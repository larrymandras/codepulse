import { useState } from "react";
import { Bell } from "lucide-react";
import { Badge } from "./ui/badge";
import InfoTooltip from "./InfoTooltip";
import { ScrollArea } from "./ui/scroll-area";
import { SectionHeader } from "./SectionHeader";
import {
  useToolPolicyEvents,
  useToolPolicyCounts,
  useToolPolicyLastReceived,
  policyKindPresentation,
  POLICY_KIND_ORDER,
  type ToolPolicyEventRow,
  type ToolPolicyLastReceivedResult,
} from "../hooks/useToolPolicyEvents";

/**
 * Copied from ToolExecutionPanel.tsx:19-40 (module-local there) per this
 * plan's own instruction — do not refactor that component. Adds a
 * `disabled` affordance: a kind with zero events in the window still shows
 * its pill (with the zero visible), it just can't be selected — different
 * from a kind being missing from the UI entirely.
 */
function PillButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-xs px-2 py-0.5 rounded-sm border font-mono uppercase tracking-widest transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-primary/20 text-primary border-primary"
          : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * `timestamp` on toolPolicyEvents rows is UNIX SECONDS, not milliseconds —
 * asserted by this file's tests, not assumed. The `1a136dc8` "Delivered
 * 20645d ago" defect was exactly this confusion applied to a different
 * table's webhook badge.
 */
function relativeTimeMagnitude(tsSeconds: number): string {
  const diffSec = Math.max(0, Date.now() / 1000 - tsSeconds);
  if (diffSec < 60) return `${Math.round(diffSec)}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return `${Math.floor(diffSec / 86400)}d`;
}

/**
 * D-07 — the last-received line, rendered in BOTH the populated and empty
 * states. Three distinct on-screen states, never collapsed to two:
 * loading (undefined) stays neutral, never says "never"; a genuine
 * `{ timestamp: null }` is the only path that reads "never received"; a
 * real timestamp reads a relative time.
 */
function lastReceivedLine(result: ToolPolicyLastReceivedResult | undefined): string {
  if (result === undefined) return "Checking…";
  if (result.timestamp === null) {
    return "CodePulse has never received a tool-policy event from Ástríðr.";
  }
  return `Last policy event received ${relativeTimeMagnitude(result.timestamp)} ago.`;
}

/**
 * The empty-state body — three states, matching `lastReceivedLine` above,
 * NOT the two the UI-SPEC copy table's literal example implies. While the
 * query is loading (`undefined`), this must say so and must NOT claim
 * "never received" — that claim is only true once `lastReceivedAt` has
 * actually resolved to `{ timestamp: null }`. A real (non-null) timestamp
 * paired with an empty row list means the current kind filter has zero
 * matches, not that the feed has never received anything — a different,
 * still-honest claim.
 */
function emptyStateBody(result: ToolPolicyLastReceivedResult | undefined): string {
  if (result === undefined) {
    return "Checking whether CodePulse has received any tool-policy events from Ástríðr…";
  }
  if (result.timestamp === null) {
    return "CodePulse has never received a tool-policy event from Ástríðr. Last received: never.";
  }
  return `No policy events match the current filter. Last policy event received ${relativeTimeMagnitude(result.timestamp)} ago.`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground font-medium">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  );
}

/**
 * D-08 detail block — shows ONLY the fields the row actually carries
 * (finding F3). A boot/reload row never shows a "Tool:" line; a leak row's
 * three-state fields (finding F4) never collapse to two.
 */
function RowDetail({ row }: { row: ToolPolicyEventRow }) {
  if (row.event === "tool_call_leaked_as_text") {
    return (
      <div className="ml-5 mt-1 mb-1 p-2 bg-background/50 rounded-lg border border-border/30 text-sm font-mono tracking-wide space-y-1">
        <DetailRow
          label="Tool was offered"
          value={row.toolWasOffered === undefined ? "Unknown" : row.toolWasOffered ? "Yes" : "No"}
        />
        <DetailRow
          label="Tools offered"
          value={
            row.toolsOfferedCount === undefined ? "No tool filter active" : row.toolsOfferedCount
          }
        />
        {row.round !== undefined && <DetailRow label="Round" value={row.round} />}
        {row.agentId !== undefined && <DetailRow label="Agent" value={row.agentId} />}
        {row.taskCategory !== undefined && (
          <DetailRow label="Task category" value={row.taskCategory} />
        )}
        {row.sessionId !== undefined && <DetailRow label="Session" value={row.sessionId} />}
      </div>
    );
  }

  if (row.event === "execution_denied") {
    return (
      <div className="ml-5 mt-1 mb-1 p-2 bg-background/50 rounded-lg border border-border/30 text-sm font-mono tracking-wide space-y-1">
        {row.tool !== undefined && <DetailRow label="Tool" value={row.tool} />}
        {row.sessionId !== undefined && <DetailRow label="Session" value={row.sessionId} />}
      </div>
    );
  }

  if (row.event === "malformed_policy_boot" || row.event === "malformed_policy_reload_rejected") {
    return (
      <div className="ml-5 mt-1 mb-1 p-2 bg-background/50 rounded-lg border border-border/30 text-sm font-mono tracking-wide space-y-1">
        {row.field !== undefined && <DetailRow label="Field" value={row.field} />}
        {row.error !== undefined && (
          <div>
            <span className="text-muted-foreground font-medium">Error:</span>
            <div className="font-mono text-xs whitespace-pre-wrap break-all mt-1">
              {row.error}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Unrecognised kind — render only the fields present, nothing fabricated.
  return (
    <div className="ml-5 mt-1 mb-1 p-2 bg-background/50 rounded-lg border border-border/30 text-sm font-mono tracking-wide space-y-1">
      {row.tool !== undefined && <DetailRow label="Tool" value={row.tool} />}
      {row.sessionId !== undefined && <DetailRow label="Session" value={row.sessionId} />}
    </div>
  );
}

/**
 * OBS-02 policy/leak feed. Self-contained, no required props — plan 105-08
 * mounts this on the Tools page and owns the page-level error-boundary wrap
 * (finding F6: a second one here would catch at the wrong granularity).
 */
export default function ToolPolicyFeed() {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const counts = useToolPolicyCounts();
  const lastReceived = useToolPolicyLastReceived();
  const feed = useToolPolicyEvents(kindFilter === "all" ? undefined : kindFilter, 100);

  const isEmpty = feed.rows.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Tool Policy Events"
        action={
          <InfoTooltip text="Ástríðr's tool-access policy signals: leaked tool calls, denials, and malformed-policy fail-open/fail-safe events." />
        }
      />

      <p className="text-xs font-mono text-muted-foreground">{lastReceivedLine(lastReceived)}</p>

      {feed.truncated && (
        <div
          className="text-sm rounded-md px-3 py-2"
          style={{
            color: "var(--status-warn)",
            border: "1px solid color-mix(in srgb, var(--status-warn) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--status-warn) 12%, transparent)",
          }}
        >
          Showing the most recent {feed.cap} policy events — older events aren&apos;t loaded.
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <PillButton active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
          All kinds
        </PillButton>
        {POLICY_KIND_ORDER.map((kind) => {
          const presentation = policyKindPresentation(kind);
          const count = counts.counts[kind] ?? 0;
          return (
            <PillButton
              key={kind}
              active={kindFilter === kind}
              disabled={count === 0}
              onClick={() => setKindFilter(kind)}
            >
              {presentation.label} ({count})
            </PillButton>
          );
        })}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
          <p className="text-sm font-semibold text-foreground">No policy events yet</p>
          <p className="text-sm text-muted-foreground max-w-md">{emptyStateBody(lastReceived)}</p>
        </div>
      ) : (
        <ScrollArea className="h-[300px] pr-2">
          <div className="space-y-1.5">
            {feed.rows.map((row) => {
              const presentation = policyKindPresentation(row.event);
              const isExpanded = expandedId === row._id;
              return (
                <div key={row._id}>
                  <div
                    className="flex items-start gap-3 bg-background/30 border-l-2 border-transparent hover:border-primary/50 px-3 py-2 cursor-pointer hover:bg-primary/5 transition-all group"
                    onClick={() =>
                      setExpandedId((prev) => (prev === row._id ? null : row._id))
                    }
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        style={{
                          color: presentation.token,
                          borderColor: `color-mix(in srgb, ${presentation.token} 45%, transparent)`,
                        }}
                      >
                        {presentation.label}
                      </Badge>
                      {row.tool !== undefined && (
                        <span className="text-sm font-mono text-foreground truncate">
                          {row.tool}
                        </span>
                      )}
                      {presentation.alerts && (
                        <span className="inline-flex items-center gap-0.5">
                          <Bell className="w-3.5 h-3.5 text-primary/70" aria-label="Also raised an alert" />
                          <InfoTooltip text="This also raised an alert via the existing alert-routing layer" />
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-muted-foreground ml-auto">
                        {relativeTimeMagnitude(row.timestamp)} ago
                      </span>
                    </div>
                  </div>
                  {isExpanded && <RowDetail row={row} />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <p className="text-sm text-muted-foreground">
        This page observes tool behavior. It never disables a tool, changes policy, or blocks a call.
      </p>
    </div>
  );
}
