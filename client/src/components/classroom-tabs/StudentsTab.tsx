import React, { useState, useMemo } from "react";
import { LuUsers, LuPlus, LuX, LuSearch } from "react-icons/lu";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import type { Classroom } from "@/lib/classroomStore";
import {
  addStudentsToClassroom, getAdminUsers,
  updateClassroomStudentStatus, removeStudentFromClassroom
} from "@/lib/api";
import { toast } from "sonner";
import { DarkTabSkeletonLoader } from "./shared";

function StudentsTab({ classroom, refreshClassroom, isFetching }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom>; isFetching?: boolean }) {
  const { users, currentUser } = useClassroomStore();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const cls = classroom;
  const [showAdd, setShowAdd] = useState(false);
  const [mongoStudents, setMongoStudents] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [addSearchQuery, setAddSearchQuery] = useState("");

  React.useEffect(() => {
    let active = true;
    const loadStudents = async () => {
      try {
        const students = await getAdminUsers("student");
        if (!active) return;
        setMongoStudents(students);
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Could not load students");
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
      setAddSearchQuery("");
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

  const enrolledStudents = (cls.students || []).map((s) => {
    const mongoUser = mongoStudents.find((m) => m.id === s.id);
    const displayName = (s.name && s.name !== 'Student') ? s.name : (mongoUser?.name || s.name || 'Student');
    const displayEmail = s.email || mongoUser?.email || '';
    return {
      ...s,
      name: displayName,
      email: displayEmail,
    };
  });

  const filteredEnrolledStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrolledStudents.filter((s) => {
      const matchesSearch = !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.id && s.id.toLowerCase().includes(q)) ||
        (s.enrollmentId && s.enrollmentId.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "All" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [enrolledStudents, searchQuery, statusFilter]);

  const studentsOnly = mongoStudents.length > 0 ? mongoStudents : users.filter((u) => u.role === "student");
  const notEnrolled = studentsOnly.filter((s) => !enrolledStudents.find((cs) => cs.id === s.id));

  const filteredNotEnrolled = useMemo(() => {
    const q = addSearchQuery.trim().toLowerCase();
    if (!q) return notEnrolled;
    return notEnrolled.filter((s) =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q))
    );
  }, [notEnrolled, addSearchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search & Status Filter for Enrolled Students */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 bg-[#1A0F33] border border-cream/10 rounded-full px-3.5 py-2 flex-1 max-w-sm focus-within:border-lime/50 transition-colors">
            <LuSearch className="h-4 w-4 text-cream/40 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students in classroom (name, email)..."
              className="bg-transparent text-cream text-xs placeholder:text-cream/40 outline-none flex-1"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-cream/40 hover:text-cream" title="Clear search">
                <LuX className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#1A0F33] border border-cream/10 rounded-full px-4 py-2 text-xs text-cream/80 outline-none focus:border-lime/50 cursor-pointer"
          >
            <option value="All">All ({enrolledStudents.length})</option>
            <option value="active">Active ({enrolledStudents.filter((s) => s.status === "active").length})</option>
            <option value="held">Hold ({enrolledStudents.filter((s) => s.status === "held").length})</option>
            <option value="removed">Removed ({enrolledStudents.filter((s) => s.status === "removed").length})</option>
          </select>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setShowAdd(!showAdd);
              setAddSearchQuery("");
            }}
            className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold hover:bg-lime/90 transition-colors shrink-0 shadow-sm"
          >
            {showAdd ? <LuX className="h-4 w-4" /> : <LuPlus className="h-4 w-4" />}
            {showAdd ? "Close" : "Add Student"}
          </button>
        )}
      </div>

      {/* Add Students Panel */}
      {isAdmin && showAdd && (
        <DarkCard className="animate-in fade-in duration-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="font-display font-bold text-cream text-sm">Add Students to Classroom</h3>
              <p className="text-cream/50 text-xs mt-0.5">Select from students registered in the system to enroll them into this class</p>
            </div>
            <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-cream/10 text-cream/70">
              {filteredNotEnrolled.length} available
            </span>
          </div>

          {/* Search bar inside Add Student */}
          <div className="mb-3">
            <div className="flex items-center gap-2 bg-[#1A0F33] border border-cream/10 rounded-xl px-3.5 py-2 focus-within:border-lime/50 transition-colors">
              <LuSearch className="h-4 w-4 text-cream/40 shrink-0" />
              <input
                type="text"
                value={addSearchQuery}
                onChange={(e) => setAddSearchQuery(e.target.value)}
                placeholder="Search students to add by name, email, or IDâ€¦"
                className="bg-transparent text-cream text-xs placeholder:text-cream/40 outline-none flex-1"
              />
              {addSearchQuery && (
                <button
                  onClick={() => setAddSearchQuery("")}
                  className="text-cream/40 hover:text-cream text-xs"
                  title="Clear search"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {notEnrolled.length === 0 ? (
            <div className="text-center py-6 text-cream/40 text-xs">
              No available students to add. All students are already enrolled.
            </div>
          ) : filteredNotEnrolled.length === 0 ? (
            <div className="text-center py-6 text-cream/40 text-xs">
              No available students matching "{addSearchQuery}".
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {filteredNotEnrolled.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-cream/5 px-4 py-2.5 hover:bg-cream/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-lime/10 text-lime text-xs font-bold shrink-0">
                      {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-cream text-sm font-semibold">{s.name}</div>
                      <div className="text-cream/50 text-xs font-mono">{s.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddStudent(s.id)}
                    disabled={isAdding === s.id}
                    className="rounded-full bg-lime text-plum-dark px-4 py-1.5 text-xs font-bold hover:bg-lime/90 disabled:opacity-60 transition-colors"
                  >
                    {isAdding === s.id ? "Adding..." : "Add"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </DarkCard>
      )}

      {isFetching && enrolledStudents.length === 0 ? (
        <DarkTabSkeletonLoader type="rows" />
      ) : (
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
                {filteredEnrolledStudents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-cream/50 text-sm">
                      {searchQuery || statusFilter !== "All"
                        ? `No students found matching your search.`
                        : `No students enrolled yet.`}
                    </td>
                  </tr>
                )}
                {filteredEnrolledStudents.map((s) => (
                  <tr key={s.id} className="border-t border-cream/10 hover:bg-cream/5">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-lime text-plum-dark text-xs font-bold shrink-0">
                          {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-cream">{s.name}</div>
                          <div className="text-[11px] text-cream/60 font-mono">{s.email || s.enrollmentId}</div>
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
                        className="bg-[#1A0F33] border border-cream/10 rounded-lg px-2 py-1 text-cream/70 text-xs outline-none cursor-pointer">
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
      )}
    </div>
  );
}

// â”€â”€â”€ Join Requests Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export { StudentsTab };
