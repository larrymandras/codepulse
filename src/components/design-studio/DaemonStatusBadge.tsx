import { useState, useEffect } from "react";
import { checkHealth } from "@/lib/openDesignApi";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DaemonStatus = "connecting" | "online" | "offline";

function useDaemonHealth() {
  const [status, setStatus] = useState<DaemonStatus>("connecting");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        await checkHealth();
        if (mounted) {
          setStatus("online");
          setLastChecked(new Date());
        }
      } catch {
        if (mounted) {
          setStatus("offline");
          setLastChecked(new Date());
        }
      }
    };

    // Initial check
    void check();

    // Poll every 10s — T-01-06 mitigation (prevents request flooding)
    const interval = setInterval(() => {
      void check();
    }, 10_000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { status, lastChecked };
}

export default function DaemonStatusBadge() {
  const { status, lastChecked } = useDaemonHealth();

  const dotColor =
    status === "connecting"
      ? "bg-yellow-500 animate-pulse"
      : status === "online"
        ? "bg-green-500"
        : "bg-red-500";

  const statusLabel =
    status === "connecting"
      ? "Connecting"
      : status === "online"
        ? "Online"
        : "Offline";

  const daemonUrl =
    import.meta.env.VITE_OPEN_DESIGN_URL ?? "http://localhost:17456";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-1.5 cursor-default"
            aria-live="polite"
          >
            <span
              className={`w-2 h-2 shrink-0 rounded-full ${dotColor}`}
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">{statusLabel}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          <p className="text-xs font-mono">{daemonUrl}</p>
          {lastChecked && (
            <p className="text-xs text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
