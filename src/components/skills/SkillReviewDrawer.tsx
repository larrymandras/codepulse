import { useState } from "react";
import OriginBadge from "@/components/OriginBadge";
import { hasKnownUpstream, isDormant, type SkillLike } from "@/lib/skills";

type ReviewSkill = SkillLike & {
  displayName: string;
  description?: string;
  categoryName: string | null;
  categoryDisplayName: string | null;
  categoryIcon: string;
  isAutoAssigned: boolean;
};

interface SkillReviewDrawerProps {
  skills: ReviewSkill[];
  categories: Array<{ name: string; displayName: string; icon: string }>;
  onAccept: (skillName: string) => void;
  onMove: (skillName: string, categoryName: string) => void;
  onHide: (skillName: string) => void;
  onAcceptAll: () => void;
  onClose: () => void;
}

/**
 * The queue behind [REVIEW]. Shows each auto-categorized skill with the category the
 * classifier guessed, so ACCEPT ALL is an informed choice rather than a blind one.
 */
export function SkillReviewDrawer({
  skills,
  categories,
  onAccept,
  onMove,
  onHide,
  onAcceptAll,
  onClose,
}: SkillReviewDrawerProps) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (name: string, fn: () => void | Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } finally {
      setBusy((b) => (b === name ? null : b));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Review auto-categorized skills"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-primary/30 bg-background p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-mono text-lg font-bold uppercase tracking-widest text-primary">
              Review Auto-Categorized
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {skills.length === 0
                ? "Nothing pending."
                : `${skills.length} skill${skills.length === 1 ? "" : "s"} were categorized by prefix. Accept, move, or hide each.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-border px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            Close
          </button>
        </div>

        {skills.length > 0 && (
          <button
            onClick={onAcceptAll}
            className="mb-4 w-full rounded border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
          >
            Accept all {skills.length}
          </button>
        )}

        <ul className="flex flex-col gap-3">
          {skills.map((s) => (
            <li
              key={s.name}
              className="rounded-lg border border-border bg-card p-3"
              aria-busy={busy === s.name}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm text-foreground">{s.displayName}</span>
                    {(s.origins ?? []).map((o) => (
                      <OriginBadge key={o} origin={o} />
                    ))}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {s.description || "No description."}
                  </p>
                  <p className="mt-1 text-[10px] font-mono text-muted-foreground">
                    {s.categoryIcon} {s.categoryDisplayName ?? s.categoryName ?? "uncategorized"}
                    {isDormant(s) && " · dormant, not loaded"}
                    {!hasKnownUpstream(s) && " · no upstream, cannot check updates"}
                  </p>
                </div>

                <div className="flex flex-shrink-0 items-center gap-2">
                  <select
                    aria-label={`Move ${s.displayName} to category`}
                    value={s.categoryName ?? ""}
                    disabled={busy === s.name}
                    onChange={(e) => e.target.value && run(s.name, () => onMove(s.name, e.target.value))}
                    className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value="">move to…</option>
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.icon} {c.displayName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => run(s.name, () => onAccept(s.name))}
                    disabled={busy === s.name}
                    className="rounded border border-primary/40 px-2 py-1 font-mono text-xs uppercase text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => run(s.name, () => onHide(s.name))}
                    disabled={busy === s.name}
                    className="rounded border border-border px-2 py-1 font-mono text-xs uppercase text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Hide
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
