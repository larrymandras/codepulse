import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, RefreshCw, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassPanel } from "@/components/GlassPanel";
import StatusBadge from "@/components/StatusBadge";

type PairingState = "idle" | "loading" | "qr-active" | "connected";
type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "pairing"
  | "reconnecting"
  | "bridge-offline";

// Astridr API base — use env var if available, otherwise infer from window.location
function getAstridrBase(): string {
  // Vite exposes VITE_ASTRIDR_API_URL if set
  const envBase = (import.meta as any).env?.VITE_ASTRIDR_API_URL as
    | string
    | undefined;
  if (envBase) return envBase.replace(/\/$/, "");
  // Fallback: same host, port 8000 (Astridr default)
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

// Mask phone number: keep first digit and last 4
function maskPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 5) return phone;
  const first = digits[0];
  const last4 = digits.slice(-4);
  return `+${first} (***) ***-${last4}`;
}

// Format ISO timestamp for display
function formatTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function WhatsApp() {
  const [pairingState, setPairingState] = useState<PairingState>("idle");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [qrImageSrc, setQrImageSrc] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [connectedAt, setConnectedAt] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(20);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [showDisconnectDialog, setShowDisconnectDialog] =
    useState<boolean>(false);
  const [bridgeOffline, setBridgeOffline] = useState<boolean>(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Countdown timer management ---
  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(20);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Don't clear interval — SSE will deliver a new QR and reset
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Start/stop countdown based on pairing state
  useEffect(() => {
    if (pairingState === "qr-active") {
      startCountdown();
    } else {
      stopCountdown();
    }
    return () => stopCountdown();
  }, [pairingState, startCountdown, stopCountdown]);

  // --- SSE connection ---
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const base = getAstridrBase();
    const es = new EventSource(`${base}/api/whatsapp/sse`);
    eventSourceRef.current = es;

    es.addEventListener("qr", (event: MessageEvent) => {
      const data = event.data as string;
      setQrImageSrc(data.startsWith("data:") ? data : `data:image/png;base64,${data}`);
      setPairingState("qr-active");
      setConnectionStatus("pairing");
      setCountdown(20);
      startCountdown();
      setBridgeOffline(false);
    });

    es.addEventListener("status", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as {
          status: string;
          phone?: string;
          connected_at?: string;
          attempt?: number;
        };
        if (payload.status === "ready" || payload.status === "connected") {
          setPairingState("connected");
          setConnectionStatus("connected");
          if (payload.phone) setPhoneNumber(payload.phone);
          if (payload.connected_at) setConnectedAt(payload.connected_at);
          setBridgeOffline(false);
        } else if (payload.status === "disconnected") {
          setConnectionStatus("disconnected");
          setPairingState("idle");
          setPhoneNumber("");
          setConnectedAt("");
        } else if (payload.status === "reconnecting") {
          setConnectionStatus("reconnecting");
          setReconnectAttempt(payload.attempt ?? 1);
        } else if (payload.status === "reconnect_failed") {
          setConnectionStatus("disconnected");
          setPairingState("idle");
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("bridge-status", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { online: boolean };
        if (!payload.online) {
          setBridgeOffline(true);
          setConnectionStatus("bridge-offline");
        } else {
          setBridgeOffline(false);
          if (connectionStatus === "bridge-offline") {
            setConnectionStatus("disconnected");
          }
        }
      } catch {
        // ignore parse errors
      }
    });

    // T-68-15: Error handler sets bridge offline state — handles SSE reconnect failures
    es.onerror = () => {
      setBridgeOffline(true);
      setConnectionStatus("bridge-offline");
    };
  }, [startCountdown, connectionStatus]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopCountdown();
    };
  }, [stopCountdown]);

  // --- Handlers ---
  const handlePairWhatsApp = useCallback(async () => {
    setPairingState("loading");
    setConnectionStatus("pairing");

    // Connect SSE before sending pair request (so we don't miss the first QR event)
    connectSSE();

    try {
      const base = getAstridrBase();
      const response = await fetch(`${base}/api/whatsapp/start-pairing`, {
        method: "POST",
      });
      if (!response.ok) {
        setBridgeOffline(true);
        setConnectionStatus("bridge-offline");
        setPairingState("idle");
      }
    } catch {
      setBridgeOffline(true);
      setConnectionStatus("bridge-offline");
      setPairingState("idle");
    }
  }, [connectSSE]);

  const handleRefreshQR = useCallback(async () => {
    setPairingState("loading");
    try {
      const base = getAstridrBase();
      await fetch(`${base}/api/whatsapp/refresh-qr`, { method: "POST" });
    } catch {
      setBridgeOffline(true);
      setConnectionStatus("bridge-offline");
    }
  }, []);

  const handleDisconnectConfirm = useCallback(async () => {
    setShowDisconnectDialog(false);
    try {
      const base = getAstridrBase();
      await fetch(`${base}/api/whatsapp/destroy`, { method: "POST" });
    } catch {
      // Optimistic update regardless of API call result
    }
    setConnectionStatus("disconnected");
    setPairingState("idle");
    setPhoneNumber("");
    setConnectedAt("");
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // --- Connection status badge ---
  function ConnectionStatusBadge() {
    if (connectionStatus === "connected") {
      return <StatusBadge status="ok" label="Connected" />;
    }
    if (connectionStatus === "disconnected") {
      return <StatusBadge status="error" label="Disconnected" />;
    }
    if (connectionStatus === "pairing") {
      return <StatusBadge status="warn" label="Pairing..." />;
    }
    if (connectionStatus === "reconnecting") {
      return (
        <StatusBadge
          status="warn"
          label={`Reconnecting (${reconnectAttempt}/3)`}
        />
      );
    }
    if (connectionStatus === "bridge-offline") {
      return <StatusBadge status="error" label="Bridge Offline" />;
    }
    return <StatusBadge status="idle" label={connectionStatus} />;
  }

  // Progress bar color: amber when countdown < 5
  const progressValue = (countdown / 20) * 100;
  const progressColor =
    countdown < 5
      ? "var(--status-warn)"
      : "var(--sidebar-primary)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Page heading */}
      <div className="flex items-center gap-3">
        <MessageCircle className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">WhatsApp Channel</h1>
      </div>

      {/* Bridge offline alert */}
      <AnimatePresence>
        {bridgeOffline && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Alert variant="destructive">
              <AlertDescription>
                WhatsApp bridge is offline. Check that the whatsapp-bridge
                container is running.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection status card */}
      <GlassPanel className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Connection Status
            </p>
            <div className="flex items-center gap-2">
              <ConnectionStatusBadge />
              {connectionStatus === "connected" && phoneNumber && (
                <span className="text-sm text-muted-foreground">
                  {maskPhone(phoneNumber)}
                </span>
              )}
            </div>
            {connectionStatus === "connected" && connectedAt && (
              <p className="text-xs text-muted-foreground">
                Connected since {formatTimestamp(connectedAt)}
              </p>
            )}
          </div>
          {connectionStatus === "connected" && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => setShowDisconnectDialog(true)}
            >
              <Unplug className="h-4 w-4 mr-2" />
              Disconnect WhatsApp
            </Button>
          )}
        </div>
      </GlassPanel>

      {/* QR pairing card — PRIMARY VISUAL ANCHOR */}
      <GlassPanel className="p-6">
        <AnimatePresence mode="wait">
          {/* State 1: Idle */}
          {pairingState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center gap-6 py-4 text-center"
            >
              <div className="space-y-2">
                <h2 className="text-base font-semibold">WhatsApp not connected</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Pair your WhatsApp account to start receiving messages through
                  Ástríðr.
                </p>
              </div>
              <Button
                onClick={handlePairWhatsApp}
                disabled={bridgeOffline}
                className="w-full max-w-xs"
                style={{ backgroundColor: "var(--sidebar-primary)" }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Pair WhatsApp
              </Button>
            </motion.div>
          )}

          {/* State 2: QR Loading */}
          {pairingState === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <Skeleton className="w-64 h-64" />
              <p className="text-sm text-muted-foreground">
                Generating QR code...
              </p>
              <Progress value={0} className="w-64" />
            </motion.div>
          )}

          {/* State 3: QR Active */}
          {pairingState === "qr-active" && (
            <motion.div
              key="qr-active"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center gap-4 py-4"
            >
              {/* QR image in white-background inset for contrast on dark background */}
              <div
                className="bg-white p-2 inline-block"
                style={{ padding: "8px" }}
              >
                <motion.img
                  key={qrImageSrc}
                  src={qrImageSrc}
                  alt="WhatsApp QR code"
                  width={256}
                  height={256}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="block"
                  style={{ width: 256, height: 256 }}
                />
              </div>

              {/* Countdown progress bar */}
              <div className="w-64 space-y-1">
                <Progress
                  value={progressValue}
                  className="h-1.5 w-full transition-all duration-1000"
                  style={
                    {
                      "--progress-foreground": progressColor,
                    } as React.CSSProperties
                  }
                />
                {countdown < 10 && (
                  <p
                    className="text-xs text-center"
                    style={{
                      color:
                        countdown < 5
                          ? "var(--status-warn)"
                          : "var(--muted-foreground)",
                    }}
                  >
                    {countdown === 0
                      ? "QR expired — waiting for refresh..."
                      : `QR expires in ${countdown}s`}
                  </p>
                )}
              </div>

              {/* Instructions */}
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside text-left">
                <li>Open WhatsApp on your phone</li>
                <li>Tap Menu (⋮) → Linked Devices</li>
                <li>Tap Link a Device and scan</li>
              </ol>

              {/* Refresh QR button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefreshQR}
                style={{ borderColor: "var(--sidebar-primary)", color: "var(--sidebar-primary)" }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh QR
              </Button>
            </motion.div>
          )}

          {/* State 4: Connected */}
          {pairingState === "connected" && (
            <motion.div
              key="connected"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex flex-col items-center gap-4 py-4 text-center"
            >
              <motion.div
                className="w-16 h-16 flex items-center justify-center"
                style={{
                  backgroundColor: "color-mix(in oklch, var(--status-ok) 20%, transparent)",
                }}
              >
                <MessageCircle
                  className="h-8 w-8"
                  style={{ color: "var(--status-ok)" }}
                />
              </motion.div>
              <div className="space-y-1">
                <StatusBadge status="ok" label="Connected" />
                {phoneNumber && (
                  <p className="text-sm text-foreground font-medium mt-2">
                    Connected as {maskPhone(phoneNumber)}
                  </p>
                )}
                {connectedAt && (
                  <p className="text-xs text-muted-foreground">
                    Since {formatTimestamp(connectedAt)}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowDisconnectDialog(true)}
              >
                <Unplug className="h-4 w-4 mr-2" />
                Disconnect WhatsApp
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>

      {/* Disconnect confirmation dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect WhatsApp?</DialogTitle>
            <DialogDescription>
              This will end the current session. You'll need to scan a new QR
              code to reconnect.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisconnectDialog(false)}
            >
              Keep Connected
            </Button>
            <Button variant="destructive" onClick={handleDisconnectConfirm}>
              Yes, Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
