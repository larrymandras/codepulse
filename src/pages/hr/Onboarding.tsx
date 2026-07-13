import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { FormProvider } from "react-hook-form";
import { useWizard } from "@/hooks/useWizard";
import WizardShell from "@/components/hr/WizardShell";
import TemplateStep from "@/components/hr/steps/TemplateStep";
import IdentityStep from "@/components/hr/steps/IdentityStep";
import PersonalityStep from "@/components/hr/steps/PersonalityStep";
import ToolsStep from "@/components/hr/steps/ToolsStep";
import ReviewStep from "@/components/hr/steps/ReviewStep";
import { fetchAgentDetail } from "@/lib/astridrApi";
import { PageHeader } from "@/components/PageHeader";

export default function Onboarding() {
  const { catalogId } = useParams<{ catalogId?: string }>();
  const [searchParams] = useSearchParams();
  const cloneId = searchParams.get("clone");
  const wizard = useWizard(catalogId ?? (cloneId ? "__clone__" : undefined));

  useEffect(() => {
    if (!cloneId) return;
    let cancelled = false;
    fetchAgentDetail(cloneId).then((agent) => {
      if (cancelled) return;
      wizard.form.reset({
        template: {},
        identity: {
          agentId: agent.id,
          displayName: agent.name,
          tier: agent.tier,
          description: agent.description ?? "",
          profiles: agent.profiles ?? [],
          channels: agent.channels ?? [],
          budgetFraction: agent.budget_fraction,
          maxRounds: agent.max_rounds,
        },
        personality: {
          mode: "template",
          content: "",
        },
        tools: {
          mode: agent.tools_enabled.length > 0 ? "individual" : "glob",
          tools: agent.tools_enabled,
          patterns: [],
          peerCommAllowed: agent.peer_comm_allowed ?? [],
        },
        deployment: { type: "permanent" },
      });
    });
    return () => { cancelled = true; };
  }, [cloneId]);

  const steps = [
    <TemplateStep key="template" />,
    <IdentityStep key="identity" />,
    <PersonalityStep key="personality" />,
    <ToolsStep key="tools" />,
    <ReviewStep key="review" wizard={wizard} />,
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader title="Onboarding" className="mx-6 mt-6" />
      <FormProvider {...wizard.form}>
        <WizardShell wizard={wizard}>{steps[wizard.currentStep]}</WizardShell>
      </FormProvider>
    </div>
  );
}
