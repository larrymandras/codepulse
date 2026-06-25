import { useState } from "react";
import { useCatalogSearch, useCatalogEntry } from "@/hooks/useCatalog";
import type { CatalogEntry } from "@/lib/astridrApi";
import CatalogFilters from "./CatalogFilters";
import { CatalogCard, BlankAgentCard } from "./CatalogCard";
import { GlassPanel } from "@/components/GlassPanel";
import { X, Loader2, AlertCircle } from "lucide-react";

interface CatalogBrowserProps {
  onSelectEntry: (entry: CatalogEntry) => void;
  embedded?: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded bg-muted/50" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-muted/50" />
          <div className="h-3 w-1/3 rounded bg-muted/50" />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full rounded bg-muted/50" />
        <div className="h-3 w-2/3 rounded bg-muted/50" />
      </div>
      <div className="h-8 w-full rounded bg-muted/50" />
    </div>
  );
}

export default function CatalogBrowser({
  onSelectEntry,
  embedded,
}: CatalogBrowserProps) {
  const { query, setQuery, tier, setTier, results, loading, error } =
    useCatalogSearch();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const {
    entry: previewEntry,
    loading: previewLoading,
    error: previewError,
  } = useCatalogEntry(previewId ?? undefined);

  return (
    <div className={embedded ? "" : "space-y-4"}>
      <CatalogFilters
        query={query}
        onQueryChange={setQuery}
        tier={tier}
        onTierChange={setTier}
      />

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-base">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => {
              setQuery(query);
            }}
            className="ml-auto text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
        <BlankAgentCard onSelect={onSelectEntry} />

        {loading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : results.map((entry) => (
              <CatalogCard
                key={entry.id}
                entry={entry}
                onSelect={onSelectEntry}
                onPreview={(e) => setPreviewId(e.id)}
              />
            ))}
      </div>

      {!loading && !error && results.length === 0 && query && (
        <p className="text-center text-base text-muted-foreground py-8">
          No archetypes found. Try adjusting your search or filters.
        </p>
      )}

      {/* Preview dialog */}
      {previewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <GlassPanel className="relative w-full max-w-lg mx-4 rounded-xl p-6 max-h-[80vh] overflow-auto hover:scale-[1.01] transition-transform duration-300">
            <button
              onClick={() => setPreviewId(null)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {previewLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {previewError && (
              <p className="text-base text-destructive py-4">{previewError}</p>
            )}

            {previewEntry && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {previewEntry.name}
                  </h2>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    {previewEntry.category}
                  </span>
                </div>
                <p className="text-base text-muted-foreground">
                  {previewEntry.description}
                </p>
                {previewEntry.body && (
                  <div className="text-base text-foreground/80 whitespace-pre-wrap border-t border-border/30 pt-3">
                    {previewEntry.body}
                  </div>
                )}
                {previewEntry.source && (
                  <p className="text-sm text-muted-foreground">
                    Source: {previewEntry.source}
                  </p>
                )}
                <div className="flex justify-end pt-2 border-t border-border/30">
                  <button
                    onClick={() => {
                      setPreviewId(null);
                      onSelectEntry(previewEntry);
                    }}
                    className="text-base font-medium bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
                  >
                    Onboard This Agent
                  </button>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
