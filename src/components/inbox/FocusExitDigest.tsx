/**
 * FocusExitDigest — headless "you're back" toast (Phase 186 Plan 13, D-07).
 *
 * Watches the SAME aggregate all-profiles inbox reactive read Inbox.tsx uses
 * (Plan 02's `inbox.listAll`, Plan 07's InboxCard) for a row with
 * `emitter === "focus_exit_digest"` and fires exactly ONE sonner toast per
 * such row — deduped by row `_id` so a re-render or WS reconnect never
 * re-fires the same digest, and the INDIVIDUAL held items the digest
 * summarizes never produce their own toasts (this component only ever
 * reacts to the one `focus_exit_digest` row per exit, never the `held`
 * rows it counted).
 *
 * Pre-existing digest rows already in the stream at mount time are marked
 * seen WITHOUT toasting (a page reload/WS reconnect must never replay a
 * past "you're back" moment) — only a digest row that newly appears AFTER
 * mount fires a toast.
 *
 * Renders nothing (headless, returns null). Mount once on the presence
 * surface (Chat.tsx).
 */
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";

// Sourced from api.inbox.listAll (D-12 aggregate all-profiles read) — only
// the fields this component actually reads.
interface FocusExitDigestRowDoc {
  _id: string;
  emitter: string;
  body: string;
}

// 186-UI-SPEC: 5-8s auto-dismiss, matching existing toast usage elsewhere.
const TOAST_DURATION_MS = 7000;

export function FocusExitDigest() {
  const rows = (useQuery(api.inbox.listAll, {}) ??
    []) as unknown as FocusExitDigestRowDoc[];
  const seenRef = useRef(new Set<string>());
  const initializedRef = useRef(false);

  useEffect(() => {
    const digestRows = rows.filter((row) => row.emitter === "focus_exit_digest");

    if (!initializedRef.current) {
      // First observation of the reactive stream (mount / reconnect) —
      // mark every EXISTING digest row seen without toasting, so this
      // component never replays a past "you're back" moment.
      for (const row of digestRows) seenRef.current.add(row._id);
      initializedRef.current = true;
      return;
    }

    for (const row of digestRows) {
      if (seenRef.current.has(row._id)) continue;
      seenRef.current.add(row._id);
      toast(row.body, { duration: TOAST_DURATION_MS });
    }
  }, [rows]);

  return null;
}
