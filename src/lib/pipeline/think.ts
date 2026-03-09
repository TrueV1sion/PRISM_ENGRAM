/**
 * PRISM Pipeline -- Phase 0: THINK
 *
 * Dimensional Decomposition Engine.
 *
 * Takes a strategic query and produces a Blueprint: dimensions, agents,
 * complexity scores, interconnection map, and estimated runtime.
 *
 * Quality controls:
 * - Every dimension must pass 4 qualification gates (distinct data sources,
 *   distinct lens, sufficient depth, standalone value)
 * - The model must JUSTIFY each dimension's inclusion
 * - Known interconnection pairs are validated against the model's output
 * - Ethical concerns trigger the Neutral Framing Protocol flag
 *
 * Uses Anthropic SDK directly with extended thinking and tool-use
 * structured output (submit_blueprint tool).
 */

import { z } from "zod";
import {
  getAnthropicClient,
  MODELS,
  EXTENDED_THINKING,
  cachedSystemPrompt,
} from "@/lib/ai/client";
import { BlueprintSchema, type Blueprint, type PipelineEvent } from "./types";

// ─── Methodology-Core Sections 1-2 (System Prompt) ──────────

const METHODOLOGY_SECTIONS_1_2 = `## 1. Dimensional Analysis Framework

Every strategic question has inherent dimensionality: the number of independent analytical
axes required to answer it fully. PRISM's first job is to surface those dimensions.

### Dimension Qualification Criteria

A dimension qualifies for a dedicated agent when it:
- Requires **distinct data sources** from other dimensions
- Benefits from a **distinct analytical lens**
- Has **sufficient depth** to justify an independent workstream
- Would **produce standalone value** even if other agents failed

### Dimension Signal Heuristics

| Signal in Query | Likely Dimension | Agent Type |
|----------------|-----------------|------------|
| Named entity (company, law, drug) | Entity-specific research | RESEARCHER-DOMAIN |
| Temporal reference ("2026", "next year") | Temporal projection | FUTURIST or LEGISLATIVE-PIPELINE |
| Comparative language ("vs", "compared to") | Competitive analysis | ANALYST-STRATEGIC |
| Impact language ("affect", "change") | Impact cascade (1st/2nd/3rd order) | ANALYST + domain specialist |
| Stakeholder reference ("patients", "payers") | Per-stakeholder perspective | CUSTOMER_PROXY variant per stakeholder |
| Financial language ("revenue", "cost", "MLR") | Financial analysis | ANALYST-FINANCIAL |
| Regulatory reference ("CMS", "rule") | Regulatory dimension | REGULATORY-RADAR |
| Technology reference ("AI", "platform") | Technology assessment | ANALYST-TECHNICAL |
| Geographic scope ("national", "state") | Geographic dimension | RESEARCHER-DOMAIN (geo-scoped) |
| Quality metrics ("Stars", "HEDIS", "CAHPS") | Quality analytics | ANALYST + quality skills |
| M&A language ("acquire", "merge", "PE") | Transaction analysis | ANALYST-FINANCIAL + M&A skills |
| Drug/clinical reference ("GLP-1", "formulary") | Clinical/pharma dimension | RESEARCHER-DATA + PubMed tools |

### Interconnection Assessment

Dimensions don't exist in isolation. Rate interconnection on 1-5:

| Score | Meaning | Synthesis Implication |
|-------|---------|----------------------|
| 1 | Independent -- can analyze separately | Agents work in full isolation |
| 2 | Loosely coupled -- some shared context | Share context brief, synthesize at end |
| 3 | Moderately coupled -- findings affect each other | Mid-point check-ins, iterative synthesis |
| 4 | Tightly coupled -- feedback loops between dimensions | Cluster tightly-coupled agents together |
| 5 | Deeply entangled -- everything affects everything | Sequential phases or very tight synthesis |

**Known Interconnection Pairs (Healthcare Domain):**

| Dimension A | Dimension B | Coupling | Mechanism |
|-------------|-------------|----------|-----------|
| Financial | Quality/Stars | 4 | Quality bonus payments = 5%+ revenue |
| Regulatory | Technology | 3 | Compliance mandates drive tech adoption |
| Legislative | Payer strategy | 4 | Laws reshape payer economics directly |
| Competitive | M&A | 4 | M&A changes competitive landscape |
| Drug pricing | Financial | 5 | Drug costs are largest medical expense driver |
| Workforce | Provider | 4 | Staffing determines care delivery capacity |
| Patient experience | Quality | 3 | CAHPS scores = Star Rating component |
| Technology | Competitive | 3 | Tech capabilities differentiate offerings |
| Regulatory | Financial | 4 | Rate notices set revenue ceiling |
| Macro-economic | All | 2-3 | Indirect but pervasive effects |

## 2. Complexity Scoring

### Formula

COMPLEXITY = Breadth + Depth + Interconnection (range: 3-15)

Adjusted by Urgency:
  Speed priority    x 0.7   (minimize agent count, maximize breadth over depth)
  Balanced          x 1.0   (standard depth per dimension)
  Thorough          x 1.3   (maximize depth, accept longer runtime)

ADJUSTED COMPLEXITY -> SWARM TIER

### Scoring Rubrics

**Breadth (1-5):** How many distinct domains does this span?
- 1: Single domain ("What's Humana's MLR?")
- 2: Two related domains ("How does MLR affect Star Ratings?")
- 3: Three domains ("MLR, Stars, and competitive position")
- 4: Multi-domain ("Full payer financial and strategic analysis")
- 5: Cross-sector ("SOTU impact across all healthcare segments")

**Depth (1-5):** How deep does each dimension need to go?
- 1: Surface -- lookup, quick answer
- 2: Standard -- analysis with evidence
- 3: Deep -- multi-source research with synthesis
- 4: Expert -- primary source analysis, modeling, forecasting
- 5: Exhaustive -- leave no stone unturned

**Interconnection (1-5):** How much do dimensions interact?
- 1: Independent -- analyze each separately
- 2: Loosely coupled -- some shared context
- 3: Moderately coupled -- findings in one affect others
- 4: Tightly coupled -- complex feedback loops
- 5: Deeply entangled -- everything affects everything

### Tier Mapping

| Adjusted Score | Tier | Agent Range | Synthesis Strategy |
|---------------|------|-------------|-------------------|
| 2.1 - 5.0 | MICRO | 2-3 | Direct synthesis |
| 5.1 - 8.0 | STANDARD | 4-6 | Validated synthesis (synth + critic) |
| 8.1 - 11.0 | EXTENDED | 7-10 | Grouped synthesis (clusters + meta) |
| 11.1 - 15.0 | MEGA | 11-15 | Hierarchical sub-swarms |
| 15.1+ | CAMPAIGN | 15+ | Multi-phase sequential |`;


// ─── System Prompt ──────────────────────────────────────────

const THINK_SYSTEM_PROMPT = `You are the PRISM Dimensional Analysis Engine. Your job is to decompose a strategic question into independent analytical dimensions, each warranting a dedicated AI research agent.

## Your Expertise
You are an expert in healthcare strategy, health economics, regulatory affairs, clinical research, quality measurement (Stars/HEDIS/CAHPS), managed care operations, pharma/medtech markets, and competitive intelligence. You analyze queries with the rigor of a McKinsey engagement team.

${METHODOLOGY_SECTIONS_1_2}

## Archetype Selection
For each dimension, assign the best-fit agent archetype:

**RESEARCHER** (deep information gathering)
- Lens: "What evidence exists? What do we actually know vs. assume?"
- Bias: SKEPTICISM -- challenge conventional wisdom
- Variants: WEB, DATA, DOMAIN, LATERAL

**ANALYST** (pattern recognition, quantitative reasoning)
- Lens: "What patterns exist? What frameworks explain this?"
- Bias: SYSTEMS THINKING -- look for feedback loops and leverage points
- Variants: FINANCIAL, STRATEGIC, TECHNICAL, RISK, QUALITY

**REGULATORY-RADAR** -- Translating regulations into market intelligence
**LEGISLATIVE-PIPELINE** -- Tracking pending legislation
**FUTURIST** -- Trend extrapolation and scenario planning
**MACRO-CONTEXT** -- Cross-domain forces reshaping healthcare

## MCP Tools Available
Assign relevant tools to each agent:
- PubMed Search, Clinical Trials -- clinical evidence
- Medicare Coverage, CMS Data -- payer data
- Federal Register -- regulatory filings
- SEC EDGAR -- financial disclosures
- NPI Registry -- provider data
- HEDIS Data, CMS Star Ratings -- quality metrics
- Web Search -- general research

## Ethical Sensitivity Detection
Flag topics that may require the Neutral Framing Protocol:
- Patient harm, denial economics, access barriers
- Advocacy or adversarial mandates
- Ethically-charged policy debates (prior auth harm, coverage denials)
List any such concerns in the ethicalConcerns field.

## Critical Instructions
1. Justify EVERY dimension -- explain WHY it qualifies
2. Do NOT pad with weak dimensions just to increase agent count
3. Each agent's mandate must be specific enough to produce actionable findings
4. Err on the side of fewer, stronger dimensions over many weak ones
5. Think about what dimensions would produce EMERGENT insights when combined
6. The complexity reasoning must explain your scoring, not just state numbers
7. You MUST call the submit_blueprint tool with your complete analysis`;


// ─── Blueprint JSON Schema for Tool Input ───────────────────

/**
 * Convert BlueprintSchema to a JSON Schema object for the submit_blueprint tool.
 * Uses Zod v4's built-in toJSONSchema().
 */
function getBlueprintJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(BlueprintSchema) as Record<string, unknown>;
  // Remove $schema key -- Anthropic tool input_schema just needs the object schema
  delete schema["$schema"];
  return schema;
}


// ─── Main Function ──────────────────────────────────────────

/**
 * Phase 0: THINK -- Decompose a query into a dimensional blueprint.
 *
 * Uses Claude Opus with extended thinking to analyze the query and produce:
 * - Qualified dimensions with justification
 * - Agent roster with archetypes and tools
 * - Interconnection map
 * - Complexity scoring with reasoning
 * - Tier classification
 */
export async function think(input: {
  query: string;
  urgency?: string;
  onEvent?: (event: PipelineEvent) => void;
}): Promise<Blueprint> {
  const { query, urgency = "balanced", onEvent } = input;

  // Urgency multiplier per methodology-core.md
  const urgencyMultiplier =
    urgency === "speed" ? 0.7 : urgency === "thorough" ? 1.3 : 1.0;

  const userPrompt = `Analyze this strategic query and produce a complete dimensional blueprint:

"${query}"

Urgency: ${urgency} (multiplier: ${urgencyMultiplier})

Decompose this into independent analytical dimensions. For each dimension:
1. Justify WHY it qualifies (distinct data sources, lens, depth, standalone value)
2. Assign the best-fit agent archetype with a specific research mandate
3. List the MCP tools that agent should use

Then score the complexity and map the tier.

Remember: fewer strong dimensions > many weak ones. Every dimension must produce standalone value.

Call the submit_blueprint tool with your complete analysis.`;

  const client = getAnthropicClient();

  const stream = client.messages.stream({
    model: MODELS.THINK,
    max_tokens: 16000,
    thinking: EXTENDED_THINKING,
    system: [cachedSystemPrompt(THINK_SYSTEM_PROMPT)],
    tools: [
      {
        name: "submit_blueprint",
        description:
          "Submit the completed dimensional analysis blueprint. You MUST call this tool with the full blueprint object.",
        input_schema: getBlueprintJsonSchema() as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "auto" as const },
    messages: [{ role: "user", content: userPrompt }],
  });

  stream.on("streamEvent", (event) => {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "thinking_delta"
    ) {
      onEvent?.({ type: "thinking_token", token: event.delta.thinking });
    } else if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onEvent?.({ type: "thinking_token", token: event.delta.text });
    }
  });

  const response = await stream.finalMessage();

  // ─── Extract blueprint from tool_use response ──────────────

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === "tool_use",
  );

  if (!toolUseBlock) {
    throw new Error(
      "THINK phase failed: model did not call submit_blueprint tool. " +
      `Stop reason: ${response.stop_reason}`,
    );
  }

  const rawBlueprint = toolUseBlock.input as Record<string, unknown>;

  // ─── Validate with Zod ─────────────────────────────────────

  const blueprint = BlueprintSchema.parse(rawBlueprint);

  // ─── Post-generation quality checks ────────────────────────

  // Apply urgency multiplier to get adjusted score
  const rawTotal =
    blueprint.complexityScore.breadth +
    blueprint.complexityScore.depth +
    blueprint.complexityScore.interconnection;
  const adjustedTotal = Math.round(rawTotal * urgencyMultiplier * 10) / 10;

  // Recalculate tier based on adjusted score
  const correctedTier = getTier(adjustedTotal);
  if (correctedTier !== blueprint.tier) {
    blueprint.tier = correctedTier;
  }

  // Update complexity with urgency-adjusted values
  blueprint.complexityScore.total = rawTotal;
  blueprint.complexityScore.urgency = urgencyMultiplier;
  blueprint.complexityScore.adjusted = adjustedTotal;

  // Check: Agent count matches tier range
  const [minAgents, maxAgents] = TIER_AGENT_RANGE[blueprint.tier];
  if (
    blueprint.agents.length < minAgents ||
    blueprint.agents.length > maxAgents
  ) {
    // Log but don't throw -- the model's decomposition may have good reasons
    console.warn(
      `[THINK] Agent count (${blueprint.agents.length}) outside tier ${blueprint.tier} range [${minAgents}-${maxAgents}]`,
    );
  }

  // Check: Each agent has at least one tool
  for (const agent of blueprint.agents) {
    if (agent.tools.length === 0) {
      agent.tools = ["Web Search"]; // Fallback
    }
  }

  // Check: Dimensions match agents 1:1
  const dimensionNames = new Set(blueprint.dimensions.map((d) => d.name));
  for (const agent of blueprint.agents) {
    if (!dimensionNames.has(agent.dimension)) {
      console.warn(
        `[THINK] Agent "${agent.name}" references dimension "${agent.dimension}" which doesn't exist in the blueprint.`,
      );
    }
  }

  // Check: Known interconnection pairs
  const dimNamesLower = blueprint.dimensions.map((d) => d.name.toLowerCase());
  const existingPairs = new Set(
    blueprint.interconnections.map(
      (i) =>
        `${i.dimensionA.toLowerCase()}|${i.dimensionB.toLowerCase()}`,
    ),
  );
  for (const known of KNOWN_INTERCONNECTIONS) {
    const hasA = dimNamesLower.some((n) => n.includes(known.keywordA));
    const hasB = dimNamesLower.some((n) => n.includes(known.keywordB));
    if (hasA && hasB) {
      const alreadyMapped =
        existingPairs.has(`${known.keywordA}|${known.keywordB}`) ||
        existingPairs.has(`${known.keywordB}|${known.keywordA}`);
      if (!alreadyMapped) {
        console.warn(
          `[THINK] Known interconnection missed: ${known.label} (coupling=${known.coupling})`,
        );
      }
    }
  }

  // Stamp the original query
  blueprint.query = query;

  return blueprint;
}


// ─── Helpers ────────────────────────────────────────────────

const TIER_AGENT_RANGE: Record<string, [number, number]> = {
  MICRO: [2, 3],
  STANDARD: [4, 6],
  EXTENDED: [7, 10],
  MEGA: [11, 15],
  CAMPAIGN: [15, 20],
};

function getTier(adjustedScore: number): Blueprint["tier"] {
  if (adjustedScore <= 5) return "MICRO";
  if (adjustedScore <= 8) return "STANDARD";
  if (adjustedScore <= 11) return "EXTENDED";
  if (adjustedScore <= 15) return "MEGA";
  return "CAMPAIGN";
}

/** Known interconnection pairs from methodology-core.md */
const KNOWN_INTERCONNECTIONS = [
  {
    keywordA: "financial",
    keywordB: "quality",
    coupling: 4,
    label: "Financial <-> Quality/Stars",
  },
  {
    keywordA: "financial",
    keywordB: "star",
    coupling: 4,
    label: "Financial <-> Star Ratings",
  },
  {
    keywordA: "regulatory",
    keywordB: "technology",
    coupling: 3,
    label: "Regulatory <-> Technology",
  },
  {
    keywordA: "legislative",
    keywordB: "payer",
    coupling: 4,
    label: "Legislative <-> Payer",
  },
  {
    keywordA: "competitive",
    keywordB: "m&a",
    coupling: 4,
    label: "Competitive <-> M&A",
  },
  {
    keywordA: "drug",
    keywordB: "financial",
    coupling: 5,
    label: "Drug Pricing <-> Financial",
  },
  {
    keywordA: "clinical",
    keywordB: "financial",
    coupling: 5,
    label: "Clinical <-> Financial",
  },
  {
    keywordA: "workforce",
    keywordB: "provider",
    coupling: 4,
    label: "Workforce <-> Provider",
  },
  {
    keywordA: "patient",
    keywordB: "quality",
    coupling: 3,
    label: "Patient Experience <-> Quality",
  },
  {
    keywordA: "technology",
    keywordB: "competitive",
    coupling: 3,
    label: "Technology <-> Competitive",
  },
  {
    keywordA: "regulatory",
    keywordB: "financial",
    coupling: 4,
    label: "Regulatory <-> Financial",
  },
];

// Type import for Anthropic namespace (used in type assertions)
import type Anthropic from "@anthropic-ai/sdk";
