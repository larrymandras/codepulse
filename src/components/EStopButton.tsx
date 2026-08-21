/**
 * EStopButton — Emergency Stop with mandatory two-step confirmation and an
 * admin key supplied at the moment of use.
 *
 * Phase 56 Plan 05: T-56-14 mitigation (two-step confirm).
 * 189-17 B6c: made to actually work, and given a release control.
 *
 * NEVER sends estop.activate on first click. First click opens a confirmation
 * dialog. The operator must type the admin key and explicitly confirm.
 *
 * WHY THE KEY IS TYPED RATHER THAN CONFIGURED.
 * Ástríðr's WS auth is connection-level: this app authenticates with the
 * SERVICE key (VITE_ASTRIDR_API_KEY), and `security/command_auth.py` gates
 * estop.activate/deactivate on the ADMIN key. So this button had been dead
 * since it shipped — every click returned "Command 'estop.activate' requires
 * admin key". Baking the admin key into the bundle as a second VITE_ var would
 * have "fixed" it by making the admin key readable by anyone who can open the
 * page, collapsing the two-tier split into one tier. Typing it per use keeps
 * the split intact; the server accepts it as a per-command key.
 *
 * The key is held in component state only while the dialog is open and is
 * cleared on every close path — including after a successful send.
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
  const [loading, setLoading] = useState<"activate" | "deactivate" | null>(null);
  const [adminKey, setAdminKey] = useState("");

  const close = () => {
    setOpen(false);
    // Never leave the admin key sitting in component state after the dialog is
    // dismissed — including on the success path.
    setAdminKey("");
  };

  const send = async (action: "activate" | "deactivate") => {
    if (!adminKey) {
      toast.error("Admin key required");
      return;
    }
    setLoading(action);
    try {
      const result = await sendCommand({
        type: `estop.${action}`,
        admin_key: adminKey,
      });
      if (result.status === "ok") {
        toast.success(
          action === "activate"
            ? "Emergency stop activated. All agents halted."
            : "Emergency stop released."
        );
        close();
      } else {
        // Surface the server's own reason. "requires admin key" here means the
        // typed key was wrong; "none configured" means CODEPULSE_ADMIN_KEY is
        // not set on the server at all, which no amount of retyping will fix.
        toast.error(result.error ?? "E-Stop command failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "E-Stop failed");
    } finally {
      setLoading(null);
    }
  };

  const isConnected = status === "connected";
  const busy = loading !== null;

  return (
    <>
      {/*
        Trigger button — POLISH-02 (120-07). Measured live at 360/640/900/1440px: the header's
        icon cluster squeezes this button below its content width, and the label "E-Stop" (a
        single hyphenated word) breaks at the hyphen into "E-" / "Stop" on two lines, doubling
        the button's height (28px -> 48px). Confirmed via a Range over the label's TEXT NODE, not
        the <span> itself — the span is a flex item of this button and gets CSS-blockified to
        display:block, so span.getClientRects() always reports 1 rect even while wrapped; only
        the text node fragments per visual line. `shrink-0` stops the compression, `whitespace-
        nowrap` stops the hyphen break becoming a line break once compression is removed
        elsewhere in the row (120-07 Task 3 bounds the row itself so this button is never asked
        to compress below its content width in the first place).
      */}
      <button
        onClick={() => setOpen(true)}
        disabled={!isConnected}
        title={isConnected ? "Emergency Stop — halt all agents" : "Not connected to Ástríðr"}
        aria-label="Emergency Stop"
        className="flex items-center gap-1 px-2 py-1 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 min-w-24"
      >
        <OctagonX className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">E-Stop</span>
      </button>

      {/* Confirmation dialog */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => !busy && close()}
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
                  Emergency Stop
                </h2>
                <p
                  id="estop-dialog-desc"
                  className="text-base text-(--muted-foreground) mt-1"
                >
                  Halting stops <strong className="text-(--foreground)">ALL running agents</strong> immediately
                  and disables the LLM gate. Release restores both.
                </p>
              </div>
            </div>

            {/* Admin key */}
            <label className="flex flex-col gap-1">
              <span className="text-sm text-(--muted-foreground)">Admin key</span>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                disabled={busy}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-label="Admin key"
                placeholder="CODEPULSE_ADMIN_KEY"
                className="bg-(--background) border border-(--border) rounded px-2 py-1.5 text-base text-(--foreground) font-mono disabled:opacity-50"
              />
            </label>

            {/* Actions */}
            <div className="flex justify-between items-center gap-2 pt-2 border-t border-(--border)">
              <button
                type="button"
                onClick={() => send("deactivate")}
                disabled={busy || !adminKey}
                title="Release a halt that is already in force"
                className="text-base text-(--muted-foreground) hover:text-(--foreground) px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading === "deactivate" ? "Releasing..." : "Release halt"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="text-base text-(--muted-foreground) hover:text-(--foreground) px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => send("activate")}
                  disabled={busy || !adminKey}
                  className="text-base bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading === "activate" ? "Activating..." : "Confirm E-Stop"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
