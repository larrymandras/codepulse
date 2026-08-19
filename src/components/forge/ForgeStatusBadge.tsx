/**
 * ForgeStatusBadge — re-skinned port of forge StatusBadge.tsx.
 *
 * D-07 (Phase 122) badge law: emphasis is keyed to a TIER, not to whether a
 * status happens to carry the `error` semantic. Four tiers (see
 * 122-BADGE-LAW.md §3 for the full per-entry table):
 *   - Strong (filled): failed, auth_failed
 *   - Quiet (bordered, coloured or neutral): running, stopped, queued,
 *     pending, stopping_pending, unknown-status fallback
 *   - Quietest (flat, no colour, no border): completed, expired
 *
 * SC#4 preserved: auth_failed MUST be visually distinct from failed. Both
 * are now Strong (filled) tier, so the distinction moves from
 * quiet-vs-filled to WHICH colour fills:
 *   - auth_failed: --status-warn fill + --primary-foreground text + KeyRound icon
 *   - failed:      --status-error-fill + --status-error-on-fill + XCircle icon
 * `ForgeStatusBadge.test.tsx`'s SC#4 guard proves this as a paired control:
 * auth_failed's class string must carry the warn fill and NOT the error
 * fill, while failed's must carry the error fill and NOT the warn fill.
 *
 * D-06: `failed`'s pairing was measured sub-AA (3.92:1 on dark themes)
 * against its old translucent dark-red bg (60% opacity) paired with
 * text-[var(--status-error)] — a fill whose contrast depended on which
 * theme's --card sat behind it. Corrected
 * to the opaque --status-error-fill/--status-error-on-fill pair (122-03),
 * whose contrast is fixed regardless of theme because an opaque colour
 * fully covers whatever is behind it. Measured, all four exposed themes,
 * in 122-BADGE-LAW.md §8 / 122-10-SUMMARY.md, with an old-pairing control
 * proving the probe can report a failure.
 *
 * D-15: `completed` and `stopped` are relabelled to their spine words below.
 * Five states keep their own distinct label because there is no honest
 * spine-word mapping for them — see the per-entry comments below and
 * `120-BADGE-INVENTORY.md` §4.
 *
 * Colors: forge's inline style={{ backgroundColor, color }} replaced with
 * Tailwind token classes per UI-SPEC Status Color Table (D-09). No
 * hardcoded palette class (zinc/slate/etc.) remains — 122's corpus census.
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
  // executing yet) — keeps its own label. Quiet tier (D-07: "queued" named
  // directly). Detokenized: zinc-700/zinc-400 -> border-border/muted-foreground.
  queued: {
    label: "Queued",
    className: "border border-border text-muted-foreground bg-transparent",
    Icon: Clock,
  },
  // D-15 spine word. Quiet tier (D-07: "running" named directly).
  running: {
    label: "Running",
    className: "border border-[var(--status-info)]/40 text-[var(--status-info)] bg-transparent",
    Icon: Loader2,
  },
  // D-15 spine word (relabelled by this phase; the pre-120 label read like
  // the field name itself, which is exactly what the spine-word law fixes).
  // Quietest tier (D-07: "succeeded, completed" named directly) — flattens
  // from the quiet-ok border treatment to the flat administrative look.
  completed: {
    label: "Succeeded",
    className: "text-muted-foreground bg-transparent",
    Icon: CheckCircle,
  },
  // D-06/D-07: the highest-severity badge in the app, Strong (filled) tier.
  // Corrected pairing (122-03): opaque --status-error-fill/-on-fill, not
  // the old sub-AA translucent dark-red fill. Measured 122-BADGE-LAW.md §8.
  failed: {
    label: "Failed",
    className: "bg-[var(--status-error-fill)] text-[var(--status-error-on-fill)]",
    Icon: XCircle,
  },
  // D-15 spine word (relabelled by this phase). Quiet tier -- parallels the
  // shared component's `cancelled`. Detokenized: zinc-600/zinc-500 ->
  // border-border/muted-foreground.
  stopped: {
    label: "Cancelled",
    className: "border border-border text-muted-foreground bg-transparent",
    Icon: Square,
  },
  // D-15 exception: `auth_failed` cannot honestly map to Failed — it is a
  // distinct condition (credentials, not a run failure). D-07: moves from
  // quiet to STRONG (filled) — it is operator-actionable and the design
  // review's contrast correction means the remaining concern is relative
  // salience, not legibility. Distinctness from `failed` (SC#4) is now
  // carried by WHICH fill (warn vs error), not quiet-vs-filled.
  // Foreground: `--primary-foreground` (a dark near-black token already
  // used app-wide for text on a saturated/bright fill), NOT the app's
  // other sanctioned solid-warn-fill idiom (`text-(--foreground)`, used by
  // IdeationRow.tsx:30/InboxCard.tsx:98/etc.) -- that pairing was measured
  // and rejected here: light --foreground text on the bright --status-warn
  // amber fill rasterises to ~1.4-1.8:1, far below AA. See
  // 122-BADGE-LAW.md §8 for the full measurement including that rejected
  // candidate.
  auth_failed: {
    label: "Auth Failed",
    className: "bg-[var(--status-warn)] text-[var(--primary-foreground)]",
    Icon: KeyRound,
  },
  // Phase 80 — cloud command-bridge states (UI-SPEC §Color status ramp)
  // D-15 exception: `pending` cannot honestly map to Running — the command
  // has not started executing yet, it is queued. Quiet tier, parallels
  // `queued`. Detokenized: zinc-700 -> border-border; text-primary kept
  // (already token-driven).
  pending: {
    label: "Queued…",
    className: "border border-border text-primary bg-transparent",
    Icon: Loader2,
  },
  // D-15 exception: `stopping_pending` cannot honestly map to the terminal
  // "stopped" spine word — the stop has not completed yet. Quiet tier
  // (D-07: "stopping" named directly).
  stopping_pending: {
    label: "Stopping…",
    className: "border border-[var(--status-warn)]/30 text-[var(--status-warn)] bg-transparent",
    Icon: Loader2,
  },
  // D-15 exception: `expired` is a distinct terminal state (never ran /
  // timed out waiting) — mapping it to either terminal spine word would
  // misstate why the job ended. Quietest tier (administrative/inactive
  // terminal state — the faintest treatment in this file, unchanged in
  // spirit). Detokenized and flattened: zinc-800/zinc-600 (bordered) ->
  // flat text-muted-foreground, no border.
  expired: {
    label: "Expired",
    className: "text-muted-foreground bg-transparent",
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
      className: "border border-border text-muted-foreground bg-transparent",
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
