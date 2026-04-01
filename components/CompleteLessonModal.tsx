"use client";

import { useState } from "react";
import type { StudentProgressSnapshot } from "@/lib/types";

type Props = {
  student: StudentProgressSnapshot;
  onClose: () => void;
  onCompleted: () => void;
};

export function CompleteLessonModal({ student, onClose, onCompleted }: Props) {
  const [rating, setRating] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ratingText = ["Very Low", "Low", "Medium", "High", "Very High"][rating - 1] ?? "Medium";

  async function submit() {
    if (!student.student_id) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/progress/complete-lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-key": process.env.NEXT_PUBLIC_KIOSK_SHARED_KEY ?? ""
        },
        body: JSON.stringify({
          studentId: student.student_id,
          independenceRating: rating
        })
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Submission failed");
      }
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-dashboard-theme modal-complete-lesson">
        <h2 className="modal-complete-title" style={{ fontSize: "2rem" }}>
          {student.curriculum.lesson_title ?? "Current lesson"}
        </h2>
        <p className="modal-complete-subtext" style={{ marginTop: 4, fontWeight: 700 }}>
          {student.full_name} - Completed Lesson Submission
        </p>
        <p className="modal-complete-points" style={{ marginTop: 2 }}>
          Lesson Points: +{student.curriculum.lesson_points_value ?? 0}
        </p>

        <div className="modal-slider-group">
          <p className="modal-rating-value">Independence Rating: {ratingText}</p>
          <input
            id="independence"
            className="modal-rating-slider"
            type="range"
            min={1}
            max={5}
            step={1}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            disabled={submitting}
          />
        </div>
        {error && <p className="modal-dashboard-error">{error}</p>}
        <div className="toolbar modal-actions-centered" style={{ marginTop: 16 }}>
          <button className="button" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button className="button ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
