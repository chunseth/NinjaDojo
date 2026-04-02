"use client";

import { useState } from "react";
import { CompleteLessonModal } from "@/components/CompleteLessonModal";
import { CurriculumSetupModal } from "@/components/CurriculumSetupModal";
import { UnknownStudentModal } from "@/components/UnknownStudentModal";
import { AutoFitText } from "@/components/AutoFitText";
import { useDashboardData } from "@/lib/hooks/useDashboardData";
import type { StudentProgressSnapshot } from "@/lib/types";

function beltLogoPath(beltCode: string | null): string {
  const normalized = (beltCode ?? "").toLowerCase();
  switch (normalized) {
    case "white":
      return "/Images/white.svg";
    case "yellow":
      return "/Images/yellow.svg";
    case "orange":
      return "/Images/orange.svg";
    case "green":
      return "/Images/green.svg";
    case "blue":
      return "/Images/blue.svg";
    default:
      return "/Images/white.svg";
  }
}

function normalizedBeltClass(beltCode: string | null): string {
  const normalized = (beltCode ?? "").toLowerCase();
  if (normalized === "white" || normalized === "yellow" || normalized === "orange" || normalized === "green" || normalized === "blue") {
    return normalized;
  }
  return "white";
}

function beltTextColor(beltCode: string | null): string {
  const normalized = (beltCode ?? "").toLowerCase();
  switch (normalized) {
    case "yellow":
      return "#E7D400";
    case "orange":
      return "#D65007";
    case "green":
      return "#049E06";
    case "blue":
      return "#618FE5";
    case "white":
    default:
      return "#D0D0D0";
  }
}

function beltPointColor(beltCode: string | null): string {
  const normalized = (beltCode ?? "").toLowerCase();
  switch (normalized) {
    case "yellow":
      return "#E7D400";
    case "orange":
      return "#D65007";
    case "green":
      return "#049E06";
    case "blue":
      return "#618FE5";
    case "white":
    default:
      return "#D0D0D0";
  }
}

function progressPercents(student: StudentProgressSnapshot): {
  before: number;
  today: number;
  remaining: number;
} {
  const total = Math.max(1, student.progress.total);
  const shouldShowCarryoverComplete = student.curriculum.lesson_number === 1;
  const before = shouldShowCarryoverComplete ? 100 : (student.progress.completed_before_today / total) * 100;
  const today = shouldShowCarryoverComplete ? 0 : (student.progress.completed_today / total) * 100;
  const remaining = Math.max(0, 100 - before - today);
  return { before, today, remaining };
}

function formatAxisTick(value: number): string {
  return String(Math.round(value));
}

function formatSessionDateTick(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric" }).format(parsed);
}

function curriculumStatus(student: StudentProgressSnapshot): string {
  const level = student.curriculum.level_number;
  const lessonNumber = student.curriculum.lesson_number;
  const totalLessons = student.progress.total > 0 ? student.progress.total : null;
  if (!level || !lessonNumber || !totalLessons) {
    return "Level - | Lesson -/-";
  }

  return `Level ${level} | Lesson ${lessonNumber}/${totalLessons}`;
}

export function SenseiDashboard() {
  const {
    snapshots,
    unresolved,
    selected,
    curriculum,
    curriculumSetupStudents,
    loading,
    existingStudents,
    setSelected,
    refresh
  } = useDashboardData();
  const [pointsModalStudent, setPointsModalStudent] = useState<StudentProgressSnapshot | null>(null);
  const monthTitle = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date());
  const interactive = true;

  function canOpenActions(student: typeof snapshots[number]) {
    return interactive && Boolean(student.student_id && !student.requires_resolution && !student.requires_curriculum_setup);
  }

  return (
    <main className="container grid dojo-dashboard dojo-dashboard-sensei">
      <section className="panel dashboard-hero">
        <h1 className="dashboard-title dashboard-title-centered">Dojo Dashboard</h1>
      </section>

      {loading ? (
        <section className="panel roster-panel loading-panel">
          <p className="loading-text">Loading students...</p>
        </section>
      ) : (
        <section className="panel roster-panel">
          <div className="roster-list">
          {snapshots.map((student) => {
            const progress = progressPercents(student);
            return (
            <article className="roster-row" key={`${student.normalized_name}:${student.student_id ?? "unknown"}`}>
              <button
                className="roster-touch roster-name"
                onClick={() => {
                  if (canOpenActions(student)) {
                    setSelected(student);
                  }
                }}
              >
                <img
                  className="roster-belt-logo"
                  src={beltLogoPath(student.curriculum.belt_code)}
                  alt={`${student.curriculum.belt_code ?? "unassigned"} belt ninja`}
                />
                <AutoFitText
                  className={`roster-full-name-main ${student.active_status === "active" ? "is-active" : "is-inactive"}`}
                  text={student.full_name}
                  minFontPx={9}
                />
              </button>

              <button
                className="roster-touch roster-curriculum"
                style={{ color: beltTextColor(student.curriculum.belt_code) }}
                onClick={() => {
                  if (canOpenActions(student)) {
                    setSelected(student);
                  }
                }}
              >
                {curriculumStatus(student)}
              </button>

              <button
                className="roster-touch roster-points"
                onClick={() => {
                  if (student.student_id) {
                    setPointsModalStudent(student);
                  }
                }}
              >
                +{student.points.points_today} Points
              </button>

              <button
                className="roster-touch roster-progress roster-progress-full"
                onClick={() => {
                  if (canOpenActions(student)) {
                    setSelected(student);
                  }
                }}
              >
                <div className={`progress-track belt-${normalizedBeltClass(student.curriculum.belt_code)}`}>
                  <div
                    className="segment-before"
                    style={{
                      width: `${progress.before}%`
                    }}
                  />
                  <div
                    className="segment-today"
                    style={{
                      width: `${progress.today}%`
                    }}
                  />
                  <div
                    className="segment-remaining"
                    style={{
                      width: `${progress.remaining}%`
                    }}
                  />
                </div>
              </button>

              {student.requires_resolution && <p className="roster-warning">Profile setup required before updates</p>}
              {student.requires_curriculum_setup && (
                <p className="roster-warning">Curriculum setup required before updates</p>
              )}
            </article>
            );
          })}
          </div>
        </section>
      )}

      {interactive && selected && (
        <CompleteLessonModal
          student={selected}
          onClose={() => setSelected(null)}
          onCompleted={() => {
            void refresh();
          }}
        />
      )}

      {pointsModalStudent && (
        <div className="modal-overlay">
          <div className="modal modal-dashboard-theme modal-points-chart">
            {(() => {
              const chartWidth = 580;
              const chartHeight = 200;
              const chartPoints = pointsModalStudent.points.monthly_progress;
              const earnedPoints = Math.max(
                pointsModalStudent.points.points_month,
                ...chartPoints.map((point) => point.cumulative_points),
                0
              );
              const defaultZeroPointsView = earnedPoints <= 0;
              const earnedStep = defaultZeroPointsView ? 1 : earnedPoints / 4;
              const yTicks = defaultZeroPointsView
                ? [1, 2, 3, 4, 5]
                : [1, 2, 3, 4, 5].map((multiplier) => earnedStep * multiplier);
              const chartMax = yTicks[yTicks.length - 1] ?? 5;
              const chartSeries = [
                { cumulative_points: 0, sign_in_date: "0", isOrigin: true },
                ...chartPoints.map((point) => ({ ...point, isOrigin: false }))
              ];
              const stepX = chartSeries.length > 1 ? chartWidth / (chartSeries.length - 1) : 0;
              const markerPoints = chartSeries.map((point, index) => {
                const x = chartSeries.length > 1 ? index * stepX : 0;
                const y = chartHeight - (point.cumulative_points / chartMax) * chartHeight;
                return {
                  x: x + 40,
                  y: Math.max(20, y + 20),
                  date: point.sign_in_date,
                  isOrigin: point.isOrigin
                };
              });
              const polylinePoints = markerPoints
                .map((point) => {
                  return `${point.x},${point.y}`;
                })
                .join(" ");

              return (
                <>
            <h2 className="modal-points-title" style={{ fontSize: "2rem" }}>
              {pointsModalStudent.full_name} - {monthTitle}
            </h2>
            <p className="modal-points-subtext">+{pointsModalStudent.points.points_month} Points</p>
            <svg
              className="modal-points-chart-svg"
              viewBox="0 0 640 260"
              role="img"
              aria-label={`Monthly point chart for ${pointsModalStudent.full_name}`}
            >
              <line x1="40" y1="220" x2="620" y2="220" className="modal-points-axis" />
              <line x1="40" y1="20" x2="40" y2="220" className="modal-points-axis" />
              {yTicks.map((pointValue, index) => {
                const y = 220 - (pointValue / chartMax) * 200;
                return (
                  <g key={`tick-${index}`}>
                    <line x1="34" y1={y} x2="40" y2={y} className="modal-points-axis-tick" />
                    <text x="30" y={y + 4} className="modal-points-axis-label">
                      {formatAxisTick(pointValue)}
                    </text>
                  </g>
                );
              })}
              <polyline
                className="modal-points-line"
                fill="none"
                points={polylinePoints}
                style={{ stroke: beltPointColor(pointsModalStudent.curriculum.belt_code) }}
              />
              {markerPoints.map((point, index) => (
                <line
                  key={`y-guide-${index}`}
                  x1="40"
                  y1={point.y}
                  x2={point.x}
                  y2={point.y}
                  className="modal-points-guide-line"
                />
              ))}
              {markerPoints.map((point, index) => (
                <circle
                  key={`point-${index}`}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  className="modal-points-marker"
                  style={{ fill: beltPointColor(pointsModalStudent.curriculum.belt_code) }}
                />
              ))}
              {markerPoints.map((point, index) => (
                <g key={`x-tick-${index}`}>
                  <line x1={point.x} y1="220" x2={point.x} y2="226" className="modal-points-axis-tick" />
                  <text x={point.x} y="240" className="modal-points-x-axis-label">
                    {point.isOrigin ? "0" : formatSessionDateTick(point.date)}
                  </text>
                </g>
              ))}
            </svg>
            <div className="toolbar modal-actions-centered" style={{ marginTop: 16 }}>
              <button className="button ghost" onClick={() => setPointsModalStudent(null)}>
                Close
              </button>
            </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {interactive && unresolved.length > 0 && curriculum.length > 0 && (
        <UnknownStudentModal
          name={unresolved[0]}
          curriculum={curriculum}
          existingStudents={existingStudents}
          onResolved={() => {
            void refresh();
          }}
        />
      )}

      {interactive && unresolved.length === 0 && curriculumSetupStudents.length > 0 && curriculum.length > 0 && (
        <CurriculumSetupModal
          studentId={curriculumSetupStudents[0].studentId}
          fullName={curriculumSetupStudents[0].fullName}
          curriculum={curriculum}
          onResolved={() => {
            void refresh();
          }}
        />
      )}
    </main>
  );
}
