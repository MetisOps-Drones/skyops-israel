"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  HOBBY_QUIZ_BANK,
  QUIZ_PASS_THRESHOLD,
  QUIZ_QUESTION_COUNT,
  drawRandomQuestions,
  type QuizQuestion,
} from "@/lib/constants/quiz-bank";
import { useRecordQuizAttempt } from "@/hooks/useLmsProgress";

type AnswerState = { questionId: string; selectedIndex: number; correct: boolean }[];

export function QuizSimulator() {
  // Drawn client-side only, after mount — picking randomly during the initial render would make
  // the server-rendered question differ from the client's own random draw and fail hydration
  // (this only started mattering once the hobby track lost its loading-gated paywall, which used
  // to accidentally keep this component from ever being part of the server-rendered HTML).
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  useEffect(() => {
    setQuestions(drawRandomQuestions(HOBBY_QUIZ_BANK, QUIZ_QUESTION_COUNT));
  }, []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>([]);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const recordAttempt = useRecordQuizAttempt("hobby_exam");

  const currentQuestion = questions?.[currentIndex];

  const correctCount = useMemo(() => answers.filter((a) => a.correct).length, [answers]);
  const scorePercent = questions && questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const passed = scorePercent >= QUIZ_PASS_THRESHOLD * 100;

  function selectAnswer(index: number) {
    if (selectedChoice !== null || !currentQuestion) return;
    setSelectedChoice(index);
    setAnswers((prev) => [
      ...prev,
      { questionId: currentQuestion.id, selectedIndex: index, correct: index === currentQuestion.correctIndex },
    ]);
  }

  function nextQuestion() {
    if (!questions || currentIndex + 1 >= questions.length) {
      setFinished(true);
      const finalCorrect = answers.filter((a) => a.correct).length;
      const finalScore = Math.round((finalCorrect / (questions?.length ?? 1)) * 100);
      recordAttempt.mutate({
        scorePercent: finalScore,
        correctCount: finalCorrect,
        totalCount: questions?.length ?? 0,
        passed: finalScore >= QUIZ_PASS_THRESHOLD * 100,
        takenAt: new Date().toISOString(),
      });
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedChoice(null);
  }

  function restart() {
    setQuestions(drawRandomQuestions(HOBBY_QUIZ_BANK, QUIZ_QUESTION_COUNT));
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedChoice(null);
    setFinished(false);
  }

  if (finished) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-full",
              passed ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}
          >
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold">{passed ? "עברת את המבחן!" : "לא עברת הפעם"}</h3>
            <p className="text-muted-foreground">
              {correctCount} מתוך {questions?.length ?? 0} תשובות נכונות ({scorePercent}%)
            </p>
            <p className="text-sm text-muted-foreground">ציון עובר: {QUIZ_PASS_THRESHOLD * 100}%</p>
          </div>
          <Button onClick={restart}>
            <RotateCcw />
            נסה שוב עם שאלות חדשות
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!questions || !currentQuestion) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>סימולציית בחינה — רישיון מטיסן</CardTitle>
          <Badge variant="outline">
            שאלה {currentIndex + 1} / {questions.length}
          </Badge>
        </div>
        <Progress value={((currentIndex + (selectedChoice !== null ? 1 : 0)) / questions.length) * 100} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-lg font-medium">{currentQuestion.question}</p>

        <div className="flex flex-col gap-2">
          {currentQuestion.choices.map((choice, index) => {
            const isSelected = selectedChoice === index;
            const isCorrect = index === currentQuestion.correctIndex;
            const showResult = selectedChoice !== null;

            return (
              <button
                key={index}
                onClick={() => selectAnswer(index)}
                disabled={showResult}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 text-start text-sm transition-colors",
                  !showResult && "hover:border-primary hover:bg-accent",
                  showResult && isCorrect && "border-success bg-success/10",
                  showResult && isSelected && !isCorrect && "border-destructive bg-destructive/10"
                )}
              >
                {choice}
                {showResult && isCorrect && <CheckCircle2 className="h-4 w-4 text-success" />}
                {showResult && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-destructive" />}
              </button>
            );
          })}
        </div>

        {selectedChoice !== null && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">הסבר:</p>
            <p className="text-muted-foreground">{currentQuestion.explanation}</p>
          </div>
        )}

        <Button onClick={nextQuestion} disabled={selectedChoice === null} className="self-end">
          {currentIndex + 1 >= questions.length ? "סיום המבחן" : "השאלה הבאה"}
        </Button>
      </CardContent>
    </Card>
  );
}
