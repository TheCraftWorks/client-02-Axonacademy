import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight, PlayCircle, Clock, ClipboardList, Video } from "lucide-react";
import { Card } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";

export const Route = createFileRoute("/_student/student/my-courses/")({
  component: MyCourses,
});

const NAVY = "#0B1F3A";
const GOLD = "#F4B400";
const SKY  = "#2D9CDB";

function MyCourses() {
  const { classrooms, courses, currentUser } = useClassroomStore();
  const studentId = currentUser?.id || "";

  const enrolledClassrooms = classrooms.filter(c =>
    c.students.some(s => s.id === studentId && s.status === "active")
  );

  const myCourses = enrolledClassrooms.map(cls => {
    const me = cls.students.find(s => s.id === studentId)!;
    const course = courses.find(c => c.title === cls.program);
    const publishedRecs = cls.recordings.filter(r => r.isPublished);
    const watchedRecs = publishedRecs.filter(r => r.viewStats.some(v => v.studentId === studentId && v.watchedPercent > 0));
    const totalWatchedSec = publishedRecs.reduce((s, r) => {
      const vs = r.viewStats.find(v => v.studentId === studentId);
      return s + (vs ? (vs.watchedPercent / 100) * r.duration : 0);
    }, 0);
    const upcomingLive = cls.meetings.filter(m => m.status === "scheduled" || m.status === "live").length;
    const totalQuizzes = cls.quizzes.filter(q => q.status === "published").length;
    const completedQuizzes = cls.quizzes.filter(q =>
      q.status === "published" && q.attempts.some(a => a.studentId === studentId && a.status === "submitted")
    ).length;
    return { cls, me, course, publishedRecs, watchedRecs, totalWatchedSec, upcomingLive, totalQuizzes, completedQuizzes };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3" style={{ color: NAVY }}>
          <BookOpen className="h-8 w-8" style={{ color: GOLD }} /> My Courses
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {myCourses.length} course{myCourses.length !== 1 ? "s" : ""} enrolled
        </p>
      </div>

      {myCourses.length === 0 ? (
        <Card className="text-center py-16">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">You haven&apos;t been enrolled in any courses yet.</p>
          <p className="text-slate-400 text-xs mt-1">Contact your admin to get started.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {myCourses.map(({ cls, me, course, publishedRecs, watchedRecs, totalWatchedSec, upcomingLive, totalQuizzes, completedQuizzes }) => (
            <Card key={cls.id} className="overflow-hidden p-0">
              {/* Gold → Sky gradient top bar */}
              <div className="h-2" style={{ background: `linear-gradient(90deg, ${GOLD}, ${SKY})` }} />
              <div className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-xl font-bold" style={{ color: NAVY }}>{cls.name}</h2>
                      <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                        style={{ background: 'rgba(244,180,0,0.12)', color: '#B8870A' }}>{cls.status}</span>
                    </div>
                    <p className="text-slate-500 text-sm mt-1">{cls.program}</p>
                    {course?.description && <p className="text-slate-400 text-xs mt-1.5 max-w-xl">{course.description}</p>}
                  </div>
                  <Link to="/student/classroom/$id" params={{ id: cls.id }}
                    className="inline-flex items-center gap-2 rounded-full text-white px-5 py-2.5 text-sm font-bold transition-all hover:brightness-110 active:scale-95 shrink-0"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, #1A3560)` }}>
                    Continue Learning <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Progress */}
                <div className="mt-5 p-4 rounded-2xl" style={{ background: 'rgba(11,31,58,0.04)' }}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold" style={{ color: NAVY }}>Overall Progress</span>
                    <span className="font-mono font-bold" style={{ color: NAVY }}>{me.progress}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${me.progress}%`, background: `linear-gradient(90deg, ${GOLD}, ${SKY})` }} />
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
                    <span>Attendance: <strong style={{ color: NAVY }}>{me.attendance}%</strong></span>
                    <span>Quiz Avg: <strong style={{ color: NAVY }}>{me.quizAvg}%</strong></span>
                    <span>Enrollment: <strong style={{ color: NAVY }}>{me.enrollmentId}</strong></span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[
                    { icon: Video, label: "Videos", val: `${watchedRecs.length}/${publishedRecs.length}`, sub: "watched" },
                    { icon: Clock, label: "Hours", val: `${Math.round(totalWatchedSec / 3600)}h`, sub: "watched" },
                    { icon: PlayCircle, label: "Live", val: upcomingLive, sub: "upcoming" },
                    { icon: ClipboardList, label: "Quizzes", val: `${completedQuizzes}/${totalQuizzes}`, sub: "done" },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(45,156,219,0.07)' }}>
                      <s.icon className="h-4 w-4 mx-auto mb-1" style={{ color: SKY }} />
                      <div className="font-display font-bold" style={{ color: NAVY }}>{s.val}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</div>
                      <div className="text-[9px] text-slate-400">{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Recordings */}
                {publishedRecs.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold mb-3" style={{ color: NAVY }}>Course Recordings</h4>
                    <div className="space-y-2">
                      {publishedRecs.slice(0, 3).map(r => {
                        const vs = r.viewStats.find(v => v.studentId === studentId);
                        const pct = vs?.watchedPercent || 0;
                        return (
                          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:border-[#2D9CDB]/30 transition-colors">
                            <div className="grid h-10 w-10 place-items-center rounded-lg shrink-0"
                              style={{ background: 'rgba(45,156,219,0.1)', color: SKY }}>
                              <PlayCircle className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate" style={{ color: NAVY }}>{r.title}</div>
                              <div className="text-xs text-slate-400">{Math.floor(r.duration / 60)}m · {r.chapters.length} chapters</div>
                              <div className="mt-1 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}, ${SKY})` }} />
                              </div>
                            </div>
                            <span className="text-xs font-mono shrink-0" style={{ color: NAVY }}>{pct}%</span>
                          </div>
                        );
                      })}
                      {publishedRecs.length > 3 && (
                        <Link to="/student/classroom/$id" params={{ id: cls.id }}
                          className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: SKY }}>
                          View all {publishedRecs.length} recordings <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* Course fee info */}
                {course && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold" style={{ color: NAVY }}>{course.category}</span> · Code: <span className="font-mono">{cls.code}</span>
                    </div>
                    <div className="text-xs font-semibold" style={{ color: NAVY }}>₹{course.price.toLocaleString("en-IN")}</div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
