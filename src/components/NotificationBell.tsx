import { useState, useRef, useEffect } from "react";
import {
  useBellNotifications,
  useUnreadCount,
  useNotificationActions,
} from "../hooks/useNotifications";
import { Bell } from "lucide-react";

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const severityDot: Record<string, string> = {
  critical: "bg-red-500",
  error: "bg-orange-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unreadCount = useUnreadCount();
  const notifications = useBellNotifications();
  const { markRead, markAllRead, clearAll } = useNotificationActions();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 text-xs font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-base text-gray-500 text-center">No notifications</p>
            ) : (
              notifications.map((n: any) => (
                <button
                  key={n._id}
                  onClick={() => markRead({ id: n._id })}
                  className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors border-b border-gray-800 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityDot[n.severity] ?? "bg-gray-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-gray-200 truncate">{n.title}</p>
                      <p className="text-sm text-gray-400 truncate">{n.message}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{relativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 bg-gray-900">
              <button
                onClick={() => markAllRead({})}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Mark all read
              </button>
              <button
                onClick={() => clearAll({})}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
