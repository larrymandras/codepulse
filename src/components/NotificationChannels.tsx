import { useState, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

// T-06-10 mitigation: mask stored URLs — show only last 8 chars after save
function maskUrl(url: string | null): string {
  if (!url) return "";
  if (url.length <= 8) return url;
  return "••••••••••••••••••••••••••••••••••••••••" + url.slice(-8);
}

type TestStatus = "idle" | "loading" | "success" | "error";

interface ChannelState {
  inputValue: string;
  isFocused: boolean;
  testStatus: TestStatus;
  testError: string | null;
  pendingRemove: boolean;
}

interface ChannelRowProps {
  label: string;
  channel: "discord" | "slack";
  storedUrl: string | null;
  onSave: (url: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onTest: () => Promise<{ success: boolean; error?: string }>;
}

function ChannelRow({ label, channel, storedUrl, onSave, onRemove, onTest }: ChannelRowProps) {
  const [state, setState] = useState<ChannelState>({
    inputValue: storedUrl ? maskUrl(storedUrl) : "",
    isFocused: false,
    testStatus: "idle",
    testError: null,
    pendingRemove: false,
  });

  // Update input when stored value changes (initial load)
  const prevStoredUrl = useRef(storedUrl);
  if (prevStoredUrl.current !== storedUrl && !state.isFocused) {
    prevStoredUrl.current = storedUrl;
    setState((s) => ({
      ...s,
      inputValue: storedUrl ? maskUrl(storedUrl) : "",
      testStatus: "idle",
      testError: null,
    }));
  }

  const handleFocus = () => {
    setState((s) => ({
      ...s,
      isFocused: true,
      // Reveal full URL on focus
      inputValue: storedUrl ?? s.inputValue,
    }));
  };

  const handleBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setState((s) => ({ ...s, isFocused: false }));

    if (!value) {
      setState((s) => ({ ...s, inputValue: storedUrl ? maskUrl(storedUrl) : "" }));
      return;
    }

    if (value === storedUrl) {
      setState((s) => ({ ...s, inputValue: maskUrl(storedUrl) }));
      return;
    }

    if (!value.startsWith("https://")) {
      // Show error inline but don't save
      setState((s) => ({
        ...s,
        inputValue: value,
        testStatus: "error",
        testError: "Invalid webhook URL. Paste a full Discord or Slack webhook URL starting with https://.",
      }));
      return;
    }

    try {
      await onSave(value);
      setState((s) => ({ ...s, inputValue: maskUrl(value), testStatus: "idle", testError: null }));
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        testStatus: "error",
        testError: err instanceof Error ? err.message : "Failed to save URL",
      }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((s) => ({
      ...s,
      inputValue: e.target.value,
      // Clear test error when user edits
      testStatus: "idle",
      testError: null,
    }));
  };

  const handleTest = async () => {
    setState((s) => ({ ...s, testStatus: "loading", testError: null }));
    try {
      const result = await onTest();
      if (result.success) {
        setState((s) => ({ ...s, testStatus: "success" }));
        setTimeout(() => setState((s) => ({ ...s, testStatus: "idle" })), 3000);
      } else {
        setState((s) => ({
          ...s,
          testStatus: "error",
          testError: result.error ?? "Test failed — check URL",
        }));
      }
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        testStatus: "error",
        testError: err instanceof Error ? err.message : "Test failed — check URL",
      }));
    }
  };

  const handleRemoveClick = () => {
    setState((s) => ({ ...s, pendingRemove: true }));
  };

  const handleRemoveCancel = () => {
    setState((s) => ({ ...s, pendingRemove: false }));
  };

  const handleRemoveConfirm = async () => {
    await onRemove();
    setState({
      inputValue: "",
      isFocused: false,
      testStatus: "idle",
      testError: null,
      pendingRemove: false,
    });
  };

  const hasUrl = !!storedUrl;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-normal text-foreground block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            className="font-mono w-full pr-3"
            placeholder={`https://discord.com/api/webhooks/...`}
            value={state.isFocused ? (storedUrl ?? state.inputValue) : state.inputValue}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            aria-label={label}
          />
        </div>

        {/* Status dot */}
        {hasUrl && state.testStatus !== "loading" && (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              state.testStatus === "success"
                ? "bg-[oklch(0.65_0.15_142)]"
                : state.testStatus === "error"
                  ? "bg-[oklch(0.65_0.18_27)]"
                  : "bg-[oklch(0.65_0.15_142)]"
            }`}
            aria-hidden="true"
          />
        )}

        {/* Send Test button — only when URL is stored */}
        {hasUrl && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={state.testStatus === "loading"}
            className="text-sm shrink-0"
          >
            {state.testStatus === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing…
              </>
            ) : (
              "Send Test"
            )}
          </Button>
        )}
      </div>

      {/* Test status text */}
      {state.testStatus === "success" && (
        <p className="text-xs text-[oklch(0.65_0.15_142)]">Test delivered</p>
      )}
      {state.testStatus === "error" && state.testError && (
        <p className="text-xs text-destructive">{state.testError}</p>
      )}

      {/* Remove webhook inline confirm */}
      {hasUrl && !state.pendingRemove && (
        <button
          type="button"
          onClick={handleRemoveClick}
          className="text-xs text-destructive hover:underline"
        >
          Remove webhook
        </button>
      )}
      {state.pendingRemove && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Remove webhook?</span>
          <button
            type="button"
            onClick={handleRemoveConfirm}
            className="text-destructive hover:underline font-medium"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={handleRemoveCancel}
            className="text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function NotificationChannels() {
  const channels = useQuery(api.webhookDelivery.getChannels);
  const setChannel = useMutation(api.webhookDelivery.setChannel);
  const removeChannel = useMutation(api.webhookDelivery.removeChannel);
  const testWebhook = useAction(api.webhookDelivery.testWebhook);

  const handleSave = (channel: "discord" | "slack") => async (url: string) => {
    await setChannel({ channel, url });
  };

  const handleRemove = (channel: "discord" | "slack") => async () => {
    await removeChannel({ channel });
  };

  const handleTest = (channel: "discord" | "slack") => async () => {
    return await testWebhook({ channel });
  };

  return (
    <div>
      <SectionHeader title="NOTIFICATION CHANNELS" />
      <div className="space-y-6">
        <ChannelRow
          label="Discord Webhook URL"
          channel="discord"
          storedUrl={channels?.discordUrl ?? null}
          onSave={handleSave("discord")}
          onRemove={handleRemove("discord")}
          onTest={handleTest("discord")}
        />
        <ChannelRow
          label="Slack Webhook URL"
          channel="slack"
          storedUrl={channels?.slackUrl ?? null}
          onSave={handleSave("slack")}
          onRemove={handleRemove("slack")}
          onTest={handleTest("slack")}
        />
      </div>
    </div>
  );
}
