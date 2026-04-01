export type BeltCode = "white" | "yellow" | "orange" | "green" | "blue";

export type SourceStatus = "active" | "inactive";

export type ActiveStudentEvent = {
  student_name: string;
  source_status: SourceStatus;
  observed_at: string;
  source_page_id: string;
  external_source: "sensei";
  idempotency_key: string;
};

export type CurriculumPointer = {
  belt_code: BeltCode | null;
  level_number: number | null;
  lesson_number: number | null;
  lesson_title: string | null;
  lesson_id: string | null;
  lesson_points_value: number | null;
};

export type LevelProgressSegments = {
  completed_before_today: number;
  completed_today: number;
  remaining: number;
  total: number;
};

export type PointsSummary = {
  points_today: number;
  points_month: number;
  monthly_progress: Array<{
    sign_in_at: string;
    sign_in_date: string;
    cumulative_points: number;
  }>;
};

export type StudentProgressSnapshot = {
  student_id: string | null;
  full_name: string;
  normalized_name: string;
  active_status: SourceStatus;
  requires_resolution: boolean;
  requires_curriculum_setup: boolean;
  duplicate_match: boolean;
  curriculum: CurriculumPointer;
  progress: LevelProgressSegments;
  points: PointsSummary;
  lessons_completed_today: number;
};

export type MonthlyReportRecord = {
  student_id: string;
  month_year: string;
  file_name: string;
  generated_at: string;
};

export type CurriculumTree = {
  id: string;
  belt_code: BeltCode;
  belt_order: number;
  belt_up_points: number;
  levels: Array<{
    id: string;
    level_number: number;
    title: string;
    lessons: Array<{
      id: string;
      lesson_number: number;
      title: string;
      points_value: number;
      concept_tag: string | null;
    }>;
  }>;
};
