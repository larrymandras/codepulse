// src/components/config/PipesForm.tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus } from "lucide-react";
import * as jsYaml from "js-yaml";

interface PipesFormProps {
  data: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

const TRIGGER_OPTIONS = ["manual", "cron", "webhook"] as const;

const TRIGGER_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  cron: "default",
  webhook: "secondary",
  manual: "outline",
};

function dumpArgs(args: unknown): string {
  if (args == null) return "";
  if (typeof args === "string") return args;
  try {
    return jsYaml.dump(args, { lineWidth: -1 }).trimEnd();
  } catch {
    return String(args);
  }
}

function parseArgs(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return jsYaml.load(text) ?? {};
  } catch {
    // Invalid mid-edit — keep as raw string so the user can keep typing
    return text;
  }
}

export function PipesForm({ data, onChange }: PipesFormProps) {
  const pipelines = (data.pipelines ?? []) as Record<string, unknown>[];

  function updatePipeline(idx: number, key: string, value: unknown) {
    const updated = pipelines.map((p, i) =>
      i === idx ? { ...p, [key]: value } : p
    );
    onChange({ ...data, pipelines: updated });
  }

  function updateStep(
    pipeIdx: number,
    stepIdx: number,
    key: string,
    value: unknown
  ) {
    const pipe = pipelines[pipeIdx];
    const steps = ((pipe.steps ?? []) as Record<string, unknown>[]).map(
      (s, i) => (i === stepIdx ? { ...s, [key]: value } : s)
    );
    updatePipeline(pipeIdx, "steps", steps);
  }

  function removeStep(pipeIdx: number, stepIdx: number) {
    const pipe = pipelines[pipeIdx];
    const steps = ((pipe.steps ?? []) as Record<string, unknown>[]).filter(
      (_, i) => i !== stepIdx
    );
    updatePipeline(pipeIdx, "steps", steps);
  }

  function addStep(pipeIdx: number) {
    const pipe = pipelines[pipeIdx];
    const steps = [
      ...((pipe.steps ?? []) as Record<string, unknown>[]),
      {
        name: "",
        tool: "",
        args: {},
        timeout_ms: 30000,
        approval_required: false,
      },
    ];
    updatePipeline(pipeIdx, "steps", steps);
  }

  return (
    <div className="space-y-2 overflow-y-auto h-full pr-1">
      <Accordion type="multiple" className="space-y-2">
        {pipelines.map((pipe, pipeIdx) => {
          const name = String(pipe.name ?? `pipeline-${pipeIdx}`);
          const trigger = String(pipe.trigger ?? "manual");
          const steps = (pipe.steps ?? []) as Record<string, unknown>[];

          return (
            <AccordionItem
              key={`pipe-${pipeIdx}`}
              value={`pipe-${pipeIdx}`}
              className="border border-(--border) rounded-md"
            >
              {/* Collapsed row */}
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <span className="font-semibold text-sm">{name}</span>
                  <div className="flex items-center gap-2 ml-auto mr-4">
                    <Badge
                      variant={TRIGGER_VARIANTS[trigger] ?? "outline"}
                      className="text-[10px]"
                    >
                      {trigger}
                    </Badge>
                    <span className="text-xs text-(--muted-foreground) font-mono">
                      {steps.length} step{steps.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>

              {/* Expanded card */}
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-6">
                  {/* Pipeline identity */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Pipeline
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={String(pipe.name ?? "")}
                          onChange={(e) =>
                            updatePipeline(pipeIdx, "name", e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Trigger</Label>
                        <Select
                          value={trigger}
                          onValueChange={(v) =>
                            updatePipeline(pipeIdx, "trigger", v)
                          }
                        >
                          <SelectTrigger size="sm" className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TRIGGER_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Steps */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Steps
                    </h4>

                    {steps.map((step, stepIdx) => (
                      <div
                        key={`step-${stepIdx}`}
                        className="border border-(--border) rounded-md p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-(--muted-foreground)">
                            Step {stepIdx + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeStep(pipeIdx, stepIdx)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-(--muted-foreground)" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Step name</Label>
                            <Input
                              value={String(step.name ?? "")}
                              onChange={(e) =>
                                updateStep(
                                  pipeIdx,
                                  stepIdx,
                                  "name",
                                  e.target.value
                                )
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Tool</Label>
                            <Input
                              value={String(step.tool ?? "")}
                              onChange={(e) =>
                                updateStep(
                                  pipeIdx,
                                  stepIdx,
                                  "tool",
                                  e.target.value
                                )
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Args (YAML)</Label>
                          <Textarea
                            value={dumpArgs(step.args)}
                            onChange={(e) =>
                              updateStep(
                                pipeIdx,
                                stepIdx,
                                "args",
                                parseArgs(e.target.value)
                              )
                            }
                            rows={3}
                            className="text-sm font-mono"
                            placeholder="key: value"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Timeout (ms)</Label>
                            <Input
                              type="number"
                              value={
                                step.timeout_ms != null
                                  ? String(step.timeout_ms)
                                  : ""
                              }
                              onChange={(e) =>
                                updateStep(
                                  pipeIdx,
                                  stepIdx,
                                  "timeout_ms",
                                  e.target.value
                                    ? parseInt(e.target.value)
                                    : undefined
                                )
                              }
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <Checkbox
                              id={`approval-${pipeIdx}-${stepIdx}`}
                              checked={!!step.approval_required}
                              onCheckedChange={(v) =>
                                updateStep(
                                  pipeIdx,
                                  stepIdx,
                                  "approval_required",
                                  !!v
                                )
                              }
                            />
                            <Label
                              htmlFor={`approval-${pipeIdx}-${stepIdx}`}
                              className="text-xs font-normal"
                            >
                              Approval required
                            </Label>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => addStep(pipeIdx)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Add step
                    </Button>
                  </section>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
