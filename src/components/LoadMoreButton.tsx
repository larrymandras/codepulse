import { Loader2 } from "lucide-react";

interface LoadMoreButtonProps {
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  loadMore: (numItems: number) => void;
  pageSize?: number;
}

export default function LoadMoreButton({ status, loadMore, pageSize = 25 }: LoadMoreButtonProps) {
  if (status === "Exhausted" || status === "LoadingFirstPage") return null;

  return (
    <div className="flex justify-center mt-4 mb-2">
      {status === "LoadingMore" ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <button
          onClick={() => loadMore(pageSize)}
          className="text-base text-muted-foreground underline-offset-4 hover:underline"
        >
          Load more ({pageSize})
        </button>
      )}
    </div>
  );
}
