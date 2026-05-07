import React, { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import SkillPicker from "./SkillPicker";
import DesignSystemPicker from "./DesignSystemPicker";
import DiscoveryForm from "./DiscoveryForm";

const STEP_LABELS = ["Skill", "Design System", "Brief", "Direction", "Preview", "Export"];

export default function NativeWorkflow() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedDesignSystemId, setSelectedDesignSystemId] = useState<string | null>(null);
  const [brief, setBrief] = useState("");
  const [selectedDirectionIdx, setSelectedDirectionIdx] = useState<number | null>(null);
  const [generationStarted, setGenerationStarted] = useState(false);

  // Suppress unused variable warnings — these will be used in Plan 04
  void selectedDirectionIdx;
  void setSelectedDirectionIdx;
  void setGenerationStarted;

  function canGoToStep(idx: number): boolean {
    // Can't go back past step 4 once generation has started
    if (generationStarted && idx < 4) return false;
    // Can't skip ahead past the current step
    if (idx > currentStep) return false;
    return true;
  }

  function canAdvance(): boolean {
    switch (currentStep) {
      case 0:
        return selectedSkillId !== null;
      case 1:
        return selectedDesignSystemId !== null;
      case 2:
        return brief.trim().length > 0;
      default:
        return true;
    }
  }

  function handleNext() {
    setCurrentStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function renderStep() {
    switch (currentStep) {
      case 0:
        return (
          <SkillPicker
            selectedSkillId={selectedSkillId}
            onSelect={setSelectedSkillId}
          />
        );
      case 1:
        return (
          <DesignSystemPicker
            selectedDesignSystemId={selectedDesignSystemId}
            onSelect={setSelectedDesignSystemId}
          />
        );
      case 2:
        return (
          <DiscoveryForm
            brief={brief}
            onBriefChange={setBrief}
            onSubmit={() => setCurrentStep(3)}
          />
        );
      case 3:
        return (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Direction picker — coming in next update
          </div>
        );
      case 4:
        return (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Streaming preview — coming in next update
          </div>
        );
      case 5:
        return (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Export panel — coming in next update
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl flex flex-col">
      {/* Step indicator */}
      <div className="flex items-center gap-1 px-6 pt-5 pb-3 border-b border-border/30">
        {STEP_LABELS.map((label, idx) => (
          <React.Fragment key={label}>
            {idx > 0 && <div className="flex-1 h-px bg-border" />}
            <button
              onClick={() => canGoToStep(idx) && setCurrentStep(idx)}
              disabled={!canGoToStep(idx)}
              aria-current={idx === currentStep ? "step" : undefined}
              aria-label={`Step ${idx + 1} of 6: ${label}`}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors",
                idx === currentStep ? "text-primary font-semibold" : "text-muted-foreground",
                idx < currentStep ? "text-muted-foreground" : "",
                !canGoToStep(idx)
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:text-foreground",
              )}
            >
              {idx < currentStep ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium border",
                    idx === currentStep
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {idx + 1}
                </span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto px-6 py-5">{renderStep()}</div>

      {/* Navigation footer */}
      <div className="px-6 py-4 border-t border-border/30 flex items-center gap-3">
        <button
          onClick={() => setCurrentStep((s) => s - 1)}
          disabled={currentStep === 0 || (generationStarted && currentStep <= 4)}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canAdvance()}
          className="ml-auto px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {currentStep === STEP_LABELS.length - 1 ? "Done" : "Next"}
        </button>
      </div>
    </div>
  );
}
