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
    <GlassPanel className="m-6 rounded-xl flex flex-col flex-1 overflow-hidden relative">
      <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none animate-scanline mix-blend-overlay" />
      {/* Header with stepper */}
      <div className="px-6 pt-5 pb-3 border-b border-border/30 relative z-10">
        <h1 className="text-lg font-bold font-mono tracking-wide text-foreground mb-3 uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Agent Initialization
        </h1>
        <WizardStepper
          currentStep={currentStep}
          totalSteps={totalSteps}
          labels={stepLabels}
          onStepClick={goToStep}
        />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto px-6 py-5 relative z-10">
        {deploying && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 rounded-b-xl">
            <div className="flex flex-col items-center gap-4 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm font-mono tracking-widest uppercase">Initializing Agent Sequence...</span>
            </div>
          </div>
        )}
        {children}
      </div>

      {/* Navigation footer */}
      <div className="px-6 py-4 border-t border-border/30 flex items-center gap-3 relative z-10 bg-background/20 backdrop-blur-sm">
        <button
          onClick={goBack}
          disabled={isFirstStep}
          className="px-4 py-2 font-mono tracking-wider text-sm uppercase rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-card/50 backdrop-blur"
        >
          Back
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {savedAt && (
            <span className="text-xs font-mono tracking-widest text-primary/70 animate-in fade-in uppercase">
              Draft saved {savedAt}
            </span>
          )}
          <button
            onClick={handleSaveDraft}
            className="flex items-center gap-1.5 px-3 py-2 font-mono tracking-wider text-sm uppercase rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors bg-card/50 backdrop-blur"
          >
            <Save className="h-3.5 w-3.5" />
            Save Draft
          </button>
          {isLastStep ? (
            <button
              onClick={goNext}
              disabled={deploying}
              className="px-5 py-2 font-mono font-bold tracking-wider text-sm uppercase rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-50"
            >
              Deploy
            </button>
          ) : (
            <button
              onClick={goNext}
              className="px-5 py-2 font-mono font-bold tracking-wider text-sm uppercase rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}
