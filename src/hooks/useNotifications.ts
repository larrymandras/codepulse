import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useBellNotifications() {
  return useQuery(api.notifications.bellUnread) ?? [];
}

export function useAllNotifications() {
  return useQuery(api.notifications.bellAll) ?? [];
}

export function useUnreadCount() {
  return useQuery(api.notifications.unreadCount) ?? 0;
}

export function useNotificationActions() {
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const clearAll = useMutation(api.notifications.clearAll);
  return { markRead, markAllRead, clearAll };
}
