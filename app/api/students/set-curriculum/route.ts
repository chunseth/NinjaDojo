import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireKioskKey } from "@/lib/server/supabase";
import { setStudentCurriculum } from "@/lib/server/students";

const bodySchema = z.object({
  studentId: z.string().uuid(),
  beltCode: z.enum(["white", "yellow", "orange", "green", "blue"]),
  levelNumber: z.number().int().min(1),
  lessonNumber: z.number().int().min(1)
});

export async function POST(request: NextRequest) {
  try {
    requireKioskKey(request.headers.get("x-kiosk-key"));
    const parsed = bodySchema.parse(await request.json());
    const result = await setStudentCurriculum(parsed);
    return NextResponse.json({ ok: true, student: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set curriculum" },
      { status: 400 }
    );
  }
}
