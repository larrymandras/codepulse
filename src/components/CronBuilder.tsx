import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FREQUENCY_TO_CRON,
  cronToHuman,
  isValidCron,
  type FrequencyPreset,
} from "@/lib/cronToHuman";

interface CronBuilderProps {
  initialName?: string;
  initialExpression?: string;
  onSave: (name: string, expression: string) => void;
  onCancel: () => void;
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

function detectFrequency(expr: string): FrequencyPreset {
  if (!expr || expr === "* * * * *") return "every_minute";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "custom";
  const [min, hour, dom, mon, dow] = parts;
  if (dom === "*" && mon === "*") {
    if (hour === "*" && min === "*") return "every_minute";
    if (hour === "*") return "every_hour";
    if (dow === "*") return "every_day";
    return "every_week";
  }
  return "custom";
}

function parseExpressionParts(expr: string) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { hour: 0, minute: 0, dayOfWeek: 1 };
  const [min, hour, , , dow] = parts;
  return {
    hour: hour === "*" ? 0 : parseInt(hour) || 0,
    minute: min === "*" ? 0 : parseInt(min) || 0,
    dayOfWeek: dow === "*" ? 1 : parseInt(dow) || 1,
  };
}

export default function CronBuilder({
  initialName,
  initialExpression,
  onSave,
  onCancel,
}: CronBuilderProps) {
  const initial = initialExpression ?? "";
  const detectedFreq = detectFrequency(initial);
  const parsedParts = parseExpressionParts(initial);

  const [name, setName] = useState(initialName ?? "");
  const [frequency, setFrequency] = useState<FrequencyPreset>(detectedFreq);
  const [hour, setHour] = useState(parsedParts.hour);
  const [minute, setMinute] = useState(parsedParts.minute);
  const [dayOfWeek, setDayOfWeek] = useState(parsedParts.dayOfWeek);
  const [customExpr, setCustomExpr] = useState(
    detectedFreq === "custom" ? initial : ""
  );

  const expression =
    frequency === "custom"
      ? customExpr
      : FREQUENCY_TO_CRON[frequency](hour, minute, dayOfWeek);

  const humanReadable = cronToHuman(expression);
  const isValid = frequency === "custom" ? isValidCron(customExpr) : true;
  const canSave = name.trim().length > 0 && isValid;

  return (
    <div className="flex flex-col gap-4">
      {/* Name field */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cron-name">Name</Label>
        <Input
          id="cron-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Job name"
        />
      </div>

      {/* Frequency selector */}
      <div className="flex flex-col gap-1.5">
        <Label>Frequency</Label>
        <Select
          value={frequency}
          onValueChange={(v) => setFrequency(v as FrequencyPreset)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="every_minute">Every minute</SelectItem>
            <SelectItem value="every_hour">Every hour</SelectItem>
            <SelectItem value="every_day">Every day</SelectItem>
            <SelectItem value="every_week">Every week</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conditional dropdowns */}
      {frequency === "every_hour" && (
        <div className="flex flex-col gap-1.5">
          <Label>Minute</Label>
          <Select
            value={String(minute)}
            onValueChange={(v) => setMinute(parseInt(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Minute" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 60 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {String(i).padStart(2, "0")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {frequency === "every_day" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Hour</Label>
            <Select
              value={String(hour)}
              onValueChange={(v) => setHour(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {String(i).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Minute</Label>
            <Select
              value={String(minute)}
              onValueChange={(v) => setMinute(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Minute" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 60 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {String(i).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {frequency === "every_week" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Day of Week</Label>
            <Select
              value={String(dayOfWeek)}
              onValueChange={(v) => setDayOfWeek(parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Hour</Label>
              <Select
                value={String(hour)}
                onValueChange={(v) => setHour(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {String(i).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Minute</Label>
              <Select
                value={String(minute)}
                onValueChange={(v) => setMinute(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Minute" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 60 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {String(i).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {frequency === "custom" && (
        <div className="flex flex-col gap-1.5">
          <Label>Expression</Label>
          <Input
            value={customExpr}
            onChange={(e) => setCustomExpr(e.target.value)}
            className={
              !isValid && customExpr ? "border-(--destructive)" : ""
            }
            placeholder="* * * * *"
          />
        </div>
      )}

      {/* Expression output */}
      <div
        data-testid="cron-expression"
        className="font-mono text-xs bg-(--muted) px-2 py-1 border border-(--border)"
      >
        {expression || "* * * * *"}
      </div>

      {/* Human-readable preview */}
      <p
        data-testid="cron-preview"
        className="text-sm text-(--muted-foreground) italic"
      >
        {humanReadable}
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-2">
        <Button
          variant="default"
          className="w-full"
          disabled={!canSave}
          onClick={() => onSave(name, expression)}
        >
          Save Cron Job
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
