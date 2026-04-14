/**
 * HotReloadBar — Status bar with state transitions and spinner/checkmark icons.
 * Phase 04 Plan 04: TM-03 (hot-reload feedback for Config Editor).
 */

import { Loader2, CheckCircle2, XCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HotReloadStatus =
  | "pending"
  | "validating"
  | "applied"
  | "confirmed"
  | "error"
  | null;

interface HotReloadBarProps {
  status: HotReloadStatus;
  errorMessage?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HotReloadBar({ status, errorMessage }: HotReloadBarProps) {
  if (status === null || status === undefined) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 h-6 text-xs transition-opacity duration-200">
      {status === "pending" && (
        <>
          <Loader2 className="animate-spin h-4 w-4" />
          <span className="text-(--muted-foreground)">Sending...</span>
        </>
      )}
      {status === "validating" && (
        <>
          <Loader2 className="animate-spin h-4 w-4" />
          <span className="text-(--status-warn)">Validating...</span>
        </>
      )}
      {status === "applied" && (
        <span className="text-(--status-ok)">Applied.</span>
      )}
      {status === "confirmed" && (
        <>
          <CheckCircle2 className="h-4 w-4 text-(--status-ok)" />
          <span className="text-(--status-ok)">Confirmed by Astrid.</span>
        </>
      )}
      {status === "error" && (
        <>
          <XCircle className="h-4 w-4 text-(--status-error)" />
          <span className="text-(--status-error)">Apply failed: {errorMessage}</span>
        </>
      )}
    </div>
  );
}
