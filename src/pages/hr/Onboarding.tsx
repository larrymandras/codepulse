import { useParams } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { useWizard } from "@/hooks/useWizard";
import WizardShell from "@/components/hr/WizardShell";
import TemplateStep from "@/components/hr/steps/TemplateStep";
import IdentityStep from "@/components/hr/steps/IdentityStep";

// Placeholder components for steps 3-5 until Plan 3
function PersonalityStepPlaceholder() {
  return (
    <div className="p-4 text-muted-foreground">
      Personality step -- coming next
    </div>
  );
}
function ToolsStepPlaceholder() {
  return (
    <div className="p-4 text-muted-foreground">Tools step -- coming next</div>
  );
}
function ReviewStepPlaceholder() {
  return (
    <div className="p-4 text-muted-foreground">
      Review step -- coming next
    </div>
  );
}

export default function Onboarding() {
  const { catalogId } = useParams<{ catalogId?: string }>();
  const wizard = useWizard(catalogId);

  const steps = [
    <TemplateStep key="template" />,
    <IdentityStep key="identity" />,
    <PersonalityStepPlaceholder key="personality" />,
    <ToolsStepPlaceholder key="tools" />,
    <ReviewStepPlaceholder key="review" />,
  ];

  return (
    <div className="flex-1 overflow-auto">
      <FormProvider {...wizard.form}>
        <WizardShell wizard={wizard}>{steps[wizard.currentStep]}</WizardShell>
      </FormProvider>
    </div>
  );
}
