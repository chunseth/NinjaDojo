"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurriculumTree } from "@/lib/types";

type FormState = {
  beltId: string;
  levelCount: number;
  levelId: string;
  lessonNumber: number;
  lessonTitle: string;
  pointsValue: number;
  conceptTag: string;
};

const initialState: FormState = {
  beltId: "",
  levelCount: 1,
  levelId: "",
  lessonNumber: 1,
  lessonTitle: "",
  pointsValue: 10,
  conceptTag: ""
};

export default function CurriculumPage() {
  const [belts, setBelts] = useState<CurriculumTree[]>([]);
  const [state, setState] = useState<FormState>(initialState);
  const [message, setMessage] = useState<string>("");

  async function load() {
    const res = await fetch("/api/curriculum", { cache: "no-store" });
    const body = (await res.json()) as { belts: CurriculumTree[] };
    const loadedBelts = body.belts ?? [];
    setBelts(loadedBelts);
    if (loadedBelts[0] && !state.beltId) {
      const firstBelt = loadedBelts[0];
      setState((prev) => ({
        ...prev,
        beltId: firstBelt.id,
        levelId: firstBelt.levels[0]?.id ?? ""
      }));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedBelt = useMemo(() => belts.find((belt) => belt.id === state.beltId), [belts, state.beltId]);

  async function post(payload: unknown) {
    const response = await fetch("/api/curriculum", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-kiosk-key": process.env.NEXT_PUBLIC_KIOSK_SHARED_KEY ?? ""
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error ?? "Request failed");
    }
    await load();
  }

  async function addLevelsForBelt() {
    setMessage("");
    try {
      await post({
        action: "create_levels_for_belt",
        beltId: state.beltId,
        levelCount: state.levelCount
      });
      setMessage(`Updated levels 1-${state.levelCount} for selected belt.`);
      const reloaded = await fetch("/api/curriculum", { cache: "no-store" });
      const body = (await reloaded.json()) as { belts: CurriculumTree[] };
      const selected = (body.belts ?? []).find((belt) => belt.id === state.beltId);
      setState((prev) => ({ ...prev, levelId: selected?.levels[0]?.id ?? "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed");
    }
  }

  async function addLesson() {
    setMessage("");
    try {
      await post({
        action: "create_lesson",
        levelId: state.levelId,
        lessonNumber: state.lessonNumber,
        title: state.lessonTitle,
        pointsValue: state.pointsValue,
        conceptTag: state.conceptTag
      });
      setMessage("Lesson added.");
      setState((prev) => ({ ...prev, lessonTitle: "", conceptTag: "" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed");
    }
  }

  return (
    <main className="container grid curriculum-page">
      <section className="panel">
        <h1 className="curriculum-title">Curriculum Builder</h1>
        <p>Add levels and lessons manually.</p>
        {message && <p>{message}</p>}
      </section>

      <section className="panel grid">
        <h2 className="curriculum-section-title">Add Level</h2>
        <div className="row">
          <div>
            <label>Belt</label>
            <select
              className="select"
              value={state.beltId}
              onChange={(e) => {
                const beltId = e.target.value;
                const belt = belts.find((item) => item.id === beltId);
                setState((prev) => ({
                  ...prev,
                  beltId,
                  levelId: belt?.levels[0]?.id ?? ""
                }));
              }}
            >
              {belts.map((belt) => (
                <option key={belt.id} value={belt.id}>
                  {belt.belt_code.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Level Amount</label>
            <input
              className="input"
              type="range"
              min={1}
              max={30}
              value={state.levelCount}
              onChange={(e) => setState((prev) => ({ ...prev, levelCount: Number(e.target.value) }))}
            />
            <div className="level-count-label">Levels: {state.levelCount}</div>
          </div>
          <div className="row-end">
            <button className="button" onClick={addLevelsForBelt}>
              Add Level
            </button>
          </div>
        </div>
      </section>

      <section className="panel grid">
        <h2 className="curriculum-section-title">Add Lesson</h2>
        <div className="row">
          <div>
            <label>Level</label>
            <select
              className="select"
              value={state.levelId}
              onChange={(e) => setState((prev) => ({ ...prev, levelId: e.target.value }))}
            >
              {(selectedBelt?.levels ?? []).map((level) => (
                <option key={level.id} value={level.id}>
                  Level {level.level_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Lesson Number</label>
            <input
              className="input"
              type="number"
              min={1}
              value={state.lessonNumber}
              onChange={(e) => setState((prev) => ({ ...prev, lessonNumber: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label>Lesson Title</label>
            <input
              className="input"
              value={state.lessonTitle}
              onChange={(e) => setState((prev) => ({ ...prev, lessonTitle: e.target.value }))}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label>Points</label>
            <input
              className="input"
              type="number"
              min={1}
              value={state.pointsValue}
              onChange={(e) => setState((prev) => ({ ...prev, pointsValue: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div>
          <label>Concept Tag (optional)</label>
          <input
            className="input"
            value={state.conceptTag}
            onChange={(e) => setState((prev) => ({ ...prev, conceptTag: e.target.value }))}
          />
        </div>
        <button className="button" onClick={addLesson}>
          Add Lesson
        </button>
      </section>

      <section className="panel grid">
        <h2 className="curriculum-section-title">Curriculum Snapshot</h2>
        {belts.map((belt) => (
          <div key={belt.id} className="snapshot-belt">
            <strong>
              {belt.belt_code.toUpperCase()} (Belt-Up Points: {belt.belt_up_points})
            </strong>
            {belt.levels.map((level) => (
              <p key={level.id} className="snapshot-level">
                Level {level.level_number} ({level.title}) - {level.lessons.length} lessons
              </p>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
