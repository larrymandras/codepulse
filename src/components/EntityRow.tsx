import { cn } from "@/lib/utils";

interface EntityRowProps {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** When true, the primary text wraps to 2 lines (line-clamp) instead of single-line truncate. */
  wrapPrimary?: boolean;
}

export function EntityRow({ icon, primary, secondary, trailing, onClick, wrapPrimary }: EntityRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex gap-3 px-3 py-2.5 border-b border-border last:border-b-0 transition-colors",
        wrapPrimary ? "items-start" : "items-center",
        onClick && "cursor-pointer hover:bg-accent/50"
      )}
    >
      <div className={cn("w-4 h-4 shrink-0 text-muted-foreground", wrapPrimary && "mt-0.5")}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p title={wrapPrimary ? undefined : primary} className={cn("text-sm font-medium", wrapPrimary ? "line-clamp-2" : "truncate")}>{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
      </div>
      {trailing && <div className="shrink-0 text-xs text-muted-foreground">{trailing}</div>}
    </div>
  );
}
