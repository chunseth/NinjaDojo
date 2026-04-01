"use client";

import { useMemo, useState } from "react";
import type { CurriculumTree } from "@/lib/types";

type Props = {
  studentId: string;
  fullName: string;
  curriculum: CurriculumTree[];
  onResolved: () => void;
};

export function CurriculumSetupModal({ studentId, fullName, curriculum, onResolved }: Props) {
  const [beltCode, setBeltCode] = useState(curriculum[0]?.belt_code ?? "white");
  const [levelNumber, setLevelNumber] = useState(1);
  const [lessonNumber, setLessonNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedBelt = useMemo(
    () => curriculum.find((belt) => belt.belt_code === beltCode) ?? curriculum[0],
    [curriculum, beltCode]
  );
  const levelOptions = selectedBelt?.levels ?? [];
  const selectedLevel = levelOptions.find((level) => level.level_number === levelNumber) ?? levelOptions[0];
  const lessonOptions = selectedLevel?.lessons ?? [];

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/students/set-curriculum", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-key": process.env.NEXT_PUBLIC_KIOSK_SHARED_KEY ?? ""
        },
        body: JSON.stringify({
          studentId,
          beltCode,
          levelNumber,
          lessonNumber
        })
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Curriculum setup failed");
      }
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Curriculum setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-dashboard-theme">
        <h2 style={{ fontSize: "2rem" }}>{fullName}</h2>
        <p>
          Curriculum is not assigned yet. Set starting lesson before continuing.
        </p>

        <div style={{ marginTop: 12 }} className="grid">
          <div className="row">
            <div>
              <select
                id="curriculum-belt"
                className="select"
                value={beltCode}
                onChange={(e) => setBeltCode(e.target.value as typeof beltCode)}
              >
                {curriculum.map((belt) => (
                  <option key={belt.id} value={belt.belt_code}>
                    {belt.belt_code.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                id="curriculum-level"
                className="select"
                value={levelNumber}
                onChange={(e) => setLevelNumber(Number(e.target.value))}
              >
                {levelOptions.map((level) => (
                  <option key={level.id} value={level.level_number}>
                    Level {level.level_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <select
              id="curriculum-lesson"
              className="select"
              value={lessonNumber}
              onChange={(e) => setLessonNumber(Number(e.target.value))}
            >
              {lessonOptions.map((lesson) => (
                <option key={lesson.id} value={lesson.lesson_number}>
                  Lesson {lesson.lesson_number}: {lesson.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="modal-dashboard-error">{error}</p>}

        <div style={{ marginTop: 14 }}>
          <button className="button" onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : "Save Curriculum"}
          </button>
        </div>
      </div>
    </div>
  );
}
