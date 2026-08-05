import { createFileRoute } from "@tanstack/react-router";
import { Plus, Edit2, Trash2, X, IndianRupee, BookOpen, TrendingUp, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import {
  getAdminPrograms,
  createAdminProgram,
  updateAdminProgram,
  deleteAdminProgram,
  type ProgramCourse,
  getAssetUrl,
} from "@/lib/api";
import { useState, useEffect, useCallback, useRef } from "react";

export const Route = createFileRoute("/_admin/admin/courses")({
  component: AdminCourses,
});

const CATEGORIES = ["Diploma", "Certificate", "Advanced", "Workshop", "Short Course", "Other"];

// ─── Course Modal ─────────────────────────────────────────────────────────────

function CourseModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: ProgramCourse;
  onClose: () => void;
  onSave: (course: ProgramCourse) => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    category: initial?.category ?? CATEGORIES[1],
    description: initial?.description ?? "",
    price: initial?.price ?? 15000,
    status: (initial?.status ?? "draft") as ProgramCourse["status"],
    specialty: initial?.specialty ?? "",
    duration: initial?.duration ?? "6 Months",
    rating: initial?.rating ?? 4.5,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let saved: ProgramCourse;
      if (initial) {
        saved = await updateAdminProgram(initial.id, form, imageFile, removeImage);
      } else {
        saved = await createAdminProgram(form, imageFile);
      }
      onSave(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save course");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <DarkCard className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-cream">{initial ? "Edit Course" : "Create New Course"}</h2>
          <button onClick={onClose} className="text-cream/50 hover:text-cream"><X className="h-5 w-5" /></button>
        </div>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Photo picker ── */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="h-20 w-32 overflow-hidden rounded-2xl bg-cream/5 border-2 border-dashed border-cream/10 grid place-items-center">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                ) : !removeImage && initial?.image ? (
                  <img src={getAssetUrl(initial.image)} alt="Current" className="h-full w-full object-cover" />
                ) : (
                  <BookOpen className="h-8 w-8 text-cream/10" />
                )}
              </div>
              {(imagePreview || (!removeImage && initial?.image)) && (
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setRemoveImage(true);
                    if (imageRef.current) imageRef.current.value = "";
                  }}
                  className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-red-500 text-white grid place-items-center shadow"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full bg-cream/10 hover:bg-cream/20 text-cream border border-cream/10 px-4 py-2 text-xs font-bold transition-colors"
              >
                {imagePreview || (!removeImage && initial?.image) ? "Change Image" : "Upload Image"}
              </button>
              <p className="text-[10px] text-cream/30 uppercase tracking-[0.15em]">JPG, PNG or WebP · Max 2MB</p>
              <input
                ref={imageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                    setRemoveImage(false);
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Course Title *</label>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. ICU Critical Care" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Specialty</label>
              <input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })}
                placeholder="e.g. Cardiology" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="What will students learn?" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Duration</label>
              <input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })}
                placeholder="e.g. 6 Months" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Rating</label>
              <input type="number" step="0.1" min="1" max="5" value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Price (₹)</label>
              <input type="number" min={0} value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProgramCourse["status"] })}
                className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {initial ? "Save Changes" : "Create Course"}
            </button>
          </div>
        </form>
      </DarkCard>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  title,
  onConfirm,
  onCancel,
  deleting,
}: {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <DarkCard className="w-full max-w-sm text-center">
        <Trash2 className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <h3 className="font-display font-bold text-cream text-lg">Delete "{title}"?</h3>
        <p className="text-cream/60 text-sm mt-2">This action cannot be undone. Enrollment data will be unlinked.</p>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 rounded-full bg-red-500 text-white py-2.5 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-70">
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </DarkCard>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdminCourses() {
  const { classrooms } = useClassroomStore();

  const [courses, setCourses] = useState<ProgramCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<"all" | "published" | "draft" | "archived">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editCourse, setEditCourse] = useState<ProgramCourse | null>(null);
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load courses from API ──────────────────────────────────────────────────
  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminPrograms();
      setCourses(data);
    } catch (err: any) {
      setError(err.message || "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const filteredCourses = courses.filter(c => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalEnrolled = classrooms.reduce((s, c) => s + c.students.filter(st => st.status === "active").length, 0);

  const totalRevenue = classrooms.reduce((s, cls) => {
    const course = courses.find(x => x.title === cls.program);
    return s + (course?.price || 0) * cls.students.filter(st => st.status === "active").length;
  }, 0);

  const publishedCount = courses.filter(c => c.status === "published").length;

  const getEnrolled = (courseTitle: string) =>
    classrooms.filter(c => c.program === courseTitle).flatMap(c => c.students.filter(st => st.status === "active")).length;

  const getRevenue = (course: ProgramCourse) => getEnrolled(course.title) * course.price;

  const tabCounts = {
    all: courses.length,
    published: courses.filter(c => c.status === "published").length,
    draft: courses.filter(c => c.status === "draft").length,
    archived: courses.filter(c => c.status === "archived").length,
  };

  const deleteCourse = courses.find(c => c.id === deleteCourseId);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSave = (saved: ProgramCourse) => {
    setCourses(prev => {
      const exists = prev.find(c => c.id === saved.id);
      return exists
        ? prev.map(c => c.id === saved.id ? saved : c)
        : [saved, ...prev];
    });
  };

  const handleDelete = async () => {
    if (!deleteCourse) return;
    setDeleting(true);
    try {
      await deleteAdminProgram(deleteCourse.id);
      setCourses(prev => prev.filter(c => c.id !== deleteCourse.id));
      setDeleteCourseId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete course");
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (id: string, status: ProgramCourse["status"]) => {
    // Optimistic update
    setCourses(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    try {
      const updated = await updateAdminProgram(id, { status });
      setCourses(prev => prev.map(c => c.id === id ? updated : c));
    } catch (err: any) {
      // Revert on failure
      loadCourses();
      alert(err.message || "Failed to update status");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-cream">
      {showCreate && <CourseModal onClose={() => setShowCreate(false)} onSave={handleSave} />}
      {editCourse && <CourseModal initial={editCourse} onClose={() => setEditCourse(null)} onSave={handleSave} />}
      {deleteCourse && (
        <DeleteConfirm
          title={deleteCourse.title}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteCourseId(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3"><BookOpen className="h-8 w-8 text-lime" /> Courses</h1>
          <p className="text-cream/60 text-sm mt-1">Manage your course catalog · {publishedCount} published</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadCourses} disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-full bg-cream/10 text-cream/70 hover:text-cream disabled:opacity-50" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold">
            <Plus className="h-4 w-4" /> New Course
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { l: "Total Courses", v: courses.length, icon: BookOpen },
          { l: "Total Enrolled", v: totalEnrolled, icon: TrendingUp },
          { l: "Total Revenue", v: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee },
        ].map(s => (
          <div key={s.l} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-5 flex items-center gap-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-lime/15 text-lime shrink-0"><s.icon className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-cream/60">{s.l}</div>
              <div className="font-display text-2xl font-bold mt-0.5">{s.v}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <DarkCard className="p-0 overflow-hidden">
        <div className="p-5 border-b border-cream/10 flex flex-wrap gap-2 items-center">
          {(["all", "published", "draft", "archived"] as const).map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`text-xs font-semibold rounded-full px-4 py-2 capitalize flex items-center gap-1.5 ${filter === t ? "bg-lime text-plum-dark" : "bg-cream/5 text-cream/70"}`}>
              {t} <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filter === t ? "bg-plum-dark/20 text-plum-dark" : "bg-cream/10"}`}>{tabCounts[t]}</span>
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses…"
            className="ml-auto bg-cream/5 rounded-full px-4 py-2 text-sm outline-none placeholder:text-cream/50 w-56" />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16 text-cream/50">
            <Loader2 className="h-5 w-5 animate-spin text-lime" />
            <span className="text-sm">Loading courses…</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-cream/50">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={loadCourses} className="text-xs text-lime hover:underline">Try again</button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream/5">
                <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60">
                  <th className="p-4">Course</th><th>Category</th><th>Enrolled</th><th>Revenue</th><th>Price</th><th>Status</th><th>Updated</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-cream/50">No courses match your filters.</td></tr>
                )}
                {filteredCourses.map(c => {
                  const enrolled = getEnrolled(c.title);
                  const revenue = getRevenue(c);
                  return (
                    <tr key={c.id} className="border-t border-cream/10 hover:bg-cream/5">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {c.image ? (
                            <div className="h-10 w-16 overflow-hidden rounded-md bg-cream/10 shrink-0">
                              <img src={getAssetUrl(c.image)} alt={c.title} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-10 w-16 rounded-md bg-cream/5 border border-cream/10 grid place-items-center shrink-0">
                              <BookOpen className="h-4 w-4 text-cream/20" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold">{c.title}</div>
                            {c.specialty && <div className="text-[11px] text-lime/80 mt-0.5">{c.specialty}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="text-cream/70">
                        {c.category}
                        {c.duration && <div className="text-[10px] text-cream/40 mt-0.5">{c.duration}</div>}
                      </td>
                      <td className="font-mono">{enrolled}</td>
                      <td className="font-mono">₹{revenue.toLocaleString("en-IN")}</td>
                      <td className="font-mono text-lime">₹{c.price.toLocaleString("en-IN")}</td>
                      <td>
                        <select value={c.status}
                          onChange={e => handleStatusChange(c.id, e.target.value as ProgramCourse["status"])}
                          className="bg-[#1A0F33] border border-cream/10 rounded-lg px-2 py-1 text-cream/70 text-xs outline-none">
                          <option value="published">Published</option>
                          <option value="draft">Draft</option>

                        </select>
                      </td>
                      <td className="text-cream/60 text-xs">{new Date(c.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</td>
                      <td className="pr-4">
                        <div className="flex gap-1">
                          <button onClick={() => setEditCourse(c)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-cream/10 text-cream/60 hover:text-cream">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteCourseId(c.id)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-red-500/10 text-cream/40 hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DarkCard>

      {/* Per-Course Revenue Breakdown */}
      {!loading && !error && (
        <DarkCard>
          <h3 className="font-display font-bold text-lg mb-4">Course-wise Enrollment &amp; Revenue</h3>
          <div className="space-y-3">
            {courses.filter(c => c.status === "published").map(c => {
              const enrolled = getEnrolled(c.title);
              const rev = getRevenue(c);
              const maxRev = Math.max(...courses.filter(x => x.status === "published").map(x => getRevenue(x)), 1);
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-cream truncate max-w-[200px]">{c.title}</span>
                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <span className="text-cream/60">{enrolled} enrolled</span>
                      <span className="font-mono text-lime">₹{rev.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-cream/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-lime/60 to-lime rounded-full transition-all" style={{ width: `${(rev / maxRev) * 100}%` }} />
                  </div>
                </div>
              );
            })}
            {courses.filter(c => c.status === "published").length === 0 && (
              <p className="text-sm text-cream/50">No published courses yet.</p>
            )}
          </div>
        </DarkCard>
      )}
    </div>
  );
}
