import { useParams } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { useWizard } from "@/hooks/useWizard";
import WizardShell from "@/components/hr/WizardShell";
import TemplateStep from "@/components/hr/steps/TemplateStep";
import IdentityStep from "@/components/hr/steps/IdentityStep";
import PersonalityStep from "@/components/hr/steps/PersonalityStep";
import ToolsStep from "@/components/hr/steps/ToolsStep";
import ReviewStep from "@/components/hr/steps/ReviewStep";

export default function Onboarding() {
  const { catalogId } = useParams<{ catalogId?: string }>();
  const wizard = useWizard(catalogId);

  const steps = [
    <TemplateStep key="template" />,
    <IdentityStep key="identity" />,
    <PersonalityStep key="personality" />,
    <ToolsStep key="tools" />,
    <ReviewStep key="review" wizard={wizard} />,
  ];

  return (
    <div className="flex-1 overflow-auto">
      <FormProvider {...wizard.form}>
        <WizardShell wizard={wizard}>{steps[wizard.currentStep]}</WizardShell>
      </FormProvider>
    </div>
  );
}
