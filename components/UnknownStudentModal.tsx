"use client";

import { useMemo, useState } from "react";
import type { CurriculumTree } from "@/lib/types";

type Props = {
  name: string;
  curriculum: CurriculumTree[];
  existingStudents: Array<{ id: string; full_name: string }>;
  onResolved: () => void;
};

export function UnknownStudentModal({ name, curriculum, existingStudents, onResolved }: Props) {
  const [mode, setMode] = useState<"create" | "link">("create");
  const [beltCode, setBeltCode] = useState(curriculum[0]?.belt_code ?? "white");
  const [levelNumber, setLevelNumber] = useState(1);
  const [lessonNumber, setLessonNumber] = useState(1);
  const [existingStudentId, setExistingStudentId] = useState(existingStudents[0]?.id ?? "");
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
      const response = await fetch("/api/students/resolve-unknown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-key": process.env.NEXT_PUBLIC_KIOSK_SHARED_KEY ?? ""
        },
        body: JSON.stringify({
          incomingName: name,
          mode,
          ...(mode === "link"
            ? { existingStudentId }
            : {
                beltCode,
                levelNumber,
                lessonNumber
              })
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Resolve failed");
      }
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 style={{ fontSize: "2rem" }}>Student Setup Required</h2>
        <p>
          New detected student: <strong>{name}</strong>. You must resolve this before continuing.
        </p>
        <div className="toolbar" style={{ marginTop: 10 }}>
          <button className={`button ${mode === "create" ? "" : "ghost"}`} onClick={() => setMode("create")}>
            Create New
          </button>
          <button className={`button ${mode === "link" ? "" : "ghost"}`} onClick={() => setMode("link")}>
            Link Existing
          </button>
        </div>

        {mode === "link" ? (
          <div style={{ marginTop: 12 }}>
            <label htmlFor="existing-student">Choose existing student</label>
            <select
              id="existing-student"
              className="select"
              value={existingStudentId}
              onChange={(e) => setExistingStudentId(e.target.value)}
            >
              {existingStudents.map((student) => (
                <option value={student.id} key={student.id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div style={{ marginTop: 12 }} className="grid">
            <div className="row">
              <div>
                <label htmlFor="belt">Belt</label>
                <select
                  id="belt"
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
                <label htmlFor="level">Level</label>
                <select
                  id="level"
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
              <label htmlFor="lesson">Lesson</label>
              <select
                id="lesson"
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
        )}

        {error && <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>}

        <div style={{ marginTop: 14 }}>
          <button className="button" onClick={submit} disabled={submitting}>
            {submitting ? "Saving..." : "Submit Resolution"}
          </button>
        </div>
      </div>
    </div>
  );
}
