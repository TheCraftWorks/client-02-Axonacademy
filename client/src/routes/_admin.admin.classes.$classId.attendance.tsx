import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ClipboardList, Calendar, BookOpen, Save, CheckSquare, Loader2, AlertCircle, Video } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { getClassStudents, getClassAttendance, saveAttendance, getClassAttendanceReport, getClassroomMeetings } from "@/lib/api";

export const Route = createFileRoute("/_admin/admin/classes/$classId/attendance")({
  component: ClassAttendance,
});

interface StudentRoster {
  studentId: string;
  rollNumber: string;
  name: string;
  email: string;
  status: string;
}

interface AttendanceRecord {
  studentId: string;
  status: "present" | "absent" | "late" | "leave";
}

interface HistoryReport {
  date: string;
  subject: string;
  meetingId?: string;
  meetingTitle?: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  attendancePercentage: number;
}

interface Meeting {
  id: string;
  title: string;
  scheduledAt: string;
}

function ClassAttendance() {
  const { classId } = Route.useParams();
  const [activeTab, setActiveTab] = useState<"mark" | "history">("mark");

  // Roster of students in this class
  const [roster, setRoster] = useState<StudentRoster[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [errorRoster, setErrorRoster] = useState<string | null>(null);

  // Meetings for this classroom
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("");

  // Filters for Mark Attendance
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [subject, setSubject] = useState<string>("General");

  // Current attendance statuses being edited/marked
  const [markedRecords, setMarkedRecords] = useState<Record<string, "present" | "absent" | "late" | "leave">>({});
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error" | null; msg: string }>({ type: null, msg: "" });

  // History Tab Data
  const [historyList, setHistoryList] = useState<HistoryReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [errorHistory, setErrorHistory] = useState<string | null>(null);

  // Fetch student roster once on load
  const loadRoster = async () => {
    try {
      const res = await getClassStudents(classId);
      // Filter only active students for attendance marking
      const activeStudents = (res.students || []).filter((s: StudentRoster) => s.status === "active");
      setRoster(activeStudents);
      setErrorRoster(null);
    } catch (err) {
      setErrorRoster(err instanceof Error ? err.message : "Failed to load students roster");
    } finally {
      setLoadingRoster(false);
    }
  };

  const loadMeetings = async () => {
    try {
      const res = await getClassroomMeetings(classId);
      const mList = (res.meetings || []).map((m: any) => ({
        id: m._id || m.id,
        title: m.title,
        scheduledAt: m.scheduledAt
      }));
      setMeetings(mList);
    } catch (err) {
      console.error("Failed to load meetings:", err);
    }
  };

  // Fetch existing attendance records if any for the picked Date + Subject + Meeting
  const checkExistingAttendance = async () => {
    if (!date) return;
    setLoadingRecords(true);
    setSaveStatus({ type: null, msg: "" });
    try {
      const res = await getClassAttendance(classId, date, subject, selectedMeetingId);
      const records = res.attendance || [];
      
      const newMarked: Record<string, "present" | "absent" | "late" | "leave"> = {};
      
      // Seed default as "present" for everyone first
      roster.forEach((s) => {
        newMarked[s.studentId] = "present";
      });

      // Override with already saved database values if any exist
      records.forEach((rec: any) => {
        const studId = rec.student?._id || rec.student;
        if (studId) {
          newMarked[String(studId)] = rec.status as any;
        }
      });

      setMarkedRecords(newMarked);
    } catch (err) {
      console.error("Failed to load attendance records:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Fetch History Aggregation Report
  const loadHistory = async () => {
    setLoadingHistory(true);
    setErrorHistory(null);
    try {
      const res = await getClassAttendanceReport(classId);
      setHistoryList(res.report || []);
    } catch (err) {
      setErrorHistory(err instanceof Error ? err.message : "Failed to load attendance history");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadRoster();
    loadMeetings();
  }, [classId]);

  // Re-fetch records when date, subject, or roster changes
  useEffect(() => {
    if (roster.length > 0) {
      checkExistingAttendance();
    }
  }, [date, subject, selectedMeetingId, roster]);

  // Load history whenever tab changes to history
  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  const handleStatusChange = (studentId: string, status: "present" | "absent" | "late" | "leave") => {
    setMarkedRecords((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, "present" | "absent" | "late" | "leave"> = {};
    roster.forEach((s) => {
      updated[s.studentId] = "present";
    });
    setMarkedRecords(updated);
  };

  const handleSaveAttendance = async () => {
    if (!date.trim()) {
      setSaveStatus({ type: "error", msg: "Date field is required" });
      return;
    }

    setLoadingRecords(true);
    setSaveStatus({ type: null, msg: "" });

    try {
      const recordsPayload = Object.entries(markedRecords).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      await saveAttendance({
        classId,
        date,
        subject: selectedMeetingId ? undefined : subject,
        meetingId: selectedMeetingId || undefined,
        records: recordsPayload,
      });

      setSaveStatus({ type: "success", msg: "Attendance saved successfully" });
      // Refresh timeline
      setTimeout(() => setSaveStatus({ type: null, msg: "" }), 3000);
    } catch (err) {
      setSaveStatus({ type: "error", msg: err instanceof Error ? err.message : "Failed to save attendance" });
    } finally {
      setLoadingRecords(false);
    }
  };

  return (
    <div className="space-y-6 text-cream">
      {/* Title block */}
      <div className="flex items-center gap-3">
        <Link
          to="/admin/classes"
          className="p-2 rounded-full hover:bg-cream/10 text-cream/70 hover:text-cream transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-lime" /> Class Attendance
          </h1>
          <p className="text-cream/60 text-sm mt-1">
            Track, review, and register students attendance statuses
          </p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("mark")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none ${
            activeTab === "mark" ? "border-lime text-lime font-bold" : "border-transparent text-cream/60 hover:text-cream"
          }`}
        >
          Mark Attendance
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none ${
            activeTab === "history" ? "border-lime text-lime font-bold" : "border-transparent text-cream/60 hover:text-cream"
          }`}
        >
          Attendance History
        </button>
      </div>

      {loadingRoster ? (
        <div className="flex items-center gap-2 text-sm text-cream/60 py-6">
          <Loader2 className="h-4 w-4 animate-spin text-lime" />
          Loading class roster…
        </div>
      ) : errorRoster ? (
        <p className="text-sm text-red-400">Error loading class roster: {errorRoster}</p>
      ) : activeTab === "mark" ? (
        /* Mark Attendance View */
        <div className="space-y-6">
          {/* Filters card */}
          <DarkCard className="grid md:grid-cols-3 gap-4 border border-white/5 bg-white/5">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-cream/50 font-bold block mb-1">
                Attendance Date
              </label>
              <div className="flex items-center gap-2 bg-[#1A0F45] border border-white/10 rounded-xl px-4 py-2">
                <Calendar className="h-4 w-4 text-cream/50" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent outline-none text-sm text-cream flex-1 outline-none appearance-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-cream/50 font-bold block mb-1">
                Select Meeting (Optional)
              </label>
              <div className="flex items-center gap-2 bg-[#1A0F45] border border-white/10 rounded-xl px-4 py-2">
                <Video className="h-4 w-4 text-cream/50" />
                <select
                  value={selectedMeetingId}
                  onChange={(e) => setSelectedMeetingId(e.target.value)}
                  className="bg-transparent outline-none text-sm text-cream flex-1 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-plum-dark">-- No Meeting --</option>
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id} className="bg-plum-dark">
                      {m.title} ({new Date(m.scheduledAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedMeetingId && (
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/50 font-bold block mb-1">
                  Subject
                </label>
                <div className="flex items-center gap-2 bg-[#1A0F45] border border-white/10 rounded-xl px-4 py-2">
                  <BookOpen className="h-4 w-4 text-cream/50" />
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Critical Care, Anatomy"
                    className="bg-transparent outline-none text-sm text-cream flex-1"
                  />
                </div>
              </div>
            )}
          </DarkCard>

          {/* Action alerts and saving status */}
          {saveStatus.type && (
            <div className={`p-4 border rounded-2xl flex items-center gap-3 text-sm ${
              saveStatus.type === "success" 
                ? "bg-lime/10 border-lime/30 text-lime" 
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{saveStatus.msg}</span>
            </div>
          )}

          {/* Action Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-cream/60">
              Total Enrolled Students: <strong className="text-cream font-mono">{roster.length}</strong>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-cream/10 hover:bg-cream/15 text-cream text-xs font-semibold rounded-full transition-colors"
              >
                <CheckSquare className="h-3.5 w-3.5" /> Mark All Present
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={loadingRecords}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-lime hover:opacity-90 disabled:opacity-50 text-plum-dark text-xs font-bold rounded-full transition-opacity shadow-lg shadow-lime/10"
              >
                <Save className="h-3.5 w-3.5" /> Save Attendance
              </button>
            </div>
          </div>

          {/* Marking Table */}
          <DarkCard className="p-0 overflow-hidden border border-white/10 relative">
            {loadingRecords && (
              <div className="absolute inset-0 bg-[#1A0F33]/60 backdrop-blur-xs z-10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-lime" />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/5">
                  <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                    <th className="p-4">Roll Number</th>
                    <th>Student Name</th>
                    <th>Email Address</th>
                    <th className="pr-4 text-center w-64">Attendance Status</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-cream/50">
                        No active students enrolled in this classroom to mark.
                      </td>
                    </tr>
                  ) : (
                    roster.map((s) => {
                      const currentStatus = markedRecords[s.studentId] || "present";
                      return (
                        <tr key={s.studentId} className="border-t border-cream/10 hover:bg-cream/5">
                          <td className="p-4 font-mono font-semibold text-lime text-xs">
                            {s.rollNumber}
                          </td>
                          <td className="font-semibold text-cream">{s.name}</td>
                          <td className="text-cream/75">{s.email}</td>
                          <td className="pr-4 py-3 text-center">
                            <div className="inline-flex gap-1 bg-white/5 border border-white/10 rounded-full p-1">
                              {(["present", "absent", "late", "leave"] as const).map((st) => {
                                const isSelected = currentStatus === st;
                                const activeCls = {
                                  present: "bg-lime text-plum-dark font-bold",
                                  absent: "bg-red-500 text-white font-bold",
                                  late: "bg-yellow-500 text-plum-dark font-bold",
                                  leave: "bg-blue-500 text-white font-bold",
                                }[st];
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleStatusChange(s.studentId, st)}
                                    className={`px-3 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-full transition-all focus:outline-none ${
                                      isSelected ? activeCls : "text-cream/50 hover:text-cream"
                                    }`}
                                  >
                                    {st}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </DarkCard>
        </div>
      ) : (
        /* Attendance History View */
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-sm text-cream/60 py-6">
              <Loader2 className="h-4 w-4 animate-spin text-lime" />
              Loading history reports…
            </div>
          ) : errorHistory ? (
            <p className="text-sm text-red-400">Error: {errorHistory}</p>
          ) : (
            <DarkCard className="p-0 overflow-hidden border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cream/5">
                    <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                      <th className="p-4">Date</th>
                      <th>Meeting / Subject</th>
                      <th>Present Count</th>
                      <th>Absent Count</th>
                      <th>Attendance Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-cream/50">
                          No history reports recorded yet.
                        </td>
                      </tr>
                    ) : (
                      historyList.map((h, idx) => (
                        <tr key={idx} className="border-t border-cream/10 hover:bg-cream/5">
                          <td className="p-4 font-mono text-cream/80 text-xs">
                            {new Date(h.date).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                          </td>
                          <td className="font-semibold text-cream">
                            {h.meetingTitle ? (
                              <div className="flex items-center gap-2">
                                <Video className="h-3.5 w-3.5 text-lime" />
                                <span>{h.meetingTitle}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5 text-cream/40" />
                                <span>{h.subject || "General"}</span>
                              </div>
                            )}
                          </td>
                          <td className="text-lime font-bold font-mono">{h.presentCount + h.lateCount}</td>
                          <td className="text-red-400 font-bold font-mono">{h.absentCount}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-cream font-mono w-10">{h.attendancePercentage}%</span>
                              <div className="h-1.5 w-24 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-lime" style={{ width: `${h.attendancePercentage}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </DarkCard>
          )}
        </div>
      )}
    </div>
  );
}

