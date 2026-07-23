/**
 * profiles.ts — hoisted persona source (D-08, Phase 99 Plan 01).
 *
 * Single source of truth for the personal/business/consulting persona list.
 * Moved BYTE-IDENTICAL from src/pages/Reminders.tsx:25-36 so Reminders.tsx and
 * every Phase 99 launch surface (Ástríðr persona picker, D-07) import the same
 * PROFILES array instead of drifting duplicate copies. Reminders.tsx now
 * re-exports from here for backward compatibility with existing importers.
 */

export type ProfileId = "personal" | "business" | "consulting";

// Per-profile accent — reuses existing semantic status tokens (never a
// hardcoded hex) so accents stay theme-aware across all 5 data-theme
// variants (101-UI-SPEC.md "Non-negotiable house style"). Mirrors the
// green/amber/blue triad already used for these three profiles in
// ProfileCard.tsx's PROFILE_META, recast as CSS custom properties.
export const PROFILES: { id: ProfileId; label: string; accentVar: string }[] = [
  { id: "personal", label: "Personal", accentVar: "--status-ok" },
  { id: "business", label: "Business", accentVar: "--status-warn" },
  { id: "consulting", label: "Consulting", accentVar: "--status-info" },
];
