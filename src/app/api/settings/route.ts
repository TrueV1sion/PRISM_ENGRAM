/**
 * GET /api/settings — Load platform settings
 * PUT /api/settings — Save platform settings
 */

import { NextResponse } from "next/server";
import { loadSettings, saveSettings, type SettingsState } from "@/lib/settings-store";

export async function GET() {
    try {
        const settings = await loadSettings();
        return NextResponse.json(settings);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = (await request.json()) as SettingsState;
        const saved = await saveSettings(body);
        return NextResponse.json(saved);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
