/**
 * PRISM Intelligence Pipeline
 *
 * Exports the complete pipeline: THINK -> CONSTRUCT -> DEPLOY -> SYNTHESIZE -> VERIFY -> PRESENT -> REFINE
 * Plus the orchestrator that composes all phases.
 */

// Pipeline executor (main entry point)
export { executePipeline, type PipelineInput } from "./executor";

// Individual phases
export { think } from "./think";
export { construct } from "./construct";
export { deploy, type DeployInput, type DeployOutput } from "./deploy";
export { synthesize, type SynthesizeInput } from "./synthesize";
export { verify, type VerifyInput, type VerifyOutput } from "./verify";
export { present, type PresentInput } from "./present";
export { refine, type RefineInput, type RefineOutput } from "./refine";
export {
  runQualityAssurance,
  getQualityGateSystem,
  buildProvenanceChain,
  scoreOutput,
  aggregateWarnings,
  QualityGateSystem,
  type QualityAssuranceReport,
  type ProvenanceReport,
  type QualityScoreReport,
  type QualityWarning,
} from "./quality-assurance";

// Shared Memory Bus (used by deploy for wave execution)
export { MemoryBus } from "./memory-bus";

// Archetype Registry
export {
  ARCHETYPE_REGISTRY,
  getArchetype,
  searchArchetypes,
  getArchetypesForSkill,
  forgeArchetype,
  type ArchetypeProfile,
  type ForgedArchetype,
} from "./archetypes";

// Types (re-exported for convenience)
export type {
  Blueprint,
  DimensionAnalysis,
  AgentRecommendation,
  ConstructedAgent,
  AgentFinding,
  AgentResult,
  EmergentInsight,
  EmergenceQuality,
  TensionPoint,
  SynthesisLayer,
  SynthesisResult,
  PresentationResult,
  QualityReport,
  VerifiedClaim,
  FindingModification,
  IntelligenceManifest,
  PipelineEvent,
  SwarmTier,
  ConfidenceLevel,
  SourceTier,
  EvidenceType,
  AutonomyMode,
  NudgeType,
  ArchetypeFamily,
} from "./types";
