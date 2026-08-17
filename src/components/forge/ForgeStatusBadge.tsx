/**
 * ForgeStatusBadge — re-skinned port of forge StatusBadge.tsx.
 *
 * POLISH-05 / D-16 badge law: only `failed` renders filled. Every other
 * status is a quiet chip (text token + low-opacity border, no bg fill).
 *
 * SC#4 preserved: auth_failed MUST be visually distinct from failed. Under
 * the quiet law the distinction is carried by the TOKEN, not by a fill
 * colour word:
 *   - auth_failed: --status-warn token + quiet border + KeyRound icon
 *   - failed:      the one filled entry below + --status-error token + XCircle icon
 * `ForgeStatusBadge.test.tsx`'s SC#4 guard proves this as a paired control:
 * auth_failed's class string must contain --status-warn and NOT --status-error,
 * while failed's must contain --status-error and NOT --status-warn.
 *
 * D-15: `completed` and `stopped` are relabelled to their spine words below.
 * Five states keep their own distinct label because there is no honest
 * spine-word mapping for them — see the per-entry comments below and
 * `120-BADGE-INVENTORY.md` §4.
 *
 * Colors: forge's inline style={{ backgroundColor, color }} replaced with
 * Tailwind token classes per UI-SPEC Status Color Table (D-09).
 */

import { Clock, Loader2, CheckCircle, XCircle, Square, KeyRound, Circle } from "lucide-react";
import type { JobStatus } from "@/hooks/useForge";

interface StatusConfig {
  label: string;
  /** Merged Tailwind bg + text class string (replaces forge's hex bg/fg) */
  className: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STATUS_MAP: Record<JobStatus, StatusConfig> = {
  // D-15 exception: `queued` cannot honestly map to Running (nothing is
  // executing yet) — keeps its own label.
  queued: {
    label: "Queued",
    className: "border border-zinc-700 text-zinc-400 bg-transparent",
    Icon: Clock,
  },
  // D-15 spine word.
  running: {
    label: "Running",
    className: "border border-[var(--status-info)]/40 text-[var(--status-info)] bg-transparent",
    Icon: Loader2,
  },
  // D-15 spine word (relabelled by this phase; the pre-120 label read like
  // the field name itself, which is exactly what the spine-word law fixes).
  completed: {
    label: "Succeeded",
    className: "border border-[var(--status-ok)]/40 text-[var(--status-ok)] bg-transparent",
    Icon: CheckCircle,
  },
  // D-16: the ONE status that stays filled.
  failed: {
    label: "Failed",
    className: "bg-red-900/60 text-[var(--status-error)]",
    Icon: XCircle,
  },
  // D-15 spine word (relabelled by this phase).
  stopped: {
    label: "Cancelled",
    className: "border border-zinc-600 text-zinc-500 bg-transparent",
    Icon: Square,
  },
  // D-15 / SC#4 exception: `auth_failed` cannot honestly map to Failed —
  // it is a distinct condition (credentials, not a run failure) and must
  // stay visually distinct from `failed`. Distinctness is now carried by
  // --status-warn vs --status-error, not by an amber-vs-red fill.
  auth_failed: {
    label: "Auth Failed",
    className: "border border-[var(--status-warn)]/40 text-[var(--status-warn)] bg-transparent",
    Icon: KeyRound,
  },
  // Phase 80 — cloud command-bridge states (UI-SPEC §Color status ramp)
  // D-15 exception: `pending` cannot honestly map to Running — the command
  // has not started executing yet, it is queued.
  pending: {
    label: "Queued…",
    className: "border border-zinc-700 text-primary bg-transparent",
    Icon: Loader2,
  },
  // D-15 exception: `stopping_pending` cannot honestly map to the terminal
  // "stopped" spine word — the stop has not completed yet.
  stopping_pending: {
    label: "Stopping…",
    className: "border border-[var(--status-warn)]/30 text-[var(--status-warn)] bg-transparent",
    Icon: Loader2,
  },
  // D-15 exception: `expired` is a distinct terminal state (never ran /
  // timed out waiting) — mapping it to either terminal spine word would
  // misstate why the job ended.
  expired: {
    label: "Expired",
    className: "border border-zinc-800 text-zinc-600 bg-transparent",
    Icon: Clock,
  },
};

interface ForgeStatusBadgeProps {
  status: JobStatus;
}

export function ForgeStatusBadge({ status }: ForgeStatusBadgeProps) {
  // `status` is typed JobStatus, but it originates from a v.string() column
  // adapted via an unchecked cast — the daemon can emit a value outside the
  // union. Fall back to a neutral chip showing the raw status instead of
  // dereferencing an undefined config and crashing the list region.
  const config: StatusConfig =
    (STATUS_MAP[status] as StatusConfig | undefined) ?? {
      label: status || "Unknown",
      className: "border border-zinc-700 text-zinc-400 bg-transparent",
      Icon: Circle,
    };

  // data-color-scheme mapping — preserved from forge for test compatibility
  const colorScheme =
    status === "failed"
      ? "red"
      : status === "auth_failed" || status === "stopping_pending"
        ? "amber"
        : status === "running"
          ? "blue"
          : status === "completed"
            ? "green"
            : status === "queued"
              ? "slate"
              : status === "pending"
                ? "emerald"
                : "stone";

  return (
    <span
      aria-label={status}
      data-status={status}
      data-color-scheme={colorScheme}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${config.className}`}
    >
      <config.Icon
        className={`h-3 w-3${
          status === "running" ||
          status === "pending" ||
          status === "stopping_pending"
            ? " animate-spin"
            : ""
        }`}
      />
      {config.label}
    </span>
  );
}
