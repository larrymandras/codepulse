/**
 * MediaCard — the masonry card, per 118-UI-SPEC.md § "Media Card Contract"
 * (Phase 118, plan 118-10).
 *
 * D-07's control pair lives here: the "No provenance recorded" badge renders
 * on the card ITSELF, bottom-left, whenever `hasProvenance` is false — not
 * only in the (later) detail panel — so a complete-recipe item and a
 * no-provenance item are distinguishable in the same grid view without
 * opening either.
 *
 * D-02: nothing here references `row.absPath` as an image `src` or builds a
 * fetchable URL from it. The only pixels the browser ever fetches are the
 * bounded `thumbnailUrl` the server already resolved (`convex/media.ts`'s
 * `resolveThumbnailUrl`, the D-01 single source of truth).
 *
 * A null/empty `thumbnailUrl`, or an `<img onError>`, renders the UI-SPEC's
 * dashed-border `ImageOff` fallback — never a broken `<img>`, never a
 * silently blank card ("absent signal renders as absent", the same rule
 * `Bifrost.tsx`'s `livenessOf` establishes). The row stays clickable and
 * star-able either way; only the pixel preview is missing.
 */
import { useState } from "react";
import { AudioLines, ImageOff, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MediaRow {
  _id: string;
  filename: string;
  /**
   * D-02: a plain copy-to-clipboard string only. Nothing in this file may
   * use it as an image `src`, build a URL from it, or render a full-size
   * viewer — the only pixels the browser fetches are `thumbnailUrl` below.
   */
  absPath: string;
  mediaType: string; // "image" | "video" | "audio"
  kind: string; // "gen" | "ref" | "style"
  model?: string;
  provider?: string;
  prompt?: string;
  project?: string;
  starred?: boolean;
  hasProvenance: boolean;
  thumbnailUrl: string | null;
  width?: number;
  height?: number;
  createdAt: number;
  deletedAt?: number;
  daysUntilPurge?: number;
}

interface MediaCardProps {
  row: MediaRow;
  onOpen: () => void;
  onToggleStar: () => void;
  /**
   * Trash View Contract: dimmed thumbnail (`opacity-60`, deliberately not
   * grayscale — grayscale would fight with broken-thumbnail detection,
   * since a broken thumbnail is already colorless) and a purge-countdown
   * caption replace the type/model row. Wired by plan 118-10's Task 3 (the
   * Trash tab); the prop exists here so the card supports both views from
   * one implementation.
   */
  trashVariant?: boolean;
}

function ThumbnailFallback({
  testId,
  dimmed = false,
}: {
  testId: string;
  dimmed?: boolean;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "aspect-video flex flex-col items-center justify-center gap-1 border border-dashed border-border bg-muted/30 text-muted-foreground",
        dimmed && "opacity-60"
      )}
    >
      <ImageOff className="h-6 w-6" />
      <span className="text-xs">Thumbnail unavailable</span>
    </div>
  );
}

function AudioPlaceholder({
  filename,
  testId,
  dimmed = false,
}: {
  filename: string;
  testId: string;
  dimmed?: boolean;
}) {
  // Same box shape as ThumbnailFallback but border-SOLID, not dashed — this
  // is an expected state, not a failure, and must not read as an error.
  return (
    <div
      data-testid={testId}
      className={cn(
        "aspect-video flex flex-col items-center justify-center gap-1 border border-solid border-border bg-muted/30 text-muted-foreground",
        dimmed && "opacity-60"
      )}
    >
      <AudioLines className="h-6 w-6" />
      <span className="truncate px-2 text-xs">{filename}</span>
    </div>
  );
}

export function MediaCard({
  row,
  onOpen,
  onToggleStar,
  trashVariant = false,
}: MediaCardProps) {
  const [broken, setBroken] = useState(false);
  const noProvenance = !row.hasProvenance;
  const isAudio = row.mediaType === "audio";

  // Inline aspect-ratio placeholder BEFORE the image loads, to prevent
  // layout jump — only when the row actually carries dimensions (Layout
  // Contract, same reason Skeleton components elsewhere reserve space).
  const aspectStyle =
    row.width && row.height
      ? { aspectRatio: `${row.width} / ${row.height}` }
      : undefined;

  return (
    <Card
      data-testid={`studio-media-card-${row._id}`}
      className="mb-4 gap-0 overflow-hidden break-inside-avoid py-0"
    >
      <div className="relative cursor-pointer" onClick={onOpen}>
        {/* The trash dimming applies to whichever of the three thumbnail
            states renders, not only to the `<img>` — a trashed row with a
            broken thumbnail must read as trashed too. It stays OFF the star
            overlay, which remains a live control on a trashed row. */}
        {isAudio ? (
          <AudioPlaceholder
            filename={row.filename}
            testId={`studio-media-audio-${row._id}`}
            dimmed={trashVariant}
          />
        ) : broken || !row.thumbnailUrl ? (
          <ThumbnailFallback
            testId={`studio-media-fallback-${row._id}`}
            dimmed={trashVariant}
          />
        ) : (
          <div style={aspectStyle}>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <img
              src={row.thumbnailUrl}
              alt={row.filename}
              className={cn("h-auto w-full", trashVariant && "opacity-60")}
              onError={() => setBroken(true)}
            />
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-testid={`studio-media-star-${row._id}`}
          aria-label={`Toggle favorite ${row.filename}`}
          className="bg-background/70 absolute top-2 right-2 rounded-full p-1 backdrop-blur-sm hover:bg-background/70"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
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

        {noProvenance && (
          <Badge
            data-testid={`studio-media-provenance-badge-${row._id}`}
            className="absolute bottom-2 left-2"
          >
            No provenance recorded
          </Badge>
        )}
      </div>

      <CardContent className="space-y-1 p-3">
        <p
          className="cursor-pointer truncate text-sm font-semibold"
          onClick={onOpen}
        >
          {row.filename}
        </p>
        {trashVariant ? (
          <p
            data-testid={`studio-media-purge-caption-${row._id}`}
            className={cn(
              "text-xs",
              (row.daysUntilPurge ?? 99) <= 3
                ? "text-[var(--status-error)]"
                : "text-muted-foreground"
            )}
          >
            Deletes automatically in {row.daysUntilPurge ?? "?"} days
          </p>
        ) : (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Badge variant="outline">{row.mediaType}</Badge>
            {row.model && <span className="font-mono">{row.model}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
