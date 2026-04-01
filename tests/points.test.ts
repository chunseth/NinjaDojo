import { describe, expect, it } from "vitest";
import { calculatePoints } from "@/lib/domain/points";

describe("calculatePoints", () => {
  it("applies integer bonuses and penalties by independence rating", () => {
    expect(calculatePoints(3, 1)).toBe(2);
    expect(calculatePoints(3, 2)).toBe(3);
    expect(calculatePoints(3, 3)).toBe(3);
    expect(calculatePoints(3, 4)).toBe(4);
    expect(calculatePoints(3, 5)).toBe(5);
  });

  it("uses larger penalties for rating 1 and 2 on high-point lessons", () => {
    expect(calculatePoints(7, 1)).toBe(5);
    expect(calculatePoints(7, 2)).toBe(6);
  });

  it("never awards fewer than 1 point", () => {
    expect(calculatePoints(1, 1)).toBe(1);
  });

  it("rejects invalid ratings", () => {
    expect(() => calculatePoints(10, 0)).toThrow();
    expect(() => calculatePoints(10, 6)).toThrow();
  });
});
