import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "codepulse_onboarding_complete";

const steps = [
  {
    title: "Welcome to CodePulse",
    description:
      "CodePulse is your real-time telemetry dashboard for monitoring AI agent runtimes. Track sessions, capabilities, performance metrics, and system health all in one place.",
  },
  {
    title: "Connect Your Agent",
    description:
      "Send events to the Convex ingest endpoint to start collecting telemetry. Your agent runtime will report sessions, tool invocations, LLM calls, and system metrics automatically.",
  },
  {
    title: "Explore Your Dashboard",
    description:
      "Navigate using the sidebar: Dashboard for an overview, Analytics for trends, Capabilities for tool usage, Alerts for anomalies, and Infrastructure for system health.",
  },
  {
    title: "You're Ready!",
    description:
      "You're all set to monitor your AI agents. The dashboard updates in real-time as events flow in. Happy monitoring!",
  },
];

export default function OnboardingGuide() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  // Escape dismisses the guide so it never traps the operator (must run before
  // the early return — hooks are unconditional).
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  return (
    // Backdrop click (outside the card) dismisses — never a no-exit click trap.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="relative bg-card border border-border rounded-xl p-6 max-w-lg w-full mx-4">
        {/* Always-visible close affordance */}
        <button
          onClick={dismiss}
          aria-label="Close onboarding"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        {/* Step content */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {steps[step].title}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            {steps[step].description}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            className={`px-4 py-2 text-base rounded-lg transition-colors ${
              isFirst
                ? "text-muted-foreground/50 cursor-not-allowed"
                : "text-foreground hover:bg-accent"
            }`}
          >
            Previous
          </button>
          <div className="flex gap-2">
            {!isLast && (
              <button
                onClick={dismiss}
                className="px-4 py-2 text-base text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip
              </button>
            )}
            {isLast ? (
              <button
                onClick={dismiss}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-base text-primary-foreground rounded-lg transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-base text-primary-foreground rounded-lg transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
