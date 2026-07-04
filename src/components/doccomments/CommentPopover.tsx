import { useState } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface Props {
  rect: DOMRect | null;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  submitting: boolean;
}

export function CommentPopover({ rect, onSubmit, onCancel, submitting }: Props) {
  const [text, setText] = useState("");
  if (!rect) return null;
  return (
    <div
      className="fixed z-50 w-72 rounded-md border border-zinc-700 bg-zinc-900 p-3 shadow-lg"
      style={{ top: rect.bottom + 6 + window.scrollY, left: rect.left + window.scrollX }}
    >
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Instruction for the reviewer persona…"
        className="mb-2 h-20 text-sm"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          disabled={!text.trim() || submitting}
          onClick={() => onSubmit(text.trim())}
        >
          {submitting ? "Adding…" : "Comment"}
        </Button>
      </div>
    </div>
  );
}
