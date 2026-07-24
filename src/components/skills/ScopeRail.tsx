import { Globe, FolderGit2, Archive, type LucideIcon } from "lucide-react";
import { useDraggingSkill } from "@/hooks/usePendingLifecycleMoves";
import { resolveScopeDrop } from "@/lib/skills";

export type ScopeEntryScope = "global" | "project" | "cold";

interface ScopeEntryDef {
  scope: ScopeEntryScope;
  label: string;
  Icon: LucideIcon;
}

// Fixed 3-entry list — never gated on a nonzero count (a user must be able to
// drag into an empty Cold Storage). Icons/labels match DestinationBadge
// (IntakeStatusBadge.tsx:225-229) so the drag targets and status chips agree.
const SCOPE_ENTRIES: ScopeEntryDef[] = [
  { scope: "global", label: "Global", Icon: Globe },
  { scope: "project", label: "Project", Icon: FolderGit2 },
  { scope: "cold", label: "Cold Storage", Icon: Archive },
];

interface ScopeRailProps {
  dropTargetScope: string | null;
  onDragOverScope: (scope: string) => void;
  onDragLeaveScope: () => void;
  onDropOnScope: (scope: string, e: React.DragEvent) => void;
}

/**
 * ScopeRail — a new left-rail section beneath Categories exposing
 * Global / Project / Cold Storage as native HTML5 drop targets (UX-02/D-01).
 * Mirrors CategoryGrid.tsx's row markup, hover, active, and drop-target
 * highlight pattern verbatim, extending it with per-entry VALIDITY derived
 * from the currently-dragged skill via resolveScopeDrop (D-02).
 *
 * Presentational + event-forwarding only — this component calls no mutation.
 * The actual enqueueLifecycle / dialog dispatch lives in the parent
 * (Skills.tsx, Plan 04), exactly as CategoryGrid never calls a mutation
 * itself.
 */
export function ScopeRail({
  dropTargetScope,
  onDragOverScope,
  onDragLeaveScope,
  onDropOnScope,
}: ScopeRailProps) {
  const { draggingSkill } = useDraggingSkill();

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-mono font-bold text-primary/70 uppercase tracking-[0.2em] flex items-center gap-2 pl-2">
        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[var(--glow-xs)]" />
        Scope
      </h2>

      <div className="flex flex-col gap-1 w-full">
        {SCOPE_ENTRIES.map(({ scope, label, Icon }) => {
          const isDropTarget = dropTargetScope === scope;
          const dropResult =
            isDropTarget && draggingSkill ? resolveScopeDrop(draggingSkill, scope) : null;
          const isValid = dropResult?.kind === "enqueue" || dropResult?.kind === "dialog";
          const isInvalid = dropResult?.kind === "reject";
          const hint = dropResult?.kind === "reject" ? dropResult.hint : null;

          return (
            <div key={scope} className="flex flex-col">
              <div
                data-testid="scope-rail-entry"
                data-scope={scope}
                role="button"
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  onDragOverScope(scope);
                }}
                onDragLeave={() => onDragLeaveScope()}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropOnScope(scope, e);
                }}
                className={`group relative flex items-center gap-3 w-full px-3 py-2 rounded transition-all cursor-pointer overflow-hidden border ${
                  isInvalid
                    ? "border-dashed border-destructive/40 bg-destructive/5 cursor-not-allowed"
                    : isValid
                    ? "bg-primary/30 border-dashed border-primary shadow-[var(--glow-sm)]"
                    : "bg-transparent border-transparent hover:bg-accent/50 hover:border-border"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0 text-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-mono font-bold truncate text-foreground group-hover:text-primary transition-colors">
                  {label}
                </span>
              </div>

              {hint && (
                <p className="text-xs font-mono text-destructive px-3 pt-1">{hint}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
