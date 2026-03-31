import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";

export function useNotificationToasts() {
  const latest = useQuery(api.notifications.latestUnread, { type: "toast" });
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!latest) return;
    for (const n of latest) {
      if (!seen.current.has(n._id)) {
        seen.current.add(n._id);
        const toastFn =
          n.severity === "error"
            ? toast.error
            : n.severity === "warning"
              ? toast.warning
              : toast.success;
        toastFn(n.title, { description: n.message });
      }
    }
  }, [latest]);
}
