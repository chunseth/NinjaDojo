import { describe, expect, it } from "vitest";
import { buildProgressSegments, getNextLessonId } from "@/lib/domain/progression";

describe("getNextLessonId", () => {
  const ordered = [
    { id: "w1l1", beltOrder: 1, levelNumber: 1, lessonNumber: 1 },
    { id: "w1l2", beltOrder: 1, levelNumber: 1, lessonNumber: 2 },
    { id: "w2l1", beltOrder: 1, levelNumber: 2, lessonNumber: 1 },
    { id: "y1l1", beltOrder: 2, levelNumber: 1, lessonNumber: 1 }
  ];

  it("moves to next lesson in level", () => {
    expect(getNextLessonId(ordered, "w1l1")).toBe("w1l2");
  });

  it("moves to first lesson of next level", () => {
    expect(getNextLessonId(ordered, "w1l2")).toBe("w2l1");
  });

  it("moves to first lesson of next belt", () => {
    expect(getNextLessonId(ordered, "w2l1")).toBe("y1l1");
  });

  it("stays at terminal lesson", () => {
    expect(getNextLessonId(ordered, "y1l1")).toBe("y1l1");
  });
});

describe("buildProgressSegments", () => {
  it("returns before/today/remaining", () => {
    expect(buildProgressSegments(10, 6, 2)).toEqual({
      completed_before_today: 6,
      completed_today: 2,
      remaining: 2,
      total: 10
    });
  });

  it("caps overflow", () => {
    expect(buildProgressSegments(4, 10, 5)).toEqual({
      completed_before_today: 4,
      completed_today: 0,
      remaining: 0,
      total: 4
    });
  });
});
