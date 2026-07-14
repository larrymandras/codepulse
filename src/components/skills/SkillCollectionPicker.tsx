// STUB — Task 2a RED phase. Real implementation follows in GREEN commit.
import type { ScanState } from "@/hooks/useGithubTreeScan";

export interface SkillCollectionPickerProps {
  scanState: ScanState;
  onSelectionChange: (paths: string[]) => void;
}

export function SkillCollectionPicker(_props: SkillCollectionPickerProps) {
  throw new Error("not implemented");
}
