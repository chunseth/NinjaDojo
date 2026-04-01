import { normalizeName } from "@/lib/domain/normalize";
import { getSupabaseServiceClient } from "@/lib/server/supabase";
import { getCurriculumTree } from "@/lib/server/curriculum";

export async function resolveUnknownStudent(input: {
  incomingName: string;
  mode: "create" | "link";
  existingStudentId?: string;
  beltCode?: string;
  levelNumber?: number;
  lessonNumber?: number;
}) {
  const supabase = getSupabaseServiceClient();
  const normalized = normalizeName(input.incomingName);

  if (input.mode === "link") {
    if (!input.existingStudentId) {
      throw new Error("existingStudentId is required for link mode");
    }
    const { data, error } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("id", input.existingStudentId)
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  if (!input.beltCode || !input.levelNumber || !input.lessonNumber) {
    throw new Error("beltCode, levelNumber and lessonNumber are required for create mode");
  }

  const curriculum = await getCurriculumTree();
  const belt = curriculum.find((item) => item.belt_code === input.beltCode);
  const level = belt?.levels.find((item) => item.level_number === input.levelNumber);
  const lesson = level?.lessons.find((item) => item.lesson_number === input.lessonNumber);
  if (!lesson) {
    throw new Error("Selected curriculum location does not exist");
  }

  const { data: created, error: createErr } = await supabase
    .from("students")
    .insert({
      full_name: input.incomingName,
      normalized_name: normalized,
      current_lesson_id: lesson.id
    })
    .select("id, full_name")
    .single();

  if (createErr) {
    throw createErr;
  }

  return created;
}

export async function setStudentCurriculum(input: {
  studentId: string;
  beltCode: string;
  levelNumber: number;
  lessonNumber: number;
}) {
  const supabase = getSupabaseServiceClient();
  const curriculum = await getCurriculumTree();
  const belt = curriculum.find((item) => item.belt_code === input.beltCode);
  const level = belt?.levels.find((item) => item.level_number === input.levelNumber);
  const lesson = level?.lessons.find((item) => item.lesson_number === input.lessonNumber);

  if (!lesson) {
    throw new Error("Selected curriculum location does not exist");
  }

  const { data, error } = await supabase
    .from("students")
    .update({ current_lesson_id: lesson.id })
    .eq("id", input.studentId)
    .select("id, full_name")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
