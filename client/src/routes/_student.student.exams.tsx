import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardList, CheckCircle2, Clock, AlertCircle, ChevronRight } from "lucide-react";
import { Card } from "@/components/portal/PortalShell";
import { useClassroomStore, getGrade } from "@/lib/classroomStore";

export const Route = createFileRoute("/_student/student/exams")({
  component: Exams,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso?: string) {
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
}

// ─── Exams Page ───────────────────────────────────────────────────────────────

function Exams() {
  const navigate = useNavigate();
  const { classrooms, currentUser } = useClassroomStore();
  const currentEmail = (currentUser?.email || "").toLowerCase();

  const isMyAttempt = (a: any) =>
    a.studentId === currentUser?.id ||
    a.studentId === currentUser?.userId ||
    (currentEmail && a.studentEmail && a.studentEmail.toLowerCase() === currentEmail);

  const enrolledClassrooms = classrooms.filter((c) =>
    c.students.some(
      (s) =>
        (s.id === currentUser?.id ||
          s.id === currentUser?.userId ||
          (s.email && currentEmail && s.email.toLowerCase() === currentEmail)) &&
        s.status === "active"
    )
  );

  const allQuizzes = enrolledClassrooms.flatMap((c) =>
    (c.quizzes || [])
      .filter((q) => q.status === "published")
      .map((q) => ({ ...q, classroomName: c.name, classroomId: c.id }))
  );

  const completedAttempts = allQuizzes.flatMap((q) =>
    (q.attempts || [])
      .filter((a) => isMyAttempt(a) && a.status === "submitted")
      .map((a) => ({
        ...a,
        quizId: q.id,
        quizTitle: q.title,
        classroomName: q.classroomName,
        classroomId: q.classroomId,
        parentQuiz: q,
      }))
  );

  const avgScore = completedAttempts.length
    ? Math.round(
        completedAttempts.reduce((s, a) => s + (a.score?.percentage || 0), 0) /
          completedAttempts.length
      )
    : 0;

  const handleStartExam = (quiz: (typeof allQuizzes)[0]) => {
    navigate({
      to: "/student/classroom/$id",
      params: { id: quiz.classroomId },
      search: {
        tab: "tests",
        quizId: quiz.id,
        action: "start",
      },
    });
  };

  const handleViewResult = (classroomId: string, quizId: string, attemptId?: string) => {
    navigate({
      to: "/student/classroom/$id",
      params: { id: classroomId },
      search: {
        tab: "tests",
        quizId: quizId,
        action: "result",
        attemptId: attemptId,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold" style={{ color: "#0B1F3A" }}>
          Exams & Assessments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Proctored finals, mock tests and smart classroom quizzes
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { k: "Average Score", v: `${avgScore}%`, icon: CheckCircle2 },
          { k: "Exams Taken", v: completedAttempts.length.toString(), icon: ClipboardList },
          { k: "Available Tests", v: allQuizzes.length.toString(), icon: Clock },
        ].map((s) => (
          <Card key={s.k} className="flex items-center gap-4">
            <div
              className="grid h-12 w-12 place-items-center rounded-xl"
              style={{ background: "rgba(45,156,219,0.1)", color: "#2D9CDB" }}
            >
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</div>
              <div className="font-display text-2xl font-bold" style={{ color: "#0B1F3A" }}>
                {s.v}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Available Exams & Quizzes */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg" style={{ color: "#0B1F3A" }}>
            Available Exams & Quizzes
          </h3>
        </div>
        <div className="space-y-3">
          {allQuizzes.map((e) => {
            const myAttempts = (e.attempts || []).filter(isMyAttempt);
            const submittedAttempts = myAttempts.filter((a) => a.status === "submitted");
            const bestAttempt = submittedAttempts.sort(
              (a, b) => (b.score?.percentage || 0) - (a.score?.percentage || 0)
            )[0];
            const attemptsLeft = e.maxAttempts - submittedAttempts.length;
            const hasAttemptsLeft = attemptsLeft > 0;

            const now = Date.now();
            const startTime = e.availableFrom ? new Date(e.availableFrom).getTime() : null;
            const endTime = e.availableUntil ? new Date(e.availableUntil).getTime() : null;
            const isNotStarted = startTime !== null && !isNaN(startTime) && startTime > now;
            const isExpired = endTime !== null && !isNaN(endTime) && endTime < now;
            const canTake = hasAttemptsLeft && !isNotStarted && !isExpired;
            const isClickable = canTake || submittedAttempts.length > 0;

            return (
              <div
                key={e.id}
                onClick={() => {
                  if (canTake) {
                    handleStartExam(e);
                  } else if (submittedAttempts.length > 0) {
                    handleViewResult(e.classroomId, e.id, bestAttempt?.id);
                  }
                }}
                className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-border p-4 transition-all ${
                  isClickable
                    ? "cursor-pointer hover:border-sky-400 hover:shadow-md active:scale-[0.995]"
                    : ""
                }`}
              >
                <div
                  className="grid h-12 w-12 place-items-center rounded-xl shrink-0"
                  style={{ background: "#0B1F3A" }}
                >
                  <ClipboardList className="h-5 w-5" style={{ color: "#F4B400" }} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold" style={{ color: "#0B1F3A" }}>
                    {e.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{e.duration ? `${e.duration} min timer` : "No limit"}</span>
                    <span>·</span>
                    <span>{e.questions?.length || 0} questions</span>
                    <span>·</span>
                    <span>Pass: {e.passPercent}%</span>
                    <span>·</span>
                    <span className="font-medium text-slate-700">
                      Attempts: {submittedAttempts.length}/{e.maxAttempts}
                    </span>
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
                  <div
                    className="text-[10px] uppercase tracking-widest mt-1.5 font-medium"
                    style={{ color: "rgba(11,31,58,0.6)" }}
                  >
                    {e.classroomName}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {submittedAttempts.length > 0 && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleViewResult(e.classroomId, e.id, bestAttempt?.id);
                      }}
                      className="rounded-full border border-slate-300 text-slate-800 hover:border-slate-900 hover:bg-slate-100 text-xs font-semibold px-4 py-2 transition-all shadow-2xs"
                    >
                      View Result ({bestAttempt?.score?.percentage || 0}%)
                    </button>
                  )}

                  {isNotStarted ? (
                    <span className="text-xs text-muted-foreground rounded-full border border-border px-4 py-2">
                      Starts Soon
                    </span>
                  ) : isExpired && submittedAttempts.length === 0 ? (
                    <span className="text-xs text-red-600 rounded-full border border-red-200 bg-red-50 px-4 py-2 font-medium">
                      Deadline Passed
                    </span>
                  ) : canTake ? (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleStartExam(e);
                      }}
                      className="rounded-full text-white text-xs font-semibold px-4 py-2 transition-all hover:brightness-110 active:scale-95 flex items-center gap-1"
                      style={{ background: "#0B1F3A" }}
                    >
                      <span>{submittedAttempts.length > 0 ? "Retake Test" : "Start Exam"}</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {allQuizzes.length === 0 && (
            <p className="text-sm text-muted-foreground">No exams or quizzes available yet. 🎉</p>
          )}
        </div>
      </Card>

      {/* Results Table */}
      <Card>
        <h3 className="font-display font-bold text-lg mb-4" style={{ color: "#0B1F3A" }}>
          Recent Results
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="pb-3">Exam</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Score</th>
                <th className="pb-3">Grade</th>
                <th className="pb-3">Result</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {completedAttempts
                .sort(
                  (a, b) =>
                    new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
                )
                .map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleViewResult(r.classroomId, r.quizId, r.id)}
                    className="border-b border-border/60 last:border-0 hover:bg-sky-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 font-semibold" style={{ color: "#0B1F3A" }}>
                      {r.quizTitle}
                      <div className="text-[10px] font-normal uppercase tracking-widest text-muted-foreground mt-0.5">
                        {r.classroomName}
                      </div>
                    </td>
                    <td className="py-3.5 text-muted-foreground">
                      {r.submittedAt
                        ? new Date(r.submittedAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </td>
                    <td className="py-3.5">
                      <span className="font-mono font-bold">{r.score.percentage}%</span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded"
                        style={
                          r.score.passed
                            ? { background: "rgba(244,180,0,0.15)", color: "#B8870A" }
                            : { background: "rgba(239,68,68,0.1)", color: "#B91C1C" }
                        }
                      >
                        {getGrade(r.score.percentage)}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded"
                        style={
                          r.score.passed
                            ? { background: "rgba(22,163,74,0.12)", color: "#16A34A" }
                            : { background: "rgba(239,68,68,0.1)", color: "#B91C1C" }
                        }
                      >
                        {r.score.passed ? "Passed" : "Failed"}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewResult(r.classroomId, r.quizId, r.id);
                        }}
                        className="rounded-full border border-slate-300 text-slate-800 hover:border-slate-900 hover:bg-slate-100 text-xs font-bold px-3.5 py-1 transition-colors shadow-2xs inline-flex items-center gap-1"
                      >
                        <span>View Result</span>
                        <ChevronRight className="w-3 h-3 text-slate-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              {completedAttempts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No results yet. Attempt an exam above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3 items-start">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-amber-900">Proctoring requirements</div>
          <div className="text-amber-800 mt-0.5">
            A working webcam and quiet room are required for all proctored exams. Test your setup 24h
            before the exam.
          </div>
        </div>
      </div>
    </div>
  );
}
