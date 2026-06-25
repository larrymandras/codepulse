/**
 * ListeningIndicatorPill — persistent "VOICE ACTIVE" indicator shown in the top bar
 * while voice mode is ON and the wake-word engine is ready.
 *
 * Modeled on the existing "Astridr Runtime Telemetry" pill in DashboardLayout.tsx
 * (lines 651-656), but using py-1 (4-point grid) instead of the off-grid py-1.5.
 *
 * Visibility guard lives in the parent (DashboardLayout) — this component always
 * renders its pill markup; the parent conditionally mounts it.
 *
 * Accessibility: a visually-hidden aria-live="polite" span announces the state
 * to screen readers when the pill appears.
 *
 * prefers-reduced-motion: the `voice-listening-dot` class handles the static
 * fallback via an override in src/index.css.
 *
 * @see 92-PATTERNS.md §ListeningIndicatorPill.tsx (lines 476-500)
 * @see 92-UI-SPEC.md §"Listening indicator pill"
 */

export function ListeningIndicatorPill() {
  return (
    <div
      className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-primary/10 border border-primary/20 shadow-[var(--glow-xs)]"
      aria-hidden="true"
    >
      <span
        className="voice-listening-dot w-2 h-2 rounded-full bg-primary animate-pulse shadow-[var(--glow-md)]"
      />
      <span className="text-[10px] font-semibold font-mono tracking-widest text-primary uppercase">
        VOICE ACTIVE
      </span>
      {/* Visually-hidden live region for screen readers */}
      <span
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        Voice mode active, listening for Hey Ástríðr
      </span>
    </div>
  );
}
