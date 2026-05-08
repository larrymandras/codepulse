import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { checkHealth } from "@/lib/openDesignApi";

type EmbedStatus = "loading" | "ready" | "error";

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 10_000;

export default function IframeEmbed() {
  const [status, setStatus] = useState<EmbedStatus>("loading");
  const [opacity, setOpacity] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const webUiUrl =
    import.meta.env.VITE_OPEN_DESIGN_WEB_URL ?? "http://localhost:17573";

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();

    setStatus("loading");
    setOpacity(0);

    // Timeout after 10s if no successful health check
    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setStatus("error");
    }, TIMEOUT_MS);

    const poll = async () => {
      try {
        await checkHealth();
        stopPolling();
        setStatus("ready");
        // Trigger opacity transition after state update
        requestAnimationFrame(() => {
          setOpacity(1);
        });
      } catch {
        // Keep polling until timeout fires
      }
    };

    // Poll immediately, then on interval
    void poll();
    pollingRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);
  };

  useEffect(() => {
    startPolling();
    return () => stopPolling();
    // Re-poll if daemon URL changes (e.g. env var hot-reload in dev)
  }, [webUiUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- startPolling/stopPolling are stable (only close over refs)

  const iframeHeight = "calc(100vh - 56px)";

  return (
    <div
      className="relative w-full"
      style={{ minHeight: iframeHeight }}
    >
      {/* Loading overlay */}
      {status === "loading" && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Connecting to Design Studio...
          </span>
        </div>
      )}

      {/* Error overlay */}
      {status === "error" && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-3 px-6">
          <p className="text-base font-semibold text-foreground">
            Design Studio Unavailable
          </p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            The Open Design daemon is not running. Start it with{" "}
            <code className="font-mono text-xs bg-muted px-1 py-0.5">
              docker compose up open-design
            </code>{" "}
            and refresh.
          </p>
          <button
            onClick={startPolling}
            className="mt-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Iframe — rendered once ready */}
      {status === "ready" && (
        <iframe
          src={webUiUrl}
          title="Design Studio"
          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
          className="w-full border-0"
          style={{
            height: iframeHeight,
            opacity,
            transition: "opacity 200ms ease-out",
          }}
        />
      )}
    </div>
  );
}
