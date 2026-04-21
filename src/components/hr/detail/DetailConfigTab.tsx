import { useState } from "react";
import { updateAgent, type AgentDetail } from "@/lib/astridrApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DetailConfigTabProps {
  agentId: string;
  agentDetail: AgentDetail | null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase mb-0.5">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function DetailConfigTab({ agentId, agentDetail }: DetailConfigTabProps) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTier, setEditTier] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editMaxRounds, setEditMaxRounds] = useState("");
  const [editTools, setEditTools] = useState("");

  if (!agentDetail) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No configuration data available.
      </p>
    );
  }

  const startEdit = () => {
    setEditName(agentDetail.name);
    setEditDescription(agentDetail.description ?? "");
    setEditTier(agentDetail.tier);
    setEditBudget(String(agentDetail.budget_fraction));
    setEditMaxRounds(String(agentDetail.max_rounds));
    setEditTools((agentDetail.tools_enabled ?? []).join(", "));
    setMode("edit");
  };

  const cancelEdit = () => setMode("read");

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAgent(agentId, {
        name: editName,
        description: editDescription,
        tier: editTier,
        budget_fraction: parseFloat(editBudget) || 0,
        max_rounds: parseInt(editMaxRounds, 10) || 10,
        tools_enabled: editTools
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toast.success("Config updated");
      setMode("read");
    } catch {
      toast.error("Failed to update config");
    } finally {
      setSaving(false);
    }
  };

  if (mode === "edit") {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground uppercase">
              ID
            </label>
            <p className="text-sm text-muted-foreground font-mono">
              {agentDetail.id}
            </p>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground uppercase">
              Name
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground uppercase">
              Description
            </label>
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase">
              Tier
            </label>
            <Select value={editTier} onValueChange={setEditTier}>
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="command">Command</SelectItem>
                <SelectItem value="domain">Domain</SelectItem>
                <SelectItem value="shared">Shared</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase">
              Budget Fraction
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={editBudget}
              onChange={(e) => setEditBudget(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase">
              Max Rounds
            </label>
            <Input
              type="number"
              min="1"
              value={editMaxRounds}
              onChange={(e) => setEditMaxRounds(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground uppercase">
              Tools Enabled (comma-separated)
            </label>
            <Input
              value={editTools}
              onChange={(e) => setEditTools(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={cancelEdit}>
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Read mode
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={startEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Edit Config
        </Button>
      </div>

      {/* Identity section */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
          Identity
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID">
            <span className="font-mono text-xs">{agentDetail.id}</span>
          </Field>
          <Field label="Name">{agentDetail.name}</Field>
          <div className="col-span-2">
            <Field label="Description">
              {agentDetail.description || "\u2014"}
            </Field>
          </div>
          <Field label="Tier">
            <Badge variant="secondary" className="text-[10px]">
              {agentDetail.tier}
            </Badge>
          </Field>
          <Field label="Profiles">
            {(agentDetail.profiles ?? []).length > 0 ? (
              <div className="flex gap-1 flex-wrap">
                {agentDetail.profiles!.map((p) => (
                  <Badge key={p} variant="outline" className="text-[10px]">
                    {p}
                  </Badge>
                ))}
              </div>
            ) : (
              "\u2014"
            )}
          </Field>
          <Field label="Channels">
            {(agentDetail.channels ?? []).length > 0
              ? agentDetail.channels.join(", ")
              : "\u2014"}
          </Field>
        </div>
      </div>

      {/* Tools section */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
          Tools & Limits
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Tools Enabled">
              {(agentDetail.tools_enabled ?? []).length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {agentDetail.tools_enabled.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] font-mono">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : (
                "\u2014"
              )}
            </Field>
          </div>
          <Field label="Max Rounds">{agentDetail.max_rounds}</Field>
          <Field label="Budget">
            {agentDetail.budget_fraction > 0
              ? `${Math.round(agentDetail.budget_fraction * 100)}%`
              : "\u2014"}
          </Field>
        </div>
      </div>
    </div>
  );
}

export default DetailConfigTab;
