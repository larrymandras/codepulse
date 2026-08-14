/**
 * WorkspaceCoverageStrip — the always-visible D-14 header strip above the
 * workspace-map canvas: scan time, roots covered, withheld count, and
 * unclassified count, escalating to `--status-warn` treatment only when a
 * specific honesty flag degrades.
 *
 * Four healthy chips always render, in this fixed order, and never reorder
 * or disappear. Degraded chips APPEND at the end — this stability is the
 * exact property D-14 was chosen for (a bar that only renders on failure is
 * a bar nobody has ever seen; an always-visible bar whose shape stays
 * familiar makes a degraded one legible when it appears).
 *
 * Chip 4 (unclassified) NEVER escalates, at any count — 23 of 53 real roots
 * being Unclassified is expected and correct per Phase 115 D-15/D-16, not a
 * fault, so no threshold is ever applied to it.
 *
 * `isScanStale` is exported as a pure, injectable-`now` predicate (no
 * internal `Date.now()`) specifically so Task 3's boundary suite can drive
 * it directly without mocking the system clock.
 */

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { WorkspaceMapData } from "@/hooks/useWorkspaceMap";

// ---------------------------------------------------------------------------
// Staleness predicate — pure, epoch SECONDS in, explicit `now` (ms) in.
// ---------------------------------------------------------------------------

/**
 * `generatedAt` is epoch SECONDS (convex/schema.ts:2400,
 * src/test/projectGraphFixture.ts:145-147's established convention — NOT
 * milliseconds). `nowMs` is epoch milliseconds (i.e. `Date.now()`), so the
 * comparison converts `nowMs` DOWN to seconds before diffing — exactly one
 * conversion, never neither, and never the other direction (multiplying
 * `generatedAtSeconds` up to ms here would still work arithmetically, but
 * this repo's convention — schema.ts:2400, projectGraphFixture.ts:145-147 —
 * treats epoch seconds as the comparison unit). A missing/inverted
 * conversion yields 1970 dates and a threshold that passes vacuously; the
 * boundary suite (Task 3) proves the interpretation is correct rather than
 * assuming it.
 *
 * Threshold: strictly greater than 36 hours since `generatedAt` — exactly
 * 36h is NOT stale (exclusive boundary), 36h + 1s IS stale. Expressed in
 * SECONDS, matching `generatedAtSeconds`'s own unit.
 */
const STALE_THRESHOLD_SECONDS = 36 * 60 * 60;

export function isScanStale(generatedAtSeconds: number, nowMs: number): boolean {
  const nowSeconds = nowMs / 1000;
  return nowSeconds - generatedAtSeconds > STALE_THRESHOLD_SECONDS;
}

// ---------------------------------------------------------------------------
// Relative-time formatting for the scan-time chip. Renders unconditionally
// regardless of staleness — the reader always sees the raw number, per
// UI-SPEC's Claude's Discretion note on the staleness threshold.
// ---------------------------------------------------------------------------

function formatRelativeTime(generatedAtSeconds: number, nowMs: number): string {
  const diffMs = nowMs - generatedAtSeconds * 1000;
  const diffMinutes = Math.round(diffMs / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Chip primitive
// ---------------------------------------------------------------------------

interface StripChipProps {
  text: string;
  warn?: boolean;
}

function StripChip({ text, warn = false }: StripChipProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 font-mono text-xs",
        warn &&
          "border-[var(--status-warn)] text-[var(--status-warn)] bg-[var(--status-warn)]/10"
      )}
    >
      {warn && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
      {text}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceCoverageStrip
// ---------------------------------------------------------------------------

export interface WorkspaceCoverageStripProps {
  /** The getWorkspaceMap payload, or undefined while the query is loading. */
  data: WorkspaceMapData | undefined;
  /** Injectable clock for tests; defaults to the real Date.now(). */
  now?: number;
}

export function WorkspaceCoverageStrip({ data, now }: WorkspaceCoverageStripProps) {
  const nowMs = now ?? Date.now();

  if (data === undefined) {
    return (
      <Card className="flex flex-row flex-wrap items-center gap-2 px-6 py-4">
        <Skeleton className="h-6 w-32 rounded-full" />
        <Skeleton className="h-6 w-40 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-40 rounded-full" />
      </Card>
    );
  }

  const {
    generatedAt,
    coveredRoots,
    rootCount,
    scannedRootsComplete,
    totalWithheldFiles,
    unclassifiedRootIds,
    accessDerivationOk,
    localConfigStatus,
  } = data;

  const stale = isScanStale(generatedAt, nowMs);
  const relativeTime = formatRelativeTime(generatedAt, nowMs);

  // Chip 1 — scan time. Escalates to warn + "— overdue" once stale (D-17).
  const scanTimeText = stale ? `Scanned ${relativeTime} — overdue` : `Scanned ${relativeTime}`;

  // Chip 2 — roots covered. Escalates to warn + "— scan incomplete" when the
  // walk did not finish (D-16 flag 1).
  const rootsCoveredText = scannedRootsComplete
    ? `${coveredRoots.length}/${rootCount} roots covered`
    : `${coveredRoots.length}/${rootCount} roots covered — scan incomplete`;

  // Chip 3 — withheld files. Never escalates on its own; count-only per the
  // schema's side-channel rule.
  const withheldText = `${totalWithheldFiles} files withheld`;

  // Chip 4 — unclassified roots. NEVER escalates, at any count (D-14/D-16).
  const unclassifiedText = `${unclassifiedRootIds.length} roots unclassified`;

  return (
    <Card className="flex flex-row flex-wrap items-center gap-2 px-6 py-4">
      <StripChip text={scanTimeText} warn={stale} />
      <StripChip text={rootsCoveredText} warn={!scannedRootsComplete} />
      <StripChip text={withheldText} />
      <StripChip text={unclassifiedText} />

      {/* Degraded chips APPEND at the end — never reorder the healthy four. */}
      {!accessDerivationOk && (
        <StripChip
          text="Access data unreliable — compose parse failed, every directory shown as local-only"
          warn
        />
      )}
      {localConfigStatus === "absent" && (
        <StripChip text="No local classification config — departments may be stale" warn />
      )}
      {localConfigStatus === "version-mismatch" && (
        <StripChip
          text="Classification config changed since last scan — departments may be stale"
          warn
        />
      )}
    </Card>
  );
}

export default WorkspaceCoverageStrip;
