// src/components/config/ToolsForm.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagChipInput } from "./TagChipInput";
import { Trash2, Plus } from "lucide-react";

interface ToolsFormProps {
  data: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

export function ToolsForm({ data, onChange }: ToolsFormProps) {
  const tools = (data.tools ?? {}) as Record<string, unknown>;
  const claudeCode = (data.claude_code ?? {}) as Record<string, unknown>;

  const builtinTools = (tools.builtin ?? []) as string[];
  const optionalTools = (tools.optional ?? []) as Record<string, unknown>[];
  const skills = (tools.skills ?? {}) as Record<string, unknown>;
  const plugins = (tools.plugins ?? {}) as Record<string, unknown>;

  function updateTools(key: string, value: unknown) {
    onChange({ ...data, tools: { ...tools, [key]: value } });
  }

  function updateClaudeCode(key: string, value: unknown) {
    onChange({ ...data, claude_code: { ...claudeCode, [key]: value } });
  }

  function updateOptionalTool(idx: number, key: string, value: string) {
    const updated = optionalTools.map((t, i) =>
      i === idx ? { ...t, [key]: value } : t
    );
    updateTools("optional", updated);
  }

  function addOptionalTool() {
    updateTools("optional", [...optionalTools, { name: "", requires_env: "" }]);
  }

  function removeOptionalTool(idx: number) {
    updateTools("optional", optionalTools.filter((_, i) => i !== idx));
  }

  function updateSkillsRoot(value: string) {
    updateTools("skills", { ...skills, root: value });
  }

  function updatePluginsRoot(value: string) {
    updateTools("plugins", { ...plugins, root: value });
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      {/* Built-in Tools */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Built-in Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <TagChipInput
            values={builtinTools}
            onChange={(v) => updateTools("builtin", v)}
            placeholder="Add tool..."
          />
        </CardContent>
      </Card>

      {/* Optional Tools */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Optional Tools</CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addOptionalTool}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span className="text-sm">Add</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {optionalTools.length > 0 && (
            <div className="grid grid-cols-[1fr_1fr_36px] gap-x-2 gap-y-1 items-center mb-2">
              <Label className="text-sm text-(--muted-foreground)">Name</Label>
              <Label className="text-sm text-(--muted-foreground)">Requires Env</Label>
              <span />
              {optionalTools.map((tool, idx) => (
                <>
                  <Input
                    key={`name-${idx}`}
                    value={String(tool.name ?? "")}
                    onChange={(e) => updateOptionalTool(idx, "name", e.target.value)}
                    placeholder="tool_name"
                    className="h-8 text-base font-mono"
                  />
                  <Input
                    key={`env-${idx}`}
                    value={String(tool.requires_env ?? "")}
                    onChange={(e) => updateOptionalTool(idx, "requires_env", e.target.value)}
                    placeholder="ENV_VAR_KEY"
                    className="h-8 text-base font-mono"
                  />
                  <Button
                    key={`del-${idx}`}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-(--muted-foreground) hover:text-(--destructive)"
                    onClick={() => removeOptionalTool(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ))}
            </div>
          )}
          {optionalTools.length === 0 && (
            <p className="text-sm text-(--muted-foreground)">No optional tools configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Skills & Plugins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skills & Plugins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">Skills root</Label>
            <Input
              value={String(skills.root ?? "")}
              onChange={(e) => updateSkillsRoot(e.target.value)}
              placeholder="~/.astridr/skills"
              className="h-8 text-base font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Plugins root</Label>
            <Input
              value={String(plugins.root ?? "")}
              onChange={(e) => updatePluginsRoot(e.target.value)}
              placeholder="~/.astridr/plugins"
              className="h-8 text-base font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {/* Claude Code */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claude Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-sm">Default working directory</Label>
            <Input
              value={String(claudeCode.default_working_dir ?? "")}
              onChange={(e) => updateClaudeCode("default_working_dir", e.target.value)}
              placeholder="/path/to/project"
              className="h-8 text-base font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">Max turns</Label>
              <Input
                type="number"
                value={claudeCode.max_turns != null ? String(claudeCode.max_turns) : ""}
                onChange={(e) =>
                  updateClaudeCode("max_turns", e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="25"
                className="h-8 text-base"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Timeout (seconds)</Label>
              <Input
                type="number"
                value={claudeCode.timeout_seconds != null ? String(claudeCode.timeout_seconds) : ""}
                onChange={(e) =>
                  updateClaudeCode("timeout_seconds", e.target.value ? parseInt(e.target.value) : undefined)
                }
                placeholder="300"
                className="h-8 text-base"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Allowed working directories</Label>
            <TagChipInput
              values={(claudeCode.allowed_working_dirs as string[]) ?? []}
              onChange={(v) => updateClaudeCode("allowed_working_dirs", v)}
              placeholder="Add path..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
