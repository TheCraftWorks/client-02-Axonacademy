import { createFileRoute, Link } from "@tanstack/react-router";
import { Video, Users, Clock, Calendar, Bell, Loader2 } from "lucide-react";
import { Card } from "@/components/portal/PortalShell";
import { getMyClassrooms } from "@/lib/api";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_student/student/live")({
  component: LiveClasses,
});

const NAVY = "#0B1F3A";
const GOLD = "#F4B400";
const SKY  = "#2D9CDB";

interface Meeting {
  id: string;
  title: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "live" | "ended";
  roomId: string;
  attendees: unknown[];
  classroomName: string;
}

function LiveClasses() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  async function fetchMeetings() {
    try {
      const classrooms = await getMyClassrooms();
      const all: Meeting[] = classrooms.flatMap((c: any) =>
        (c.meetings || []).map((m: any) => ({
          ...m,
          classroomName: c.name,
        }))
      );
      all.sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      );
      setMeetings(all);
      setError("");
    } catch (err: any) {
      setError(err?.message || "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMeetings();
    const interval = setInterval(fetchMeetings, 30_000);
    return () => clearInterval(interval);
  }, []);

  const liveNow = meetings.filter((m) => m.status === "live");
  const upcoming = meetings.filter((m) => m.status === "scheduled");
  const latestLive = liveNow.length ? liveNow.reduce((prev, cur) =>
    new Date(cur.scheduledAt) > new Date(prev.scheduledAt) ? cur : prev
  ) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading your classes…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold" style={{ color: NAVY }}>Live Classes</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time sessions with faculty and peers</p>
      </div>

      {/* Latest Live Banner */}
      {latestLive && (
        <div className="mb-4 p-4 rounded-xl flex flex-col items-start text-white"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #12294D 100%)` }}>
          <h2 className="font-display text-xl">Latest Live Class</h2>
          <p className="mt-1 text-white/80">{latestLive.title} – {latestLive.classroomName}</p>
          <Link
            to="/live/$roomId"
            params={{ roomId: latestLive.roomId }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold mt-2 transition-all hover:brightness-110 active:scale-95"
            style={{ background: GOLD, color: NAVY }}
          >
            Join latest
          </Link>
        </div>
      )}

      {/* Live cards */}
      {liveNow.length > 0 ? (
        <div className="space-y-3">
          {liveNow.map((m) => (
            <div key={m.id} className="rounded-3xl text-white p-6 lg:p-8 relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #12294D 60%, #1A3560 100%)` }}>
              <div className="absolute inset-0 bg-grid opacity-10" />
              {/* Gold glow */}
              <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full blur-3xl"
                style={{ background: `rgba(244,180,0,0.18)` }} />
              <div className="relative flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
                <div>
                  <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold px-3 py-1 rounded-full"
                    style={{ background: GOLD, color: NAVY }}>
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: NAVY }} />
                    Live now
                  </span>
                  <h2 className="mt-3 font-display text-2xl lg:text-3xl font-bold">{m.title}</h2>
                  <p className="mt-2 text-white/75 text-sm">
                    {m.classroomName} · Started{" "}
                    {new Date(m.scheduledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/60">
                    <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{m.attendees.length} attending</span>
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{m.duration} min</span>
                  </div>
                </div>
                <Link
                  to="/live/$roomId"
                  params={{ roomId: m.roomId }}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-bold shrink-0 transition-all hover:brightness-110 active:scale-95"
                  style={{ background: GOLD, color: NAVY }}
                >
                  <Video className="h-4 w-4" /> Join class
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-dashed p-8 text-center"
          style={{ borderColor: `rgba(45,156,219,0.3)` }}>
          <Video className="h-8 w-8 mx-auto mb-2" style={{ color: `rgba(45,156,219,0.4)` }} />
          <p className="text-sm text-muted-foreground">No live classes right now</p>
        </div>
      )}

      {/* Upcoming */}
      <Card>
        <h3 className="font-display font-bold text-lg flex items-center gap-2" style={{ color: NAVY }}>
          <Calendar className="h-5 w-5" style={{ color: GOLD }} /> Upcoming Classes
        </h3>
        <div className="mt-4 space-y-3">
          {upcoming.map((m) => (
            <div key={m.id} className="flex items-center gap-4 rounded-xl border border-border p-3.5 hover:border-[#2D9CDB]/30 transition-colors">
              <div className="w-36 shrink-0">
                <div className="text-xs font-mono" style={{ color: SKY }}>
                  {new Date(m.scheduledAt).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" })}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(m.scheduledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: NAVY }}>{m.title}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{m.classroomName}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.duration} min</span>
                </div>
              </div>
              <Link
                to="/live/$roomId"
                params={{ roomId: m.roomId }}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold shrink-0 transition-all hover:brightness-110 active:scale-95 text-white"
                style={{ background: `linear-gradient(135deg, ${NAVY}, #1A3560)` }}
              >
                Join class
              </Link>
              <button
                onClick={() => setReminded(prev => new Set(prev).add(m.id))}
                className={`text-xs font-semibold border rounded-full px-4 py-1.5 flex items-center gap-1.5 transition-colors shrink-0`}
                style={reminded.has(m.id)
                  ? { background: GOLD, color: NAVY, borderColor: GOLD }
                  : { background: 'transparent', color: NAVY, borderColor: `rgba(11,31,58,0.2)` }}
              >
                <Bell className="h-3 w-3" />
                {reminded.has(m.id) ? "Reminded" : "Remind me"}
              </button>
            </div>
          ))}
          {upcoming.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No upcoming classes scheduled.</p>
          )}
        </div>
      </Card>
    </div>
  );
}