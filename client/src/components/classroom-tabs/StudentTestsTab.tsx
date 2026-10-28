import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ClipboardList, Calendar, Loader2, Eye, Trophy, Lock, ShieldAlert, Clock } from "lucide-react";
import {
  useClassroomStore, classroomActions, formatDuration,
  getExamType, formatTime, type Quiz, type Question
} from "@/lib/classroomStore";
import {
  getQuizAttemptResult, saveQuizAnswersBulk, startQuizAttempt,
  submitQuizAttempt, getClassroomById, api
} from "@/lib/api";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { QuizQuestionReviewTabs } from "@/components/quiz/QuizQuestionReviewTabs";
import { toast } from "sonner";
import { TabSkeletonLoader, fmtDate } from "./shared";
type QuizPhase = "list" | "intro" | "taking" | "result";

type QuizResultReview = {
  score: { rawMarks: number; totalMarks: number; percentage: number; passed: boolean };
  answers: Array<{
    questionId: string;
    selectedOptions: string[];
    isCorrect: boolean;
    marksAwarded: number;
    questionText: string;
    explanation?: string;
    correctOptions: string[];
    isAttempted?: boolean;
    options?: Array<{ label: string; text: string; isCorrect?: boolean }>;
  }>;
};
function TestsTab({
  classroomId,
  isFetching,
  initialQuizId,
  initialAction,
  initialAttemptId,
}: {
  classroomId: string;
  isFetching?: boolean;
  initialQuizId?: string | null;
  initialAction?: "start" | "result" | null;
  initialAttemptId?: string | null;
}) {
  const { classrooms, currentUser } = useClassroomStore();
  const CURRENT_STUDENT = { id: currentUser?.id || "", name: currentUser?.name || "" };
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);

  const quizzes = (cls?.quizzes || []).filter(q => q.status === "published");

  if (isFetching && quizzes.length === 0) {
    return <TabSkeletonLoader type="rows" />;
  }

  if (!cls) return null;

  const [phase, setPhase] = useState<QuizPhase>("list");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResultReview | null>(null);
  const [resultViewTab, setResultViewTab] = useState<"review" | "leaderboard">("review");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startingQuizId, setStartingQuizId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [error, setError] = useState("");
  const answersRef = useRef(answers);
  const submitQuizRef = useRef<() => void>(() => { });

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submittingQuizRef = useRef(false);

  const formatQuizDate = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  const submitQuiz = useCallback(async () => {
    if (!activeQuiz || !attemptId || submittingQuizRef.current) return;
    submittingQuizRef.current = true;
    setError("");
    setIsSubmitting(true);
    try {
      const currentAnswers = answersRef.current;
      await saveQuizAnswersBulk(activeQuiz.id, {
        attemptId,
        answers: Object.entries(currentAnswers).map(([questionId, selectedOptions]) => ({
          questionId,
          selectedOptions: selectedOptions as string[],
        })),
      });

      const submitRes = await submitQuizAttempt(activeQuiz.id, attemptId);
      const fullResult = await getQuizAttemptResult(activeQuiz.id, attemptId);

      const review: QuizResultReview = {
        score: submitRes.score,
        answers: fullResult.answers,
      };

      setResult(review);
      setPhase("result");

      classroomActions.submitQuizAttempt(classroomId, activeQuiz.id, {
        id: (attemptId && !attemptId.startsWith("att-")) ? attemptId : (submitRes as any)?.attemptId || undefined,
        studentId: CURRENT_STUDENT.id,
        studentName: CURRENT_STUDENT.name,
        attemptNo: (activeQuiz.attempts?.length || 0) + 1,
        status: "submitted",
        startedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        answers: fullResult.answers.map((a: any) => ({
          questionId: a.questionId,
          selectedOptions: a.selectedOptions,
          isCorrect: a.isCorrect,
          marksAwarded: a.marksAwarded,
        })),
        score: submitRes.score,
      });

      const updatedClassroom = await getClassroomById(classroomId);
      classroomActions.updateClassroom(classroomId, updatedClassroom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit assessment");
      toast.error(err instanceof Error ? err.message : "Failed to submit assessment");
    } finally {
      setIsSubmitting(false);
      submittingQuizRef.current = false;
    }
  }, [activeQuiz, attemptId, classroomId, CURRENT_STUDENT.id, CURRENT_STUDENT.name]);

  useEffect(() => {
    submitQuizRef.current = submitQuiz;
  }, [submitQuiz]);

  useEffect(() => {
    if (phase !== "taking" || timeLeft === null) return;
    if (timeLeft <= 0) {
      submitQuizRef.current();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const handleStartExam = useCallback(async (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setError("");
    setStartingQuizId(quiz.id);
    try {
      const payload = await startQuizAttempt(quiz.id);
      if (payload.alreadySubmitted) {
        toast.info(payload.message || "You have already submitted this quiz.");
        if (payload.attemptId) {
          const review = await getQuizAttemptResult(quiz.id, payload.attemptId);
          setResult(review);
        }
        setPhase("result");
        return;
      }
      setAttemptId(payload.attemptId ?? null);
      setExamQuestions(payload.questions || []);
      setAnswers({});

      if (quiz.duration && quiz.duration > 0) {
        setTimeLeft(quiz.duration * 60);
      } else {
        setTimeLeft(null);
      }

      setPhase("taking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start assessment");
      toast.error(err instanceof Error ? err.message : "Could not start assessment");
    } finally {
      setStartingQuizId(null);
    }
  }, []);

  const handleViewResult = useCallback(async (quiz: Quiz, preferredAttemptId?: string | null) => {
    setActiveQuiz(quiz);
    setError("");
    const myAttempts = (quiz.attempts || []).filter(
      (a) => a.studentId === CURRENT_STUDENT.id || a.studentId === currentUser?.userId
    );
    const submittedAttempts = myAttempts.filter((a) => a.status === "submitted");
    const targetAttempt = preferredAttemptId
      ? submittedAttempts.find((a) => a.id === preferredAttemptId) || submittedAttempts[0]
      : submittedAttempts.sort((a, b) => (b.score?.percentage || 0) - (a.score?.percentage || 0))[0];

    if (targetAttempt?.score) {
      const initialAnswers = (quiz.questions && quiz.questions.length > 0)
        ? quiz.questions.map((q) => {
            const ans = targetAttempt.answers?.find((a) => a.questionId === q.id);
            const selectedOptions = ans?.selectedOptions || [];
            const correctOptions = (q.options || []).filter((o) => o.isCorrect).map((o) => o.label);
            return {
              questionId: q.id,
              questionText: q.text,
              image: q.image,
              marks: q.marks,
              selectedOptions: selectedOptions as string[],
              correctOptions,
              isAttempted: selectedOptions.length > 0,
              isCorrect: !!ans?.isCorrect,
              marksAwarded: ans?.marksAwarded ?? (ans?.isCorrect ? q.marks : 0),
              explanation: q.explanation,
              options: (q.options || []).map((o) => ({
                label: o.label,
                text: o.text,
                isCorrect: o.isCorrect,
              })),
            };
          })
        : [];
      setResult({
        score: targetAttempt.score,
        answers: initialAnswers,
      });
      setPhase("result");
    } else {
      setPhase("result");
    }

    setIsLoadingReview(true);
    try {
      const targetAttemptId = targetAttempt?.id && !targetAttempt.id.startsWith("att-") && /^[0-9a-fA-F]{24}$/.test(targetAttempt.id)
        ? targetAttempt.id
        : preferredAttemptId && !preferredAttemptId.startsWith("att-") && /^[0-9a-fA-F]{24}$/.test(preferredAttemptId)
          ? preferredAttemptId
          : undefined;
      const fullResult = await getQuizAttemptResult(quiz.id, targetAttemptId);
      setResult({
        score: fullResult.score || targetAttempt?.score,
        answers: fullResult.answers || targetAttempt?.answers || [],
      });
    } catch (err) {
      if (!targetAttempt?.score) {
        toast.error(err instanceof Error ? err.message : "Could not load test results");
      }
    } finally {
      setIsLoadingReview(false);
    }
  }, [CURRENT_STUDENT.id, currentUser?.userId]);

  const autoHandledRef = useRef(false);
  useEffect(() => {
    if (autoHandledRef.current || !cls || isFetching || !initialQuizId) return;

    const targetQuiz = (cls.quizzes || []).find((q) => q.id === initialQuizId && q.status === "published");
    if (!targetQuiz) return;

    autoHandledRef.current = true;

    const myAttempts = (targetQuiz.attempts || []).filter(
      (a) => a.studentId === CURRENT_STUDENT.id || a.studentId === currentUser?.userId
    );
    const submittedAttempts = myAttempts.filter((a) => a.status === "submitted");
    const attemptsLeft = targetQuiz.maxAttempts - submittedAttempts.length;

    const now = Date.now();
    const startTime = targetQuiz.availableFrom ? new Date(targetQuiz.availableFrom).getTime() : null;
    const endTime = targetQuiz.availableUntil ? new Date(targetQuiz.availableUntil).getTime() : null;
    const isNotStarted = startTime !== null && !isNaN(startTime) && startTime > now;
    const isExpired = endTime !== null && !isNaN(endTime) && endTime < now;
    const canTake = attemptsLeft > 0 && !isNotStarted && !isExpired;

    if (initialAction === "result" || (submittedAttempts.length > 0 && !canTake)) {
      void handleViewResult(targetQuiz, initialAttemptId);
    } else if (initialAction === "start" && canTake) {
      void handleStartExam(targetQuiz);
    } else if (submittedAttempts.length > 0) {
      void handleViewResult(targetQuiz, initialAttemptId);
    }
  }, [cls, isFetching, initialQuizId, initialAction, initialAttemptId, CURRENT_STUDENT.id, currentUser?.userId, handleStartExam, handleViewResult]);

  const toggleOption = (questionId: string, optionLabel: string, type: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === "msq") {
        const next = current.includes(optionLabel)
          ? current.filter((o) => o !== optionLabel)
          : [...current, optionLabel];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionLabel] };
    });
  };

  if (phase === "list") {
    const publishedQuizzes = (cls.quizzes || []).filter((q) => q.status === "published");
    return (
      <div className="space-y-4">
        {publishedQuizzes.length === 0 && !isFetching && (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-xs">
            <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No tests or quizzes available yet.</p>
          </div>
        )}
        {publishedQuizzes.map((q) => {
          const myAttempts = (q.attempts || []).filter(
            (a) => a.studentId === CURRENT_STUDENT.id || a.studentId === currentUser?.userId
          );
          const submittedAttempts = myAttempts.filter((a) => a.status === "submitted");
          const hasSubmitted = submittedAttempts.length > 0;
          const bestAttempt = submittedAttempts.sort((a, b) => (b.score?.percentage || 0) - (a.score?.percentage || 0))[0];
          const attemptsLeft = q.maxAttempts - submittedAttempts.length;
          const hasAttemptsLeft = attemptsLeft > 0;

          const now = Date.now();
          const startTime = q.availableFrom ? new Date(q.availableFrom).getTime() : null;
          const endTime = q.availableUntil ? new Date(q.availableUntil).getTime() : null;
          const isNotStarted = startTime !== null && !isNaN(startTime) && startTime > now;
          const isExpired = endTime !== null && !isNaN(endTime) && endTime < now;
          const canTake = hasAttemptsLeft && !isNotStarted && !isExpired;
          const isThisStarting = startingQuizId === q.id;
          const isClickable = (hasSubmitted && !!bestAttempt) || canTake;

          const handleCardClick = () => {
            if (hasSubmitted && bestAttempt) {
              void handleViewResult(q);
            } else if (canTake) {
              void handleStartExam(q);
            }
          };

          return (
            <div
              key={q.id}
              onClick={handleCardClick}
              className={`rounded-2xl border border-slate-200 bg-white p-5 transition-all shadow-xs ${
                isClickable
                  ? "cursor-pointer hover:border-sky-400 hover:shadow-md active:scale-[0.995]"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-display font-bold text-plum-dark text-base">{q.title}</h4>
                    <span className="bg-sky-50 text-sky-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-sky-200">
                      {getExamType(q.questions || [])}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs line-clamp-2">{q.instructions || "No instructions provided."}</p>

                  {(q.availableFrom || q.availableUntil) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      {isNotStarted ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          <Calendar className="h-3 w-3" /> Starts: {formatQuizDate(q.availableFrom)}
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                          <Calendar className="h-3 w-3" /> Closed: {formatQuizDate(q.availableUntil)} (Deadline Reached)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-200">
                          <Calendar className="h-3 w-3" /> {q.availableUntil ? `Deadline: ${formatQuizDate(q.availableUntil)}` : `Started: ${formatQuizDate(q.availableFrom)}`}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 font-mono"><Clock className="h-3 w-3" /> {q.duration ? `${q.duration} min` : "No limit"}</span>
                    <span>{q.questions?.length || 0} questions</span>
                    <span>{q.passPercent}% pass score</span>
                    <span className="font-medium text-slate-600">Attempts: {submittedAttempts.length}/{q.maxAttempts}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasSubmitted && bestAttempt && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleViewResult(q);
                      }}
                      className="rounded-full border border-plum-dark text-plum-dark px-4 py-2 text-xs font-bold hover:bg-plum/5 transition-colors"
                    >
                      View Result ({bestAttempt.score?.percentage}%)
                    </button>
                  )}
                  {isNotStarted && (
                    <span className="rounded-full bg-slate-100 text-slate-400 px-4 py-2 text-xs font-bold border border-slate-200 cursor-not-allowed">
                      Starts Soon
                    </span>
                  )}
                  {isExpired && !hasSubmitted && (
                    <span className="rounded-full bg-red-50 text-red-500 px-4 py-2 text-xs font-bold border border-red-200 cursor-not-allowed">
                      Deadline Passed
                    </span>
                  )}
                  {canTake && (
                    <button
                      disabled={!!startingQuizId}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleStartExam(q);
                      }}
                      className="rounded-full bg-plum-dark text-cream px-5 py-2 text-xs font-bold hover:bg-plum transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {isThisStarting && <Loader2 className="h-3 w-3 animate-spin text-lime" />}
                      <span>{isThisStarting ? "Starting..." : hasSubmitted ? "Retake Test" : "Start Test"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (phase === "taking" && activeQuiz) {
    const answeredCount = Object.keys(answers).length;
    return (
      <div className="space-y-6 max-w-3xl mx-auto bg-white p-6 rounded-3xl border border-slate-200 shadow-md">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-plum-dark">{activeQuiz.title}</h3>
            <p className="text-xs text-slate-400">Question {answeredCount} of {examQuestions.length} answered</p>
          </div>
          {timeLeft !== null && (
            <div className={`px-4 py-2 rounded-xl font-mono font-bold text-sm ${timeLeft < 300 ? "bg-red-50 text-red-600 border border-red-200 animate-pulse" : "bg-slate-100 text-slate-700"}`}>
              ÔÅ▒ {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">{error}</div>}

        <div className="space-y-6">
          {examQuestions.map((q, idx) => {
            const selected = answers[q.id] || [];
            return (
              <div key={q.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="font-bold text-plum text-sm">{idx + 1}.</span>
                  <p className="font-semibold text-slate-800 text-sm">{q.text}</p>
                </div>

                {/* Question Image */}
                {q.image && (
                  <div className="ml-7">
                    <button
                      type="button"
                      onClick={() => window.open(q.image!, "_blank")}
                      className="block relative group rounded-xl overflow-hidden border border-slate-200 hover:border-sky-400 transition-all max-w-sm"
                    >
                      <img
                        src={q.image}
                        alt={`Question ${idx + 1} image`}
                        className="w-full max-h-56 object-contain bg-slate-100 block"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-700 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-opacity shadow">
                          <Eye className="h-3 w-3" /> View Full Size
                        </span>
                      </div>
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 pl-7">
                  {q.options.map((opt) => {
                    const isSel = selected.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => toggleOption(q.id, opt.label, q.type)}
                        className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center gap-3 ${
                          isSel ? "border-plum bg-plum/10 text-plum-dark font-bold shadow-xs" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isSel ? "bg-plum text-white" : "bg-slate-100 text-slate-500"}`}>
                          {opt.label}
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <button
            onClick={() => setPhase("list")}
            className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
          >
            Cancel Assessment
          </button>
          <button
            disabled={isSubmitting}
            onClick={() => void submitQuiz()}
            className="rounded-full bg-plum-dark text-cream px-8 py-3 text-sm font-bold shadow-md hover:bg-plum transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit Test"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result" && activeQuiz) {
    if (!result) {
      return (
        <div className="space-y-6 max-w-4xl mx-auto bg-white p-12 rounded-3xl border border-slate-200 shadow-md text-center flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-800">Loading your test score & review...</p>
        </div>
      );
    }
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Result Hero Banner */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                result.score.passed ? "bg-emerald-100 text-emerald-600 shadow-inner" : "bg-red-100 text-red-600 shadow-inner"
              }`}>
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="font-display text-xl font-bold text-plum-dark">
                    {result.score.passed ? "Assessment Passed ­ƒÄë" : "Assessment Completed"}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    result.score.passed ? "bg-emerald-100 text-emerald-950 border border-emerald-400" : "bg-red-100 text-red-950 border border-red-400"
                  }`}>
                    {result.score.passed ? "Passed" : "Needs Review"}
                  </span>
                </div>
                <p className="text-slate-700 text-xs mt-1 font-semibold">
                  {activeQuiz.title} ┬À Score: <strong className="text-plum-dark font-black">{result.score.rawMarks} / {result.score.totalMarks}</strong> ({result.score.percentage}%)
                </p>
              </div>
            </div>

            <button
              onClick={() => setPhase("list")}
              className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 px-5 py-2 text-xs font-black transition-all shrink-0 border border-slate-300"
            >
              ÔåÉ Back to Tests
            </button>
          </div>

          {/* Segmented Switcher for Review vs Leaderboard */}
          <div className="mt-5 flex items-center justify-center sm:justify-start gap-2">
            <div className="bg-slate-100 p-1.5 rounded-2xl inline-flex items-center gap-1.5 border border-slate-300">
              <button
                type="button"
                onClick={() => setResultViewTab("review")}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  resultViewTab === "review"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-700 hover:text-slate-950 hover:bg-white/60"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Question Review (3 Tabs)</span>
              </button>

              <button
                type="button"
                onClick={() => setResultViewTab("leaderboard")}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  resultViewTab === "leaderboard"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-700 hover:text-slate-950 hover:bg-white/60"
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Leaderboard & Top Ranks</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Section */}
        {resultViewTab === "review" ? (
          <QuizQuestionReviewTabs
            answers={result.answers}
            isLoading={isLoadingReview || !result.answers || result.answers.length === 0}
            theme="light"
          />
        ) : (
          <QuizLeaderboard
            quizId={activeQuiz.id}
            currentUserId={CURRENT_STUDENT.id}
            theme="light"
          />
        )}
      </div>
    );
  }

  return null;
}

// ÔöÇÔöÇÔöÇ Main Page ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export { TestsTab as StudentTestsTab };