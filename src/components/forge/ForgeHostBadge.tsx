/**
 * ForgeHostBadge — small outline chip identifying which machine a job came from.
 *
 * Shows the raw hostId (e.g. "desktop", "laptop"). Truncates to 8 chars + "…"
 * when hostId exceeds 10 characters (host is secondary info; compact footprint).
 *
 * Uses shadcn Badge variant="outline" with mono uppercase style override.
 */

import { Badge } from "@/components/ui/badge";

interface ForgeHostBadgeProps {
  hostId: string;
}

export function ForgeHostBadge({ hostId }: ForgeHostBadgeProps) {
  const label = hostId.length > 10 ? hostId.slice(0, 8) + "…" : hostId;
  return (
    <Badge
      variant="outline"
      className="text-xs font-mono uppercase tracking-wider px-2 py-0"
    >
      {label}
    </Badge>
  );
}
