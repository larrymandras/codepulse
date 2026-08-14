/**
 * StylesPanel — the curated `mediaStyles` presets, per 118-UI-SPEC.md
 * § "Collapsible Panels — Styles & Models" (Phase 118, plan 118-11).
 *
 * Default COLLAPSED, sitting between the filter bar and the masonry grid.
 * The card grid here is deliberately FIXED-ASPECT and uniform, NOT masonry:
 * this is a curated table of a handful of presets, not a content feed, and
 * packing it variable-height would imply it is the same kind of surface as
 * the gallery below it.
 *
 * D-12: read-only. There is no create or edit UI here and none may be added
 * — style cards are seeded only by the agent after an actual proven run, so
 * a preset authored blind in the browser could describe a pipeline that has
 * never once worked.
 */
import { ImageOff } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";

export interface MediaStyleRow {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  thumbnailUrl?: string | null;
}

export function StylesPanel() {
  const data = useQuery(api.media.listStyles);
  const rows = (Array.isArray(data) ? data : []) as MediaStyleRow[];

  return (
    // No `defaultOpen` and no controlled `open` — Radix `Collapsible` starts
    // CLOSED, which is the UI-SPEC's requirement. Adding `defaultOpen` here
    // would push the grid below the fold on every visit.
    <Collapsible data-testid="studio-styles-panel">
      <CollapsibleTrigger
        data-testid="studio-styles-trigger"
        className="text-muted-foreground hover:text-foreground font-mono text-xs font-bold tracking-widest uppercase"
      >
        {`Styles (${rows.length})`}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {rows.length === 0 ? (
          <p
            data-testid="studio-styles-empty"
            className="text-muted-foreground mt-2 text-sm"
          >
            No style presets yet.
          </p>
        ) : (
          <div
            data-testid="studio-styles-grid"
            className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
          >
            {rows.map((style) => (
              <Card
                key={style._id}
                data-testid={`studio-style-card-${style._id}`}
                className="gap-0 overflow-hidden py-0"
              >
                {style.thumbnailUrl ? (
                  <img
                    src={style.thumbnailUrl}
                    alt={style.name}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  // Same "absent signal renders as absent" placeholder the
                  // main grid uses — covers both an absent `previewMediaId`
                  // and a dangling one, which `listStyles` already collapses
                  // to a null `thumbnailUrl` server-side.
                  <div
                    data-testid={`studio-style-fallback-${style._id}`}
                    className="border-border bg-muted/30 text-muted-foreground flex aspect-square flex-col items-center justify-center gap-1 border border-dashed"
                  >
                    <ImageOff className="h-5 w-5" />
                    <span className="text-xs">Thumbnail unavailable</span>
                  </div>
                )}
                <CardContent className="space-y-0.5 p-2">
                  <p className="truncate text-xs font-semibold">{style.name}</p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {style.slug}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
