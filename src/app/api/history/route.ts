import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/history — List all runs with their agent counts and status
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    try {
        const runs = await prisma.run.findMany({
            where: {
                ...(tier ? { tier } : {}),
                ...(status ? { status } : {}),
            },
            include: {
                agents: {
                    select: { id: true, name: true, archetype: true, status: true, color: true },
                },
                dimensions: {
                    select: { id: true, name: true },
                },
                presentation: {
                    select: { id: true, title: true, htmlPath: true, slideCount: true },
                },
                _count: {
                    select: { findings: true, synthesis: true },
                },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json({ runs });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch run history";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
