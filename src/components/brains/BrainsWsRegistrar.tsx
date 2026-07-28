/**
 * BrainsWsRegistrar — headless component that wires `brainsApi`'s live adapter to the app's one
 * shared Ástríðr WebSocket connection (103-08 scope addition: dangling-wire fix).
 *
 * `registerBrainsWsSender` (`src/lib/brainsApi.ts`) exists specifically because the live adapter's
 * sender is not available at module load — it only exists once `AstridrWSProvider` mounts and
 * exposes `useAstridrWS().sendCommand`. Before this component existed, nothing in the app ever
 * called `registerBrainsWsSender`, so `liveSendCommand` stayed `null` forever: every live-mode
 * brain command returned the honest-but-permanent `{status: "error", error: "Ástríðr WS sender
 * not registered"}` ack, which `createLiveBrainsAdapter.getCatalogue()` turned into `[]` — the
 * per-profile picker branch could never work outside `VITE_BRAINS_STUB=true`, and the stub flag
 * masked the gap from the whole test suite.
 *
 * Mounted once, inside `AstridrWSProvider` (`App.tsx`), alongside the other headless app-level
 * listeners (`ProactiveAlertListener`, `FocusExitDigest`) — same "mount once at the root" shape.
 * Renders nothing.
 *
 * Registration is a single effect keyed on `sendCommand`'s identity. `sendCommand` is a
 * `useCallback` with an empty dependency array in `AstridrWSProvider`, so its reference is stable
 * for the entire provider lifetime — the effect body runs exactly once per mount, never on every
 * render, and re-registration only happens if the provider itself ever remounts (a fresh
 * `sendCommand` from a fresh provider instance, never a stale one sitting alongside a live one).
 * The registered function is never a stale closure either: `sendCommand` always reads the CURRENT
 * `wsRef.current`/command queue internally (`AstridrWSContext.tsx`), so calling the SAME
 * registered reference on send #50 behaves identically to send #1 — there is nothing about the
 * connection's lifecycle captured at registration time.
 */
import { useEffect } from "react";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { registerBrainsWsSender } from "@/lib/brainsApi";

export function BrainsWsRegistrar() {
  const { sendCommand } = useAstridrWS();

  useEffect(() => {
    registerBrainsWsSender(sendCommand);
  }, [sendCommand]);

  return null;
}
