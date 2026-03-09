"use client";

import { useState, useCallback, useEffect } from "react";
import type { AgentRunState, LogEntry, Finding, FindingAction, BlueprintData } from "@/lib/types";
import { DeckMeta, DECK_LIBRARY } from "@/lib/deck-data";


import { useResearchStream, type StreamPhase, type StreamFinding } from "@/hooks/use-research-stream";
import { AGENT_COLORS } from "@/lib/constants";
import type { Phase } from "@/lib/types";

import InputPhase from "@/components/phases/InputPhase";
import ExecutingPhase from "@/components/phases/ExecutingPhase";
import TriagePhase from "@/components/phases/TriagePhase";
import SynthesisPhase from "@/components/phases/SynthesisPhase";
import CompletePhase from "@/components/phases/CompletePhase";
import BlueprintApproval from "@/components/BlueprintApproval";
import DeckLibrary from "@/components/DeckLibrary";
import DeckViewer from "@/components/DeckViewer";
import AdminSettings from "@/components/AdminSettings";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import CoachMarkProvider, { useCoachMarkPhase } from "@/components/onboarding/CoachMarkProvider";
import PhaseTransition from "@/components/PhaseTransition";

function PhaseSync({ phase }: { phase: Phase }) {
  const { setCurrentPhase } = useCoachMarkPhase();
  useEffect(() => {
    setCurrentPhase(phase);
  }, [phase, setCurrentPhase]);
  return null;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [selectedDeck, setSelectedDeck] = useState<DeckMeta | null>(null);
  const [blueprintApproved, setBlueprintApproved] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const stream = useResearchStream();

  useEffect(() => {
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((data) => {
        setShowOnboarding(!data.onboardingDismissed);
        setOnboardingChecked(true);
      })
      .catch(() => setOnboardingChecked(true));
  }, []);

  // ─── Start live analysis ──────────────────────────
  const handleSubmitLive = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const runId = `run-${Date.now()}`;
    setBlueprintApproved(false);
    // Don't set phase here — let the stream drive it
    stream.startStream(query, runId);
  }, [query, stream]);

  const handleFindingAction = useCallback((id: string, action: FindingAction) => {
    const streamAction = action === "keep" ? "approve" :
      action === "dismiss" ? "reject" :
        action === "boost" ? "approve" :
          "flag";
    stream.setFindingAction(id, streamAction as any);
  }, [stream]);



  // ─── Map stream state to component-compatible data ─
  const streamAgents: AgentRunState[] = stream.agents.map((a, i) => ({
    id: a.id,
    name: a.name,
    archetype: a.archetype,
    mandate: `${a.dimension} analysis agent`,
    tools: [],
    dimension: a.dimension,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
    status: a.status === "pending" ? "idle" as const : a.status as AgentRunState["status"],
    progress: a.progress,
    logs: [],
    findings: stream.findings
      .filter(f => f.agentId === a.id)
      .map(f => ({
        id: f.id,
        agentId: f.agentId,
        agentName: a.name,
        statement: f.statement,
        evidence: f.evidence,
        confidence: f.confidence,
        source: f.source,
        implication: f.implication,
        action: "keep" as FindingAction,
      })),
  }));

  const streamFindings: Finding[] = stream.findings.map(f => {
    const agent = stream.agents.find(a => a.id === f.agentId);
    return {
      id: f.id,
      agentId: f.agentId,
      agentName: agent?.name ?? "Agent",
      statement: f.statement,
      evidence: f.evidence,
      confidence: f.confidence,
      source: f.source,
      implication: f.implication,
      action: (f.action === "approve" ? "keep" : f.action === "reject" ? "dismiss" : f.action === "flag" ? "flag" : "keep") as FindingAction,
    };
  });

  // Use real-time logs accumulated by the hook
  const streamLogs: LogEntry[] = stream.logs;

  // Auto-transition based on stream phase
  const effectivePhase: Phase = (
    stream.phase === "idle" ? phase :
      stream.phase === "think" ? "executing" :
        stream.phase === "blueprint" && !blueprintApproved ? "blueprint" :
          stream.phase === "construct" || (stream.phase === "blueprint" && blueprintApproved) ? "executing" :
            stream.phase === "deploy" ? "executing" :
              stream.phase === "triage" ? "triage" :
                stream.phase === "synthesize" || stream.phase === "qa" ? "synthesis" :
                  stream.phase === "complete" ? "complete" :
                    stream.phase === "error" ? "complete" :
                      phase
  );


  // ─── Onboarding Gate ─────────────────────────────────
  if (!onboardingChecked) return null;

  if (showOnboarding) {
    return (
      <OnboardingWizard onComplete={() => setShowOnboarding(false)} />
    );
  }

  // ─── Phase Routing ─────────────────────────────────

  const blueprintData = stream.blueprint ? {
    query: stream.blueprint.query,
    tier: stream.blueprint.tier as "MICRO" | "STANDARD" | "EXTENDED" | "MEGA",
    estimatedTime: stream.blueprint.estimatedTime,
    agentCount: stream.blueprint.agents.length,
    complexity: stream.blueprint.complexity,
    dimensions: stream.blueprint.dimensions.map((d, i) => ({ id: `dim-${i}`, ...d })),
    agents: stream.blueprint.agents.map((a, i) => ({
      id: `agent-${i}`,
      name: a.name,
      archetype: a.archetype,
      mandate: a.mandate,
      tools: a.tools,
      dimension: a.dimension,
      color: AGENT_COLORS[i % AGENT_COLORS.length],
    })),
  } : null;

  const activeAgents = streamAgents;
  const activeLogs = streamLogs;
  const executingPhaseLabel = stream.phase === "idle" || stream.phase === "think" ? "THINKING — DECOMPOSING QUERY"
    : stream.phase === "construct" ? "CONSTRUCTING AGENT PROMPTS"
      : "DEPLOYING AGENTS";

  const activeFindings = streamFindings;
  const triageAgentCount = stream.agents.length;

  const completeSynthesisLayers = stream.synthesisLayers as any;
  const completeFindingCount = stream.findings.length;
  const completeHasError = stream.phase === "error";

  const phaseContent = effectivePhase === "input" ? (
    <InputPhase
      query={query}
      setQuery={setQuery}
      onSubmitLive={handleSubmitLive}
      onOpenSettings={() => setPhase("settings")}
    />
  ) : effectivePhase === "blueprint" && blueprintData ? (
    <BlueprintApproval
      blueprint={blueprintData}
      onApprove={() => {
        // POST approval to server — this unblocks the executor
        fetch("/api/pipeline/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId: stream.runId }),
        }).catch(console.error);
        setBlueprintApproved(true);
      }}
    />
  ) : effectivePhase === "executing" ? (
    <ExecutingPhase
      agents={activeAgents}
      logs={activeLogs}
      phaseLabel={executingPhaseLabel}
      phaseMessage={stream.phaseMessage}
      isLiveMode={true}
    />
  ) : effectivePhase === "triage" ? (
    <TriagePhase
      findings={activeFindings}
      agentCount={triageAgentCount}
      onAction={handleFindingAction}
      onApproveAndSynthesize={() => setPhase("synthesis")}
    />
  ) : effectivePhase === "synthesis" ? (
    <SynthesisPhase
      synthesisLayers={completeSynthesisLayers}
      emergences={stream.emergences}
      phaseMessage={stream.phaseMessage}
      isLiveMode={true}
    />
  ) : effectivePhase === "complete" ? (
    <CompletePhase
      synthesisLayers={completeSynthesisLayers}
      findingCount={completeFindingCount}
      hasError={completeHasError}
      errorMessage={stream.error}
      isLiveMode={true}
      quality={stream.quality}
      completionData={stream.completionData}
      emergences={stream.emergences}
      onNewAnalysis={() => {
        stream.reset();
        setPhase("input");
        setQuery("");
      }}
      onViewBrief={() => {
        if (stream.completionData?.presentationPath) {
          window.open(stream.completionData.presentationPath, "_blank");
        } else {
          setSelectedDeck(DECK_LIBRARY[0]);
          setPhase("viewer");
        }
      }}
      onBrowseLibrary={() => setPhase("library")}
    />
  ) : effectivePhase === "library" ? (
    <DeckLibrary
      onSelectDeck={(deck) => {
        setSelectedDeck(deck);
        setPhase("viewer");
      }}
      onBack={() => setPhase("complete")}
    />
  ) : effectivePhase === "viewer" && selectedDeck ? (
    <DeckViewer
      deck={selectedDeck}
      onClose={() => setPhase("library")}
    />
  ) : effectivePhase === "settings" ? (
    <AdminSettings onBack={() => setPhase("input")} />
  ) : null;

  return (
    <CoachMarkProvider>
      <PhaseSync phase={effectivePhase} />
      <PhaseTransition phaseKey={effectivePhase}>
        {phaseContent}
      </PhaseTransition>
    </CoachMarkProvider>
  );
}
