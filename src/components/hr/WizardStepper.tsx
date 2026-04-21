import { Check } from "lucide-react";

interface WizardStepperProps {
  currentStep: number;
  totalSteps: number;
  labels: readonly string[];
  onStepClick?: (step: number) => void;
}

export default function WizardStepper({
  currentStep,
  totalSteps,
  labels,
  onStepClick,
}: WizardStepperProps) {
  return (
    <>
      {/* Desktop stepper */}
      <div className="hidden sm:flex items-center justify-center gap-0 w-full py-2">
        {labels.map((label, i) => {
          const completed = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={label} className="flex items-center">
              {/* Step circle + label */}
              <button
                onClick={() => completed && onStepClick?.(i)}
                disabled={!completed}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border transition-colors ${
                    completed
                      ? "bg-primary border-primary text-primary-foreground cursor-pointer group-hover:bg-primary/80"
                      : active
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-transparent border-border/40 text-muted-foreground"
                  }`}
                >
                  {completed ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-[11px] whitespace-nowrap ${
                    active
                      ? "text-foreground font-medium"
                      : completed
                        ? "text-muted-foreground"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {label}
                </span>
              </button>
              {/* Connecting line */}
              {i < totalSteps - 1 && (
                <div
                  className={`w-12 h-px mx-1 mt-[-18px] ${
                    i < currentStep
                      ? "bg-primary"
                      : "bg-border/40 border-t border-dashed border-border/40"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: compact */}
      <div className="sm:hidden flex items-center justify-center gap-2 py-2">
        <span className="text-xs text-muted-foreground">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="text-xs font-medium text-foreground">
          {labels[currentStep]}
        </span>
      </div>
    </>
  );
}
