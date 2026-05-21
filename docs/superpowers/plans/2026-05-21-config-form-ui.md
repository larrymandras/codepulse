# Config Page Form UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw YAML config editor with a tabbed settings page — hand-crafted forms for security-rules and agent-types, enhanced YAML editor for tools/profiles/pipes.

**Architecture:** Parent ConfigPage owns WebSocket interaction and tab state. Each section is a controlled form component receiving parsed data and calling onChange. TagChipInput and InlineTable are reusable primitives shared across sections. Raw YAML toggle serializes form state to/from YAML via js-yaml.

**Tech Stack:** React, shadcn/ui (Tabs, Switch, Slider, Badge, Card, Accordion, Input, Select), Tailwind CSS, js-yaml, CodeMirror, lucide-react

---

### Task 1: TagChipInput — Reusable Tag Chip Array

**Files:**
- Create: `src/components/config/TagChipInput.tsx`

This is a shared primitive used by SecurityRulesForm (protected env vars) and AgentTypesForm (tools, channels, kits, capabilities, peer comm).

- [ ] **Step 1: Create TagChipInput component**

```tsx
// src/components/config/TagChipInput.tsx
import { useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface TagChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagChipInput({ values, onChange, placeholder = "Add..." }: TagChipInputProps) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!values.includes(input.trim())) {
        onChange([...values, input.trim()]);
      }
      setInput("");
    }
  }

  function handleRemove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1">
          {v}
          <button
            type="button"
            onClick={() => handleRemove(v)}
            className="ml-0.5 rounded-full hover:bg-(--muted) p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-7 w-32 text-xs"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/config/TagChipInput.tsx
git commit -m "feat(config): add TagChipInput reusable component"
```

---

### Task 2: InlineTable — Reusable Editable Row Table

**Files:**
- Create: `src/components/config/InlineTable.tsx`

Used by AgentTypesForm for autonomy rules and daily rhythm tables.

- [ ] **Step 1: Create InlineTable component**

```tsx
// src/components/config/InlineTable.tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  type: "text" | "select" | "checkbox";
  options?: string[];
  placeholder?: string;
  width?: string;
}

interface InlineTableProps {
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
  emptyRow: Record<string, unknown>;
}

export function InlineTable({ columns, rows, onChange, emptyRow }: InlineTableProps) {
  function updateCell(rowIdx: number, key: string, value: unknown) {
    const updated = rows.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r));
    onChange(updated);
  }

  function addRow() {
    onChange([...rows, { ...emptyRow }]);
  }

  function removeRow(rowIdx: number) {
    onChange(rows.filter((_, i) => i !== rowIdx));
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-(--muted-foreground) font-medium px-1">
        {columns.map((col) => (
          <div key={col.key} className="flex-1" style={col.width ? { width: col.width, flex: "none" } : undefined}>
            {col.label}
          </div>
        ))}
        <div className="w-8" />
      </div>

      {/* Rows */}
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-2">
          {columns.map((col) => (
            <div key={col.key} className="flex-1" style={col.width ? { width: col.width, flex: "none" } : undefined}>
              {col.type === "text" && (
                <Input
                  value={(row[col.key] as string) ?? ""}
                  onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                  placeholder={col.placeholder}
                  className="h-7 text-xs"
                />
              )}
              {col.type === "select" && col.options && (
                <Select
                  value={(row[col.key] as string) ?? ""}
                  onValueChange={(v) => updateCell(rowIdx, col.key, v)}
                >
                  <SelectTrigger size="sm" className="h-7 text-xs">
                    <SelectValue placeholder={col.placeholder ?? "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {col.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {col.type === "checkbox" && (
                <Checkbox
                  checked={!!row[col.key]}
                  onCheckedChange={(v) => updateCell(rowIdx, col.key, v)}
                />
              )}
            </div>
          ))}
          <Button variant="ghost" size="icon-xs" onClick={() => removeRow(rowIdx)}>
            <Trash2 className="h-3 w-3 text-(--muted-foreground)" />
          </Button>
        </div>
      ))}

      <Button variant="ghost" size="xs" onClick={addRow} className="text-xs gap-1 mt-1">
        <Plus className="h-3 w-3" /> Add row
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/config/InlineTable.tsx
git commit -m "feat(config): add InlineTable reusable component"
```

---

### Task 3: YamlSection — Extracted YAML Editor

**Files:**
- Create: `src/components/config/YamlSection.tsx`

Extracts the CodeMirror editor from the current ConfigEditor into a reusable component. Used for tools, profiles, pipes tabs and as the raw YAML escape hatch for form tabs.

- [ ] **Step 1: Create YamlSection component**

```tsx
// src/components/config/YamlSection.tsx
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { githubDark } from "@uiw/codemirror-theme-github";

interface YamlSectionProps {
  value: string;
  onChange: (value: string) => void;
  description?: string;
}

export function YamlSection({ value, onChange, description }: YamlSectionProps) {
  return (
    <div className="flex flex-col h-full">
      {description && (
        <p className="text-xs text-(--muted-foreground) px-1 pb-2">{description}</p>
      )}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          height="100%"
          extensions={[yaml()]}
          theme={githubDark}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/config/YamlSection.tsx
git commit -m "feat(config): extract YamlSection editor component"
```

---

### Task 4: SecurityRulesForm — Toggle Grid + Threshold + Env Vars

**Files:**
- Create: `src/components/config/SecurityRulesForm.tsx`

Hand-crafted form for the security-rules config section. Displays toggles for each security layer, a slider for risk threshold, and tag chips for protected env vars.

- [ ] **Step 1: Create SecurityRulesForm component**

```tsx
// src/components/config/SecurityRulesForm.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { TagChipInput } from "./TagChipInput";

interface SecurityRulesFormProps {
  data: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

const CORE_LAYERS: { key: string; layer: string; label: string }[] = [
  { key: "pii_filter_enabled", layer: "L1", label: "PII Filter" },
  { key: "injection_defense_enabled", layer: "L3", label: "Injection Defense" },
  { key: "command_blocklist_enabled", layer: "L4", label: "Command Blocklist" },
  { key: "secret_scanner_enabled", layer: "L6", label: "Secret Scanner" },
  { key: "credential_access_enabled", layer: "L8", label: "Credential Access" },
  { key: "egress_control_enabled", layer: "L9", label: "Egress Control" },
  { key: "rls_enforcement_enabled", layer: "L10", label: "RLS Enforcement" },
  { key: "output_filter_enabled", layer: "L12", label: "Output Filter" },
  { key: "audit_log_enabled", layer: "L13", label: "Audit Logging" },
  { key: "hitl_gate_enabled", layer: "L14", label: "HITL Gate" },
];

const ADVANCED_LAYERS: { key: string; label: string; muted?: boolean }[] = [
  { key: "dm_pairing", label: "DM Pairing" },
  { key: "exfil_guard_enabled", label: "Exfil Guard" },
  { key: "dlp_enabled", label: "DLP (reserved)", muted: true },
];

export function SecurityRulesForm({ data, onChange }: SecurityRulesFormProps) {
  const security = (data.security ?? data) as Record<string, unknown>;

  function update(key: string, value: unknown) {
    const updated = { ...data };
    const sec = { ...(updated.security ?? updated) as Record<string, unknown>, [key]: value };
    if (data.security) {
      updated.security = sec;
    }
    onChange(data.security ? updated : sec);
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      {/* Core Security Layers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Core Security Layers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {CORE_LAYERS.map((layer, idx) => (
            <div
              key={layer.key}
              className={`flex items-center justify-between py-2.5 px-2 ${
                idx % 2 === 0 ? "bg-(--muted)/30" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px] font-mono w-8 justify-center">
                  {layer.layer}
                </Badge>
                <Label className="text-sm font-normal">{layer.label}</Label>
              </div>
              <Switch
                size="sm"
                checked={!!security[layer.key]}
                onCheckedChange={(v) => update(layer.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Advanced</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {ADVANCED_LAYERS.map((layer, idx) => (
            <div
              key={layer.key}
              className={`flex items-center justify-between py-2.5 px-2 ${
                idx % 2 === 0 ? "bg-(--muted)/30" : ""
              }`}
            >
              <Label className={`text-sm font-normal ${layer.muted ? "text-(--muted-foreground)" : ""}`}>
                {layer.label}
              </Label>
              <Switch
                size="sm"
                checked={!!security[layer.key]}
                onCheckedChange={(v) => update(layer.key, v)}
              />
            </div>
          ))}
          {security.dm_pairing && security.dm_pairs_file && (
            <p className="text-xs text-(--muted-foreground) px-2 pt-1">
              Pairs file: {security.dm_pairs_file as string}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-normal">Legal HITL Risk Threshold</Label>
              <span className="text-sm font-mono tabular-nums w-8 text-right">
                {(security.legal_hitl_risk_threshold as number) ?? 70}
              </span>
            </div>
            <Slider
              value={[(security.legal_hitl_risk_threshold as number) ?? 70]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => update("legal_hitl_risk_threshold", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Protected Env Vars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Protected Env Vars</CardTitle>
        </CardHeader>
        <CardContent>
          <TagChipInput
            values={(security.protected_env_vars as string[]) ?? []}
            onChange={(v) => update("protected_env_vars", v)}
            placeholder="Add variable..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/config/SecurityRulesForm.tsx
git commit -m "feat(config): add SecurityRulesForm with toggle grid, threshold slider, env var chips"
```

---

### Task 5: AgentTypesForm — Accordion Card List

**Files:**
- Create: `src/components/config/AgentTypesForm.tsx`

Hand-crafted form for the agent-types config section. Accordion of agent cards with scan-optimized collapsed rows and grouped fields when expanded.

- [ ] **Step 1: Create AgentTypesForm component**

```tsx
// src/components/config/AgentTypesForm.tsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TagChipInput } from "./TagChipInput";
import { InlineTable, type ColumnDef } from "./InlineTable";

interface AgentTypesFormProps {
  data: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

const AUTONOMY_COLUMNS: ColumnDef[] = [
  { key: "pattern", label: "Pattern", type: "text", placeholder: "e.g. send_email.*" },
  { key: "level", label: "Level", type: "select", options: ["silent", "draft_approval", "always_ask", "blocked"] },
  { key: "notify_after", label: "Notify", type: "checkbox", width: "60px" },
];

const RHYTHM_COLUMNS: ColumnDef[] = [
  { key: "time", label: "Time", type: "text", placeholder: "HH:MM", width: "80px" },
  { key: "action", label: "Action", type: "text", placeholder: "Task description" },
  { key: "channel", label: "Channel", type: "select", options: ["internal", "slack", "telegram", "email", "web"] },
  { key: "days", label: "Days", type: "text", placeholder: "mon-fri", width: "100px" },
  { key: "profile", label: "Profile", type: "text", placeholder: "Profile ID", width: "100px" },
];

const TIER_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  command: "default",
  domain: "secondary",
  shared: "outline",
};

export function AgentTypesForm({ data, onChange }: AgentTypesFormProps) {
  const agents = (data.agent_types ?? []) as Record<string, unknown>[];

  function updateAgent(idx: number, key: string, value: unknown) {
    const updated = agents.map((a, i) => (i === idx ? { ...a, [key]: value } : a));
    onChange({ ...data, agent_types: updated });
  }

  function updateAgentNested(idx: number, updates: Record<string, unknown>) {
    const updated = agents.map((a, i) => (i === idx ? { ...a, ...updates } : a));
    onChange({ ...data, agent_types: updated });
  }

  return (
    <div className="space-y-2 overflow-y-auto h-full pr-1">
      <Accordion type="multiple" className="space-y-2">
        {agents.map((agent, idx) => {
          const id = (agent.id as string) ?? `agent-${idx}`;
          const name = (agent.name as string) ?? id;
          const tier = (agent.tier as string) ?? "shared";
          const active = agent.active !== false;
          const budget = agent.budget_fraction as number | undefined;
          const model = agent.model_override as string | undefined;
          const norseMeaning = agent.norse_meaning as string | undefined;

          return (
            <AccordionItem key={id} value={id} className="border border-(--border) rounded-md">
              {/* Collapsed: scan row */}
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <span className="font-semibold text-sm">{name}</span>
                  {norseMeaning && (
                    <span className="text-xs text-(--muted-foreground) truncate">{norseMeaning}</span>
                  )}
                  <div className="flex items-center gap-2 ml-auto mr-4">
                    <Badge variant={TIER_VARIANTS[tier] ?? "outline"} className="text-[10px]">
                      {tier}
                    </Badge>
                    <Badge variant={active ? "default" : "secondary"} className="text-[10px]">
                      {active ? "active" : "inactive"}
                    </Badge>
                    <span className="text-xs text-(--muted-foreground) font-mono">
                      {model ?? "default"}
                    </span>
                    {budget != null && (
                      <span className="text-xs text-(--muted-foreground) font-mono">
                        {Math.round(budget * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              {/* Expanded: grouped fields */}
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-6">
                  {/* Identity */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Identity</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={(agent.name as string) ?? ""}
                          onChange={(e) => updateAgent(idx, "name", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tier</Label>
                        <Select value={tier} onValueChange={(v) => updateAgent(idx, "tier", v)}>
                          <SelectTrigger size="sm" className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="command">command</SelectItem>
                            <SelectItem value="domain">domain</SelectItem>
                            <SelectItem value="shared">shared</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Textarea
                        value={(agent.description as string) ?? ""}
                        onChange={(e) => updateAgent(idx, "description", e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Active</Label>
                      <Switch
                        size="sm"
                        checked={active}
                        onCheckedChange={(v) => updateAgent(idx, "active", v)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-(--muted-foreground)">Norse meaning</Label>
                      <Input
                        value={(agent.norse_meaning as string) ?? ""}
                        onChange={(e) => updateAgent(idx, "norse_meaning", e.target.value)}
                        className="h-8 text-sm text-(--muted-foreground)"
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Limits */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Limits</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Model override</Label>
                        <Input
                          value={(agent.model_override as string) ?? ""}
                          onChange={(e) => updateAgent(idx, "model_override", e.target.value || null)}
                          placeholder="default"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Budget fraction</Label>
                        <Input
                          type="number"
                          value={(agent.budget_fraction as number) ?? ""}
                          onChange={(e) => updateAgent(idx, "budget_fraction", e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="0.0 - 1.0"
                          className="h-8 text-sm"
                          step={0.05}
                          min={0}
                          max={1}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Timeout (seconds)</Label>
                        <Input
                          type="number"
                          value={(agent.timeout_seconds as number) ?? ""}
                          onChange={(e) => updateAgent(idx, "timeout_seconds", e.target.value ? parseInt(e.target.value) : undefined)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max rounds</Label>
                        <Input
                          type="number"
                          value={(agent.max_rounds as number) ?? ""}
                          onChange={(e) => updateAgent(idx, "max_rounds", e.target.value ? parseInt(e.target.value) : undefined)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Tools & Channels */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Tools & Channels</h4>
                    <div className="space-y-2">
                      <Label className="text-xs">Tools enabled</Label>
                      <TagChipInput
                        values={(agent.tools_enabled as string[]) ?? []}
                        onChange={(v) => updateAgent(idx, "tools_enabled", v)}
                        placeholder="Add tool..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Channels</Label>
                      <TagChipInput
                        values={(agent.channels as string[]) ?? []}
                        onChange={(v) => updateAgent(idx, "channels", v)}
                        placeholder="Add channel..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Peer comm allowed</Label>
                      <TagChipInput
                        values={(agent.peer_comm_allowed as string[]) ?? []}
                        onChange={(v) => updateAgent(idx, "peer_comm_allowed", v)}
                        placeholder="Agent ID..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Kits</Label>
                      <TagChipInput
                        values={(agent.kits as string[]) ?? []}
                        onChange={(v) => updateAgent(idx, "kits", v)}
                        placeholder="Add kit..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Capabilities</Label>
                      <TagChipInput
                        values={(agent.capabilities as string[]) ?? []}
                        onChange={(v) => updateAgent(idx, "capabilities", v)}
                        placeholder="Add capability..."
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Autonomy Rules */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Autonomy Rules</h4>
                    <InlineTable
                      columns={AUTONOMY_COLUMNS}
                      rows={(agent.autonomy_rules as Record<string, unknown>[]) ?? []}
                      onChange={(rows) => updateAgent(idx, "autonomy_rules", rows)}
                      emptyRow={{ pattern: "", level: "silent", notify_after: false }}
                    />
                  </section>

                  <Separator />

                  {/* Daily Rhythm */}
                  <section className="space-y-3">
                    <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Daily Rhythm</h4>
                    <InlineTable
                      columns={RHYTHM_COLUMNS}
                      rows={(agent.daily_rhythm as Record<string, unknown>[]) ?? []}
                      onChange={(rows) => updateAgent(idx, "daily_rhythm", rows)}
                      emptyRow={{ time: "", action: "", channel: "internal", days: "mon-fri", profile: "" }}
                    />
                  </section>

                  {/* Memory (read-only) */}
                  {agent.memory && (
                    <>
                      <Separator />
                      <section className="space-y-2">
                        <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Memory (read-only)</h4>
                        {["l1_index", "l2_topics_dir", "l3_logs_dir"].map((k) => {
                          const mem = agent.memory as Record<string, unknown>;
                          return mem[k] ? (
                            <div key={k} className="flex items-center gap-2 text-xs">
                              <span className="text-(--muted-foreground) w-24">{k}:</span>
                              <span className="font-mono">{mem[k] as string}</span>
                            </div>
                          ) : null;
                        })}
                      </section>
                    </>
                  )}

                  {/* Email (conditional) */}
                  {(agent.email_default_layout || agent.email_signature_name || agent.email_signature_title) && (
                    <>
                      <Separator />
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Email</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Default layout</Label>
                            <Input
                              value={(agent.email_default_layout as string) ?? ""}
                              onChange={(e) => updateAgent(idx, "email_default_layout", e.target.value || null)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Signature name</Label>
                            <Input
                              value={(agent.email_signature_name as string) ?? ""}
                              onChange={(e) => updateAgent(idx, "email_signature_name", e.target.value || null)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Signature title</Label>
                          <Input
                            value={(agent.email_signature_title as string) ?? ""}
                            onChange={(e) => updateAgent(idx, "email_signature_title", e.target.value || null)}
                            className="h-8 text-sm"
                          />
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/config/AgentTypesForm.tsx
git commit -m "feat(config): add AgentTypesForm with accordion cards, inline tables, tag chips"
```

---

### Task 6: ConfigPage — Parent Page with Tabs and WS Orchestration

**Files:**
- Create: `src/pages/ConfigPage.tsx`
- Modify: `src/App.tsx:32` (change lazy import)

This is the main page component that replaces ConfigEditor. It owns tab navigation, WebSocket interaction (load/validate/apply), dirty tracking, and the raw YAML toggle.

- [ ] **Step 1: Create ConfigPage component**

```tsx
// src/pages/ConfigPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import * as jsYaml from "js-yaml";
import { toast } from "sonner";
import { Shield, Bot, Wrench, User, GitBranch, Code } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "@/components/WSStatusIndicator";
import HotReloadBar, { type HotReloadStatus } from "@/components/HotReloadBar";
import DiffView from "@/components/DiffView";
import { SecurityRulesForm } from "@/components/config/SecurityRulesForm";
import { AgentTypesForm } from "@/components/config/AgentTypesForm";
import { YamlSection } from "@/components/config/YamlSection";

const SECTIONS = [
  { id: "security-rules", label: "Security", icon: Shield },
  { id: "agent-types", label: "Agents", icon: Bot },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "profiles", label: "Profiles", icon: User },
  { id: "pipes", label: "Pipes", icon: GitBranch },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const FORM_SECTIONS = new Set<SectionId>(["security-rules", "agent-types"]);

const YAML_DESCRIPTIONS: Partial<Record<SectionId, string>> = {
  tools: "Built-in tools, optional tools, skill/plugin directories, and Claude Code settings.",
  profiles: "Routing profiles, budget limits, channel mappings, and persona voice configuration.",
  pipes: "Automation pipelines with triggers, steps, and approval gates.",
};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ConfigPage() {
  const { status, sendCommand } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  const [section, setSection] = useState<SectionId>("security-rules");
  const [rawMode, setRawMode] = useState(false);

  // Data state
  const [originalYaml, setOriginalYaml] = useState("");
  const [currentData, setCurrentData] = useState<Record<string, unknown>>({});
  const originalDataRef = useRef<Record<string, unknown>>({});
  const [yamlOverride, setYamlOverride] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [applyEnabled, setApplyEnabled] = useState(false);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [reloadStatus, setReloadStatus] = useState<HotReloadStatus>(null);
  const [reloadError, setReloadError] = useState<string | undefined>(undefined);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  const isDisconnected = status === "disconnected";
  const isDirty = rawMode
    ? (yamlOverride ?? "") !== originalYaml
    : !deepEqual(currentData, originalDataRef.current);
  const currentYaml = rawMode
    ? (yamlOverride ?? originalYaml)
    : jsYaml.dump(currentData, { lineWidth: 120 });

  // ── Load config ──
  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setValidationResult(null);
    setApplyEnabled(false);
    setShowConfirm(false);
    setShowDiff(false);
    setReloadStatus(null);
    setShowRevertConfirm(false);
    setRawMode(false);
    setYamlOverride(null);

    try {
      const ack = await sendCommand({ type: "config.get", section });
      if (ack.status === "ok") {
        const content = ((ack.data as Record<string, unknown>)?.content ?? (ack as Record<string, unknown>).content ?? "") as string;
        setOriginalYaml(content);
        const parsed = (jsYaml.load(content) as Record<string, unknown>) ?? {};
        setCurrentData(parsed);
        originalDataRef.current = parsed;
      } else {
        setLoadError(ack.error ?? "Failed to load config.");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  }, [section, sendCommand]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Form onChange ──
  function handleFormChange(updated: Record<string, unknown>) {
    setCurrentData(updated);
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
  }

  // ── Raw YAML onChange (for raw toggle and YAML-only tabs) ──
  function handleYamlChange(value: string) {
    if (rawMode || !FORM_SECTIONS.has(section)) {
      setYamlOverride(value);
      // Also parse into currentData so dirty tracking and apply work
      try {
        const parsed = (jsYaml.load(value) as Record<string, unknown>) ?? {};
        setCurrentData(parsed);
      } catch {
        // Invalid YAML mid-edit — keep yamlOverride, dirty tracking uses string compare
      }
    }
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
  }

  // ── Toggle raw mode ──
  function toggleRawMode() {
    if (rawMode) {
      // Switching back to form: parse yaml override into data
      const yaml = yamlOverride ?? originalYaml;
      try {
        const parsed = (jsYaml.load(yaml) as Record<string, unknown>) ?? {};
        setCurrentData(parsed);
        setYamlOverride(null);
        setRawMode(false);
      } catch {
        toast.error("YAML is invalid — fix errors before switching to form view.");
      }
    } else {
      // Switching to raw: serialize current data to yaml
      setYamlOverride(jsYaml.dump(currentData, { lineWidth: 120 }));
      setRawMode(true);
    }
  }

  // ── Validate (dry-run) ──
  async function handleValidate() {
    if (validating) return;
    setValidating(true);
    setValidationResult(null);
    setShowConfirm(false);

    let changes: Record<string, unknown>;
    try {
      changes = rawMode
        ? ((jsYaml.load(yamlOverride ?? "") as Record<string, unknown>) ?? {})
        : currentData;
    } catch (err) {
      setValidationResult({ success: false, error: `YAML parse error: ${err}` });
      setValidating(false);
      return;
    }

    try {
      const ack = await sendCommand({ type: "config.update", section, changes, dry_run: true });
      if (ack.status === "ok") {
        setValidationResult({ success: true });
        setApplyEnabled(true);
      } else {
        setValidationResult({ success: false, error: ack.error ?? "Validation failed." });
      }
    } catch (err) {
      setValidationResult({ success: false, error: err instanceof Error ? err.message : "Validation request failed." });
    } finally {
      setValidating(false);
    }
  }

  // ── Apply ──
  async function handleApplyConfirm() {
    if (applying) return;
    setApplying(true);
    setShowConfirm(false);

    let changes: Record<string, unknown>;
    try {
      changes = rawMode
        ? ((jsYaml.load(yamlOverride ?? "") as Record<string, unknown>) ?? {})
        : currentData;
    } catch (err) {
      toast.error(`YAML parse error: ${err}`);
      setApplying(false);
      return;
    }

    try {
      const ack = await sendCommand({ type: "config.update", section, changes, dry_run: false });
      if (ack.status === "ok") {
        toast("Config applied and reloaded.");
        const newYaml = rawMode ? (yamlOverride ?? "") : jsYaml.dump(currentData, { lineWidth: 120 });
        setOriginalYaml(newYaml);
        originalDataRef.current = { ...currentData };
        setYamlOverride(null);
        setApplyEnabled(false);
        setValidationResult(null);
        setReloadStatus("applied");
        triggerFlash();
        setTimeout(() => setReloadStatus("confirmed"), 1500);
        setTimeout(() => setReloadStatus(null), 4000);
      } else {
        setValidationResult({ success: false, error: `Apply failed: ${ack.error ?? "Unknown error"}` });
        setReloadStatus("error");
        setReloadError(ack.error ?? "Unknown error");
      }
    } catch (err) {
      setValidationResult({ success: false, error: `Apply failed: ${err instanceof Error ? err.message : "Unknown error"}` });
      setReloadStatus("error");
      setReloadError(err instanceof Error ? err.message : "Command failed");
    } finally {
      setApplying(false);
    }
  }

  // ── Revert ──
  function handleRevert() {
    setCurrentData({ ...originalDataRef.current });
    setYamlOverride(null);
    setShowDiff(false);
    setShowRevertConfirm(false);
    setReloadStatus(null);
    setApplyEnabled(false);
    setValidationResult(null);
    setShowConfirm(false);
  }

  const hasForm = FORM_SECTIONS.has(section);
  const showRawToggle = hasForm;

  return (
    <div className="flex h-full max-h-[calc(100vh-64px)]">
      {/* Left tabs */}
      <Tabs
        value={section}
        onValueChange={(v) => setSection(v as SectionId)}
        orientation="vertical"
        className="flex h-full w-full"
      >
        <TabsList className="flex flex-col h-full w-44 shrink-0 border-r border-(--border) bg-transparent rounded-none justify-start gap-1 p-2">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="w-full justify-start gap-2 px-3 py-2 text-sm">
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) shrink-0 gap-4">
            <h1 className="text-lg font-semibold text-(--foreground) whitespace-nowrap">
              {isDirty ? "Config •" : "Config"}
            </h1>
            <div className="flex items-center gap-2">
              {showRawToggle && (
                <Button variant="ghost" size="sm" onClick={toggleRawMode} className="gap-1.5 text-xs">
                  <Code className="h-3.5 w-3.5" />
                  {rawMode ? "Form" : "Raw YAML"}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleValidate}
                disabled={isDisconnected || loading || validating || !isDirty}
              >
                {validating ? "Validating..." : "Validate"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
                disabled={!isDirty}
              >
                {showDiff ? "Hide Diff" : "Review"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={!applyEnabled || isDisconnected || applying}
              >
                {applying ? "Applying..." : "Apply"}
              </Button>
              <WSStatusIndicator status={status} />
            </div>
          </div>

          {/* Validation result */}
          {validationResult && (
            <div className={`mx-4 mt-3 px-3 py-2 text-sm border-l-2 ${
              validationResult.success
                ? "border-l-green-500 bg-green-500/10"
                : "border-l-(--status-error) bg-(--status-error)/10"
            }`}>
              {validationResult.success ? "Configuration is valid." : validationResult.error ?? "Validation failed."}
            </div>
          )}

          {/* Apply confirmation */}
          {showConfirm && (
            <div className="mx-4 mt-3 px-3 py-2 border border-(--border) bg-(--muted) flex items-center gap-3">
              <span className="text-sm">Apply and hot-reload config?</span>
              <Button size="sm" onClick={handleApplyConfirm}>Confirm</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>Cancel</Button>
            </div>
          )}

          {/* Hot-reload bar */}
          <div className="px-4 pt-2">
            <HotReloadBar status={reloadStatus} errorMessage={reloadError} />
          </div>

          {/* Revert */}
          {isDirty && (
            <div className="px-4 pt-2">
              {showRevertConfirm ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-(--muted-foreground)">Revert all unsaved changes?</span>
                  <Button variant="destructive" size="sm" onClick={handleRevert}>Revert</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowRevertConfirm(false)}>Keep editing</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-(--destructive)" onClick={() => setShowRevertConfirm(true)}>
                  Revert to Saved
                </Button>
              )}
            </div>
          )}

          {/* Tab content */}
          <div ref={flashRef} className="flex-1 overflow-hidden mt-3 px-4 pb-4">
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: `${60 + Math.random() * 35}%` }} />
                ))}
              </div>
            ) : loadError ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-(--status-error)">{loadError}</span>
                <Button variant="link" size="sm" onClick={loadConfig}>Retry</Button>
              </div>
            ) : (
              <>
                {SECTIONS.map(({ id }) => (
                  <TabsContent key={id} value={id} className="h-full mt-0">
                    {rawMode && hasForm && id === section ? (
                      <YamlSection value={yamlOverride ?? originalYaml} onChange={handleYamlChange} />
                    ) : id === "security-rules" ? (
                      <SecurityRulesForm data={currentData} onChange={handleFormChange} />
                    ) : id === "agent-types" ? (
                      <AgentTypesForm data={currentData} onChange={handleFormChange} />
                    ) : (
                      <YamlSection
                        value={id === section ? (yamlOverride ?? currentYaml) : ""}
                        onChange={handleYamlChange}
                        description={YAML_DESCRIPTIONS[id]}
                      />
                    )}
                  </TabsContent>
                ))}

                {/* Diff panel */}
                {showDiff && (
                  <div className="mt-4">
                    <DiffView original={originalYaml} current={currentYaml} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/ConfigPage.tsx
git commit -m "feat(config): add ConfigPage with tabbed layout, form/YAML toggle, WS orchestration"
```

---

### Task 7: Wire Up Route and Remove Old Page

**Files:**
- Modify: `src/App.tsx:32` (change import)
- Delete: `src/pages/ConfigEditor.tsx`

- [ ] **Step 1: Update App.tsx lazy import**

In `src/App.tsx`, change line 32 from:

```tsx
const ConfigEditorPage = lazy(() => import("./pages/ConfigEditor"));
```

to:

```tsx
const ConfigEditorPage = lazy(() => import("./pages/ConfigPage"));
```

- [ ] **Step 2: Delete old ConfigEditor page**

Run: `cd C:\Users\mandr\codepulse && rm src/pages/ConfigEditor.tsx`

- [ ] **Step 3: Verify build**

Run: `cd C:\Users\mandr\codepulse && npx tsc --noEmit`
Expected: No type errors. No references to the deleted file.

- [ ] **Step 4: Verify dev server**

Run: `cd C:\Users\mandr\codepulse && npm run dev`

Open http://localhost:5174/config in the browser. Verify:
- Tabs render on the left (Security, Agents, Tools, Profiles, Pipes)
- Clicking tabs loads different sections
- Security shows toggle grid
- Agents shows accordion cards
- Tools/Profiles/Pipes show YAML editor with description text
- Raw YAML toggle switches Security and Agents between form and editor
- WS status indicator shows connection state

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git rm src/pages/ConfigEditor.tsx
git commit -m "feat(config): wire ConfigPage route, remove old ConfigEditor"
```

---

### Task 8: Verify Full Workflow

**Files:** None (testing only)

End-to-end verification of the complete config page.

- [ ] **Step 1: Test dirty tracking**

1. Open /config → Security tab
2. Toggle any switch
3. Verify header shows "Config •" and Validate button enables
4. Click "Revert to Saved" → verify clean state restored

- [ ] **Step 2: Test raw YAML toggle round-trip**

1. Open Security tab, toggle a switch
2. Click "Raw YAML" → verify YAML shows with the toggled value
3. Click "Form" → verify form shows same toggled state
4. Toggle the switch back → verify clean state

- [ ] **Step 3: Test validate and apply flow (requires Ástríðr connection)**

1. Toggle a switch in Security
2. Click Validate → verify "Configuration is valid." or error
3. Click Apply → Confirm → verify hot-reload bar shows "Applied" → "Confirmed"
4. Reload page → verify the change persisted

- [ ] **Step 4: Test agents accordion**

1. Switch to Agents tab
2. Verify all agents show as collapsed cards with name, tier, status, budget
3. Expand one agent → verify all field groups render
4. Edit a field → verify dirty tracking works
5. Click Raw YAML → verify full agent-types YAML shown
6. Click Form → verify form restores

- [ ] **Step 5: Test YAML-only sections**

1. Switch to Tools tab → verify YAML editor with description text
2. Switch to Profiles → verify YAML editor with description text
3. Switch to Pipes → verify YAML editor with description text
4. Raw YAML toggle should NOT appear on these tabs

- [ ] **Step 6: Commit verification note**

```bash
git commit --allow-empty -m "test: verify config form UI end-to-end"
```
