import { previousMonthWindow } from "@/lib/domain/date";
import { getSupabaseServiceClient } from "@/lib/server/supabase";
import { buildSimplePdf } from "@/lib/server/pdf";

function slugName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z_]/g, "");
}

export async function generateMonthlyReports() {
  const supabase = getSupabaseServiceClient();
  const { start, end, monthYear } = previousMonthWindow(new Date());

  const { data: students, error: studentErr } = await supabase
    .from("students")
    .select("id, full_name, normalized_name")
    .order("full_name", { ascending: true });
  if (studentErr) {
    throw studentErr;
  }

  const studentIds = (students ?? []).map((s) => s.id);
  if (studentIds.length === 0) {
    return { monthYear, files: [] as Array<{ fileName: string; base64: string }> };
  }

  const { data: completions, error: completionErr } = await supabase
    .from("lesson_completions")
    .select("student_id, points_awarded, completed_at, curriculum_lessons!inner(title, concept_tag)")
    .gte("completed_at", start.toISOString())
    .lt("completed_at", end.toISOString())
    .in("student_id", studentIds);
  if (completionErr) {
    throw completionErr;
  }

  const { data: attendance, error: attendanceErr } = await supabase
    .from("attendance_events")
    .select("student_id, attendance_date")
    .gte("attendance_date", start.toISOString().slice(0, 10))
    .lt("attendance_date", end.toISOString().slice(0, 10))
    .in("student_id", studentIds);
  if (attendanceErr) {
    throw attendanceErr;
  }

  const completionByStudent = new Map<string, typeof completions>();
  for (const completion of completions ?? []) {
    const current = completionByStudent.get(completion.student_id as string) ?? [];
    current.push(completion);
    completionByStudent.set(completion.student_id as string, current);
  }

  const attendanceByStudent = new Map<string, number>();
  for (const row of attendance ?? []) {
    attendanceByStudent.set(row.student_id as string, (attendanceByStudent.get(row.student_id as string) ?? 0) + 1);
  }

  const generated: Array<{ fileName: string; base64: string }> = [];

  for (const student of students ?? []) {
    const studentCompletions = completionByStudent.get(student.id) ?? [];
    const pointsTotal = studentCompletions.reduce((sum, row) => sum + Number(row.points_awarded ?? 0), 0);
    const lessonTitles = studentCompletions
      .map((row) => {
        const lesson = Array.isArray(row.curriculum_lessons) ? row.curriculum_lessons[0] : row.curriculum_lessons;
        return (lesson as { title?: string } | null)?.title ?? null;
      })
      .filter((title): title is string => Boolean(title));
    const conceptTags = studentCompletions
      .map((row) => {
        const lesson = Array.isArray(row.curriculum_lessons) ? row.curriculum_lessons[0] : row.curriculum_lessons;
        return (lesson as { concept_tag?: string | null } | null)?.concept_tag ?? null;
      })
      .filter((tag): tag is string => Boolean(tag));

    const fileName = `${monthYear}_${slugName(student.full_name)}.pdf`;
    const pdfBytes = buildSimplePdf([
      "Ninja Dojo Monthly Progress Report",
      `Student: ${student.full_name}`,
      `Month: ${monthYear}`,
      `Attendance (present events): ${attendanceByStudent.get(student.id) ?? 0}`,
      `Lessons Completed: ${lessonTitles.length}`,
      `Points Earned: ${pointsTotal}`,
      "Concepts Learned:",
      conceptTags.length ? conceptTags.join(", ") : "N/A (concept tags not yet mapped)",
      "Lesson Titles:",
      lessonTitles.length ? lessonTitles.join(" | ") : "No lessons completed this month"
    ]);

    await supabase.from("monthly_reports").upsert(
      {
        student_id: student.id,
        month_year: monthYear,
        file_name: fileName
      },
      { onConflict: "student_id,month_year" }
    );

    generated.push({
      fileName,
      base64: Buffer.from(pdfBytes).toString("base64")
    });
  }

  return { monthYear, files: generated };
}
