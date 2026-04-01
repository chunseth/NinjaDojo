"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CurriculumTree, StudentProgressSnapshot } from "@/lib/types";

type TodayPayload = {
  snapshots: StudentProgressSnapshot[];
  unresolvedNames: string[];
  curriculumSetupStudents: Array<{ studentId: string; fullName: string }>;
};

export function useDashboardData() {
  const [snapshots, setSnapshots] = useState<StudentProgressSnapshot[]>([]);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [selected, setSelected] = useState<StudentProgressSnapshot | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumTree[]>([]);
  const [curriculumSetupStudents, setCurriculumSetupStudents] = useState<Array<{ studentId: string; fullName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("-");

  const refresh = useCallback(async () => {
    const [todayRes, curriculumRes] = await Promise.all([
      fetch("/api/dashboard/today", { cache: "no-store" }),
      fetch("/api/curriculum", { cache: "no-store" })
    ]);

    const todayBody = (await todayRes.json()) as TodayPayload;
    const curriculumBody = (await curriculumRes.json()) as { belts: CurriculumTree[] };

    setSnapshots(todayBody.snapshots ?? []);
    setUnresolved(todayBody.unresolvedNames ?? []);
    setCurriculumSetupStudents(todayBody.curriculumSetupStudents ?? []);
    setCurriculum(curriculumBody.belts ?? []);
    setUpdatedAt(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, 20000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("tv-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_sessions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "lesson_completions" }, refresh)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const existingStudents = useMemo(
    () =>
      snapshots
        .filter((snapshot) => snapshot.student_id && !snapshot.requires_resolution)
        .map((snapshot) => ({ id: snapshot.student_id as string, full_name: snapshot.full_name })),
    [snapshots]
  );

  return {
    snapshots,
    unresolved,
    selected,
    curriculum,
    curriculumSetupStudents,
    loading,
    updatedAt,
    existingStudents,
    setSelected,
    refresh
  };
}
