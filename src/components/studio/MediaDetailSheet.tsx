/**
 * MediaDetailSheet — the right-side recipe panel, per 118-UI-SPEC.md
 * § "Media Detail Sheet Contract" (Phase 118, plan 118-11).
 *
 * **This is not the forbidden lightbox (D-02).** The image below is the SAME
 * bounded ≤200 KB thumbnail already rendered in the grid, shown larger at
 * `max-h-80 object-contain` — nothing here ever fetches or renders the
 * original file, and `absPath` is only ever displayed as text or copied to
 * the clipboard. That is exactly why D-02 could forbid a lightbox without
 * making a second HTTP origin load-bearing: the panel that would have needed
 * one never needs one.
 *
 * D-07's control pair lives here at FIELD level (`MediaCard.tsx` carries the
 * card-level half). A populated recipe value renders `text-foreground
 * font-mono` and is NOT italic; an absent one renders the exact string
 * `No provenance recorded` in `text-muted-foreground italic`. The styling
 * difference is the mechanism, not decoration — a reader must be able to tell
 * the two apart at a glance inside a single panel, which is what makes a
 * silent absence impossible to mistake for a real value. Never blank, never
 * `Unknown`, never derived from the filename.
 *
 * D-08's destructive half deliberately takes NO modal confirmation, matching
 * `Bifrost.tsx`'s `onArchive` precedent: the 30-day Trash plus a visible
 * Restore path and a visible countdown is the safety net, and a confirm
 * dialog on an already-reversible action is theatre. The irreversible step
 * belongs to the janitor (`convex/media.ts`'s `pruneTrashBatch`) and this
 * phase ships no manual "delete forever" control at all.
 */
import { Copy, ImageOff, RotateCcw, Star, Trash2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/formatters";
import type { MediaRow } from "./MediaCard";

/** The Sheet reads a few fields the card never renders. Declared here rather
 * than widened onto `MediaRow` so the card's contract stays exactly what the
 * card uses. */
export interface MediaDetailRow extends MediaRow {
  params?: string;
  sizeBytes?: number;
  durationSec?: number;
  /** An id reference, never a display value — the caller resolves it to a
   * name and passes `styleName`. */
  styleId?: string;
}

/** The one sentinel string, shared with the card badge's copy. */
export const NO_PROVENANCE_COPY = "No provenance recorded";

/** A disabled button with an explaining tooltip is the point: an enabled
 * button that copied an empty block would be a silent failure. */
export const NO_RECIPE_TOOLTIP_COPY =
  "No recipe to copy — this file has no sidecar.";

/**
 * D-07's field-level pair. These two class strings MUST differ — that
 * difference IS the mechanism, and `Studio.test.tsx` asserts they differ
 * rather than asserting either one in isolation (a test that only checked the
 * absent case would pass against a component that rendered the sentinel
 * unconditionally).
 */
export const PRESENT_FIELD_CLASS = "text-foreground font-mono";
export const ABSENT_FIELD_CLASS = "text-muted-foreground italic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The grid card's dashed-border `ImageOff` fallback, reproduced here with
 * one deliberate change: a fixed `h-48` instead of the card's `aspect-video`,
 * because the Sheet's thumbnail is bounded by height (`max-h-80`) rather than
 * by the card's column width. Everything else — the dashed border, the muted
 * fill, the icon, the "Thumbnail unavailable" copy — is verbatim
 * `MediaCard.tsx`'s `ThumbnailFallback`, so the two states read identically. */
function DetailThumbFallback() {
  return (
    <div
      data-testid="studio-detail-fallback"
      className="border-border bg-muted/30 text-muted-foreground flex h-48 flex-col items-center justify-center gap-1 border border-dashed"
    >
      <ImageOff className="h-6 w-6" />
      <span className="text-xs">Thumbnail unavailable</span>
    </div>
  );
}

/**
 * One labelled recipe row. `present` is driven by the field's own value, not
 * by the row-level `hasProvenance` boolean — a row can carry a model and no
 * prompt, and each field must tell its own truth.
 */
function RecipeField({
  label,
  value,
  testId,
}: {
  label: string;
  value?: string;
  testId: string;
}) {
  const present = Boolean(value);
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </p>
      <p
        data-testid={testId}
        data-present={present ? "true" : "false"}
        className={cn(
          "text-xs break-words whitespace-pre-wrap",
          present ? PRESENT_FIELD_CLASS : ABSENT_FIELD_CLASS
        )}
      >
        {present ? value : NO_PROVENANCE_COPY}
      </p>
    </div>
  );
}

/**
 * The Copy Recipe payload — one formatted plain-text block sized to paste
 * straight into `/studio-generate`. Absent fields are OMITTED rather than
 * emitted as the sentinel: pasting `prompt: No provenance recorded` into a
 * generator would be worse than pasting nothing.
 */
export function buildRecipeText(
  row: MediaDetailRow,
  styleName?: string
): string {
  const lines: string[] = [];
  if (row.prompt) lines.push(`prompt: ${row.prompt}`);
  if (row.model) lines.push(`model: ${row.model}`);
  if (row.provider) lines.push(`provider: ${row.provider}`);
  if (styleName) lines.push(`style: ${styleName}`);
  if (row.params) lines.push(`params: ${row.params}`);
  return lines.join("\n");
}

/** jsdom and non-secure origins have no `navigator.clipboard`; a missing
 * clipboard must not throw out of a click handler. */
function copyToClipboard(text: string) {
  void navigator.clipboard?.writeText?.(text);
}

export interface MediaDetailSheetProps {
  row: MediaDetailRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trash context: Move to Trash is omitted entirely in favour of Restore. */
  trashVariant?: boolean;
  /** Resolved from `api.media.listStyles` by the caller — `media.styleId` is
   * an id reference, and no read path resolves it to a name. Absent resolves
   * to the D-07 sentinel like any other absent field. */
  styleName?: string;
}

export function MediaDetailSheet({
  row,
  open,
  onOpenChange,
  trashVariant = false,
  styleName,
}: MediaDetailSheetProps) {
  const toggleStar = useMutation(api.media.toggleStar);
  const softDelete = useMutation(api.media.softDelete);
  const restore = useMutation(api.media.restore);

  if (!row) return null;

  // The server's own D-07 derivation, never re-derived here — the filter chip
  // and this button must agree from one source of truth.
  const hasProvenance = row.hasProvenance;
  const recipeText = buildRecipeText(row, styleName);

  const dimensions =
    row.width && row.height
      ? `${row.width} × ${row.height}`
      : row.durationSec
        ? formatDuration(row.durationSec)
        : "—";

  const handleTrash = () => {
    void softDelete({ id: row._id as never });
    // The Sheet closes and the row leaves the Gallery grid immediately —
    // that is the Convex subscription updating, with no host round-trip.
    // D-08's mutation-flags-then-watcher-moves split is what buys this: the
    // file move on disk happens later, asynchronously, and the UI never
    // waits on it.
    onOpenChange(false);
  };

  const handleRestore = () => {
    void restore({ id: row._id as never });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
        data-testid="studio-detail-sheet"
      >
        <SheetHeader>
          <SheetTitle data-testid="studio-detail-filename">
            {row.filename}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-6">
          {/* 1. Thumbnail — bounded, NOT a lightbox (see the file docstring). */}
          {row.thumbnailUrl ? (
            <img
              data-testid="studio-detail-thumb"
              src={row.thumbnailUrl}
              alt={row.filename}
              className="max-h-80 w-full object-contain"
            />
          ) : (
            <DetailThumbFallback />
          )}

          {/* 2. Badges. */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" data-testid="studio-detail-badge-mediatype">
              {row.mediaType}
            </Badge>
            <Badge variant="outline" data-testid="studio-detail-badge-kind">
              {row.kind}
            </Badge>
          </div>

          {/* 3. Recipe block — D-07's field-level control pair. */}
          <div className="space-y-3">
            <RecipeField
              label="Prompt"
              value={row.prompt}
              testId="studio-detail-field-prompt"
            />
            <RecipeField
              label="Model"
              value={row.model}
              testId="studio-detail-field-model"
            />
            <RecipeField
              label="Provider"
              value={row.provider}
              testId="studio-detail-field-provider"
            />
            <RecipeField
              label="Style"
              value={styleName}
              testId="studio-detail-field-style"
            />
            <RecipeField
              label="Project"
              value={row.project}
              testId="studio-detail-field-project"
            />
            <RecipeField
              label="Params"
              value={row.params}
              testId="studio-detail-field-params"
            />
          </div>

          {/* 4. Technical facts. */}
          <div className="space-y-2">
            <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
              <span data-testid="studio-detail-dimensions">{dimensions}</span>
              <span data-testid="studio-detail-size">
                {row.sizeBytes === undefined ? "—" : formatBytes(row.sizeBytes)}
              </span>
              <span data-testid="studio-detail-created">
                {new Date(row.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-start gap-2">
              {/* D-02: `absPath` is displayed text and clipboard text only. It
                  is never an `<img src>`, never an `<a href>`, and no URL is
                  ever built from it. */}
              <p
                data-testid="studio-detail-abspath"
                className="text-muted-foreground min-w-0 flex-1 font-mono text-xs break-all"
              >
                {row.absPath}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="studio-detail-copy-path"
                onClick={() => copyToClipboard(row.absPath)}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Path
              </Button>
            </div>
            {trashVariant && row.daysUntilPurge !== undefined && (
              <p
                data-testid="studio-detail-purge-caption"
                className={cn(
                  "text-xs",
                  row.daysUntilPurge <= 3
                    ? "text-[var(--status-error)]"
                    : "text-muted-foreground"
                )}
              >
                Deletes automatically in {row.daysUntilPurge} days
              </p>
            )}
          </div>
        </div>

        {/* 5. Actions row — same layout as PromptEditorDrawer.tsx:328. */}
        <SheetFooter className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {hasProvenance ? (
              <Button
                type="button"
                variant="default"
                data-testid="studio-detail-copy-recipe"
                onClick={() => copyToClipboard(recipeText)}
              >
                Copy Recipe
              </Button>
            ) : (
              // A `disabled` button swallows pointer events, so the Radix
              // trigger has to sit on a wrapper the pointer can still reach.
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      data-testid="studio-detail-copy-recipe-wrap"
                    >
                      <Button
                        type="button"
                        variant="default"
                        disabled
                        data-testid="studio-detail-copy-recipe"
                      >
                        Copy Recipe
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent data-testid="studio-detail-copy-recipe-tooltip">
                    {NO_RECIPE_TOOLTIP_COPY}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {trashVariant ? (
              <Button
                type="button"
                variant="outline"
                data-testid="studio-detail-restore"
                onClick={handleRestore}
              >
                <RotateCcw className="h-4 w-4" />
                Restore
              </Button>
            ) : (
              // Deliberately `ghost`, not `destructive`, and deliberately no
              // modal confirmation of any kind — see the file docstring.
              <Button
                type="button"
                variant="ghost"
                data-testid="studio-detail-trash"
                onClick={handleTrash}
              >
                <Trash2 className="text-muted-foreground h-4 w-4" />
                Move to Trash
              </Button>
            )}
          </div>

          {/* The ONE icon-only control in this row (UI-SPEC's icon-only table). */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-testid="studio-detail-star"
            aria-label={`Toggle favorite ${row.filename}`}
            onClick={() => void toggleStar({ id: row._id as never })}
          >
            <Star
              className="h-4 w-4"
              style={
                row.starred
                  ? { fill: "var(--status-warn)", color: "var(--status-warn)" }
                  : undefined
              }
            />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
