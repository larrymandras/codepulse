import { Star } from "lucide-react";

/** The single-select smart-view + scope filter that replaces the origin dropdown. */
export type SkillChip =
  | "all"
  | "favorites"
  | "mostused"
  | "unused"
  | "recent"
  | "global"
  | "project"
  | "cold";

const CHIPS: ReadonlyArray<{ id: SkillChip; label: string; star?: boolean }> = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites", star: true },
  { id: "mostused", label: "Most used" },
  { id: "unused", label: "Unused" },
  { id: "recent", label: "Recently added" },
  { id: "global", label: "Global" },
  { id: "project", label: "Project" },
  { id: "cold", label: "Cold" },
];

interface SkillFilterChipsProps {
  active: SkillChip;
  counts: Record<SkillChip, number>;
  onSelect: (chip: SkillChip) => void;
}

/**
 * SkillFilterChips — a single-select filter row for the Skills overview
 * (control-surface redesign). Replaces the origin `<select>` with discoverable
 * one-tap smart views (Favorites / Most-used / Unused / Recently-added) and
 * scope buckets (Global / Project / Cold). Presentational only — the parent
 * owns the active state and does the actual filtering.
 */
export function SkillFilterChips({ active, counts, onSelect }: SkillFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter skills">
      {CHIPS.map(({ id, label, star }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            data-testid={`skill-chip-${id}`}
            aria-pressed={isActive}
            onClick={() => onSelect(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-mono font-bold transition-all ${
              isActive
                ? "border-primary bg-primary/15 text-primary shadow-[var(--glow-xs)]"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {star && (
              <Star
                aria-hidden="true"
                className={`w-3 h-3 ${isActive ? "fill-primary" : "fill-amber-400 text-amber-400"}`}
              />
            )}
            {label}
            <span className={`text-[10px] tabular-nums ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              {counts[id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
