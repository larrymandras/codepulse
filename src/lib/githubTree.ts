// STUB — Task 1 RED phase. Real implementation follows in GREEN commit.

export interface GithubTreeEntry {
  type: string;
  path: string;
}

export interface ScanResult {
  skillPaths: string[];
  truncated: boolean;
}

export function extractSkillPaths(_tree: GithubTreeEntry[]): string[] {
  throw new Error("not implemented");
}

export function parseTreeResponse(_data: unknown): ScanResult {
  throw new Error("not implemented");
}

export class ScanError extends Error {
  status: number;
  constructor(status: number) {
    super(`GitHub scan failed with status ${status}`);
    this.status = status;
  }
}

export function classifyScanError(_status: number): string {
  throw new Error("not implemented");
}

export function extractOwnerRepoRef(
  _input: string,
): { owner: string; repo: string; ref: string } | null {
  throw new Error("not implemented");
}
