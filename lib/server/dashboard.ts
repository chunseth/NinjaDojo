import { chicagoMonthYearForDate, chicagoToday } from "@/lib/domain/date";
import {
  buildAbbreviatedNameKey,
  hasDuplicateMatch,
  isLikelyAbbreviatedFullName,
  requiresManualResolution,
  resolveStudentMatch,
  type StudentMatchCandidate
} from "@/lib/domain/matching";
import { buildProgressSegments } from "@/lib/domain/progression";
import { normalizeName } from "@/lib/domain/normalize";
import type { StudentProgressSnapshot } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/server/supabase";

type ActiveSessionRow = {
  student_name: string;
  normalized_name: string;
  source_status: "active" | "inactive";
  observed_at: string;
};

type StudentRow = {
  id: string;
  full_name: string;
  normalized_name: string;
  current_lesson_id: string | null;
  status: string;
};

type DailyProgressRow = {
  student_id: string;
  full_name: string;
  normalized_name: string;
  belt_code: string | null;
  level_number: number | null;
  current_lesson_number: number | null;
  current_lesson_title: string | null;
  points_today: number | null;
  lessons_completed_today: number | null;
  level_lesson_total: number | null;
  level_lessons_completed_before_today: number | null;
  level_lessons_completed_today: number | null;
};

type AttendanceRow = {
  student_id: string;
  attendance_date: string;
  created_at: string;
};

type CompletionRow = {
  student_id: string;
  points_awarded: number | null;
  completed_at: string;
};

function chicagoYearMonthParts(date: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "1970");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  return { year, month };
}

function currentChicagoMonthDateWindow(now: Date): { startDate: string; endDateExclusive: string } {
  const { year, month } = chicagoYearMonthParts(now);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDateExclusive: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
  };
}

function chicagoDateForIso(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(iso));

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function normalizeBeltCode(value: string | null | undefined): StudentProgressSnapshot["curriculum"]["belt_code"] {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "white" || normalized === "yellow" || normalized === "orange" || normalized === "green" || normalized === "blue") {
    return normalized;
  }
  return null;
}

function beltRank(beltCode: StudentProgressSnapshot["curriculum"]["belt_code"]): number {
  switch (beltCode) {
    case "white":
      return 1;
    case "yellow":
      return 2;
    case "orange":
      return 3;
    case "green":
      return 4;
    case "blue":
      return 5;
    default:
      return 0;
  }
}

export async function fetchTodayDashboard(): Promise<{
  snapshots: StudentProgressSnapshot[];
  unresolvedNames: string[];
  curriculumSetupStudents: Array<{ studentId: string; fullName: string }>;
}> {
  const supabase = getSupabaseServiceClient();
  const today = chicagoToday();
  const now = new Date();
  const monthYear = chicagoMonthYearForDate(now);
  const { startDate, endDateExclusive } = currentChicagoMonthDateWindow(now);

  const { data: activeRows, error: activeErr } = await supabase
    .from("active_sessions")
    .select("student_name, normalized_name, source_status, observed_at")
    .gte("observed_at", `${today}T00:00:00-06:00`)
    .order("observed_at", { ascending: false });

  if (activeErr) {
    throw activeErr;
  }

  const activeRowsForToday = ((activeRows ?? []) as ActiveSessionRow[]).filter(
    (row) => chicagoDateForIso(row.observed_at) === today
  );
  const namesWithActiveToday = new Set(
    activeRowsForToday.filter((row) => row.source_status === "active").map((row) => row.normalized_name)
  );

  const latestByName = new Map<string, ActiveSessionRow>();
  for (const row of activeRowsForToday) {
    if (row.source_status === "inactive" && !namesWithActiveToday.has(row.normalized_name)) {
      continue;
    }
    if (!latestByName.has(row.normalized_name)) {
      latestByName.set(row.normalized_name, row);
    }
  }

  const normalizedNames = Array.from(latestByName.keys());
  if (normalizedNames.length === 0) {
    return { snapshots: [], unresolvedNames: [], curriculumSetupStudents: [] };
  }

  const { data: students, error: studentsErr } = await supabase
    .from("students")
    .select("id, full_name, normalized_name, current_lesson_id, status");
  if (studentsErr) {
    throw studentsErr;
  }

  const exactMap = new Map<string, StudentMatchCandidate[]>();
  const abbreviatedMap = new Map<string, StudentMatchCandidate[]>();
  const studentById = new Map<string, StudentRow>();
  for (const student of (students ?? []) as StudentRow[]) {
    studentById.set(student.id, student);

    const key = normalizeName(student.normalized_name);
    const exactList = exactMap.get(key) ?? [];
    exactList.push({
      id: student.id,
      full_name: student.full_name,
      normalized_name: student.normalized_name
    });
    exactMap.set(key, exactList);

    const abbreviatedKey = buildAbbreviatedNameKey(student.full_name);
    if (abbreviatedKey && !isLikelyAbbreviatedFullName(student.full_name)) {
      const abbreviatedList = abbreviatedMap.get(abbreviatedKey) ?? [];
      abbreviatedList.push({
        id: student.id,
        full_name: student.full_name,
        normalized_name: student.normalized_name
      });
      abbreviatedMap.set(abbreviatedKey, abbreviatedList);
    }
  }

  const selectedByNormalizedName = new Map<string, StudentRow | null>();
  const matchCountByNormalizedName = new Map<string, number>();
  const resolvedStudentIds = new Set<string>();

  for (const [normalizedName, active] of latestByName.entries()) {
    const resolution = resolveStudentMatch({
      activeNormalizedName: normalizedName,
      activeRawName: active.student_name,
      exactByNormalized: exactMap,
      byAbbreviatedKey: abbreviatedMap
    });

    const selected = resolution.selected ? studentById.get(resolution.selected.id) ?? null : null;

    selectedByNormalizedName.set(normalizedName, selected);
    matchCountByNormalizedName.set(normalizedName, resolution.matchCount);
    if (selected?.id) {
      resolvedStudentIds.add(selected.id);
    }
  }

  const uniqueStudentIds = Array.from(resolvedStudentIds);
  const resolvedLessonIds = Array.from(
    new Set(
      Array.from(selectedByNormalizedName.values())
        .map((student) => student?.current_lesson_id)
        .filter((lessonId): lessonId is string => Boolean(lessonId))
    )
  );

  const { data: dailyRows, error: dailyErr } = uniqueStudentIds.length
    ? await supabase.from("student_daily_progress").select("*").in("student_id", uniqueStudentIds)
    : { data: [], error: null };
  if (dailyErr) {
    throw dailyErr;
  }

  const { data: monthlyRows, error: monthErr } = uniqueStudentIds.length
    ? await supabase
        .from("student_monthly_points")
        .select("student_id, points_total")
        .eq("month_year", monthYear)
        .in("student_id", uniqueStudentIds)
    : { data: [], error: null };
  if (monthErr) {
    throw monthErr;
  }

  const { data: lessonRows, error: lessonErr } = resolvedLessonIds.length
    ? await supabase.from("curriculum_lessons").select("id, points_value").in("id", resolvedLessonIds)
    : { data: [], error: null };
  if (lessonErr) {
    throw lessonErr;
  }

  const { data: attendanceRows, error: attendanceErr } = uniqueStudentIds.length
    ? await supabase
        .from("attendance_events")
        .select("student_id, attendance_date, created_at")
        .in("student_id", uniqueStudentIds)
        .gte("attendance_date", startDate)
        .lt("attendance_date", endDateExclusive)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (attendanceErr) {
    throw attendanceErr;
  }

  const { data: completionRows, error: completionErr } = uniqueStudentIds.length
    ? await supabase
        .from("lesson_completions")
        .select("student_id, points_awarded, completed_at")
        .in("student_id", uniqueStudentIds)
    : { data: [], error: null };
  if (completionErr) {
    throw completionErr;
  }

  const dailyMap = new Map<string, DailyProgressRow>();
  for (const row of (dailyRows ?? []) as DailyProgressRow[]) {
    dailyMap.set(row.student_id, row);
  }
  const monthMap = new Map<string, number>();
  for (const row of monthlyRows ?? []) {
    monthMap.set(row.student_id as string, Number(row.points_total ?? 0));
  }
  const lessonPointsMap = new Map<string, number>();
  for (const row of lessonRows ?? []) {
    lessonPointsMap.set(row.id as string, Number(row.points_value ?? 0));
  }

  const pointsByStudentDate = new Map<string, Map<string, number>>();
  for (const row of (completionRows ?? []) as CompletionRow[]) {
    if (chicagoMonthYearForDate(new Date(row.completed_at)) !== monthYear) {
      continue;
    }

    const pointsDate = chicagoDateForIso(row.completed_at);
    const studentDateMap = pointsByStudentDate.get(row.student_id) ?? new Map<string, number>();
    studentDateMap.set(pointsDate, (studentDateMap.get(pointsDate) ?? 0) + Number(row.points_awarded ?? 0));
    pointsByStudentDate.set(row.student_id, studentDateMap);
  }

  const attendanceByStudent = new Map<string, AttendanceRow[]>();
  for (const row of (attendanceRows ?? []) as AttendanceRow[]) {
    const rows = attendanceByStudent.get(row.student_id) ?? [];
    rows.push(row);
    attendanceByStudent.set(row.student_id, rows);
  }

  const unresolvedNames: string[] = [];
  const curriculumSetupStudents: Array<{ studentId: string; fullName: string }> = [];
  const snapshots: StudentProgressSnapshot[] = [];

  for (const [normalizedName, active] of latestByName.entries()) {
    const matchCount = matchCountByNormalizedName.get(normalizedName) ?? 0;
    const duplicate = hasDuplicateMatch(matchCount);
    const manualResolutionRequired = requiresManualResolution(matchCount);
    if (manualResolutionRequired) {
      unresolvedNames.push(active.student_name);
    }

    const selected = selectedByNormalizedName.get(normalizedName) ?? null;
    const curriculumSetupRequired = !manualResolutionRequired && Boolean(selected?.id && !selected.current_lesson_id);
    if (curriculumSetupRequired && selected?.id) {
      curriculumSetupStudents.push({ studentId: selected.id, fullName: selected.full_name });
    }

    const progress = selected ? dailyMap.get(selected.id) : null;

    const total = Number(progress?.level_lesson_total ?? 0);
    const currentLessonNumber = Number(progress?.current_lesson_number ?? 0);
    const completedByLessonPosition = Math.max(0, Math.min(total, currentLessonNumber > 0 ? currentLessonNumber - 1 : 0));
    const rawCompletedToday = Number(progress?.level_lessons_completed_today ?? 0);
    const completedToday = Math.max(0, Math.min(completedByLessonPosition, rawCompletedToday));
    const completedBefore = Math.max(0, completedByLessonPosition - completedToday);
    const segments = buildProgressSegments(total, completedBefore, completedToday);

    snapshots.push({
      student_id: selected?.id ?? null,
      full_name: selected?.full_name ?? active.student_name,
      normalized_name: normalizedName,
      active_status: active.source_status,
      requires_resolution: manualResolutionRequired,
      requires_curriculum_setup: curriculumSetupRequired,
      duplicate_match: duplicate,
      curriculum: {
        belt_code: normalizeBeltCode(progress?.belt_code),
        level_number: progress?.level_number ?? null,
        lesson_number: progress?.current_lesson_number ?? null,
        lesson_title: progress?.current_lesson_title ?? null,
        lesson_id: selected?.current_lesson_id ?? null,
        lesson_points_value: selected?.current_lesson_id ? Number(lessonPointsMap.get(selected.current_lesson_id) ?? 0) : null
      },
      progress: {
        completed_before_today: segments.completed_before_today,
        completed_today: segments.completed_today,
        remaining: segments.remaining,
        total: segments.total
      },
      points: {
        points_today: Number(progress?.points_today ?? 0),
        points_month: selected ? Number(monthMap.get(selected.id) ?? 0) : 0,
        monthly_progress: selected
          ? (() => {
              const signIns = attendanceByStudent.get(selected.id) ?? [];
              const pointsByDate = pointsByStudentDate.get(selected.id) ?? new Map<string, number>();
              let runningPoints = 0;

              return signIns.map((signIn) => {
                runningPoints += Number(pointsByDate.get(signIn.attendance_date) ?? 0);
                return {
                  sign_in_at: signIn.created_at,
                  sign_in_date: signIn.attendance_date,
                  cumulative_points: runningPoints
                };
              });
            })()
          : []
      },
      lessons_completed_today: Number(progress?.lessons_completed_today ?? 0)
    });
  }

  snapshots.sort((a, b) => {
    if (a.active_status !== b.active_status) {
      return a.active_status === "active" ? -1 : 1;
    }

    const beltDelta = beltRank(b.curriculum.belt_code) - beltRank(a.curriculum.belt_code);
    if (beltDelta !== 0) {
      return beltDelta;
    }

    const levelDelta = Number(b.curriculum.level_number ?? 0) - Number(a.curriculum.level_number ?? 0);
    if (levelDelta !== 0) {
      return levelDelta;
    }

    const lessonDelta = Number(b.curriculum.lesson_number ?? 0) - Number(a.curriculum.lesson_number ?? 0);
    if (lessonDelta !== 0) {
      return lessonDelta;
    }

    return a.full_name.localeCompare(b.full_name);
  });
  return {
    snapshots,
    unresolvedNames: Array.from(new Set(unresolvedNames)),
    curriculumSetupStudents: Array.from(
      new Map(curriculumSetupStudents.map((student) => [student.studentId, student])).values()
    )
  };
}
