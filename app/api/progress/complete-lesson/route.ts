import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeLesson } from "@/lib/server/progress";
import { requireKioskKey } from "@/lib/server/supabase";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  independenceRating: z.number().int().min(1).max(5)
});

export async function POST(request: NextRequest) {
  try {
    requireKioskKey(request.headers.get("x-kiosk-key"));
    const parsed = bodySchema.parse(await request.json());
    const result = await completeLesson(parsed);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete lesson" },
      { status: 400 }
    );
  }
}
