import { diffWords } from "diff";
import { Button } from "../ui/button";
import type { DocComment } from "../../lib/docCommentsApi";

interface Props {
  comment: DocComment;
  onApply: (id: string) => void;
  applying: boolean;
}

export function ApprovedEditCard({ comment, onApply, applying }: Props) {
  const before = comment.anchor.quote;
  const after = comment.proposed_edit ?? "";
  const parts = diffWords(before, after);
  return (
    <div
      className="mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-1 text-xs font-semibold text-emerald-300">Proposed edit</p>
      <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
        {parts.map((p, i) => (
          <span
            key={i}
            className={
              p.added
                ? "bg-emerald-600/40 text-emerald-100"
                : p.removed
                  ? "bg-red-600/30 text-red-200 line-through"
                  : "text-zinc-300"
            }
          >
            {p.value}
          </span>
        ))}
      </p>
      <div className="mt-2 flex justify-end">
        <Button size="sm" disabled={applying} onClick={() => onApply(comment.id)}>
          {applying ? "Applying…" : "Apply edit"}
        </Button>
      </div>
    </div>
  );
}
