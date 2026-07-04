import { authHeaders, astridrApiBase, AstridrApiError } from "./astridrApi";

export interface DocRef {
  repo: string;
  path: string;
  doc_type: "gsd_spec";
  doc_hash: string;
}

export interface Anchor {
  quote: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  line_start: number;
  line_end: number;
}

export type DocCommentStatus = "open" | "acked" | "approved" | "resolved" | "stale";

export interface DocComment {
  id: string;
  doc_ref: DocRef;
  anchor: Anchor;
  comment: string;
  author: string;
  status: DocCommentStatus;
  assignee_persona: string | null;
  proposed_edit: string | null;
  resolution_note: string | null;
  profile_id: string;
  created_at: string;
  resolved_at: string | null;
}

export interface DocListItem {
  repo: string;
  path: string;
  doc_type: "gsd_spec";
}

export interface DocContent {
  repo: string;
  path: string;
  content: string;
  doc_hash: string;
}

export interface ApplyResult {
  status: "resolved" | "stale" | "skipped";
  row: Partial<DocComment>;
}

export interface CreateCommentInput {
  doc_ref: DocRef;
  anchor: Anchor;
  comment: string;
  author: string;
  profile_id: string;
  assignee_persona?: string | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${astridrApiBase()}${path}`, { headers: authHeaders(), ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = typeof body.detail === "string" ? body.detail : res.statusText;
    throw new AstridrApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string>) => "?" + new URLSearchParams(params).toString();

export function listDocs(profileId: string): Promise<{ docs: DocListItem[]; count: number }> {
  return req(`/api/doc-comments/docs${qs({ profile_id: profileId })}`);
}

export function readDoc(repo: string, path: string): Promise<DocContent> {
  return req(`/api/doc-comments/doc${qs({ repo, path })}`);
}

export function listCommentsForDoc(
  profileId: string,
  repo: string,
  path: string,
): Promise<{ comments: DocComment[]; count: number }> {
  return req(`/api/doc-comments/by-doc${qs({ profile_id: profileId, repo, path })}`);
}

export function createComment(input: CreateCommentInput): Promise<DocComment> {
  return req(`/api/doc-comments`, { method: "POST", body: JSON.stringify(input) });
}

export function ackComment(id: string): Promise<DocComment> {
  return req(`/api/doc-comments/${encodeURIComponent(id)}/ack`, { method: "POST" });
}

export function resolveComment(id: string, note: string, edit?: string): Promise<DocComment> {
  return req(`/api/doc-comments/${encodeURIComponent(id)}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolution_note: note, proposed_edit: edit ?? null }),
  });
}

export function applyComment(id: string): Promise<ApplyResult> {
  return req(`/api/doc-comments/${encodeURIComponent(id)}/apply`, { method: "POST" });
}
