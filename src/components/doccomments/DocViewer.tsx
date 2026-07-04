import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Anchor, DocComment } from "../../lib/docCommentsApi";
import { captureAnchorFromSelection, relocateAnchor } from "../../lib/docAnchor";

const STATUS_CLASS: Record<string, string> = {
  open: "bg-amber-500/25 border-b-2 border-amber-500",
  acked: "bg-blue-500/25 border-b-2 border-blue-500",
  approved: "bg-emerald-500/25 border-b-2 border-emerald-500",
  resolved: "bg-emerald-500/10 border-b border-emerald-500/40",
  stale: "line-through text-muted-foreground/60 decoration-zinc-500",
};

interface Props {
  source: string;
  comments: DocComment[];
  onSelectAnchor: (anchor: Anchor, rect: DOMRect) => void;
  onCommentClick: (id: string) => void;
}

export function DocViewer({ source, comments, onSelectAnchor, onCommentClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const quote = sel.toString();
    if (!quote.trim()) return;
    const range = sel.getRangeAt(0);
    // rendered context: 32 chars around the selection within its text nodes
    const anchorText = sel.anchorNode?.textContent ?? "";
    const prefix = anchorText.slice(Math.max(0, range.startOffset - 32), range.startOffset);
    const focusText = sel.focusNode?.textContent ?? "";
    const suffix = focusText.slice(range.endOffset, range.endOffset + 32);
    const anchor = captureAnchorFromSelection(source, quote, prefix, suffix);
    if (!anchor) return; // ambiguous → refuse rather than persist a mis-anchored comment
    onSelectAnchor(anchor, range.getBoundingClientRect());
  }

  // Underline overlay: wrap each non-stale comment's quote in a status <mark>.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    // (Presentation only. Walk text nodes, find each comment.quote, wrap the first
    // unique match in a <mark class=STATUS_CLASS[status]> with data-comment-id.
    // If not found in the DOM, skip silently — the sidebar still lists it.)
    highlightComments(root, source, comments);
    const marks = root.querySelectorAll<HTMLElement>("mark[data-comment-id]");
    const onClick = (e: Event) => {
      const id = (e.currentTarget as HTMLElement).dataset.commentId;
      if (id) onCommentClick(id);
    };
    marks.forEach((m) => m.addEventListener("click", onClick));
    return () => marks.forEach((m) => m.removeEventListener("click", onClick));
  }, [source, comments, onCommentClick]);

  return (
    <div
      ref={ref}
      onMouseUp={handleMouseUp}
      className="prose prose-invert max-w-none px-6 py-4 font-mono text-sm leading-relaxed"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}

/** Wrap the first unique DOM occurrence of each non-stale comment's quote in a <mark>. */
function highlightComments(root: HTMLElement, source: string, comments: DocComment[]) {
  for (const c of comments) {
    if (relocateAnchor(source, c.anchor).status === "stale" && c.status !== "stale") continue;
    wrapFirstMatch(root, c.anchor.quote, c.id, STATUS_CLASS[c.status] ?? STATUS_CLASS.open);
  }
}

/** Find `quote` in a single text node under root and wrap it in a styled <mark>. */
function wrapFirstMatch(root: HTMLElement, quote: string, id: string, cls: string) {
  if (!quote) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? "";
    const idx = text.indexOf(quote);
    if (idx === -1) continue;
    try {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + quote.length);
      const mark = document.createElement("mark");
      mark.className = `cursor-pointer rounded-sm ${cls}`;
      mark.dataset.commentId = id;
      // Throws if the range partially selects a non-Text node (e.g. spans across
      // element boundaries mid-tag). Best-effort presentation only — skip on failure.
      range.surroundContents(mark);
    } catch {
      // fall through and try the next text node occurrence, if any
      continue;
    }
    return;
  }
}
