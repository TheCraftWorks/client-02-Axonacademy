import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Flame, Trophy, Clock, BookOpen, PlayCircle, ChevronRight, CheckCircle2, Radio, Download
} from "lucide-react";
import { Card, StatTile } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import { useQuery } from "@tanstack/react-query";
import { getMyMeetings, getMyNotifications, getDetailedProgress, type PortalNotification } from "@/lib/api";
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
        <StatTile label="Assignments Done" value={`${totalSubmissions}/${totalQuizzes}`} icon={CheckCircle2} accent="sky" />
        <StatTile label="Achievement Points" value="0" delta="0% vs last" icon={Trophy} accent="emerald" />
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

        {/* Streak */}
        <Card>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <h3 className="font-display text-base sm:text-lg font-bold" style={{color: '#0B1F3A'}}>Streak</h3>
          </div>
          <div className="mt-2 sm:mt-3 font-display text-4xl sm:text-5xl font-bold" style={{color: '#0B1F3A'}}>14<span className="text-sm sm:text-base font-medium text-muted-foreground">days</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Best: 21 days · Keep it up!</p>
          <div className="mt-3 sm:mt-4 grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded"
                style={{background: i < 14 ? '#F4B400' : i < 21 ? 'rgba(244,180,0,0.25)' : '#E5E9EF'}}
              />
            ))}
          </div>
          <div className="mt-5 rounded-xl p-4" style={{background: 'linear-gradient(135deg, #0B1F3A 0%, #12294D 100%)'}}>
            <div className="text-xs uppercase tracking-widest font-semibold" style={{color: '#F4B400'}}>Next badge</div>
            <div className="font-display font-bold mt-1 text-white">Iron Discipline</div>
            <div className="text-xs mt-1" style={{color: 'rgba(255,255,255,0.6)'}}>7 more days to unlock</div>
          </div>
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
                <div className="text-sm font-semibold line-clamp-2" style={{color: '#0B1F3A'}}>{a.content}</div>
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