import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient, requireKioskKey } from "@/lib/server/supabase";
import { getCurriculumTree, seedBelts } from "@/lib/server/curriculum";

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_levels_for_belt"),
    beltId: z.string().uuid(),
    levelCount: z.number().int().min(1).max(30)
  }),
  z.object({
    action: z.literal("create_lesson"),
    levelId: z.string().uuid(),
    lessonNumber: z.number().int().min(1),
    title: z.string().min(1),
    pointsValue: z.number().int().min(1),
    conceptTag: z.string().optional()
  })
]);

export async function GET() {
  try {
    await seedBelts();
    const tree = await getCurriculumTree();
    return NextResponse.json({ belts: tree });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch curriculum" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    requireKioskKey(request.headers.get("x-kiosk-key"));
    await seedBelts();
    const payload = postSchema.parse(await request.json());
    const supabase = getSupabaseServiceClient();

    if (payload.action === "create_levels_for_belt") {
      const levels = Array.from({ length: payload.levelCount }, (_, idx) => ({
        belt_id: payload.beltId,
        level_number: idx + 1,
        title: `Level ${idx + 1}`
      }));

      const { error } = await supabase.from("curriculum_levels").upsert(levels, {
        onConflict: "belt_id,level_number"
      });
      if (error) {
        throw error;
      }
      return NextResponse.json({ ok: true });
    }
    const { error } = await supabase.from("curriculum_lessons").insert({
      level_id: payload.levelId,
      lesson_number: payload.lessonNumber,
      title: payload.title,
      points_value: payload.pointsValue,
      concept_tag: payload.conceptTag ?? null
    });
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update curriculum" },
      { status: 400 }
    );
  }
}
