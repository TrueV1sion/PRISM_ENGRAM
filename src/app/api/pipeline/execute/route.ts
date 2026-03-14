/**
 * POST /api/pipeline/execute -- Execute the full PRISM intelligence pipeline.
 *
 * Accepts a query + runId, runs the full pipeline, and returns the manifest.
 * For real-time streaming, use GET /api/pipeline/stream instead.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executePipeline } from "@/lib/pipeline/executor";
import type { AutonomyMode } from "@/lib/pipeline/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, runId, autonomyMode = "guided" } = body;

    if (!query || !runId) {
      return NextResponse.json(
        { error: "query and runId are required" },
        { status: 400 },
      );
    }

    // Create the Run record
    await prisma.run.create({
      data: {
        id: runId,
        query,
        status: "INITIALIZE",
      },
    });

    const manifest = await executePipeline({
      query,
      runId,
      autonomyMode: autonomyMode as AutonomyMode,
    });

    return NextResponse.json({
      success: true,
      manifest,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Pipeline Error]", message);

    return NextResponse.json(
      { error: message, success: false },
      { status: 500 },
    );
  }
}
