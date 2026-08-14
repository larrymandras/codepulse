/**
 * Studio — the media gallery page (Phase 118, plan 118-10).
 *
 * The fourth Seiðr Suite surface (D-16), following the exact page skeleton
 * `Galdr.tsx`/`Bifrost.tsx` establish: `PageHeader` + Search in the actions
 * slot, a `SectionErrorBoundary` wrapping a LOCAL error-boundary class
 * (because a throwing `useQuery` unmounts the subtree it lives in — the same
 * reason `Galdr.tsx`'s `PromptsErrorBoundary` exists), and the UI-SPEC's
 * verbatim empty-state copy.
 *
 * D-02 (no lightbox, no original-file fetch) and D-07 (provenance-absent
 * rows render "No provenance recorded") are realized on the card itself
 * (`MediaCard.tsx`). The Gallery tab filters client-side over the single
 * `api.media.list` subscription via `applyStudioFilters` — no filter is ever
 * pushed into the Convex query. The Trash tab is deliberately flatter: only
 * Search, no chips/Selects, per the UI-SPEC's Filter Contract.
 */
import { Component, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { Images } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/PageHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MasonryGrid } from "@/components/studio/MasonryGrid";
import { MediaCard, type MediaRow } from "@/components/studio/MediaCard";
import {
  MediaDetailSheet,
  type MediaDetailRow,
} from "@/components/studio/MediaDetailSheet";
import {
  StudioFilterBar,
  applyStudioFilters,
  matchesStudioSearch,
  DEFAULT_STUDIO_FILTERS,
  type StudioFilterState,
} from "@/components/studio/StudioFilterBar";

const ERROR_COPY =
  "Couldn't load media — check your connection and try again.";

// The one new copy element this phase adds beyond the Galdr/Bifröst
// precedent — Studio has an asynchronous host-side ingest step (the
// watcher), so the ≤5-minute latency must be visible rather than implied as
// instant.
const SYNC_CAPTION =
  "Auto-syncs every 5 min · run /studio-sync for an instant sync";

/**
 * Renders the UI-SPEC error copy instead of the generic boundary text. A
 * Convex `useQuery` that throws does so during render, which unmounts the
 * whole subtree — so the only way to keep the failure scoped to this region
 * is a boundary around the component that calls the hook (same shape as
 * `Galdr.tsx`'s `PromptsErrorBoundary`).
 */
class MediaErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-muted-foreground border-border rounded-md border p-8 text-center text-sm">
          {ERROR_COPY}
        </div>
      );
    }
    return this.props.children;
  }
}

function GallerySkeleton() {
  return (
    <div
      data-testid="studio-loading-skeleton"
      className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="mb-4 break-inside-avoid">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/** Distinct from `No media yet` (the table itself is empty): filters/search
 * are active and simply match nothing. Confusing the two would tell the
 * operator the vault is empty when it is merely filtered. */
function ZeroMatchState() {
  return (
    <div
      data-testid="studio-zero-match"
      className="text-muted-foreground border-primary/20 bg-primary/5 rounded border border-dashed py-8 text-center font-mono text-sm tracking-widest"
    >
      [ NO MEDIA MATCHES ]
    </div>
  );
}

/**
 * `media.styleId` is an id reference and no read path resolves it to a name,
 * so the detail Sheet's `Style` row is resolved here against the same
 * `api.media.listStyles` subscription the Styles panel renders from — one
 * subscription, one source of truth. A `styleId` pointing at a row that is
 * gone resolves to `undefined`, which the Sheet renders as the D-07 sentinel
 * like any other absent field (never a dangling id shown as if it were a
 * style name).
 */
function useStyleNames(): Map<string, string> {
  const styles = useQuery(api.media.listStyles);
  return useMemo(() => {
    const map = new Map<string, string>();
    if (Array.isArray(styles)) {
      for (const style of styles as Array<{ _id: string; name: string }>) {
        if (style?._id && style?.name) map.set(style._id, style.name);
      }
    }
    return map;
  }, [styles]);
}

function GalleryTab({ search }: { search: string }) {
  // Repo convention: tolerate `undefined` during loading, but keep the
  // loading signal itself (`data === undefined`) so "still loading" and
  // "loaded but genuinely empty" render differently — collapsing them with a
  // bare `?? []` would leave a permanent skeleton next to an honestly-empty
  // table (the exact Phase 114 defect this plan's dispatch calls out).
  const data = useQuery(api.media.list);
  const isLoading = data === undefined;
  const rows = (data?.rows ?? []) as MediaRow[];

  const [filters, setFilters] = useState<StudioFilterState>(DEFAULT_STUDIO_FILTERS);
  const [selected, setSelected] = useState<MediaDetailRow | null>(null);
  const toggleStar = useMutation(api.media.toggleStar);
  const styleNames = useStyleNames();

  const visible = useMemo(
    () => applyStudioFilters(rows, filters, search),
    [rows, filters, search]
  );

  if (isLoading) return <GallerySkeleton />;

  // Table-empty state (D-13 greenfield — this is the default state on day
  // one, not an edge case): the gate on `rows.length`, never `visible.length`,
  // is what keeps this distinct from the filters-active zero-match state.
  if (rows.length === 0) {
    return (
      <div
        data-testid="studio-empty-gallery"
        className="border-primary/20 bg-primary/5 rounded border border-dashed p-10 text-center"
      >
        <p className="text-foreground mb-1 text-lg font-bold">No media yet</p>
        <p className="text-muted-foreground text-sm">
          Generate something with <code className="font-mono">/studio-generate</code>,
          or drop files into <code className="font-mono">media-vault\gen\</code> — new
          media appears within 5 minutes (or run{" "}
          <code className="font-mono">/studio-sync</code> for an instant sync).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StudioFilterBar
        rows={rows}
        search={search}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {visible.length === 0 ? (
        <ZeroMatchState />
      ) : (
        <MasonryGrid
          rows={visible}
          renderCard={(row) => (
            <MediaCard
              key={row._id}
              row={row}
              onOpen={() => setSelected(row as MediaDetailRow)}
              onToggleStar={() => void toggleStar({ id: row._id as never })}
            />
          )}
        />
      )}

      <MediaDetailSheet
        row={selected}
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        styleName={
          selected?.styleId ? styleNames.get(selected.styleId) : undefined
        }
      />
    </div>
  );
}

function TrashTab({ search }: { search: string }) {
  const data = useQuery(api.media.listTrash);
  const isLoading = data === undefined;
  const rows = (data?.rows ?? []) as MediaRow[];
  // Restore itself is a Sheet-footer action (the detail panel below), never a
  // card control — the UI-SPEC's Trash View Contract places it there. The
  // star toggle is the one write this tab's card grid performs.
  const toggleStar = useMutation(api.media.toggleStar);
  const [selected, setSelected] = useState<MediaDetailRow | null>(null);
  const styleNames = useStyleNames();

  // Trash tab is deliberately flatter than Gallery: Search alone, no chips,
  // no Selects, no Styles/Models panels — it is a structurally different
  // list (UI-SPEC's Trash View Contract), not a filtered view of the same
  // rows.
  const visible = useMemo(
    () => rows.filter((r) => matchesStudioSearch(r, search)),
    [rows, search]
  );

  if (isLoading) return <GallerySkeleton />;

  if (rows.length === 0) {
    return (
      <div
        data-testid="studio-empty-trash"
        className="border-primary/20 bg-primary/5 rounded border border-dashed p-10 text-center"
      >
        <p className="text-foreground mb-1 text-lg font-bold">Trash is empty</p>
        <p className="text-muted-foreground text-sm">
          Deleted media appears here for 30 days before it's permanently removed.
        </p>
      </div>
    );
  }

  if (visible.length === 0) return <ZeroMatchState />;

  return (
    <>
      <MasonryGrid
        rows={visible}
        renderCard={(row) => (
          <MediaCard
            key={row._id}
            row={row}
            trashVariant
            // Card click still opens the detail Sheet (read-only recipe
            // view); the Sheet's action row swaps Move to Trash for Restore
            // via `trashVariant` below.
            onOpen={() => setSelected(row as MediaDetailRow)}
            onToggleStar={() => void toggleStar({ id: row._id as never })}
          />
        )}
      />

      <MediaDetailSheet
        row={selected}
        open={selected !== null}
        trashVariant
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        styleName={
          selected?.styleId ? styleNames.get(selected.styleId) : undefined
        }
      />
    </>
  );
}

export default function Studio() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"gallery" | "trash">("gallery");

  return (
    <div className="p-6">
      <PageHeader
        title="Studio"
        icon={Images}
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media..."
            className="w-64"
            aria-label="Search media"
          />
        }
      />

      <p className="text-muted-foreground mb-4 font-mono text-xs">{SYNC_CAPTION}</p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "gallery" | "trash")}>
        <TabsList>
          <TabsTrigger value="gallery" data-testid="studio-tab-gallery">
            Gallery
          </TabsTrigger>
          <TabsTrigger value="trash" data-testid="studio-tab-trash">
            Trash
          </TabsTrigger>
        </TabsList>

        <SectionErrorBoundary name="Media">
          <MediaErrorBoundary>
            <TabsContent value="gallery">
              <GalleryTab search={search} />
            </TabsContent>
            <TabsContent value="trash">
              <TrashTab search={search} />
            </TabsContent>
          </MediaErrorBoundary>
        </SectionErrorBoundary>
      </Tabs>
    </div>
  );
}
