import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { Search, Plus, Download, Mail, ChevronDown, ChevronUp, Video, BookOpen, ClipboardList, X, Loader2, Trash2 } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore, adminActions, classroomActions, messageActions, type EnrolledStudent } from "@/lib/classroomStore";
import { useState, useMemo, useEffect } from "react";
import { getAdminUsers, getClassrooms as apiGetClassrooms, createAdminUser, addStudentsToClassroom, deleteAdminUser, removeStudentFromClassroom, updateClassroomStudentStatus } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/students")({
  component: AdminStudents,
});

const statusStyle: Record<string, string> = {
  active: "bg-lime/20 text-lime",
  placed: "bg-blue-500/20 text-blue-300",
  "at risk": "bg-red-500/20 text-red-300",
  removed: "bg-red-900/40 text-red-200",
  held: "bg-yellow-500/20 text-yellow-300",
};

function SendMessageModal({ studentId, studentName, onClose }: { studentId: string; studentName: string; onClose: () => void }) {
  const { threads, currentUser } = useClassroomStore();
  const [text, setText] = useState("");

  const thread = threads.find(t => t.participantIds.includes(studentId) && t.participantIds.includes("admin-01") && t.type === "direct");

  const handleSend = () => {
    if (!text.trim()) return;
    let t = thread;
    if (!t) {
      t = messageActions.createThread(studentId, studentName);
    }
    messageActions.sendMessage(t.id, "admin-01", "Admin", text.trim());
    setText("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <DarkCard className="w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-cream">Message {studentName}</h2>
          <button onClick={onClose} className="text-cream/50 hover:text-cream"><X className="h-5 w-5" /></button>
        </div>
        {thread && thread.messages.length > 0 && (
          <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
            {thread.messages.slice(-3).map(m => (
              <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.senderId === "admin-01" ? "bg-lime/10 text-lime ml-8" : "bg-cream/5 text-cream/80 mr-8"}`}>
                <div className="text-[10px] text-cream/50 mb-0.5">{m.senderName}</div>
                {m.text}
              </div>
            ))}
          </div>
        )}
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder="Type your message to the student…"
          className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-cream text-sm outline-none focus:border-lime/50 resize-none" />
        <div className="flex gap-3 mt-3">
          <button onClick={onClose} className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold">Cancel</button>
          <button onClick={handleSend} disabled={!text.trim()} className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-40">Send Message</button>
        </div>
      </DarkCard>
    </div>
  );
}

function StudentDetail({ studentId, onRefresh }: { studentId: string; onRefresh: () => void }) {
  const { classrooms } = useClassroomStore();
  const enrolled = classrooms.filter(c => c.students.some(s => s.id === studentId));

  const totalPublishedRecs = enrolled.reduce((s, c) => s + c.recordings.filter(r => r.isPublished).length, 0);
  const totalWatchedRecs = enrolled.reduce((s, c) =>
    s + c.recordings.filter(r => r.isPublished && r.viewStats.some(v => v.studentId === studentId && v.watchedPercent > 0)).length, 0);

  const totalWatchedSeconds = enrolled.reduce((s, c) =>
    s + c.recordings.reduce((ss, r) => {
      const vs = r.viewStats.find(v => v.studentId === studentId);
      return ss + (vs?.totalWatchedSec || 0);
    }, 0), 0);

  const totalLiveAttended = enrolled.reduce((s, c) => s + c.meetings.filter(m => Array.isArray(m.attendees) && m.attendees.some((a: any) => String(a?.student?._id || a?.student || a) === studentId)).length, 0);
  const totalMeetings = enrolled.reduce((s, c) => s + c.meetings.length, 0);

  const avgWatchPct = totalPublishedRecs > 0
    ? Math.round(enrolled.reduce((s, c) => s + c.recordings.filter(r => r.isPublished).reduce((ss, r) => {
      const vs = r.viewStats.find(v => v.studentId === studentId);
      return ss + (vs?.watchedPercent || 0);
    }, 0), 0) / totalPublishedRecs)
    : 0;

  const handleClassroomStatusChange = async (classroomId: string, status: string) => {
    if (status === "removed") {
      if (!confirm("Are you sure you want to remove this student from the classroom?")) {
        return;
      }
      try {
        await removeStudentFromClassroom(classroomId, studentId);
        onRefresh();
        toast.success("Student removed from classroom.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove student from classroom");
      }
      return;
    }

    try {
      await updateClassroomStudentStatus(classroomId, studentId, status);
      onRefresh();
      toast.success("Student classroom status updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update status");
    }
  };

  return (
    <div className="bg-cream/5 rounded-xl p-4 mt-2 space-y-4">
      {/* Activity Summary */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { l: "Classrooms", v: enrolled.length },
          { l: "Videos Watched", v: `${totalWatchedRecs}/${totalPublishedRecs}` },
          { l: "Time Watched", v: `${(totalWatchedSeconds / 3600).toFixed(1)}h` },
          { l: "Live Classes", v: `${totalLiveAttended}/${totalMeetings}` },
          { l: "Avg Watch %", v: `${avgWatchPct}%` },
        ].map(s => (
          <div key={s.l} className="bg-cream/5 rounded-lg p-2 text-center">
            <div className="font-display font-bold text-cream text-sm">{s.v}</div>
            <div className="text-[9px] text-cream/50 uppercase tracking-wider mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Per-classroom breakdown */}
      {enrolled.map(c => {
        const me = c.students.find(s => s.id === studentId)!;
        const pubRecs = c.recordings.filter(r => r.isPublished);
        const watchedRecs = pubRecs.filter(r => r.viewStats.some(v => v.studentId === studentId && v.watchedPercent > 0));
        const quizAttempts = c.quizzes.flatMap(q => q.attempts.filter(a => a.studentId === studentId));
        const liveAttended = c.meetings.filter(m => Array.isArray(m.attendees) && m.attendees.some((a: any) => String(a?.student?._id || a?.student || a) === studentId)).length;
        return (
          <div key={c.id} className="border border-cream/10 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-cream font-semibold text-sm">{c.name}</div>
                <div className="text-cream/50 text-[10px]">{c.program}</div>
              </div>
              <select value={me.status} onChange={e => handleClassroomStatusChange(c.id, e.target.value)}
                className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded border border-cream/10 bg-[#1A0F33] text-cream outline-none`}>
                <option value="active">Active</option>
                <option value="held">Hold</option>
                <option value="at risk">At Risk</option>
                <option value="placed">Placed</option>
                <option value="removed">Remove</option>
              </select>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-cream/60">
                <div className="text-cream/40 text-[10px] uppercase tracking-widest mb-0.5">Progress</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-cream/10 rounded-full overflow-hidden">
                    <div className="h-full bg-lime rounded-full" style={{ width: `${me.progress}%` }} />
                  </div>
                  <span className="font-mono">{me.progress}%</span>
                </div>
              </div>
              <div className="text-cream/60">
                <div className="text-cream/40 text-[10px] uppercase tracking-widest mb-0.5">Videos</div>
                <span className="flex items-center gap-1"><Video className="h-3 w-3 text-lime" />{watchedRecs.length}/{pubRecs.length}</span>
              </div>
              <div className="text-cream/60">
                <div className="text-cream/40 text-[10px] uppercase tracking-widest mb-0.5">Live Classes</div>
                <span className="flex items-center gap-1 font-mono text-lime">{liveAttended}/{c.meetings.length}</span>
              </div>
              <div className="text-cream/60">
                <div className="text-cream/40 text-[10px] uppercase tracking-widest mb-0.5">Quiz Attempts</div>
                <span className="flex items-center gap-1"><ClipboardList className="h-3 w-3 text-lime" />{quizAttempts.length}</span>
              </div>
            </div>
            {pubRecs.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10px] uppercase tracking-widest text-cream/40">Recording Progress</div>
                {pubRecs.map(r => {
                  const vs = r.viewStats.find(v => v.studentId === studentId);
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="text-[11px] text-cream/60 flex-1 truncate">{r.title}</span>
                      <div className="w-20 h-1.5 bg-cream/10 rounded-full overflow-hidden">
                        <div className="h-full bg-lime rounded-full" style={{ width: `${vs?.watchedPercent || 0}%` }} />
                      </div>
                      <span className="text-[11px] font-mono text-cream/50 w-8">{vs?.watchedPercent || 0}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminStudents() {
  const { classrooms, courses, users, currentUser } = useClassroomStore();
  const [backendError, setBackendError] = useState<string | null>(null);
  const [mongoStudents, setMongoStudents] = useState<Array<{ id: string; name: string; email: string; phone?: string; isActive?: boolean }>>([]);
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", selectedClassroom: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [msgStudent, setMsgStudent] = useState<{ id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshData = async () => {
    try {
      const [data, students] = await Promise.all([
        apiGetClassrooms(),
        getAdminUsers("student"),
      ]);
      classroomActions.setClassrooms(data);
      setMongoStudents(students);
      setBackendError(null);
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : "Could not load students");
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to delete student "${studentName}" entirely from the database? This will remove all their enrollments and cannot be undone.`)) {
      return;
    }
    try {
      await deleteAdminUser(studentId);
      await refreshData();
      toast.success("Student deleted from database entirely.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete student");
    }
  };
  const getStudentOverallStatus = (courses: Array<{ status: string }>) => {
    const statuses = courses.map(c => c.status);
    if (statuses.includes("at risk")) return "at risk";
    if (statuses.includes("active")) return "active";
    if (statuses.includes("held")) return "held";
    if (statuses.includes("placed")) return "placed";
    if (statuses.includes("removed")) return "removed";
    return "active";
  };

  const enrollments = useMemo(() => {
    const classroomEnrollments = classrooms.flatMap(c =>
      c.students.map(s => {
        const watchedRecs = c.recordings.filter(r => r.isPublished && r.viewStats.some(v => v.studentId === s.id && v.watchedPercent > 0)).length;
        const watchedHours = c.recordings.reduce((sum, r) => {
          const vs = r.viewStats.find(v => v.studentId === s.id);
          return sum + (vs?.totalWatchedSec || 0);
        }, 0) / 3600;

        const liveAttended = c.meetings.filter(m => Array.isArray(m.attendees) && m.attendees.some((a: any) => String(a?.student?._id || a?.student || a) === s.id)).length;

        const quizAttempts = c.quizzes.flatMap(q => q.attempts.filter(a => a.studentId === s.id));
        const quizAvg = quizAttempts.length > 0
          ? Math.round(quizAttempts.reduce((sum, a) => sum + (a.score?.percentage || 0), 0) / quizAttempts.length)
          : 0;

        return {
          ...s,
          course: c.program,
          batch: c.name.split("—")[1]?.trim() || "N/A",
          classroomId: c.id,
          classroomName: c.name,
          totalPubRecs: c.recordings.filter(r => r.isPublished).length,
          watchedRecs,
          watchedHours,
          liveAttended,
          quizAvg
        };
      })
    );

    const studentMap: Record<string, {
      id: string;
      name: string;
      email: string;
      enrollmentId: string;
      addedAt: string;
      status: string;
      totalWatchedHours: number;
      totalLiveAttended: number;
      courses: Array<{
        course: string;
        batch: string;
        classroomId: string;
        classroomName: string;
        progress: number;
        attendance: number;
        quizAvg: number;
        status: string;
        totalPubRecs: number;
        watchedRecs: number;
        watchedHours: number;
        liveAttended: number;
        enrollmentId: string;
      }>;
    }> = {};

    classroomEnrollments.forEach(item => {
      if (!studentMap[item.id]) {
        studentMap[item.id] = {
          id: item.id,
          name: item.name,
          email: item.email,
          enrollmentId: item.enrollmentId,
          addedAt: item.addedAt,
          status: "active",
          totalWatchedHours: 0,
          totalLiveAttended: 0,
          courses: []
        };
      }
      studentMap[item.id].totalWatchedHours += item.watchedHours;
      studentMap[item.id].totalLiveAttended += item.liveAttended;
      studentMap[item.id].courses.push({
        course: item.course,
        batch: item.batch,
        classroomId: item.classroomId,
        classroomName: item.classroomName,
        progress: item.progress,
        attendance: item.attendance,
        quizAvg: item.quizAvg,
        status: item.status,
        totalPubRecs: item.totalPubRecs,
        watchedRecs: item.watchedRecs,
        watchedHours: item.watchedHours,
        liveAttended: item.liveAttended,
        enrollmentId: item.enrollmentId,
      });
    });

    const enrolledStudents = Object.values(studentMap).map(s => ({
      ...s,
      status: getStudentOverallStatus(s.courses),
    }));

    const enrolledIds = new Set(enrolledStudents.map((student) => student.id));
    const unenrolledStudents = mongoStudents
      .filter((student) => !enrolledIds.has(student.id))
      .map((student) => ({
        id: student.id,
        name: student.name,
        email: student.email,
        enrollmentId: "",
        addedAt: "",
        status: student.isActive === false ? "removed" : "active",
        totalWatchedHours: 0,
        totalLiveAttended: 0,
        courses: [{
          course: "Not enrolled",
          batch: "N/A",
          classroomId: "none",
          classroomName: "Not enrolled",
          progress: 0,
          attendance: 0,
          quizAvg: 0,
          status: student.isActive === false ? "removed" : "active",
          totalPubRecs: 0,
          watchedRecs: 0,
          watchedHours: 0,
          liveAttended: 0,
          enrollmentId: "",
        }]
      }));

    if (currentUser?.role === "faculty") {
      return enrolledStudents;
    }
    return [...enrolledStudents, ...unenrolledStudents];
  }, [classrooms, mongoStudents, currentUser]);

  const filtered = enrollments.filter(e => {
    if (courseFilter !== "All" && !e.courses.some(c => c.course === courseFilter)) return false;
    if (statusFilter !== "All" && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchEnrollmentId = e.enrollmentId.toLowerCase().includes(q) || e.courses.some(c => c.enrollmentId?.toLowerCase().includes(q));
      if (!e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q) && !matchEnrollmentId) return false;
    }
    return true;
  });

  const total = enrollments.length;
  const active = enrollments.filter(e => e.status === "active").length;
  const placed = enrollments.filter(e => e.status === "placed").length;
  const atRisk = enrollments.filter(e => e.status === "at risk").length;
  const programOptions = Array.from(new Set(enrollments.flatMap((e) => e.courses.map(c => c.course)).filter(Boolean)));

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await createAdminUser({
        fullName: form.name,
        email: form.email,
        role: "student",
        password: form.password || "1111"
      });

      if (form.selectedClassroom && res.user?.id) {
        await addStudentsToClassroom(form.selectedClassroom, [res.user.id]);
      }

      // Refresh data
      const [data, students] = await Promise.all([
        apiGetClassrooms(),
        getAdminUsers("student"),
      ]);
      classroomActions.setClassrooms(data);
      setMongoStudents(students);

      setShowAdd(false);
      setForm({ name: "", email: "", password: "", selectedClassroom: "" });
      setBackendError(null);
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : "Could not create student");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const csv = ["Name,Email,Courses,Batches,Progress,Attendance,Live Attendance,Quiz Avg,Status,Watch Progress,Watch Time (h)",
      ...filtered.map(e => {
        const name = `"${e.name.replace(/"/g, '""')}"`;
        const email = `"${e.email.replace(/"/g, '""')}"`;
        const coursesStr = `"${e.courses.map(c => c.course).join("; ").replace(/"/g, '""')}"`;
        const batchesStr = `"${e.courses.map(c => c.batch).join("; ").replace(/"/g, '""')}"`;
        const progressStr = `"${e.courses.map(c => `${c.progress}%`).join("; ")}"`;
        const attendanceStr = `"${e.courses.map(c => `${c.attendance}%`).join("; ")}"`;
        const liveAttStr = `"${e.courses.map(c => `${c.liveAttended} classes`).join("; ")}"`;
        const quizAvgStr = `"${e.courses.map(c => `${c.quizAvg}%`).join("; ")}"`;
        const statusStr = `"${e.status}"`;
        const watchProgressStr = `"${e.courses.map(c => `${c.watchedRecs}/${c.totalPubRecs}`).join("; ")}"`;
        const watchTimeStr = `"${e.courses.map(c => `${c.watchedHours.toFixed(1)}h`).join("; ")}"`;
        return `${name},${email},${coursesStr},${batchesStr},${progressStr},${attendanceStr},${liveAttStr},${quizAvgStr},${statusStr},${watchProgressStr},${watchTimeStr}`;
      })
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "students.csv"; a.click();
  };

  return (
    <div className="space-y-6 text-cream">
      {msgStudent && <SendMessageModal studentId={msgStudent.id} studentName={msgStudent.name} onClose={() => setMsgStudent(null)} />}

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Students</h1>
          <p className="text-cream/60 text-sm mt-1">{total} total enrollments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-full bg-cream/10 text-cream px-4 py-2 text-sm font-semibold"><Download className="h-4 w-4" /> Export CSV</button>
          {(currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold"><Plus className="h-4 w-4" /> Add Student</button>
          )}
        </div>
      </div>

      {backendError && <p className="text-sm text-red-400">{backendError}</p>}

      {showAdd && (currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
        <DarkCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-cream">Register New Student</h3>
            <button onClick={() => setShowAdd(false)} className="text-cream/50 hover:text-cream"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Full Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Student name"
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="student@example.com"
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Initial Password</label>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="********"
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Enroll in Classroom</label>
                <select value={form.selectedClassroom} onChange={e => setForm({ ...form, selectedClassroom: e.target.value })}
                  className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50">
                  <option value="">None (Just register)</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowAdd(false)} disabled={isSubmitting} className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-75">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Registering..." : "Register & Enroll"}
              </button>
            </div>
          </form>
        </DarkCard>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[{ l: "Total", v: total }, { l: "Active", v: active }, { l: "Placed", v: placed }, { l: "At Risk", v: atRisk, warn: true }].map(s => (
          <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-4">
            <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.l}</div>
            <div className={`font-display text-2xl font-bold mt-1 ${s.warn && s.v > 0 ? "text-red-400" : "text-cream"}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <DarkCard className="p-0 overflow-hidden">
        <div className="p-4 border-b border-cream/10 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-cream/5 rounded-full px-3 py-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-cream/50" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, ID, email…" className="bg-transparent outline-none text-sm flex-1 text-cream placeholder:text-cream/40" />
          </div>
          <select value={courseFilter} onChange={e => setCourseFilter(e.target.value)} className="bg-[#1A0F45] rounded-full px-4 py-2 text-sm outline-none text-cream focus:border-lime/50 border border-cream/10">
            <option value="All">All programs</option>
            {(programOptions.length > 0 ? programOptions : courses.map((c) => c.title)).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-[#1A0F45] rounded-full px-4 py-2 text-sm outline-none text-cream focus:border-lime/50 border border-cream/10">
            <option value="All">All statuses</option>
            {["active", "held", "at risk", "placed", "removed"].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream/5">
              <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                <th className="p-4">Student</th>
                <th>Program / Batch</th>
                <th>Progress</th>
                <th>Videos</th>
                <th>Watch Time</th>
                <th>Live Classes</th>
                <th>Quiz Avg</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-cream/50">No students found.</td></tr>}
              {filtered.map(s => (
                <React.Fragment key={s.id}>
                  <tr className={`border-t border-cream/10 hover:bg-cream/5 cursor-pointer ${expandedId === s.id ? "bg-cream/5" : ""}`}
                    onClick={() => setExpandedId(prev => prev === s.id ? null : s.id)}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-lime text-plum-dark text-xs font-bold">{s.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</div>
                        <div>
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-[11px] text-cream/60 font-mono">
                            {Array.from(new Set(s.courses.map(c => c.enrollmentId).filter(Boolean))).join(" / ") || " "}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col justify-center gap-1.5 py-1">
                        {s.courses.map((c, idx) => (
                          <div key={c.classroomId || idx} className="h-10 flex flex-col justify-center">
                            <div className="text-cream/80 text-xs font-medium truncate max-w-[200px]">{c.course}</div>
                            <div className="text-cream/50 text-[10px] truncate max-w-[200px]">{c.batch}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col justify-center gap-1.5 py-1">
                        {s.courses.map((c, idx) => (
                          <div key={c.classroomId || idx} className="h-10 flex items-center">
                            <div className="flex items-center gap-2 w-28">
                              <div className="flex-1 h-1.5 bg-cream/10 rounded-full overflow-hidden">
                                <div className="h-full bg-lime" style={{ width: `${c.progress}%` }} />
                              </div>
                              <span className="text-[11px] font-mono">{c.progress}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col justify-center gap-1.5 py-1">
                        {s.courses.map((c, idx) => (
                          <div key={c.classroomId || idx} className="h-10 flex items-center">
                            <span className="flex items-center gap-1.5 text-xs">
                              <Video className="h-3 w-3 text-lime" />
                              <span className="font-mono">{c.watchedRecs}/{c.totalPubRecs}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col justify-center gap-1.5 py-1">
                        {s.courses.map((c, idx) => (
                          <div key={c.classroomId || idx} className="h-10 flex items-center text-xs font-mono">
                            {c.watchedHours.toFixed(1)}h
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col justify-center gap-1.5 py-1">
                        {s.courses.map((c, idx) => (
                          <div key={c.classroomId || idx} className="h-10 flex items-center text-xs font-mono">
                            {c.liveAttended} classes
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col justify-center gap-1.5 py-1">
                        {s.courses.map((c, idx) => (
                          <div key={c.classroomId || idx} className="h-10 flex items-center font-mono text-xs">
                            {c.quizAvg}%
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col justify-center gap-1.5 py-1">
                        {s.courses.map((c, idx) => (
                          <div key={c.classroomId || idx} className="h-10 flex items-center">
                            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded capitalize ${statusStyle[c.status] || "bg-cream/10 text-cream/60"}`}>{c.status}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="pr-4">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {(currentUser?.role === "admin" || currentUser?.role === "superadmin") && (
                          <button onClick={() => handleDeleteStudent(s.id, s.name)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream/10 text-red-400 hover:text-red-300" title="Delete Student Entirely">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => setMsgStudent({ id: s.id, name: s.name })} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream/10" title="Send message">
                          <Mail className="h-4 w-4" />
                        </button>
                        <button className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream/10" onClick={() => setExpandedId(prev => prev === s.id ? null : s.id)}>
                          {expandedId === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr className="border-t border-cream/10">
                      <td colSpan={9} className="px-4 pb-4">
                        <StudentDetail studentId={s.id} onRefresh={refreshData} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </DarkCard>
    </div>
  );
}
