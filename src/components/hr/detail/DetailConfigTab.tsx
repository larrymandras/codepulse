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
    <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-colors">
      <p className="text-[9px] font-mono font-bold text-primary/70 uppercase tracking-widest">{label}</p>
      <div className="text-xs font-mono text-foreground/90 leading-relaxed">{children}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 border-b border-primary/20 pb-2">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      <h4 className="text-[11px] font-bold font-mono text-primary uppercase tracking-[0.2em] drop-shadow-sm">
        {title}
      </h4>
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
      <div className="flex items-center justify-center p-8 border border-dashed border-primary/20 rounded-lg bg-primary/5">
        <p className="text-xs font-mono tracking-widest uppercase text-muted-foreground animate-pulse">
          No configuration telemetry
        </p>
      </div>
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
      <div className="space-y-6 p-1 relative">
        <div className="absolute inset-0 pointer-events-none border border-primary/20 rounded-xl bg-primary/5" />
        <div className="grid grid-cols-2 gap-4 relative z-10 p-4">
          <div className="col-span-2">
            <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
              ID
            </label>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {agentDetail.id}
            </p>
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
              Name
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1.5 h-9 text-xs font-mono bg-background/50 border-primary/20 focus-visible:ring-primary/50"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
              Description
            </label>
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="mt-1.5 h-9 text-xs font-mono bg-background/50 border-primary/20 focus-visible:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
              Tier
            </label>
            <Select value={editTier} onValueChange={setEditTier}>
              <SelectTrigger className="mt-1.5 h-9 text-xs font-mono bg-background/50 border-primary/20">
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
            <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
              Budget Fraction
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={editBudget}
              onChange={(e) => setEditBudget(e.target.value)}
              className="mt-1.5 h-9 text-xs font-mono bg-background/50 border-primary/20 focus-visible:ring-primary/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
              Max Rounds
            </label>
            <Input
              type="number"
              min="1"
              value={editMaxRounds}
              onChange={(e) => setEditMaxRounds(e.target.value)}
              className="mt-1.5 h-9 text-xs font-mono bg-background/50 border-primary/20 focus-visible:ring-primary/50"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-mono text-primary/70 uppercase tracking-widest">
              Tools Enabled (comma-separated)
            </label>
            <Input
              value={editTools}
              onChange={(e) => setEditTools(e.target.value)}
              className="mt-1.5 h-9 text-xs font-mono bg-background/50 border-primary/20 focus-visible:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 relative z-10 p-4 border-t border-primary/20">
          <Button 
            size="sm" 
            onClick={handleSave} 
            disabled={saving}
            className="flex-1 text-[10px] font-mono tracking-widest uppercase bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-2" />
            )}
            Save Configuration
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={cancelEdit}
            className="flex-1 text-[10px] font-mono tracking-widest uppercase border-border/50 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Read mode
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-end mb-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={startEdit}
          className="text-[10px] font-mono tracking-widest uppercase border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
        >
          <Pencil className="h-3 w-3 mr-2" />
          Edit Config
        </Button>
      </div>

      {/* Identity section */}
      <div>
        <SectionHeader title="Identity Core" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID">
            <span className="text-primary/80">{agentDetail.id}</span>
          </Field>
          <Field label="Name">
            <span className="text-foreground">{agentDetail.name}</span>
          </Field>
          <div className="col-span-2">
            <Field label="Description">
              {agentDetail.description || <span className="text-muted-foreground/50 italic">No description</span>}
            </Field>
          </div>
          <Field label="Tier">
            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5 uppercase tracking-widest">
              {agentDetail.tier}
            </Badge>
          </Field>
          <Field label="Profiles">
            {(agentDetail.profiles ?? []).length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {agentDetail.profiles!.map((p) => (
                  <Badge key={p} variant="outline" className="text-[9px] border-primary/20 text-foreground/80 bg-background/50">
                    {p}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground/50">\u2014</span>
            )}
          </Field>
          <div className="col-span-2">
            <Field label="Channels">
              {(agentDetail.channels ?? []).length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {agentDetail.channels!.map((c) => (
                    <Badge key={c} variant="secondary" className="text-[9px] bg-muted/50">
                      {c}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground/50">\u2014</span>
              )}
            </Field>
          </div>
        </div>
      </div>

      {/* Tools & Limits section */}
      <div>
        <SectionHeader title="Tools & Restrictions" />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Tools Enabled">
              {(agentDetail.tools_enabled ?? []).length > 0 ? (
                <div className="flex gap-1.5 flex-wrap">
                  {agentDetail.tools_enabled.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px] font-mono border-primary/20 text-primary/90 bg-primary/5">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground/50">No tools configured</span>
              )}
            </Field>
          </div>
          <Field label="Max Rounds">
            <span className="text-lg font-bold text-foreground">
              {agentDetail.max_rounds}
            </span>
          </Field>
          <Field label="Compute Budget">
            <span className="text-lg font-bold text-primary">
              {agentDetail.budget_fraction > 0
                ? `${Math.round(agentDetail.budget_fraction * 100)}%`
                : <span className="text-sm font-normal text-muted-foreground/50">\u2014</span>}
            </span>
          </Field>
        </div>
      </div>
    </div>
  );
}

export default DetailConfigTab;
