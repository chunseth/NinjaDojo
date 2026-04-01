import type { BeltCode, CurriculumTree } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/server/supabase";

const BELT_ORDER: Record<BeltCode, number> = {
  white: 1,
  yellow: 2,
  orange: 3,
  green: 4,
  blue: 5
};

const BELT_UP_POINTS: Record<BeltCode, number> = {
  white: 30,
  yellow: 50,
  orange: 70,
  green: 90,
  blue: 100
};

export async function seedBelts() {
  const supabase = getSupabaseServiceClient();
  const rows = Object.entries(BELT_ORDER).map(([beltCode, order]) => ({
    belt_code: beltCode,
    belt_order: order,
    belt_up_points: BELT_UP_POINTS[beltCode as BeltCode]
  }));
  const { error } = await supabase.from("curriculum_belts").upsert(rows, { onConflict: "belt_code" });
  if (error) {
    throw error;
  }
}

export async function getCurriculumTree(): Promise<CurriculumTree[]> {
  const supabase = getSupabaseServiceClient();
  const { data: belts, error: beltErr } = await supabase
    .from("curriculum_belts")
    .select("id, belt_code, belt_order, belt_up_points")
    .order("belt_order", { ascending: true });
  if (beltErr) {
    throw beltErr;
  }
  const beltIds = (belts ?? []).map((belt) => belt.id);

  const { data: levels, error: levelErr } = beltIds.length
    ? await supabase
        .from("curriculum_levels")
        .select("id, belt_id, level_number, title")
        .in("belt_id", beltIds)
        .order("level_number", { ascending: true })
    : { data: [], error: null };
  if (levelErr) {
    throw levelErr;
  }
  const levelIds = (levels ?? []).map((level) => level.id);

  const { data: lessons, error: lessonErr } = levelIds.length
    ? await supabase
        .from("curriculum_lessons")
        .select("id, level_id, lesson_number, title, points_value, concept_tag")
        .in("level_id", levelIds)
        .order("lesson_number", { ascending: true })
    : { data: [], error: null };
  if (lessonErr) {
    throw lessonErr;
  }

  const lessonByLevel = new Map<string, typeof lessons>();
  for (const lesson of lessons ?? []) {
    const list = lessonByLevel.get(lesson.level_id as string) ?? [];
    list.push(lesson);
    lessonByLevel.set(lesson.level_id as string, list);
  }

  const levelByBelt = new Map<string, typeof levels>();
  for (const level of levels ?? []) {
    const list = levelByBelt.get(level.belt_id as string) ?? [];
    list.push(level);
    levelByBelt.set(level.belt_id as string, list);
  }

  return (belts ?? []).map((belt) => ({
    id: belt.id,
    belt_code: belt.belt_code as BeltCode,
    belt_order: belt.belt_order as number,
    belt_up_points: Number((belt as { belt_up_points?: number | null }).belt_up_points ?? 0),
    levels: (levelByBelt.get(belt.id) ?? []).map((level) => ({
      id: level.id,
      level_number: level.level_number as number,
      title: level.title as string,
      lessons: (lessonByLevel.get(level.id as string) ?? []).map((lesson) => ({
        id: lesson.id as string,
        lesson_number: lesson.lesson_number as number,
        title: lesson.title as string,
        points_value: lesson.points_value as number,
        concept_tag: (lesson.concept_tag as string | null) ?? null
      }))
    }))
  }));
}
