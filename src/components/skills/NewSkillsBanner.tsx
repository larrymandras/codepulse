interface NewSkillsBannerProps {
  count: number;
  onReview: () => void;
  onAcceptAll: () => void;
}

export function NewSkillsBanner({
  count,
  onReview,
  onAcceptAll,
}: NewSkillsBannerProps) {
  if (count === 0) return null;

  return (
    <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-lg px-4 py-2.5 flex items-center gap-3">
      <span className="text-sm text-indigo-200">
        {count} new skill{count !== 1 ? "s" : ""} auto-categorized.
      </span>
      <button
        onClick={onReview}
        className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        Review
      </button>
      <button
        onClick={onAcceptAll}
        className="text-sm font-medium text-gray-400 hover:text-gray-300 transition-colors"
      >
        Accept All
      </button>
    </div>
  );
}
