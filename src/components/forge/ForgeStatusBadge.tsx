/**
 * ForgeStatusBadge — re-skinned port of forge StatusBadge.tsx.
 *
 * SC#4 preserved: auth_failed (amber) MUST be visually distinct from failed (red):
 *   - auth_failed: bg-amber-900/60 + text-[var(--status-warn)] + KeyRound + "Auth Failed"
 *   - failed:      bg-red-900/60   + text-[var(--status-error)] + XCircle  + "Failed"
 *
 * Colors: forge's inline style={{ backgroundColor, color }} replaced with
 * Tailwind token classes per UI-SPEC Status Color Table (D-09).
 */

import { Clock, Loader2, CheckCircle, XCircle, Square, KeyRound } from "lucide-react";
import type { JobStatus } from "@/hooks/useForge";

interface StatusConfig {
  label: string;
  /** Merged Tailwind bg + text class string (replaces forge's hex bg/fg) */
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STATUS_MAP: Record<JobStatus, StatusConfig> = {
  queued: {
    label: "Queued",
    className: "bg-zinc-800/60 text-zinc-400",
    Icon: Clock,
  },
  running: {
    label: "Running",
    className: "bg-blue-900/60 text-[var(--status-info)]",
    Icon: Loader2,
  },
  completed: {
    label: "Completed",
    className: "bg-green-900/60 text-[var(--status-ok)]",
    Icon: CheckCircle,
  },
  failed: {
    label: "Failed",
    className: "bg-red-900/60 text-[var(--status-error)]",
    Icon: XCircle,
  },
  stopped: {
    label: "Stopped",
    className: "bg-zinc-800/40 text-zinc-500",
    Icon: Square,
  },
  auth_failed: {
    label: "Auth Failed",
    className: "bg-amber-900/60 text-[var(--status-warn)]",
    Icon: KeyRound,
  },
};

interface ForgeStatusBadgeProps {
  status: JobStatus;
}

export function ForgeStatusBadge({ status }: ForgeStatusBadgeProps) {
  const config = STATUS_MAP[status];

  // data-color-scheme mapping — preserved from forge for test compatibility
  const colorScheme =
    status === "failed"
      ? "red"
      : status === "auth_failed"
        ? "amber"
        : status === "running"
          ? "blue"
          : status === "completed"
            ? "green"
            : status === "queued"
              ? "slate"
              : "stone";

  return (
    <span
      aria-label={status}
      data-status={status}
      data-color-scheme={colorScheme}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.className}`}
    >
      <config.Icon
        className={`h-3 w-3${status === "running" ? " animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
}
