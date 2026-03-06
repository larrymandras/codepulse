import { useState, useEffect } from "react";

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

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 max-w-lg w-full mx-4">
        {/* Step content */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-2">
            {steps[step].title}
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            {steps[step].description}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-indigo-500" : "bg-gray-600"
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              isFirst
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-300 hover:bg-gray-700"
            }`}
          >
            Previous
          </button>
          <div className="flex gap-2">
            {!isLast && (
              <button
                onClick={dismiss}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Skip
              </button>
            )}
            {isLast ? (
              <button
                onClick={dismiss}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm text-white rounded-lg transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-sm text-white rounded-lg transition-colors"
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
