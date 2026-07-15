// Pure GitHub-tree-response parsing for the multi-skill batch scanner
// (Plan 07-03, D-P7-08/09/10). No React, no Convex, no fetch — network
// I/O lives in useGithubTreeScan.ts (Task 2a), not here, so this module
// stays trivially unit-testable without mocking network calls.

export interface GithubTreeEntry {
  type: string;
  path: string;
}

export interface ScanResult {
  skillPaths: string[];
  truncated: boolean;
}

/**
 * Every blob-type tree entry whose path ends in SKILL.md (case-insensitive,
 * any depth). "tree"-type entries (directories) and non-SKILL.md blobs
 * (e.g. NOTSKILL.md) are excluded.
 */
export function extractSkillPaths(tree: GithubTreeEntry[]): string[] {
  return tree
    .filter((e) => e.type === "blob" && /(^|\/)SKILL\.md$/i.test(e.path))
    .map((e) => e.path);
}

/**
 * Parses a raw GitHub tree API response into a typed ScanResult.
 * `truncated` is read via a strict `=== true` check (Pitfall 1) — never
 * `!!data.truncated` and never inferred from array length, since the
 * absence of the field must default to `false`, not be treated as falsy
 * noise indistinguishable from an explicit `false`.
 */
export function parseTreeResponse(data: unknown): ScanResult {
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { tree?: unknown }).tree)
  ) {
    throw new Error("Malformed GitHub tree response");
  }
  const tree = (data as { tree: GithubTreeEntry[] }).tree;
  const truncated = (data as { truncated?: unknown }).truncated === true;
  return { skillPaths: extractSkillPaths(tree), truncated };
}

/** Thrown by the scan hook (Task 2a) when the tree-API fetch itself fails. */
export class ScanError extends Error {
  status: number;
  constructor(status: number) {
    super(`GitHub scan failed with status ${status}`);
    this.status = status;
  }
}

/**
 * Maps an HTTP status (or the hook's own `0` sentinel for a caught
 * network/fetch exception, never a real HTTP status) to a human-readable
 * error string. 403 and 404 are deliberately distinct: GitHub returns 404
 * for both a nonexistent repo and a private repo to an unauthenticated
 * caller — it is not technically possible to distinguish these without
 * authentication, so this does not fabricate a false split between them.
 */
export function classifyScanError(status: number): string {
  if (status === 403) return "rate limit reached";
  if (status === 404) return "repository not found or private";
  if (status === 0) return "network error";
  return "an unexpected error";
}

const GITHUB_FULL_URL_EXTRACT =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/.*)?\/?$/i;
const GITHUB_SHORTHAND_EXTRACT = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/;

/**
 * Extracts { owner, repo, ref } from either the full github.com URL form
 * or the owner/repo shorthand form. Mirrors the two regex SHAPES from
 * `isAcceptedGithubUrlShape` (convex/forge.ts L241-242) but as CAPTURING
 * extractors, not boolean testers — this is a narrower, separate concern
 * (extracting the tree-API call's coordinates), not a re-validation of the
 * accepted URL shape. Returns null for anything that matches neither form.
 *
 * `ref` defaults to "HEAD" when no `/tree/{ref}` segment is present — the
 * GitHub tree API accepts "HEAD" as an alias for the repository's default
 * branch (verified live against a public repo during this task's test run:
 * `GET /repos/{owner}/{repo}/git/trees/HEAD?recursive=1` on a real public
 * repo returns 200 with the default branch's tree, confirming HEAD works
 * as the tree-API ref without a prior `default_branch` lookup).
 */
export function extractOwnerRepoRef(
  input: string,
): { owner: string; repo: string; ref: string } | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const m = GITHUB_FULL_URL_EXTRACT.exec(trimmed);
    if (!m) return null;
    const [, owner, repo, ref] = m;
    return { owner, repo, ref: ref || "HEAD" };
  }
  const m = GITHUB_SHORTHAND_EXTRACT.exec(trimmed);
  if (!m) return null;
  const [, owner, repo] = m;
  return { owner, repo, ref: "HEAD" };
}
