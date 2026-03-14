import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: { hasCompletedTour: true },
    create: { id: "default", hasCompletedTour: true },
  });

  return NextResponse.json({ ok: true });
}
