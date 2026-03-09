"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useOnboarding } from "@/hooks/use-onboarding";
import WelcomeStep from "./WelcomeStep";
import ReadinessStep from "./ReadinessStep";
import ConfigStep from "./ConfigStep";
import ReadyStep from "./ReadyStep";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const {
    status,
    loading,
    step,
    stepIndex,
    totalSteps,
    nextStep,
    prevStep,
    saveKey,
    dismiss,
  } = useOnboarding();

  if (loading || !status) return null;

  const handleConfigNext = (config: {
    maxAgents: number;
    defaultUrgency: "speed" | "balanced" | "thorough";
    enableMemoryBus: boolean;
    enableCriticPass: boolean;
  }) => {
    // Fire-and-forget settings save — don't block navigation
    fetch("/api/settings")
      .then((r) => r.json())
      .then((current) =>
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...current, ...config }),
        })
      )
      .catch(() => {});
    nextStep();
  };

  const handleDismiss = async (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      await dismiss();
    }
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-prism-bg"
    >
      {/* Progress indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i <= stepIndex
                ? "w-8 bg-prism-sky"
                : "w-4 bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <WelcomeStep key="welcome" onNext={nextStep} />
        )}
        {step === "readiness" && (
          <ReadinessStep
            key="readiness"
            keys={status.keys}
            onSaveKey={saveKey}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {step === "config" && (
          <ConfigStep
            key="config"
            onNext={handleConfigNext}
            onBack={prevStep}
          />
        )}
        {step === "ready" && (
          <ReadyStep
            key="ready"
            onDismiss={handleDismiss}
            onBack={prevStep}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
