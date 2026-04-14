/**
 * ConditionBuilder — visual AND/OR compound condition editor.
 *
 * Each condition row: [metric] [operator] [threshold] [lookbackWindow] [×]
 * Between rows: AND/OR toggle pill
 * "Add condition" button appends new row
 * "Add group" button appends one indented sub-group
 * Sub-groups have their own AND/OR toggle
 *
 * T-06-11 mitigation: threshold Input is type="number" min=0
 *
 * Phase 06-05: ALR-04 custom rule condition editor
 */

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Condition {
  metric: string;
  operator: string;
  threshold: number;
  lookbackWindow: string;
}

export interface ConditionGroup {
  conditions: Condition[];
  logic: "AND" | "OR";
}

interface ConditionBuilderProps {
  conditions: Condition[];
  conditionLogic: "AND" | "OR";
  conditionGroups?: ConditionGroup[];
  onChange: (
    conditions: Condition[],
    logic: "AND" | "OR",
    groups: ConditionGroup[]
  ) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Only metrics with backend evaluation support in alerts.ts evaluateCondition.
// Pending backend implementation: cost_per_hour, stall_duration, security_blocks,
// execution_failures, latency_p95, memory_usage
const METRICS = [
  "error_rate",
  "event_count",
  "error_count",
];

const OPERATORS = [
  { label: "> (greater than)", value: "gt" },
  { label: "< (less than)", value: "lt" },
  { label: ">= (at least)", value: "gte" },
  { label: "<= (at most)", value: "lte" },
  { label: "= (equals)", value: "eq" },
];

const LOOKBACK_WINDOWS = ["5m", "15m", "30m", "1h", "24h"];

const EMPTY_CONDITION: Condition = {
  metric: "error_rate",
  operator: "gt",
  threshold: 0,
  lookbackWindow: "15m",
};

// ─── Single condition row ─────────────────────────────────────────────────────

function ConditionRow({
  condition,
  onChange,
  onRemove,
  removable,
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Metric */}
      <Select
        value={condition.metric}
        onValueChange={(v) => onChange({ ...condition, metric: v })}
      >
        <SelectTrigger className="w-40" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METRICS.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select
        value={condition.operator}
        onValueChange={(v) => onChange({ ...condition, operator: v })}
      >
        <SelectTrigger className="w-12" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Threshold (T-06-11: type=number, min=0) */}
      <Input
        type="number"
        min={0}
        step="any"
        value={condition.threshold}
        onChange={(e) =>
          onChange({ ...condition, threshold: parseFloat(e.target.value) || 0 })
        }
        className="w-24 h-8 text-sm"
        placeholder="0"
      />

      {/* Lookback window */}
      <Select
        value={condition.lookbackWindow}
        onValueChange={(v) => onChange({ ...condition, lookbackWindow: v })}
      >
        <SelectTrigger className="w-20" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOOKBACK_WINDOWS.map((w) => (
            <SelectItem key={w} value={w}>
              {w}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Remove button */}
      {removable && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
          type="button"
          aria-label="Remove condition"
        >
          <XIcon className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

// ─── Logic toggle pill ────────────────────────────────────────────────────────

function LogicToggle({
  logic,
  onToggle,
}: {
  logic: "AND" | "OR";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-xs bg-muted px-2 py-1 rounded font-medium hover:bg-muted/80 transition-colors"
      aria-label={`Condition logic: ${logic}. Click to toggle.`}
    >
      {logic}
    </button>
  );
}

// ─── ConditionBuilder ─────────────────────────────────────────────────────────

export function ConditionBuilder({
  conditions,
  conditionLogic,
  conditionGroups = [],
  onChange,
}: ConditionBuilderProps) {
  function updateCondition(idx: number, updated: Condition) {
    const next = conditions.map((c, i) => (i === idx ? updated : c));
    onChange(next, conditionLogic, conditionGroups);
  }

  function removeCondition(idx: number) {
    const next = conditions.filter((_, i) => i !== idx);
    onChange(next, conditionLogic, conditionGroups);
  }

  function addCondition() {
    onChange(
      [...conditions, { ...EMPTY_CONDITION }],
      conditionLogic,
      conditionGroups
    );
  }

  function toggleLogic() {
    onChange(
      conditions,
      conditionLogic === "AND" ? "OR" : "AND",
      conditionGroups
    );
  }

  function addGroup() {
    const newGroup: ConditionGroup = {
      conditions: [{ ...EMPTY_CONDITION }],
      logic: "AND",
    };
    onChange(conditions, conditionLogic, [...conditionGroups, newGroup]);
  }

  function updateGroup(gIdx: number, updated: ConditionGroup) {
    const next = conditionGroups.map((g, i) => (i === gIdx ? updated : g));
    onChange(conditions, conditionLogic, next);
  }

  function removeGroup(gIdx: number) {
    const next = conditionGroups.filter((_, i) => i !== gIdx);
    onChange(conditions, conditionLogic, next);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Top-level conditions */}
      {conditions.map((cond, idx) => (
        <div key={idx} className="flex flex-col gap-1">
          <ConditionRow
            condition={cond}
            onChange={(updated) => updateCondition(idx, updated)}
            onRemove={() => removeCondition(idx)}
            removable={conditions.length > 1 || conditionGroups.length > 0}
          />
          {/* Logic toggle between rows */}
          {idx < conditions.length - 1 && (
            <div className="pl-1">
              <LogicToggle logic={conditionLogic} onToggle={toggleLogic} />
            </div>
          )}
          {/* Logic toggle between last top-level condition and first group */}
          {idx === conditions.length - 1 && conditionGroups.length > 0 && (
            <div className="pl-1">
              <LogicToggle logic={conditionLogic} onToggle={toggleLogic} />
            </div>
          )}
        </div>
      ))}

      {/* Sub-groups (one level of nesting only) */}
      {conditionGroups.map((group, gIdx) => (
        <div key={gIdx} className="pl-6 border-l-2 border-muted flex flex-col gap-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Group</span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={() => removeGroup(gIdx)}
              type="button"
              aria-label="Remove group"
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
          {group.conditions.map((cond, cIdx) => (
            <div key={cIdx} className="flex flex-col gap-1">
              <ConditionRow
                condition={cond}
                onChange={(updated) => {
                  const newConds = group.conditions.map((c, i) =>
                    i === cIdx ? updated : c
                  );
                  updateGroup(gIdx, { ...group, conditions: newConds });
                }}
                onRemove={() => {
                  const newConds = group.conditions.filter((_, i) => i !== cIdx);
                  updateGroup(gIdx, { ...group, conditions: newConds });
                }}
                removable={group.conditions.length > 1}
              />
              {cIdx < group.conditions.length - 1 && (
                <div className="pl-1">
                  <LogicToggle
                    logic={group.logic}
                    onToggle={() =>
                      updateGroup(gIdx, {
                        ...group,
                        logic: group.logic === "AND" ? "OR" : "AND",
                      })
                    }
                  />
                </div>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="w-fit text-sm mt-1"
            onClick={() =>
              updateGroup(gIdx, {
                ...group,
                conditions: [...group.conditions, { ...EMPTY_CONDITION }],
              })
            }
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add condition
          </Button>
        </div>
      ))}

      {/* Footer actions */}
      <div className="flex items-center gap-2 mt-1">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="text-sm"
          onClick={addCondition}
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          Add condition
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="text-sm"
          onClick={addGroup}
        >
          Add group
        </Button>
      </div>
    </div>
  );
}
