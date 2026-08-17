/**
 * prefersReducedMotion — the shared matchMedia predicate for gating decorative
 * `animate-pulse` on the user's OS-level reduced-motion preference (D-11, Phase 120).
 *
 * The `?.` optional-call form is NOT stylistic. `src/test/setup.ts` does not mock
 * `window.matchMedia`, and jsdom does not implement it — a non-optional
 * `window.matchMedia(...)` call throws `TypeError: window.matchMedia is not a
 * function` at render time in every test. A helper that defaulted to `true` when
 * it cannot tell would silently strip `animate-pulse` from every existing test
 * that asserts its presence, including
 * `src/components/brains/BrainHeaderBadge.test.tsx`'s in-flight-dot assertion.
 * The safe default here is "motion allowed" (`false`) — the real backstop for
 * actual users who set the OS preference is the global
 * `@media (prefers-reduced-motion: reduce) { animation-duration: 0ms !important }`
 * rule in `src/index.css`, which stops the animation regardless of whether a
 * given call site reads this predicate.
 *
 * KNOWN DUPLICATION (not consolidated here — D-02 forbids refactoring existing
 * call sites in this phase; TOKEN-03 in Phase 122 owns it): five other
 * hand-copies of an equivalent check already exist in this repo —
 * `src/components/control-center/ReadinessPill.tsx:39-41` (the precedent this
 * helper mirrors), `src/components/voice/AvatarAura.tsx:70`,
 * `src/components/voice/ShareScreenToggle.tsx:36`, `src/pages/Chat.tsx:73`, and
 * `src/components/reminders/ReminderList.tsx:136` (a React hook variant with a
 * live `matchMedia` change listener, functionally richer than the other four).
 * This file adds a sixth implementation for NEW gates only; it does not import
 * from or replace any of the five.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}
