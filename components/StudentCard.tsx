import type { StudentProgressSnapshot } from "@/lib/types";

export function StudentCard({ student, showActions, onComplete }: {
  student: StudentProgressSnapshot;
  showActions?: boolean;
  onComplete?: (student: StudentProgressSnapshot) => void;
}) {
  const total = Math.max(1, student.progress.total);
  const beforeWidth = (student.progress.completed_before_today / total) * 100;
  const todayWidth = (student.progress.completed_today / total) * 100;
  const remainingWidth = Math.max(0, 100 - beforeWidth - todayWidth);

  return (
    <article className="panel student-card">
      <div className="student-card__identity">
        <div className="student-card__name-wrap">
          <h3 className="student-card__name">{student.full_name}</h3>
          <p className="student-card__curriculum">
            {student.curriculum.belt_code
              ? `${student.curriculum.belt_code.toUpperCase()} • Level ${student.curriculum.level_number} • Lesson ${student.curriculum.lesson_number}`
              : "Curriculum not set"}
          </p>
          {student.curriculum.lesson_title && (
            <p className="student-card__lesson">{student.curriculum.lesson_title}</p>
          )}
        </div>
        <span className={`status-chip ${student.active_status}`}>
          {student.active_status === "active" ? "Live" : "Inactive"}
        </span>
      </div>

      <div className="student-card__progress">
        <div className="student-card__progress-header">
          <span>Level Progress</span>
          <span>
            {student.progress.completed_before_today + student.progress.completed_today}/{student.progress.total}
          </span>
        </div>
        <div className="progress-track">
          <div className="segment-before" style={{ width: `${beforeWidth}%` }} />
          <div className="segment-today" style={{ width: `${todayWidth}%` }} />
          <div className="segment-remaining" style={{ width: `${remainingWidth}%` }} />
        </div>
        <p className="student-card__breakdown">
          Before today: {student.progress.completed_before_today} | Today: {student.progress.completed_today} | Remaining:{" "}
          {student.progress.remaining}
        </p>
      </div>

      <div className="student-card__points-row">
        <div className="student-card__points">
          <div className="student-card__points-today">+{student.points.points_today} today</div>
          <div className="student-card__points-month">Month total: {student.points.points_month} points</div>
        </div>
        {showActions && onComplete && student.student_id && !student.requires_resolution && (
          <button className="button" onClick={() => onComplete(student)}>
            Mark Lesson Complete
          </button>
        )}
      </div>

      {student.requires_resolution && (
        <div className="student-card__warning">Profile setup required before updates</div>
      )}
    </article>
  );
}
