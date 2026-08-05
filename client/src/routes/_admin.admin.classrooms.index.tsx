import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import {
  Plus,
  School,
  Users,
  Video,
  ClipboardList,
  Archive,
  Search,
  BookOpen,
  X,
  ChevronRight,
  Loader2,
  Pencil,
  ArchiveRestore,
} from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import {
  useClassroomStore,
  classroomActions,
  type Classroom,
} from "@/lib/classroomStore";
import {
  createClassroom as apiCreateClassroom,
  getClassrooms as apiGetClassrooms,
  getAdminPrograms,
  updateClassroom as apiUpdateClassroom,
  archiveClassroom as apiArchiveClassroom,
  getAdminUsers,
  type ProgramCourse,
} from "@/lib/api";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/admin/classrooms/")({
  component: AdminClassrooms,
});


function StatusBadge({ status }: { status: Classroom["status"] }) {
  const cls =
    status === "active"
      ? "bg-lime/20 text-lime"
      : status === "archived"
      ? "bg-cream/10 text-cream/60"
      : "bg-yellow-500/20 text-yellow-300";
  return (
    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${cls}`}>
      {status}
    </span>
  );
}

function CreateClassroomModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (classroom: Classroom) => void;
}) {
  // ── Load programs & faculty from API ─────────────────────────────────────────
  const [programs, setPrograms] = useState<ProgramCourse[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);
  
  const [faculties, setFaculties] = useState<any[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>([]);

  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminPrograms()
      .then((data) => {
        if (!active) return;
        // Only show published programs in the classroom create dropdown
        const published = data.filter((p) => p.status === "published");
        setPrograms(published);
        setForm((f) => ({ ...f, program: published[0]?.id ?? "" }));
      })
      .catch((err) => {
        if (!active) return;
        setProgramsError(err.message || "Failed to load programs");
      })
      .finally(() => { if (active) setLoadingPrograms(false); });

    setLoadingFaculties(true);
    getAdminUsers("faculty")
      .then((data) => {
        if (!active) return;
        setFaculties(data);
      })
      .catch((err) => console.error("Failed to load faculty:", err))
      .finally(() => { if (active) setLoadingFaculties(false); });

    return () => { active = false; };
  }, []);

  const [form, setForm] = useState({
    name: "",
    description: "",
    code: `CLS-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    program: "",
    maxStudents: 40,
    status: "active" as Classroom["status"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || isSubmitting) return;

    setCreateError(null);
    setIsSubmitting(true);
    try {
      const created = await apiCreateClassroom({
        ...form,
        instructors: selectedFaculties,
      });
      classroomActions.addClassroom(created);
      onCreated?.(created);
      onClose();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <DarkCard className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-cream">Create Classroom</h2>
          <button onClick={onClose} className="text-cream/50 hover:text-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              {createError}
            </div>
          )}
          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Classroom Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. ICU Critical Care — Batch 24A"
              className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What will students learn in this classroom?"
              rows={3}
              className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
                Class Code
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
                Max Students
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.maxStudents}
                onChange={(e) => setForm({ ...form, maxStudents: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Program
            </label>
            {loadingPrograms ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-cream/5 border border-cream/10 rounded-xl text-cream/50 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading programs…
              </div>
            ) : programsError ? (
              <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {programsError}
              </div>
            ) : programs.length === 0 ? (
              <div className="px-4 py-2.5 bg-cream/5 border border-cream/10 rounded-xl text-cream/50 text-xs">
                No published programs found. Create one in Courses first.
              </div>
            ) : (
              <select
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.category ? ` — ${p.category}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Assign Faculty (Instructors)
            </label>
            {loadingFaculties ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-cream/5 border border-cream/10 rounded-xl text-cream/50 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading faculty...
              </div>
            ) : faculties.length === 0 ? (
              <div className="px-4 py-2.5 bg-cream/5 border border-cream/10 rounded-xl text-cream/50 text-xs">
                No active faculty members found. Create one in Settings or Admin Users first.
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto border border-cream/10 rounded-xl p-2 bg-cream/5 space-y-1.5 scrollbar-thin">
                {faculties.map((f) => (
                  <label key={f.id} className="flex items-center gap-2.5 text-xs text-cream/80 cursor-pointer select-none py-0.5 hover:text-cream">
                    <input
                      type="checkbox"
                      checked={selectedFaculties.includes(f.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFaculties([...selectedFaculties, f.id]);
                        } else {
                          setSelectedFaculties(selectedFaculties.filter(id => id !== f.id));
                        }
                      }}
                      className="rounded border-cream/20 bg-[#1A0F33] text-lime focus:ring-0 focus:ring-offset-0"
                    />
                    <span>{f.name} <span className="text-cream/40">({f.email})</span></span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Classroom"}
            </button>
          </div>
        </form>
      </DarkCard>
    </div>
  );
}

// ─── Edit Classroom Modal ────────────────────────────────────────────────────
function EditClassroomModal({
  classroom,
  onClose,
  onUpdated,
}: {
  classroom: Classroom;
  onClose: () => void;
  onUpdated?: (updated: Classroom) => void;
}) {
  const [programs, setPrograms] = useState<ProgramCourse[]>([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [faculties, setFaculties] = useState<any[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  const [selectedFaculties, setSelectedFaculties] = useState<string[]>(
    Array.isArray(classroom.instructors)
      ? classroom.instructors.map((ins: any) => typeof ins === 'string' ? ins : ins.id)
      : []
  );

  const [form, setForm] = useState({
    name: classroom.name,
    description: classroom.description || "",
    code: classroom.code,
    program: classroom.programId || "",
    maxStudents: classroom.maxStudents,
    status: classroom.status,
  });

  useEffect(() => {
    let active = true;
    getAdminPrograms()
      .then((data) => {
        if (!active) return;
        setPrograms(data.filter((p) => p.status === "published"));
      })
      .catch(() => {})
      .finally(() => { if (active) setLoadingPrograms(false); });

    setLoadingFaculties(true);
    getAdminUsers("faculty")
      .then((data) => {
        if (!active) return;
        setFaculties(data);
      })
      .catch((err) => console.error(err))
      .finally(() => { if (active) setLoadingFaculties(false); });

    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const updated = await apiUpdateClassroom(classroom.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        code: form.code.trim(),
        program: form.program || undefined,
        maxStudents: form.maxStudents,
        status: form.status as Classroom["status"],
        instructors: selectedFaculties,
      });
      classroomActions.updateClassroom(classroom.id, updated);
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update classroom");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <DarkCard className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-cream">Edit Classroom</h2>
          <button onClick={onClose} className="text-cream/50 hover:text-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
              {submitError}
            </div>
          )}

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Classroom Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. ICU Critical Care — Batch 24A"
              className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What will students learn in this classroom?"
              rows={3}
              className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
                Class Code
              </label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
                Max Students
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.maxStudents}
                onChange={(e) => setForm({ ...form, maxStudents: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Program
            </label>
            {loadingPrograms ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-cream/5 border border-cream/10 rounded-xl text-cream/50 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading programs…
              </div>
            ) : (
              <select
                value={form.program}
                onChange={(e) => setForm({ ...form, program: e.target.value })}
                className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
              >
                <option value="">— No program —</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}{p.category ? ` — ${p.category}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as Classroom["status"] })}
              className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">
              Assign Faculty (Instructors)
            </label>
            {loadingFaculties ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-cream/5 border border-cream/10 rounded-xl text-cream/50 text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading faculty...
              </div>
            ) : faculties.length === 0 ? (
              <div className="px-4 py-2.5 bg-cream/5 border border-cream/10 rounded-xl text-cream/50 text-xs">
                No active faculty members found. Create one in Settings or Admin Users first.
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto border border-cream/10 rounded-xl p-2 bg-cream/5 space-y-1.5 scrollbar-thin">
                {faculties.map((f) => (
                  <label key={f.id} className="flex items-center gap-2.5 text-xs text-cream/80 cursor-pointer select-none py-0.5 hover:text-cream">
                    <input
                      type="checkbox"
                      checked={selectedFaculties.includes(f.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFaculties([...selectedFaculties, f.id]);
                        } else {
                          setSelectedFaculties(selectedFaculties.filter(id => id !== f.id));
                        }
                      }}
                      className="rounded border-cream/20 bg-[#1A0F33] text-lime focus:ring-0 focus:ring-offset-0"
                    />
                    <span>{f.name} <span className="text-cream/40">({f.email})</span></span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </DarkCard>
    </div>
  );
}

function ClassroomCard({ cls, onEdit, onArchive }: { cls: Classroom; onEdit: (cls: Classroom) => void; onArchive: (id: string) => void }) {
  const activeStudents = cls.students.filter((s) => s.status === "active").length;
  const publishedRecs = cls.recordings.filter((r) => r.isPublished).length;
  const publishedQuizzes = cls.quizzes.filter((q) => q.status === "published").length;
  const liveOrUpcoming = cls.meetings.filter((m) => m.status === "scheduled" || m.status === "live").length;

  return (
    <div className="rounded-2xl bg-[#1A0F33] border border-cream/10 overflow-hidden hover:border-lime/30 transition-colors group">
      <div className="h-2 bg-linear-to-r from-lime/60 to-lime" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-cream text-base leading-snug truncate">{cls.name}</h3>
            <span className="font-mono text-[10px] text-cream/50">{cls.code}</span>
          </div>
          <StatusBadge status={cls.status} />
        </div>

        <p className="text-cream/60 text-xs leading-relaxed line-clamp-2 mb-4">
          {cls.description || "No description."}
        </p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { icon: Users, val: activeStudents, label: "Students" },
            { icon: Video, val: liveOrUpcoming, label: "Live" },
            { icon: BookOpen, val: publishedRecs, label: "Vids" },
            { icon: ClipboardList, val: publishedQuizzes, label: "Quizzes" },
          ].map(({ icon: Icon, val, label }) => (
            <div key={label} className="bg-cream/5 rounded-lg p-2 text-center">
              <Icon className="h-3.5 w-3.5 text-lime mx-auto mb-0.5" />
              <div className="font-display font-bold text-cream text-sm">{val}</div>
              <div className="text-[9px] text-cream/50 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>

        {cls.instructors && cls.instructors.length > 0 && (
          <div className="text-[10px] text-cream/40 mb-4 truncate">
            Faculty: <span className="text-cream/70 font-semibold">{cls.instructors.map(i => i.name).join(", ")}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Link
            to="/admin/classrooms/$id"
            params={{ id: cls.id }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold group-hover:shadow-lg group-hover:shadow-lime/20 transition-shadow"
          >
            Open Classroom <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => onEdit(cls)}
            className="rounded-full bg-cream/10 text-cream/70 px-3 py-2 hover:bg-lime/20 hover:text-lime transition-colors"
            title="Edit classroom"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {cls.status !== "archived" ? (
            <button
              onClick={() => onArchive(cls.id)}
              className="rounded-full bg-cream/10 text-cream/70 px-3 py-2 hover:bg-orange-500/20 hover:text-orange-400 transition-colors"
              title="Archive classroom"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onArchive(cls.id)}
              className="rounded-full bg-cream/10 text-cream/70 px-3 py-2 hover:bg-lime/20 hover:text-lime transition-colors"
              title="Unarchive classroom (set active)"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Module-level list cache ─────────────────────────────────────────────────
// Prevents the classrooms list from refetching every time the admin navigates
// back from a classroom detail page. Same 60-second staleness window as detail pages.
const STALE_MS = 60_000;
let listLastFetchedAt = 0;
const isListStale = () => Date.now() - listLastFetchedAt > STALE_MS;

function AdminClassrooms() {
  const { classrooms } = useClassroomStore();
  // Show the full-page loading only when store is completely empty
  const [loadingBackend, setLoadingBackend] = useState(classrooms.length === 0);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState< "active" | "archived" | "draft">("active");
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [archiveLoading, setArchiveLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      // Skip refetch if list data is fresh in cache
      if (classrooms.length > 0 && !isListStale()) return;
      if (classrooms.length === 0) setLoadingBackend(true);
      try {
        const data = await apiGetClassrooms();
        if (active) {
          classroomActions.setClassrooms(data);
          listLastFetchedAt = Date.now();
          setBackendError(null);
        }
      } catch (err) {
        if (active && classrooms.length === 0) {
          setBackendError(String(err instanceof Error ? err.message : err));
        }
      } finally {
        if (active) setLoadingBackend(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const handleEdit = (cls: Classroom) => {
    setEditingClassroom(cls);
  };

  const handleArchive = async (id: string) => {
    if (archiveLoading) return;
    setArchiveLoading(id);
    setFeedback(null);
    try {
      const updated = await apiArchiveClassroom(id);
      classroomActions.updateClassroom(id, updated);
      listLastFetchedAt = 0; // force re-sync on next visit
      const msg = updated.status === "archived" ? "Classroom archived successfully" : "Classroom restored successfully";
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to archive classroom";
      setFeedback(msg);
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setArchiveLoading(null);
    }
  };

  // Use store directly — updated by the background fetch above
  const sourceClassrooms = classrooms;
  const filtered = React.useMemo(() =>
    sourceClassrooms.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.program.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "active" || c.status === filterStatus;
      return matchSearch && matchStatus;
    }),
    [sourceClassrooms, search, filterStatus] 
  );

  const { totalStudents, totalRecordings } = React.useMemo(() => ({
    totalStudents: sourceClassrooms.reduce(
      (s, c) => s + c.students.filter((st) => st.status === "active").length, 0,
    ),
    totalRecordings: sourceClassrooms.reduce(
      (s, c) => s + c.recordings.filter((r) => r.isPublished).length, 0,
    ),
  }), [sourceClassrooms]);

  return (
    <div className="space-y-6 text-cream">
      {showCreate && (
        <CreateClassroomModal
          onClose={() => setShowCreate(false)}
          onCreated={(classroom) => {
            classroomActions.addClassroom(classroom);
            listLastFetchedAt = 0; // force re-sync on next visit
          }}
        />
      )}

      {editingClassroom && (
        <EditClassroomModal
          classroom={editingClassroom}
          onClose={() => setEditingClassroom(null)}
          onUpdated={(updated) => {
            classroomActions.updateClassroom(editingClassroom.id, updated);
            listLastFetchedAt = 0;
          }}
        />
      )}

      {feedback && (
        <div className="rounded-xl border border-lime/30 bg-lime/10 px-4 py-3 text-sm text-lime shadow-lg">
          {feedback}
        </div>
      )}

      {loadingBackend && <p className="text-sm text-cream/60">Loading classrooms from MongoDB…</p>}
      {backendError && <p className="text-sm text-red-400">Error loading classrooms: {backendError}</p>}

      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <School className="h-8 w-8 text-lime" /> Classrooms
          </h1>
          <p className="text-cream/60 text-sm mt-1">
            Manage live classes, recordings, and quizzes per batch
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> Create Classroom
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Classrooms", value: sourceClassrooms.length },
          { label: "Active", value: sourceClassrooms.filter((c) => c.status === "active").length },
          { label: "Total Students", value: totalStudents },
          { label: "Published Recordings", value: totalRecordings },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-4">
            <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.label}</div>
            <div className="font-display text-2xl font-bold mt-1 text-cream">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-cream/5 rounded-full px-4 py-2 flex-1 min-w-50 max-w-xs">
          <Search className="h-4 w-4 text-cream/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classrooms…"
            className="bg-transparent outline-none text-sm flex-1 text-cream placeholder:text-cream/40"
          />
        </div>
        <div className="flex gap-1">
          {(["active", "archived", "draft"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 capitalize transition-colors ${
                filterStatus === s ? "bg-lime text-plum-dark" : "bg-cream/10 text-cream/70"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <DarkCard className="text-center py-16">
          <School className="h-12 w-12 text-cream/20 mx-auto mb-3" />
          <p className="text-cream/60 text-sm">No classrooms found. Create one to get started.</p>
        </DarkCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <ClassroomCard key={c.id} cls={c} onEdit={handleEdit} onArchive={handleArchive} />
          ))}
        </div>
      )}
    </div>
  );
}
