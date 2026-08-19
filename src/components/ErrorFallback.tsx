interface ErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorFallback({
  message = "Failed to load data",
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="bg-card/50 border border-red-500/50 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-red-400 text-base">!</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base text-foreground">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-sm bg-muted hover:bg-[var(--surface-3)] text-foreground rounded-lg transition-colors flex-shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
