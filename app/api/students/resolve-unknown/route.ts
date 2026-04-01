import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireKioskKey } from "@/lib/server/supabase";
import { resolveUnknownStudent } from "@/lib/server/students";

const bodySchema = z
  .object({
    incomingName: z.string().min(2),
    mode: z.enum(["create", "link"]),
    existingStudentId: z.string().uuid().optional(),
    beltCode: z.enum(["white", "yellow", "orange", "green", "blue"]).optional(),
    levelNumber: z.number().int().min(1).optional(),
    lessonNumber: z.number().int().min(1).optional()
  })
  .superRefine((val, ctx) => {
    if (val.mode === "link" && !val.existingStudentId) {
      ctx.addIssue({ code: "custom", path: ["existingStudentId"], message: "existingStudentId required" });
    }
    if (val.mode === "create" && (!val.beltCode || !val.levelNumber || !val.lessonNumber)) {
      ctx.addIssue({ code: "custom", message: "beltCode, levelNumber, lessonNumber required in create mode" });
    }
  });

export async function POST(request: NextRequest) {
  try {
    requireKioskKey(request.headers.get("x-kiosk-key"));
    const parsed = bodySchema.parse(await request.json());
    const result = await resolveUnknownStudent(parsed);
    return NextResponse.json({ ok: true, student: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve student" },
      { status: 400 }
    );
  }
}
