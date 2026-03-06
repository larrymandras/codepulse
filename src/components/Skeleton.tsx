export function SkeletonText({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-700/50 rounded h-4 w-full ${className}`}
    />
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-700/50 rounded-xl h-28 w-full ${className}`}
    />
  );
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-700/50 rounded-xl h-64 w-full ${className}`}
    />
  );
}

export function SkeletonTable({
  rows = 5,
  className = "",
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header row */}
      <div className="flex gap-4">
        <div className="animate-pulse bg-gray-700/50 rounded h-8 flex-1" />
        <div className="animate-pulse bg-gray-700/50 rounded h-8 flex-1" />
        <div className="animate-pulse bg-gray-700/50 rounded h-8 flex-1" />
        <div className="animate-pulse bg-gray-700/50 rounded h-8 flex-[0.5]" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="animate-pulse bg-gray-700/50 rounded h-6 flex-1" />
          <div className="animate-pulse bg-gray-700/50 rounded h-6 flex-1" />
          <div className="animate-pulse bg-gray-700/50 rounded h-6 flex-1" />
          <div className="animate-pulse bg-gray-700/50 rounded h-6 flex-[0.5]" />
        </div>
      ))}
    </div>
  );
}
