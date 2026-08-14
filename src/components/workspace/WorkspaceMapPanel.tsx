/**
 * WorkspaceMapPanel — the D-09 side panel for a selected workspace-map node.
 *
 * Opens as a `Sheet` (`side="right"`) whenever a node is clicked. Every field
 * is read directly off the already-computed `WorkspaceMapNode` (produced
 * solely by `layoutNodes`, `src/lib/workspaceMapLayout.ts`, plan 114-07) —
 * this component computes NEITHER the direct nor the rolled-up figures
 * itself, exactly per D-04/D-09's "the panel computes neither" rule.
 *
 * Privacy (D-15): gated on `usePrivacy().enabled && maskPaths`, NEVER on
 * `redact()` alone — `redact` (`usePrivacyMask.ts:39-42`) is gated on
 * `enabled` only, so a bare `redact()` call would mask labels even when the
 * user has left path-masking off specifically. `maskFilePath`/`maskPath`
 * (`src/lib/privacy.ts:9-17`) is deliberately NOT used here: it is a silent
 * no-op on a single-segment string (`parts.length <= 2` returns the input
 * unchanged) and deliberately keeps the first path segment unmasked — but on
 * this map the first segment (the rootId) IS the sensitive thing.
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFileSize } from "@/components/forge/FileBrowser";
import { pluralize, relativeTime } from "@/lib/formatters";
import { usePrivacy } from "@/contexts/PrivacyContext";
import { usePrivacyMask } from "@/hooks/usePrivacyMask";
import { useThemeColors, type ThemeColors } from "@/hooks/useThemeColors";
import type { WorkspaceMapNode } from "@/lib/workspaceMapLayout";

export interface WorkspaceMapPanelProps {
  /** The clicked node, or `null` to render the loading/collapsed-out fallback. */
  node: WorkspaceMapNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Descending-rolled-file-count index of a ROOT node within its department,
   * stable across renders. Only read when `node.kind === "root"` and privacy
   * masking is active. Supplied by the caller (`WorkspaceMapCanvas`, plan
   * 114-09), which already computes this ordering for its own canvas
   * labels — this panel never recomputes it from data it doesn't hold.
   */
  rootIndex?: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function deptColor(department: string, colors: ThemeColors): string {
  switch (department) {
    case "Personal":
      return colors.deptPersonal;
    case "Consulting":
      return colors.deptConsulting;
    case "Work":
      return colors.deptWork;
    default:
      // "Unclassified" and any unrecognized value — must read as muted, not
      // a fifth peer color (114-CONTEXT.md § Claude's Discretion).
      return colors.mutedForeground;
  }
}

function accessLabel(access: string): string {
  return access === "astridr-reachable" ? "Reachable by Ástríðr" : "Local only";
}

/**
 * The panel's displayed header label, applying D-15's masking rule. Root
 * labels become "{department} root {index}" (not a bare placeholder — 53
 * identical placeholders would look broken rather than deliberately
 * redacted). Directory labels (depth >= 1) become the plain `redact()`
 * placeholder. Hub labels (department/center) are never masked.
 */
function displayLabel(
  node: WorkspaceMapNode,
  masked: boolean,
  rootIndex: number | undefined,
  redact: (text: string, placeholder?: string) => string
): string {
  if (!masked) return node.label;
  if (node.kind === "root") return `${node.department} root ${rootIndex ?? 0}`;
  if (node.kind === "dir") return redact(node.label);
  return node.label;
}

/**
 * The expand/leaf hint. `dirCount` is the subtree's total directory count
 * (itself included, `layoutNodes`'s sole production — see
 * `workspaceMapLayout.ts`'s `WorkspaceMapNode.dirCount` doc comment), so
 * `dirCount - 1` is the count of subdirectories this panel does not itself
 * render (whether or not the canvas has them expanded — the panel has no
 * directory listing of its own, so any subtree content is "not shown" here).
 */
function expandHint(node: WorkspaceMapNode): string {
  const remaining = node.dirCount - 1;
  if (remaining <= 0) return "No further subdirectories.";
  const noun = remaining === 1 ? "subdirectory" : "subdirectories";
  return `${remaining} more ${noun} not shown — click the node to expand.`;
}

// ---------------------------------------------------------------------------
// Field rows
// ---------------------------------------------------------------------------

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceMapPanel
// ---------------------------------------------------------------------------

export function WorkspaceMapPanel({ node, open, onOpenChange, rootIndex }: WorkspaceMapPanelProps) {
  const { enabled, maskPaths } = usePrivacy();
  const { redact } = usePrivacyMask();
  const colors = useThemeColors();
  const masked = enabled && maskPaths;

  const isHub = node !== null && (node.kind === "center" || node.kind === "department");
  const label = node ? displayLabel(node, masked, rootIndex, redact) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        {node === null ? (
          <div className="p-4">
            <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono">{label}</SheetTitle>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-4">
              {isHub && node.kind === "department" && (
                <>
                  <FieldRow label="directories" value={String(node.dirCount)} />
                  <FieldRow
                    label="files, total incl. subdirectories"
                    value={String(node.rolled.fileCount)}
                  />
                </>
              )}

              {!isHub && (
                <>
                  <div className="flex items-center gap-2">
                    <Badge
                      className="border-transparent"
                      style={{
                        backgroundColor: deptColor(node.department, colors),
                        color: "var(--background)",
                      }}
                    >
                      {node.department}
                    </Badge>
                    <Badge variant="outline">{accessLabel(node.access)}</Badge>
                  </div>

                  <Separator />

                  <FieldRow
                    label="direct"
                    value={`${pluralize(node.direct.fileCount, "file")} · ${formatFileSize(node.direct.totalSize)}`}
                  />
                  <FieldRow
                    label="total incl. subdirectories"
                    value={`${pluralize(node.rolled.fileCount, "file")} · ${formatFileSize(node.rolled.totalSize)}`}
                  />
                  <FieldRow label="latest activity" value={relativeTime(node.latestMtime)} />

                  {node.direct.withheldCount > 0 && (
                    <div className="flex flex-col gap-1">
                      <FieldRow
                        label="withheld"
                        value={`${pluralize(node.direct.withheldCount, "file")} withheld`}
                      />
                      <p className="text-sm text-muted-foreground">
                        Classified sensitive by the local scanner config — never left this
                        machine. Only the count is recorded, never the name.
                      </p>
                    </div>
                  )}

                  <Separator />

                  <p className="text-sm text-muted-foreground">{expandHint(node)}</p>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default WorkspaceMapPanel;
