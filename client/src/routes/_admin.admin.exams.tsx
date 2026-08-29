import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Users, CheckCircle2, AlertCircle, ArrowLeft, BarChart2, BookOpen, Trophy, Eye, Crown, Medal, Sparkles, Clock, Check } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore, getExamType, getGrade, classroomActions } from "@/lib/classroomStore";
import { publishQuiz, closeQuiz, getQuizReport } from "@/lib/api";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { AdminStudentAnswerSheetModal } from "@/components/quiz/AdminStudentAnswerSheetModal";
import { useMemo, useState, useEffect } from "react";

export const Route = createFileRoute("/_admin/admin/exams")({
  component: AdminExams,
});

function AdminExams() {
  const { classrooms } = useClassroomStore();
  const [viewQuizId, setViewQuizId] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isUpdatingQuiz, setIsUpdatingQuiz] = useState<string | null>(null);
  const [reportAttempts, setReportAttempts] = useState<any[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [inspectStudentAttempt, setInspectStudentAttempt] = useState<any | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"overview" | "leaderboard">("overview");

  const allQuizzes = useMemo(() => {
    return classrooms.flatMap(c =>
      c.quizzes.map(q => ({
        ...q,
        classroomName: c.name,
        classroomId: c.id,
        course: c.program,
        batch: c.name.split("—")[1]?.trim() || "N/A",
        studentsCount: c.students.filter(s => s.status === "active").length,
        students: c.students.filter(s => s.status === "active"),
        examType: getExamType(q.questions),
      }))
    ).sort((a, b) => new Date(b.availableFrom).getTime() - new Date(a.availableFrom).getTime());
  }, [classrooms]);

  useEffect(() => {
    if (!viewQuizId) {
      setReportAttempts([]);
      return;
    }
    let active = true;
    setIsLoadingReport(true);
    getQuizReport(viewQuizId)
      .then((res) => {
        if (active) setReportAttempts(res);
      })
      .catch((err) => console.error("Failed to load report", err))
      .finally(() => {
        if (active) setIsLoadingReport(false);
      });
    return () => {
      active = false;
    };
  }, [viewQuizId]);

  const batches = ["All", ...Array.from(new Set(allQuizzes.map(q => q.batch)))];
  const statuses = ["All", "draft", "published", "closed"];

  const filtered = allQuizzes.filter(q => {
    if (batchFilter !== "All" && q.batch !== batchFilter) return false;
    if (statusFilter !== "All" && q.status !== statusFilter) return false;
    return true;
  });

  if (viewQuizId) {
    const q = allQuizzes.find(x => x.id === viewQuizId);
    if (!q) return null;

    const sourceAttempts = reportAttempts.length > 0 ? reportAttempts : q.attempts;
    const submitted = sourceAttempts.filter(a => a.status === "submitted");
    const submittedIds = new Set(submitted.map(a => a.studentId));
    const absent = q.students.filter(s => !submittedIds.has(s.id));
    const passCount = submitted.filter(a => a.score.passed).length;
    const failCount = submitted.length - passCount;
    const passRate = submitted.length ? Math.round((passCount / submitted.length) * 100) : 0;
    const avgScore = submitted.length ? Math.round(submitted.reduce((s, a) => s + a.score.percentage, 0) / submitted.length) : 0;

    const sortedAttempts = [...submitted].sort((a: any, b: any) => {
      const aPct = a.score?.percentage ?? 0;
      const bPct = b.score?.percentage ?? 0;
      if (bPct !== aPct) return bPct - aPct;

      const aCorrect = a.correctCount ?? (a.answers?.filter((x: any) => x.isCorrect).length || 0);
      const bCorrect = b.correctCount ?? (b.answers?.filter((x: any) => x.isCorrect).length || 0);
      if (bCorrect !== aCorrect) return bCorrect - aCorrect;

      const aRaw = a.score?.rawMarks ?? 0;
      const bRaw = b.score?.rawMarks ?? 0;
      if (bRaw !== aRaw) return bRaw - aRaw;

      return (a.totalTimeTakenSec || 0) - (b.totalTimeTakenSec || 0);
    });

    // Grade distribution
    const gradeDist = ["A+", "A", "B+", "B", "C", "F"].map(g => ({
      grade: g,
      count: submitted.filter(a => getGrade(a.score.percentage) === g).length,
    }));
    const maxGradeCount = Math.max(...gradeDist.map(d => d.count), 1);

    // Per-question analysis
    const questionStats = q.questions.map(ques => {
      const correct = submitted.filter(att => {
        const ans = (att.answers || []).find((a: any) => a.questionId === ques.id);
        return ans?.isCorrect;
      }).length;
      return { ...ques, correctCount: correct, total: submitted.length, pct: submitted.length ? Math.round((correct / submitted.length) * 100) : 0 };
    });

    return (
      <div className="space-y-6 text-slate-900">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewQuizId(null)}
              className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <h2 className="font-display font-bold text-slate-900 text-xl sm:text-2xl">{q.title}</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">{q.course} · {q.classroomName} · <span className="text-emerald-700 font-semibold">{q.examType}</span> · {q.questions.length} questions</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {q.status === "closed" && (
              <button
                onClick={async () => {
                  setIsUpdatingQuiz(q.id);
                  try {
                    await publishQuiz(q.id);
                    classroomActions.updateQuizStatus(q.classroomId, q.id, "published");
                    setViewQuizId(null);
                  } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Failed to re-open exam';
                    console.error('[Quiz Reopen Error]', errorMsg, error);
                    alert(`Error: ${errorMsg}`);
                  } finally {
                    setIsUpdatingQuiz(null);
                  }
                }}
                disabled={isUpdatingQuiz === q.id}
                className="rounded-full bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 text-xs font-bold disabled:opacity-50 transition-colors shadow-xs">
                {isUpdatingQuiz === q.id ? 'Reopening...' : 'Re-open Exam'}
              </button>
            )}
            {q.status === "published" && (
              <button
                onClick={async () => {
                  setIsUpdatingQuiz(q.id);
                  try {
                    await closeQuiz(q.id);
                    classroomActions.updateQuizStatus(q.classroomId, q.id, "closed");
                  } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : 'Failed to close exam';
                    console.error('[Quiz Close Error]', errorMsg, error);
                    alert(`Error: ${errorMsg}`);
                  } finally {
                    setIsUpdatingQuiz(null);
                  }
                }}
                disabled={isUpdatingQuiz === q.id}
                className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 px-4 py-2 text-xs font-semibold disabled:opacity-50 transition-colors">
                {isUpdatingQuiz === q.id ? 'Closing...' : 'Close Exam'}
              </button>
            )}
          </div>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: "Eligible", v: q.studentsCount },
            { l: "Attended", v: submitted.length },
            { l: "Absent", v: absent.length },
            { l: "Pass Rate", v: `${passRate}%` },
            { l: "Avg Score", v: `${avgScore}%` },
            { l: "Passed", v: passCount },
            { l: "Failed", v: failCount },
            { l: "Avg Time", v: q.duration ? `${q.duration}m` : "No limit" },
          ].map(s => (
            <div key={s.l} className="rounded-2xl bg-white border border-slate-200 p-4 text-center shadow-xs">
              <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">{s.l}</div>
              <div className="font-display text-2xl font-bold text-slate-900 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Top 3 Podium Achievers - 3-by-3 Responsive Olympic Pedestal */}
        {sortedAttempts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Top 3 Podium Achievers
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Olympic Pedestal
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-4 items-end pt-5 sm:pt-6">
              {/* Rank 2 (Silver - Left) */}
              {sortedAttempts[1] ? (
                <div className="p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-300/80 bg-linear-to-b from-slate-50 via-slate-100/60 to-slate-200/60 flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-xs">
                  <div className="absolute -top-3 sm:-top-4 px-2 sm:px-3 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[9px] sm:text-[11px] font-black shadow-xs flex items-center gap-1 ring-2 ring-white">
                    <Medal className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-slate-600" /> 2ND RANK
                  </div>
                  <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-br from-slate-100 to-slate-300 border-2 border-white shadow-sm flex items-center justify-center font-display font-bold text-sm sm:text-xl text-slate-800 ring-2 ring-slate-300/50 mt-1">
                    {sortedAttempts[1].studentName.charAt(0).toUpperCase()}
                  </div>
                  <h5 className="font-display font-bold text-[11px] sm:text-sm mt-1.5 truncate w-full text-slate-900 px-0.5">
                    {sortedAttempts[1].studentName}
                  </h5>
                  <div className="text-[11px] sm:text-base font-mono font-black text-slate-900 mt-0.5 leading-tight">
                    {sortedAttempts[1].score.percentage}%
                  </div>
                  <div className="text-[9px] sm:text-xs font-mono font-bold text-slate-600">
                    {sortedAttempts[1].score.rawMarks}/{sortedAttempts[1].score.totalMarks} Marks
                  </div>
                  <div className="text-[9px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden xs:block truncate max-w-full">
                    {(sortedAttempts[1].correctCount ?? 0) + (sortedAttempts[1].wrongCount ?? 0)}/{sortedAttempts[1].totalQuestions || q.questions?.length || 50} Qs Attended
                  </div>
                  <div className="text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-medium text-slate-500">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" /> {sortedAttempts[1].totalTimeTakenSec ? `${Math.floor(sortedAttempts[1].totalTimeTakenSec / 60)}m` : "< 1m"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectStudentAttempt(sortedAttempts[1])}
                    className="mt-2 w-full max-w-[120px] py-1 sm:py-1.5 px-2 rounded-xl bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] sm:text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-slate-500" />
                    <span className="hidden sm:inline">View</span> Sheet
                  </button>
                  {/* Stepped Pedestal Base */}
                  <div className="mt-2.5 sm:mt-3.5 w-full h-7 sm:h-10 rounded-xl bg-linear-to-b from-slate-300 to-slate-400 flex items-center justify-center text-slate-800 font-display font-black text-sm sm:text-lg shadow-inner border-t border-slate-100">
                    2
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center opacity-60">
                  <p className="text-[10px] sm:text-xs py-6 text-slate-400">No 2nd rank</p>
                </div>
              )}

              {/* Rank 1 (Gold - Center Champion) */}
              {sortedAttempts[0] && (
                <div className="p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-amber-300/90 bg-linear-to-b from-amber-50 via-amber-100/50 to-amber-200/60 flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl shadow-md ring-2 sm:ring-4 ring-amber-400/25">
                  <div className="absolute -top-4 sm:-top-5 px-2.5 sm:px-4 py-0.5 rounded-full bg-linear-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 text-[10px] sm:text-xs font-black shadow-md flex items-center gap-1 sm:gap-1.5 animate-bounce ring-2 ring-white">
                    <Crown className="w-3 h-3 sm:w-4 sm:h-4 fill-current" /> 1ST RANK 🏆
                  </div>
                  <div className="relative mt-1">
                    <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-2xl bg-linear-to-br from-amber-200 to-amber-400 border-2 sm:border-3 border-white shadow-md flex items-center justify-center font-display font-black text-base sm:text-2xl text-amber-950 ring-2 sm:ring-3 ring-amber-400/50">
                      {sortedAttempts[0].studentName.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 text-slate-950 border border-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs">
                      🏆
                    </span>
                  </div>
                  <h5 className="font-display font-black text-xs sm:text-base mt-2 truncate w-full text-slate-900 px-1">
                    {sortedAttempts[0].studentName}
                  </h5>
                  <div className="text-xs sm:text-lg font-mono font-black text-amber-950 mt-0.5 leading-tight">
                    {sortedAttempts[0].score.percentage}%
                  </div>
                  <div className="text-[10px] sm:text-xs font-mono font-bold text-amber-900/90">
                    {sortedAttempts[0].score.rawMarks}/{sortedAttempts[0].score.totalMarks} Marks
                  </div>
                  <div className="text-[9px] sm:text-xs text-amber-900/80 font-semibold mt-0.5 hidden xs:block truncate max-w-full">
                    {(sortedAttempts[0].correctCount ?? 0) + (sortedAttempts[0].wrongCount ?? 0)}/{sortedAttempts[0].totalQuestions || q.questions?.length || 50} Qs Attended
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {sortedAttempts[0].correctCount ?? (sortedAttempts[0].answers?.filter((a: any) => a.isCorrect).length || 0)} Correct
                  </div>
                  <div className="text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-semibold text-slate-600">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" /> {sortedAttempts[0].totalTimeTakenSec ? `${Math.floor(sortedAttempts[0].totalTimeTakenSec / 60)}m` : "< 1m"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectStudentAttempt(sortedAttempts[0])}
                    className="mt-2 w-full max-w-[130px] py-1 sm:py-1.5 px-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-[10px] sm:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-slate-950" />
                    <span className="hidden sm:inline">View</span> Sheet
                  </button>
                  {/* Stepped Pedestal Base */}
                  <div className="mt-2.5 sm:mt-3.5 w-full h-10 sm:h-14 rounded-xl bg-linear-to-b from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 font-display font-black text-base sm:text-2xl shadow-inner border-t border-amber-200">
                    1
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze - Right) */}
              {sortedAttempts[2] ? (
                <div className="p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-amber-200/80 bg-linear-to-b from-amber-50/40 via-amber-100/40 to-amber-200/50 flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-xs">
                  <div className="absolute -top-3 sm:-top-4 px-2 sm:px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] sm:text-[11px] font-black shadow-xs flex items-center gap-1 ring-2 ring-white">
                    <Medal className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-700" /> 3RD RANK
                  </div>
                  <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-br from-amber-100 to-amber-300 border-2 border-white shadow-sm flex items-center justify-center font-display font-bold text-sm sm:text-xl text-amber-900 ring-2 ring-amber-300/50 mt-1">
                    {sortedAttempts[2].studentName.charAt(0).toUpperCase()}
                  </div>
                  <h5 className="font-display font-bold text-[11px] sm:text-sm mt-1.5 truncate w-full text-slate-900 px-0.5">
                    {sortedAttempts[2].studentName}
                  </h5>
                  <div className="text-[11px] sm:text-base font-mono font-black text-slate-900 mt-0.5 leading-tight">
                    {sortedAttempts[2].score.percentage}%
                  </div>
                  <div className="text-[9px] sm:text-xs font-mono font-bold text-slate-600">
                    {sortedAttempts[2].score.rawMarks}/{sortedAttempts[2].score.totalMarks} Marks
                  </div>
                  <div className="text-[9px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden xs:block truncate max-w-full">
                    {(sortedAttempts[2].correctCount ?? 0) + (sortedAttempts[2].wrongCount ?? 0)}/{sortedAttempts[2].totalQuestions || q.questions?.length || 50} Qs Attended
                  </div>
                  <div className="text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-medium text-slate-500">
                    <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" /> {sortedAttempts[2].totalTimeTakenSec ? `${Math.floor(sortedAttempts[2].totalTimeTakenSec / 60)}m` : "< 1m"}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectStudentAttempt(sortedAttempts[2])}
                    className="mt-2 w-full max-w-[120px] py-1 sm:py-1.5 px-2 rounded-xl bg-white hover:bg-amber-100/80 text-amber-900 border border-amber-200 text-[10px] sm:text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3 h-3 text-amber-700" />
                    <span className="hidden sm:inline">View</span> Sheet
                  </button>
                  {/* Stepped Pedestal Base */}
                  <div className="mt-2.5 sm:mt-3.5 w-full h-5 sm:h-8 rounded-xl bg-linear-to-b from-amber-300 to-amber-400 flex items-center justify-center text-amber-950 font-display font-black text-xs sm:text-base shadow-inner border-t border-amber-100">
                    3
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center opacity-60">
                  <p className="text-[10px] sm:text-xs py-6 text-slate-400">No 3rd rank</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grade Distribution */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-slate-700" /> Grade Distribution
          </h3>
          <div className="flex items-end gap-3 h-32">
            {gradeDist.map(d => (
              <div key={d.grade} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-xs font-mono text-slate-500 font-bold">{d.count}</span>
                <div className={`w-full rounded-t transition-all ${d.grade === "F" ? "bg-rose-500" : "bg-slate-800"}`}
                  style={{ height: `${(d.count / maxGradeCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }} />
                <span className="text-xs font-bold text-slate-800">{d.grade}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Student Tables */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <h3 className="p-4 border-b border-slate-200 font-display font-bold text-slate-900 flex items-center justify-between bg-slate-50">
              <span>✅ Attended Students ({submitted.length})</span>
              <span className="text-xs text-slate-500 font-normal">Click student to inspect sheet</span>
            </h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-600 font-bold text-left">
                    <th className="p-3.5 pl-4 w-14">Rank</th>
                    <th className="p-3.5 min-w-[120px]">Student</th>
                    <th className="p-3.5 text-center min-w-[100px] whitespace-nowrap">Score & Qs</th>
                    <th className="p-3.5 text-center min-w-[70px] whitespace-nowrap">%</th>
                    <th className="p-3.5 text-center min-w-[120px] whitespace-nowrap">Breakdown</th>
                    <th className="p-3.5 pr-4 text-right min-w-[100px] whitespace-nowrap">Sheet</th>
                  </tr>
                </thead>
                <tbody>
                  {submitted.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500 text-sm">No submissions yet.</td></tr>}
                  {sortedAttempts.map((att: any, index: number) => {
                    const rankNum = index + 1;
                    const isTop1 = rankNum === 1;
                    const isTop2 = rankNum === 2;
                    const isTop3 = rankNum === 3;
                    const attendedCount = (att.correctCount ?? 0) + (att.wrongCount ?? 0);
                    const totalQs = att.totalQuestions || q.questions.length || 50;

                    return (
                      <tr key={att.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 pl-4">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${isTop1
                            ? "bg-amber-400 text-slate-950 font-black shadow-2xs"
                            : isTop2
                              ? "bg-slate-200 text-slate-800 font-bold border border-slate-300"
                              : isTop3
                                ? "bg-amber-100 text-amber-900 font-bold border border-amber-300"
                                : "bg-slate-100 text-slate-600 font-medium"
                            }`}>
                            #{rankNum}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 text-sm">{att.studentName}</div>
                          {att.studentEmail && (
                            <div className="text-xs text-slate-500 truncate max-w-[120px]">{att.studentEmail}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {att.score.rawMarks}/{att.score.totalMarks} Marks
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {attendedCount}/{totalQs} Attended
                          </div>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                            {att.score.percentage}%
                          </span>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold" title="Correct">
                              ✓ {att.correctCount ?? (att.answers?.filter((a: any) => a.isCorrect).length || 0)}
                            </span>
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-semibold" title="Wrong">
                              ✗ {att.wrongCount ?? (att.answers?.filter((a: any) => a.isAttempted && !a.isCorrect).length || 0)}
                            </span>
                            <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-medium" title="Skipped">
                              ⊘ {att.unattemptedCount ?? (att.answers?.filter((a: any) => !a.isAttempted).length || 0)}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setInspectStudentAttempt(att)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>View Sheet</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <h3 className="p-4 border-b border-slate-200 font-display font-bold text-slate-900 bg-slate-50">
              ⏳ Absent Students ({absent.length})
            </h3>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-600 font-bold text-left">
                    <th className="p-3.5 pl-4">Student</th><th>Enrollment ID</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {absent.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-500 text-sm">100% attendance! 🎉</td></tr>}
                  {absent.map(ab => (
                    <tr key={ab.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="p-3.5 pl-4 font-bold text-slate-900">{ab.name}</td>
                      <td className="font-mono text-slate-600 text-xs">{ab.enrollmentId}</td>
                      <td><span className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">Not Attempted</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Question-wise Analysis */}
        {questionStats.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="font-display font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-700" /> Question-wise Analysis
            </h3>
            <div className="space-y-3">
              {questionStats.map((qs, i) => (
                <div key={qs.id} className="rounded-xl bg-slate-50 p-3 border border-slate-200/80">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-2">Q{i + 1} · {qs.type.toUpperCase()} · {qs.marks}m</span>
                      <span className="text-slate-900 text-sm font-medium">{qs.text}</span>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${qs.pct >= 60 ? "text-emerald-700" : "text-rose-600"}`}>{qs.pct}% correct</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full rounded-full ${qs.pct >= 60 ? "bg-emerald-600" : "bg-rose-500"}`} style={{ width: `${qs.pct}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">{qs.correctCount} of {qs.total} students answered correctly</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answer Sheet Inspector Modal */}
        {inspectStudentAttempt && (
          <AdminStudentAnswerSheetModal
            isOpen={Boolean(inspectStudentAttempt)}
            onClose={() => setInspectStudentAttempt(null)}
            studentName={inspectStudentAttempt.studentName}
            studentEmail={inspectStudentAttempt.studentEmail}
            quizTitle={q.title}
            rank={inspectStudentAttempt.rank}
            score={inspectStudentAttempt.score}
            totalTimeTakenSec={inspectStudentAttempt.totalTimeTakenSec}
            submittedAt={inspectStudentAttempt.submittedAt}
            answers={inspectStudentAttempt.answers || []}
          />
        )}
      </div>
    );
  }

  const activeQuizzes = allQuizzes.filter(q => q.status === "published").length;
  const allAttempts = allQuizzes.flatMap(q => q.attempts);
  const gradedAttempts = allAttempts.filter(a => a.status === "submitted");
  const avgScore = gradedAttempts.length
    ? Math.round(gradedAttempts.reduce((s, a) => s + a.score.percentage, 0) / gradedAttempts.length)
    : 0;
  const passRate = gradedAttempts.length
    ? Math.round(gradedAttempts.filter(a => a.score.passed).length / gradedAttempts.length * 100) : 0;

  return (
    <div className="space-y-6 text-cream">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Exams</h1>
          <p className="text-cream/60 text-sm mt-1">Schedule, proctor and grade assessments across classrooms</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Total Exams", v: allQuizzes.length, i: ClipboardList },
          { l: "Published", v: activeQuizzes, i: AlertCircle },
          { l: "Submissions", v: gradedAttempts.length, i: Users },
          { l: "Avg Score", v: `${avgScore}%`, i: CheckCircle2 },
        ].map(s => (
          <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-4 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-lime/15 text-lime"><s.i className="h-4 w-4" /></div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.l}</div>
              <div className="font-display text-xl font-bold">{s.v}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)} className="bg-[#1A0F45] border border-cream/10 rounded-full px-4 py-2 text-sm text-cream outline-none">
          {batches.map(b => <option key={b} value={b}>{b === "All" ? "All Batches" : b}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#1A0F45] border border-cream/10 rounded-full px-4 py-2 text-sm text-cream outline-none">
          {statuses.map(s => <option key={s} value={s} className="capitalize">{s === "All" ? "All Statuses" : s}</option>)}
        </select>
      </div>

      <DarkCard className="p-0 overflow-hidden">
        <div className="p-5 border-b border-cream/10 flex justify-between items-center">
          <h3 className="font-display font-bold">All Exam Assessments ({filtered.length})</h3>
          <div className="text-xs text-cream/60">Overall pass rate: <span className="text-lime font-bold">{passRate}%</span></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/5">
              <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                <th className="p-4">Exam</th><th>Course / Batch</th><th>Date</th><th>Duration</th><th>Type</th><th>Students</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-cream/50">No exams found.</td></tr>}
              {filtered.map(q => (
                <tr key={q.id} className="border-t border-cream/10 hover:bg-cream/5 cursor-pointer" onClick={() => setViewQuizId(q.id)}>
                  <td className="p-4">
                    <div className="font-semibold">{q.title}</div>
                    <div className="text-cream/50 text-[10px] mt-0.5">{q.questions.length} questions · {q.attempts.length} attempts</div>
                  </td>
                  <td className="text-cream/70">
                    <div>{q.course}</div>
                    <div className="text-[10px] text-cream/50">{q.batch}</div>
                  </td>
                  <td className="text-cream/70 text-xs">{new Date(q.availableFrom).toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" })}</td>
                  <td className="font-mono text-xs">{q.duration ? `${q.duration}m` : "No limit"}</td>
                  <td className="text-xs text-cream/70">{q.examType}</td>
                  <td className="font-mono">{q.attempts.filter(a => a.status === "submitted").length} / {q.studentsCount}</td>
                  <td><span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded capitalize ${q.status === "published" ? "bg-lime/20 text-lime" : q.status === "closed" ? "bg-red-500/20 text-red-300" : "bg-cream/10 text-cream/70"}`}>{q.status}</span></td>
                  <td><button onClick={e => { e.stopPropagation(); setViewQuizId(q.id); }} className="text-xs text-lime font-bold rounded-full bg-lime/10 px-3 py-1.5 hover:bg-lime/20 transition-colors">Details →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DarkCard>
    </div>
  );
}
