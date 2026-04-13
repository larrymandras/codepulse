import { cn } from "@/lib/utils";

interface EntityRowProps {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

export function EntityRow({ icon, primary, secondary, trailing, onClick }: EntityRowProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 border-b border-border last:border-b-0 transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50"
      )}
    >
      <div className="w-4 h-4 shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
      </div>
      {trailing && <div className="shrink-0 text-xs text-muted-foreground">{trailing}</div>}
    </div>
  );
}
