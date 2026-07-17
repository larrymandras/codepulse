/**
 * useIntakeFeed — the intake state that used to live inside IntakePanel
 * (Phase 07-02, CP-06), lifted to a hook so IntakeStrip, IntakeSheet, and
 * IntakeModal can share ONE instance owned by Skills.tsx. The Sheet unmounts
 * its content when closed; pendingLocal/fileName memory must survive that.
 *
 * Reconciliation is simpler than ForgePage's launch/stop pattern: there is no
 * second forgeJobs table for intake — a pendingLocal row is dropped once ANY
 * server row shares its commandId, since the server row IS the terminal
 * state for intake.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntakeCommandsRaw } from "@/hooks/useIntake";
import type { IntakeCommandRow } from "@/hooks/useIntake";

/** Display cap applied AFTER merge — pendingLocal rows can transiently push
 * the total above the server's already-20-capped listIntakeCommands result. */
const DISPLAY_LIMIT = 20;

/** Dedupe by commandId — the local optimistic row (listed first) wins. */
function dedupeByCommandId(rows: IntakeCommandRow[]): IntakeCommandRow[] {
  const seen = new Set<string>();
  const out: IntakeCommandRow[] = [];
  for (const row of rows) {
    if (seen.has(row.commandId)) continue;
    seen.add(row.commandId);
    out.push(row);
  }
  return out;
}

/** Formats a millisecond duration as "m:ss" for the queued-row countdown. */
export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Strips the github.com host prefix for a compact row label. */
function extractRepoLabel(url: string): string {
  return url.replace(/^https?:\/\/github\.com\//, "");
}

export interface IntakeFeed {
  rows: IntakeCommandRow[];
  isLoading: boolean;
  activeCount: number;
  labelFor: (row: IntakeCommandRow) => string;
  handleEnqueued: (row: IntakeCommandRow) => void;
  handleEnqueueFailed: (commandId: string, message: string) => void;
}

export function useIntakeFeed(): IntakeFeed {
  // Distinguish "still loading" (undefined) from "no commands yet" ([]) so
  // consumers can show Skeleton rows instead of the empty-state copy (WR-01).
  const raw = useIntakeCommandsRaw();
  // Stable identity: raw ?? [] would allocate a fresh [] every render while
  // loading, churning the reconciliation effect below (deps [serverCommands])
  // into an infinite update loop.
  const serverCommands = useMemo(() => raw ?? [], [raw]);

  const [pendingLocal, setPendingLocal] = useState<IntakeCommandRow[]>([]);

  // Session-scoped commandId -> fileName memory. Server rows always carry
  // fileName: null (07-01's documented client-only contract); without this an
  // upload row's label would fall through to "Unknown" once the server row
  // replaces the optimistic one. Session-scoped by design.
  const fileNameMemory = useRef<Record<string, string>>({});

  const handleEnqueued = useCallback((row: IntakeCommandRow) => {
    if (row.fileName !== null) {
      fileNameMemory.current[row.commandId] = row.fileName;
    }
    setPendingLocal((prev) => [row, ...prev]);
  }, []);

  const handleEnqueueFailed = useCallback((commandId: string, message: string) => {
    setPendingLocal((prev) =>
      prev.map((r) =>
        r.commandId === commandId
          ? { ...r, status: "failed" as const, error: message }
          : r
      )
    );
  }, []);

  // Drop a pendingLocal row once ANY server row shares its commandId.
  useEffect(() => {
    setPendingLocal((prev) =>
      prev.filter((r) => !serverCommands.some((s) => s.commandId === r.commandId))
    );
  }, [serverCommands]);

  const rows = useMemo(
    () =>
      dedupeByCommandId([...pendingLocal, ...serverCommands]).slice(
        0,
        DISPLAY_LIMIT
      ),
    [pendingLocal, serverCommands]
  );

  const isLoading = raw === undefined && pendingLocal.length === 0;

  const activeCount = useMemo(
    () =>
      rows.filter(
        (r) => r.status === "pending" || r.status === "queued" || r.status === "executing"
      ).length,
    [rows]
  );

  const labelFor = useCallback(
    (row: IntakeCommandRow): string =>
      row.fileName ??
      fileNameMemory.current[row.commandId] ??
      (row.githubUrl
        ? `${extractRepoLabel(row.githubUrl)}${row.subpath ? " " + row.subpath : ""}`
        : "Unknown"),
    []
  );

  return { rows, isLoading, activeCount, labelFor, handleEnqueued, handleEnqueueFailed };
}

/** 1 Hz tick for the queued-row countdown, gated so an idle list never ticks.
 * Lives with its consumer (IntakeSheet) so the page doesn't re-render each second. */
export function useCountdownNow(rows: IntakeCommandRow[]): number {
  const hasQueuedRow = rows.some((r) => r.status === "queued");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasQueuedRow) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasQueuedRow]);
  return now;
}
