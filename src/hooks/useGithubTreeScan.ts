// Standalone client-only Scan-button fetch hook — zero Convex involvement.
// Consumed by IntakeModal.tsx (Task 2b) to drive SkillCollectionPicker.tsx.
import { useCallback, useState } from "react";
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

  return { ...state, scan, reset };
}
