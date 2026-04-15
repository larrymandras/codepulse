import { cn } from "@/lib/utils";

interface PingIndicatorProps {
  active?: boolean;
  className?: string;
}

export function PingIndicator({ active = true, className }: PingIndicatorProps) {
  if (!active) return <span className={cn("w-2 h-2 rounded-full bg-muted", className)} />;
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--status-ok) opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-(--status-ok)" />
    </span>
  );
}
