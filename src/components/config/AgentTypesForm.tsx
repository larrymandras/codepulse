// src/components/config/AgentTypesForm.tsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
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

  return (
    <div className="space-y-2 overflow-y-auto h-full pr-1">
      <Accordion type="multiple" className="space-y-2">
        {agents.map((agent, idx) => {
          const id = String(agent.id ?? `agent-${idx}`);
          const name = String(agent.name ?? id);
          const tier = String(agent.tier ?? "shared");
          const active = agent.active !== false;
          const budget = agent.budget_fraction as number | undefined;
          const model = agent.model_override as string | undefined;
          const norseMeaning = agent.norse_meaning ? String(agent.norse_meaning) : undefined;

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
                          value={String(agent.name ?? "")}
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
                        value={String(agent.description ?? "")}
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
                        value={String(agent.norse_meaning ?? "")}
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
                          value={String(agent.model_override ?? "")}
                          onChange={(e) => updateAgent(idx, "model_override", e.target.value || null)}
                          placeholder="default"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Budget fraction</Label>
                        <Input
                          type="number"
                          value={agent.budget_fraction != null ? String(agent.budget_fraction) : ""}
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
                          value={agent.timeout_seconds != null ? String(agent.timeout_seconds) : ""}
                          onChange={(e) => updateAgent(idx, "timeout_seconds", e.target.value ? parseInt(e.target.value) : undefined)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max rounds</Label>
                        <Input
                          type="number"
                          value={agent.max_rounds != null ? String(agent.max_rounds) : ""}
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
                  {!!agent.memory && (
                    <>
                      <Separator />
                      <section className="space-y-2">
                        <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Memory (read-only)</h4>
                        {["l1_index", "l2_topics_dir", "l3_logs_dir"].map((k) => {
                          const mem = agent.memory as Record<string, unknown>;
                          return mem[k] ? (
                            <div key={k} className="flex items-center gap-2 text-xs">
                              <span className="text-(--muted-foreground) w-24">{k}:</span>
                              <span className="font-mono">{String(mem[k])}</span>
                            </div>
                          ) : null;
                        })}
                      </section>
                    </>
                  )}

                  {/* Email (conditional) */}
                  {(!!agent.email_default_layout || !!agent.email_signature_name || !!agent.email_signature_title) && (
                    <>
                      <Separator />
                      <section className="space-y-3">
                        <h4 className="text-xs font-semibold text-(--muted-foreground) uppercase tracking-wider">Email</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Default layout</Label>
                            <Input
                              value={String(agent.email_default_layout ?? "")}
                              onChange={(e) => updateAgent(idx, "email_default_layout", e.target.value || null)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Signature name</Label>
                            <Input
                              value={String(agent.email_signature_name ?? "")}
                              onChange={(e) => updateAgent(idx, "email_signature_name", e.target.value || null)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Signature title</Label>
                          <Input
                            value={String(agent.email_signature_title ?? "")}
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
