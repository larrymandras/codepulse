import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommentSidebar } from "./CommentSidebar";
import type { DocComment } from "../../lib/docCommentsApi";

const c = (o: Partial<DocComment>): DocComment => ({
  id: "c1", doc_ref: {} as any, anchor: { quote: "q" } as any, comment: "tighten",
  author: "larry", status: "open", assignee_persona: null, proposed_edit: null,
  resolution_note: null, profile_id: "larry", created_at: "", resolved_at: null, ...o,
});

it("shows a stale badge for stale comments", () => {
  render(<CommentSidebar comments={[c({ status: "stale" })]} onCommentClick={vi.fn()} onApply={vi.fn()} applyingId={null} />);
  expect(screen.getByText(/stale/i)).toBeInTheDocument();
});

it("renders the instruction text", () => {
  render(<CommentSidebar comments={[c({})]} onCommentClick={vi.fn()} onApply={vi.fn()} applyingId={null} />);
  expect(screen.getByText("tighten")).toBeInTheDocument();
});
