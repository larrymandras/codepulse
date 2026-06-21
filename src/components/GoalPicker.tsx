/**
 * GoalPicker — shadcn Select wrapping the live goal list.
 *
 * Phase 149-04 — PULSE-04.
 * Enumerates active + recently-completed goals from useGoalList() (Plan 03).
 * Shows Skeleton while loading.
 */

import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGoalList, type SwarmGoalRow } from "../hooks/useSwarmGraph";

const COMPLETED_STATES = new Set(["done", "failed", "verify_rejected"]);
const ACTIVE_STATES = new Set(["pending", "claimed", "running", "verifying"]);

/** Truncate a string to max length with ellipsis */
function trunc(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

/** Format a goal option label per UI-SPEC */
function goalLabel(g: SwarmGoalRow): string {
  return `${g.goalId.slice(0, 8)}… — ${trunc(g.firstSubtask, 40)}`;
}

interface GoalPickerProps {
  selectedGoalId: string | null | undefined;
  onSelect: (goalId: string) => void;
}

export default function GoalPicker({ selectedGoalId, onSelect }: GoalPickerProps) {
  const goals = useGoalList();

  // undefined means still loading
  const isLoading = (goals as SwarmGoalRow[] | undefined) === undefined;

  if (isLoading) {
    return <Skeleton className="w-72 h-9" />;
  }

  const activeGoals = goals.filter((g) => ACTIVE_STATES.has(g.latestState));
  const completedGoals = goals.filter((g) => COMPLETED_STATES.has(g.latestState));

  return (
    <Select value={selectedGoalId ?? ""} onValueChange={onSelect}>
      <SelectTrigger className="w-72">
        <SelectValue placeholder="Select a goal..." />
      </SelectTrigger>
      <SelectContent>
        {activeGoals.length > 0 && (
          <SelectGroup>
            <SelectLabel>Active</SelectLabel>
            {activeGoals.map((g) => (
              <SelectItem key={g.goalId} value={g.goalId}>
                {goalLabel(g)}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {completedGoals.length > 0 && (
          <SelectGroup>
            <SelectLabel>Completed (last 7 days)</SelectLabel>
            {completedGoals.map((g) => (
              <SelectItem key={g.goalId} value={g.goalId}>
                {goalLabel(g)}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {activeGoals.length === 0 && completedGoals.length === 0 && (
          <SelectGroup>
            <SelectLabel className="text-muted-foreground">No goals found</SelectLabel>
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
