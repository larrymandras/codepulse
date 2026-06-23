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
          <CardTitle className="text-base">Core Security Layers</CardTitle>
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
                <Badge variant="outline" className="text-xs font-mono w-8 justify-center">
                  {layer.layer}
                </Badge>
                <Label className="text-base font-normal">{layer.label}</Label>
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
          <CardTitle className="text-base">Advanced</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {ADVANCED_LAYERS.map((layer, idx) => (
            <div
              key={layer.key}
              className={`flex items-center justify-between py-2.5 px-2 ${
                idx % 2 === 0 ? "bg-(--muted)/30" : ""
              }`}
            >
              <Label className={`text-base font-normal ${layer.muted ? "text-(--muted-foreground)" : ""}`}>
                {layer.label}
              </Label>
              <Switch
                size="sm"
                checked={!!security[layer.key]}
                onCheckedChange={(v) => update(layer.key, v)}
              />
            </div>
          ))}
          {!!security.dm_pairing && !!security.dm_pairs_file && (
            <p className="text-sm text-(--muted-foreground) px-2 pt-1">
              Pairs file: {String(security.dm_pairs_file)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-normal">Legal HITL Risk Threshold</Label>
              <span className="text-base font-mono tabular-nums w-8 text-right">
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
          <CardTitle className="text-base">Protected Env Vars</CardTitle>
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
