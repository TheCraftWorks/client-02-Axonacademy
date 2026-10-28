import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LuVideo, LuPlus, LuX, LuTrash2, LuPlay, LuCheck,
  LuCalendar, LuClock, LuRadio, LuUsers, LuCircleDot, LuCopy, LuLink, LuShare2,
  LuRefreshCw, LuLoader
} from "react-icons/lu";
import { DarkCard } from "@/components/portal/PortalShell";
import type { Classroom } from "@/lib/classroomStore";
import {
  createMeeting, deleteMeeting, endMeeting as apiEndMeeting,
  startMeeting as apiStartMeeting, getClassroomById
} from "@/lib/api";
import { classroomActions, markClassroomFresh, useClassroomStore } from "@/lib/classroomStore";
import { toast } from "sonner";
import { MeetingStatusBadge, DarkTabSkeletonLoader, fmtDate, fmtShortDate, fmtTime, toDatetimeLocal, toISODateString } from "./shared";

function LiveClassesTab({ classroomId, refreshClassroom, isFetching }: { classroomId: string; refreshClassroom: () => Promise<Classroom>; isFetching?: boolean }) {
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c: any) => c.id === classroomId);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", scheduledAt: "", duration: 60 });
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startingMeetingId, setStartingMeetingId] = useState<string | null>(null);
  const formatForDateTimeLocal = (value: string) => {
    if (!value) return "";
    // normalize ISO and local datetime values for the browser picker
    const local = value.includes("T") ? value.slice(0, 16) : value;
    return local;
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    setDeletingMeetingId(meetingId);
    classroomActions.deleteMeeting(classroomId, meetingId);
    try {
      await deleteMeeting(meetingId);
      toast.success("Meeting deleted.");
      await refreshClassroom();
    } catch (err) {
      await refreshClassroom();
      toast.error(err instanceof Error ? err.message : "Could not delete meeting");
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    if (startingMeetingId) return;

    setStartingMeetingId(meetingId);
    classroomActions.startMeeting(classroomId, meetingId);

    try {
      await apiStartMeeting(meetingId);
      toast.success("Meeting started!");
      await refreshClassroom();
    } catch (err) {
      await refreshClassroom();
      toast.error(err instanceof Error ? err.message : "Could not start meeting");
    } finally {
      setStartingMeetingId(null);
    }
  };

  const handleEndMeeting = async (meetingId: string) => {
    classroomActions.endMeeting(classroomId, meetingId);
    try {
      await apiEndMeeting(meetingId);
      toast.success("Meeting ended.");
      await refreshClassroom();
    } catch (err) {
      await refreshClassroom();
      toast.error(err instanceof Error ? err.message : "Could not end meeting");
    }
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.scheduledAt) return;
    setSaving(true);
    createMeeting({
      classroom: cls?.code || classroomId,
      title: form.title,
      description: form.description,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      duration: form.duration,
      sendPortalNotification: notifyStudents,
      sendWhatsApp: false,
    })
      .then(async (res: any) => {
        if (res?.meeting) {
          classroomActions.addMeeting(classroomId, {
            ...res.meeting,
            id: res.meeting._id || res.meeting.id,
            roomId: res.meeting.roomId,
            status: res.meeting.status || "scheduled",
          });
        }
        setForm({ title: "", description: "", scheduledAt: "", duration: 60 });
        setShowForm(false);
        toast.success("Live class scheduled successfully!");
        await refreshClassroom();
      })
      .catch((err) => {
        console.error("Schedule Error:", err);
        toast.error(err.message || "Could not schedule meeting");
      })
      .finally(() => setSaving(false));
  };

  const meetings = cls?.meetings || [];
  const upcoming = meetings.filter((m: any) => m.status !== "ended" && m.status !== "cancelled");
  const past = meetings.filter((m: any) => m.status === "ended" || m.status === "cancelled");

  return (
    <div className="space-y-5">
      {/* Schedule button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold"
        >
          <LuPlus className="h-4 w-4" /> Schedule Live Class
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <DarkCard>
          <h3 className="font-display font-bold text-cream mb-4">Schedule a Live Class</h3>
          <form onSubmit={handleSchedule} className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Class Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Ventilator Mode Deep Dive" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What will be covered?" rows={2} className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Date & Time *</label>
                <input required type="datetime-local" value={formatForDateTimeLocal(form.scheduledAt)} onChange={(e) => setForm({ ...form, scheduledAt: e.currentTarget.value })}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Duration</label>
                <select value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50">
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-cream/70">
              <input
                id="notify-students"
                type="checkbox"
                checked={notifyStudents}
                onChange={(e) => setNotifyStudents(e.target.checked)}
                className="h-4 w-4 rounded border-cream/20 bg-cream/5 text-lime focus:ring-lime"
              />
              <label htmlFor="notify-students" className="select-none">Send join-link notification to active students</label>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-50">{saving ? 'Schedulingâ€¦' : 'Confirm & Schedule'}</button>
            </div>
          </form>
        </DarkCard>
      )}

      {/* Upcoming/Live meetings */}
      {isFetching && meetings.length === 0 ? (
        <DarkTabSkeletonLoader type="rows" />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-cream/60 mb-3">Upcoming & Live</h3>
              <div className="space-y-3">
                {upcoming.map((m: any) => (
                  <DarkCard key={m.id} className="flex items-center gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lime/10 text-lime">
                      {m.status === "live" ? <LuRadio className="h-5 w-5 animate-pulse" /> : <LuCalendar className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-cream text-sm truncate">{m.title}</span>
                        <MeetingStatusBadge status={m.status} />
                      </div>
                      <div className="text-cream/60 text-xs mt-0.5 flex items-center gap-3">
                        <span className="flex items-center gap-1"><LuCalendar className="h-3 w-3" /> {fmtShortDate(m.scheduledAt)}</span>
                        <span className="flex items-center gap-1"><LuClock className="h-3 w-3" /> {fmtTime(m.scheduledAt)}</span>
                        <span>{m.duration} min</span>
                        <span>{(m.attendees || []).length} joined</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {m.status === "scheduled" && (
                        <button
                          onClick={() => void handleStartMeeting(m.id)}
                          disabled={startingMeetingId === m.id}
                          className="rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {startingMeetingId === m.id ? (
                            <>
                              <svg
                                className="h-3.5 w-3.5 animate-spin"
                                viewBox="0 0 24 24"
                                fill="none"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  opacity="0.25"
                                />
                                <path
                                  d="M22 12a10 10 0 00-10-10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                />
                              </svg>
                              Starting...
                            </>
                          ) : (
                            <>
                              <LuPlay className="h-3 w-3" />
                              Start
                            </>
                          )}
                        </button>
                      )}
                      {m.status === "live" && (
                        <>
                          <Link to="/live/$roomId" params={{ roomId: m.roomId || m.id }}
                            className="rounded-full bg-red-500/20 text-red-300 px-4 py-2 text-xs font-bold flex items-center gap-1">
                            <LuRadio className="h-3 w-3" /> Join Class
                          </Link>
                          <button onClick={() => void handleEndMeeting(m.id)}
                            className="rounded-full bg-cream/10 text-cream/70 px-3 py-2 text-xs">
                            End
                          </button>
                        </>
                      )}
                      <button onClick={() => void handleDeleteMeeting(m.id)}
                        disabled={deletingMeetingId === m.id}
                        className="rounded-full bg-cream/5 text-cream/40 hover:text-red-400 p-2 text-xs disabled:opacity-50">
                        <LuTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </DarkCard>
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-cream/60 mb-3">Past Sessions</h3>
              <DarkCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-162.5 text-sm">
                    <thead className="bg-cream/5">
                      <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                        <th className="p-4">Class</th><th>Date</th><th>Duration</th><th>Attendees</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {past.map((m: any) => (
                        <tr key={m.id} className="border-t border-cream/10">
                          <td className="p-4 font-semibold text-cream">{m.title}</td>
                          <td className="text-cream/70 text-xs">{fmtDate(m.scheduledAt)}</td>
                          <td className="font-mono text-cream/60 text-xs">{m.duration}m</td>
                          <td className="font-mono text-cream/80">{(m.attendees || []).length}</td>
                          <td><MeetingStatusBadge status={m.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DarkCard>
            </div>
          )}

          {meetings.length === 0 && !showForm && (
            <DarkCard className="text-center py-12">
              <LuVideo className="h-8 w-8 text-cream/20 mx-auto mb-2" />
              <p className="text-cream/50 text-sm">No classes scheduled yet.</p>
            </DarkCard>
          )}
        </>
      )}
    </div>
  );
}

// â”€â”€â”€ Recordings Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export { LiveClassesTab };
