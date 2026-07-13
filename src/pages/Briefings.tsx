import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import BriefingFeedItem from "../components/BriefingFeedItem";
import LoadMoreButton from "../components/LoadMoreButton";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { PageHeader } from "@/components/PageHeader";

export default function Briefings() {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { results, status, loadMore } = usePaginatedQuery(
    api.briefings.listBriefings,
    {
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { initialNumItems: 20 }
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Briefings" />

      {/* Date range filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-muted-foreground shrink-0">From</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="bg-background border border-input px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-ring/50"
        />
        <label className="text-sm text-muted-foreground shrink-0">To</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="bg-background border border-input px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-ring/50"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Feed */}
      <SectionErrorBoundary name="Briefings Feed">
        <div className="border border-border">
          {status === "LoadingFirstPage" ? (
            <div className="py-12 text-center text-base text-muted-foreground">
              Loading briefings...
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center text-base text-muted-foreground space-y-2">
              <p className="font-medium">No briefings yet</p>
              <p>
                Daily digests generate automatically at 6:00 AM UTC. Session briefings appear here after each completed session.
              </p>
            </div>
          ) : (
            results.map((briefing) => (
              <BriefingFeedItem key={briefing._id} briefing={briefing} />
            ))
          )}
        </div>
        <LoadMoreButton status={status} loadMore={loadMore} pageSize={20} />
      </SectionErrorBoundary>
    </div>
  );
}
