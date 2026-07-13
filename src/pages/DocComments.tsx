import { useCallback, useEffect, useState } from "react";
import {
  listDocs, readDoc, createComment, applyComment,
  type Anchor, type DocContent, type DocListItem,
} from "../lib/docCommentsApi";
import { useDocComments } from "../hooks/useDocComments";
import { useProfileConfigs } from "../hooks/useProfileConfigs";
import { DocViewer } from "../components/doccomments/DocViewer";
import { CommentPopover } from "../components/doccomments/CommentPopover";
import { CommentSidebar } from "../components/doccomments/CommentSidebar";
import { PageHeader } from "../components/PageHeader";

export default function DocComments() {
  const profileId = (useProfileConfigs()[0] as { profileId?: string })?.profileId ?? "personal";
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [active, setActive] = useState<DocListItem | null>(null);
  const [doc, setDoc] = useState<DocContent | null>(null);
  const [pending, setPending] = useState<{ anchor: Anchor; rect: DOMRect } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { comments, error: commentsError, refetch } = useDocComments(
    profileId, active?.repo ?? "", active?.path ?? "",
  );

  useEffect(() => {
    listDocs(profileId)
      .then((r) => { setDocs(r.docs); setActive((a) => a ?? r.docs[0] ?? null); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [profileId]);

  useEffect(() => {
    if (!active) { setDoc(null); return; }
    let cancelled = false;
    setDoc(null); // clear stale content immediately so no selection/create can use it
    readDoc(active.repo, active.path)
      .then((d) => { if (!cancelled) setDoc(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [active]);

  const submitComment = useCallback(async (text: string) => {
    if (!pending || !active || !doc) return;
    setError(null);
    setSubmitting(true);
    try {
      await createComment({
        doc_ref: { repo: active.repo, path: active.path, doc_type: "gsd_spec", doc_hash: doc.doc_hash },
        anchor: pending.anchor, comment: text, author: profileId, profile_id: profileId,
      });
      setPending(null);
      refetch();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  }, [pending, active, doc, profileId, refetch]);

  const onApply = useCallback(async (id: string) => {
    setError(null);
    setApplyingId(id);
    try { await applyComment(id); refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setApplyingId(null); }
  }, [refetch]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="px-4 pt-4">
        <PageHeader title="Doc Review" />
      </div>
      <div className="grid flex-1 grid-cols-[240px_1fr_320px] overflow-hidden">
        <aside className="overflow-y-auto border-r border-border p-2">
          <h2 className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">GSD Docs</h2>
          {docs.map((d) => (
            <button key={`${d.repo}/${d.path}`}
              onClick={() => setActive(d)}
              className={`block w-full truncate rounded px-2 py-1 text-left text-xs ${
                active?.path === d.path && active?.repo === d.repo ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-card"}`}>
              <span className="text-muted-foreground">{d.repo}/</span>{d.path.replace(".planning/", "")}
            </button>
          ))}
        </aside>

        <main className="relative overflow-y-auto">
          {(error || commentsError) && <div className="m-3 rounded bg-red-500/10 p-2 text-xs text-red-300">{error || commentsError}</div>}
          {doc
            ? <DocViewer source={doc.content} comments={comments}
                onSelectAnchor={(anchor, rect) => setPending({ anchor, rect })}
                onCommentClick={(id) => { const el = document.querySelector(`[data-comment-id="${id}"]`); el?.scrollIntoView({ block: "center" }); }} />
            : <p className="p-6 text-sm text-muted-foreground">Select a document.</p>}
          <CommentPopover rect={pending?.rect ?? null} submitting={submitting}
            onSubmit={submitComment} onCancel={() => setPending(null)} />
        </main>

        <aside className="overflow-y-auto border-l border-border">
          <CommentSidebar comments={comments} applyingId={applyingId} onApply={onApply}
            onCommentClick={(id) => { const el = document.querySelector(`mark[data-comment-id="${id}"]`); el?.scrollIntoView({ block: "center" }); }} />
        </aside>
      </div>
    </div>
  );
}
