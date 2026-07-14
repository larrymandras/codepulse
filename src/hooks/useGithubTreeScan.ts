// STUB — Task 2a RED phase. Real implementation follows in GREEN commit.
import type { ScanResult } from "@/lib/githubTree";

export type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; result: ScanResult }
  | { status: "error"; errorMessage: string };

export function useGithubTreeScan(): ScanState & {
  scan: (input: string) => Promise<void>;
  reset: () => void;
} {
  throw new Error("not implemented");
}
