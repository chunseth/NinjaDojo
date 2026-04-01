import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyReports } from "@/lib/server/reports";
import { requireKioskKey } from "@/lib/server/supabase";

export async function POST(request: NextRequest) {
  try {
    requireKioskKey(request.headers.get("x-kiosk-key"));
    const result = await generateMonthlyReports();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate monthly reports" },
      { status: 500 }
    );
  }
}
