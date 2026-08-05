import { createFileRoute, Navigate } from "@tanstack/react-router";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore, getGrade } from "@/lib/classroomStore";
import { useMemo } from "react";
import { Users, BookOpen, TrendingUp, Clock, AlertTriangle, Award } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/analytics")({
  component: Analytics,
});

function Analytics() {
  const { currentUser } = useClassroomStore();
  if (currentUser?.role === "faculty") {
    return <Navigate to="/admin/classrooms" />;
  }
  const { classrooms, courses } = useClassroomStore();

  const stats = useMemo(() => {
    const allStudents = classrooms.flatMap(c => c.students.filter(s => s.status === "active"));
    const uniqueStudentIds = new Set(allStudents.map(s => s.id));
    const totalStudents = uniqueStudentIds.size;
    const totalClassrooms = classrooms.filter(c => c.status === "active").length;

    const avgProgress = allStudents.length
      ? Math.round(allStudents.reduce((s, st) => s + st.progress, 0) / allStudents.length) : 0;

    const totalWatchSeconds = classrooms.reduce((s, c) =>
      s + c.recordings.reduce((ss, r) =>
        ss + r.viewStats.reduce((sss, vs) => sss + (vs.watchedPercent / 100) * r.duration, 0), 0), 0);
    const totalHours = Math.round(totalWatchSeconds / 3600);

    const allAttempts = classrooms.flatMap(c => c.quizzes.flatMap(q => q.attempts.filter(a => a.status === "submitted")));
    const passAttempts = allAttempts.filter(a => a.score.passed).length;
    const failAttempts = allAttempts.length - passAttempts;
    const avgQuizScore = allAttempts.length ? Math.round(allAttempts.reduce((s, a) => s + a.score.percentage, 0) / allAttempts.length) : 0;

    // Completion rates per classroom
    const completionRates = classrooms.map(c => {
      const avgProg = c.students.length > 0
        ? Math.round(c.students.reduce((s, st) => s + st.progress, 0) / c.students.length) : 0;
      return { name: c.name, prog: avgProg, program: c.program, count: c.students.filter(s => s.status === "active").length };
    });

    // Top performers (by quiz avg across classrooms they appear in)
    const studentPerf: Record<string, { name: string; scores: number[]; progress: number[] }> = {};
    classrooms.forEach(c => {
      c.students.forEach(st => {
        if (!studentPerf[st.id]) studentPerf[st.id] = { name: st.name, scores: [], progress: [] };
        studentPerf[st.id].progress.push(st.progress);
        if (st.quizAvg > 0) studentPerf[st.id].scores.push(st.quizAvg);
      });
      c.quizzes.forEach(q => q.attempts.filter(a => a.status === "submitted").forEach(a => {
        if (studentPerf[a.studentId]) studentPerf[a.studentId].scores.push(a.score.percentage);
      }));
    });
    const topPerformers = Object.entries(studentPerf).map(([id, d]) => ({
      id, name: d.name,
      avgScore: d.scores.length ? Math.round(d.scores.reduce((s, x) => s + x, 0) / d.scores.length) : 0,
      avgProgress: d.progress.length ? Math.round(d.progress.reduce((s, x) => s + x, 0) / d.progress.length) : 0,
    })).sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);

    // At-risk students
    const atRisk = classrooms.flatMap(c =>
      c.students.filter(s => s.status === "at risk" || (s.status === "active" && s.progress < 30))
        .map(s => ({ ...s, program: c.program, classroom: c.name }))
    );

    // Monthly revenue (based on addedAt month)
    const monthlyRev: Record<string, number> = {};
    classrooms.forEach(c => {
      const course = courses.find(x => x.title === c.program);
      const price = course?.price || 0;
      c.students.forEach(s => {
        const month = new Date(s.addedAt).toLocaleDateString("en-IN", { year: "2-digit", month: "short" });
        monthlyRev[month] = (monthlyRev[month] || 0) + price;
      });
    });
    const monthKeys = Object.keys(monthlyRev).slice(-6);
    const maxRev = Math.max(...monthKeys.map(m => monthlyRev[m]), 1);

    // Recording engagement
    const recEngagement = classrooms.flatMap(c =>
      c.recordings.filter(r => r.isPublished && r.viewStats.length > 0).map(r => ({
        title: r.title,
        classroom: c.name,
        avgWatch: Math.round(r.viewStats.reduce((s, v) => s + v.watchedPercent, 0) / r.viewStats.length),
        viewers: r.viewStats.length,
      }))
    ).sort((a, b) => b.avgWatch - a.avgWatch);

    return {
      totalStudents, totalClassrooms, avgProgress, totalHours,
      allAttempts, passAttempts, failAttempts, avgQuizScore,
      completionRates, topPerformers, atRisk,
      monthKeys, monthlyRev, maxRev, recEngagement,
    };
  }, [classrooms, courses]);

  return (
    <div className="space-y-6 text-cream">
      <div>
        <h1 className="font-display text-3xl font-bold">Analytics</h1>
        <p className="text-cream/60 text-sm mt-1">Cohort performance, engagement, and outcomes — all real-time</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: "Total Students", v: stats.totalStudents, icon: Users, color: "text-lime" },
          { l: "Active Classrooms", v: stats.totalClassrooms, icon: BookOpen, color: "text-lime" },
          { l: "Avg Progress", v: `${stats.avgProgress}%`, icon: TrendingUp, color: "text-lime" },
          { l: "Total Hours Watched", v: `${stats.totalHours}h`, icon: Clock, color: "text-lime" },
        ].map(s => (
          <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.l}</div>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div className="font-display text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Classroom Completion Rates */}
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-5">Classroom Completion Rates</h3>
          <div className="space-y-4">
            {stats.completionRates.length === 0 && <span className="text-xs text-cream/50">No data available.</span>}
            {stats.completionRates.map(r => (
              <div key={r.name}>
                <div className="flex justify-between text-sm mb-1">
                  <div>
                    <span className="font-semibold text-xs truncate max-w-[200px] block">{r.name}</span>
                    <span className="text-[10px] text-cream/50">{r.count} students</span>
                  </div>
                  <span className="font-mono text-lime font-bold">{r.prog}%</span>
                </div>
                <div className="h-2 rounded-full bg-cream/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-plum-light to-lime rounded-full transition-all" style={{ width: `${r.prog}%` }} />
                </div>
              </div>
            ))}
          </div>
        </DarkCard>

        {/* Quiz Pass/Fail Donut */}
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-5">Quiz Performance Overview</h3>
          {stats.allAttempts.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="relative h-40 w-40 shrink-0">
                <div className="absolute inset-0 rounded-full" style={{
                  background: `conic-gradient(#C5F542 0 ${stats.passAttempts / stats.allAttempts.length * 100}%, #f87171 ${stats.passAttempts / stats.allAttempts.length * 100}% 100%)`
                }} />
                <div className="absolute inset-6 rounded-full bg-[#1A0F33] grid place-items-center">
                  <div className="text-center">
                    <div className="font-display text-2xl font-bold">{stats.avgQuizScore}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-cream/60">Avg Score</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded bg-lime shrink-0" />
                  <span className="flex-1">Passed</span>
                  <span className="font-mono text-lime font-bold">{stats.passAttempts}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 rounded bg-red-400 shrink-0" />
                  <span className="flex-1">Failed</span>
                  <span className="font-mono text-red-400 font-bold">{stats.failAttempts}</span>
                </div>
                <div className="pt-2 border-t border-cream/10">
                  <div className="text-xs text-cream/60">Total Submissions</div>
                  <div className="font-display text-xl font-bold">{stats.allAttempts.length}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-cream/50 text-sm">No quiz submissions yet.</p>
          )}
        </DarkCard>
      </div>

      {/* Monthly Revenue Chart */}
      <DarkCard>
        <h3 className="font-display font-bold text-lg mb-5">Monthly Revenue (Enrollment-based)</h3>
        {stats.monthKeys.length > 0 ? (
          <div className="flex items-end gap-3 h-48">
            {stats.monthKeys.map(m => (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-mono text-cream/60">₹{Math.round(stats.monthlyRev[m] / 1000)}K</span>
                <div className="w-full rounded-t bg-gradient-to-t from-lime/60 to-lime transition-all"
                  style={{ height: `${(stats.monthlyRev[m] / stats.maxRev) * 100}%`, minHeight: "4px" }} />
                <span className="text-[9px] text-cream/50 font-mono">{m}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-cream/50 text-sm">No enrollment data yet.</p>
        )}
      </DarkCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-lime" /> Top Performers</h3>
          {stats.topPerformers.length === 0 ? (
            <p className="text-cream/50 text-sm">No quiz data yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.topPerformers.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 rounded-xl bg-cream/5 px-3 py-2.5">
                  <div className={`grid h-7 w-7 place-items-center rounded-full font-bold text-xs shrink-0 ${i === 0 ? "bg-yellow-400 text-yellow-900" : i === 1 ? "bg-gray-400 text-gray-900" : i === 2 ? "bg-orange-400 text-orange-900" : "bg-cream/10 text-cream"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-cream font-semibold text-sm">{s.name}</div>
                    <div className="text-cream/50 text-xs">Progress: {s.avgProgress}%</div>
                  </div>
                  <span className={`font-mono text-sm font-bold ${s.avgScore >= 90 ? "text-lime" : s.avgScore >= 60 ? "text-yellow-300" : "text-red-400"}`}>{s.avgScore}%</span>
                </div>
              ))}
            </div>
          )}
        </DarkCard>

        {/* At-Risk Students */}
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" /> At-Risk Students</h3>
          {stats.atRisk.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-cream/60 text-sm">No at-risk students! Great performance.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.atRisk.map(s => (
                <div key={s.id + s.program} className="flex items-center gap-3 rounded-xl bg-red-500/5 border border-red-500/20 px-3 py-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-red-500/20 text-red-300 text-xs font-bold shrink-0">
                    {s.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="text-cream font-semibold text-sm">{s.name}</div>
                    <div className="text-cream/50 text-xs">{s.program}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 font-mono text-sm font-bold">{s.progress}%</div>
                    <div className="text-cream/40 text-[10px]">progress</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DarkCard>
      </div>

      {/* Recording Engagement */}
      {stats.recEngagement.length > 0 && (
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-4">Recording Engagement</h3>
          <div className="space-y-3">
            {stats.recEngagement.map(r => (
              <div key={r.title}>
                <div className="flex justify-between text-sm mb-1">
                  <div>
                    <span className="text-cream font-semibold text-xs">{r.title}</span>
                    <span className="text-cream/50 text-[10px] block">{r.classroom} · {r.viewers} viewer{r.viewers !== 1 ? "s" : ""}</span>
                  </div>
                  <span className={`font-mono text-sm font-bold ${r.avgWatch >= 80 ? "text-lime" : r.avgWatch >= 50 ? "text-yellow-300" : "text-red-400"}`}>{r.avgWatch}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-cream/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${r.avgWatch >= 80 ? "bg-lime" : r.avgWatch >= 50 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${r.avgWatch}%` }} />
                </div>
              </div>
            ))}
          </div>
        </DarkCard>
      )}
    </div>
  );
}
