import { createFileRoute, Navigate } from "@tanstack/react-router";
import {
  Users, IndianRupee, BookOpen,
  ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import { useEffect, useState, useRef, useCallback } from "react";
import { getAdminUsers, getAdminPrograms } from "@/lib/api";

export const Route = createFileRoute("/_admin/admin/dashboard")({
  component: AdminHome,
});

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

function Stat({ label, value, delta, up = true, icon: Icon }: {
  label: string; value: string; delta: string; up?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-5 text-cream">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-widest text-cream/60">{label}</div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-lime/15 text-lime"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-3 font-display text-3xl font-bold">{value}</div>
      <div className={`mt-1 flex items-center gap-1 text-xs ${up ? "text-lime" : "text-red-400"}`}>
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />} {delta}
      </div>
    </div>
  );
}

function timeAgoStr(dateIso: string) {
  const diff = (Date.now() - new Date(dateIso).getTime()) / 60000;
  if(diff < 0) return "Upcoming";
  if(diff < 60) return `${Math.floor(diff)}m`;
  if(diff < 1440) return `${Math.floor(diff/60)}h`;
  return `${Math.floor(diff/1440)}d`;
}

/** Heartbeat dot: pulses on every data refresh */
function HeartbeatDot({ pulse }: { pulse: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 mr-1">
      {pulse && (
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75"
          key={Date.now()}
        />
      )}
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime" />
    </span>
  );
}

function AdminHome() {
  const { currentUser } = useClassroomStore();
  if (currentUser?.role === "faculty") {
    return <Navigate to="/admin/classrooms" />;
  }
  const { classrooms } = useClassroomStore();
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [pulse, setPulse] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [studentUsers, programsList] = await Promise.all([
        getAdminUsers("student"),
        getAdminPrograms(),
      ]);
      setStudents(studentUsers);
      setCourses(programsList);
      setLastRefreshed(new Date());
      // Trigger heartbeat pulse animation briefly
      setPulse(true);
      setTimeout(() => setPulse(false), 1500);
    } catch (err) {
      console.error("Failed to load dashboard statistics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(() => {
      loadData();
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  const activeStudentsSet = new Set<string>();
  classrooms.forEach(c => {
    c.students.forEach(st => {
      if (st.status === 'active') {
        activeStudentsSet.add(st.id);
      }
    });
  });
  const activeStudents = activeStudentsSet.size;
  const totalEnrolments = classrooms.reduce((s, c) => s + c.students.length, 0);

  const totalRevenue = classrooms.reduce((s, cls) => {
    const course = courses.find(x => x.title === cls.program);
    return s + (course?.price || 0) * cls.students.filter(st => st.status === "active").length;
  }, 0);

  const formattedRevenue = totalRevenue >= 100000
    ? `₹${(totalRevenue / 100000).toFixed(1)}L`
    : `₹${totalRevenue.toLocaleString("en-IN")}`;

  const activities = classrooms.flatMap(c => [
    ...c.announcements.map(a => ({ c: "News", t: `${c.name} - ${a.content.substring(0, 40)}...`, stamp: new Date(a.createdAt).getTime(), w: timeAgoStr(a.createdAt) })),
    ...c.meetings.filter(m => m.status === 'scheduled').map(m => ({ c: "Live", t: `${m.title} scheduled for ${c.name}`, stamp: new Date(m.scheduledAt).getTime() - 100000, w: timeAgoStr(m.scheduledAt) })),
    ...c.quizzes.filter(q => q.status === 'published').map(q => ({ c: "Exam", t: `${q.title} published in ${c.name}`, stamp: new Date(q.availableFrom).getTime(), w: timeAgoStr(q.availableFrom) })),
  ]).sort((a, b) => b.stamp - a.stamp).slice(0, 5);

  // Top 5 Courses by enrollment
  const topCourses = courses
    .map(c => {
      const enrolled = classrooms
        .filter(cls => cls.program === c.title)
        .reduce((acc, cls) => acc + cls.students.filter(st => st.status === "active").length, 0);
      return { title: c.title, count: enrolled };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Shared max for both the trend chart and top courses bar
  const trendMax = Math.max(...topCourses.map(c => c.count), 1);

  // Recent Students
  const recentStudents = [...students]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6 text-cream">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Overview</h1>
          <p className="text-cream/60 text-sm mt-1 flex items-center gap-1">
            <HeartbeatDot pulse={pulse} />
            Academy performance · Live
            {lastRefreshed && (
              <span className="ml-2 text-cream/40 text-[11px]">
                · updated {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {["7d", "30d", "90d", "All"].map((t, i) => (
            <button key={t} className={`text-xs font-semibold rounded-full px-3 py-1.5 ${i===1 ? "bg-lime text-plum-dark" : "bg-cream/10 text-cream/70"}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active Students" value={activeStudents.toString()} delta="+12.4%" icon={Users} />
        <Stat label="Course Enrolments" value={totalEnrolments.toString()} delta="+8.1%" icon={BookOpen} />
        <Stat label="Revenue" value={formattedRevenue} delta="+18.7%" icon={IndianRupee} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DarkCard className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg">Enrolment trend</h3>
            <span className="text-xs text-cream/60 flex items-center gap-1.5">
              <HeartbeatDot pulse={pulse} />
              <Activity className="h-3 w-3" /> Live · refreshes every 30s
            </span>
          </div>
          <div className="mt-5 h-56 flex items-end gap-3">
            {topCourses.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-cream/40 text-sm">
                No enrollment data yet
              </div>
            ) : (
              topCourses.map((c, idx) => {
                const barPct = Math.round((c.count / trendMax) * 80);
                // Shorten label: first word or first 8 chars
                const shortLabel = c.title.split(" ")[0].slice(0, 9);
                return (
                  <div key={c.title} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 hidden group-hover:flex flex-col items-center pointer-events-none">
                      <div className="bg-[#0f0820] border border-lime/20 rounded-lg px-3 py-1.5 text-[11px] text-cream whitespace-nowrap shadow-xl">
                        <span className="font-semibold text-lime">{c.count}</span> enrolled
                        <div className="text-cream/50 text-[10px] mt-0.5 max-w-[140px] truncate">{c.title}</div>
                      </div>
                      <div className="w-2 h-2 bg-[#0f0820] border-r border-b border-lime/20 rotate-45 -mt-1" />
                    </div>
                    {/* Enrollment count above bar */}
                    <div className="text-[10px] font-mono text-lime/70">{c.count > 0 ? c.count : ""}</div>
                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-md transition-all duration-700 ${
                        pulse
                          ? "bg-gradient-to-t from-lime to-lime/80 shadow-[0_0_8px_2px_rgba(163,230,53,0.5)]"
                          : "bg-gradient-to-t from-lime/30 to-lime"
                      }`}
                      style={{ height: `${barPct}%`, minHeight: c.count > 0 ? "6px" : "2px" }}
                    />
                    {/* Course short name */}
                    <div
                      className="text-[9px] text-cream/50 font-mono text-center leading-tight mt-0.5 w-full truncate px-0.5"
                      title={c.title}
                    >
                      #{idx + 1} {shortLabel}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DarkCard>

        <DarkCard>
          <h3 className="font-display font-bold text-lg">Top courses</h3>
          <p className="text-[10px] text-cream/40 uppercase tracking-widest mt-0.5 mb-4">Best 5 by enrolment</p>
          <ul className="space-y-3">
            {topCourses.map((c, idx) => {
              const pct = Math.round((c.count / trendMax) * 100);
              return (
                <li key={c.title}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold truncate max-w-[150px] flex items-center gap-1.5">
                      <span className="text-lime/60 font-mono text-[10px]">#{idx + 1}</span>
                      <span title={c.title}>{c.title}</span>
                    </span>
                    <span className="font-mono text-cream/60">{c.count} enrolled</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-cream/10 overflow-hidden">
                    <div
                      className="h-full bg-lime rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
            {topCourses.length === 0 && (
              <p className="text-sm text-cream/50 text-center py-4">No courses available</p>
            )}
          </ul>
        </DarkCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DarkCard>
          <h3 className="font-display font-bold text-lg">Recent activity</h3>
          <ul className="mt-4 space-y-3">
            {activities.length > 0 ? activities.map((a, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-cream/10 pb-3 last:border-0 hover:bg-cream/[0.02] transition-colors rounded p-1">
                <span className="bg-lime/15 text-lime text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded">{a.c}</span>
                <span className="flex-1 text-sm line-clamp-2">{a.t}</span>
                <span className="text-[10px] text-cream/50 font-mono shrink-0 pt-0.5">{a.w}</span>
              </li>
            )) : <li className="text-sm text-cream/50 text-center py-4">No recent activity</li>}
          </ul>
        </DarkCard>

        <DarkCard>
          <h3 className="font-display font-bold text-lg">Recent Students</h3>
          <div className="mt-4 space-y-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-cream/10">
            {loading && recentStudents.length === 0 && (
              <div className="text-center py-8 text-cream/40 text-sm animate-pulse">Loading…</div>
            )}
            {recentStudents.map((s) => (
              <div key={s.id} className="rounded-xl bg-cream/5 p-3.5 flex items-center gap-4 hover:bg-cream/10 transition-colors">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-lime text-plum-dark font-bold text-xs shrink-0">
                  {s.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate text-cream">{s.name}</div>
                  <div className="text-[11px] text-cream/60 truncate">{s.email}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] uppercase tracking-widest text-cream/50">Joined</div>
                  <div className="text-xs font-mono text-lime mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString("en-IN", { month: "short", day: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
            {!loading && recentStudents.length === 0 && (
              <div className="text-center py-8 text-cream/50 text-sm">
                No recent students found.
              </div>
            )}
          </div>
        </DarkCard>
      </div>
    </div>
  );
}
