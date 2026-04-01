export function calculatePoints(pointsValue: number, independenceRating: number): number {
  if (pointsValue <= 0) {
    throw new Error("pointsValue must be positive");
  }
  if (independenceRating < 1 || independenceRating > 5) {
    throw new Error("independenceRating must be between 1 and 5");
  }

  let bonus = 0;
  if (independenceRating === 1) {
    bonus = pointsValue >= 7 ? -2 : -1;
  } else if (independenceRating === 2) {
    bonus = pointsValue >= 7 ? -1 : 0;
  } else if (independenceRating === 4) {
    bonus = 1;
  } else if (independenceRating === 5) {
    bonus = 2;
  }

  return Math.max(1, pointsValue + bonus);
}
