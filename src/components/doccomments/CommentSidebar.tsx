import { Badge } from "../ui/badge";
import type { DocComment, DocCommentStatus } from "../../lib/docCommentsApi";
import { ApprovedEditCard } from "./ApprovedEditCard";

const BADGE: Record<DocCommentStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-500/20 text-amber-300" },
  acked: { label: "Acked", className: "bg-blue-500/20 text-blue-300" },
  approved: { label: "Approved", className: "bg-emerald-500/20 text-emerald-300" },
  resolved: { label: "Resolved", className: "bg-emerald-500/10 text-emerald-400" },
  stale: { label: "Stale", className: "bg-zinc-600/30 text-zinc-400" },
};

interface Props {
  comments: DocComment[];
  onCommentClick: (id: string) => void;
  onApply: (id: string) => void;
  applyingId: string | null;
}

export function CommentSidebar({ comments, onCommentClick, onApply, applyingId }: Props) {
  if (comments.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No comments yet. Highlight text to add one.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-zinc-800">
      {comments.map((c) => {
        const b = BADGE[c.status];
        return (
          <div
            key={c.id}
            className="cursor-pointer p-3 hover:bg-zinc-900/50"
            onClick={() => onCommentClick(c.id)}
          >
            <div className="mb-1 flex items-center justify-between">
              <Badge className={b.className}>{b.label}</Badge>
              <span className="text-xs text-muted-foreground">{c.author}</span>
            </div>
            <p className="text-sm text-zinc-200">{c.comment}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">&ldquo;{c.anchor.quote}&rdquo;</p>
            {c.status === "approved" && (
              <ApprovedEditCard comment={c} onApply={onApply} applying={applyingId === c.id} />
            )}
            {c.status === "resolved" && c.resolution_note && (
              <p className="mt-1 text-xs text-emerald-400/80">✓ {c.resolution_note}</p>
            )}
            {c.status === "stale" && (
              <p className="mt-1 text-xs text-zinc-400">Anchor no longer matches — re-comment on current text.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
