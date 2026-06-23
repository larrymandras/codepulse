// src/components/config/ProfilesForm.tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TagChipInput } from "./TagChipInput";

interface ProfilesFormProps {
  data: Record<string, unknown>;
  onChange: (updated: Record<string, unknown>) => void;
}

export function ProfilesForm({ data, onChange }: ProfilesFormProps) {
  const profiles = (data.profiles ?? []) as Record<string, unknown>[];
  const personas = (data.personas ?? []) as Record<string, unknown>[];

  function updateProfile(idx: number, key: string, value: unknown) {
    const updated = profiles.map((p, i) => (i === idx ? { ...p, [key]: value } : p));
    onChange({ ...data, profiles: updated });
  }

  function updateProfileBudget(idx: number, key: string, value: unknown) {
    const profile = profiles[idx];
    const budget = (profile.budget as Record<string, unknown>) ?? {};
    const updatedBudget = { ...budget, [key]: value };
    updateProfile(idx, "budget", updatedBudget);
  }

  function updatePersona(idx: number, key: string, value: unknown) {
    const updated = personas.map((p, i) => (i === idx ? { ...p, [key]: value } : p));
    onChange({ ...data, personas: updated });
  }

  function updatePersonaVoice(idx: number, key: string, value: unknown) {
    const persona = personas[idx];
    const voice = (persona.voice as Record<string, unknown>) ?? {};
    const updatedVoice = { ...voice, [key]: value };
    updatePersona(idx, "voice", updatedVoice);
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-1">
      {/* ── Profiles ── */}
      <Accordion type="multiple" className="space-y-2">
        {profiles.map((profile, idx) => {
          const id = String(profile.id ?? `profile-${idx}`);
          const name = String(profile.name ?? id);
          const channels = (profile.channels as string[]) ?? [];
          const defaultFor = (profile.default_for as string[]) ?? [];
          const ttsChannels = (profile.tts_channels as string[]) ?? [];
          const ttsEnabled = !!profile.tts_enabled;
          const toolsEnabled = (profile.tools_enabled as string[]) ?? [];
          const toolsDisabled = (profile.tools_disabled as string[]) ?? [];
          const budget = (profile.budget as Record<string, unknown>) ?? {};
          const projectTag = profile.project_tag ? String(profile.project_tag) : null;

          return (
            <AccordionItem key={id} value={id} className="border border-(--border) rounded-md">
              {/* Collapsed row */}
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <span className="font-semibold text-base">{name}</span>
                  <span className="text-sm text-(--muted-foreground)">{id}</span>
                  <div className="flex items-center gap-1.5 ml-auto mr-4">
                    {channels.map((ch) => (
                      <Badge key={ch} variant="secondary" className="text-xs">
                        {ch}
                      </Badge>
                    ))}
                    <Badge variant="outline" className="text-xs">
                      {projectTag ?? "personal"}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>

              {/* Expanded */}
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-6">
                  {/* Identity */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Identity
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">ID</Label>
                        <Input value={id} readOnly className="h-8 text-base bg-(--muted)" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Name</Label>
                        <Input
                          value={String(profile.name ?? "")}
                          onChange={(e) => updateProfile(idx, "name", e.target.value)}
                          className="h-8 text-base"
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Channels */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Channels
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-sm">Channels</Label>
                      <TagChipInput
                        values={channels}
                        onChange={(v) => updateProfile(idx, "channels", v)}
                        placeholder="Add channel..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Default for</Label>
                      <TagChipInput
                        values={defaultFor}
                        onChange={(v) => updateProfile(idx, "default_for", v)}
                        placeholder="Add channel..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">TTS channels</Label>
                      <TagChipInput
                        values={ttsChannels}
                        onChange={(v) => updateProfile(idx, "tts_channels", v)}
                        placeholder="Add channel..."
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">TTS enabled</Label>
                      <Switch
                        size="sm"
                        checked={ttsEnabled}
                        onCheckedChange={(v) => updateProfile(idx, "tts_enabled", v)}
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Budget */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Budget
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Daily USD</Label>
                        <Input
                          type="number"
                          value={budget.daily_usd != null ? String(budget.daily_usd) : ""}
                          onChange={(e) =>
                            updateProfileBudget(idx, "daily_usd", e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          className="h-8 text-base"
                          step={0.5}
                          min={0}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Monthly USD</Label>
                        <Input
                          type="number"
                          value={budget.monthly_usd != null ? String(budget.monthly_usd) : ""}
                          onChange={(e) =>
                            updateProfileBudget(idx, "monthly_usd", e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          className="h-8 text-base"
                          step={1}
                          min={0}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Soft limit %</Label>
                        <Input
                          type="number"
                          value={budget.soft_limit_pct != null ? String(budget.soft_limit_pct) : ""}
                          onChange={(e) =>
                            updateProfileBudget(idx, "soft_limit_pct", e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          placeholder="0.0 - 1.0"
                          className="h-8 text-base"
                          step={0.05}
                          min={0}
                          max={1}
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Model */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Model
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Model default</Label>
                        <Input
                          value={String(profile.model_default ?? "")}
                          onChange={(e) => updateProfile(idx, "model_default", e.target.value || null)}
                          className="h-8 text-base"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Model fallback</Label>
                        <Input
                          value={String(profile.model_fallback ?? "")}
                          onChange={(e) => updateProfile(idx, "model_fallback", e.target.value || null)}
                          className="h-8 text-base"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Max rounds</Label>
                        <Input
                          type="number"
                          value={profile.max_rounds != null ? String(profile.max_rounds) : ""}
                          onChange={(e) =>
                            updateProfile(idx, "max_rounds", e.target.value ? parseInt(e.target.value) : undefined)
                          }
                          className="h-8 text-base"
                        />
                      </div>
                    </div>
                  </section>

                  <Separator />

                  {/* Tools */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Tools
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-sm">Tools enabled</Label>
                      <TagChipInput
                        values={toolsEnabled}
                        onChange={(v) => updateProfile(idx, "tools_enabled", v)}
                        placeholder="Add tool..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Tools disabled</Label>
                      <TagChipInput
                        values={toolsDisabled}
                        onChange={(v) => updateProfile(idx, "tools_disabled", v)}
                        placeholder="Add tool..."
                      />
                    </div>
                  </section>

                  <Separator />

                  {/* Persona */}
                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold text-(--muted-foreground) uppercase tracking-wider">
                      Persona
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Persona ID</Label>
                        <Input
                          value={String(profile.persona_id ?? "")}
                          onChange={(e) => updateProfile(idx, "persona_id", e.target.value || null)}
                          className="h-8 text-base"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Project tag</Label>
                        <Input
                          value={String(profile.project_tag ?? "")}
                          onChange={(e) => updateProfile(idx, "project_tag", e.target.value || null)}
                          className="h-8 text-base"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* ── Personas ── */}
      {personas.length > 0 && (
        <>
          <Separator />
          <h3 className="text-base font-semibold">Personas</h3>
          <Accordion type="multiple" className="space-y-2">
            {personas.map((persona, idx) => {
              const id = String(persona.id ?? `persona-${idx}`);
              const name = String(persona.name ?? id);
              const voice = (persona.voice as Record<string, unknown>) ?? {};

              return (
                <AccordionItem key={id} value={id} className="border border-(--border) rounded-md">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                      <span className="font-semibold text-base">{name}</span>
                      <span className="text-sm text-(--muted-foreground)">{id}</span>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm">ID</Label>
                          <Input value={id} readOnly className="h-8 text-base bg-(--muted)" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Name</Label>
                          <Input
                            value={String(persona.name ?? "")}
                            onChange={(e) => updatePersona(idx, "name", e.target.value)}
                            className="h-8 text-base"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-sm">Voice ID</Label>
                          <Input
                            value={String(voice.voice_id ?? "")}
                            onChange={(e) => updatePersonaVoice(idx, "voice_id", e.target.value || null)}
                            className="h-8 text-base"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Stability</Label>
                          <Input
                            type="number"
                            value={voice.stability != null ? String(voice.stability) : ""}
                            onChange={(e) =>
                              updatePersonaVoice(idx, "stability", e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            placeholder="0.0 - 1.0"
                            className="h-8 text-base"
                            step={0.05}
                            min={0}
                            max={1}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-sm">Similarity boost</Label>
                          <Input
                            type="number"
                            value={voice.similarity_boost != null ? String(voice.similarity_boost) : ""}
                            onChange={(e) =>
                              updatePersonaVoice(idx, "similarity_boost", e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            placeholder="0.0 - 1.0"
                            className="h-8 text-base"
                            step={0.05}
                            min={0}
                            max={1}
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </>
      )}
    </div>
  );
}
