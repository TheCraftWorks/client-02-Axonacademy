import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import { Users, Search, ChevronLeft, ArrowUpRight, X, Calendar, BookOpen, BarChart3, Clock, Loader2 } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { getClassStudents, getStudentAttendanceDetails } from "@/lib/api";

export const Route = createFileRoute("/_admin/admin/classes/$classId/students")({
  component: ClassStudents,
});

interface AttendanceDetailsModalProps {
  studentId: string;
  studentName: string;
  onClose: () => void;
}

interface OverallStats {
  total: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
}

interface MonthlyStat {
  year: number;
  month: number;
  total: number;
  present: number;
  late: number;
  percentage: number;
}

interface SubjectStat {
  subject: string;
  total: number;
  present: number;
  late: number;
  percentage: number;
}

interface TimelineEvent {
  _id: string;
  date: string;
  subject: string;
  status: string;
  classroom?: {
    name: string;
    code: string;
  };
}

function StudentAttendanceDetailsModal({ studentId, studentName, onClose }: AttendanceDetailsModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    overall: OverallStats;
    monthly: MonthlyStat[];
    subjectWise: SubjectStat[];
    timeline: TimelineEvent[];
  } | null>(null);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  useEffect(() => {
    let active = true;
    getStudentAttendanceDetails(studentId)
      .then((res) => {
        if (!active) return;
        setData(res);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load student statistics");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [studentId]);

  const overallPercentage = useMemo(() => {
    if (!data || data.overall.total === 0) return 0;
    // (Present + Late) / Total
    const attended = data.overall.present + data.overall.late;
    return Math.round((attended / data.overall.total) * 100);
  }, [data]);

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "present":
        return "bg-lime/20 text-lime border-lime/30";
      case "absent":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "late":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      case "leave":
      case "excused":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default:
        return "bg-cream/10 text-cream/70 border-cream/20";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <DarkCard className="w-full max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-lime font-bold">Student Portfolio</span>
            <h2 className="font-display text-xl font-bold text-cream mt-0.5">{studentName}</h2>
          </div>
          <button onClick={onClose} className="text-cream/50 hover:text-cream p-1.5 rounded-full hover:bg-white/5 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-lime mb-3" />
            <p className="text-sm text-cream/50">Assembling attendance metrics…</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 flex-1">{error}</div>
        ) : !data ? (
          <div className="p-8 text-center text-cream/50 flex-1">No data available.</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Stats Dashboard Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Circular Progress & Overall Stat */}
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col items-center justify-center text-center">
                <h3 className="text-xs uppercase tracking-widest text-cream/50 mb-4 font-bold flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-lime" /> Overall Attendance
                </h3>
                
                {/* Circular Indicator */}
                <div className="relative flex items-center justify-center h-32 w-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="54" className="stroke-white/10" strokeWidth="8" fill="transparent" />
                    <circle 
                      cx="64" 
                      cy="64" 
                      r="54" 
                      className="stroke-lime transition-all duration-500 ease-out" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray={2 * Math.PI * 54}
                      strokeDashoffset={2 * Math.PI * 54 * (1 - overallPercentage / 100)}
                    />
                  </svg>
                  <div className="absolute text-2xl font-bold font-display text-cream font-mono">{overallPercentage}%</div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full text-xs border-t border-white/5 pt-4">
                  <div>
                    <span className="text-cream/50 block">Classes Taken</span>
                    <span className="font-bold text-cream text-base">{data.overall.total}</span>
                  </div>
                  <div>
                    <span className="text-cream/50 block">Present Count</span>
                    <span className="font-bold text-lime text-base">{data.overall.present}</span>
                  </div>
                </div>
              </div>

              {/* Monthly Attendance */}
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col">
                <h3 className="text-xs uppercase tracking-widest text-cream/50 mb-3 font-bold flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-lime" /> Monthly Breakdown
                </h3>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[180px] pr-1">
                  {data.monthly.length === 0 ? (
                    <p className="text-xs text-cream/40 text-center py-6">No monthly records.</p>
                  ) : (
                    data.monthly.map((m, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-cream font-medium">{monthNames[m.month - 1]} {m.year}</span>
                          <span className="font-mono font-bold text-cream/90">{m.percentage}% ({m.present + m.late}/{m.total})</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-lime" style={{ width: `${m.percentage}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Subject Wise Attendance */}
              <div className="bg-white/5 rounded-2xl p-5 border border-white/5 flex flex-col">
                <h3 className="text-xs uppercase tracking-widest text-cream/50 mb-3 font-bold flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-lime" /> Subject Breakdown
                </h3>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[180px] pr-1">
                  {data.subjectWise.length === 0 ? (
                    <p className="text-xs text-cream/40 text-center py-6">No subject records.</p>
                  ) : (
                    data.subjectWise.map((s, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-cream font-medium truncate max-w-[140px]">{s.subject}</span>
                          <span className="font-mono font-bold text-cream/90">{s.percentage}% ({s.present + s.late}/{s.total})</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-lime" style={{ width: `${s.percentage}%` }} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Timeline */}
            <div className="bg-white/5 rounded-2xl p-5 border border-white/5">
              <h3 className="text-xs uppercase tracking-widest text-cream/50 mb-4 font-bold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-lime" /> Attendance History Timeline
              </h3>

              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-xs text-left">
                  <thead className="bg-white/5 text-cream/60 text-[9px] uppercase tracking-widest">
                    <tr>
                      <th className="p-3">Date</th>
                      <th>Classroom</th>
                      <th>Subject</th>
                      <th className="pr-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.timeline.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-cream/40">
                          No history timeline recorded.
                        </td>
                      </tr>
                    ) : (
                      data.timeline.map((event) => (
                        <tr key={event._id} className="border-t border-white/5 hover:bg-white/5">
                          <td className="p-3 text-cream/80 font-mono">
                            {new Date(event.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'UTC'
                            })}
                          </td>
                          <td className="text-cream/75 max-w-[200px] truncate">
                            {event.classroom?.name || "N/A"}
                          </td>
                          <td className="text-cream/80 font-medium">
                            {event.subject || "General"}
                          </td>
                          <td className="pr-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(event.status)}`}>
                              {event.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
          <button onClick={onClose} className="rounded-full bg-cream/10 text-cream px-6 py-2 text-xs font-semibold hover:bg-cream/15 transition-colors">
            Close
          </button>
        </div>
      </DarkCard>
    </div>
  );
}

function ClassStudents() {
  const { classId } = Route.useParams();
  const [students, setStudents] = useState<Array<{
    studentId: string;
    rollNumber: string;
    name: string;
    email: string;
    phone: string;
    status: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  // Modal tracking
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);

  const fetchRoster = async () => {
    try {
      const res = await getClassStudents(classId);
      setStudents(res.students || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [classId]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        s.name.toLowerCase().includes(q) ||
        s.rollNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [students, search, statusFilter]);

  const statusStyle: Record<string, string> = {
    active: "bg-lime/20 text-lime border-lime/30",
    removed: "bg-red-500/20 text-red-300 border-red-500/30",
    held: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  };

  return (
    <div className="space-y-6 text-cream">
      {selectedStudent && (
        <StudentAttendanceDetailsModal
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          onClose={() => setSelectedStudent(null)}
        />
      )}

      <div className="flex items-center gap-3">
        <Link
          to="/admin/classes"
          className="p-2 rounded-full hover:bg-cream/10 text-cream/70 hover:text-cream transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-lime" /> Class Students
          </h1>
          <p className="text-cream/60 text-sm mt-1">
            Roster roster of students enrolled in this class
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-cream/60">
          <Loader2 className="h-4 w-4 animate-spin text-lime" />
          Loading class roster…
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">Error: {error}</p>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-cream/5 rounded-full px-4 py-2 flex-1 min-w-50 max-w-xs border border-cream/10">
              <Search className="h-4 w-4 text-cream/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, roll no, email…"
                className="bg-transparent outline-none text-sm flex-1 text-cream placeholder:text-cream/40"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#1A0F45] rounded-full px-4 py-2 text-sm outline-none text-cream focus:border-lime/50 border border-cream/10"
            >
              <option value="All">All Statuses</option>
              <option value="active">Active</option>
              <option value="held">Hold</option>
              <option value="removed">Removed</option>
            </select>
          </div>

          <DarkCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/5">
                  <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                    <th className="p-4">Roll Number</th>
                    <th>Student Name</th>
                    <th>Email Address</th>
                    <th>Phone Number</th>
                    <th>Status</th>
                    <th className="pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-cream/50">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.studentId} className="border-t border-cream/10 hover:bg-cream/5">
                        <td className="p-4 font-mono font-semibold text-lime text-xs">
                          {s.rollNumber}
                        </td>
                        <td>
                          <button
                            onClick={() => setSelectedStudent({ id: s.studentId, name: s.name })}
                            className="text-cream font-semibold hover:text-lime text-left focus:outline-none transition-colors flex items-center gap-1 group"
                          >
                            {s.name}
                            <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                        <td className="text-cream/80">{s.email}</td>
                        <td className="text-cream/80 font-mono text-xs">{s.phone || "—"}</td>
                        <td>
                          <span className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border capitalize ${statusStyle[s.status] || "bg-cream/10 text-cream/60 border-cream/20"}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="pr-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedStudent({ id: s.studentId, name: s.name })}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-cream/10 hover:bg-cream/15 text-cream text-xs font-semibold rounded-full"
                          >
                            Attendance Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DarkCard>
        </>
      )}
    </div>
  );
}
