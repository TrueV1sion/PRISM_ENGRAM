/**
 * Agentic Presentation Orchestrator
 *
 * Coordinates the agentic presentation pipeline:
 *   Stage 1: Plan      — planSlides()         → SlideManifest
 *   Stage 2: Compile   — compileCharts()       → ChartDataMap
 *   Stage 3: Generate  — generateSlidesBatch() → SlideHTML[]
 *   Stage 4: Assemble  — assemble()            → AssemblerOutput
 *   Stage 5: Validate  — validate()            → QualityScorecard
 *   Stage 8: Return    — PresentationResult
 *
 * Stages 6-7 (QA loop / remediation) are deferred to Task 18.
 *
 * On any failure, falls back to the legacy present() function.
 */

import { planSlides } from "./present/planner";
import { compileCharts } from "./present/chart-compiler";
import { generateSlidesBatch } from "./present/slide-generator";
import { assemble } from "./present/assembler";
import { validate } from "./present/validator";
import { ComponentCatalog } from "./present/component-catalog";
import { present } from "./present";
import type {
  ChartDataMap,
  SlideGeneratorInput,
} from "./present/types";
import type { PresentationResult } from "./types";
import type { PresentInput } from "./present";

// ─── Confidence ordering for finding sort ────────────────────────────────────

const CONFIDENCE_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Present a slide deck using the agentic pipeline (happy path).
 *
 * Falls back to the legacy present() on any unrecoverable error.
 */
export async function presentOrchestrated(
  input: PresentInput,
): Promise<PresentationResult> {
  const { emitEvent } = input;

  try {
    // ── Stage 1: Plan ────────────────────────────────────────────────────────

    emitEvent({
      type: "phase_change",
      phase: "PRESENT_PLANNING",
      message: "Planning slide deck...",
    });

    const planStart = Date.now();
    const manifest = await planSlides(input);
    const planMs = Date.now() - planStart;

    console.log(
      `[orchestrator] Stage 1 Plan complete: ${manifest.slides.length} slides planned in ${planMs}ms`,
    );

    // ── Stage 2: Compile Charts ───────────────────────────────────────────────

    const chartStart = Date.now();
    const chartDataMap: ChartDataMap = {};

    for (const slide of manifest.slides) {
      if (slide.dataPoints.length > 0) {
        chartDataMap[slide.slideNumber] = compileCharts(slide.dataPoints);
      } else {
        chartDataMap[slide.slideNumber] = [];
      }
    }

    const chartCompileMs = Date.now() - chartStart;
    console.log(
      `[orchestrator] Stage 2 Chart compile complete in ${chartCompileMs}ms`,
    );

    // ── Stage 3: Generate Slides ──────────────────────────────────────────────

    emitEvent({
      type: "phase_change",
      phase: "PRESENT_GENERATING",
      message: `Generating ${manifest.slides.length} slides in parallel...`,
    });

    const catalog = new ComponentCatalog();
    const generateStart = Date.now();

    const slideGeneratorInputs: SlideGeneratorInput[] = manifest.slides.map(
      (spec) => {
        // Get exemplar HTML for this slide type
        const exemplarHtml = catalog.exemplarForSlideType(spec.type);

        // Get component reference for hinted class names
        const componentRef = catalog.componentReference(spec.componentHints);

        // Collect findings from matching agents (agentSources → agentResults.agentName)
        const matchingAgentNames = new Set(spec.agentSources);
        const relevantFindings = input.agentResults
          .filter((ar) => matchingAgentNames.has(ar.agentName))
          .flatMap((ar) => ar.findings)
          .sort(
            (a, b) =>
              (CONFIDENCE_ORDER[a.confidence] ?? 2) -
              (CONFIDENCE_ORDER[b.confidence] ?? 2),
          )
          .slice(0, 5);

        // Attach chart data for this slide
        const charts = chartDataMap[spec.slideNumber] ?? [];

        return {
          spec,
          charts,
          exemplarHtml,
          componentRef,
          findings: relevantFindings,
          deckContext: {
            title: manifest.title,
            subtitle: manifest.subtitle,
            totalSlides: manifest.totalSlides,
          },
        };
      },
    );

    const slides = await generateSlidesBatch(slideGeneratorInputs);
    const generateMs = Date.now() - generateStart;

    emitEvent({
      type: "phase_change",
      phase: "PRESENT_GENERATING",
      message: `Generated ${slides.length} slides in ${Math.round(generateMs / 1000)}s`,
    });

    console.log(
      `[orchestrator] Stage 3 Generate complete: ${slides.length} slides in ${generateMs}ms`,
    );

    // ── Stage 4: Assemble ─────────────────────────────────────────────────────

    const assembleStart = Date.now();
    const assemblerOutput = assemble({ slides, manifest });
    const assembleMs = Date.now() - assembleStart;

    console.log(
      `[orchestrator] Stage 4 Assemble complete: ${assemblerOutput.slideCount} slides, ${assemblerOutput.html.length} chars in ${assembleMs}ms`,
    );

    // ── Stage 5: Validate ─────────────────────────────────────────────────────

    const validateStart = Date.now();
    const scorecard = validate(assemblerOutput.html);
    const validateMs = Date.now() - validateStart;

    console.log(
      `[orchestrator] Stage 5 Validate complete: grade=${scorecard.grade}, score=${scorecard.overall} in ${validateMs}ms`,
    );

    // Emit quality report
    emitEvent({
      type: "quality_report",
      report: {
        totalFindings: input.agentResults.reduce(
          (sum, ar) => sum + ar.findings.length,
          0,
        ),
        sourcedFindings: input.agentResults
          .flatMap((ar) => ar.findings)
          .filter((f) => f.source && f.source.trim().length > 0).length,
        sourceCoveragePercent: 0, // computed below
        confidenceDistribution: {
          high: countByConf(input.agentResults, "HIGH"),
          medium: countByConf(input.agentResults, "MEDIUM"),
          low: countByConf(input.agentResults, "LOW"),
        },
        sourceTierDistribution: {
          primary: countByTier(input.agentResults, "PRIMARY"),
          secondary: countByTier(input.agentResults, "SECONDARY"),
          tertiary: countByTier(input.agentResults, "TERTIARY"),
        },
        emergenceYield: input.synthesis.emergentInsights.length,
        gapCount: input.agentResults.reduce((sum, ar) => sum + ar.gaps.length, 0),
        provenanceComplete: false,
        grade: scorecard.grade,
        overallScore: scorecard.overall,
      },
    });

    // ── Stages 6-7: Deferred (QA loop / remediation — Task 18) ───────────────

    // ── Stage 8: Return ───────────────────────────────────────────────────────

    const totalMs =
      planMs + chartCompileMs + generateMs + assembleMs + validateMs;

    console.log(
      `[orchestrator] Pipeline complete in ${totalMs}ms — grade: ${scorecard.grade}`,
    );

    emitEvent({
      type: "presentation_complete",
      title: manifest.title,
      slideCount: assemblerOutput.slideCount,
      htmlPath: "orchestrator",
    });

    return {
      html: assemblerOutput.html,
      title: manifest.title,
      subtitle: manifest.subtitle,
      slideCount: assemblerOutput.slideCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[orchestrator] Pipeline failed, falling back to legacy presenter: ${message}`);

    emitEvent({
      type: "error",
      message: `Agentic presenter failed (${message}) — falling back to legacy presenter`,
      phase: "PRESENT",
    });

    // ── Fallback: legacy present() ────────────────────────────────────────────
    return present(input);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

import type { AgentResult } from "./types";

function countByConf(results: AgentResult[], level: string): number {
  return results.reduce(
    (sum, ar) => sum + ar.findings.filter((f) => f.confidence === level).length,
    0,
  );
}

function countByTier(results: AgentResult[], tier: string): number {
  return results.reduce(
    (sum, ar) => sum + ar.findings.filter((f) => f.sourceTier === tier).length,
    0,
  );
}
