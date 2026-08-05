import { createFileRoute } from "@tanstack/react-router";
import {
  Mail, Phone, MapPin, Briefcase, GraduationCap,
  Edit3, X, Save, Camera, CheckCircle, AlertCircle, Loader2
} from "lucide-react";
import { Card } from "@/components/portal/PortalShell";
import { useClassroomStore, adminActions, classroomStore } from "@/lib/classroomStore";
import { useState, useRef } from "react";
import { updateMyProfile, uploadProfileAvatar } from "@/lib/api";

export const Route = createFileRoute("/_student/student/profile")({
  component: Profile,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type Toast = { type: "success" | "error"; message: string } | null;

// ─── Avatar Upload Component ─────────────────────────────────────────────────

function AvatarUploader({
  current,
  initials,
  onUploaded,
}: {
  current?: string;
  initials: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const avatarSrc = preview || current;
  const apiBase =
    (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "") || "/api/v1";

  const resolveUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    // relative path → prepend backend origin
    const backendBase = apiBase.replace("/api/v1", "");
    return `${backendBase}${url}`;
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }
    setError(null);
    // local preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // upload
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadProfileAvatar(file, setProgress);
      onUploaded(result.avatar);
    } catch (err: any) {
      setError(err.message || "Upload failed");
      setPreview(null);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative group cursor-pointer"
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-white shadow-xl" style={{boxShadow:'0 0 0 2px rgba(45,156,219,0.3)'}}>
          {resolveUrl(avatarSrc) ? (
            <img
              src={resolveUrl(avatarSrc)!}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg,#0B1F3A,#1A3560)'}}>
              <span className="text-2xl font-bold text-white font-display">{initials}</span>
            </div>
          )}
        </div>
        {/* Overlay */}
        <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>
        {/* Progress Ring */}
        {uploading && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow text-white" style={{background:'#0B1F3A'}}>
            {progress}%
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className="text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1 hover:opacity-80" style={{color:'#2D9CDB'}}
      >
        <Camera className="h-3 w-3" />
        {uploading ? `Uploading… ${progress}%` : "Change Photo"}
      </button>
      {error && (
        <p className="text-[11px] text-red-500 text-center max-w-[140px]">{error}</p>
      )}
    </div>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({ onClose }: { onClose: () => void }) {
  const { currentUser } = useClassroomStore();
  const [form, setForm] = useState({
    name: currentUser?.name || "",
    phone: currentUser?.phone || "",
    address: currentUser?.address || "",
  });
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatar);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 3500);
  };

  const handleAvatarUploaded = (url: string) => {
    setAvatarUrl(url);
    // Update store immediately so the ID card refreshes
    if (currentUser) {
      adminActions.updateUser(currentUser.id, { avatar: url });
    }
    showToast({ type: "success", message: "Profile photo updated!" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      const result = await updateMyProfile({
        fullName: form.name,
        phone: form.phone,
        address: form.address,
      });
      // Update in-memory store
      adminActions.updateUser(currentUser.id, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        avatar: result.user?.avatar ?? avatarUrl,
      });
      showToast({ type: "success", message: "Profile saved successfully!" });
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      showToast({ type: "error", message: err.message || "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  };

  const initials = form.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-md p-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{background:'linear-gradient(135deg,#0B1F3A 0%,#1A3560 100%)'}}>
          <div>
            <h2 className="font-display text-lg font-bold text-white">Edit Profile</h2>
            <p className="text-xs mt-0.5" style={{color:'rgba(255,255,255,0.5)'}}>Update your personal details</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Avatar Section */}
        <div className="flex justify-center pt-6 pb-2">
          <AvatarUploader
            current={avatarUrl}
            initials={initials}
            onUploaded={handleAvatarUploaded}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 pt-4">
          {/* Toast */}
          {toast && (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 ${
                toast.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-red-50 text-red-700 border border-red-100"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {toast.message}
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Enter your full name"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 text-sm outline-none transition-all placeholder:text-slate-300"
              style={{}} onFocus={e=>e.currentTarget.style.borderColor='#2D9CDB'} onBlur={e=>e.currentTarget.style.borderColor=''}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 90000 00000"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-700 text-sm outline-none focus:border-plum/50 focus:ring-2 focus:ring-plum/20 transition-all placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="text-[11px] uppercase tracking-widest text-slate-500 block mb-1.5 font-semibold">
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="House no., Street, City, State – PIN"
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-700 text-sm outline-none focus:border-plum/50 focus:ring-2 focus:ring-plum/20 transition-all placeholder:text-slate-300 resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-full bg-slate-100 text-slate-600 py-2.5 text-sm font-semibold hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-60 text-white"
              style={{background:'#0B1F3A'}}
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
              ) : (
                <><Save className="h-4 w-4" /> Save Changes</>
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

function Profile() {
  const { currentUser, classrooms } = useClassroomStore();
  const [showEdit, setShowEdit] = useState(false);

  const name      = currentUser?.name    || "Student Name";
  const email     = currentUser?.email   || "No email";
  const phone     = currentUser?.phone   || "";
  const address   = currentUser?.address || "";
  const avatar    = currentUser?.avatar  || "";
  const studentId = currentUser?.id      || "";
  const userId = currentUser?.userId || "";
  const displayId = userId || studentId.slice(-8).toUpperCase() || "—";

  const apiBase   = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "") || "/api/v1";
  const resolveUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${apiBase.replace("/api/v1", "")}${url}`;
  };

  const enrolled          = classrooms.filter((c) => c.students.some((s) => s.id === studentId));
  const joinedYear        = enrolled.length > 0 ? new Date(enrolled[0].students.find((s) => s.id === studentId)!.addedAt).getFullYear() : new Date().getFullYear();
  const activeClassrooms  = enrolled.filter((c) => c.students.find((s) => s.id === studentId)?.status === "active");
  const programsEnrolled  = Array.from(new Set(activeClassrooms.map((c) => c.program)));
  const joinDate          = enrolled.length > 0 ? new Date(enrolled[0].students.find((s) => s.id === studentId)!.addedAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Recently";
  const initials          = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const resolvedAvatar    = resolveUrl(avatar);

  return (
    <div className="space-y-6">
      {showEdit && <EditProfileModal onClose={() => setShowEdit(false)} />}

      {/* ID Card */}
      <div className="relative mx-auto max-w-lg">
        <div className="rounded-2xl text-white p-6 shadow-2xl border overflow-hidden relative" style={{background:'linear-gradient(135deg,#0B1F3A 0%,#12294D 60%,#1A3560 100%)',borderColor:'rgba(255,255,255,0.1)'}}>
          {/* Decorations */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" style={{background:'rgba(244,180,0,0.3)'}} />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" style={{background:'rgba(45,156,219,0.25)'}} />
          </div>

          <div className="relative">
            {/* Card Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1" style={{color:'#F4B400'}}>AXON MED ACADEMY</div>
                <div className="text-[10px] text-cream/50 font-mono">Student Identity Card</div>
              </div>
              <button
                onClick={() => setShowEdit(true)}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-cream text-[11px] font-semibold px-3 py-1.5 rounded-full border border-white/10 transition-all hover:scale-105 active:scale-95"
              >
                <Edit3 className="h-3 w-3" /> Edit Profile
              </button>
            </div>

            {/* Photo & Name */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="w-24 h-28 sm:w-28 sm:h-32 rounded-xl border-2 shadow-lg overflow-hidden" style={{borderColor:'rgba(244,180,0,0.4)'}}>
                  {resolvedAvatar ? (
                    <img src={resolvedAvatar} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{background:'linear-gradient(135deg,rgba(244,180,0,0.25),rgba(244,180,0,0.1))'}}>
                      <div className="text-center">
                        <span className="text-3xl font-bold font-display" style={{color:'#F4B400'}}>{initials}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 left-0 right-0 h-1 rounded-full" style={{background:'linear-gradient(90deg,#F4B400,#2D9CDB,rgba(244,180,0,0.4))'}} />
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight mb-1 truncate">{name}</h1>
                <div className="text-[10px] uppercase tracking-widest text-cream/60 font-semibold mb-2">Student</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest text-cream/40 w-14 shrink-0">ID No.</span>
                    <span className="text-xs font-mono px-3 py-1 rounded-lg border" style={{color:'#F4B400',background:'rgba(255,255,255,0.1)',borderColor:'rgba(244,180,0,0.3)'}}>
                      {displayId}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-widest text-cream/40 w-14 shrink-0">Email</span>
                    <span className="text-[11px] text-cream/80 truncate">{email}</span>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-widest text-cream/40 w-14 shrink-0">Phone</span>
                      <span className="text-[11px] text-cream/80">{phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Programs & Validity */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-cream/40 mb-1">Programs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {programsEnrolled.length > 0
                      ? programsEnrolled.map((p) => (
                          <span key={p} className="text-[10px] font-semibold px-2 py-0.5 rounded-md border" style={{background:'rgba(244,180,0,0.15)',color:'#B8870A',borderColor:'rgba(244,180,0,0.25)'}}>
                            {p}
                          </span>
                        ))
                      : <span className="text-cream/40 text-[11px]">Not enrolled</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-widest text-cream/40 mb-1">Joined</div>
                  <div className="text-xs font-medium text-cream/80">{joinDate}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information + Contact Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border border-slate-100 shadow-sm p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg" style={{color:'#0B1F3A'}}>Personal Information</h3>
              <p className="text-xs text-slate-500 mt-0.5">Details used for certificates and official communications.</p>
            </div>
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-2 rounded-full transition-all hover:brightness-110 active:scale-95 shadow-sm"
              style={{background:'#0B1F3A'}}
            >
              <Edit3 className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="p-6 grid sm:grid-cols-2 gap-x-6 gap-y-5">
            {[
              { l: "Full Name",     v: name },
              { l: "Email Address", v: email },
              { l: "Phone Number",  v: phone  || "—" },
              { l: "Address",       v: address || "—", full: true },
              { l: "Account Role",  v: "Student" },
              { l: "Status",        v: "Active" },
            ].map((f) => (
              <div key={f.l} className={f.full ? "sm:col-span-2" : ""}>
                <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold mb-1">{f.l}</div>
                <div className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 whitespace-pre-wrap">{f.v}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="border border-slate-100 shadow-sm">
          <h3 className="font-display font-bold text-lg" style={{color:'#0B1F3A'}}>Contact Details</h3>
          <ul className="mt-5 space-y-4 text-sm text-slate-600">
            <li className="flex items-center gap-3">
              <div className="p-2 rounded-lg shrink-0" style={{background:'rgba(45,156,219,0.1)',color:'#2D9CDB'}}><Mail className="h-4 w-4" /></div>
              <span className="font-medium text-slate-800 break-all">{email}</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-2 rounded-lg shrink-0" style={{background:'rgba(45,156,219,0.1)',color:'#2D9CDB'}}><Phone className="h-4 w-4" /></div>
              <span className="font-medium text-slate-800">{phone || <span className="text-slate-400 font-normal italic">Not added</span>}</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="p-2 rounded-lg shrink-0" style={{background:'rgba(45,156,219,0.1)',color:'#2D9CDB'}}><MapPin className="h-4 w-4" /></div>
              <span className="font-medium text-slate-800 mt-0.5 whitespace-pre-wrap">
                {address || (
                  <>
                    <span className="text-slate-400 font-normal italic">Not provided.</span>
                    <br />
                    <button onClick={() => setShowEdit(true)} className="text-xs font-semibold mt-1 hover:underline" style={{color:'#2D9CDB'}}>Add address →</button>
                  </>
                )}
              </span>
            </li>
          </ul>
        </Card>
      </div>

      {/* Enrollment & Academic Standing */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-slate-100 shadow-sm">
          <h3 className="font-display font-bold text-lg flex items-center gap-2" style={{color:'#0B1F3A'}}>
            <GraduationCap className="h-5 w-5" style={{color:'#2D9CDB'}} /> Enrollment History
          </h3>
          <ul className="mt-5 space-y-5">
            {enrolled.map((c) => {
              const me = c.students.find((s) => s.id === studentId)!;
              return (
                <li key={c.id} className="relative pl-5">
                  <div className="absolute left-0 top-[7px] bottom-[-20px] w-px bg-slate-200 last:hidden" />
                  <div className={`absolute left-[-4.5px] top-[7px] h-[10px] w-[10px] rounded-full border-2 border-white shadow-sm`} style={{background: me.status === 'active' ? '#F4B400' : '#94A3B8'}} />
                  <div className="font-semibold" style={{color:'#0B1F3A'}}>{c.program}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.name} · Enrolled {new Date(me.addedAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-1 text-[10px] font-mono text-slate-600">
                    ID: {me.enrollmentId}
                  </div>
                </li>
              );
            })}
            {enrolled.length === 0 && <li className="text-sm text-slate-500">No enrollment history available.</li>}
          </ul>
        </Card>

        <Card className="border border-slate-100 shadow-sm">
          <h3 className="font-display font-bold text-lg flex items-center gap-2" style={{color:'#0B1F3A'}}>
            <Briefcase className="h-5 w-5" style={{color:'#F4B400'}} /> Academic Standing
          </h3>
          <div className="mt-5 space-y-4 text-sm">
            {activeClassrooms.map((c) => {
              const me = c.students.find((s) => s.id === studentId)!;
              return (
                <div key={c.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                  <div className="font-semibold text-sm mb-3" style={{color:'#0B1F3A'}}>{c.program}</div>
                  <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-200">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Progress</div>
                      <div className="font-mono font-bold" style={{color:'#0B1F3A'}}>{me.progress}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Attendance</div>
                      <div className="font-mono font-bold" style={{color:'#0B1F3A'}}>{me.attendance}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Quiz Avg</div>
                      <div className="font-mono font-bold" style={{color:'#0B1F3A'}}>{me.quizAvg}%</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeClassrooms.length === 0 && (
              <div className="text-center text-slate-500 py-6">No active programs.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}