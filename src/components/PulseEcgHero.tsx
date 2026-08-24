/**
 * PulseEcgHero.tsx — the Pulse ECG hero (SIGNAL-02, Phase 125 Plan 09).
 *
 * D-09: this is the Dashboard's headline number, replacing the deleted top
 * card's synthetic `100 - errorRate*2` composite. D-12: an eyebrow plus one
 * 40px numeral. D-17: the numeral is a live-WS-only 60s count, and it is
 * withheld — never shown as a partial figure — while the window is filling
 * (`"loading"`) or the socket is down (`"unavailable"`); those are two
 * different causes and get two different admissions, exactly as D-08 splits
 * unavailable from idle on the trace itself.
 *
 * No props: 125-11 mounts this with none. Renders UNDER the Dashboard's own
 * `PageHeader`, not instead of it.
 */
import { usePulseWindow } from "@/hooks/usePulseWindow";
import { PulseEcgCanvas } from "@/components/PulseEcgCanvas";
import { METRIC_STATE_COPY } from "@/lib/metricState";
import { Skeleton } from "@/components/ui/skeleton";

// House eyebrow class string, copied verbatim from DashboardLayout.tsx's
// section-label span so this reads identically to every other eyebrow in
// the shell. Weight 600 (`font-semibold`), not 500 — 500 was explicitly
// struck a phase ago and its reappearance here would be a regression, not a
// choice (124-UI-SPEC.md:79, DashboardLayout.tsx's own live class string).
const EYEBROW_CLASS =
  "text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export default function PulseEcgHero() {
  const { blips, feedState, liveCount, countState, backfillTruncated } = usePulseWindow();

  return (
    <div
      className="rounded-lg border border-border bg-card p-6"
      data-backfill-truncated={backfillTruncated ? "true" : "false"}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className={EYEBROW_CLASS}>PULSE / 60s</span>
        {backfillTruncated && (
          // D-05/T-125-09-08: the server declares its cap via `truncated`;
          // swallowing it here would reinstate the silent cap one layer
          // above the fix. Affects the TRACE only -- it must never change
          // which numeral treatment renders (the numeral is live-WS-only
          // under D-17, unaffected by a capped backfill).
          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            backfill capped at 500 events
          </span>
        )}
      </div>

      <div className="mt-2 flex h-10 items-end">
        {countState === "ready" && (
          // 40px and the weight are both fixed by the sketch and both off
          // Tailwind's default scale -- explicit arbitrary values
          // (`text-[40px]`, `font-[300]`) rather than a named weight
          // utility, same discipline the 40px figure itself already needs.
          <span
            aria-live="polite"
            aria-label={`${liveCount ?? 0} events in the trailing 60 seconds`}
            className="font-mono text-[40px] font-[300] tabular-nums leading-none text-foreground"
            style={{ letterSpacing: "-0.02em" }}
          >
            {liveCount}
          </span>
        )}
        {countState === "loading" && (
          // D-17's cost: the 60s window has not filled yet since mount or
          // the last reconnect, so the count would be partial. A
          // numeral-shaped skeleton in the same 40px box -- never the word
          // "Loading", never an em dash, never a zero (a zero would be a
          // false measurement, not an admission of absence).
          <Skeleton aria-live="polite" aria-label="Pulse count loading" className="h-10 w-20" />
        )}
        {countState === "unavailable" && (
          // The socket is down -- there is no window at all, a different
          // cause from "loading" and so a different admission. Copy read
          // from the shared six-state vocabulary rather than typed in.
          <span
            aria-live="polite"
            className="text-[13px] italic"
            style={{ opacity: 0.55, color: "var(--muted-foreground)" }}
          >
            {METRIC_STATE_COPY.unavailable.label}
          </span>
        )}
      </div>

      <div className="mt-4">
        <PulseEcgCanvas blips={blips} feedState={feedState} />
      </div>
    </div>
  );
}
