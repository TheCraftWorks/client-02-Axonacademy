import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState, useMemo } from "react";
import { School, Search, Users, ClipboardList, Eye, Loader2 } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { getClassrooms } from "@/lib/api";
import { useClassroomStore, classroomActions } from "@/lib/classroomStore";

export const Route = createFileRoute("/_admin/admin/classes/")({
  component: AdminClasses,
});

function AdminClasses() {
  const { classrooms } = useClassroomStore();
  const [loading, setLoading] = useState(classrooms.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchList = async () => {
    try {
      const data = await getClassrooms();
      classroomActions.setClassrooms(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = useMemo(() => {
    return classrooms.filter((c) => {
      const q = search.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    });
  }, [classrooms, search]);

  return (
    <div className="space-y-6 text-cream">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <School className="h-8 w-8 text-lime" /> Classes
          </h1>
          <p className="text-cream/60 text-sm mt-1">
            Manage class details, enrollment, and attendance records
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-cream/60">
          <Loader2 className="h-4 w-4 animate-spin text-lime" />
          Loading class configurations…
        </div>
      ) : error ? (
        <p className="text-sm text-red-400">Error loading classes: {error}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-cream/5 rounded-full px-4 py-2 flex-1 min-w-50 max-w-xs border border-cream/10">
              <Search className="h-4 w-4 text-cream/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search classes…"
                className="bg-transparent outline-none text-sm flex-1 text-cream placeholder:text-cream/40"
              />
            </div>
          </div>

          <DarkCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream/5">
                  <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                    <th className="p-4">Class Name</th>
                    <th>Total Students</th>
                    <th className="pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-cream/50">
                        No classes found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((c) => {
                      const totalStudents = c.students.filter((s) => s.status === "active").length;
                      return (
                        <tr key={c.id} className="border-t border-cream/10 hover:bg-cream/5">
                          <td className="p-4">
                            <div>
                              <div className="font-semibold text-cream">{c.name}</div>
                              <div className="text-[10px] text-cream/50 font-mono">{c.code}</div>
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 font-mono text-lime font-bold">
                              <Users className="h-3.5 w-3.5" />
                              {totalStudents}
                            </div>
                          </td>
                          <td className="pr-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to="/admin/classes/$classId/students"
                                params={{ classId: c.id }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-cream/10 hover:bg-cream/15 text-cream text-xs font-semibold"
                              >
                                <Eye className="h-3.5 w-3.5" /> View Students
                              </Link>
                              <Link
                                to="/admin/classes/$classId/attendance"
                                params={{ classId: c.id }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-lime hover:opacity-90 text-plum-dark text-xs font-bold"
                              >
                                <ClipboardList className="h-3.5 w-3.5" /> Attendance
                              </Link>
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
        </>
      )}
    </div>
  );
}
