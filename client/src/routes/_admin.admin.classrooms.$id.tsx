import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import {
  LuArrowLeft, LuMegaphone, LuVideo, LuBookOpen, LuClipboardList,
  LuPlus, LuX, LuTrash2, LuPlay, LuEye, LuEyeOff, LuCheck, LuSend,
  LuCalendar, LuClock, LuRadio, LuUpload, LuUsers, LuCircleDot, LuDownload, LuCopy, LuLink, LuAward, LuShare2, LuUserPlus,
  LuFolder, LuSearch, LuPrinter
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { DarkCard } from "@/components/portal/PortalShell";
import {
  useClassroomStore,
  classroomActions,
  formatDuration,
  uid,
  isClassroomStale,
  markClassroomFresh,
  type Meeting,
  type Quiz,
  type Question,
  type Classroom,
  type Option,
  type QuizAttempt,
} from "@/lib/classroomStore";
import { addStudentsToClassroom, createMeeting, createClassroomAnnouncement, deleteClassroomAnnouncement, deleteMeeting, endMeeting as apiEndMeeting, getAdminUsers, getClassroomById, getQuizReport, publishQuiz, closeQuiz, deleteQuiz as apiDeleteQuiz, createQuiz, startMeeting as apiStartMeeting, updateClassroomStudentStatus, removeStudentFromClassroom, getClassroomJoinRequests, approveClassroomJoinRequest, rejectClassroomJoinRequest, uploadClassroomRecordingToCloudflare, publishRecording, unpublishRecording, deleteRecording, getRecordingStreamUrl, updateQuiz, reuseClassroomRecording, uploadClassroomFileToCloudinary, generateQuizFromPdf, api, createClassroomFolder, updateClassroomFolder, deleteClassroomFolder, getClassroomReuseList, reuseClassroomFolder } from "@/lib/api";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
// @ts-ignore
import html2pdf from "html2pdf.js";
export const Route = createFileRoute("/_admin/admin/classrooms/$id")({
  component: AdminClassroomDetail,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function toDatetimeLocal(isoString?: string) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return "";
  }
}

function toISODateString(localDateStr?: string) {
  if (!localDateStr) return null;
  try {
    const d = new Date(localDateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function MeetingStatusBadge({ status }: { status: Meeting["status"] }) {
  const map: Record<Meeting["status"], { cls: string; icon: IconType; label: string }> = {
    live: { cls: "bg-red-500/20 text-red-300", icon: LuRadio, label: "LIVE" },
    scheduled: { cls: "bg-lime/20 text-lime", icon: LuClock, label: "Scheduled" },
    ended: { cls: "bg-cream/10 text-cream/60", icon: LuCheck, label: "Done" },
    cancelled: { cls: "bg-red-900/30 text-red-400", icon: LuX, label: "Cancelled" },
  };
  const { cls, icon: Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${cls}`}>
      <Icon className={`h-3 w-3 ${status === "live" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ComponentType<any>;
  bg: string;
  text: string;
  border: string;
  iconColor: string;
}

type TabKey = "announcements" | "live" | "recordings" | "tests" | "students" | "requests";

const TABS: readonly TabConfig[] = [
  { key: "announcements", label: "Announcements", icon: LuMegaphone, bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", border: "border-[#93C5FD]", iconColor: "#2563EB" },
  { key: "live", label: "Live Classes", icon: LuVideo, bg: "bg-[#FFE4E6]", text: "text-[#9F1239]", border: "border-[#FDA4AF]", iconColor: "#E11D48" },
  { key: "recordings", label: "Recordings", icon: LuPlay, bg: "bg-[#FFEDD5]", text: "text-[#9A3412]", border: "border-[#FED7AA]", iconColor: "#EA580C" },
  { key: "tests", label: "Tests", icon: LuClipboardList, bg: "bg-[#E0F2FE]", text: "text-[#075985]", border: "border-[#7DD3FC]", iconColor: "#0284C7" },
  { key: "students", label: "Students", icon: LuUsers, bg: "bg-[#D1FAE5]", text: "text-[#065F46]", border: "border-[#A7F3D0]", iconColor: "#059669" },
  { key: "requests", label: "Join Requests", icon: LuUserPlus, bg: "bg-[#F5F3FF]", text: "text-[#5B21B6]", border: "border-[#DDD6FE]", iconColor: "#7C3AED" },
];

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab({ classroom, refreshClassroom }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom> }) {
  const cls = classroom;
  const [text, setText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [driveLink, setDriveLink] = useState("");

  const handlePost = async () => {
    if (!text.trim() || isPosting) return;
    setIsPosting(true);
    try {
      let attachments: any[] = [];
      if (driveLink.trim()) {
        attachments.push({ name: 'Preview', url: driveLink.trim(), type: 'pdf' });
      }
      await createClassroomAnnouncement(classroom.id, text.trim(), attachments);
      setText("");
      setDriveLink("");
      await refreshClassroom();
      toast.success("Announcement posted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post announcement");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (deletingId) return;
    setDeletingId(announcementId);
    try {
      await deleteClassroomAnnouncement(classroom.id, announcementId);
      await refreshClassroom();
      toast.success("Announcement deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete announcement");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compose */}
      <DarkCard>
        <h3 className="font-display font-bold text-sm text-cream mb-3 flex items-center gap-2">
          <LuMegaphone className="h-4 w-4 text-lime" /> Post Announcement
        </h3>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your announcement… (supports emoji 🎯)"
          rows={3}
          disabled={isPosting}
          className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-cream text-sm outline-none focus:border-lime/50 resize-none disabled:opacity-50"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full">
              <LuLink className="h-3.5 w-3.5 text-cream/60 shrink-0" />
              <input
                type="url"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="Paste Google Drive PDF link..."
                disabled={isPosting}
                className="flex-1 sm:w-64 bg-cream/5 border border-cream/10 rounded-lg px-3 py-1.5 text-cream text-xs outline-none focus:border-lime/50 disabled:opacity-50"
              />
              {driveLink && (
                <button
                  onClick={() => setDriveLink("")}
                  disabled={isPosting}
                  className="text-cream/40 hover:text-red-400 shrink-0"
                >
                  <LuX className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handlePost}
            disabled={!text.trim() || isPosting}
            className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2 text-sm font-bold disabled:opacity-40 shrink-0"
          >
            <LuSend className="h-3.5 w-3.5" /> {isPosting ? "Posting…" : "Post to All Students"}
          </button>
        </div>
      </DarkCard>

      {/* Feed */}
      <div className="space-y-3">
        {cls.announcements.length === 0 && (
          <DarkCard className="text-center py-10">
            <LuMegaphone className="h-8 w-8 text-cream/20 mx-auto mb-2" />
            <p className="text-cream/50 text-sm">No announcements yet.</p>
          </DarkCard>
        )}
        {cls.announcements.map((ann) => (
          <DarkCard key={ann.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime text-plum-dark font-bold text-xs">
                  {ann.author.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-cream text-sm font-semibold">{ann.author}</span>
                    <span className="text-cream/50 text-xs">{timeAgo(ann.createdAt)}</span>
                  </div>
                  <p className="text-cream/80 text-sm leading-relaxed">{ann.content}</p>
                  {ann.attachments && ann.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ann.attachments.map((at: any, i: number) => (
                        <a
                          key={i}
                          href={at.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 bg-cream/5 border border-cream/10 rounded-lg px-3 py-2 text-xs font-semibold text-cream/70 hover:bg-cream/10 hover:text-lime transition-all"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                          {"View PDF"}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(ann.id)}
                disabled={deletingId === ann.id}
                className="text-cream/30 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
              >
                <LuTrash2 className="h-4 w-4" />
              </button>
            </div>
          </DarkCard>
        ))}
      </div>
    </div>
  );
}

// ─── Live Classes Tab ─────────────────────────────────────────────────────────

function LiveClassesTab({ classroomId, refreshClassroom }: { classroomId: string; refreshClassroom: () => Promise<Classroom> }) {
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c) => c.id === classroomId)!;
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
    try {
      await deleteMeeting(meetingId);
      await refreshClassroom();
      toast.success("Meeting deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete meeting");
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const handleStartMeeting = async (meetingId: string) => {
    if (startingMeetingId) return;

    setStartingMeetingId(meetingId);

    try {
      await apiStartMeeting(meetingId);
      await refreshClassroom();
      toast.success("Meeting started!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start meeting");
    } finally {
      setStartingMeetingId(null);
    }
  };
  const handleEndMeeting = async (meetingId: string) => {
    try {
      await apiEndMeeting(meetingId);
      await refreshClassroom();
      toast.success("Meeting ended.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not end meeting");
    }
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.scheduledAt) return;
    setSaving(true);
    createMeeting({
      classroom: cls.code || classroomId,
      title: form.title,
      description: form.description,
      scheduledAt: new Date(form.scheduledAt).toISOString(),
      duration: form.duration,
      sendPortalNotification: notifyStudents,
      sendWhatsApp: false,
    })
      .then(async () => {
        await refreshClassroom();
        setForm({ title: "", description: "", scheduledAt: "", duration: 60 });
        setShowForm(false);
        toast.success("Live class scheduled successfully!");
      })
      .catch((err) => {
        console.error("Schedule Error:", err);
        toast.error(err.message || "Could not schedule meeting");
      })
      .finally(() => setSaving(false));
  };

  const upcoming = cls.meetings.filter((m) => m.status !== "ended" && m.status !== "cancelled");
  const past = cls.meetings.filter((m) => m.status === "ended" || m.status === "cancelled");

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
              <button type="submit" disabled={saving} className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-50">{saving ? 'Scheduling…' : 'Confirm & Schedule'}</button>
            </div>
          </form>
        </DarkCard>
      )}

      {/* Upcoming/Live meetings */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-cream/60 mb-3">Upcoming & Live</h3>
          <div className="space-y-3">
            {upcoming.map((m) => (
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
                    <span>{m.attendees.length} joined</span>
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
                      <Link to="/live/$roomId" params={{ roomId: m.roomId }}
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
                  {past.map((m) => (
                    <tr key={m.id} className="border-t border-cream/10">
                      <td className="p-4 font-semibold text-cream">{m.title}</td>
                      <td className="text-cream/70 text-xs">{fmtDate(m.scheduledAt)}</td>
                      <td className="font-mono text-cream/60 text-xs">{m.duration}m</td>
                      <td className="font-mono text-cream/80">{m.attendees.length}</td>
                      <td><MeetingStatusBadge status={m.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DarkCard>
        </div>
      )}

      {cls.meetings.length === 0 && (
        <DarkCard className="text-center py-12">
          <LuVideo className="h-8 w-8 text-cream/20 mx-auto mb-2" />
          <p className="text-cream/50 text-sm">No classes scheduled yet.</p>
        </DarkCard>
      )}
    </div>
  );
}

// ─── Recordings Tab ───────────────────────────────────────────────────────────

function RecordingsTab({ classroom, refreshClassroom }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom> }) {
  const cls = classroom;
  const { accessToken } = useClassroomStore();
  const [activeRec, setActiveRec] = useState<any | null>(null);

  // Classroom Folders & Selective navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Folder CRUD States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");

  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderDesc, setEditFolderDesc] = useState("");

  // Video Upload States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPublished, setUploadPublished] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadBytes, setUploadBytes] = useState({ loaded: 0, total: 0 });
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'preparing' | 'uploading' | 'saving'>('idle');
  const [uploadPartInfo, setUploadPartInfo] = useState<{ part: number; totalParts: number } | null>(null);

  // Video Edit States
  const [editRecId, setEditRecId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTargetFolderId, setEditTargetFolderId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Reuse Modal States
  const [showReuseModal, setShowReuseModal] = useState(false);
  const [reuseClassrooms, setReuseClassrooms] = useState<any[]>([]);
  const [reuseFolders, setReuseFolders] = useState<any[]>([]);
  const [reuseRecordings, setReuseRecordings] = useState<any[]>([]);

  const [selectedSourceClassroomId, setSelectedSourceClassroomId] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Selection tracking
  // Keys are folderId (for whole folder) or recordingId (for individual recording)
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);

  const [isReusing, setIsReusing] = useState(false);

  const formatMB = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createClassroomFolder(cls.id, newFolderName.trim(), newFolderDesc.trim());
      toast.success("Folder created successfully!");
      setIsFolderModalOpen(false);
      setNewFolderName("");
      setNewFolderDesc("");
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to create folder");
    }
  };

  const handleEditFolder = async () => {
    if (!editFolderId || !editFolderName.trim()) return;
    try {
      await updateClassroomFolder(editFolderId, editFolderName.trim(), editFolderDesc.trim());
      toast.success("Folder updated successfully!");
      setEditFolderId(null);
      setEditFolderName("");
      setEditFolderDesc("");
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to update folder");
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete folder "${name}"? All videos inside it will be permanently deleted.`)) return;
    try {
      await deleteClassroomFolder(id);
      toast.success("Folder and its videos deleted!");
      if (currentFolderId === id) setCurrentFolderId(null);
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete folder");
    }
  };

  const handleUploadVideo = async () => {
    if (!uploadTitle.trim() || !uploadFile) {
      toast.error("Title and video file are required");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadBytes({ loaded: 0, total: 0 });
    setUploadPhase('preparing');

    try {
      // Extract video duration in seconds on the client side
      let calculatedDuration = 0;
      try {
        calculatedDuration = await new Promise<number>((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            window.URL.revokeObjectURL(video.src);
            resolve(Math.round(video.duration) || 0);
          };
          video.onerror = () => {
            resolve(0);
          };
          video.src = URL.createObjectURL(uploadFile);
        });
      } catch (durationErr) {
        console.error("Failed to parse video duration, defaulting to 0:", durationErr);
      }

      await uploadClassroomRecordingToCloudflare({
        file: uploadFile,
        classroom: cls.id,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        duration: calculatedDuration,
        isPublished: uploadPublished,
        folderId: currentFolderId || undefined,
        onProgress: ({ loaded, total, percentage, part, totalParts }) => {
          setUploadPhase('uploading');
          setUploadProgress(percentage);
          setUploadBytes({ loaded, total });
          if (part != null && totalParts != null) {
            setUploadPartInfo({ part, totalParts });
          }
          if (percentage === 100) setUploadPhase('saving');
        }
      });

      toast.success("Video uploaded successfully!");
      setIsUploadModalOpen(false);
      setUploadTitle("");
      setUploadDesc("");
      setUploadFile(null);
      setUploadPublished(false);
      setUploadPhase('idle');
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload video");
      setUploadPhase('idle');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadBytes({ loaded: 0, total: 0 });
      setUploadPartInfo(null);
    }
  };

  const handleEditRecording = async () => {
    if (!editRecId || !editTitle.trim()) return;
    setIsEditing(true);
    try {
      const payload: any = {
        title: editTitle.trim(),
        description: editDesc.trim(),
        folder: editTargetFolderId ? editTargetFolderId : null
      };
      await api.put(`/recordings/classroom/${editRecId}`, payload);
      toast.success("Video details updated!");
      setEditRecId(null);
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to update video");
    } finally {
      setIsEditing(false);
    }
  };

  const openReuseModal = async () => {
    try {
      const res = await getClassroomReuseList() as any;
      if (res.success) {
        setReuseClassrooms(res.classrooms || []);
        setReuseFolders(res.folders || []);
        setReuseRecordings(res.recordings || []);
        setShowReuseModal(true);
      }
    } catch (err: any) {
      toast.error("Failed to load classrooms for reuse");
    }
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleConfirmReuse = async () => {
    if (selectedFolderIds.length === 0 && selectedRecIds.length === 0) {
      toast.error("Please select folders or videos to reuse");
      return;
    }

    setIsReusing(true);
    try {
      // 1. Reuse whole folders (without subset)
      const wholeFolderIds = selectedFolderIds.filter(fId => {
        const folderRecs = reuseRecordings.filter(r => r.folder && r.folder.toString() === fId);
        const selectedFolderRecs = folderRecs.filter(r => selectedRecIds.includes(r._id.toString()));
        return selectedFolderRecs.length === folderRecs.length;
      });

      for (const folderId of wholeFolderIds) {
        await reuseClassroomFolder(folderId, cls.id);
      }

      // 2. Reuse individual recordings from folders (subset)
      const partialFolderIds = selectedFolderIds.filter(fId => !wholeFolderIds.includes(fId));
      for (const folderId of partialFolderIds) {
        const folderRecs = reuseRecordings.filter(r => r.folder && r.folder.toString() === folderId);
        const selectedFolderRecs = folderRecs.filter(r => selectedRecIds.includes(r._id.toString())).map(r => r._id.toString());
        if (selectedFolderRecs.length > 0) {
          await reuseClassroomFolder(folderId, cls.id, selectedFolderRecs);
        }
      }

      // 3. Reuse root recordings
      const rootRecs = reuseRecordings.filter(r =>
        selectedRecIds.includes(r.id || r._id.toString()) && !r.folder && r.classroom.toString() === selectedSourceClassroomId
      );
      for (const rec of rootRecs) {
        await reuseClassroomRecording({
          sourceRecordingId: rec.id || rec._id.toString(),
          targetClassroomId: cls.id,
          folderId: currentFolderId || undefined
        });
      }

      toast.success("Assets reused successfully!");
      setShowReuseModal(false);
      setSelectedFolderIds([]);
      setSelectedRecIds([]);
      setSelectedSourceClassroomId("");
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to reuse files");
    } finally {
      setIsReusing(false);
    }
  };

  // Filters for current view
  const visibleFolders = cls.folders || [];
  const visibleRecordings = currentFolderId
    ? (cls.recordings || []).filter(r => r.folder === currentFolderId)
    : [];

  const isAdminDirectSigned = Boolean(
    activeRec?.cloudflareUrl &&
    (activeRec.cloudflareUrl.includes('X-Amz-Signature') || activeRec.cloudflareUrl.includes('X-Amz-Algorithm'))
  );

  const streamUrl = activeRec
    ? (isAdminDirectSigned
      ? activeRec.cloudflareUrl
      : `${getRecordingStreamUrl(activeRec.id)}${accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''}`)
    : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          {currentFolderId ? (
            <div className="flex items-center gap-2 text-sm text-cream/60">
              <button
                className="hover:text-cream flex items-center gap-1 transition-colors font-bold"
                onClick={() => setCurrentFolderId(null)}
              >
                <LuArrowLeft className="w-4 h-4" /> Recordings
              </button>
              <span className="text-cream/40">/</span>
              <span className="font-bold text-lime">
                {visibleFolders.find(f => f.id === currentFolderId)?.name}
              </span>
            </div>
          ) : (
            <div className="text-sm font-semibold text-cream/80">Folder Structure</div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={openReuseModal}
            className="inline-flex items-center gap-2 rounded-full bg-[#F4B400] text-plum-dark px-4 py-2.5 text-xs font-bold shadow-sm hover:bg-[#E0A300] transition-colors"
          >
            <LuCopy className="h-4 w-4" /> Reuse Assets
          </button>
          {!currentFolderId && (
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-cream/10 text-cream px-4 py-2.5 text-xs font-bold hover:bg-cream/20 transition-colors"
            >
              <LuFolder className="h-4 w-4" /> New Folder
            </button>
          )}
          {currentFolderId && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-4 py-2.5 text-xs font-bold hover:bg-lime/90 transition-colors"
            >
              <LuUpload className="h-4 w-4" /> Upload Video
            </button>
          )}
        </div>
      </div>

      {/* Grid of Folders (only visible at root) */}
      {!currentFolderId && visibleFolders.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-cream/50 font-bold">Folders</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {visibleFolders.map((folder) => {
              const videoCount = (cls.recordings || []).filter(r => r.folder === folder.id).length;
              return (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-cream/10 bg-cream/5 hover:border-lime/40 hover:bg-cream/10 transition-all group"
                >
                  <button
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                  >
                    <div className="w-9 h-9 rounded-lg bg-lime/10 text-lime flex items-center justify-center shrink-0">
                      <LuFolder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-cream text-xs truncate">{folder.name}</div>
                      {folder.description && (
                        <div className="text-[10px] text-cream/50 truncate mt-0.5">{folder.description}</div>
                      )}
                      <div className="text-[9px] text-cream/40 mt-1 font-semibold">{videoCount} videos</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      className="p-1.5 hover:bg-cream/10 rounded-lg text-cream/60 hover:text-cream text-xs font-bold"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditFolderId(folder.id);
                        setEditFolderName(folder.name);
                        setEditFolderDesc(folder.description || "");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id, folder.name);
                      }}
                    >
                      <LuTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!currentFolderId && visibleFolders.length === 0 && (
        <DarkCard className="text-center py-12">
          <LuFolder className="h-8 w-8 text-cream/20 mx-auto mb-2" />
          <p className="text-cream/50 text-sm">No folders created yet.</p>
          <p className="text-cream/40 text-xs mt-1">Create a folder to start uploading and managing videos inside.</p>
        </DarkCard>
      )}

      {/* Videos Section */}
      {currentFolderId && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-cream/50 font-bold">
            Videos in Folder
          </div>
          {visibleRecordings.length === 0 ? (
            <DarkCard className="text-center py-10">
              <LuVideo className="h-8 w-8 text-cream/20 mx-auto mb-2" />
              <p className="text-cream/50 text-sm">No videos here yet. Upload or reuse to add one.</p>
            </DarkCard>
          ) : (
            <DarkCard className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cream/5">
                    <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60 border-b border-cream/10">
                      <th className="p-4 text-center w-12">#</th>
                      <th>Recording</th>
                      <th>Duration</th>
                      <th>Stats</th>
                      <th>Chapters</th>
                      <th>Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/10">
                    {visibleRecordings.map((rec, index) => {
                      const avgWatch = rec.viewStats.length
                        ? Math.round(rec.viewStats.reduce((s, v) => s + v.watchedPercent, 0) / rec.viewStats.length)
                        : 0;
                      return (
                        <React.Fragment key={rec.id}>
                          <tr className="hover:bg-cream/5 transition-colors">
                            <td className="p-4 text-center font-mono text-cream/60">{index + 1}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setActiveRec(rec)}
                                  className="w-12 h-9 rounded bg-linear-to-br from-lime/20 to-lime/5 flex items-center justify-center shrink-0 hover:from-lime/30 hover:to-lime/10 transition-colors"
                                >
                                  <LuPlay className="h-3.5 w-3.5 text-lime" />
                                </button>
                                <div className="min-w-0">
                                  <div className="font-semibold text-cream text-xs">{rec.title}</div>
                                  {rec.description && (
                                    <div className="text-[10px] text-cream/50 line-clamp-1 mt-0.5">{rec.description}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-cream/70 text-xs">
                              {formatDuration(rec.duration)}
                            </td>
                            <td className="p-4 text-cream/70 text-xs">
                              {rec.viewStats.length} viewers · {avgWatch}% avg
                            </td>
                            <td className="p-4 font-mono text-cream/70 text-xs">
                              {rec.chapters.length}
                            </td>
                            <td className="p-4">
                              <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${rec.isPublished ? "bg-lime/20 text-lime" : "bg-cream/10 text-cream/60"}`}>
                                {rec.isPublished ? "Published" : "Draft"}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditRecId(rec.id);
                                    setEditTitle(rec.title);
                                    setEditDesc(rec.description || "");
                                    setEditTargetFolderId(rec.folder || "");
                                  }}
                                  className="rounded-full bg-cream/10 text-cream px-2.5 py-1 text-[10px] font-bold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      if (rec.isPublished) {
                                        await unpublishRecording(rec.id);
                                        toast.success("Recording unpublished.");
                                      } else {
                                        await publishRecording(rec.id);
                                        toast.success("Recording published.");
                                      }
                                      await refreshClassroom();
                                    } catch (error) {
                                      toast.error("Failed to publish/unpublish recording.");
                                    }
                                  }}
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${rec.isPublished ? "bg-cream/10 text-cream/70" : "bg-lime/10 text-lime"}`}
                                >
                                  {rec.isPublished ? <><LuEyeOff className="h-2.5 w-2.5" /> Unpublish</> : <><LuEye className="h-2.5 w-2.5" /> Publish</>}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm("Are you sure you want to delete this recording?")) return;
                                    try {
                                      await deleteRecording(rec.id);
                                      await refreshClassroom();
                                      toast.success("Recording deleted.");
                                    } catch (error) {
                                      toast.error("Failed to delete recording.");
                                    }
                                  }}
                                  className="rounded-full bg-cream/5 text-cream/40 hover:text-red-400 p-1.5 hover:bg-red-500/10 transition-colors"
                                >
                                  <LuTrash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Sub-row for detailed viewer analytics if they exist */}
                          {rec.viewStats.length > 0 && (
                            <tr className="bg-cream/[0.02]">
                              <td colSpan={7} className="p-3 border-t border-cream/5">
                                <div className="pl-14">
                                  <div className="text-[9px] uppercase tracking-widest text-cream/40 mb-1.5 font-bold">Viewer Progress</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 max-h-32 overflow-y-auto pr-2">
                                    {rec.viewStats.map((vs) => (
                                      <div key={vs.studentId} className="flex items-center gap-2">
                                        <span className="text-[11px] text-cream/70 w-24 truncate">{vs.studentName}</span>
                                        <div className="flex-1 h-1 bg-cream/10 rounded-full overflow-hidden">
                                          <div className="h-full bg-lime rounded-full" style={{ width: `${vs.watchedPercent}%` }} />
                                        </div>
                                        <span className="text-[10px] font-mono text-cream/50 w-8 text-right">{vs.watchedPercent}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DarkCard>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Create New Folder</h3>
              <button onClick={() => setIsFolderModalOpen(false)} className="text-cream/50 hover:text-cream"><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Folder Name</label>
                <input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="e.g. Anatomy & Physiology"
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description (Optional)</label>
                <textarea
                  value={newFolderDesc}
                  onChange={e => setNewFolderDesc(e.target.value)}
                  placeholder="Briefly describe the contents of this folder"
                  rows={2}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setIsFolderModalOpen(false)} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button onClick={handleCreateFolder} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold">Create Folder</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {editFolderId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Edit Folder Details</h3>
              <button onClick={() => setEditFolderId(null)} className="text-cream/50 hover:text-cream"><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Folder Name</label>
                <input
                  value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description</label>
                <textarea
                  value={editFolderDesc}
                  onChange={e => setEditFolderDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setEditFolderId(null)} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button onClick={handleEditFolder} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">
                Upload to {currentFolderId ? `Folder: ${visibleFolders.find(f => f.id === currentFolderId)?.name}` : "Classroom Root"}
              </h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-cream/50 hover:text-cream" disabled={isUploading}><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Video Title</label>
                <input
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="e.g. Introduction to Cells"
                  disabled={isUploading}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description (Optional)</label>
                <textarea
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="Brief summary of the video lecture"
                  rows={2}
                  disabled={isUploading}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Video File</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  disabled={isUploading}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-cream text-xs outline-none focus:border-lime/50 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-lime/25 file:text-lime hover:file:bg-lime/30"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={uploadPublished}
                  onChange={e => setUploadPublished(e.target.checked)}
                  disabled={isUploading}
                  className="accent-lime h-4 w-4"
                />
                <span className="text-cream/80 text-xs font-semibold">Publish immediately to students</span>
              </label>

              {isUploading && (
                <div className="bg-cream/5 p-4 rounded-xl border border-cream/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cream">
                      {uploadPhase === 'preparing' && 'Preparing upload...'}
                      {uploadPhase === 'uploading' && 'Uploading to cloud...'}
                      {uploadPhase === 'saving' && 'Saving metadata...'}
                    </span>
                    <span className="text-cream/50 font-mono">
                      {formatMB(uploadBytes.loaded)} / {formatMB(uploadBytes.total)}
                    </span>
                  </div>

                  <div className="h-1.5 bg-cream/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-cream/40">
                    <span>{uploadProgress}% Complete</span>
                    {uploadPartInfo && (
                      <span>Part {uploadPartInfo.part} of {uploadPartInfo.totalParts}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setIsUploadModalOpen(false)} disabled={isUploading} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button onClick={handleUploadVideo} disabled={isUploading || !uploadFile || !uploadTitle} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold disabled:opacity-40">
                {isUploading ? "Uploading..." : "Upload Video"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Video Modal */}
      {editRecId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Edit Video Details</h3>
              <button onClick={() => setEditRecId(null)} className="text-cream/50 hover:text-cream" disabled={isEditing}><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Video Title</label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  disabled={isEditing}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={2}
                  disabled={isEditing}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Move to Folder</label>
                <select
                  value={editTargetFolderId}
                  onChange={e => setEditTargetFolderId(e.target.value)}
                  disabled={isEditing}
                  className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                >
                  <option value="">[Root / No Folder]</option>
                  {visibleFolders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setEditRecId(null)} disabled={isEditing} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button onClick={handleEditRecording} disabled={isEditing || !editTitle} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold">
                {isEditing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reuse Modal */}
      {showReuseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Reuse Folders & Videos</h3>
              <button onClick={() => setShowReuseModal(false)} className="text-cream/50 hover:text-cream" disabled={isReusing}><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Select Source Classroom</label>
                <select
                  value={selectedSourceClassroomId}
                  onChange={e => {
                    setSelectedSourceClassroomId(e.target.value);
                    setSelectedFolderIds([]);
                    setSelectedRecIds([]);
                  }}
                  disabled={isReusing}
                  className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                >
                  <option value="">-- Choose a Class --</option>
                  {reuseClassrooms
                    .filter(c => c.id !== cls.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                </select>
              </div>

              {selectedSourceClassroomId && (
                <div className="space-y-3">
                  <div className="text-[10px] uppercase tracking-widest text-cream/50 font-bold">Select Items to Clone</div>

                  {/* Folders in source classroom */}
                  <div className="space-y-2.5">
                    {reuseFolders
                      .filter(f => f.classroom.toString() === selectedSourceClassroomId)
                      .map(folder => {
                        const folderRecs = reuseRecordings.filter(r => r.folder && r.folder.toString() === folder._id.toString());
                        const isFolderChecked = selectedFolderIds.includes(folder._id.toString());
                        const isExpanded = !!expandedFolders[folder._id.toString()];

                        return (
                          <div key={folder._id} className="border border-cream/10 rounded-xl bg-cream/2 overflow-hidden">
                            <div className="flex items-center justify-between p-3 hover:bg-cream/5">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isFolderChecked}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      // Select folder & all its recordings
                                      setSelectedFolderIds(prev => [...prev, folder._id.toString()]);
                                      const recIds = folderRecs.map(r => r._id.toString());
                                      setSelectedRecIds(prev => Array.from(new Set([...prev, ...recIds])));
                                    } else {
                                      // Deselect folder & its recordings
                                      setSelectedFolderIds(prev => prev.filter(id => id !== folder._id.toString()));
                                      const recIds = folderRecs.map(r => r._id.toString());
                                      setSelectedRecIds(prev => prev.filter(id => !recIds.includes(id)));
                                    }
                                  }}
                                  className="accent-lime h-4 w-4"
                                />
                                <div className="text-xs font-semibold text-cream">{folder.name}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleFolderExpanded(folder._id.toString())}
                                className="text-[10px] text-lime font-bold hover:underline"
                              >
                                {isExpanded ? "Collapse" : `Expand (${folderRecs.length} vids)`}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="bg-black/20 border-t border-cream/5 p-3 space-y-2 pl-9">
                                {folderRecs.map(rec => {
                                  const isRecChecked = selectedRecIds.includes(rec._id.toString());
                                  return (
                                    <label key={rec._id} className="flex items-center gap-3 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isRecChecked}
                                        disabled={isFolderChecked} // Locked if parent folder is fully selected
                                        onChange={e => {
                                          if (e.target.checked) {
                                            setSelectedRecIds(prev => [...prev, rec._id.toString()]);
                                          } else {
                                            setSelectedRecIds(prev => prev.filter(id => id !== rec._id.toString()));
                                          }
                                        }}
                                        className="accent-lime h-3.5 w-3.5"
                                      />
                                      <div className="text-xs text-cream/80 truncate">{rec.title}</div>
                                    </label>
                                  );
                                })}
                                {folderRecs.length === 0 && (
                                  <div className="text-[10px] text-cream/40 italic">No recordings in this folder</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {/* Root recordings in source classroom */}
                  {(() => {
                    const rootRecs = reuseRecordings.filter(r => r.classroom.toString() === selectedSourceClassroomId && !r.folder);
                    if (rootRecs.length === 0) return null;
                    return (
                      <div className="border border-cream/10 rounded-xl bg-cream/2 p-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-cream/40 font-bold mb-1">Root Recordings</div>
                        {rootRecs.map(rec => {
                          const isChecked = selectedRecIds.includes(rec._id.toString());
                          return (
                            <label key={rec._id} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedRecIds(prev => [...prev, rec._id.toString()]);
                                  } else {
                                    setSelectedRecIds(prev => prev.filter(id => id !== rec._id.toString()));
                                  }
                                }}
                                className="accent-lime h-3.5 w-3.5"
                              />
                              <div className="text-xs text-cream">{rec.title}</div>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setShowReuseModal(false)} disabled={isReusing} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button
                onClick={handleConfirmReuse}
                disabled={isReusing || (!selectedSourceClassroomId) || (selectedFolderIds.length === 0 && selectedRecIds.length === 0)}
                className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold disabled:opacity-40"
              >
                {isReusing ? "Reusing..." : "Confirm Reuse"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Video Preview Modal */}
      {activeRec && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#110D26] border-b border-cream/10">
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm truncate">{activeRec.title}</span>
              <span className="text-cream/50 text-[10px] uppercase tracking-widest font-mono font-medium">Admin Video Preview</span>
            </div>
            <button
              onClick={() => setActiveRec(null)}
              className="text-white/60 hover:text-white p-1 hover:bg-cream/10 rounded-full transition-colors"
            >
              <LuX className="h-5 w-5" />
            </button>
          </div>

          {/* Player area */}
          <div className="flex flex-1 relative">
            <div className="flex-1 bg-black flex items-center justify-center relative">
              {streamUrl ? (
                <video
                  src={streamUrl}
                  className="w-full h-full max-h-[85vh] object-contain bg-black"
                  controls
                  autoPlay
                  poster="/default-video-thumb.jpg"
                />
              ) : (
                <p className="text-cream/50 text-sm">Video stream URL not configured.</p>
              )}
            </div>

            {/* Chapters sidebar */}
            {activeRec.chapters && activeRec.chapters.length > 0 && (
              <div className="w-64 bg-[#110D26] border-l border-cream/10 overflow-y-auto animate-in slide-in-from-right duration-250">
                <div className="p-3 border-b border-cream/10 text-white/70 text-xs uppercase tracking-widest font-bold">Chapters</div>
                {activeRec.chapters.map((ch: any) => (
                  <button
                    key={ch.id || ch.title}
                    onClick={() => {
                      const video = document.querySelector('video');
                      if (video) {
                        video.currentTime = ch.startTimeSec;
                        video.play().catch(() => { });
                      }
                    }}
                    className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-cream/5 border-b border-cream/5 text-cream/70 hover:text-cream transition-colors"
                  >
                    <span className="font-mono text-[10px] text-lime font-bold shrink-0">
                      {Math.floor(ch.startTimeSec / 60).toString().padStart(2, "0")}:{(ch.startTimeSec % 60).toString().padStart(2, "0")}
                    </span>
                    <span className="text-xs truncate font-medium">{ch.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quiz Builder Tab ─────────────────────────────────────────────────────────

function newQuestion(order: number, defaultMarks: number = 1): Question {
  return {
    id: uid(),
    type: "mcq",
    text: "",
    marks: defaultMarks,
    explanation: "",
    order,
    options: [
      { label: "A", text: "", isCorrect: false },
      { label: "B", text: "", isCorrect: false },
      { label: "C", text: "", isCorrect: false },
      { label: "D", text: "", isCorrect: false },
    ],
  };
}

function QuestionCard({ q, qIdx, onChange, onRemove }: {
  q: Question; qIdx: number;
  onChange: (updated: Question) => void;
  onRemove: () => void;
}) {
  const setType = (type: Question["type"]) => {
    const opts: Option[] = type === "true_false"
      ? [{ label: "True", text: "True", isCorrect: true }, { label: "False", text: "False", isCorrect: false }]
      : [{ label: "A", text: "", isCorrect: false }, { label: "B", text: "", isCorrect: false }, { label: "C", text: "", isCorrect: false }, { label: "D", text: "", isCorrect: false }];
    onChange({ ...q, type, options: opts });
  };

  const toggleCorrect = (label: string) => {
    onChange({
      ...q,
      options: q.options.map((o) => ({
        ...o,
        isCorrect: q.type === "msq" ? (o.label === label ? !o.isCorrect : o.isCorrect) : (o.label === label),
      })),
    });
  };

  const LABELS = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="rounded-xl bg-cream/3 border border-cream/10 p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-lime/10 text-lime text-xs font-bold shrink-0">Q{qIdx + 1}</span>
        <select value={q.type} onChange={(e) => setType(e.target.value as Question["type"])}
          className="bg-cream/5 border border-cream/10 rounded-lg px-3 py-1.5 text-cream text-xs outline-none">
          <option value="mcq">Single Correct (MCQ)</option>
          <option value="msq">Multiple Correct (MSQ)</option>
          <option value="true_false">True / False</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <input type="number" min={0.5} step={0.5} value={q.marks} onChange={(e) => onChange({ ...q, marks: Number(e.target.value) })}
            className="w-16 bg-cream/5 border border-cream/10 rounded-lg px-2 py-1.5 text-cream text-xs outline-none text-center" />
          <span className="text-cream/50 text-xs">marks</span>
          <button onClick={onRemove} className="text-cream/30 hover:text-red-400 ml-2"><LuTrash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <textarea value={q.text} onChange={(e) => onChange({ ...q, text: e.target.value })}
        placeholder={`Question ${qIdx + 1} text…`} rows={2}
        className="w-full bg-cream/5 border border-cream/10 rounded-xl px-3 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none" />

      <div className="space-y-2">
        {q.options.map((opt, oi) => (
          <div key={opt.label} className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors ${opt.isCorrect ? "border-lime/40 bg-lime/5" : "border-cream/10 bg-cream/2"}`}>
            <button onClick={() => toggleCorrect(opt.label)}
              className={`h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-bold border transition-colors ${opt.isCorrect ? "bg-lime border-lime text-plum-dark" : "border-cream/30 text-cream/50"}`}>
              {opt.isCorrect ? <LuCheck className="h-3 w-3" /> : opt.label}
            </button>
            {q.type === "true_false" ? (
              <span className="flex-1 text-sm text-cream/80">{opt.text}</span>
            ) : (
              <input value={opt.text} onChange={(e) => {
                const opts = [...q.options]; opts[oi] = { ...opts[oi], text: e.target.value };
                onChange({ ...q, options: opts });
              }} placeholder={`Option ${opt.label}`} className="flex-1 bg-transparent outline-none text-sm text-cream placeholder:text-cream/30" />
            )}
          </div>
        ))}
        {q.type !== "true_false" && q.options.length < 6 && (
          <button onClick={() => onChange({ ...q, options: [...q.options, { label: LABELS[q.options.length] || `Opt${q.options.length + 1}`, text: "", isCorrect: false }] })}
            className="text-lime/70 hover:text-lime text-xs flex items-center gap-1 mt-1">
            <LuPlus className="h-3 w-3" /> Add option
          </button>
        )}
      </div>
      <input value={q.explanation} onChange={(e) => onChange({ ...q, explanation: e.target.value })}
        placeholder="Explanation shown to student after submission (optional)" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-3 py-2 text-cream/70 text-xs outline-none focus:border-lime/50" />
    </div>
  );
}

function TestsTab({ classroom, refreshClassroom }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom> }) {
  const cls = classroom;
  const classroomId = classroom.id;
  const { classrooms } = useClassroomStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [quizOperationQuizId, setQuizOperationQuizId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [viewQuizId, setViewQuizId] = useState<string | null>(null);
  const [reportAttempts, setReportAttempts] = useState<QuizAttempt[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [duplicateQuiz, setDuplicateQuiz] = useState<Quiz | null>(null);
  const [selectedTargetClassrooms, setSelectedTargetClassrooms] = useState<string[]>([]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [bulkMarksEnabled, setBulkMarksEnabled] = useState(false);
  const [bulkMarksValue, setBulkMarksValue] = useState(4);
  const [bulkNegEnabled, setBulkNegEnabled] = useState(false);
  const [bulkNegValue, setBulkNegValue] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  React.useEffect(() => {
    if (!viewQuizId) {
      setReportAttempts([]);
      return;
    }
    let active = true;
    const loadReport = async () => {
      setIsLoadingReport(true);
      setReportError("");
      try {
        const attempts = await getQuizReport(viewQuizId);
        if (!active) return;
        setReportAttempts(attempts);
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Could not load quiz report");
      } finally {
        if (active) setIsLoadingReport(false);
      }
    };
    loadReport();
    return () => {
      active = false;
    };
  }, [viewQuizId]);

  const [quiz, setQuiz] = useState<Omit<Quiz, "id" | "attempts">>({
    title: "", instructions: "", duration: null, maxAttempts: 1,
    randomizeQuestions: true, randomizeOptions: true,
    showLeaderboard: false, negativeMarking: true,
    negativeMarkValue: 1, passPercent: 60,
    availableFrom: "", availableUntil: "",
    status: "draft", questions: [],
  });

  const updateQ = (idx: number, updated: Question) => {
    setQuiz((q) => { const qs = [...q.questions]; qs[idx] = updated; return { ...q, questions: qs }; });
    if (updated.marks !== bulkMarksValue) {
      setBulkMarksEnabled(false);
    }
  };

  const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);

  const handleSave = async (status: Quiz["status"]) => {
    if (!quiz.title || quiz.questions.length === 0) return;
    setIsSavingQuiz(true);
    try {
      const quizPayload = {
        ...quiz,
        status,
        availableFrom: toISODateString(quiz.availableFrom),
        availableUntil: toISODateString(quiz.availableUntil),
      };

      if (editingQuizId) {
        const updatedQuiz = await updateQuiz(editingQuizId, quizPayload);
        classroomActions.updateQuiz(classroomId, editingQuizId, updatedQuiz);
      } else {
        const createdQuiz = await createQuiz(classroomId, quizPayload);
        classroomActions.addQuiz(classroomId, createdQuiz);
      }
      setShowBuilder(false);
      setEditingQuizId(null);
      setQuiz({ title: "", instructions: "", duration: null, maxAttempts: 1, randomizeQuestions: true, randomizeOptions: true, showLeaderboard: false, negativeMarking: true, negativeMarkValue: 1, passPercent: 60, availableFrom: "", availableUntil: "", status: "draft", questions: [] });
      setBulkMarksEnabled(false);
      setBulkMarksValue(4);
      setBulkNegEnabled(false);
      setBulkNegValue(1);
      toast.success(status === "published" ? "Quiz published successfully!" : "Quiz saved as draft.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not save quiz.');
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsGeneratingPdf(true);
    try {
      const generatedQuestions = await generateQuizFromPdf(file);
      if (generatedQuestions && Array.isArray(generatedQuestions)) {
        // Map unique IDs and orders to the generated questions
        const newQuestions = generatedQuestions.map((q: any, i: number) => ({
          id: uid(),
          type: q.type || "mcq",
          text: q.text,
          marks: q.marks || 1,
          explanation: q.explanation || "",
          order: quiz.questions.length + i + 1,
          options: (q.options || []).map((o: any) => ({
            label: o.label,
            text: o.text,
            isCorrect: !!o.isCorrect
          }))
        }));

        setQuiz(prev => ({
          ...prev,
          questions: [...prev.questions, ...newQuestions]
        }));
        toast.success("Questions generated from PDF.");
      }
    } catch (error) {
      console.error("PDF Generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate questions from PDF");
    } finally {
      setIsGeneratingPdf(false);
      // Reset input value to allow re-upload of same file if needed
      e.target.value = "";
    }
  };

  const handlePublishQuiz = async (quizId: string) => {
    setQuizOperationQuizId(quizId);
    try {
      await publishQuiz(quizId);
      classroomActions.updateQuizStatus(classroomId, quizId, "published");
      toast.success("Quiz published.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish quiz.");
    } finally {
      setQuizOperationQuizId(null);
    }
  };

  const handleCloseQuiz = async (quizId: string) => {
    setQuizOperationQuizId(quizId);
    try {
      await closeQuiz(quizId);
      classroomActions.updateQuizStatus(classroomId, quizId, "closed");
      toast.success("Quiz closed.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to close quiz.");
    } finally {
      setQuizOperationQuizId(null);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    setQuizOperationQuizId(quizId);
    try {
      await apiDeleteQuiz(quizId);
      classroomActions.deleteQuiz(classroomId, quizId);
      toast.success("Quiz deleted.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete quiz.");
    } finally {
      setQuizOperationQuizId(null);
    }
  };

  const handleDownloadQuiz = (q: Quiz, format: 'pdf' | 'doc' | 'print') => {
    const totalMarks = q.questions.reduce((s, quest) => s + quest.marks, 0);

    // Create professional HTML structure
    let htmlContent = `
      <div class="header">
        <h1>${cls.name}</h1>
        <h2>${q.title}</h2>
        ${q.instructions ? `<h3>${q.instructions}</h3>` : ''}
        <div class="meta">
          <span><strong>Total Marks:</strong> ${totalMarks}</span>
          <span><strong>Time:</strong> ${q.duration ? q.duration + ' mins' : 'N/A'}</span>
        </div>
      </div>
      <hr class="header-divider" />
      <div class="questions">
    `;

    q.questions.forEach((quest, i) => {
      htmlContent += `
        <div class="question">
          <div class="q-header">
            <div class="q-title-container">
              <span class="q-num">Q${i + 1}.</span>
              <span class="q-text">${quest.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            </div>
            <span class="q-marks">[${quest.marks} Marks]</span>
          </div>
          <div class="options">
      `;
      quest.options.forEach((opt) => {
        htmlContent += `
            <div class="option">
              <span class="option-label">${opt.label})</span>
              <span class="option-text">${opt.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            </div>
        `;
      });
      htmlContent += `</div></div>`; // end options and question
    });

    htmlContent += `</div>`;

    const fullHtml = `
      <html>
        <head>
          <title>${q.title}</title>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Times New Roman', serif; line-height: 1.5; padding: 40px; color: black; background: white; max-width: 820px; margin: 0 auto; }
            .header { text-align: center; }
            .header h1 { margin: 0 0 10px 0; font-size: 26px; text-transform: uppercase; font-weight: bold; }
            .header h2 { margin: 0 0 8px 0; font-size: 19px; font-weight: bold; }
            .header h3 { margin: 0 0 15px 0; font-size: 16px; font-weight: normal; }
            .meta { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-top: 25px; margin-bottom: 5px; }
            .header-divider { border: none; border-top: 2.5px solid #000; margin: 15px 0 35px 0; }
            .questions { display: flex; flex-direction: column; gap: 35px; }
            .question { page-break-inside: avoid; break-inside: avoid; }
            .q-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; font-size: 16px; line-height: 1.5; }
            .q-title-container { display: flex; align-items: flex-start; flex-grow: 1; text-align: left; }
            .q-num { font-weight: bold; min-width: 35px; display: inline-block; flex-shrink: 0; }
            .q-text { flex-grow: 1; word-break: break-word; }
            .q-marks { font-weight: bold; font-size: 14px; margin-left: 20px; white-space: nowrap; flex-shrink: 0; }
            .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 40px; margin-left: 35px; }
            .option { display: flex; align-items: flex-start; font-size: 15px; line-height: 1.4; }
            .option-label { font-weight: bold; min-width: 25px; display: inline-block; flex-shrink: 0; }
            .option-text { flex-grow: 1; word-break: break-word; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

    if (format === 'doc') {
      const blob = new Blob(['\ufeff', fullHtml], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${q.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_quiz.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (format === 'print') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      } else {
        toast.error("Failed to open print window. Please allow popups for this site.");
      }
    } else if (format === 'pdf') {
      const filename = `${q.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_quiz.pdf`;
      const toastId = toast.loading("Preparing PDF download...");

      setTimeout(async () => {
        // Create an isolated off-screen iframe to render the HTML document safely without touch/scroll interference
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '750px';
        iframe.style.height = '1000px';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        try {
          const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
          if (!iframeDoc) {
            throw new Error("Could not access iframe document");
          }

          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();

          // Wait 250ms for fonts and CSS layout to resolve in iframe
          await new Promise((r) => setTimeout(r, 250));

          // Set iframe height dynamically to match scrollHeight to prevent page clipping in canvas rendering
          const contentHeight = iframeDoc.documentElement?.scrollHeight || iframeDoc.body?.scrollHeight || 1000;
          iframe.style.height = `${contentHeight}px`;

          // Resolve html2pdf function robustly
          // @ts-ignore
          const html2pdfFn = html2pdf.default || html2pdf;
          if (typeof html2pdfFn !== 'function') {
            throw new Error('html2pdf package is not resolving to a function');
          }

          const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          const opt = {
            margin: 12,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: isMobile ? 1.0 : 1.2, // Avoid canvas memory crashes on mobile/tablet devices
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff', // Force canvas background to white (transparency defaults to black in JPEG)
              window: iframe.contentWindow || undefined,
              onclone: (clonedDoc: Document) => {
                try {
                  // Remove all parent stylesheets that were copied to the cloned document.
                  // This prevents parent dark/navy styles and variables from polluting the print template.
                  const styleSheets = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
                  styleSheets.forEach((s) => {
                    const text = s.textContent || '';
                    if (text.includes('Times New Roman') || text.includes('q-header') || text.includes('q-marks')) {
                      // Keep our custom print styles
                      return;
                    }
                    s.parentNode?.removeChild(s);
                  });

                  // Ensure document element and body have white background and black text
                  if (clonedDoc.documentElement) {
                    clonedDoc.documentElement.style.cssText = 'background-color: #ffffff !important; color: #000000 !important; color-scheme: light !important;';
                  }
                  if (clonedDoc.body) {
                    clonedDoc.body.style.cssText = 'background-color: #ffffff !important; color: #000000 !important; color-scheme: light !important;';
                  }
                } catch (e) {
                  console.warn("onclone clean styles error:", e);
                }
              }
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          let pdfBlob: Blob | null = null;
          try {
            pdfBlob = await html2pdfFn().from(iframeDoc.body).set(opt).outputPdf('blob');
          } catch (e1) {
            console.warn("outputPdf('blob') failed, trying toPdf().output('blob'):", e1);
            try {
              pdfBlob = await html2pdfFn().from(iframeDoc.body).set(opt).toPdf().output('blob');
            } catch (e2) {
              console.warn("toPdf().output('blob') failed:", e2);
            }
          }

          if (!pdfBlob || pdfBlob.size === 0) {
            // Native save fallback
            await html2pdfFn().from(iframeDoc.body).set(opt).save();
            toast.dismiss(toastId);
            toast.success("PDF Downloaded!");
            return;
          }

          const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

          // On mobile devices, use native Web Share API if supported for direct Save to Files / Downloads
          if (isMobile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            try {
              await navigator.share({
                files: [pdfFile],
                title: q.title || 'Quiz PDF',
              });
              toast.dismiss(toastId);
              toast.success("PDF saved!");
              return;
            } catch (shareErr: any) {
              if (shareErr.name === 'AbortError') {
                toast.dismiss(toastId);
                return;
              }
              console.warn("navigator.share failed, falling back to anchor download:", shareErr);
            }
          }

          // Direct anchor file download trigger (NO target="_blank") to save file directly
          const blobUrl = URL.createObjectURL(pdfBlob);
          const downloadLink = document.createElement('a');
          downloadLink.href = blobUrl;
          downloadLink.download = filename;
          document.body.appendChild(downloadLink);
          downloadLink.click();

          toast.dismiss(toastId);
          toast.success("PDF Downloaded!");

          setTimeout(() => {
            if (downloadLink.parentNode) {
              document.body.removeChild(downloadLink);
            }
            URL.revokeObjectURL(blobUrl);
          }, 10000);
        } catch (err: any) {
          console.error("PDF generation error:", err);
          toast.dismiss(toastId);
          toast.error("Failed to generate PDF. Please try again.");
        } finally {
          // ALWAYS clean up iframe so main page touch and scroll are never blocked
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }
      }, 50);
    }
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateQuiz || selectedTargetClassrooms.length === 0) return;
    setIsDuplicating(true);
    try {
      const quizData = {
        title: `${duplicateQuiz.title}`,
        instructions: duplicateQuiz.instructions,
        duration: duplicateQuiz.duration,
        maxAttempts: duplicateQuiz.maxAttempts,
        randomizeQuestions: duplicateQuiz.randomizeQuestions,
        randomizeOptions: duplicateQuiz.randomizeOptions,
        showLeaderboard: duplicateQuiz.showLeaderboard,
        negativeMarking: duplicateQuiz.negativeMarking,
        negativeMarkValue: duplicateQuiz.negativeMarkValue,
        passPercent: duplicateQuiz.passPercent,
        availableFrom: duplicateQuiz.availableFrom,
        availableUntil: duplicateQuiz.availableUntil,
        status: "draft",
        questions: duplicateQuiz.questions.map((quest) => ({
          type: quest.type,
          text: quest.text,
          marks: quest.marks,
          explanation: quest.explanation,
          options: quest.options.map((o) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        })),
      };

      for (const targetId of selectedTargetClassrooms) {
        await createQuiz(targetId, quizData);
      }

      toast.success("Quiz duplicated successfully to selected class(es)!");
      setDuplicateQuiz(null);
      setSelectedTargetClassrooms([]);
      await refreshClassroom();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Duplication failed");
    } finally {
      setIsDuplicating(false);
    }
  };

  if (showBuilder) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            setShowBuilder(false);
            setEditingQuizId(null);
            setQuiz({ title: "", instructions: "", duration: null, maxAttempts: 1, randomizeQuestions: true, randomizeOptions: true, showLeaderboard: false, negativeMarking: false, negativeMarkValue: 0.25, passPercent: 60, availableFrom: "", availableUntil: "", status: "draft", questions: [] });
            setBulkMarksEnabled(false);
            setBulkMarksValue(1);
            setBulkNegEnabled(true);
            setBulkNegValue(1);
          }} className="text-cream/60 hover:text-cream"><LuArrowLeft className="h-5 w-5" /></button>
          <h2 className="font-display font-bold text-cream text-xl">{editingQuizId ? "Edit Quiz" : "Quiz Builder"}</h2>
        </div>

        {/* Settings */}
        <DarkCard className="space-y-4">
          <h3 className="font-display font-bold text-cream">Quiz Settings</h3>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Quiz Title *</label>
            <input value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              placeholder="e.g. Module 2 Assessment — Ventilator Management" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Instructions for students</label>
            <textarea value={quiz.instructions} onChange={(e) => setQuiz({ ...quiz, instructions: e.target.value })}
              rows={2} className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Timer (min, blank = no timer)</label>
              <input type="number" min={1} value={quiz.duration ?? ""} onChange={(e) => setQuiz({ ...quiz, duration: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Max Attempts</label>
              <input type="number" min={1} value={quiz.maxAttempts} onChange={(e) => setQuiz({ ...quiz, maxAttempts: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Pass Mark %</label>
              <input type="number" min={1} max={100} value={quiz.passPercent} onChange={(e) => setQuiz({ ...quiz, passPercent: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Available From</label>
              <input type="datetime-local" value={quiz.availableFrom} onChange={(e) => setQuiz({ ...quiz, availableFrom: e.target.value })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Available Until</label>
              <input type="datetime-local" value={quiz.availableUntil} onChange={(e) => setQuiz({ ...quiz, availableUntil: e.target.value })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "randomizeQuestions", label: "Randomize question order" },
              { key: "randomizeOptions", label: "Randomize option order" },
              { key: "negativeMarking", label: "Negative marking (−1/wrong)" },
              { key: "showLeaderboard", label: "Show leaderboard to students" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(quiz[key as keyof typeof quiz])}
                  onChange={(e) => setQuiz({ ...quiz, [key]: e.target.checked })} className="accent-lime" />
                <span className="text-cream/80 text-sm">{label}</span>
              </label>
            ))}
          </div>
        </DarkCard>

        {/* Bulk Marks Setter — Checkbox approach */}
        {quiz.questions.length > 0 && (
          <DarkCard className="space-y-3">
            <span className="text-cream/70 text-sm font-semibold">Quick apply to all questions:</span>
            <div className="flex flex-wrap gap-4">
              {/* Fix Marks */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={bulkMarksEnabled}
                  className="accent-lime h-4 w-4"
                  onChange={(e) => {
                    setBulkMarksEnabled(e.target.checked);
                    if (e.target.checked) {
                      setQuiz(q => ({ ...q, questions: q.questions.map(quest => ({ ...quest, marks: bulkMarksValue })) }));
                    }
                  }}
                />
                <span className="text-cream/80 text-sm">Fix marks:</span>
                <input
                  type="number" min={0.5} step={0.5}
                  value={bulkMarksValue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBulkMarksValue(val);
                    if (bulkMarksEnabled && val > 0) {
                      setQuiz(q => ({ ...q, questions: q.questions.map(quest => ({ ...quest, marks: val })) }));
                    }
                  }}
                  className="w-16 bg-cream/5 border border-cream/20 rounded-lg px-2 py-1 text-cream text-xs outline-none text-center focus:border-lime/50"
                />
                <span className="text-cream/50 text-xs">marks / question</span>
              </label>

              {/* Fix Negative Marks */}
              {quiz.negativeMarking && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkNegEnabled}
                    className="accent-red-400 h-4 w-4"
                    onChange={(e) => {
                      setBulkNegEnabled(e.target.checked);
                      if (e.target.checked) {
                        setQuiz(q => ({ ...q, negativeMarkValue: bulkNegValue }));
                      }
                    }}
                  />
                  <span className="text-cream/80 text-sm">Fix negative mark:</span>
                  <input
                    type="number" min={0.25} step={0.25}
                    value={bulkNegValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBulkNegValue(val);
                      if (bulkNegEnabled && val > 0) {
                        setQuiz(q => ({ ...q, negativeMarkValue: val }));
                      }
                    }}
                    className="w-16 bg-cream/5 border border-cream/20 rounded-lg px-2 py-1 text-cream text-xs outline-none text-center focus:border-red-400/50"
                  />
                  <span className="text-cream/50 text-xs">marks deducted</span>
                </label>
              )}
            </div>
          </DarkCard>
        )}

        {/* Questions */}
        <div className="space-y-3">
          {quiz.questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} qIdx={i} onChange={(u) => updateQ(i, u)} onRemove={() => setQuiz((qz) => ({ ...qz, questions: qz.questions.filter((_, ci) => ci !== i) }))} />
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setQuiz((q) => ({ ...q, questions: [...q.questions, newQuestion(q.questions.length + 1, bulkMarksEnabled ? bulkMarksValue : 1)] }))}
            className="flex-1 rounded-2xl border-2 border-dashed border-lime/20 hover:border-lime/40 py-5 text-lime/70 hover:text-lime text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            <LuPlus className="h-4 w-4" /> Add Question
          </button>
          <label className={`flex-1 rounded-2xl border-2 border-dashed border-lime/20 hover:border-lime/40 py-5 text-lime/70 hover:text-lime text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${isGeneratingPdf ? 'opacity-50 pointer-events-none' : ''}`}>
            <LuUpload className="h-4 w-4" /> {isGeneratingPdf ? 'Generating...' : 'Upload PDF (AI)'}
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={isGeneratingPdf} />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-cream/5 px-5 py-3">
          <span className="text-cream/60 text-sm">Questions: <strong className="text-cream">{quiz.questions.length}</strong></span>
          <span className="text-cream/60 text-sm">Total marks: <strong className="text-cream">{totalMarks}</strong></span>
          <span className="text-cream/60 text-sm">Est. time: <strong className="text-cream">~{quiz.questions.length * 2}m</strong></span>
        </div>

        <div className="flex gap-3">
          <button onClick={() => handleSave("draft")}
            disabled={quiz.questions.length === 0 || isSavingQuiz}
            className="flex-1 rounded-full bg-cream/10 text-cream py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            {isSavingQuiz ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave("published")}
            disabled={quiz.questions.length === 0 || isSavingQuiz}
            className="flex-1 rounded-full bg-lime text-plum-dark py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
            {isSavingQuiz ? 'Publishing...' : 'Publish & Notify Students'}
          </button>
        </div>
      </div>
    );
  }

  // Quiz Report View
  if (viewQuizId) {
    const q = cls.quizzes.find((x) => x.id === viewQuizId);
    if (!q) return null;
    const submitted = reportAttempts.filter((a) => a.status === "submitted");
    const passRate = submitted.length ? Math.round(submitted.filter((a) => a.score.passed).length / submitted.length * 100) : 0;
    const avgScore = submitted.length ? Math.round(submitted.reduce((s, a) => s + a.score.percentage, 0) / submitted.length) : 0;

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewQuizId(null)} className="text-cream/60 hover:text-cream"><LuArrowLeft className="h-5 w-5" /></button>
          <div className="flex-1">
            <h2 className="font-display font-bold text-cream">{q.title} — Report</h2>
            <p className="text-cream/60 text-xs">
              {isLoadingReport ? "Loading submissions…" : `${submitted.length} submissions · ${passRate}% pass rate · ${avgScore}% avg score`}
            </p>
          </div>
          <button
            onClick={() => void refreshClassroom().then(() => getQuizReport(viewQuizId).then(setReportAttempts))}
            disabled={isLoadingReport}
            className="rounded-full bg-cream/10 text-cream px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[{ l: "Submitted", v: submitted.length }, { l: "Pass Rate", v: `${passRate}%` }, { l: "Avg Score", v: `${avgScore}%` }].map((s) => (
            <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-4 text-center">
              <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.l}</div>
              <div className="font-display text-2xl font-bold text-cream mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="p-0 overflow-hidden">
          <DarkCard className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/5">
                <tr className="text-[10px] uppercase tracking-widest text-cream/60 text-left">
                  <th className="p-4">Student</th>
                  <th>Score</th>
                  <th>%</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submitted.map((att) => (
                  <tr key={att.id} className="border-t border-cream/10 hover:bg-cream/5">
                    <td className="p-4 font-semibold text-cream">{att.studentName}</td>
                    <td className="font-mono text-cream/80">{att.score.rawMarks}/{att.score.totalMarks}</td>
                    <td className="font-mono text-cream/80">{att.score.percentage}%</td>
                    <td><span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${att.score.passed ? "bg-lime/20 text-lime" : "bg-red-500/20 text-red-300"}`}>{att.score.passed ? "Pass" : "Fail"}</span></td>
                    <td className="text-cream/60 text-xs">{att.submittedAt ? fmtDate(att.submittedAt) : "—"}</td>
                  </tr>
                ))}
                {isLoadingReport && (<tr><td colSpan={5} className="p-6 text-center text-cream/50 text-sm">Loading report…</td></tr>)}
                {!isLoadingReport && submitted.length === 0 && (<tr><td colSpan={5} className="p-6 text-center text-cream/50 text-sm">No submissions yet.</td></tr>)}
              </tbody>
            </table>
          </DarkCard>
        </div>
      </div>
    );
  }

  // Filter quizzes by search query
  const filteredQuizzes = cls.quizzes.filter((q) =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Quiz list
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="flex items-center gap-2 bg-cream/5 rounded-full px-4 py-2.5 flex-1 max-w-md border border-cream/10">
          <LuSearch className="h-4 w-4 text-cream/50" />
          <input
            type="text"
            placeholder="Search tests by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-cream w-full placeholder:text-cream/40"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-cream/50 hover:text-cream">
              <LuX className="h-4 w-4" />
            </button>
          )}
        </div>

        <button onClick={() => {
          setEditingQuizId(null);
          setQuiz({ title: "", instructions: "", duration: null, maxAttempts: 1, randomizeQuestions: true, randomizeOptions: true, showLeaderboard: false, negativeMarking: true, negativeMarkValue: 1, passPercent: 60, availableFrom: "", availableUntil: "", status: "draft", questions: [] });
          setBulkMarksEnabled(false);
          setBulkMarksValue(1);
          setBulkNegEnabled(false);
          setBulkNegValue(1);
          setShowBuilder(true);
        }} className="inline-flex items-center justify-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold shrink-0">
          <LuPlus className="h-4 w-4" /> Create Quiz
        </button>
      </div>

      {filteredQuizzes.length === 0 && (
        <DarkCard className="text-center py-12">
          <LuClipboardList className="h-8 w-8 text-cream/20 mx-auto mb-2" />
          <p className="text-cream/50 text-sm">
            {searchQuery ? "No tests match your search query." : "No quizzes created yet."}
          </p>
        </DarkCard>
      )}

      <div className="space-y-3">
        {filteredQuizzes.map((q) => {
          const subCount = q.attempts.filter((a) => a.status === "submitted").length;
          return (
            <DarkCard key={q.id}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-cream">{q.title}</span>
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${q.status === "published" ? "bg-lime/20 text-lime" : q.status === "closed" ? "bg-cream/10 text-cream/60" : "bg-yellow-500/20 text-yellow-300"}`}>
                      {q.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-cream/60">
                    <span>{q.questions.length} questions</span>
                    <span>{q.questions.reduce((s, x) => s + x.marks, 0)} total marks</span>
                    {q.duration && <span>{q.duration} min timer</span>}
                    <span>{subCount} submissions</span>
                    <span>Pass: {q.passPercent}%</span>
                  </div>
                  {(q.availableFrom || q.availableUntil) && (
                    <div className="text-[11px] text-lime font-medium mt-2 bg-lime/10 rounded-lg px-2.5 py-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 border border-lime/20">
                      <span className="font-bold text-lime">Availability:</span>
                      {q.availableFrom && <span>Starts: {fmtDate(q.availableFrom)}</span>}
                      {q.availableUntil && <span>Ends: {fmtDate(q.availableUntil)}</span>}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewQuizId(q.id)} className="rounded-full bg-cream/10 text-cream px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors">
                    <LuEye className="h-3 w-3" /> Report
                  </button>
                  <button
                    onClick={() => {
                      setEditingQuizId(q.id);
                      setQuiz({
                        title: q.title,
                        instructions: q.instructions || "",
                        duration: q.duration,
                        maxAttempts: q.maxAttempts || 1,
                        randomizeQuestions: q.randomizeQuestions ?? true,
                        randomizeOptions: q.randomizeOptions ?? true,
                        showLeaderboard: q.showLeaderboard ?? false,
                        negativeMarking: q.negativeMarking ?? false,
                        negativeMarkValue: q.negativeMarkValue ?? 0.25,
                        passPercent: q.passPercent || 60,
                        availableFrom: toDatetimeLocal(q.availableFrom),
                        availableUntil: toDatetimeLocal(q.availableUntil),
                        status: q.status || "draft",
                        questions: q.questions || [],
                      });
                      const hasQuestions = q.questions && q.questions.length > 0;
                      const allSameMarks = hasQuestions && q.questions.every(quest => quest.marks === q.questions[0].marks);
                      if (allSameMarks) {
                        setBulkMarksEnabled(true);
                        setBulkMarksValue(q.questions[0].marks);
                      } else {
                        setBulkMarksEnabled(false);
                        setBulkMarksValue(1);
                      }
                      setBulkNegEnabled(q.negativeMarking ?? false);
                      setBulkNegValue(q.negativeMarkValue ?? 0);
                      setShowBuilder(true);
                    }}
                    className="rounded-full bg-cream/10 text-cream px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setDuplicateQuiz(q);
                      setSelectedTargetClassrooms([]);
                    }}
                    className="rounded-full bg-cream/10 text-cream px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                    title="Reuse/Duplicate to another class"
                  >
                    <LuCopy className="h-3 w-3" /> Reuse
                  </button>
                  <button
                    onClick={() => handleDownloadQuiz(q, 'print')}
                    className="rounded-full bg-cream/10 text-cream px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                    title="Download Quiz as PDF"
                  >
                    <LuDownload className="h-3.5 w-3.5" /> PDF
                  </button>
                  <button
                    onClick={() => handleDownloadQuiz(q, 'doc')}
                    className="rounded-full bg-cream/10 text-cream px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                    title="Download Quiz as Word Doc"
                  >
                    <LuDownload className="h-3.5 w-3.5" /> DOC
                  </button>
                  {q.status === "draft" && (
                    <button onClick={() => handlePublishQuiz(q.id)}
                      disabled={quizOperationQuizId === q.id}
                      className="rounded-full bg-lime/10 text-lime px-3 py-1.5 text-xs font-semibold hover:bg-lime/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                      {quizOperationQuizId === q.id ? 'Publishing...' : 'Publish'}
                    </button>
                  )}
                  {q.status === "published" && (
                    <button onClick={() => handleCloseQuiz(q.id)}
                      disabled={quizOperationQuizId === q.id}
                      className="rounded-full bg-cream/10 text-cream/70 px-3 py-1.5 text-xs font-semibold hover:bg-cream/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                      {quizOperationQuizId === q.id ? 'Closing...' : 'Close'}
                    </button>
                  )}
                  <button onClick={() => handleDeleteQuiz(q.id)}
                    disabled={quizOperationQuizId === q.id}
                    className="rounded-full bg-cream/5 text-cream/40 hover:text-red-400 p-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                    <LuTrash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </DarkCard>
          );
        })}
      </div>

      {/* Quiz Reuse / Duplication Modal */}
      {duplicateQuiz && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Reuse Quiz in other Classes</h3>
              <button
                onClick={() => setDuplicateQuiz(null)}
                className="text-cream/50 hover:text-cream p-1 rounded-full hover:bg-cream/5"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="text-sm text-cream/70 mb-2">
                Duplicate <strong className="text-lime">{duplicateQuiz.title}</strong> to the following classroom(s):
              </div>
              <div className="space-y-2">
                {classrooms
                  .filter((c) => c.id !== classroomId && c.status === "active")
                  .map((targetCls) => {
                    const isChecked = selectedTargetClassrooms.includes(targetCls.id);
                    return (
                      <label
                        key={targetCls.id}
                        className="flex items-center gap-3 bg-cream/5 border border-cream/10 rounded-xl p-3 cursor-pointer hover:border-lime/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTargetClassrooms([...selectedTargetClassrooms, targetCls.id]);
                            } else {
                              setSelectedTargetClassrooms(selectedTargetClassrooms.filter((id) => id !== targetCls.id));
                            }
                          }}
                          className="accent-lime h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-cream">{targetCls.name}</div>
                          <div className="text-[10px] font-mono text-cream/50 uppercase tracking-widest">{targetCls.code} &middot; {targetCls.program}</div>
                        </div>
                      </label>
                    );
                  })}
                {classrooms.filter((c) => c.id !== classroomId && c.status === "active").length === 0 && (
                  <p className="text-xs text-cream/40 text-center py-4">No other active classes available.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button
                type="button"
                onClick={() => setDuplicateQuiz(null)}
                disabled={isDuplicating}
                className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDuplicateConfirm}
                disabled={selectedTargetClassrooms.length === 0 || isDuplicating}
                className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-40"
              >
                {isDuplicating ? "Duplicating…" : "Confirm Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ classroom, refreshClassroom }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom> }) {
  const { users, currentUser } = useClassroomStore();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const cls = classroom;
  const [showAdd, setShowAdd] = useState(false);
  const [mongoStudents, setMongoStudents] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [isAdding, setIsAdding] = useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const loadStudents = async () => {
      try {
        const students = await getAdminUsers("student");
        if (!active) return;
        setMongoStudents(students);
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Could not load students from MongoDB");
      }
    };
    loadStudents();
    return () => {
      active = false;
    };
  }, []);

  const refreshClassroomLocal = refreshClassroom;

  const handleAddStudent = async (studentId: string) => {
    setIsAdding(studentId);
    try {
      await addStudentsToClassroom(classroom.id, [studentId]);
      await refreshClassroomLocal();
      setShowAdd(false);
      toast.success("Student added to classroom.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add student to classroom");
    } finally {
      setIsAdding(null);
    }
  };

  const handleStatusChange = async (studentId: string, status: "active" | "held" | "removed") => {
    if (status === "removed") {
      if (!confirm("Are you sure you want to remove this student from the classroom?")) {
        await refreshClassroomLocal();
        return;
      }
      try {
        await removeStudentFromClassroom(classroom.id, studentId);
        await refreshClassroomLocal();
        toast.success("Student removed from classroom.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove student");
        await refreshClassroomLocal();
      }
      return;
    }

    try {
      await updateClassroomStudentStatus(classroom.id, studentId, status);
      await refreshClassroomLocal();
      toast.success("Student status updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update student status");
    }
  };

  const studentsOnly = mongoStudents.length > 0 ? mongoStudents : users.filter((u) => u.role === "student");
  const notEnrolled = studentsOnly.filter((s) => !cls.students.find((cs) => cs.id === s.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-cream/60 text-sm">{cls.students.length} enrolled · {cls.students.filter((s) => s.status === "active").length} active</p>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold">
            <LuPlus className="h-4 w-4" /> Add Student
          </button>
        )}
      </div>

      {isAdmin && showAdd && notEnrolled.length > 0 && (
        <DarkCard>
          <h3 className="font-display font-bold text-cream mb-3">Add Students to Classroom</h3>
          <div className="space-y-2">
            {notEnrolled.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg bg-cream/5 px-4 py-3">
                <div>
                  <div className="text-cream text-sm font-semibold">{s.name}</div>
                  <div className="text-cream/60 text-xs">{s.email}</div>
                </div>
                <button
                  onClick={() => handleAddStudent(s.id)}
                  disabled={isAdding === s.id}
                  className="rounded-full bg-lime text-plum-dark px-4 py-1.5 text-xs font-bold disabled:opacity-60"
                >
                  {isAdding === s.id ? "Adding..." : "Add"}
                </button>
              </div>
            ))}
          </div>
        </DarkCard>
      )}

      {isAdmin && showAdd && notEnrolled.length === 0 && (
        <DarkCard className="text-center py-8">
          <p className="text-cream/50 text-sm">No available MongoDB students to add.</p>
        </DarkCard>
      )}

      <DarkCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-175 text-sm">
            <thead className="bg-cream/5">
              <tr className="text-[10px] uppercase tracking-widest text-cream/60 text-left">
                <th className="p-4">Student</th>
                <th>Progress</th>
                <th>Attendance</th>
                <th>Quiz Avg</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cls.students.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-cream/50">No students enrolled yet.</td></tr>
              )}
              {cls.students.map((s) => (
                <tr key={s.id} className="border-t border-cream/10 hover:bg-cream/5">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-lime text-plum-dark text-xs font-bold shrink-0">
                        {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold text-cream">{s.name}</div>
                        <div className="text-[11px] text-cream/60 font-mono">{s.enrollmentId}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 w-28">
                      <div className="flex-1 h-1.5 bg-cream/10 rounded-full overflow-hidden">
                        <div className="h-full bg-lime rounded-full" style={{ width: `${s.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono text-cream/70">{s.progress}%</span>
                    </div>
                  </td>
                  <td className="font-mono text-cream/80 text-sm">{s.attendance}%</td>
                  <td className="font-mono text-cream/80 text-sm">{s.quizAvg}%</td>
                  <td>
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${s.status === "active" ? "bg-lime/20 text-lime" : s.status === "held" ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="pr-4">
                    <select value={s.status} onChange={(e) => handleStatusChange(s.id, e.target.value as "active" | "held" | "removed")}
                      className="bg-[#1A0F33] border border-cream/10 rounded-lg px-2 py-1 text-cream/70 text-xs outline-none">
                      <option value="active">Active</option>
                      <option value="held">Hold</option>
                      <option value="removed">Remove</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DarkCard>
    </div>
  );
}

// ─── Join Requests Tab ────────────────────────────────────────────────────────

function JoinRequestsTab({ classroom, refreshClassroom }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom> }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const data = await getClassroomJoinRequests(classroom.id);
      if (data.success) {
        setRequests(data.requests);
      } else {
        toast.error(data.message || "Failed to load requests");
      }
    } catch (err: any) {
      toast.error(err.message || "Error loading join requests");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchRequests();
  }, [classroom.id]);

  const handleApprove = async (reqId: string) => {
    setProcessing(reqId);
    try {
      const data = await approveClassroomJoinRequest(classroom.id, reqId);
      if (data.success) {
        await refreshClassroom();
        fetchRequests();
        toast.success("Student approved and enrolled.");
      } else {
        toast.error(data.message || "Failed to approve request");
      }
    } catch (err: any) {
      toast.error(err.message || "Error approving request");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (reqId: string) => {
    setProcessing(reqId);
    try {
      const data = await rejectClassroomJoinRequest(classroom.id, reqId);
      if (data.success) {
        fetchRequests();
        toast.success("Join request rejected.");
      } else {
        toast.error(data.message || "Failed to reject request");
      }
    } catch (err: any) {
      toast.error(err.message || "Error rejecting request");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <div className="text-center py-8 text-cream/50">Loading requests...</div>;

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <DarkCard className="text-center py-10">
          <p className="text-cream/50">No pending join requests.</p>
        </DarkCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map(req => (
            <DarkCard key={req._id}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-cream font-bold">{req.fullName}</h3>
                  <p className="text-cream/60 text-sm">{req.email}</p>
                  <p className="text-cream/60 text-sm">{req.phone}</p>
                </div>
                <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">Pending</span>
              </div>
              <div className="flex gap-3">
                <button
                  disabled={processing === req._id}
                  onClick={() => handleReject(req._id)}
                  className="flex-1 py-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 font-semibold text-sm disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  disabled={processing === req._id}
                  onClick={() => handleApprove(req._id)}
                  className="flex-1 py-2 bg-lime text-plum-dark rounded hover:bg-lime/90 font-bold text-sm disabled:opacity-50"
                >
                  {processing === req._id ? "Approving..." : "Approve"}
                </button>
              </div>
            </DarkCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdminClassroomDetail() {
  const params = (Route.useParams as any)();
  const id = params.id as string;
  const { classrooms, currentUser } = useClassroomStore();

  // ── Stale-While-Revalidate: grab cached classroom immediately ──────────────
  const storeClassroom = React.useMemo(
    () => classrooms.find((c) => c.id === id) ?? null,
    [classrooms, id]
  );

  // Only show the full-page spinner when we have NOTHING in cache
  const [isLoading, setIsLoading] = useState(!storeClassroom);
  const [tab, setTab] = useState<TabKey>("announcements");

  const visibleTabs = React.useMemo(() => {
    if (currentUser?.role === "faculty") {
      return TABS.filter((t) => t.key !== "requests");
    }
    return TABS;
  }, [currentUser]);

  React.useEffect(() => {
    if (currentUser?.role === "faculty" && tab === "requests") {
      setTab("announcements");
    }
  }, [currentUser, tab]);

  const refreshClassroom = React.useCallback(async () => {
    const refreshed = await getClassroomById(id);
    if (storeClassroom) {
      classroomActions.updateClassroom(id, refreshed);
    } else {
      classroomActions.addClassroom(refreshed);
    }
    markClassroomFresh(id);
    return refreshed;
  }, [id, storeClassroom]);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      // Skip entirely if cache is fresh
      if (storeClassroom && !isClassroomStale(id)) return;

      try {
        if (!storeClassroom) setIsLoading(true);
        await refreshClassroom();
      } catch (err) {
        if (active && !storeClassroom) {
          toast.error(err instanceof Error ? err.message : "Could not load classroom by id");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [id]);

  // Merge: prefer store data (kept fresh by background sync) over nothing
  const classroom = React.useMemo(
    () => storeClassroom,
    [storeClassroom]
  );

  if (isLoading && !classroom) {
    return (
      <div className="text-cream text-center py-20">
        <p className="text-cream/60">Loading classroom...</p>
      </div>
    );
  }



  if (!classroom) {
    return (
      <div className="text-cream text-center py-20">
        <p className="text-cream/60">Classroom not found.</p>
        <Link to="/admin/classrooms" className="mt-4 text-lime block">← Back to Classrooms</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-cream">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/admin/classrooms" className="text-cream/60 hover:text-cream mt-1 shrink-0">
          <LuArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold">{classroom.name}</h1>
            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${classroom.status === "active" ? "bg-lime/20 text-lime" : "bg-cream/10 text-cream/60"}`}>{classroom.status}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="font-mono text-[11px] text-cream/50">{classroom.code}</span>
            <span className="text-cream/60 text-xs">·</span>
            <span className="text-cream/60 text-xs">{classroom.students.filter((s) => s.status === "active").length} / {classroom.maxStudents} students</span>
            <span className="text-cream/60 text-xs">·</span>
            <span className="text-cream/60 text-xs">{classroom.program}</span>
            {classroom.instructors && classroom.instructors.length > 0 && (
              <>
                <span className="text-cream/60 text-xs">·</span>
                <span className="text-cream/60 text-xs font-semibold text-lime/80">Faculty: {classroom.instructors.map(i => i.name).join(", ")}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            const teacherName = classroom.instructors?.[0]?.name || "Axon Med Academy";
            const inviteMsg = `Your teacher, ${teacherName}, has invited you to join classroom ${classroom.name}.

Classroom ID: ${classroom.code}
Class Name: ${classroom.name}
Subject Name: ${classroom.program}

Join now using the link below or the classroom ID above on Axon Med Academy App to never miss any classwork! 📚🤓
Enjoy your learning through practice bits, quizzes, classwork & much more!


Tap the link below to join:
${window.location.origin}/classroom-join/${classroom.id}`;

            navigator.clipboard.writeText(inviteMsg);
            toast.success('Share invite copied to clipboard!');
          }}
          className="inline-flex items-center gap-2 rounded-full bg-lime/20 text-lime px-4 py-2 text-sm font-bold hover:bg-lime/30 transition-colors"
        >
          <LuShare2 className="h-4 w-4" /> Share Link
        </button>
      </div>

      {/* Grid tab bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3.5 max-w-2xl mx-auto my-6">
        {visibleTabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border ${t.bg} ${t.text} ${t.border} transition-all relative overflow-hidden group aspect-square shadow-xs ${isActive
                  ? `scale-[1.04] ring-2 ring-offset-2 ring-offset-slate-900 shadow-md ${t.key === 'live' ? 'ring-[#E11D48]' : t.key === 'recordings' ? 'ring-[#EA580C]' : t.key === 'announcements' ? 'ring-[#2563EB]' : t.key === 'tests' ? 'ring-[#0284C7]' : t.key === 'students' ? 'ring-[#059669]' : 'ring-[#7C3AED]'}`
                  : "hover:scale-[1.02] hover:shadow-sm"
                }`}
            >
              {t.key === 'requests' && (classroom.pendingJoinRequestsCount || 0) > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#E11D48] text-white text-[9px] font-extrabold flex items-center justify-center animate-bounce">
                  {classroom.pendingJoinRequestsCount}
                </span>
              )}

              <t.icon className="w-8 h-8 mb-1.5 transition-transform group-hover:scale-110" style={{ color: t.iconColor }} />
              <span className="text-[10px] sm:text-xs font-black tracking-tight text-center leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content area */}
      <div className="border-t border-cream/10 pt-6">
        {tab === "announcements" && <AnnouncementsTab classroom={classroom} refreshClassroom={refreshClassroom} />}
        {tab === "live" && <LiveClassesTab classroomId={classroom.id} refreshClassroom={refreshClassroom} />}
        {tab === "recordings" && <RecordingsTab classroom={classroom} refreshClassroom={refreshClassroom} />}
        {tab === "tests" && <TestsTab classroom={classroom} refreshClassroom={refreshClassroom} />}
        {tab === "students" && <StudentsTab classroom={classroom} refreshClassroom={refreshClassroom} />}
        {tab === "requests" && <JoinRequestsTab classroom={classroom} refreshClassroom={refreshClassroom} />}
      </div>
    </div>
  );
}
