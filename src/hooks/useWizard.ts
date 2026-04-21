import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  wizardFormSchema,
  type WizardFormData,
  STEP_LABELS,
} from "@/lib/wizardSchemas";
import type { Id } from "../../convex/_generated/dataModel";

const DEFAULT_FORM: WizardFormData = {
  template: {},
  identity: { agentId: "", displayName: "", tier: "shared" },
  personality: { mode: "template", content: "" },
  tools: { mode: "glob", patterns: [] },
  deployment: { type: "permanent" },
};

export function useWizard(initialCatalogId?: string) {
  const [currentStep, setCurrentStep] = useState(initialCatalogId ? 1 : 0);
  const [draftId, setDraftId] = useState<Id<"wizardDrafts"> | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const saveDraft = useMutation(api.wizardDrafts.save);

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardFormSchema),
    defaultValues: initialCatalogId
      ? {
          ...DEFAULT_FORM,
          template: {
            catalogEntryId: initialCatalogId,
            catalogEntryName: initialCatalogId,
          },
        }
      : DEFAULT_FORM,
    mode: "onTouched",
  });

  const autoSave = useCallback(async () => {
    const data = form.getValues();
    try {
      const id = await saveDraft({
        id: draftId ?? undefined,
        catalogEntryId: data.template.catalogEntryId,
        currentStep,
        formData: {
          identity: data.identity,
          personality: data.personality,
          tools: data.tools,
          deployment: data.deployment,
        },
        status: "draft",
      });
      if (!draftId) setDraftId(id as Id<"wizardDrafts">);
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  }, [form, draftId, currentStep, saveDraft]);

  const goNext = useCallback(async () => {
    const stepKey = [
      "template",
      "identity",
      "personality",
      "tools",
      "deployment",
    ][currentStep] as keyof WizardFormData;
    const valid = await form.trigger(stepKey);
    if (!valid) return false;
    await autoSave();
    setCurrentStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
    return true;
  }, [currentStep, form, autoSave]);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < STEP_LABELS.length) {
      setCurrentStep(step);
    }
  }, []);

  return {
    form,
    currentStep,
    goNext,
    goBack,
    goToStep,
    autoSave,
    draftId,
    deploying,
    setDeploying,
    deployResult,
    setDeployResult,
    totalSteps: STEP_LABELS.length,
    stepLabels: STEP_LABELS,
  };
}
