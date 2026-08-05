import { createFileRoute, Link } from "@tanstack/react-router";
import { School, ChevronRight, Video, BookOpen, ClipboardList, Users } from "lucide-react";
import { useClassroomStore } from "@/lib/classroomStore";

export const Route = createFileRoute("/_student/student/classrooms/")({
  component: StudentClassrooms,
});

const NAVY = "#0B1F3A";
const GOLD = "#F4B400";
const SKY  = "#2D9CDB";

function StudentClassrooms() {
  const { classrooms, currentUser } = useClassroomStore();
  const currentStudentId = currentUser?.id || "";

  const myClassrooms = classrooms.filter((c) =>
    c.students.some((s) => s.id === currentStudentId && s.status === "active"),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-3" style={{ color: NAVY }}>
          <School className="h-8 w-8" style={{ color: GOLD }} /> My Classrooms
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {myClassrooms.length} classroom{myClassrooms.length !== 1 ? "s" : ""} enrolled
        </p>
      </div>

      {myClassrooms.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center">
          <School className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">You haven&apos;t been enrolled in any classrooms yet.</p>
          <p className="text-slate-400 text-xs mt-1">Contact your admin to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {myClassrooms.map((cls) => {
            const myInfo = cls.students.find((s) => s.id === currentStudentId);
            const publishedRecs = cls.recordings.filter((r) => r.isPublished).length;
            const publishedQuizzes = cls.quizzes.filter((q) => q.status === "published").length;
            const upcomingMeetings = cls.meetings.filter((m) => m.status === "scheduled" || m.status === "live").length;

            return (
              <div
                key={cls.id}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-all group"
                style={{ borderColor: 'rgba(45,156,219,0.2)' }}
              >
                {/* Gold top accent bar */}
                <div className="h-2" style={{ background: `linear-gradient(90deg, ${GOLD}, ${SKY})` }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-display font-bold text-base leading-snug" style={{ color: NAVY }}>{cls.name}</h3>
                      <span className="font-mono text-[10px] text-slate-400">{cls.code}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded shrink-0"
                      style={{ background: `rgba(244,180,0,0.12)`, color: '#B8870A' }}>
                      {cls.status}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs leading-relaxed line-clamp-2 mb-4">{cls.description}</p>

                  {myInfo && (
                    <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(11,31,58,0.04)' }}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-600 font-medium">My Progress</span>
                        <span className="font-bold font-mono" style={{ color: NAVY }}>{myInfo.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${myInfo.progress}%`, background: `linear-gradient(90deg, ${GOLD}, ${SKY})` }} />
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                        <span>Attendance: {myInfo.attendance}%</span>
                        <span>Quiz avg: {myInfo.quizAvg}%</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { icon: Video, val: upcomingMeetings, label: "Live" },
                      { icon: BookOpen, val: publishedRecs, label: "Videos" },
                      { icon: ClipboardList, val: publishedQuizzes, label: "Tests" },
                      { icon: Users, val: cls.students.filter((s) => s.status === "active").length, label: "Peers" },
                    ].map(({ icon: Icon, val, label }) => (
                      <div key={label} className="rounded-lg p-2 text-center" style={{ background: 'rgba(45,156,219,0.07)' }}>
                        <Icon className="h-3.5 w-3.5 mx-auto mb-0.5" style={{ color: SKY }} />
                        <div className="font-display font-bold text-sm" style={{ color: NAVY }}>{val}</div>
                        <div className="text-[9px] text-slate-400 uppercase tracking-wider">{label}</div>
                      </div>
                    ))}
                  </div>

                  <Link
                    to="/student/classroom/$id"
                    params={{ id: cls.id }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-full text-white px-4 py-2.5 text-sm font-bold transition-all hover:brightness-110 active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, #1A3560)` }}
                  >
                    Open Classroom <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
