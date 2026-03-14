import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: { onboardingDismissed: true },
    create: { id: "default", onboardingDismissed: true },
  });

  return NextResponse.json({ ok: true });
}
