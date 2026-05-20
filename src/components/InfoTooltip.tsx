export default function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1.5">
      <span className="w-4 h-4 rounded-full border border-primary/30 text-primary/70 text-[10px] flex items-center justify-center cursor-help group-hover:bg-primary/10 group-hover:text-primary transition-colors">
        i
      </span>
      <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded border border-primary/30 bg-card text-xs text-muted-foreground font-sans normal-case tracking-normal whitespace-normal w-56 text-center opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
        {text}
      </span>
    </span>
  );
}
