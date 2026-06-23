import { useState } from "react";
import { useFormContext } from "react-hook-form";
import type { WizardFormData } from "@/lib/wizardSchemas";
import AvatarUploader from "@/components/AvatarUploader";
import { ChevronDown, ChevronUp, X } from "lucide-react";

const TIER_OPTIONS = [
  { value: "command", label: "Command", desc: "Top-level orchestrator" },
  { value: "domain", label: "Domain", desc: "Specialized domain expert" },
  { value: "shared", label: "Shared", desc: "Reusable utility agent" },
] as const;

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-primary/10 text-primary rounded"
          >
            {tag}
            <button
              onClick={() => onChange(value.filter((v) => v !== tag))}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
      />
    </div>
  );
}

export default function IdentityStep() {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<WizardFormData>();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const profiles = watch("identity.profiles") ?? [];
  const channels = watch("identity.channels") ?? [];
  const imageStorageId = watch("identity.imageStorageId");
  const emoji = watch("identity.emoji");
  const description = watch("identity.description") ?? "";

  const identityErrors = errors.identity;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-medium text-foreground">
          Agent Identity
        </h2>
        <p className="text-base text-muted-foreground mt-1">
          Define who this agent is.
        </p>
      </div>

      {/* Core fields */}
      <div className="space-y-4">
        {/* Agent ID */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Agent ID
          </label>
          <input
            {...register("identity.agentId", {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                const cleaned = e.target.value
                  .toLowerCase()
                  .replace(/\s/g, "-");
                setValue("identity.agentId", cleaned, {
                  shouldValidate: true,
                });
              },
            })}
            placeholder="my-agent"
            className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Unique identifier (lowercase, hyphens allowed)
          </p>
          {identityErrors?.agentId && (
            <p className="text-sm text-destructive mt-1">
              {identityErrors.agentId.message}
            </p>
          )}
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Display Name
          </label>
          <input
            {...register("identity.displayName")}
            placeholder="My Agent"
            className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {identityErrors?.displayName && (
            <p className="text-sm text-destructive mt-1">
              {identityErrors.displayName.message}
            </p>
          )}
        </div>

        {/* Tier */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Tier
          </label>
          <select
            {...register("identity.tier")}
            className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {TIER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} -- {opt.desc}
              </option>
            ))}
          </select>
          {identityErrors?.tier && (
            <p className="text-sm text-destructive mt-1">
              {identityErrors.tier.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Description
          </label>
          <textarea
            {...register("identity.description")}
            rows={3}
            maxLength={500}
            placeholder="What does this agent do?"
            className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
          <p className="text-sm text-muted-foreground mt-1 text-right">
            {description.length}/500
          </p>
        </div>

        {/* Profiles */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Profiles
          </label>
          <TagInput
            value={profiles}
            onChange={(v) => setValue("identity.profiles", v)}
            placeholder="Type a profile and press Enter"
          />
        </div>
      </div>

      {/* Avatar section */}
      <div className="space-y-3">
        <h3 className="text-base font-medium text-foreground">Avatar</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Image upload */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Profile Image</p>
            {imageStorageId ? (
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center text-sm text-muted-foreground border border-border/40">
                  Uploaded
                </div>
                <button
                  onClick={() => setValue("identity.imageStorageId", undefined)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            ) : (
              <AvatarUploader
                onUpload={(storageId) =>
                  setValue("identity.imageStorageId", storageId)
                }
              />
            )}
          </div>
          {/* Emoji fallback */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Emoji (fallback)
            </p>
            <div className="flex items-center gap-2">
              <input
                {...register("identity.emoji")}
                placeholder="🤖"
                maxLength={4}
                className="w-16 px-3 py-2 text-lg text-center bg-background/60 border border-border/40 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <input
                {...register("identity.emojiColor")}
                type="color"
                defaultValue="#6366f1"
                className="w-10 h-10 rounded-lg border border-border/40 cursor-pointer"
              />
            </div>
            {imageStorageId && emoji && (
              <p className="text-sm text-muted-foreground mt-1.5">
                Image is primary; emoji shown as overlay.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Advanced toggle */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Advanced
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4 pl-4 border-l-2 border-border/30">
            {/* Reports To */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Reports To
              </label>
              <input
                {...register("identity.reportsTo")}
                placeholder="parent-agent-id"
                className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Channels */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Channels
              </label>
              <TagInput
                value={channels}
                onChange={(v) => setValue("identity.channels", v)}
                placeholder="Type a channel and press Enter"
              />
            </div>

            {/* Budget Fraction */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Budget Fraction (0-1)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                {...register("identity.budgetFraction", {
                  valueAsNumber: true,
                })}
                placeholder="0.10"
                className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Timeout (seconds)
              </label>
              <input
                type="number"
                min="1"
                {...register("identity.timeoutSeconds", {
                  valueAsNumber: true,
                })}
                placeholder="300"
                className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Max Rounds */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Max Rounds
              </label>
              <input
                type="number"
                min="1"
                {...register("identity.maxRounds", { valueAsNumber: true })}
                placeholder="10"
                className="w-full px-3 py-2 text-base bg-background/60 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
