// Standalone client-only Scan-button fetch hook — zero Convex involvement.
// Consumed by IntakeModal.tsx (Task 2b) to drive SkillCollectionPicker.tsx.
import { useCallback, useMemo, useRef, useState } from "react";
import {
  classifyScanError,
  extractOwnerRepoRef,
  parseTreeResponse,
  type ScanResult,
} from "@/lib/githubTree";

export type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; result: ScanResult }
  | { status: "error"; errorMessage: string };

export function useGithubTreeScan(): ScanState & {
  scan: (input: string) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<ScanState>({ status: "idle" });

  // WR-05: generation counter — every scan() and reset() bumps it, and an
  // in-flight fetch only commits its result if its generation is still
  // current. Without this, a slow repo-A response resolving after a reset
  // (URL edit) or a newer scan would overwrite the current state with stale
  // results.
  const genRef = useRef(0);

  const scan = useCallback(async (input: string) => {
    const gen = ++genRef.current;
    const parsed = extractOwnerRepoRef(input);
    if (!parsed) {
      setState({ status: "error", errorMessage: "Not a recognized GitHub URL form" });
      return;
    }
    setState({ status: "scanning" });
    const treeUrl = (ref: string) =>
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${ref}?recursive=1`;
    try {
      let res = await fetch(treeUrl(parsed.ref));
      if (gen !== genRef.current) return; // superseded by a reset/newer scan
      // review #2: a /tree/{ref} whose branch contains a slash (e.g.
      // release/1.0) is regex-indistinguishable from {branch}/{subpath}, so
      // extractOwnerRepoRef's first-segment ref can 404 for a branch that
      // plainly exists — and the server validator accepts the same URL, so
      // scan and submit would contradict. Before surfacing a false "not
      // found", retry against HEAD (the tree API accepts it as the default
      // branch), so a slash-branch or deep URL still discovers the repo's
      // skills instead of hard-failing.
      if (res.status === 404 && parsed.ref !== "HEAD") {
        res = await fetch(treeUrl("HEAD"));
        if (gen !== genRef.current) return; // superseded by a reset/newer scan
      }
      if (!res.ok) {
        setState({ status: "error", errorMessage: classifyScanError(res.status) });
        return;
      }
      const data = await res.json();
      if (gen !== genRef.current) return; // superseded by a reset/newer scan
      setState({ status: "done", result: parseTreeResponse(data) });
    } catch {
      if (gen !== genRef.current) return; // superseded by a reset/newer scan
      setState({ status: "error", errorMessage: classifyScanError(0) });
    }
  }, []);

  const reset = useCallback(() => {
    genRef.current++;
    setState({ status: "idle" });
  }, []);

  // CR-01: the returned object MUST be referentially stable across renders
  // when nothing changed — consumers (SkillCollectionPicker's auto-select
  // effect) key effects off it, and a fresh object literal per render drove
  // an infinite update loop ("Maximum update depth exceeded").
  return useMemo(() => ({ ...state, scan, reset }), [state, scan, reset]);
}
