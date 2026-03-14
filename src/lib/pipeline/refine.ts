/**
 * PRISM Pipeline -- Phase 5: REFINE
 *
 * Post-delivery nudge protocol.
 *
 * After a presentation is delivered, the user can submit a "nudge" —
 * a natural language request to refine, correct, deepen, extend, model,
 * or target the analysis. This phase:
 *
 * 1. Classifies the nudge into one of 5 NudgeTypes via Sonnet
 * 2. Inherits relevant context from the original manifest
 * 3. Deploys 1-3 focused agents to address the nudge
 * 4. Synthesizes new findings with the original synthesis
 *
 * The result can then be fed back into Phase 4 (PRESENT) to generate
 * an updated presentation.
 *
 * Uses Anthropic SDK directly with:
 * - Sonnet model for nudge classification and agent deployment
 * - Prompt caching for context inheritance
 * - submit_findings tool for structured agent output
 * - Zod validation of all outputs
 */

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicClient,
  MODELS,
  cachedSystemPrompt,
} from "@/lib/ai/client";
import {
  NudgeTypeEnum,
  AgentResultSchema,
  type IntelligenceManifest,
  type NudgeType,
  type AgentResult,
  type SynthesisResult,
  type PresentationResult,
  type PipelineEvent,
  type AgentFinding,
} from "./types";

// ─── Types ──────────────────────────────────────────────────

export interface RefineInput {
  nudge: string;
  originalManifest: IntelligenceManifest;
  emitEvent: (event: PipelineEvent) => void;
}

export interface RefineOutput {
  nudgeType: NudgeType;
  newAgentResults: AgentResult[];
  updatedSynthesis: SynthesisResult;
  presentation?: PresentationResult;
}

// ─── Nudge Classification ───────────────────────────────────

const NUDGE_CLASSIFICATION_PROMPT = `You are a nudge classifier for the PRISM intelligence pipeline.

Given a user's refinement request ("nudge") after receiving an intelligence brief,
classify it into exactly one of these 5 types:

1. **CORRECT** — Accuracy fix. The user is pointing out an error, outdated data,
   or factual inaccuracy in the original analysis.
   Examples: "That revenue figure is wrong", "They actually merged last month",
   "The CEO changed in Q3"

2. **DEEPEN** — Deeper analysis within an existing dimension. The user wants more
   detail on something already covered.
   Examples: "Tell me more about the regulatory risk", "Dig deeper into their
   financial position", "What's behind that 40% decline?"

3. **EXTEND** — New dimension not covered in the original analysis. The user wants
   to explore a topic the original swarm didn't address.
   Examples: "What about cybersecurity risk?", "How does ESG factor in?",
   "Analyze their patent portfolio"

4. **MODEL** — Quantitative impact projection. The user wants a financial model,
   scenario analysis, or quantitative projection.
   Examples: "Model the revenue impact of losing that contract", "What happens
   to margins if raw materials go up 20%?", "Project their cash runway"

5. **TARGET** — Entity-specific opportunity identification. The user wants to
   identify specific opportunities, targets, or actionable items for a particular
   entity.
   Examples: "Where can they gain market share?", "Which providers should they
   target?", "Identify acquisition opportunities"

Respond with a JSON object: { "nudgeType": "<TYPE>", "reasoning": "<why>" }`;

/**
 * Classify a user nudge into one of 5 NudgeTypes.
 */
async function classifyNudge(nudge: string): Promise<NudgeType> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODELS.CONSTRUCT, // Sonnet — fast classification
    max_tokens: 256,
    system: [cachedSystemPrompt(NUDGE_CLASSIFICATION_PROMPT)],
    messages: [
      {
        role: "user",
        content: `Classify this nudge:\n\n"${nudge}"`,
      },
    ],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.Messages.TextBlock => block.type === "text",
  );

  if (!textBlock) {
    console.warn("[REFINE] No text in nudge classification response. Defaulting to DEEPEN.");
    return "DEEPEN";
  }

  try {
    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = textBlock.text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error("No JSON found");

    const parsed = JSON.parse(jsonMatch[0]) as { nudgeType: string };
    const validated = NudgeTypeEnum.parse(parsed.nudgeType);
    return validated;
  } catch {
    console.warn("[REFINE] Failed to parse nudge classification. Defaulting to DEEPEN.");
    return "DEEPEN";
  }
}

// ─── Context Inheritance ────────────────────────────────────

/**
 * Extract relevant findings from the original manifest based on nudge type.
 * Returns a summary string of what's already known.
 */
function inheritContext(
  manifest: IntelligenceManifest,
  nudgeType: NudgeType,
  nudge: string,
): string {
  const { blueprint, agentResults, synthesis } = manifest;
  const parts: string[] = [];

  parts.push(`# Original Analysis Context`);
  parts.push(`**Query:** ${blueprint.query}`);
  parts.push(`**Tier:** ${blueprint.tier}`);
  parts.push(`**Agents:** ${agentResults.map((a) => `${a.agentName} (${a.archetype})`).join(", ")}`);

  // Include relevant synthesis layers
  parts.push(`\n## Key Findings from Original Analysis`);
  for (const layer of synthesis.layers) {
    parts.push(`### ${layer.name.toUpperCase()} Layer`);
    for (const insight of layer.insights.slice(0, 5)) {
      parts.push(`- ${insight}`);
    }
  }

  // Include emergent insights (always relevant)
  if (synthesis.emergentInsights.length > 0) {
    parts.push(`\n## Emergent Insights`);
    for (const ei of synthesis.emergentInsights) {
      parts.push(`- ${ei.insight} (via ${ei.supportingAgents.join(", ")})`);
    }
  }

  // For CORRECT nudges, include all findings with source tiers
  if (nudgeType === "CORRECT") {
    parts.push(`\n## All Findings (for correction reference)`);
    for (const agent of agentResults) {
      for (const finding of agent.findings) {
        parts.push(
          `- [${agent.agentName}] [${finding.sourceTier}/${finding.confidence}] ${finding.statement}`,
        );
      }
    }
  }

  // For DEEPEN, include findings from the most relevant agent
  if (nudgeType === "DEEPEN") {
    const relevantAgent = findMostRelevantAgent(agentResults, nudge);
    if (relevantAgent) {
      parts.push(`\n## Detailed Findings from ${relevantAgent.agentName}`);
      for (const finding of relevantAgent.findings) {
        parts.push(
          `- [${finding.sourceTier}/${finding.confidence}] ${finding.statement}\n  Evidence: ${finding.evidence}`,
        );
      }
      if (relevantAgent.gaps.length > 0) {
        parts.push(`Gaps identified: ${relevantAgent.gaps.join("; ")}`);
      }
    }
  }

  return parts.join("\n");
}

/**
 * Find the agent whose dimension/findings best match the nudge text.
 */
function findMostRelevantAgent(
  agentResults: AgentResult[],
  nudge: string,
): AgentResult | undefined {
  const nudgeWords = new Set(
    nudge.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
  );

  let bestAgent: AgentResult | undefined;
  let bestScore = 0;

  for (const agent of agentResults) {
    const agentText = [
      agent.dimension,
      agent.archetype,
      ...agent.findings.map((f) => f.statement),
    ]
      .join(" ")
      .toLowerCase();

    const words = agentText.split(/\s+/).filter((w) => w.length > 3);
    let score = 0;
    for (const word of words) {
      if (nudgeWords.has(word)) score++;
    }

    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return bestAgent;
}

// ─── Nudge Agent Deployment ─────────────────────────────────

/**
 * Build the system prompt for a nudge agent.
 */
function buildNudgeAgentPrompt(
  nudgeType: NudgeType,
  nudge: string,
  context: string,
  agentIndex: number,
  agentCount: number,
): { system: string; user: string } {
  const typeDescriptions: Record<NudgeType, string> = {
    CORRECT:
      "You are a CORRECTION agent. Your mandate is to identify and fix inaccuracies " +
      "in the original analysis. Search for the correct information and clearly state " +
      "what was wrong and what the corrected finding should be.",
    DEEPEN:
      "You are a DEEPENING agent. Your mandate is to provide substantially deeper " +
      "analysis on the specified dimension. Go beyond what was already covered — find " +
      "new evidence, additional data points, and more nuanced implications.",
    EXTEND:
      "You are an EXTENSION agent. Your mandate is to explore a new analytical " +
      "dimension not covered in the original analysis. Treat this as a fresh " +
      "investigation with full evidence gathering.",
    MODEL:
      "You are a MODELING agent. Your mandate is to build quantitative projections, " +
      "scenario analyses, or financial models based on the available data. Clearly " +
      "state assumptions, methodologies, and confidence ranges.",
    TARGET:
      "You are a TARGETING agent. Your mandate is to identify specific, actionable " +
      "opportunities for the entity in question. Each target should include a rationale, " +
      "estimated impact, and feasibility assessment.",
  };

  const system = `${typeDescriptions[nudgeType]}

You are agent ${agentIndex + 1} of ${agentCount} deployed for this refinement.

## Source Classification Requirements
Every finding MUST include:
- sourceTier: PRIMARY (direct source), SECONDARY (analysis of primary), or TERTIARY (aggregated/opinion)
- confidence: HIGH, MEDIUM, or LOW
- evidenceType: direct, inferred, analogical, or modeled
- source: Specific citation or data source

## Output Format
When you have completed your analysis, call the submit_findings tool with your results.`;

  const user = `## User Nudge
"${nudge}"

## Original Analysis Context
${context}

## Your Task
Based on the nudge and original context above, conduct a focused ${nudgeType} analysis.
Find new information, verify claims, or build projections as appropriate for your mandate.
Submit your findings using the submit_findings tool.`;

  return { system, user };
}

/**
 * JSON Schema for the submit_findings tool (matches AgentResultSchema).
 */
function getSubmitFindingsSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["agentName", "archetype", "dimension", "findings", "gaps", "signals", "minorityViews", "toolsUsed", "tokensUsed"],
    properties: {
      agentName: { type: "string", description: "Name of this nudge agent" },
      archetype: { type: "string", description: "Agent archetype family" },
      dimension: { type: "string", description: "Analytical dimension" },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["statement", "evidence", "confidence", "sourceTier", "evidenceType", "source", "implication", "tags"],
          properties: {
            statement: { type: "string" },
            evidence: { type: "string" },
            confidence: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
            sourceTier: { type: "string", enum: ["PRIMARY", "SECONDARY", "TERTIARY"] },
            evidenceType: { type: "string", enum: ["direct", "inferred", "analogical", "modeled"] },
            source: { type: "string" },
            implication: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
      gaps: { type: "array", items: { type: "string" } },
      signals: { type: "array", items: { type: "string" } },
      minorityViews: { type: "array", items: { type: "string" } },
      toolsUsed: { type: "array", items: { type: "string" } },
      tokensUsed: { type: "number" },
    },
  };
}

/**
 * Deploy a single nudge agent and return its results.
 */
async function deployNudgeAgent(
  nudgeType: NudgeType,
  nudge: string,
  context: string,
  agentIndex: number,
  agentCount: number,
  emitEvent: (event: PipelineEvent) => void,
): Promise<AgentResult | null> {
  const { system, user } = buildNudgeAgentPrompt(
    nudgeType,
    nudge,
    context,
    agentIndex,
    agentCount,
  );

  const agentName = `Nudge-${nudgeType}-${agentIndex + 1}`;

  emitEvent({
    type: "agent_spawned",
    agentName,
    archetype: `NUDGE-${nudgeType}`,
    dimension: nudgeType.toLowerCase(),
  });

  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: MODELS.DEPLOY, // Sonnet for focused agents
      max_tokens: 4096,
      system: [cachedSystemPrompt(system)],
      tools: [
        {
          name: "submit_findings",
          description: "Submit your analysis findings for this nudge refinement.",
          input_schema: getSubmitFindingsSchema() as Anthropic.Messages.Tool.InputSchema,
        },
      ],
      tool_choice: { type: "tool" as const, name: "submit_findings" },
      messages: [{ role: "user", content: user }],
    });

    // Extract tool use block
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === "tool_use",
    );

    if (!toolUseBlock) {
      console.warn(`[REFINE] Agent ${agentName} did not call submit_findings.`);
      return null;
    }

    // Validate output — default missing arrays to prevent Zod failures
    const rawResult = toolUseBlock.input as Record<string, unknown>;
    if (!Array.isArray(rawResult.findings)) rawResult.findings = [];
    if (!Array.isArray(rawResult.gaps)) rawResult.gaps = [];
    if (!Array.isArray(rawResult.signals)) rawResult.signals = [];
    if (!Array.isArray(rawResult.minorityViews)) rawResult.minorityViews = [];
    if (!Array.isArray(rawResult.toolsUsed)) rawResult.toolsUsed = [];
    const result = AgentResultSchema.parse({
      ...rawResult,
      agentName,
      archetype: `NUDGE-${nudgeType}`,
      tokensUsed: response.usage?.output_tokens ?? 0,
    });

    emitEvent({
      type: "agent_complete",
      agentName,
      findingCount: result.findings.length,
      tokensUsed: result.tokensUsed,
    });

    return result;
  } catch (error) {
    console.error(`[REFINE] Agent ${agentName} failed:`, error);
    return null;
  }
}

// ─── Agent Count per Nudge Type ─────────────────────────────

function getAgentCount(nudgeType: NudgeType): number {
  switch (nudgeType) {
    case "CORRECT":
      return 1; // Single focused correction agent
    case "DEEPEN":
      return 2; // Two agents for depth: one broadens, one goes vertical
    case "EXTEND":
      return 3; // Three agents for a new dimension (full mini-swarm)
    case "MODEL":
      return 2; // Quantitative + scenario agents
    case "TARGET":
      return 2; // Opportunity scanner + feasibility assessor
  }
}

// ─── Synthesis Merging ──────────────────────────────────────

/**
 * Merge new agent findings into the original synthesis.
 * For CORRECT nudges, flag which findings in the original need updating.
 */
function mergeSynthesis(
  originalSynthesis: SynthesisResult,
  newResults: AgentResult[],
  nudgeType: NudgeType,
): SynthesisResult {
  // Start with a copy of the original
  const merged: SynthesisResult = {
    layers: originalSynthesis.layers.map((l) => ({
      ...l,
      insights: [...l.insights],
    })),
    emergentInsights: [...originalSynthesis.emergentInsights],
    tensionPoints: [...originalSynthesis.tensionPoints],
    overallConfidence: originalSynthesis.overallConfidence,
    criticRevisions: [...originalSynthesis.criticRevisions],
  };

  // Collect all new findings
  const newFindings = newResults.flatMap((r) => r.findings);

  if (newFindings.length === 0) {
    return merged;
  }

  if (nudgeType === "CORRECT") {
    // For corrections, add revised findings to the foundation layer
    // and note the correction in critic revisions
    const corrections = newFindings.map(
      (f) => `[CORRECTION] ${f.statement}`,
    );
    const foundationLayer = merged.layers.find((l) => l.name === "foundation");
    if (foundationLayer) {
      foundationLayer.insights.push(...corrections);
    }
    merged.criticRevisions.push(
      `Nudge correction applied: ${newFindings.length} finding(s) revised`,
    );
  } else if (nudgeType === "EXTEND") {
    // For extensions, add a new set of insights to the foundation layer
    const extensionInsights = newFindings.map((f) => f.statement);
    const foundationLayer = merged.layers.find((l) => l.name === "foundation");
    if (foundationLayer) {
      foundationLayer.insights.push(...extensionInsights);
    }

    // Also add implications to the convergence layer
    const convergenceLayer = merged.layers.find((l) => l.name === "convergence");
    if (convergenceLayer) {
      const implications = newFindings
        .filter((f) => f.implication)
        .map((f) => f.implication);
      convergenceLayer.insights.push(...implications);
    }
  } else {
    // DEEPEN, MODEL, TARGET: add to convergence layer
    const convergenceLayer = merged.layers.find((l) => l.name === "convergence");
    if (convergenceLayer) {
      convergenceLayer.insights.push(
        ...newFindings.map((f) => f.statement),
      );
    }

    // Add implications to emergence layer if they represent new patterns
    const emergenceLayer = merged.layers.find((l) => l.name === "emergence");
    if (emergenceLayer && nudgeType === "MODEL") {
      const projections = newFindings
        .filter((f) => f.evidenceType === "modeled")
        .map((f) => `[Projection] ${f.statement}: ${f.implication}`);
      emergenceLayer.insights.push(...projections);
    }
  }

  // Add gaps and signals from new results
  const gapLayer = merged.layers.find((l) => l.name === "gap");
  if (gapLayer) {
    const newGaps = newResults.flatMap((r) => r.gaps);
    if (newGaps.length > 0) {
      gapLayer.insights.push(...newGaps);
    }
  }

  return merged;
}

// ─── Main Entry Point ───────────────────────────────────────

/**
 * Phase 5: Refine the analysis based on a user nudge.
 *
 * Classifies the nudge, deploys focused agents, and merges the new
 * findings into the original synthesis.
 */
export async function refine(input: RefineInput): Promise<RefineOutput> {
  const { nudge, originalManifest, emitEvent } = input;

  // --- 1. Classify the nudge ---
  emitEvent({
    type: "phase_change",
    phase: "REFINE",
    message: `Classifying nudge: "${nudge.slice(0, 80)}${nudge.length > 80 ? "..." : ""}"`,
  });

  const nudgeType = await classifyNudge(nudge);

  emitEvent({
    type: "phase_change",
    phase: "REFINE",
    message: `Nudge classified as ${nudgeType}. Deploying focused agents.`,
  });

  // --- 2. Inherit context from original manifest ---
  const context = inheritContext(originalManifest, nudgeType, nudge);

  // --- 3. Deploy focused agents ---
  const agentCount = getAgentCount(nudgeType);
  const agentPromises: Promise<AgentResult | null>[] = [];

  for (let i = 0; i < agentCount; i++) {
    agentPromises.push(
      deployNudgeAgent(nudgeType, nudge, context, i, agentCount, emitEvent),
    );
  }

  const results = await Promise.allSettled(agentPromises);
  const newAgentResults: AgentResult[] = results
    .filter(
      (r): r is PromiseFulfilledResult<AgentResult | null> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value!);

  if (newAgentResults.length === 0) {
    console.warn("[REFINE] All nudge agents failed. Returning original synthesis.");
    return {
      nudgeType,
      newAgentResults: [],
      updatedSynthesis: originalManifest.synthesis,
    };
  }

  // --- 4. Merge new findings into original synthesis ---
  const updatedSynthesis = mergeSynthesis(
    originalManifest.synthesis,
    newAgentResults,
    nudgeType,
  );

  emitEvent({
    type: "phase_change",
    phase: "REFINE",
    message: `Refinement complete. ${newAgentResults.length} agent(s) returned ${newAgentResults.reduce((s, r) => s + r.findings.length, 0)} new findings.`,
  });

  // --- 5. Return (presentation can be triggered separately) ---
  return {
    nudgeType,
    newAgentResults,
    updatedSynthesis,
    // presentation is intentionally undefined — caller triggers present() if needed
  };
}
