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
 * This task (Task 1) builds the shell only: nav entry, route, header, sync
 * caption, Gallery/Trash Tabs, error boundary, loading skeletons and all four
 * empty states. The masonry grid and media card (Task 2) and the filter bar
 * (Task 3) replace the placeholder row list below.
 *
 * D-02 (no lightbox, no original-file fetch) and D-07 (provenance-absent
 * rows render "No provenance recorded") are realized on the card itself in
 * Task 2 — this file only wires the two bounded `api.media` queries and
 * tolerates `undefined` during loading via the repo's `?? []` convention.
 */
import { Component, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { Images } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { PageHeader } from "@/components/PageHeader";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6"
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="mb-4 break-inside-avoid">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function GalleryTab() {
  // Repo convention: tolerate `undefined` during loading, but keep the
  // loading signal itself (`data === undefined`) so "still loading" and
  // "loaded but genuinely empty" render differently — collapsing them with a
  // bare `?? []` would leave a permanent skeleton next to an honestly-empty
  // table (the exact Phase 114 defect this plan's dispatch calls out).
  const data = useQuery(api.media.list);
  const isLoading = data === undefined;
  const rows = data?.rows ?? [];

  if (isLoading) return <GallerySkeleton />;

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

  // Task 2 replaces this placeholder with <MasonryGrid> + <MediaCard>, and
  // Task 3 wires <StudioFilterBar> above it plus the filters-active zero-
  // match "[ NO MEDIA MATCHES ]" state.
  return (
    <div data-testid="studio-gallery-placeholder" className="text-muted-foreground text-sm">
      {rows.length} media row(s) loaded.
    </div>
  );
}

function TrashTab() {
  const data = useQuery(api.media.listTrash);
  const isLoading = data === undefined;
  const rows = data?.rows ?? [];

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

  return (
    <div data-testid="studio-trash-placeholder" className="text-muted-foreground text-sm">
      {rows.length} trashed row(s) loaded.
    </div>
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
              <GalleryTab />
            </TabsContent>
            <TabsContent value="trash">
              <TrashTab />
            </TabsContent>
          </MediaErrorBoundary>
        </SectionErrorBoundary>
      </Tabs>
    </div>
  );
}
