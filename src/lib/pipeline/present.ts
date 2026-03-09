/**
 * PRISM Pipeline -- Phase 4: PRESENT
 *
 * HTML5 Presentation Generator.
 *
 * Takes synthesis results, agent findings, and a blueprint, then generates
 * a complete self-contained HTML5 presentation via Claude Sonnet. The
 * presentation-system.md spec (~1500 lines) is loaded as the system prompt,
 * giving Claude the full design token vocabulary, component library,
 * animation system, slide framework, editorial judgment rules, and
 * brand standards needed to produce reference-quality HTML.
 *
 * Uses Anthropic SDK directly with:
 * - Sonnet model (MODELS.PRESENT) for fast, high-quality HTML generation
 * - Prompt caching for the presentation system spec (avoids re-parsing
 *   on repeat runs)
 * - max_tokens: 16000 (presentations are 700-1200 lines of HTML)
 * - No tools — pure text generation
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicClient,
  MODELS,
  cachedSystemPrompt,
} from "@/lib/ai/client";
import type {
  SynthesisResult,
  AgentResult,
  Blueprint,
  PipelineEvent,
  PresentationResult,
} from "./types";

// ─── Types ──────────────────────────────────────────────────

export interface PresentInput {
  synthesis: SynthesisResult;
  agentResults: AgentResult[];
  blueprint: Blueprint;
  emitEvent: (event: PipelineEvent) => void;
}

// ─── Presentation System Spec Loader ────────────────────────

/**
 * Load the presentation-system.md spec.
 * Searches in order:
 * 1. PRISM_PRESENTATION_SPEC env var (absolute path)
 * 2. <cwd>/references/presentation-system.md
 * 3. Sibling directory: ../prism 2/references/presentation-system.md
 *
 * Cached after first load.
 */
let cachedSpec: string | null = null;

function loadPresentationSpec(): string {
  if (cachedSpec) return cachedSpec;

  const candidatePaths = [
    process.env.PRISM_PRESENTATION_SPEC,
    resolve(process.cwd(), "references", "presentation-system.md"),
    resolve(process.cwd(), "..", "prism 2", "references", "presentation-system.md"),
  ].filter(Boolean) as string[];

  for (const specPath of candidatePaths) {
    try {
      cachedSpec = readFileSync(specPath, "utf-8");
      return cachedSpec;
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    `[PRESENT] Cannot locate presentation-system.md. Searched: ${candidatePaths.join(", ")}. ` +
    `Set PRISM_PRESENTATION_SPEC env var to the absolute path.`
  );
}

// ─── Prompt Building ────────────────────────────────────────

/**
 * Determine the recommended slide count based on swarm tier.
 */
function getSlideGuidance(blueprint: Blueprint): string {
  const agentCount = blueprint.agents.length;
  const tier = blueprint.tier;

  const ranges: Record<string, string> = {
    MICRO: "10-12 slides",
    STANDARD: "13-15 slides",
    EXTENDED: "16-18 slides",
    MEGA: "18-22 slides",
    CAMPAIGN: "18-22 slides",
  };

  const slideRange = ranges[tier] ?? "13-15 slides";
  let guidance = `Target ${slideRange} for ${tier} tier with ${agentCount} agents.`;

  if (agentCount >= 6) {
    guidance +=
      " Use Extended Brief format with TOC slide and navigation panel grouping. " +
      "Group dimension slides by analytical theme in the nav panel.";
  }

  return guidance;
}

/**
 * Build a concise agent roster string for the prompt.
 */
function buildAgentRoster(
  agentResults: AgentResult[],
  blueprint: Blueprint,
): string {
  return agentResults
    .map((ar) => {
      // Find the corresponding blueprint agent for color/lens info
      const bpAgent = blueprint.agents.find(
        (a) => a.name === ar.agentName || a.dimension === ar.dimension,
      );
      return (
        `- ${ar.agentName} (${ar.archetype}) — Dimension: ${ar.dimension}` +
        (bpAgent ? ` | Lens: ${bpAgent.lens}` : "") +
        ` | Findings: ${ar.findings.length}`
      );
    })
    .join("\n");
}

/**
 * Summarize top findings per agent (3-5 per agent, not all).
 */
function summarizeAgentFindings(agentResults: AgentResult[]): string {
  return agentResults
    .map((ar) => {
      const topFindings = ar.findings
        .slice(0, 5)
        .map(
          (f, i) =>
            `  ${i + 1}. [${f.confidence} | ${f.sourceTier}] ${f.statement}` +
            `\n     Evidence: ${f.evidence.slice(0, 200)}${f.evidence.length > 200 ? "..." : ""}` +
            `\n     Implication: ${f.implication}`,
        )
        .join("\n");

      const gaps = ar.gaps.length > 0 ? `\n  Gaps: ${ar.gaps.join("; ")}` : "";
      const signals = ar.signals.length > 0 ? `\n  Signals: ${ar.signals.join("; ")}` : "";

      return `### ${ar.agentName} (${ar.archetype} — ${ar.dimension})\n${topFindings}${gaps}${signals}`;
    })
    .join("\n\n");
}

/**
 * Format synthesis layers for the prompt.
 */
function formatSynthesisLayers(synthesis: SynthesisResult): string {
  return synthesis.layers
    .map(
      (layer) =>
        `### ${layer.name.toUpperCase()} Layer\n${layer.description}\n` +
        layer.insights.map((ins) => `- ${ins}`).join("\n"),
    )
    .join("\n\n");
}

/**
 * Format emergent insights with whyMultiAgent explanations.
 */
function formatEmergentInsights(synthesis: SynthesisResult): string {
  if (synthesis.emergentInsights.length === 0) {
    return "No emergent insights detected — do NOT force emergence slides.";
  }

  return synthesis.emergentInsights
    .map(
      (ei, i) =>
        `${i + 1}. **${ei.insight}**\n` +
        `   Algorithm: ${ei.algorithm}\n` +
        `   Supporting agents: ${ei.supportingAgents.join(", ")}\n` +
        `   Evidence sources: ${ei.evidenceSources.join("; ")}\n` +
        `   Quality: novelty=${ei.qualityScores.novelty}, grounding=${ei.qualityScores.grounding}, ` +
        `actionability=${ei.qualityScores.actionability}, depth=${ei.qualityScores.depth}, surprise=${ei.qualityScores.surprise}\n` +
        `   **Why only multi-agent finds this:** ${ei.whyMultiAgent}`,
    )
    .join("\n\n");
}

/**
 * Format tension points with both sides.
 */
function formatTensionPoints(synthesis: SynthesisResult): string {
  if (synthesis.tensionPoints.length === 0) {
    return "No significant tension points identified.";
  }

  return synthesis.tensionPoints
    .map(
      (tp) =>
        `**${tp.tension}** (${tp.conflictType})\n` +
        `  Side A: ${tp.sideA.position}\n` +
        `    Agents: ${tp.sideA.agents.join(", ")}\n` +
        `    Evidence: ${tp.sideA.evidence.join("; ")}\n` +
        `  Side B: ${tp.sideB.position}\n` +
        `    Agents: ${tp.sideB.agents.join(", ")}\n` +
        `    Evidence: ${tp.sideB.evidence.join("; ")}\n` +
        `  Resolution: ${tp.resolution}`,
    )
    .join("\n\n");
}

/**
 * Build the complete user prompt for presentation generation.
 */
function buildUserPrompt(
  synthesis: SynthesisResult,
  agentResults: AgentResult[],
  blueprint: Blueprint,
): string {
  const slideGuidance = getSlideGuidance(blueprint);
  const agentRoster = buildAgentRoster(agentResults, blueprint);
  const agentFindings = summarizeAgentFindings(agentResults);
  const synthesisLayers = formatSynthesisLayers(synthesis);
  const emergentInsights = formatEmergentInsights(synthesis);
  const tensionPoints = formatTensionPoints(synthesis);

  return `# Presentation Request

## Query & Title
**Query:** ${blueprint.query}
**Swarm Tier:** ${blueprint.tier}
**Agent Count:** ${blueprint.agents.length}
**Overall Confidence:** ${synthesis.overallConfidence}

## Slide Count Guidance
${slideGuidance}

## Agent Roster
${agentRoster}

## Synthesis Layers (5-layer intelligence pyramid)
${synthesisLayers}

## Emergent Insights
${emergentInsights}

## Tension Points
${tensionPoints}

## Agent Findings (top 3-5 per agent with source tiers)
${agentFindings}

## Provenance Context
- Total agents deployed: ${agentResults.length}
- Total findings across all agents: ${agentResults.reduce((sum, ar) => sum + ar.findings.length, 0)}
- Source tier distribution: PRIMARY=${countByTier(agentResults, "PRIMARY")}, SECONDARY=${countByTier(agentResults, "SECONDARY")}, TERTIARY=${countByTier(agentResults, "TERTIARY")}
- Confidence distribution: HIGH=${countByConfidence(agentResults, "HIGH")}, MEDIUM=${countByConfidence(agentResults, "MEDIUM")}, LOW=${countByConfidence(agentResults, "LOW")}
${synthesis.criticRevisions.length > 0 ? `- Critic revisions applied: ${synthesis.criticRevisions.join("; ")}` : ""}

## Branding
PRISM | Intelligence branding throughout. No Inovalon or other brand references.
Use "PRISM Intelligence" in the header mark and footer attributions.

## Output Instructions (CRITICAL)
1. **EXECUTIVE QUALITY**: You MUST aggressively leverage the advanced PRISM components (Stat Grids, Finding Cards, Threat Meters, Strategic Timelines, Comparison Bars, State Grids, Policy Boxes, Quote Blocks).
2. **NO PLAIN TEXT BULLETS**: Do not use standard <ul>/<li> lists for core findings. Wrap data in rich components instead to create a dense, cinematic, and data-rich visual experience.
3. Generate a complete HTML5 file following the Presentation System spec.
4. DO NOT write any inline CSS inside a <style> tag.
5. DO NOT write any inline Javascript inside a <script> tag.
6. You MUST include exactly these two external links in the HTML explicitly:
  <link rel="stylesheet" href="/styles/presentation.css">
  <script src="/js/presentation.js" defer></script>
7. Output ONLY the raw HTML string starting with <!DOCTYPE html>. Do NOT include any markdown formatting (like \`\`\`html).`;
}

// ─── Helpers ────────────────────────────────────────────────

function countByTier(results: AgentResult[], tier: string): number {
  return results.reduce(
    (sum, ar) => sum + ar.findings.filter((f) => f.sourceTier === tier).length,
    0,
  );
}

function countByConfidence(results: AgentResult[], level: string): number {
  return results.reduce(
    (sum, ar) => sum + ar.findings.filter((f) => f.confidence === level).length,
    0,
  );
}

/**
 * Extract the HTML from Claude's response text.
 * Handles both raw HTML output and markdown-wrapped (```html ... ```) output.
 */
function extractHtml(text: string): string {
  // Try to extract from markdown code fence first
  const fenceMatch = text.match(/```html\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Check if the text itself is HTML (starts with <!DOCTYPE or <html)
  const htmlStart = text.indexOf("<!DOCTYPE");
  if (htmlStart >= 0) {
    return text.slice(htmlStart).trim();
  }

  const htmlTagStart = text.indexOf("<html");
  if (htmlTagStart >= 0) {
    return text.slice(htmlTagStart).trim();
  }

  // Fallback: return the whole text (it may still be valid HTML)
  return text.trim();
}

/**
 * Count slides in the generated HTML.
 */
function countSlides(html: string): number {
  // Count section.slide elements or class="slide" occurrences
  const slideMatches = html.match(/class="[^"]*slide[^"]*"/g);
  if (!slideMatches) return 0;

  // Filter to actual slide sections (not sub-components like slide-inner, slide-footer)
  return slideMatches.filter(
    (m) =>
      /class="slide[\s"]/.test(m) ||
      /class="[^"]*\bslide\b[^"]*"/.test(m),
  ).length;
}

/**
 * Generate a URL-safe slug from the query for filename use.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Extract a subtitle from the blueprint query.
 * Uses the first sentence or up to 120 chars.
 */
function deriveSubtitle(blueprint: Blueprint): string {
  const agentCount = blueprint.agents.length;
  const dimensions = blueprint.dimensions
    .slice(0, 4)
    .map((d) => d.name)
    .join(", ");
  return `${agentCount}-agent ${blueprint.tier} analysis spanning ${dimensions}`;
}

// ─── Main Entry Point ───────────────────────────────────────

/**
 * Phase 4: Generate a complete HTML5 presentation from synthesis results.
 *
 * Loads the presentation-system.md spec as the system prompt, builds a
 * structured user prompt from synthesis + agent data, and calls Sonnet
 * to generate the full HTML.
 */
export async function present(input: PresentInput): Promise<PresentationResult> {
  const { synthesis, agentResults, blueprint, emitEvent } = input;

  // --- 1. Emit start event ---
  emitEvent({ type: "presentation_started" });

  // --- 2. Load presentation system spec ---
  const presentationSpec = loadPresentationSpec();

  // --- 3. Build the user prompt ---
  const userPrompt = buildUserPrompt(synthesis, agentResults, blueprint);

  // --- 4. Call Sonnet to generate the presentation ---
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODELS.PRESENT,
    max_tokens: 16000,
    system: [cachedSystemPrompt(presentationSpec)],
    messages: [{ role: "user", content: userPrompt }],
    stream: true,
  });

  let fullText = "";
  for await (const chunk of response) {
    if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
      fullText += chunk.delta.text;
      emitEvent({
        type: "thinking_token", // Reuse this to keep SSE alive
        token: chunk.delta.text,
      });
    } else if (chunk.type === "message_stop") {
      console.log("[PRESENT] Generation complete. Stop Reason:", (chunk as any).stop_reason);
    }
  }

  // --- 5. Extract HTML from response ---
  const html = extractHtml(fullText);

  // --- 6. Count slides ---
  const slideCount = countSlides(html);

  // --- 7. Generate title metadata ---
  const title = `PRISM Intelligence Brief — ${blueprint.query.slice(0, 80)}`;
  const subtitle = deriveSubtitle(blueprint);
  const slug = slugify(blueprint.query);

  // --- 8. Emit completion event ---
  emitEvent({
    type: "presentation_complete",
    title,
    slideCount,
    htmlPath: `prism-${slug}.html`,
  });

  // --- 9. Return result ---
  return {
    html,
    title,
    subtitle,
    slideCount,
  };
}
