import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type DeliveryMode = "always" | "digest" | "dashboard_only" | "disabled";

type Preferences = {
  critical: DeliveryMode;
  error: DeliveryMode;
  warning: DeliveryMode;
  info: DeliveryMode;
};

const DEFAULT_PREFERENCES: Preferences = {
  critical: "always",
  error: "always",
  warning: "digest",
  info: "dashboard_only",
};

const SEVERITIES: { key: keyof Preferences; label: string; colorClass: string }[] = [
  {
    key: "critical",
    label: "Critical",
    colorClass: "text-red-400 bg-red-400/10 border border-red-400/20",
  },
  {
    key: "error",
    label: "Error",
    colorClass: "text-orange-400 bg-orange-400/10 border border-orange-400/20",
  },
  {
    key: "warning",
    label: "Warning",
    colorClass: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
  },
  {
    key: "info",
    label: "Info",
    colorClass: "text-blue-400 bg-blue-400/10 border border-blue-400/20",
  },
];

const DELIVERY_MODES: { value: DeliveryMode; label: string; sublabel?: string }[] = [
  { value: "always", label: "Always notify" },
  { value: "digest", label: "Digest" },
  { value: "dashboard_only", label: "Dashboard only" },
  { value: "disabled", label: "Disabled" },
];

export function NotificationPreferences() {
  const storedPrefs = useQuery(api.webhookDelivery.getPreferences);
  const setPreferencesMutation = useMutation(api.webhookDelivery.setPreferences);

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync from server once loaded
  useEffect(() => {
    if (storedPrefs) {
      setPrefs({
        critical: (storedPrefs.critical as DeliveryMode) ?? "always",
        error: (storedPrefs.error as DeliveryMode) ?? "always",
        warning: (storedPrefs.warning as DeliveryMode) ?? "digest",
        info: (storedPrefs.info as DeliveryMode) ?? "dashboard_only",
      });
    }
  }, [storedPrefs]);

  const handleChange = (severity: keyof Preferences, mode: DeliveryMode) => {
    setPrefs((p) => ({ ...p, [severity]: mode }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setPreferencesMutation({ preferences: prefs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      // Error surfaced via Convex mutation error handling
      console.error("Failed to save preferences:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeader title="NOTIFICATION PREFERENCES" />
      <div className="space-y-4">
        {SEVERITIES.map(({ key, label, colorClass }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-sm ${colorClass}`}
            >
              {label}
            </span>
            <Select
              value={prefs[key]}
              onValueChange={(value) => handleChange(key, value as DeliveryMode)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_MODES.map(({ value, label: modeLabel, sublabel }) => (
                  <SelectItem key={value} value={value}>
                    <span>
                      {modeLabel}
                      {sublabel && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({sublabel.replace("{severity}", key)})
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : saved ? (
              "Saved"
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
