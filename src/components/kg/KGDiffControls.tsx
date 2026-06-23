/**
 * KGDiffControls — From/To date pickers + Compare button (Phase 87, KG-11, Plan 03).
 *
 * Renders the "Diff" sub-mode row inside KGControls when `temporalSubMode === "diff"`.
 * Date handling mirrors the existing as-of Input in KGControls.tsx (lines 125-156).
 * Compare button disabled until both dates are set AND From < To (D-08 / UI-SPEC).
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface KGDiffControlsProps {
  dateA: string | null;
  dateB: string | null;
  onChangeA: (d: string | null) => void;
  onChangeB: (d: string | null) => void;
  onCompare: () => void;
  loading: boolean;
}

export default function KGDiffControls({
  dateA,
  dateB,
  onChangeA,
  onChangeB,
  onCompare,
  loading,
}: KGDiffControlsProps) {
  // Show validation hint when dates are set but invalid order
  const datesSet = !!dateA && !!dateB;
  const compareDisabled = !dateA || !dateB || dateA >= dateB || loading;
  const showHint = datesSet && dateA >= dateB;

  function handleChangeA(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChangeA(v ? new Date(v).toISOString() : null);
  }

  function handleChangeB(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChangeB(v ? new Date(v).toISOString() : null);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-sm text-muted-foreground">
      {/* From date picker */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="kg-diff-from"
          className="whitespace-nowrap text-[10px] uppercase tracking-wide"
        >
          From
        </label>
        <Input
          id="kg-diff-from"
          type="date"
          value={dateA ? dateA.slice(0, 10) : ""}
          onChange={handleChangeA}
          className="w-40 font-mono text-sm"
          aria-label="Diff from date"
        />
      </div>

      {/* To date picker */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="kg-diff-to"
          className="whitespace-nowrap text-[10px] uppercase tracking-wide"
        >
          To
        </label>
        <Input
          id="kg-diff-to"
          type="date"
          value={dateB ? dateB.slice(0, 10) : ""}
          onChange={handleChangeB}
          className="w-40 font-mono text-sm"
          aria-label="Diff to date"
        />
      </div>

      {/* Compare button */}
      <Button
        variant="secondary"
        size="sm"
        className="font-mono text-sm"
        disabled={compareDisabled}
        onClick={onCompare}
        aria-label="Compare snapshots"
      >
        Compare
      </Button>

      {/* Inline validation hint */}
      {showHint && (
        <span className="text-[10px] text-muted-foreground/60">
          Select two different dates to compare.
        </span>
      )}
    </div>
  );
}
