import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Trophy, Clock, BookOpen, PlayCircle, ChevronRight, CheckCircle2, Radio, Download,
  Crown, Medal, Sparkles, Award
} from "lucide-react";
import { Card, StatTile } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import { useQuery } from "@tanstack/react-query";
import { getMyMeetings, getMyNotifications, getDetailedProgress, getQuizLeaderboard, type PortalNotification } from "@/lib/api";
import ProgressStats from "@/components/portal/ProgressStats";

interface MeetingsResponse {
  success: boolean;
  meetings: Array<any>;
}

function timeUntil(dateIso: string) {
  const diff = (new Date(dateIso).getTime() - Date.now()) / 60000;
  if(diff < 0) return "Started";
  if(diff < 60) return `${Math.floor(diff)}m`;
  return `${Math.floor(diff/60)}h ${Math.floor(diff%60)}m`;
}

function timeAgoDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const Route = createFileRoute("/_student/student/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { classrooms, currentUser } = useClassroomStore();
  const { data } = useQuery<MeetingsResponse>({
    queryKey: ['myMeetings'],
    queryFn: getMyMeetings,
    enabled: !!currentUser,
    staleTime: 1000 * 60,
    retry: 1,
  });
  const studentId = currentUser?.id || "";
  
  const enrolledClassrooms = classrooms.filter(c => c.students.some(s => s.id === studentId && s.status === 'active'));
  const activeCoursesCount = enrolledClassrooms.length;

  // Fetch progress for the first active classroom for the dashboard summary
  const firstClassroomId = enrolledClassrooms[0]?.id;
  const { data: progressStats, isLoading: progressLoading } = useQuery({
    queryKey: ['detailedProgress', firstClassroomId],
    queryFn: () => getDetailedProgress(firstClassroomId!),
    enabled: !!firstClassroomId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const backendMeetings = data?.meetings ?? [];
  const remoteMeetings = backendMeetings.map((m: any) => ({
    id: m._id,
    title: m.title,
    description: m.description,
    scheduledAt: m.scheduledAt,
    duration: m.duration,
    status: m.status,
    attendees: m.attendees ? m.attendees.map((a: any) => a.student?.fullName ?? '').filter(Boolean) : [],
    roomId: m.roomId,
    classroomName: m.classroom?.name ?? m.classroom?.code ?? 'Classroom',
  }));
  const localMeetings = enrolledClassrooms.flatMap(c => c.meetings.map(m => ({ ...m, classroomName: c.name })));
  const allMeetings = remoteMeetings.length > 0 ? remoteMeetings : localMeetings;
  const nextLiveMeeting = allMeetings.filter(m => m.status === 'scheduled' || m.status === 'live').sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  
  const totalQuizzes = enrolledClassrooms.reduce((s, c) => s + c.quizzes.filter(q => q.status === 'published').length, 0);
  const totalSubmissions = enrolledClassrooms.reduce((s, c) => s + c.quizzes.reduce((ss, q) => ss + q.attempts.filter(a => a.studentId === studentId && a.status === 'submitted').length, 0), 0);
  
  const studentAnnouncements = enrolledClassrooms.flatMap(c => c.announcements.map(a => ({ ...a, classroomName: c.name }))).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3);
  const upcomingEvents = allMeetings.filter(m => m.status === 'scheduled' || m.status === 'live').sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()).slice(0, 3);
  const nextClassText = nextLiveMeeting ? timeUntil(nextLiveMeeting.scheduledAt) : "No classes scheduled";

  const totalWatchedSeconds = enrolledClassrooms.reduce((s, c) => {
    return s + c.recordings.reduce((ss, r) => {
      const vs = r.viewStats.find(v => v.studentId === studentId);
      return ss + (vs ? (vs.watchedPercent / 100) * r.duration : 0);
    }, 0);
  }, 0);
  const totalHoursWatched = Math.round(totalWatchedSeconds / 3600);

  const { data: notificationPayload } = useQuery<PortalNotification[]>({
    queryKey: ['myNotifications'],
    queryFn: () => getMyNotifications(),
    enabled: !!currentUser,
    staleTime: 1000 * 30,
    retry: 1,
  });

  const notifications = notificationPayload ?? [];
  const joinableNotifications = notifications.filter((n) => {
    if (n.read) return false;
    if (n.type !== 'live_session') return false;
    if (!n.actionUrl) return false;
    
    // Cross-check with allMeetings to see if the session is still active/scheduled
    const meetingId = n.metadata?.meetingId;
    if (meetingId) {
      const meeting = allMeetings.find(m => m.id === meetingId);
      if (meeting && (meeting.status === 'ended' || meeting.status === 'cancelled')) {
        return false;
      }
    }
    return true;
  });

  // ─── Last Test & Top 3 Rankers ───────────────────────────────────────────────
  const allQuizzes = useMemo(() => {
    return enrolledClassrooms.flatMap(c => 
      (c.quizzes || []).map(q => ({
        ...q,
        classroomId: c.id,
        classroomName: c.name,
      }))
    );
  }, [enrolledClassrooms]);

  const latestQuiz = useMemo(() => {
    if (allQuizzes.length === 0) return null;
    
    // Prioritize quizzes that have submissions
    const sorted = [...allQuizzes].sort((a: any, b: any) => {
      const aHasSubmissions = (a.attempts || []).some((att: any) => att.status === 'submitted') ? 1 : 0;
      const bHasSubmissions = (b.attempts || []).some((att: any) => att.status === 'submitted') ? 1 : 0;
      if (bHasSubmissions !== aHasSubmissions) return bHasSubmissions - aHasSubmissions;

      const dateA = a.availableFrom || a.updatedAt || a.createdAt || "";
      const dateB = b.availableFrom || b.updatedAt || b.createdAt || "";
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return sorted[0] || null;
  }, [allQuizzes]);

  const { data: leaderboardData } = useQuery({
    queryKey: ['dashboardQuizLeaderboard', latestQuiz?.id],
    queryFn: () => getQuizLeaderboard(latestQuiz!.id),
    enabled: !!latestQuiz?.id,
    staleTime: 1000 * 60 * 2,
    retry: 1,
  });

  const top3Rankers = useMemo(() => {
    if (leaderboardData?.top3 && leaderboardData.top3.length > 0) {
      return leaderboardData.top3;
    }
    if (!latestQuiz?.attempts || latestQuiz.attempts.length === 0) return [];
    const submitted = latestQuiz.attempts.filter((a: any) => a.status === 'submitted');
    const sorted = [...submitted].sort((a: any, b: any) => {
      const aPct = a.score?.percentage ?? 0;
      const bPct = b.score?.percentage ?? 0;
      if (bPct !== aPct) return bPct - aPct;
      const aCorrect = a.correctCount ?? 0;
      const bCorrect = b.correctCount ?? 0;
      if (bCorrect !== aCorrect) return bCorrect - aCorrect;
      return (a.totalTimeTakenSec || 0) - (b.totalTimeTakenSec || 0);
    });
    return sorted.slice(0, 3).map((att: any, idx: number) => ({
      rank: idx + 1,
      studentId: att.studentId,
      studentName: att.studentName,
      score: att.score?.rawMarks ?? 0,
      totalMarks: att.score?.totalMarks ?? 0,
      percentage: att.score?.percentage ?? 0,
      passed: att.score?.passed ?? true,
      timeTakenSec: att.totalTimeTakenSec ?? 0,
      correctCount: att.correctCount ?? 0,
      wrongCount: att.wrongCount ?? 0,
      unattemptedCount: att.unattemptedCount ?? 0,
    }));
  }, [leaderboardData, latestQuiz]);

  const myLeaderboardRank = useMemo(() => {
    if (leaderboardData?.myRank) return leaderboardData.myRank;
    if (leaderboardData?.leaderboard) {
      const found = leaderboardData.leaderboard.find((e: any) => e.studentId === studentId);
      if (found) return found;
    }
    if (latestQuiz?.attempts) {
      const myAttempt = latestQuiz.attempts.find((a: any) => a.studentId === studentId && a.status === 'submitted');
      if (myAttempt) {
        return {
          rank: myAttempt.rank || 1,
          score: myAttempt.score?.rawMarks ?? 0,
          totalMarks: myAttempt.score?.totalMarks ?? 0,
          percentage: myAttempt.score?.percentage ?? 0,
          passed: myAttempt.score?.passed ?? true,
        };
      }
    }
    return null;
  }, [leaderboardData, latestQuiz, studentId]);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-3xl text-white p-7 lg:p-9 relative overflow-hidden" style={{background: 'linear-gradient(135deg, #0B1F3A 0%, #12294D 60%, #1A3560 100%)'}}>
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full blur-3xl" style={{background: 'rgba(244,180,0,0.18)'}} />
        <div className="absolute bottom-0 left-1/2 h-40 w-96 rounded-full blur-3xl" style={{background: 'rgba(45,156,219,0.12)'}} />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-widest font-semibold" style={{color: '#F4B400'}}>Welcome back</div>
            <h1 className="mt-2 font-display text-3xl lg:text-4xl font-bold">
              Hello, {currentUser?.name?.split(" ")[0] || "Student"} 👋
            </h1>
            <p className="mt-2 text-white/75 text-sm">
              You are enrolled in <b style={{color: '#F4B400'}}>{activeCoursesCount} classroom{activeCoursesCount !== 1 ? "s" : ""}</b>. Your next live class
              starts in <b className="text-white">{nextClassText}</b>.
            </p>
            <div className="mt-5 flex gap-3">
              <Link to="/student/live" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[#0B1F3A] shadow-lg transition-all hover:brightness-110 active:scale-95" style={{background: '#F4B400'}}>
                Join live class <PlayCircle className="h-4 w-4" />
              </Link>
              <Link to="/student/my-courses" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors">
                Continue learning
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-100">
            {[
              { k: "Hours", v: totalHoursWatched.toString() },
              { k: "Exams Done", v: totalSubmissions.toString() },
              { k: "Class rooms", v: activeCoursesCount.toString() },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl p-3 text-center" style={{background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(244,180,0,0.2)'}}>
                <div className="font-display text-2xl font-bold" style={{color: '#F4B400'}}>{s.v}</div>
                <div className="text-[11px] uppercase tracking-widest mt-1 text-white/60">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Progress Section */}
      {progressStats && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold" style={{color: '#0B1F3A'}}>Learning Analysis</h2>
            {enrolledClassrooms.length > 1 && (
              <span className="text-xs text-muted-foreground italic">Showing progress for: {enrolledClassrooms[0].name}</span>
            )}
          </div>
          <ProgressStats stats={progressStats} />
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active Courses" value={activeCoursesCount.toString()} delta="+1 this month" icon={BookOpen} accent="navy" />
        <StatTile label="Hours This Week" value="0" delta="0% vs last" icon={Clock} accent="gold" />
        <StatTile label="Quizzes Done" value={`${totalSubmissions}/${totalQuizzes}`} icon={CheckCircle2} accent="sky" />
       
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Continue */}
        <Card className="sm:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base sm:text-lg font-bold" style={{color: '#0B1F3A'}}>Continue learning</h3>
            <Link to="/student/my-courses" className="text-xs font-medium inline-flex items-center gap-1 transition-colors" style={{color: '#2D9CDB'}}>
              All courses <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
            {enrolledClassrooms.map((c) => {
              const enrolledStudentDetails = c.students.find(s => s.id === studentId);
              const progress = enrolledStudentDetails ? enrolledStudentDetails.progress : 0;
              return (
                <div key={c.id} className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-border p-3 sm:p-4 hover:border-[#2D9CDB]/40 transition-colors">
                  <div className="grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl shrink-0" style={{background: 'rgba(45,156,219,0.1)', color: '#2D9CDB'}}>
                    <PlayCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{color: '#0B1F3A'}}>{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.program}</div>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full" style={{width: `${progress}%`, background: 'linear-gradient(90deg, #F4B400, #2D9CDB)'}} />
                  </div>
                </div>
                <div className="text-xs font-mono text-muted-foreground">{progress}%</div>
              </div>
            )})}
            {enrolledClassrooms.length === 0 && <p className="text-sm text-muted-foreground">You are not enrolled in any courses.</p>}
          </div>
        </Card>

        {/* Last Test Top 3 Rankers with Animated Golden Wings */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-600 flex items-center justify-center">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 leading-tight">
                    Last Test Top Rankers
                  </h3>
                  {latestQuiz && (
                    <p className="text-[11px] text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">
                      {latestQuiz.title} · <span className="font-semibold text-slate-600">{latestQuiz.classroomName}</span>
                    </p>
                  )}
                </div>
              </div>
              <Link
                to="/student/exams"
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-0.5 shrink-0"
              >
                All Exams <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {top3Rankers.length > 0 ? (
              <div className="pt-3 pb-1">
                {/* 3-Column Podium */}
                <div className="grid grid-cols-3 gap-1.5 items-end">
                  {/* Rank 2 (Silver - Left) */}
                  {top3Rankers[1] ? (
                    <div className="p-2 rounded-2xl border border-slate-300/80 bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-200/60 flex flex-col items-center text-center relative transition-all hover:shadow-sm">
                      <div className="absolute -top-2.5 px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[8px] sm:text-[9px] font-black shadow-2xs flex items-center gap-0.5 ring-1 ring-white">
                        <Medal className="w-2.5 h-2.5 text-slate-600" /> 2ND
                      </div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-300 border-2 border-white text-slate-800 ring-1 ring-slate-300/50 shadow-xs flex items-center justify-center font-display font-bold text-xs sm:text-sm mt-0.5">
                        {top3Rankers[1].studentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="font-display font-bold text-[10px] sm:text-xs mt-1 truncate w-full px-0.5 text-slate-900">
                        {top3Rankers[1].studentName}
                      </div>
                      <div className="text-[10px] sm:text-xs font-mono font-black text-slate-900 mt-0.5">
                        {top3Rankers[1].percentage}%
                      </div>
                      <div className="text-[8px] sm:text-[9px] font-mono text-slate-500">
                        {top3Rankers[1].score}/{top3Rankers[1].totalMarks}
                      </div>
                      {/* Stepped Pedestal Base 2 */}
                      <div className="mt-1.5 w-full h-5 sm:h-7 rounded-lg bg-gradient-to-b from-slate-300 to-slate-400 flex items-center justify-center text-slate-800 font-display font-black text-xs shadow-inner border-t border-slate-100">
                        2
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center opacity-40">
                      <p className="text-[9px] py-4 text-slate-400">No 2nd</p>
                    </div>
                  )}

                  {/* Rank 1 (Gold - Center Champion with Animated Golden Wings) */}
                  {top3Rankers[0] && (
                    <div className="p-2 sm:p-2.5 rounded-2xl border-2 border-amber-300/90 bg-gradient-to-b from-amber-50 via-amber-100/50 to-amber-200/60 flex flex-col items-center text-center relative transition-all hover:shadow-md shadow-xs ring-2 ring-amber-400/25">
                      {/* Animated Golden Wings Behind Avatar */}
                      <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-8 sm:h-10 pointer-events-none z-0 flex items-center justify-between">
                        {/* Left Wing */}
                        <svg
                          viewBox="0 0 100 70"
                          className="w-10 h-7 sm:w-13 sm:h-9 animate-wing-left -mr-2 sm:-mr-2.5"
                        >
                          <defs>
                            <linearGradient id="dashGoldWingL" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#FEF08A" />
                              <stop offset="35%" stopColor="#FBBF24" />
                              <stop offset="75%" stopColor="#F59E0B" />
                              <stop offset="100%" stopColor="#D97706" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M95,55 C70,48 45,32 20,8 C12,0 0,-3 0,5 C0,10 10,18 22,25 C10,22 2,28 4,34 C6,40 18,42 30,44 C18,44 10,50 14,56 C18,62 34,58 48,56 C36,60 30,68 36,70 C42,72 65,65 95,55 Z"
                            fill="url(#dashGoldWingL)"
                          />
                          <path
                            d="M85,50 C65,44 45,30 25,12 C18,7 8,5 8,9 C10,14 18,20 28,26 C18,24 12,28 14,33 C16,38 26,40 36,42 C26,42 20,47 24,51 C28,55 42,52 54,50"
                            fill="none"
                            stroke="#FFF"
                            strokeOpacity="0.5"
                            strokeWidth="1.5"
                          />
                        </svg>

                        {/* Right Wing */}
                        <svg
                          viewBox="0 0 100 70"
                          className="w-10 h-7 sm:w-13 sm:h-9 animate-wing-right -ml-2 sm:-ml-2.5"
                        >
                          <defs>
                            <linearGradient id="dashGoldWingR" x1="100%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#FEF08A" />
                              <stop offset="35%" stopColor="#FBBF24" />
                              <stop offset="75%" stopColor="#F59E0B" />
                              <stop offset="100%" stopColor="#D97706" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M5,55 C30,48 55,32 80,8 C88,0 100,-3 100,5 C100,10 90,18 78,25 C90,22 98,28 96,34 C94,40 82,42 70,44 C82,44 90,50 86,56 C82,62 66,58 52,56 C64,60 70,68 64,70 C58,72 35,65 5,55 Z"
                            fill="url(#dashGoldWingR)"
                          />
                          <path
                            d="M15,50 C35,44 55,30 75,12 C82,7 92,5 92,9 C90,14 82,20 72,26 C82,24 88,28 86,33 C84,38 74,40 64,42 C74,42 80,47 76,51 C72,55 58,52 46,50"
                            fill="none"
                            stroke="#FFF"
                            strokeOpacity="0.5"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>

                      <div className="absolute -top-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 text-[9px] sm:text-[10px] font-black shadow-xs flex items-center gap-1 animate-bounce ring-1 ring-white z-10">
                        <Crown className="w-2.5 h-2.5 fill-current" /> 1ST 🏆
                      </div>
                      <div className="relative mt-0.5 z-10">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 border-2 border-white text-amber-950 ring-2 ring-amber-400/50 shadow-sm flex items-center justify-center font-display font-black text-sm sm:text-base">
                          {top3Rankers[0].studentName.charAt(0).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 border border-white flex items-center justify-center text-[8px] font-black shadow-xs">
                          👑
                        </span>
                      </div>
                      <div className="font-display font-black text-[11px] sm:text-xs mt-1 truncate w-full px-0.5 text-slate-950 z-10">
                        {top3Rankers[0].studentName}
                      </div>
                      <div className="text-[11px] sm:text-sm font-mono font-black text-amber-950 mt-0.5 z-10">
                        {top3Rankers[0].percentage}%
                      </div>
                      <div className="text-[8px] sm:text-[9px] font-mono text-amber-900/90 z-10">
                        {top3Rankers[0].score}/{top3Rankers[0].totalMarks}
                      </div>
                      {/* Stepped Pedestal Base 1 */}
                      <div className="mt-1.5 w-full h-8 sm:h-10 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 font-display font-black text-sm sm:text-base shadow-inner border-t border-amber-200 z-10">
                        1
                      </div>
                    </div>
                  )}

                  {/* Rank 3 (Bronze - Right) */}
                  {top3Rankers[2] ? (
                    <div className="p-2 rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/40 via-amber-100/40 to-amber-200/50 flex flex-col items-center text-center relative transition-all hover:shadow-sm">
                      <div className="absolute -top-2.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[8px] sm:text-[9px] font-black shadow-2xs flex items-center gap-0.5 ring-1 ring-white">
                        <Medal className="w-2.5 h-2.5 text-amber-700" /> 3RD
                      </div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-300 border-2 border-white text-amber-900 ring-1 ring-amber-300/50 shadow-xs flex items-center justify-center font-display font-bold text-xs sm:text-sm mt-0.5">
                        {top3Rankers[2].studentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="font-display font-bold text-[10px] sm:text-xs mt-1 truncate w-full px-0.5 text-slate-900">
                        {top3Rankers[2].studentName}
                      </div>
                      <div className="text-[10px] sm:text-xs font-mono font-black text-slate-900 mt-0.5">
                        {top3Rankers[2].percentage}%
                      </div>
                      <div className="text-[8px] sm:text-[9px] font-mono text-slate-500">
                        {top3Rankers[2].score}/{top3Rankers[2].totalMarks}
                      </div>
                      {/* Stepped Pedestal Base 3 */}
                      <div className="mt-1.5 w-full h-4 sm:h-5 rounded-lg bg-gradient-to-b from-amber-300 to-amber-400 flex items-center justify-center text-amber-950 font-display font-black text-xs shadow-inner border-t border-amber-100">
                        3
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center opacity-40">
                      <p className="text-[9px] py-4 text-slate-400">No 3rd</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-2">
                  <Trophy className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">No Test Rankers Yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px] mx-auto">
                  Take tests in your classrooms to claim the top podium spot!
                </p>
              </div>
            )}
          </div>

          {/* Student's Personal Rank Banner if attended */}
          {myLeaderboardRank ? (
            <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 via-slate-50 to-amber-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  #{myLeaderboardRank.rank}
                </span>
                <div>
                  <div className="text-[11px] font-bold text-slate-900">Your Rank</div>
                  <div className="text-[10px] text-slate-500">
                    Score: <strong className="text-emerald-700 font-bold">{myLeaderboardRank.score}/{myLeaderboardRank.totalMarks}</strong> ({myLeaderboardRank.percentage}%)
                  </div>
                </div>
              </div>
              <Link
                to="/student/exams"
                className="text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-lg transition-colors"
              >
                View
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-xl p-2.5 bg-gradient-to-r from-[#0B1F3A] to-[#1A3560] text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Challenge
                </div>
                <div className="text-xs font-bold mt-0.5">Aim for the #1 Podium</div>
              </div>
              <Link
                to="/student/exams"
                className="text-[10px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 px-2.5 py-1 rounded-lg transition-all shadow-xs"
              >
                Take Tests
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming + Announcements */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
        <Card className="sm:col-span-2 lg:col-span-1">
          <h3 className="font-display text-base sm:text-lg font-bold" style={{color: '#0B1F3A'}}>Live Sessions</h3>
          <ul className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
            {upcomingEvents.length > 0 ? upcomingEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${e.status === 'live' ? 'bg-red-100 text-red-600' : ''}`} style={e.status !== 'live' ? {background: 'rgba(45,156,219,0.1)', color: '#2D9CDB'} : {}}>
                  {e.status === 'live' ? <Radio className="h-4 w-4 animate-pulse" /> : <Clock className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold truncate" style={{color: '#0B1F3A'}}>{e.title}</div>
                    {e.status === 'live' && <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 px-1.5 py-0.5 rounded">LIVE</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{e.classroomName}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(e.scheduledAt).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    {' '}· {new Date(e.scheduledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              </li>
            )) : (
              <li className="text-sm text-muted-foreground py-2">No upcoming classes.</li>
            )}
            {joinableNotifications.length > 0 && upcomingEvents.length > 0 && (
              <li className="border-t border-border my-2" />
            )}
            {joinableNotifications.map((notif) => (
              <li key={notif._id} className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/50 p-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                  <Radio className="h-4 w-4 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-plum-dark truncate">{notif.title}</div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{notif.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h3 className="font-display text-lg font-bold" style={{color: '#0B1F3A'}}>Announcements</h3>
          <ul className="mt-4 space-y-3">
            {studentAnnouncements.map((a) => (
              <li key={a.id} className="rounded-xl p-3.5" style={{background: 'rgba(45,156,219,0.07)', border: '1px solid rgba(45,156,219,0.15)'}}>
                <div className="flex justify-between items-start mb-0.5">
                  <div className="text-[10px] uppercase tracking-widest font-semibold" style={{color: '#2D9CDB'}}>{a.classroomName}</div>
                  <div className="text-[9px] text-muted-foreground">{timeAgoDate(a.createdAt)}</div>
                </div>
                <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words" style={{color: '#0B1F3A'}}>{a.content}</div>
                {a.attachments && a.attachments.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                  {a.attachments.map((at: any, i: number) => (
                    <a
                      key={i}
                      href={at.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold transition-colors"
                      style={{background: 'rgba(244,180,0,0.12)', color: '#0B1F3A'}}
                    >
                      <Download className="h-2.5 w-2.5" />
                      PDF
                    </a>
                  ))}
                  </div>
                )}
              </li>
            ))}
            {studentAnnouncements.length === 0 && <li className="text-sm text-muted-foreground">No announcements.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}