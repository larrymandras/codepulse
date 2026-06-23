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
    <div className="bg-primary/5 border border-primary/30 rounded-lg px-4 py-3 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.1)] relative overflow-hidden">
      {/* Subtle scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="w-full h-[1px] animate-scanline bg-primary" />
      </div>

      <div className="flex items-center gap-3 relative z-10">
        <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        <span className="text-base text-primary font-mono font-bold tracking-widest uppercase relative z-10">
        {count} new skill{count !== 1 ? "s" : ""} auto-categorized.
      </span>
      </div>
      
      <div className="flex items-center gap-4 relative z-10">
        <button
          onClick={onReview}
          className="text-xs font-mono tracking-widest uppercase font-bold text-primary hover:text-primary/70 transition-colors"
        >
          [ Review ]
        </button>
        <button
          onClick={onAcceptAll}
          className="text-xs font-mono tracking-widest uppercase font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          [ Accept All ]
        </button>
      </div>
    </div>
  );
}
