/**
 * PRISM Intelligence Pipeline
 * 
 * Tier 1: Intelligence Core
 * 
 * Exports the complete pipeline: THINK → CONSTRUCT → DEPLOY → SYNTHESIZE
 * Plus the orchestrator that composes all phases.
 */

// Pipeline executor (main entry point)
export { executePipeline, type PipelineInput, type PipelineOutput } from "./executor";

// Individual phases (for fine-grained control)
export { think, type ThinkInput, type ThinkOutput } from "./think";
export { construct, type ConstructedAgent, type ConstructOutput } from "./construct";
export { deploy, type DeployInput, type DeployOutput, type AgentDeployResult } from "./deploy";
export { synthesize, criticReview, type SynthesizeInput, type SynthesizeOutput } from "./synthesize";


// Analysis Store (execution tracking, decomposition patterns)
export {
    AnalysisStore,
    DECOMPOSITION_ARCHETYPE_MAP,
    type ExecutionState,
    type ExecutionPhase,
    type ExecutionStatus,
    type DecompositionPattern,
} from "./analysis-store";

// Archetype Registry (25+ archetypes with machine-readable metadata)
export {
    ARCHETYPE_REGISTRY,
    getArchetype,
    searchArchetypes,
    getArchetypesForSkill,
    forgeArchetype,
    COMPOSITION_CHEMISTRY,
    type ArchetypeProfile,
    type ForgedArchetype,
    type CompositionRule,
    type ArchetypeCategory,
    type SynthesisRole,
} from "./archetypes";

// Shared Memory Bus (blackboard, signals, conflicts)
export {
    MemoryBus,
    type BlackboardEntry,
    type Signal,
    type Conflict,
    type MemoryBusState,
    type SignalType,
    type SignalPriority,
    type ConflictStatus,
} from "./memory-bus";

// Types
export type {
    Blueprint,
    DimensionAnalysis,
    AgentRecommendation,
    AgentFinding,
    AgentResult,
    EmergentInsight,
    EmergenceQuality,
    TensionPoint,
    SynthesisLayer,
    SynthesisResult,
    IntelligenceManifest,
    PipelineEvent,
    SwarmTier,
    ConfidenceLevel,
    AgentExecutionMeta,
} from "./types";

// MCP Tool Proxy (external data source access)
export {
    MCPToolProxy,
    TOOL_REGISTRY,
    type ToolResult,
    type ToolDefinition,
    type ToolCategory,
} from "./mcp-tools";

// PRISM-SDK MCP Server (exposes PRISM as MCP tools)
export {
    handlePrismToolCall,
    PRISM_MCP_TOOLS,
    type MCPToolSchema,
    type MCPToolResult,
} from "./prism-mcp-server";

// OpenSecrets Political Influence (bulk data sweep)
export {
    OpenSecretsStore,
    getOpenSecretsStore,
    OPENSECRETS_TOOLS,
    SWEEP_CADENCES,
} from "./opensecrets";

// Platform Skill Router (domain intelligence injection)
export {
    SkillRouter,
    getSkillRouter,
    type PlatformSkill,
} from "./skill-router";

// Quality Assurance System (Phase 4)
export {
    buildProvenanceChain,
    QualityGateSystem,
    getQualityGateSystem,
    scoreOutput,
    aggregateWarnings,
    runQualityAssurance,
    type ProvenanceReport,
    type ProvenanceLink,
    type QualityScoreReport,
    type QualityAssuranceReport,
    type QualityWarning,
    type GateDecision,
} from "./quality-assurance";
