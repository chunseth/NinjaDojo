export type OrderedLesson = {
  id: string;
  beltOrder: number;
  levelNumber: number;
  lessonNumber: number;
};

export function getNextLessonId(orderedLessons: OrderedLesson[], currentLessonId: string): string {
  const sorted = [...orderedLessons].sort((a, b) => {
    if (a.beltOrder !== b.beltOrder) {
      return a.beltOrder - b.beltOrder;
    }
    if (a.levelNumber !== b.levelNumber) {
      return a.levelNumber - b.levelNumber;
    }
    return a.lessonNumber - b.lessonNumber;
  });

  const idx = sorted.findIndex((lesson) => lesson.id === currentLessonId);
  if (idx === -1) {
    throw new Error("Current lesson not found in curriculum ordering");
  }

  return sorted[idx + 1]?.id ?? sorted[idx].id;
}

export function buildProgressSegments(total: number, completedBeforeToday: number, completedToday: number) {
  const cappedBefore = Math.max(0, Math.min(total, completedBeforeToday));
  const remainingAfterBefore = Math.max(0, total - cappedBefore);
  const cappedToday = Math.max(0, Math.min(remainingAfterBefore, completedToday));
  const remaining = Math.max(0, total - cappedBefore - cappedToday);

  return {
    completed_before_today: cappedBefore,
    completed_today: cappedToday,
    remaining,
    total
  };
}
