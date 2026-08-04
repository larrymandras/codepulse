import { useMemo, useState } from "react";
import { SectionHeader } from "./SectionHeader";
import MetricCard from "./MetricCard";
import { FlexBarChart, type StackedSegment } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { ScrollArea } from "./ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { formatDurationMs } from "../lib/formatters";
import { useToolUsageOverTime, useToolUsageByTool } from "../hooks/useToolUsage";

// D-02 — the four filter options in this order; the widest option's label
// spells out every source rather than a bare "All" (the exact mistake D-02
// exists to prevent).
const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "astridr", label: "Ástríðr" },
  { value: "claude-code", label: "Claude Code" },
  { value: "gateway", label: "Gateway" },
  { value: "all", label: "All sources" },
];

type WindowKey = "24h" | "7d" | "30d";
const WINDOW_HOURS: Record<WindowKey, number> = { "24h": 24, "7d": 168, "30d": 720 };
const WINDOW_LABEL: Record<WindowKey, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};
const WINDOW_OPTIONS: WindowKey[] = ["24h", "7d", "30d"];

// Copied from ToolExecutionPanel.tsx:19-40 (module-local there) rather than
// imported, per this plan's own instruction — do not refactor that file.
function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-0.5 rounded-sm border font-mono uppercase tracking-widest transition-colors ${
        active
          ? "bg-primary/20 text-primary border-primary"
          : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

function formatHourLabel(bucketStart: number): string {
  return new Date(bucketStart * 1000).toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
  });
}

function formatSuccessRate(rate: number | null): string {
  return rate === null ? "n/a" : `${Math.round(rate * 100)}%`;
}

export default function ToolUsagePanel() {
  // D-02: the source filter defaults to Ástríðr — never the widest option —
  // so an operator never lands on a mixed ranking by accident.
  const [source, setSource] = useState<string>("astridr");
  const [windowKey, setWindowKey] = useState<WindowKey>("7d");
  const windowHours = WINDOW_HOURS[windowKey];

  const byTool = useToolUsageByTool(source, windowHours);
  const overTime = useToolUsageOverTime(source, windowHours);

  const truncated = byTool.truncated || overTime.truncated;

  const frequencyChartData = useMemo(
    () =>
      byTool.rows.map((row) => ({
        label: row.toolName.length > 14 ? row.toolName.slice(0, 14) + "..." : row.toolName,
        segments: [
          { value: Math.max(row.calls - row.failures, 0), color: "var(--status-ok)", label: "Success" },
          { value: row.failures, color: "var(--status-error)", label: "Failed" },
        ] satisfies StackedSegment[],
      })),
    [byTool.rows]
  );

  const overTimeChartData = useMemo(
    () =>
      overTime.buckets.map((bucket) => ({
        label: formatHourLabel(bucket.bucketStart),
        segments: [
          {
            value: Math.max(bucket.calls - bucket.failures, 0),
            color: "var(--status-ok)",
            label: "Success",
          },
          { value: bucket.failures, color: "var(--status-error)", label: "Failed" },
        ] satisfies StackedSegment[],
      })),
    [overTime.buckets]
  );

  const isEmpty = byTool.rows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Truncation notice (D-12) — top of the section, not buried in a tooltip. */}
      {truncated && (
        <div
          className="text-sm rounded-md px-3 py-2"
          style={{
            color: "var(--status-warn)",
            border: "1px solid color-mix(in srgb, var(--status-warn) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--status-warn) 12%, transparent)",
          }}
        >
          Showing a capped slice of the aggregate history — older buckets aren&apos;t loaded.
        </div>
      )}

      {/* Source filter (D-02) + window selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <ToggleGroup
          type="single"
          value={source}
          onValueChange={(next) => {
            if (next) setSource(next);
          }}
          aria-label="Tool source"
          variant="outline"
        >
          {SOURCE_OPTIONS.map((opt) => {
            const disabled = byTool.sources.length > 0 && opt.value !== "all" && !byTool.sources.includes(opt.value);
            return (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                disabled={disabled}
                title={disabled ? `No ${opt.label} tool calls in this window` : undefined}
                className="text-xs font-mono uppercase tracking-widest data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=on]:border-primary"
              >
                {opt.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        <div className="flex items-center gap-1.5">
          {WINDOW_OPTIONS.map((key) => (
            <PillButton key={key} active={windowKey === key} onClick={() => setWindowKey(key)}>
              {key}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Summary strip — primary visual anchor (UI-SPEC Visual Hierarchy) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Tool Calls" value={byTool.totals.calls} />
        <MetricCard label="Failures" value={byTool.totals.failures} />
        <MetricCard label="Success Rate" value={formatSuccessRate(byTool.totals.successRate)} />
        <MetricCard label="Distinct Tools" value={byTool.rows.length} />
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
          <p className="text-sm font-semibold text-foreground">No tool calls yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Ástríðr&apos;s tool calls will appear here once the agent loop runs — no refresh needed.
          </p>
        </div>
      ) : (
        <>
          {/* Per-tool frequency + success/fail chart */}
          <div>
            <SectionHeader
              title="Per-Tool Frequency & Success/Failure"
              action={
                <InfoTooltip text="Reads hourly aggregates, so this survives the 14-day raw-call prune. The source filter defaults to Ástríðr." />
              }
            />
            <div className="h-[220px]" data-testid="tool-usage-frequency-chart">
              <FlexBarChart data={frequencyChartData} height="100%" />
            </div>
          </div>

          {/* Over-time series */}
          <div>
            <SectionHeader
              title={`${WINDOW_LABEL[windowKey]} · hourly`}
              action={<InfoTooltip text="Every hour boundary in the window is shown, including hours with zero calls." />}
            />
            <div className="h-[220px]" data-testid="tool-usage-over-time-chart">
              <FlexBarChart data={overTimeChartData} height="100%" />
            </div>
          </div>

          {/* Per-tool table */}
          <ScrollArea className="h-[300px] pr-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tool</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Failures</TableHead>
                  <TableHead>Success rate</TableHead>
                  <TableHead>Avg duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byTool.rows.map((row) => (
                  <TableRow key={row.toolName}>
                    <TableCell className="font-mono">{row.toolName}</TableCell>
                    <TableCell>{row.source}</TableCell>
                    <TableCell>{row.calls}</TableCell>
                    <TableCell>{row.failures}</TableCell>
                    <TableCell>{formatSuccessRate(row.successRate)}</TableCell>
                    <TableCell>
                      {typeof row.avgDurationMs === "number" ? formatDurationMs(row.avgDurationMs) : "n/a"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
