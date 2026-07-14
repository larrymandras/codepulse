// Standalone client-only Scan-button fetch hook — zero Convex involvement.
// Consumed by IntakeModal.tsx (Task 2b) to drive SkillCollectionPicker.tsx.
import { useCallback, useMemo, useState } from "react";
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

  const scan = useCallback(async (input: string) => {
    const parsed = extractOwnerRepoRef(input);
    if (!parsed) {
      setState({ status: "error", errorMessage: "Not a recognized GitHub URL form" });
      return;
    }
    setState({ status: "scanning" });
    try {
      const res = await fetch(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${parsed.ref}?recursive=1`
      );
      if (!res.ok) {
        setState({ status: "error", errorMessage: classifyScanError(res.status) });
        return;
      }
      const data = await res.json();
      setState({ status: "done", result: parseTreeResponse(data) });
    } catch {
      setState({ status: "error", errorMessage: classifyScanError(0) });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  // CR-01: the returned object MUST be referentially stable across renders
  // when nothing changed — consumers (SkillCollectionPicker's auto-select
  // effect) key effects off it, and a fresh object literal per render drove
  // an infinite update loop ("Maximum update depth exceeded").
  return useMemo(() => ({ ...state, scan, reset }), [state, scan, reset]);
}
