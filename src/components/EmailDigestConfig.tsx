import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SectionHeader } from "./SectionHeader";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Label } from "./ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const SCHEDULE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "both", label: "Daily + Weekly" },
];

export function EmailDigestConfig() {
  const config = useQuery(api.emailDigest.getEmailDigestConfigPublic);
  const setConfig = useMutation(api.emailDigest.setEmailDigestConfig);

  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState("daily");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  // Sync from server on load
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setSchedule(config.schedule);
    }
  }, [config]);

  const handleSave = async () => {
    setSaveState("saving");
    try {
      await setConfig({ enabled, schedule });
      setSaveState("saved");
      toast.success("Digest settings saved.");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
      toast.error(
        "Could not save digest settings. Check the recipient email and try again."
      );
    }
  };

  if (config === undefined) {
    return (
      <div className="space-y-4">
        <SectionHeader title="EMAIL DIGEST" />
        <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="EMAIL DIGEST" />

      <div className="space-y-4">
        {/* Recipient info (read-only — from profileConfigs) */}
        <div>
          <Label className="text-sm font-semibold">Recipient email</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Uses profile email address. Edit in Agent Profiles if different.
          </p>
        </div>

        {/* Schedule */}
        <div>
          <Label className="text-sm font-semibold">Schedule</Label>
          <Select value={schedule} onValueChange={setSchedule}>
            <SelectTrigger className="w-[200px] mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Label className="text-sm">Send email digest</Label>
        </div>

        {/* Save */}
        <Button
          onClick={() => void handleSave()}
          disabled={saveState === "saving"}
          size="sm"
        >
          {saveState === "saving" && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {saveState === "saved" ? "Saved" : "Save Digest Settings"}
        </Button>
      </div>
    </div>
  );
}
