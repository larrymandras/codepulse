interface ErrorFallbackProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorFallback({
  message = "Failed to load data",
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="bg-gray-800/50 border border-red-500/50 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-red-400 text-sm">!</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-300">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors flex-shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
