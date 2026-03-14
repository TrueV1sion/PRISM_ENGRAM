/**
 * Slide Generator
 *
 * Generates individual slide HTML via LLM call, given:
 * - A SlideSpec (title, type, purpose, componentHints, dataPoints, etc.)
 * - Pre-computed ChartData fragments from the chart compiler
 * - Exemplar HTML for this slide type
 * - A compact component reference for the hinted CSS classes
 * - Relevant AgentFindings and deck context
 *
 * Also exposes generateSlidesBatch() for parallel execution with retry
 * logic and a 30% failure threshold that triggers legacy fallback.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  SlideHTML,
  SlideGeneratorInput,
  SlideSpec,
  ChartData,
  AgentFinding,
} from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODELS = { PRESENT: "claude-sonnet-4-6" } as const;
const SLIDE_TIMEOUT_MS = 45_000;

// ─── Anthropic Client ─────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

/**
 * Builds the system prompt for single-slide generation.
 * Includes the exemplar HTML, component reference, and structural rules.
 */
function buildSlideSystemPrompt(
  exemplarHtml: string,
  componentRef: string,
  spec: SlideSpec,
): string {
  return `You are a PRISM Intelligence slide generator. Your task is to generate a single slide as a self-contained \`<section>\` HTML element.

## Output Rules (CRITICAL)
1. Output ONLY the raw \`<section>\` element — no \`<!DOCTYPE>\`, no \`<html>\`, no \`<head>\`, no surrounding markup.
2. The section MUST open with: \`<section class="slide" id="s${spec.slideNumber}">\`
3. Every slide MUST contain these three direct children in order:
   - \`<div class="slide-bg-glow" ...>\` — decorative glow (position via inline style)
   - \`<div class="slide-inner">\` — all content goes here
   - \`<div class="slide-footer">\` — three \`<span>\` columns
4. Do NOT add inline \`<style>\` or \`<script>\` tags.
5. Use ONLY the CSS classes listed in the Component Reference below. Never invent class names.
6. Terminate properly with \`</section>\`.

## Animation Classes
- \`.anim\` — fade-up entrance (most common)
- \`.anim-scale\` — scale-in entrance
- \`.anim-blur\` — blur-fade entrance
- Stagger delays: \`.d1\` through \`.d7\` (100ms–700ms intervals)
- \`.is-visible\` — triggers SVG chart animations (bar-chart, donut-chart, line-chart, sparkline)
- \`.animate\` — triggers bar-fill scaleX animation

## Slide Structure Template
\`\`\`html
<section class="slide" id="s${spec.slideNumber}">
  <div class="slide-bg-glow" style="background:var(--inov-cerulean);top:-200px;right:-200px;"></div>
  <div class="slide-inner">
    <div class="eyebrow anim d1"><span class="tag strategic">SOURCE AGENT</span> Agent Name</div>
    <h2 class="slide-title anim d2">Slide Title</h2>
    <p class="section-intro anim d3">Brief framing sentence for this slide's content.</p>
    <!-- main content grid here -->
  </div>
  <div class="slide-footer">
    <span>PRISM Intelligence</span>
    <span>Source Agent | Analysis</span>
    <span>Slide ${spec.slideNumber}</span>
  </div>
</section>
\`\`\`

${componentRef}

## Exemplar HTML (slide type: ${spec.type})
Study this exemplar for component patterns, layout structure, and class usage:

\`\`\`html
${exemplarHtml}
\`\`\`

## Editorial Rules
- Match component density to data richness: if many data points, use charts and grids; if qualitative, use finding-cards and quotes
- Maximum 2 distinct component types per content area to avoid visual clutter
- Every slide needs ONE clear hero element (biggest stat, key chart, or primary finding card)
- For \`data-metrics\` slides: lead with stat-blocks and SVG charts
- For \`dimension-deep-dive\` slides: use finding-cards with confidence badges
- For \`emergence\` slides: use emergence-card with emergent-why explanation
- For \`tension\` slides: use grid-2 side-by-side finding-cards
- For \`title\` / \`closing\` slides: use hero-title, hero-sub, hero-stats
- If chart SVG fragments are provided in the user message, INSERT them directly — do NOT recreate or modify them`;
}

/**
 * Builds the user prompt for a single slide.
 * Includes spec metadata, chart fragments, relevant findings, and deck context.
 */
function buildSlideUserPrompt(
  spec: SlideSpec,
  charts: ChartData[],
  findings: AgentFinding[],
  deckContext: { title: string; subtitle: string; totalSlides: number },
): string {
  const parts: string[] = [];

  // Deck context header
  parts.push(`# Slide ${spec.slideNumber} of ${deckContext.totalSlides}`);
  parts.push(`**Deck:** ${deckContext.title}`);
  parts.push(`**Deck Subtitle:** ${deckContext.subtitle}`);
  parts.push(``);

  // Slide spec
  parts.push(`## Slide Specification`);
  parts.push(`- **Title:** ${spec.title}`);
  parts.push(`- **Type:** ${spec.type}`);
  parts.push(`- **Purpose:** ${spec.purpose}`);
  parts.push(`- **Animation Style:** ${spec.animationType}`);
  parts.push(`- **Source Agents:** ${spec.agentSources.join(", ") || "Analysis"}`);
  parts.push(`- **Component Hints:** ${spec.componentHints.join(", ") || "standard"}`);
  parts.push(``);

  // Data points
  if (spec.dataPoints.length > 0) {
    parts.push(`## Data Points`);
    for (const dp of spec.dataPoints) {
      const prefix = dp.prefix ?? "";
      const unit = dp.unit ?? "";
      parts.push(
        `- **${dp.label}:** ${prefix}${dp.value}${unit} (role: ${dp.chartRole})`,
      );
    }
    parts.push(``);
  }

  // Pre-computed chart fragments
  if (charts.length > 0) {
    parts.push(`## Pre-Computed Chart Fragments`);
    parts.push(`INSERT these fragments directly into the slide — do NOT recreate them.`);
    parts.push(``);

    for (let i = 0; i < charts.length; i++) {
      const chart = charts[i];
      parts.push(`### Chart ${i + 1} (type: ${chart.type})`);

      if ("svgFragment" in chart) {
        parts.push("```html");
        parts.push(chart.svgFragment);
        parts.push("```");
      } else if ("htmlFragment" in chart) {
        parts.push("```html");
        parts.push(chart.htmlFragment);
        parts.push("```");
      }
      parts.push(``);
    }
  }

  // Relevant findings (top 5)
  if (findings.length > 0) {
    parts.push(`## Relevant Findings (use in slide content)`);
    const topFindings = findings.slice(0, 5);
    for (const f of topFindings) {
      parts.push(
        `- [${f.confidence} | ${f.sourceTier}] **${f.statement}**\n  Evidence: ${f.evidence.slice(0, 150)}${f.evidence.length > 150 ? "..." : ""}\n  Implication: ${f.implication}`,
      );
    }
    parts.push(``);
  }

  // Final instruction
  parts.push(`## Task`);
  parts.push(
    `Generate the complete \`<section class="slide" id="s${spec.slideNumber}">\` element for this slide. ` +
    `Insert chart fragments exactly as provided. Use specific numbers and source attributions from the findings above. ` +
    `Output ONLY the \`<section>...</section>\` element — nothing else.`,
  );

  return parts.join("\n");
}

// ─── Single Slide Generator ───────────────────────────────────────────────────

/**
 * Generates a single slide HTML element via LLM call.
 * Returns a fallback slide on timeout or LLM error.
 */
export async function generateSlide(
  input: SlideGeneratorInput,
): Promise<SlideHTML> {
  const { spec, charts, exemplarHtml, componentRef, findings, deckContext } =
    input;

  const client = getAnthropicClient();
  const systemPrompt = buildSlideSystemPrompt(exemplarHtml, componentRef, spec);
  const userPrompt = buildSlideUserPrompt(
    spec,
    charts,
    findings,
    deckContext,
  );

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SLIDE_TIMEOUT_MS,
  );

  try {
    const response = await client.messages.create(
      {
        model: MODELS.PRESENT,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { signal: controller.signal },
    );

    clearTimeout(timeout);

    const text = response.content
      .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Extract the <section> HTML from response
    const sectionMatch = text.match(/<section[\s\S]*?<\/section>/);
    if (!sectionMatch) {
      console.warn(
        `[slide-generator] Slide ${spec.slideNumber}: no <section> found in LLM response, using fallback`,
      );
      return generateFallbackSlide(spec, charts);
    }

    return {
      slideNumber: spec.slideNumber,
      html: sectionMatch[0],
      tokensUsed: response.usage?.output_tokens ?? 0,
      status: "success",
    };
  } catch (error) {
    clearTimeout(timeout);
    const reason =
      error instanceof Error ? error.message : String(error);
    console.warn(
      `[slide-generator] Slide ${spec.slideNumber} error: ${reason}. Using fallback.`,
    );
    return generateFallbackSlide(spec, charts);
  }
}

// ─── Batch Parallel Generator ─────────────────────────────────────────────────

/**
 * Generates multiple slides in parallel via Promise.allSettled.
 * Rejected promises are retried once individually.
 * If >= 30% of slides fail after retry, throws BatchFailureError to
 * allow the caller to fall back to the legacy monolithic generator.
 */
export async function generateSlidesBatch(
  inputs: SlideGeneratorInput[],
): Promise<SlideHTML[]> {
  if (inputs.length === 0) return [];

  // Parallel first pass
  const settled = await Promise.allSettled(
    inputs.map((input) => generateSlide(input)),
  );

  const slides: SlideHTML[] = [];
  let failCount = 0;

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];

    if (result.status === "fulfilled") {
      slides.push(result.value);
    } else {
      // First pass rejected — retry once individually
      failCount++;
      console.warn(
        `[slide-generator] Batch: slide ${inputs[i].spec.slideNumber} failed (${result.reason}), retrying once.`,
      );

      try {
        const retried = await generateSlide(inputs[i]);
        slides.push(retried);
        // Successful retry — decrement fail count
        failCount--;
      } catch (retryError) {
        console.warn(
          `[slide-generator] Batch: slide ${inputs[i].spec.slideNumber} retry also failed. Using fallback.`,
        );
        slides.push(generateFallbackSlide(inputs[i].spec, inputs[i].charts));
      }
    }
  }

  // Enforce 30% failure threshold
  if (inputs.length > 0 && failCount / inputs.length >= 0.3) {
    throw new Error(
      `BatchFailureError: ${failCount}/${inputs.length} slides failed (>= 30% threshold). Triggering legacy fallback.`,
    );
  }

  // Return slides sorted by slideNumber to preserve order
  return slides.sort((a, b) => a.slideNumber - b.slideNumber);
}

// ─── Fallback Slide Generator ─────────────────────────────────────────────────

/**
 * Generates a minimal but valid fallback slide using spec metadata
 * and any pre-computed chart fragments. Used when LLM generation fails.
 */
function generateFallbackSlide(
  spec: SlideSpec,
  charts: ChartData[],
): SlideHTML {
  const chartFragments = charts
    .map((c) => {
      if ("svgFragment" in c) return c.svgFragment;
      if ("htmlFragment" in c) return c.htmlFragment;
      return "";
    })
    .filter(Boolean)
    .join("\n");

  const sourcesText = spec.agentSources.join(", ") || "Analysis";

  const html = `<section class="slide" id="s${spec.slideNumber}">
  <div class="slide-bg-glow" style="background:var(--inov-cerulean);top:-200px;right:-200px;"></div>
  <div class="slide-inner">
    <h2 class="slide-title anim d1">${escapeHtml(spec.title)}</h2>
    <p class="section-intro anim d2">${escapeHtml(spec.purpose)}</p>
    ${chartFragments ? `<div class="chart-container anim d3">${chartFragments}</div>` : ""}
  </div>
  <div class="slide-footer">
    <span>PRISM Intelligence</span>
    <span>${escapeHtml(sourcesText)}</span>
    <span>Slide ${spec.slideNumber}</span>
  </div>
</section>`;

  return {
    slideNumber: spec.slideNumber,
    html,
    tokensUsed: 0,
    status: "fallback",
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
