import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { approveAgent, rejectAgent } from "@/lib/astridrApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ApprovalBannerProps {
  onDetailsClick: (agentId: string) => void;
}

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ApprovalBanner({ onDetailsClick }: ApprovalBannerProps) {
  const pendingApprovals =
    useQuery(api.approvalQueue.list, { status: "pending" }) ?? [];
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  if (pendingApprovals.length === 0) return null;

  const handleApprove = async (requestId: string) => {
    setLoadingIds((s) => new Set(s).add(`approve-${requestId}`));
    try {
      await approveAgent(requestId);
      toast.success("Agent approved and activation started.");
    } catch {
      toast.error("Failed to approve agent.");
    } finally {
      setLoadingIds((s) => {
        const next = new Set(s);
        next.delete(`approve-${requestId}`);
        return next;
      });
    }
  };

  const handleReject = async (requestId: string) => {
    setLoadingIds((s) => new Set(s).add(`reject-${requestId}`));
    try {
      await rejectAgent(requestId);
      toast.success("Agent creation request rejected.");
    } catch {
      toast.error("Failed to reject agent.");
    } finally {
      setLoadingIds((s) => {
        const next = new Set(s);
        next.delete(`reject-${requestId}`);
        return next;
      });
    }
  };

  return (
    <div className="bg-[var(--status-warn)]/15 border border-[var(--status-warn)]/30 rounded-lg p-4 space-y-3">
      {pendingApprovals.map((approval, idx) => (
        <div key={approval.requestId}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 text-[var(--status-warn)] shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">
                {approval.agentName}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {approval.tier}
              </Badge>
              <span className="text-xs text-muted-foreground">
                requested {relativeTime(approval.requestedAt)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => onDetailsClick(approval.agentId)}
              >
                Details
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={loadingIds.has(`reject-${approval.requestId}`)}
                onClick={() => handleReject(approval.requestId)}
              >
                {loadingIds.has(`reject-${approval.requestId}`) && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                Reject
              </Button>
              <Button
                size="sm"
                className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white"
                disabled={loadingIds.has(`approve-${approval.requestId}`)}
                onClick={() => handleApprove(approval.requestId)}
              >
                {loadingIds.has(`approve-${approval.requestId}`) && (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                )}
                Approve
              </Button>
            </div>
          </div>
          {idx < pendingApprovals.length - 1 && (
            <div className="border-t border-[var(--status-warn)]/20 mt-3" />
          )}
        </div>
      ))}
    </div>
  );
}

export default ApprovalBanner;
