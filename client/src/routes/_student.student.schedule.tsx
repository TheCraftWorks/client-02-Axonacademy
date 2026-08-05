import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import { getMyMeetings } from "@/lib/api";

interface MeetingsResponse {
  success: boolean;
  meetings: Array<any>;
}

export const Route = createFileRoute("/_student/student/schedule")({
  component: Schedule,
});

const NAVY = "#0B1F3A";
const GOLD = "#F4B400";
const SKY  = "#2D9CDB";

const typeStyle: Record<string, React.CSSProperties> = {
  live:      { background: '#EF4444', color: '#fff' },
  scheduled: { background: `rgba(11,31,58,0.9)`, color: '#fff' },
  ended:     { background: '#F1F5F9', color: '#94A3B8', textDecoration: 'line-through' },
};

function Schedule() {
  const { classrooms, currentUser } = useClassroomStore();
  const studentId = currentUser?.id || "";
  const { data, isLoading } = useQuery<MeetingsResponse>({
    queryKey: ['myMeetings'],
    queryFn: getMyMeetings,
    enabled: !!currentUser,
    staleTime: 1000 * 60,
    retry: 1,
  });

  const backendMeetings = data?.meetings ?? [];
  const allMeetings = backendMeetings.map((m: any) => ({
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

  const enrolledClassrooms = classrooms.filter((c) =>
    c.students.some((s) => s.id === studentId && s.status === "active")
  );
  const localMeetings = enrolledClassrooms.flatMap((c) =>
    c.meetings.map((m) => ({ ...m, classroomName: c.name, program: c.program }))
  ).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const meetings = backendMeetings.length > 0 ? allMeetings.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()) : localMeetings;

  const upcoming = meetings.filter((m) => m.status !== "ended" && m.status !== "cancelled");
  const past = meetings.filter((m) => m.status === "ended" || m.status === "cancelled");

  function fmt(iso: string) {
    return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold" style={{ color: NAVY }}>My Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">All upcoming live classes and sessions</p>
      </div>

      <Card>
        <h3 className="font-display font-bold text-lg mb-4" style={{ color: NAVY }}>Upcoming Sessions</h3>
        {upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">No upcoming classes scheduled.</p>
        )}
        <div className="space-y-3">
          {upcoming.map((m) => (
            <div key={m.id} className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:border-[#2D9CDB]/30">
              <div className="text-center w-20 shrink-0">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {new Date(m.scheduledAt).toLocaleDateString("en-IN", { weekday: "short" })}
                </div>
                <div className="font-display font-bold text-sm" style={{ color: NAVY }}>
                  {new Date(m.scheduledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{m.duration} min</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: NAVY }}>{m.title}</div>
                <div className="text-xs text-muted-foreground truncate">{m.classroomName}</div>
                {m.description && <div className="text-xs text-muted-foreground/70 truncate mt-0.5">{m.description}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded"
                  style={typeStyle[m.status] || { background: 'rgba(11,31,58,0.08)', color: NAVY }}>
                  {m.status}
                </span>
                {m.status === "live" && (
                  <a
                    href={`/live/${m.roomId}`}
                    className="rounded-full text-white text-xs font-bold px-4 py-2 animate-pulse inline-flex"
                    style={{ background: '#EF4444' }}
                  >
                    Join Now
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {past.length > 0 && (
        <Card>
          <h3 className="font-display font-bold text-lg mb-4" style={{ color: NAVY }}>Past Sessions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="pb-3">Class</th><th className="pb-3">Date</th><th className="pb-3">Duration</th><th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3">
                      <div className="font-semibold" style={{ color: NAVY }}>{m.title}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{m.classroomName}</div>
                    </td>
                    <td className="py-3 text-muted-foreground text-xs">{fmt(m.scheduledAt)}</td>
                    <td className="py-3 font-mono text-xs">{m.duration}m</td>
                    <td className="py-3">
                      <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-slate-100 text-slate-500">{m.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {allMeetings.length === 0 && (
        <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: `rgba(45,156,219,0.3)` }}>
          <p className="text-slate-400 text-sm">No sessions found for your enrolled classrooms.</p>
        </div>
      )}
    </div>
  );
}
