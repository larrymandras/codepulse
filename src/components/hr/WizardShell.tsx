import { useState, useEffect, type ReactNode } from "react";
import { GlassPanel } from "@/components/GlassPanel";
import WizardStepper from "./WizardStepper";
import { Loader2, Save } from "lucide-react";
import type { useWizard } from "@/hooks/useWizard";

interface WizardShellProps {
  children: ReactNode;
  wizard: ReturnType<typeof useWizard>;
}

export default function WizardShell({ children, wizard }: WizardShellProps) {
  const {
    currentStep,
    goNext,
    goBack,
    goToStep,
    autoSave,
    deploying,
    totalSteps,
    stepLabels,
  } = wizard;

  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Fade out "Draft saved" message after 3s
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 3000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const handleSaveDraft = async () => {
    await autoSave();
    setSavedAt(new Date().toLocaleTimeString());
  };

  return (
    <GlassPanel className="m-6 rounded-xl flex flex-col">
      {/* Header with stepper */}
      <div className="px-6 pt-5 pb-3 border-b border-border/30">
        <h1 className="text-lg font-semibold text-foreground mb-3">
          Onboard Agent
        </h1>
        <WizardStepper
          currentStep={currentStep}
          totalSteps={totalSteps}
          labels={stepLabels}
          onStepClick={goToStep}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto px-6 py-5 relative">
        {deploying && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-10 rounded-b-xl">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Deploying agent...</span>
            </div>
          </div>
        )}
        {children}
      </div>

      {/* Navigation footer */}
      <div className="px-6 py-4 border-t border-border/30 flex items-center gap-3">
        <button
          onClick={goBack}
          disabled={isFirstStep}
          className="px-4 py-2 text-sm rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Back
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {savedAt && (
            <span className="text-[11px] text-muted-foreground/60 animate-in fade-in">
              Draft saved {savedAt}
            </span>
          )}
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </button>
          {isLastStep ? (
            <button
              onClick={goNext}
              disabled={deploying}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50"
            >
              Deploy
            </button>
          ) : (
            <button
              onClick={goNext}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
