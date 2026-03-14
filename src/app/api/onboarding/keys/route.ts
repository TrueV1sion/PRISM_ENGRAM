import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const { provider, key } = await req.json();

  if (!provider || !key) {
    return NextResponse.json(
      { error: "provider and key are required" },
      { status: 400 }
    );
  }

  const encryptedKey = encrypt(key);

  await prisma.apiKey.upsert({
    where: { provider },
    update: { encryptedKey },
    create: { provider, encryptedKey },
  });

  return NextResponse.json({ ok: true });
}
