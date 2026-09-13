"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { LmsCourseId, Tables } from "@/lib/types/database.types";

export function useLmsProgress(courseId: LmsCourseId) {
  return useQuery({
    queryKey: ["lms_progress", courseId],
    queryFn: async (): Promise<Tables<"lms_progress"> | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("lms_progress")
        .select("*")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export interface QuizAttemptResult {
  scorePercent: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  takenAt: string;
}

export function useRecordQuizAttempt(courseId: LmsCourseId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attempt: QuizAttemptResult) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("lms_progress")
        .select("quiz_scores, passed_mock_exam")
        .eq("user_id", user.id)
        .eq("course_id", courseId)
        .maybeSingle();

      const previousScores = Array.isArray(existing?.quiz_scores) ? existing.quiz_scores : [];
      const nextScores = [...previousScores, attempt].slice(-20);
      const passedMockExam = Boolean(existing?.passed_mock_exam) || attempt.passed;

      const { data, error } = await supabase
        .from("lms_progress")
        .upsert(
          {
            user_id: user.id,
            course_id: courseId,
            quiz_scores: nextScores as never,
            passed_mock_exam: passedMockExam,
            last_activity_at: new Date().toISOString(),
          },
          { onConflict: "user_id,course_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lms_progress", courseId] });
    },
  });
}
