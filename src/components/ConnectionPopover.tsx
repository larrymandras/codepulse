/**
 * ConnectionPopover — diagnostic connection details popover.
 *
 * Shows WebSocket URL, status, uptime, ping-based latency, subscribed topics,
 * last event timestamp, and a reconnect button when disconnected.
 *
 * Phase 02: D-07, D-10, D-11, T-02-02, T-02-04
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WSStatusIndicator } from "./WSStatusIndicator";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TOPICS = ["live-runs", "agents", "executions", "health", "security"];
const PING_INTERVAL_MS = 30_000;

// T-02-02: display base URL only, never the full URL with api_key query param
const WS_BASE_URL =
  (import.meta.env.VITE_ASTRIDR_WS_URL as string | undefined) ?? "ws://localhost:8765";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(connectedAt: Date | null): string {
  if (!connectedAt) return "--";
  const seconds = Math.floor((Date.now() - connectedAt.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatRelative(date: Date | null): string {
  if (!date) return "No events yet";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  return `${m}m ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ConnectionPopoverProps {
  /** For testing: force the auth error state to be shown. */
  forceAuthError?: boolean;
}

export function ConnectionPopover({ forceAuthError = false }: ConnectionPopoverProps) {
  const { status, sendCommand, subscribeEvent, reconnect } = useAstridrWS();

  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [, setTick] = useState(0); // drives uptime/relative refresh

  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uptimeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef(status);
  const connectedAtRef = useRef<Date | null>(null);

  // Track connection transitions
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "connected") {
      const now = new Date();
      setConnectedAt(now);
      connectedAtRef.current = now;
    } else {
      setConnectedAt(null);
      connectedAtRef.current = null;
      setLatencyMs(null);

      // Clear ping timer on disconnect
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    }

    void prev; // suppress unused warning
  }, [status]);

  // Ping-based latency measurement — fires every 30s when connected
  useEffect(() => {
    if (status !== "connected") return;

    const measureLatency = async () => {
      if (status !== "connected") return;
      try {
        const start = performance.now();
        // Send a ping-style command; backend ack (even error ack) gives us RTT
        await sendCommand({ type: "ping" }).catch(() => {
          /* error ack still gives RTT */
        });
        const rtt = Math.round(performance.now() - start);
        setLatencyMs(rtt);
      } catch {
        // Ignore — latency stays at last known value
      }
    };

    // Measure once on connect, then periodically
    void measureLatency();
    pingTimerRef.current = setInterval(() => {
      void measureLatency();
    }, PING_INTERVAL_MS);

    return () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };
  }, [status, sendCommand]);

  // Uptime/relative timestamp ticker — update every second
  useEffect(() => {
    uptimeTimerRef.current = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => {
      if (uptimeTimerRef.current) clearInterval(uptimeTimerRef.current);
    };
  }, []);

  // Track last event time by subscribing to all topics
  const handleAnyEvent = useCallback(() => {
    setLastEventAt(new Date());
  }, []);

  useEffect(() => {
    const unsubs = ALL_TOPICS.map((topic) => {
      // Subscribe to a wildcard by using the topic-level subscribe via a marker event
      // We subscribe to the well-known events per topic to track activity
      return subscribeEvent(topic, handleAnyEvent);
    });
    // Also subscribe to common event types directly
    const directEvents = [
      "agent_status_change",
      "health_check",
      "run.started",
      "run.completed",
      "metric_delta",
    ];
    const directUnsubs = directEvents.map((evt) => subscribeEvent(evt, handleAnyEvent));

    return () => {
      unsubs.forEach((u) => u());
      directUnsubs.forEach((u) => u());
    };
  }, [subscribeEvent, handleAnyEvent]);

  const handleReconnect = () => {
    reconnect();
  };

  const statusLabel =
    status === "connected" ? "Connected" : status === "reconnecting" ? "Reconnecting..." : "Disconnected";

  const showAuthError = forceAuthError;
  const showReconnect = status !== "connected";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Open connection details"
          className="w-full text-left cursor-pointer"
        >
          <WSStatusIndicator status={status} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[280px] p-3" side="top" align="start">
        {/* Header */}
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          CONNECTION DETAILS
        </p>
        <Separator className="mb-3" />

        {/* Auth error (D-07, T-02-04) */}
        {showAuthError && (
          <p className="text-sm text-(--status-error) mb-3">
            Authentication failed. Check ASTRIDR_WEB_API_KEY and restart.
          </p>
        )}

        {/* Detail rows */}
        <div className="flex flex-col gap-2">
          {/* Row 1: URL — T-02-02: base URL only, no api_key */}
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground w-24 shrink-0">URL</span>
            <span className="text-sm font-mono break-all">{WS_BASE_URL}</span>
          </div>

          {/* Row 2: Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-24 shrink-0">Status</span>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  status === "connected"
                    ? "bg-(--status-ok)"
                    : status === "reconnecting"
                      ? "bg-(--status-warn) animate-pulse"
                      : "bg-(--status-error)"
                }`}
                aria-hidden="true"
              />
              <span className="text-sm">{statusLabel}</span>
            </div>
          </div>

          {/* Row 3: Uptime */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-24 shrink-0">Uptime</span>
            <span className="text-sm">
              {connectedAt ? formatUptime(connectedAt) : "--"}
            </span>
          </div>

          {/* Row 4: Latency */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-24 shrink-0">Latency</span>
            <span className="text-sm font-mono">
              {latencyMs !== null ? `${latencyMs}ms` : "--"}
            </span>
          </div>

          {/* Row 5: Topics */}
          <div className="flex items-start gap-2">
            <span className="text-sm text-muted-foreground w-24 shrink-0">Topics</span>
            <span className="text-sm">{ALL_TOPICS.join(", ")}</span>
          </div>

          {/* Row 6: Last event */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-24 shrink-0">Last event</span>
            <span className="text-sm">{formatRelative(lastEventAt)}</span>
          </div>
        </div>

        {/* Reconnect button — D-11: visible only when not connected */}
        {showReconnect && (
          <>
            <Separator className="mt-3 mb-2" />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleReconnect}
            >
              Reconnect
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
