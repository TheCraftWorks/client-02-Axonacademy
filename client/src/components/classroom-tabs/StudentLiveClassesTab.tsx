import React from "react";
import { Video, Radio, Calendar, Clock } from "lucide-react";
import { useClassroomStore } from "@/lib/classroomStore";
import { TabSkeletonLoader, fmtDate } from "./shared";

function LiveClassesTab({ classroomId, isFetching }: { classroomId: string; isFetching?: boolean }) {
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c: any) => c.id === classroomId || c._id === classroomId);

  const meetings = cls?.meetings || [];
  const upcoming = meetings
    .filter((m: any) => m.status === "scheduled" || m.status === "live")
    .sort((a: any, b: any) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  const past = meetings
    .filter((m: any) => m.status === "ended")
    .sort((a: any, b: any) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  if (isFetching && meetings.length === 0) {
    return <TabSkeletonLoader type="rows" />;
  }

  if (!cls) return null;

  return (
    <div className="space-y-5">
      {meetings.length === 0 && !isFetching && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
          <Video className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No live classes scheduled yet.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Upcoming & Live</h3>
          <div className="space-y-3">
            {upcoming.map((m: any) => (
              <div key={m.id} className={`rounded-2xl border p-5 ${m.status === "live" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-display font-bold text-plum-dark">{m.title}</span>
                      {m.status === "live" && (
                        <span className="bg-red-100 text-red-600 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded flex items-center gap-1">
                          <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm">{m.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(m.scheduledAt)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.duration} min</span>
                    </div>
                  </div>
                  {m.status === "live" ? (
                    <a
                      href={`/live/${m.roomId || m.id}`}
                      className="rounded-full bg-red-500 text-white px-5 py-2.5 text-sm font-bold flex items-center gap-2 shrink-0"
                    >
                      <Radio className="h-4 w-4" /> Join Now
                    </a>
                  ) : (
                    <a
                      href={`/live/${m.roomId || m.id}`}
                      className="rounded-full bg-plum-dark text-cream px-5 py-2.5 text-sm font-bold flex items-center gap-2 shrink-0 hover:bg-plum transition-colors"
                    >
                      Join Class
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Past Sessions</h3>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 text-left">
                  <th className="p-4">Class</th><th>Date</th><th>Duration</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map((m: any) => (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-semibold text-plum-dark">{m.title}</td>
                    <td className="text-slate-500 text-xs">{fmtDate(m.scheduledAt)}</td>
                    <td className="text-slate-500 text-xs font-mono">{m.duration}m</td>
                    <td><span className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded">Done</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export { LiveClassesTab as StudentLiveClassesTab };
