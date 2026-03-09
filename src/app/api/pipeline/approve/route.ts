import { NextResponse } from "next/server";
import { approveBlueprintForRun } from "@/lib/pipeline/approval";

/**
 * POST /api/pipeline/approve
 *
 * Called by the client when the user approves a blueprint.
 * Resolves the pending Promise in the executor, allowing the pipeline to continue.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { runId } = body;

    if (!runId || typeof runId !== "string") {
      return NextResponse.json(
        { error: "runId is required" },
        { status: 400 },
      );
    }

    const approved = approveBlueprintForRun(runId);

    if (!approved) {
      return NextResponse.json(
        { error: "No pending approval for this run" },
        { status: 404 },
      );
    }

    return NextResponse.json({ approved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
