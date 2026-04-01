import { calculatePoints } from "@/lib/domain/points";
import { getNextLessonId, type OrderedLesson } from "@/lib/domain/progression";
import { getCurriculumTree } from "@/lib/server/curriculum";
import { getSupabaseServiceClient } from "@/lib/server/supabase";

export async function completeLesson(input: {
  studentId: string;
  independenceRating: number;
}) {
  const supabase = getSupabaseServiceClient();

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id, current_lesson_id")
    .eq("id", input.studentId)
    .single();
  if (studentErr) {
    throw studentErr;
  }
  if (!student.current_lesson_id) {
    throw new Error("Student has no current lesson");
  }

  const { data: lesson, error: lessonErr } = await supabase
    .from("curriculum_lessons")
    .select("id, points_value")
    .eq("id", student.current_lesson_id)
    .single();
  if (lessonErr) {
    throw lessonErr;
  }

  const curriculum = await getCurriculumTree();
  const orderedLessons: OrderedLesson[] = [];
  const beltUpPointsByLessonId = new Map<string, number>();
  for (const belt of curriculum) {
    for (const level of belt.levels) {
      for (const current of level.lessons) {
        orderedLessons.push({
          id: current.id,
          beltOrder: belt.belt_order,
          levelNumber: level.level_number,
          lessonNumber: current.lesson_number
        });
        beltUpPointsByLessonId.set(current.id, belt.belt_up_points);
      }
    }
  }

  const next = getNextLessonId(orderedLessons, lesson.id);
  const sortedLessons = [...orderedLessons].sort((a, b) => {
    if (a.beltOrder !== b.beltOrder) {
      return a.beltOrder - b.beltOrder;
    }
    if (a.levelNumber !== b.levelNumber) {
      return a.levelNumber - b.levelNumber;
    }
    return a.lessonNumber - b.lessonNumber;
  });
  const currentIdx = sortedLessons.findIndex((item) => item.id === lesson.id);
  if (currentIdx === -1) {
    throw new Error("Current lesson not found in curriculum ordering");
  }

  const current = sortedLessons[currentIdx];
  const following = sortedLessons[currentIdx + 1];
  const completedBelt =
    !following || Number(following.beltOrder) > Number(current.beltOrder);
  const beltUpBonus = completedBelt ? Number(beltUpPointsByLessonId.get(lesson.id) ?? 0) : 0;
  const pointsAwarded = calculatePoints(lesson.points_value, input.independenceRating) + beltUpBonus;

  const { error: completionErr } = await supabase.from("lesson_completions").insert({
    student_id: student.id,
    lesson_id: lesson.id,
    independence_rating: input.independenceRating,
    points_awarded: pointsAwarded
  });
  if (completionErr) {
    throw completionErr;
  }

  const { error: updateErr } = await supabase
    .from("students")
    .update({
      current_lesson_id: next,
      status: next === lesson.id ? "completed" : "active"
    })
    .eq("id", student.id);
  if (updateErr) {
    throw updateErr;
  }

  const todayChicago = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Chicago"
  });
  const { error: attendanceErr } = await supabase.from("attendance_events").upsert(
    {
      student_id: student.id,
      attendance_date: todayChicago,
      source: "sensei"
    },
    { onConflict: "student_id,attendance_date" }
  );
  if (attendanceErr) {
    throw attendanceErr;
  }

  return { studentId: student.id, completedLessonId: lesson.id, nextLessonId: next, pointsAwarded };
}
