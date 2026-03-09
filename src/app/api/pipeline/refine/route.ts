/**
 * POST /api/pipeline/refine -- Phase 5: Refine an existing analysis.
 *
 * Accepts a nudge (user refinement request) and the original runId,
 * deploys focused agents, synthesizes new findings, and optionally
 * generates an updated presentation.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refine } from "@/lib/pipeline/refine";
import type { IntelligenceManifest, PipelineEvent } from "@/lib/pipeline/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nudge, runId } = body;

    if (!nudge || !runId) {
      return NextResponse.json(
        { error: "nudge and runId are required" },
        { status: 400 },
      );
    }

    // Load the original run with all related data
    const run = await prisma.run.findUnique({
      where: { id: runId },
      include: {
        agents: { include: { findings: true } },
        synthesis: { orderBy: { order: "asc" } },
        presentation: true,
        dimensions: true,
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: "Run not found" },
        { status: 404 },
      );
    }

    // Reconstruct a minimal manifest from database records.
    // The full manifest would normally be cached — this is a fallback.
    // For v1, we pass what we have and let refine handle partial data.
    const manifest: IntelligenceManifest = {
      blueprint: {
        query: run.query,
        dimensions: run.dimensions.map((d) => ({
          name: d.name,
          description: d.description,
          justification: "",
          dataSources: [],
          lens: "",
          signalMatch: "",
        })),
        agents: run.agents.map((a) => ({
          name: a.name,
          archetype: a.archetype ?? "",
          dimension: a.dimension ?? "",
          mandate: a.mandate ?? "",
          tools: JSON.parse(a.tools ?? "[]"),
          lens: "",
          bias: "",
        })),
        interconnections: [],
        complexityScore: {
          breadth: run.breadth ?? 3,
          depth: run.depth ?? 3,
          interconnection: run.interconnection ?? 3,
          total: run.complexityScore ?? 9,
          urgency: 1.0,
          adjusted: run.complexityScore ?? 9,
          reasoning: "",
        },
        tier: (run.tier as "MICRO" | "STANDARD" | "EXTENDED" | "MEGA" | "CAMPAIGN") ?? "STANDARD",
        estimatedTime: run.estimatedTime ?? "",
        ethicalConcerns: [],
      },
      agentResults: run.agents.map((a) => ({
        agentName: a.name,
        archetype: a.archetype ?? "",
        dimension: a.dimension ?? "",
        findings: a.findings.map((f) => ({
          statement: f.statement,
          evidence: f.evidence ?? "",
          confidence: (f.confidence as "HIGH" | "MEDIUM" | "LOW") ?? "MEDIUM",
          sourceTier: (f.sourceTier as "PRIMARY" | "SECONDARY" | "TERTIARY") ?? "SECONDARY",
          evidenceType: (f.evidenceType as "direct" | "inferred" | "analogical" | "modeled") ?? "inferred",
          source: f.source ?? "",
          implication: f.implication ?? "",
          tags: JSON.parse(f.tags ?? "[]"),
        })),
        gaps: [],
        signals: [],
        minorityViews: [],
        toolsUsed: JSON.parse(a.tools ?? "[]"),
        tokensUsed: 0,
      })),
      synthesis: {
        layers: run.synthesis.map((s) => ({
          name: s.layerName as "foundation" | "convergence" | "tension" | "emergence" | "gap",
          description: s.description,
          insights: JSON.parse(s.insights),
        })),
        emergentInsights: [],
        tensionPoints: [],
        overallConfidence: "MEDIUM" as const,
        criticRevisions: [],
      },
      presentation: run.presentation
        ? {
            html: "",
            title: run.presentation.title,
            subtitle: run.presentation.subtitle ?? "",
            slideCount: run.presentation.slideCount,
          }
        : { html: "", title: "", subtitle: "", slideCount: 0 },
      qualityReport: {
        totalFindings: run.agents.reduce((sum, a) => sum + a.findings.length, 0),
        sourcedFindings: 0,
        sourceCoveragePercent: 0,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
        sourceTierDistribution: { primary: 0, secondary: 0, tertiary: 0 },
        emergenceYield: 0,
        gapCount: 0,
        provenanceComplete: false,
      },
      metadata: {
        runId,
        startTime: run.createdAt.toISOString(),
        endTime: run.completedAt?.toISOString() ?? new Date().toISOString(),
        totalTokens: 0,
        totalCost: 0,
      },
    };

    const events: PipelineEvent[] = [];
    const result = await refine({
      nudge,
      originalManifest: manifest,
      emitEvent: (event) => events.push(event),
    });

    return NextResponse.json({
      success: true,
      nudgeType: result.nudgeType,
      newFindings: result.newAgentResults.flatMap((r) => r.findings).length,
      updatedLayers: result.updatedSynthesis.layers.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Refine Error]", message);

    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
