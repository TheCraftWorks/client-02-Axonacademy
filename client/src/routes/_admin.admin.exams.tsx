import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Users, CheckCircle2, AlertCircle, ArrowLeft, BarChart2, BookOpen } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore, getExamType, getGrade, classroomActions } from "@/lib/classroomStore";
import { publishQuiz, closeQuiz } from "@/lib/api";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_admin/admin/exams")({
  component: AdminExams,
});

function AdminExams() {
  const { classrooms } = useClassroomStore();
  const [viewQuizId, setViewQuizId] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isUpdatingQuiz, setIsUpdatingQuiz] = useState<string | null>(null);

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
    const submitted = q.attempts.filter(a => a.status === "submitted");
    const submittedIds = new Set(submitted.map(a => a.studentId));
    const absent = q.students.filter(s => !submittedIds.has(s.id));
    const passCount = submitted.filter(a => a.score.passed).length;
    const failCount = submitted.length - passCount;
    const passRate = submitted.length ? Math.round((passCount / submitted.length) * 100) : 0;
    const avgScore = submitted.length ? Math.round(submitted.reduce((s, a) => s + a.score.percentage, 0) / submitted.length) : 0;

    // Grade distribution
    const gradeDist = ["A+", "A", "B+", "B", "C", "F"].map(g => ({
      grade: g,
      count: submitted.filter(a => getGrade(a.score.percentage) === g).length,
    }));
    const maxGradeCount = Math.max(...gradeDist.map(d => d.count), 1);

    // Per-question analysis
    const questionStats = q.questions.map(ques => {
      const correct = submitted.filter(att => {
        const ans = (att.answers || []).find(a => a.questionId === ques.id);
        return ans?.isCorrect;
      }).length;
      return { ...ques, correctCount: correct, total: submitted.length, pct: submitted.length ? Math.round((correct / submitted.length) * 100) : 0 };
    });

    return (
      <div className="space-y-6 text-cream">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewQuizId(null)} className="text-cream/60 hover:text-cream"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex-1">
            <h2 className="font-display font-bold text-cream text-2xl">{q.title}</h2>
            <p className="text-cream/60 text-sm mt-0.5">{q.course} · {q.classroomName} · <span className="text-lime">{q.examType}</span> · {q.questions.length} questions</p>
          </div>
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
              className="rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold disabled:opacity-50">
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
              className="rounded-full bg-cream/10 text-cream px-4 py-2 text-xs font-semibold disabled:opacity-50">
              {isUpdatingQuiz === q.id ? 'Closing...' : 'Close Exam'}
            </button>
          )}
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.l}</div>
              <div className="font-display text-2xl font-bold text-cream mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        {/* Grade Distribution */}
        <DarkCard>
          <h3 className="font-display font-bold mb-4 flex items-center gap-2"><BarChart2 className="h-4 w-4 text-lime" /> Grade Distribution</h3>
          <div className="flex items-end gap-3 h-32">
            {gradeDist.map(d => (
              <div key={d.grade} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-xs font-mono text-cream/60">{d.count}</span>
                <div className={`w-full rounded-t transition-all ${d.grade === "F" ? "bg-red-400/60" : d.grade === "A+" ? "bg-lime" : "bg-lime/50"}`}
                  style={{ height: `${(d.count / maxGradeCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "0" }} />
                <span className="text-xs font-bold text-cream/80">{d.grade}</span>
              </div>
            ))}
          </div>
        </DarkCard>

        {/* Student Tables */}
        <div className="grid lg:grid-cols-2 gap-6">
          <DarkCard className="p-0 overflow-hidden">
            <h3 className="p-4 border-b border-cream/10 font-display font-bold">
              ✅ Attended Students ({submitted.length})
            </h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-cream/5 sticky top-0">
                  <tr className="text-[10px] uppercase tracking-widest text-cream/60 text-left">
                    <th className="p-4">Student</th><th>Score</th><th>%</th><th>Grade</th><th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {submitted.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-cream/50 text-sm">No submissions yet.</td></tr>}
                  {submitted.sort((a, b) => b.score.percentage - a.score.percentage).map(att => (
                    <tr key={att.id} className="border-t border-cream/10 hover:bg-cream/5">
                      <td className="p-4 font-semibold text-cream">{att.studentName}</td>
                      <td className="font-mono text-cream/80">{att.score.rawMarks}/{att.score.totalMarks}</td>
                      <td className="font-mono text-cream/80">{att.score.percentage}%</td>
                      <td className="font-mono text-cream font-bold">{getGrade(att.score.percentage)}</td>
                      <td><span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${att.score.passed ? "bg-lime/20 text-lime" : "bg-red-500/20 text-red-300"}`}>{att.score.passed ? "Pass" : "Fail"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DarkCard>

          <DarkCard className="p-0 overflow-hidden">
            <h3 className="p-4 border-b border-cream/10 font-display font-bold">
              ⏳ Absent Students ({absent.length})
            </h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-sm">
                <thead className="bg-cream/5 sticky top-0">
                  <tr className="text-[10px] uppercase tracking-widest text-cream/60 text-left">
                    <th className="p-4">Student</th><th>Enrollment ID</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {absent.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-cream/50 text-sm">100% attendance! 🎉</td></tr>}
                  {absent.map(ab => (
                    <tr key={ab.id} className="border-t border-cream/10 hover:bg-cream/5">
                      <td className="p-4 font-semibold text-cream">{ab.name}</td>
                      <td className="font-mono text-cream/70 text-xs">{ab.enrollmentId}</td>
                      <td><span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-yellow-500/20 text-yellow-300">Not Attempted</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DarkCard>
        </div>

        {/* Question-wise Analysis */}
        {questionStats.length > 0 && (
          <DarkCard>
            <h3 className="font-display font-bold mb-4 flex items-center gap-2"><BookOpen className="h-4 w-4 text-lime" /> Question-wise Analysis</h3>
            <div className="space-y-3">
              {questionStats.map((qs, i) => (
                <div key={qs.id} className="rounded-xl bg-cream/5 p-3">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <span className="text-[10px] text-lime font-bold uppercase tracking-widest mr-2">Q{i + 1} · {qs.type.toUpperCase()} · {qs.marks}m</span>
                      <span className="text-cream/80 text-sm">{qs.text}</span>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${qs.pct >= 60 ? "text-lime" : "text-red-400"}`}>{qs.pct}% correct</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cream/10 overflow-hidden">
                    <div className={`h-full rounded-full ${qs.pct >= 60 ? "bg-lime" : "bg-red-400"}`} style={{ width: `${qs.pct}%` }} />
                  </div>
                  <div className="text-[10px] text-cream/50 mt-1">{qs.correctCount} of {qs.total} students answered correctly</div>
                </div>
              ))}
            </div>
          </DarkCard>
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
