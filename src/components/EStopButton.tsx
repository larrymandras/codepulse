/**
 * EStopButton — Emergency Stop button with mandatory two-step confirmation.
 *
 * Phase 56 Plan 05: T-56-14 mitigation.
 *
 * NEVER sends estop.activate on first click. First click opens a confirmation
 * dialog. User must explicitly click "Confirm E-Stop" to send the command.
 *
 * Disabled when WS is disconnected (cannot guarantee delivery).
 */

import { useState } from "react";
import { OctagonX } from "lucide-react";
import { toast } from "sonner";
import { useAstridrWS } from "../contexts/AstridrWSContext";

export function EStopButton() {
  const { sendCommand, status } = useAstridrWS();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    setLoading(true);
    try {
      const result = await sendCommand({ type: "estop.activate" });
      if (result.status === "ok") {
        toast.success("Emergency stop activated. All agents halted.");
        setOpen(false);
      } else {
        toast.error(result.error ?? "E-Stop command failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "E-Stop failed");
    } finally {
      setLoading(false);
    }
  };

  const isConnected = status === "connected";

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        disabled={!isConnected}
        title={isConnected ? "Emergency Stop — halt all agents" : "Not connected to Ástríðr"}
        aria-label="Emergency Stop"
        className="flex items-center gap-1 px-2 py-1 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <OctagonX className="h-4 w-4" />
        <span>E-Stop</span>
      </button>

      {/* Confirmation dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="bg-(--card) border border-(--border) w-full max-w-sm mx-4 p-6 flex flex-col gap-4 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="estop-dialog-title"
            aria-describedby="estop-dialog-desc"
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <OctagonX className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2
                  id="estop-dialog-title"
                  className="text-base font-semibold text-(--foreground)"
                >
                  Activate Emergency Stop?
                </h2>
                <p
                  id="estop-dialog-desc"
                  className="text-base text-(--muted-foreground) mt-1"
                >
                  This will halt <strong className="text-(--foreground)">ALL running agents</strong> immediately.
                  This action cannot be undone from CodePulse.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-(--border)">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="text-base text-(--muted-foreground) hover:text-(--foreground) px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={loading}
                className="text-base bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? "Activating..." : "Confirm E-Stop"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
