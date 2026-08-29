import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardList, CheckCircle2, Clock, X, ChevronLeft, ChevronRight, AlertCircle, Trophy, Check } from "lucide-react";
import { Card } from "@/components/portal/PortalShell";
import { useClassroomStore, classroomActions, getGrade, formatTime, type Quiz, type Question } from "@/lib/classroomStore";
import {
  getClassroomById,
  saveQuizAnswersBulk,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizAttemptResult,
} from "@/lib/api";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { QuizQuestionReviewTabs } from "@/components/quiz/QuizQuestionReviewTabs";
import { useState, useEffect, useCallback, useRef } from "react";

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

export const Route = createFileRoute("/_student/student/exams")({
  component: Exams,
});

// ─── Quiz Attempt Modal ───────────────────────────────────────────────────────

function QuizModal({ quiz, classroomId, reviewAttemptId, onClose }: {
  quiz: Quiz; classroomId: string; studentId: string; studentName: string; reviewAttemptId?: string | null; onClose: () => void;
}) {
  const [phase, setPhase] = useState<"intro" | "taking" | "result">(reviewAttemptId ? "result" : "intro");
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [timeLeft, setTimeLeft] = useState((quiz.duration || 0) * 60);
  const [result, setResult] = useState<QuizResultReview | null>(null);
  const [resultViewTab, setResultViewTab] = useState<"review" | "leaderboard">("review");
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const selectedRef = useRef(selected);
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (reviewAttemptId) {
      const loadReview = async () => {
        setError("");
        try {
          const review = await getQuizAttemptResult(quiz.id, reviewAttemptId);
          setResult(review);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not load quiz review");
        }
      };
      void loadReview();
    }
  }, [reviewAttemptId, quiz.id]);

  const submittingRef = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setIsSubmitting(true);
    try {
      const currentSelected = selectedRef.current;
      await saveQuizAnswersBulk(quiz.id, {
        attemptId,
        answers: examQuestions.map((q) => ({
          questionId: q.id,
          selectedOptions: currentSelected[q.id] || [],
        })),
      });
      await submitQuizAttempt(quiz.id, attemptId);
      const review = await getQuizAttemptResult(quiz.id, attemptId);
      setResult(review);
      toast.success("Quiz submitted successfully!");
      const refreshed = await getClassroomById(classroomId);
      classroomActions.updateClassroom(classroomId, refreshed);
      setPhase("result");
    } catch (err) {
      submittingRef.current = false;
      const msg = err instanceof Error ? err.message : "Could not submit exam";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptId, classroomId, examQuestions, quiz.id]);

  useEffect(() => {
    submitRef.current = () => { void handleSubmit(); };
  }, [handleSubmit]);

  const beginTaking = async () => {
    if (isStarting) return;
    setError("");
    setIsStarting(true);
    try {
      const started = await startQuizAttempt(quiz.id);
      if (started.alreadySubmitted) {
        toast.info(started.message || "You have already submitted this quiz.");
        if (started.attemptId) {
          const review = await getQuizAttemptResult(quiz.id, started.attemptId);
          setResult(review);
        }
        setPhase("result");
        return;
      }
      setAttemptId(started.attemptId!);
      setExamQuestions(started.questions);
      setSelected({});
      setQIdx(0);
      setTimeLeft((started.duration || quiz.duration || 0) * 60);
      setPhase("taking");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start exam";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsStarting(false);
    }
  };

  // Timer
  useEffect(() => {
    if (phase !== "taking" || !quiz.duration) return;
    if (timeLeft <= 0) { submitRef.current(); return; }
    const t = setInterval(() => setTimeLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase, timeLeft, quiz.duration]);

  const handleSelect = (qId: string, optLabel: string, isMulti: boolean) => {
    setSelected(prev => {
      const cur = prev[qId] || [];
      if (isMulti) {
        return { ...prev, [qId]: cur.includes(optLabel) ? cur.filter(x => x !== optLabel) : [...cur, optLabel] };
      }
      return { ...prev, [qId]: [optLabel] };
    });
  };

  const q: Question = examQuestions[qIdx];
  const isMulti = q?.type === "msq";
  const sel = selected[q?.id] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* INTRO */}
        {phase === "intro" && (
          <div className="p-8 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl mx-auto mb-4" style={{background:'#0B1F3A'}}>
              <ClipboardList className="h-8 w-8" style={{color:'#F4B400'}} />
            </div>
            <h2 className="font-display text-2xl font-bold" style={{color:'#0B1F3A'}}>{quiz.title}</h2>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">{quiz.instructions}</p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {[
                { l: "Questions", v: quiz.questions.length },
                { l: "Duration", v: quiz.duration ? `${quiz.duration} min` : "No limit" },
                { l: "Pass Mark", v: `${quiz.passPercent}%` },
              ].map(s => (
                <div key={s.l} className="rounded-2xl p-3" style={{background:'rgba(11,31,58,0.05)'}}>
                  <div className="font-display text-xl font-bold" style={{color:'#0B1F3A'}}>{s.v}</div>
                  <div className="text-xs text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 text-left flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Do not refresh or close this window during the exam. Your progress will be lost.</span>
            </div>
            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 text-left">
                {error}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-full bg-slate-100 text-slate-600 py-3 font-semibold">Cancel</button>
              <button onClick={beginTaking} disabled={isStarting} className="flex-1 rounded-full py-3 font-bold disabled:opacity-50 text-white" style={{background:'#0B1F3A'}}>
                {isStarting ? "Starting…" : "Start Exam →"}
              </button>
            </div>
          </div>
        )}

        {/* TAKING */}
        {phase === "taking" && q && (
          <div>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-slate-400">Question {qIdx + 1} of {examQuestions.length}</div>
                <div className="font-semibold text-sm mt-0.5" style={{color:'#0B1F3A'}}>{quiz.title}</div>
              </div>
              <div className="flex items-center gap-3">
                {quiz.duration && (
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-mono font-bold`} style={timeLeft < 120 ? {background:'rgba(239,68,68,0.1)',color:'#DC2626'} : {background:'rgba(11,31,58,0.08)',color:'#0B1F3A'}}>
                    <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
                  </div>
                )}
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100">
              <div className="h-full transition-all" style={{ width: `${((qIdx + 1) / examQuestions.length) * 100}%`, background:'linear-gradient(90deg,#F4B400,#2D9CDB)' }} />
            </div>

            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <span className="text-white text-xs font-bold rounded-full h-6 w-6 grid place-items-center shrink-0 mt-0.5" style={{background:'#0B1F3A'}}>{qIdx + 1}</span>
                <div>
                  <p className="font-semibold text-base leading-relaxed" style={{color:'#0B1F3A'}}>{q.text}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {q.marks} mark{q.marks !== 1 ? "s" : ""} ·{" "}
                    {q.type === "mcq" ? "Single choice" : q.type === "msq" ? "Multiple correct answers" : "True / False"}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {q.options.map(opt => {
                  const isSelected = sel.includes(opt.label);
                  return (
                    <button key={opt.label} onClick={() => handleSelect(q.id, opt.label, isMulti)}
                      className="w-full flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all"
                      style={isSelected ? {borderColor:'#2D9CDB',background:'rgba(45,156,219,0.05)'} : {borderColor:'#E2E8F0'}}>
                      <span className="grid h-6 w-6 place-items-center rounded-full border-2 text-xs font-bold shrink-0 transition-colors"
                        style={isSelected ? {borderColor:'#2D9CDB',background:'#0B1F3A',color:'#F4B400'} : {borderColor:'#CBD5E1',color:'#64748B'}}>
                        {isMulti ? (isSelected ? "✓" : opt.label) : opt.label}
                      </span>
                      <span className="text-sm text-slate-700">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-between gap-3">
                <button disabled={qIdx === 0} onClick={() => setQIdx(i => i - 1)}
                  className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <div className="flex gap-1">
                  {examQuestions.map((eq, i) => (
                    <button key={i} onClick={() => setQIdx(i)}
                      className="h-2 w-2 rounded-full transition-all"
                      style={{background: i === qIdx ? '#0B1F3A' : selected[eq.id]?.length ? '#2D9CDB' : '#CBD5E1', width: i === qIdx ? '20px' : undefined}} />
                  ))}
                </div>
                {qIdx < examQuestions.length - 1 ? (
                  <button onClick={() => setQIdx(i => i + 1)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white" style={{background:'#0B1F3A'}}>
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-50" style={{background:'#F4B400',color:'#0B1F3A'}}>
                    {isSubmitting ? "Submitting…" : "Submit Exam ✓"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && result && (
          <div className="p-6 space-y-6 text-left">
            {/* Header Result Card */}
            <div className="bg-slate-50 border border-slate-200/80 p-6 rounded-3xl text-center">
              <div
                className="grid h-16 w-16 place-items-center rounded-2xl mx-auto mb-3"
                style={result.score.passed ? { background: '#F4B400', color: '#0B1F3A' } : { background: 'rgba(239,68,68,0.1)', color: '#DC2626' }}
              >
                {result.score.passed ? <Trophy className="h-8 w-8" /> : <X className="h-8 w-8" />}
              </div>
              <h2 className="font-display text-2xl font-bold" style={{ color: result.score.passed ? '#0B1F3A' : '#DC2626' }}>
                {result.score.passed ? "You Passed! 🎉" : "Not Passed"}
              </h2>
              <p className="text-slate-500 text-xs mt-1">{quiz.title}</p>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { l: "Score", v: `${result.score.rawMarks}/${result.score.totalMarks}` },
                  { l: "Percentage", v: `${result.score.percentage}%` },
                  { l: "Grade", v: getGrade(result.score.percentage) },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-2xl p-3 border border-black/5"
                    style={result.score.passed ? { background: 'rgba(244,180,0,0.1)' } : { background: 'rgba(239,68,68,0.07)' }}
                  >
                    <div className="font-display text-xl font-bold" style={{ color: result.score.passed ? '#0B1F3A' : '#DC2626' }}>
                      {s.v}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-xs font-semibold" style={{ color: result.score.passed ? '#10B981' : '#DC2626' }}>
                {result.score.passed
                  ? `Great work! You scored above the ${quiz.passPercent}% pass mark.`
                  : `You needed ${quiz.passPercent}% to pass. Keep practicing!`}
              </p>

              {/* Segmented Switcher */}
              <div className="mt-4 flex items-center justify-center">
                <div className="bg-white p-1 rounded-2xl inline-flex items-center gap-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setResultViewTab("review")}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      resultViewTab === "review"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Question Review (3 Tabs)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultViewTab("leaderboard")}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      resultViewTab === "leaderboard"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Leaderboard & Top 3</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tab View */}
            {resultViewTab === "review" ? (
              <QuizQuestionReviewTabs answers={result.answers} theme="light" />
            ) : (
              <QuizLeaderboard quizId={quiz.id} theme="light" />
            )}

            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full py-3 font-bold text-white text-xs transition-all hover:opacity-90 shadow-md"
              style={{ background: '#0B1F3A' }}
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ─── Exams Page ───────────────────────────────────────────────────────────────

function Exams() {
  const { classrooms, currentUser } = useClassroomStore();
  const studentId = currentUser?.id || "";
  const studentName = currentUser?.name || "";
  const [activeQuiz, setActiveQuiz] = useState<{ quiz: Quiz; classroomId: string } | null>(null);

  const enrolledClassrooms = classrooms.filter(c =>
    c.students.some(s => s.id === studentId && s.status === "active")
  );
  const allQuizzes = enrolledClassrooms.flatMap(c =>
    c.quizzes.filter(q => q.status === "published").map(q => ({ ...q, classroomName: c.name, classroomId: c.id }))
  );

  const upcomingQuizzes = allQuizzes.filter(q =>
    !q.attempts.some(a => a.studentId === studentId && a.status === "submitted")
  );
  const completedAttempts = allQuizzes.flatMap(q =>
    q.attempts.filter(a => a.studentId === studentId && a.status === "submitted")
      .map(a => ({ ...a, quizTitle: q.title, classroomName: q.classroomName }))
  );
  const avgScore = completedAttempts.length
    ? Math.round(completedAttempts.reduce((s, a) => s + a.score.percentage, 0) / completedAttempts.length) : 0;

  const canAttempt = (q: typeof allQuizzes[0]) => {
    const prevAttempts = q.attempts.filter(a => a.studentId === studentId);
    const now = Date.now();
    const startTime = q.availableFrom ? new Date(q.availableFrom).getTime() : null;
    const endTime = q.availableUntil ? new Date(q.availableUntil).getTime() : null;
    const isNotStarted = startTime !== null && !isNaN(startTime) && startTime > now;
    const isExpired = endTime !== null && !isNaN(endTime) && endTime < now;
    return prevAttempts.length < q.maxAttempts && !isNotStarted && !isExpired;
  };

  return (
    <div className="space-y-6">
      {activeQuiz && (
        <QuizModal
          quiz={activeQuiz.quiz}
          classroomId={activeQuiz.classroomId}
          studentId={studentId}
          studentName={studentName}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      <div>
        <h1 className="font-display text-3xl font-bold" style={{color:'#0B1F3A'}}>Exams & Assessments</h1>
        <p className="text-sm text-muted-foreground mt-1">Proctored finals, mock tests and practice quizzes</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { k: "Average Score", v: `${avgScore}%`, icon: CheckCircle2 },
          { k: "Exams Taken", v: completedAttempts.length.toString(), icon: ClipboardList },
          { k: "Upcoming", v: upcomingQuizzes.length.toString(), icon: Clock },
        ].map(s => (
          <Card key={s.k} className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl" style={{background:'rgba(45,156,219,0.1)',color:'#2D9CDB'}}><s.icon className="h-5 w-5" /></div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</div>
              <div className="font-display text-2xl font-bold" style={{color:'#0B1F3A'}}>{s.v}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Upcoming Exams */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg" style={{color:'#0B1F3A'}}>Upcoming Exams</h3>
        </div>
        <div className="space-y-3">
          {upcomingQuizzes.map(e => {
            const now = Date.now();
            const startTime = e.availableFrom ? new Date(e.availableFrom).getTime() : null;
            const endTime = e.availableUntil ? new Date(e.availableUntil).getTime() : null;
            const isNotStarted = startTime !== null && !isNaN(startTime) && startTime > now;
            const isExpired = endTime !== null && !isNaN(endTime) && endTime < now;

            return (
              <div key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-border p-4">
                <div className="grid h-12 w-12 place-items-center rounded-xl shrink-0" style={{background:'#0B1F3A'}}>
                  <ClipboardList className="h-5 w-5" style={{color:'#F4B400'}} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold" style={{color:'#0B1F3A'}}>{e.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {e.duration ? `${e.duration} min timer` : "No limit"}
                    {e.questions.length ? ` · ${e.questions.length} questions` : ""}
                    {` · Pass: ${e.passPercent}%`}
                  </div>
                  {(e.availableFrom || e.availableUntil) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {isNotStarted ? (
                        <div className="text-[11px] text-amber-700 font-medium bg-amber-50 rounded-lg px-2.5 py-1 inline-flex items-center gap-1 border border-amber-200">
                          <Clock className="h-3 w-3" />
                          <span>Starts: {fmtDate(e.availableFrom)}</span>
                        </div>
                      ) : isExpired ? (
                        <div className="text-[11px] text-red-700 font-medium bg-red-50 rounded-lg px-2.5 py-1 inline-flex items-center gap-1 border border-red-200">
                          <Clock className="h-3 w-3" />
                          <span>Closed: {fmtDate(e.availableUntil)} (Deadline Reached)</span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#0284C7] font-medium bg-[#F0F9FF] rounded-lg px-2.5 py-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 border border-[#BAE6FD]">
                          <span className="font-bold text-[#0369A1]">Available:</span>
                          {e.availableFrom && <span>Starts: {fmtDate(e.availableFrom)}</span>}
                          {e.availableUntil && <span>Ends: {fmtDate(e.availableUntil)}</span>}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] uppercase tracking-widest mt-1.5" style={{color:'rgba(11,31,58,0.5)'}}>{e.classroomName}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full font-bold" style={{background:'rgba(244,180,0,0.15)',color:'#B8870A'}}>Pending</span>
                  {isNotStarted ? (
                    <span className="text-xs text-muted-foreground rounded-full border border-border px-4 py-2">Starts Soon</span>
                  ) : isExpired ? (
                    <span className="text-xs text-red-600 rounded-full border border-red-200 bg-red-50 px-4 py-2 font-medium">Deadline Passed</span>
                  ) : canAttempt(e) ? (
                    <button
                      onClick={() => setActiveQuiz({ quiz: e, classroomId: e.classroomId })}
                      className="rounded-full text-white text-xs font-semibold px-4 py-2 transition-all hover:brightness-110 active:scale-95"
                      style={{background:'#0B1F3A'}}
                    >
                      Start Exam
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground rounded-full border border-border px-4 py-2">Max attempts reached</span>
                  )}
                </div>
              </div>
            );
          })}
          {upcomingQuizzes.length === 0 && <p className="text-sm text-muted-foreground">No upcoming exams. 🎉</p>}
        </div>
      </Card>

      {/* Results Table */}
      <Card>
        <h3 className="font-display font-bold text-lg mb-4" style={{color:'#0B1F3A'}}>Recent Results</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="pb-3">Exam</th><th className="pb-3">Date</th><th className="pb-3">Score</th><th className="pb-3">Grade</th><th className="pb-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {completedAttempts.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()).map(r => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-secondary/40 transition-colors">
                  <td className="py-3.5 font-semibold" style={{color:'#0B1F3A'}}>
                    {r.quizTitle}
                    <div className="text-[10px] font-normal uppercase tracking-widest text-muted-foreground mt-0.5">{r.classroomName}</div>
                  </td>
                  <td className="py-3.5 text-muted-foreground">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}
                  </td>
                  <td className="py-3.5"><span className="font-mono font-bold">{r.score.percentage}%</span></td>
                  <td className="py-3.5"><span className="text-xs font-bold px-2 py-0.5 rounded" style={r.score.passed ? {background:'rgba(244,180,0,0.15)',color:'#B8870A'} : {background:'rgba(239,68,68,0.1)',color:'#B91C1C'}}>{getGrade(r.score.percentage)}</span></td>
                  <td className="py-3.5">
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded" style={r.score.passed ? {background:'rgba(22,163,74,0.12)',color:'#16A34A'} : {background:'rgba(239,68,68,0.1)',color:'#B91C1C'}}>{r.score.passed ? "Passed" : "Failed"}</span>
                  </td>
                </tr>
              ))}
              {completedAttempts.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No results yet. Attempt an exam above!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3 items-start">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-amber-900">Proctoring requirements</div>
          <div className="text-amber-800 mt-0.5">A working webcam and quiet room are required for all proctored exams. Test your setup 24h before the exam.</div>
        </div>
      </div>
    </div>
  );
}
