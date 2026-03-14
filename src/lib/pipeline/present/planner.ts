/**
 * Slide Planner
 *
 * Decomposes synthesis data into a SlideManifest via an LLM call.
 * Responsibilities:
 * - Build a structured planner prompt from synthesis + agent results
 * - Call Sonnet to generate a JSON SlideManifest
 * - Validate the response with SlideManifestSchema (Zod)
 * - Retry once on JSON parse / schema validation failures
 */

import { getAnthropicClient } from "@/lib/ai/client";
import { ComponentCatalog } from "./component-catalog";
import { SlideManifestSchema } from "./types";
import type { SlideManifest, PresentInput } from "./types";
import type { SynthesisResult, AgentResult, Blueprint } from "@/lib/pipeline/types";

// Use the specific model version requested for the planner
const PLANNER_MODEL = "claude-sonnet-4-20250514";

// ─── Prompt Builders ──────────────────────────────────────────────────────────

/**
 * Build the agent roster section: name, archetype, dimension, finding count.
 */
function buildAgentRoster(agentResults: AgentResult[], blueprint: Blueprint): string {
  return agentResults
    .map((ar) => {
      const bpAgent = blueprint.agents.find(
        (a) => a.name === ar.agentName || a.dimension === ar.dimension,
      );
      const lens = bpAgent ? ` | Lens: ${bpAgent.lens}` : "";
      return `- ${ar.agentName} (${ar.archetype}) — Dimension: ${ar.dimension}${lens} | Findings: ${ar.findings.length}`;
    })
    .join("\n");
}

/**
 * Format synthesis layers: name + description + key insights.
 */
function buildSynthesisLayers(synthesis: SynthesisResult): string {
  return synthesis.layers
    .map(
      (layer) =>
        `### ${layer.name.toUpperCase()} Layer\n${layer.description}\n` +
        layer.insights.slice(0, 3).map((ins) => `- ${ins}`).join("\n"),
    )
    .join("\n\n");
}

/**
 * Format emergent insights (or indicate none).
 */
function buildEmergentInsights(synthesis: SynthesisResult): string {
  if (synthesis.emergentInsights.length === 0) {
    return "No emergent insights detected — do NOT include an 'emergence' slide.";
  }

  return synthesis.emergentInsights
    .map(
      (ei, i) =>
        `${i + 1}. **${ei.insight}**\n` +
        `   Algorithm: ${ei.algorithm}\n` +
        `   Supporting agents: ${ei.supportingAgents.join(", ")}\n` +
        `   Why only multi-agent finds this: ${ei.whyMultiAgent}`,
    )
    .join("\n\n");
}

/**
 * Format tension points (or indicate none).
 */
function buildTensionPoints(synthesis: SynthesisResult): string {
  if (synthesis.tensionPoints.length === 0) {
    return "No significant tension points — do NOT include a 'tension' slide.";
  }

  return synthesis.tensionPoints
    .map(
      (tp) =>
        `**${tp.tension}** (${tp.conflictType})\n` +
        `  Side A: ${tp.sideA.position} — agents: ${tp.sideA.agents.join(", ")}\n` +
        `  Side B: ${tp.sideB.position} — agents: ${tp.sideB.agents.join(", ")}\n` +
        `  Resolution: ${tp.resolution}`,
    )
    .join("\n\n");
}

/**
 * Derive appropriate slide count guidance from blueprint tier.
 */
function getSlideCountGuidance(blueprint: Blueprint): string {
  const ranges: Record<string, string> = {
    MICRO: "8-10",
    STANDARD: "10-13",
    EXTENDED: "13-16",
    MEGA: "16-20",
    CAMPAIGN: "16-20",
  };
  const range = ranges[blueprint.tier] ?? "10-13";
  return `${range} slides for ${blueprint.tier} tier with ${blueprint.agents.length} agents`;
}

/**
 * Build the full planner user prompt from synthesis + agent results + blueprint.
 */
export function buildPlannerUserPrompt(
  synthesis: SynthesisResult,
  agentResults: AgentResult[],
  blueprint: Blueprint,
): string {
  const agentRoster = buildAgentRoster(agentResults, blueprint);
  const synthesisLayers = buildSynthesisLayers(synthesis);
  const emergentInsights = buildEmergentInsights(synthesis);
  const tensionPoints = buildTensionPoints(synthesis);
  const slideCountGuidance = getSlideCountGuidance(blueprint);

  const totalFindings = agentResults.reduce((sum, ar) => sum + ar.findings.length, 0);

  return `# Slide Planner Request

## Query
${blueprint.query}

## Swarm Configuration
- Tier: ${blueprint.tier}
- Agent count: ${blueprint.agents.length}
- Total findings: ${totalFindings}
- Overall confidence: ${synthesis.overallConfidence}

## Target Slide Count
${slideCountGuidance}

## Agent Roster
${agentRoster}

## Synthesis Layers
${synthesisLayers}

## Emergent Insights
${emergentInsights}

## Tension Points
${tensionPoints}

## Slide Type Assignment Rules

Use these slide types from the allowed enum:
- "title" — Opening hero slide (always include exactly 1)
- "executive-summary" — Key takeaways (always include exactly 1)
- "dimension-deep-dive" — One per agent/dimension; for rich qualitative analysis; use componentHints: ["finding-card","quote-block","tag"]
- "data-metrics" — For agents with numeric/quantitative findings; use componentHints: ["stat-block","bar-chart","donut-chart","comparison-bars"]
- "emergence" — ONLY if emergent insights exist (use at most 1); componentHints: ["emergence-card","emergent-why"]
- "tension" — ONLY if tension points exist (use at most 1); componentHints: ["grid-2","finding-card"]
- "findings-toc" — Table of contents (include if ${blueprint.agents.length} >= 5)
- "closing" — Final call-to-action slide (always include exactly 1)

## Animation Type Assignment Rules
- "anim" — Default fade-up for most slides
- "anim-scale" — Use for title and closing slides
- "anim-blur" — Use for emergence slides

## Component Hints Rules
- dimension-deep-dive slides → ["finding-card", "confidence-badge", "tag", "quote-block"]
- data-metrics slides → ["stat-block", "stat-number", "bar-chart", "comparison-bars"]
- emergence slides → ["emergence-card", "emergent-why", "emergent-number"]
- tension slides → ["grid-2", "finding-card", "threat-meter"]
- executive-summary slides → ["finding-card", "card-blue", "card-green", "confidence-badge"]
- title slides → ["hero-title", "hero-stats", "agent-chip", "hero-badge"]
- closing slides → ["hero-title", "hero-sub", "tag-cyan"]

## agentSources Field
For each dimension/data-metrics slide, set agentSources to the list of agent names that inform that slide.
For cross-cutting slides (title, summary, closing), set agentSources to all agent names.

## dataPoints Field
Extract 1-3 numeric data points per slide where meaningful. Each dataPoint needs:
- label: descriptive label
- value: a number (integer or float)
- unit: optional unit string (e.g. "%", "M", "B")
- prefix: optional prefix (e.g. "$")
- chartRole: one of "donut-segment", "bar-value", "sparkline-point", "counter-target", "bar-fill-percent", "line-point"

For qualitative slides with no clear metrics, dataPoints may be an empty array [].

## Output Format

Respond with ONLY a valid JSON object matching this schema:
{
  "title": "PRISM Intelligence Brief — <short query summary>",
  "subtitle": "<N>-agent <tier> analysis spanning <dimension names>",
  "totalSlides": <integer>,
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide Title",
      "type": "<slide type>",
      "purpose": "One-sentence purpose of this slide",
      "agentSources": ["Agent Name 1", "Agent Name 2"],
      "componentHints": ["class-name-1", "class-name-2"],
      "animationType": "anim",
      "dataPoints": [
        { "label": "Label", "value": 42, "unit": "%", "chartRole": "counter-target" }
      ]
    }
  ]
}

The slides array must contain exactly totalSlides entries with sequential slideNumber values starting at 1.
OUTPUT ONLY THE JSON OBJECT. No markdown fences, no explanation text.`;
}

// ─── Main Planner Function ────────────────────────────────────────────────────

/**
 * Plan the slide deck structure from synthesis data.
 *
 * Makes an LLM call to decompose the synthesis result into a SlideManifest —
 * a structured list of slide specs that downstream generators will render.
 * Retries once on JSON or schema validation failures.
 */
export async function planSlides(input: PresentInput): Promise<SlideManifest> {
  const { synthesis, agentResults, blueprint, emitEvent } = input;

  emitEvent?.({
    type: "phase_change",
    phase: "PRESENT_PLANNING",
    message: "Planning slide deck structure...",
  });

  const catalog = new ComponentCatalog();
  const client = getAnthropicClient();
  const systemPrompt = catalog.plannerSystemPrompt();
  const userPrompt = buildPlannerUserPrompt(synthesis, agentResults, blueprint);

  async function attemptPlan(systemOverride?: string, userSuffix?: string): Promise<SlideManifest> {
    const response = await client.messages.create({
      model: PLANNER_MODEL,
      max_tokens: 4000,
      system: systemOverride ?? systemPrompt,
      messages: [
        {
          role: "user",
          content: userSuffix ? userPrompt + userSuffix : userPrompt,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((block) => (block as any).text as string)
      .join("");

    // Strip markdown fences if present
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in planner response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      throw new Error(`Planner response is not valid JSON: ${(e as Error).message}`);
    }

    // Validate with Zod schema
    return SlideManifestSchema.parse(parsed);
  }

  try {
    return await attemptPlan();
  } catch (firstError) {
    const errMsg = (firstError as Error).message ?? "";
    const isJsonError = errMsg.includes("No JSON") || errMsg.includes("not valid JSON");
    const isZodError = (firstError as Error).name === "ZodError";

    if (isJsonError || isZodError) {
      console.warn("[PLANNER] First attempt failed, retrying with stricter instruction:", errMsg);

      try {
        return await attemptPlan(
          "You are a JSON generator. Output ONLY a valid JSON object matching the SlideManifest schema. No markdown, no explanation, no code fences.",
          "\n\nOUTPUT VALID JSON ONLY. The JSON must start with { and end with }.",
        );
      } catch (retryError) {
        throw new Error(
          `Slide planner failed after retry: ${(retryError as Error).message}`,
        );
      }
    }

    throw firstError;
  }
}
