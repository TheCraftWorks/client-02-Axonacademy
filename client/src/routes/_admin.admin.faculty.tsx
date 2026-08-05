import { createFileRoute } from "@tanstack/react-router";
import { Plus, Star, Users, Trash2, Edit2, Loader2, Upload } from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useState, useEffect, useRef } from "react";
import { api, getAssetUrl } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_admin/admin/faculty")({
  component: AdminFaculty,
});

interface Faculty {
  _id: string;
  name: string;
  role: string;
  specialty: string;
  years: number;
  rating: number;
  initials: string;
  image?: string;
}

function AdminFaculty() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removingImage, setRemovingImage] = useState(false);

  const fetchFaculty = async () => {
    try {
      const res = await api.get("/admin/faculty");
      if (res.success) {
        setFaculty(res.facultyList || []);
      }
    } catch (err) {
      console.error("Failed to fetch faculty:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const handleOpenAdd = () => {
    setEditingFaculty(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (f: Faculty) => {
    setEditingFaculty(f);
    setSelectedFile(null);
    setPreviewUrl(f.image ? getAssetUrl(f.image) : null);
    setDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    
    if (selectedFile) {
      formData.set("image", selectedFile);
    }

    try {
      if (editingFaculty) {
        await api.multipart(`/admin/faculty/${editingFaculty._id}`, "PUT", formData);
      } else {
        await api.multipart("/admin/faculty", "POST", formData);
      }
      setDialogOpen(false);
      fetchFaculty();
    } catch (err) {
      console.error("Failed to save faculty:", err);
      alert("Failed to save faculty member");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this faculty member?")) return;
    try {
      await api.delete(`/admin/faculty/${id}`);
      fetchFaculty();
    } catch (err) {
      console.error("Failed to delete faculty:", err);
    }
  };

  return (
    <div className="space-y-6 text-cream">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Faculty</h1>
          <p className="text-cream/60 text-sm mt-1">{faculty.length} instructors · active management</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold hover:bg-lime/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add faculty member
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-lime" />
        </div>
      ) : faculty.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-cream/40">
          <Users className="h-10 w-10 mb-3 opacity-20" />
          <p>No faculty members found</p>
          <button onClick={handleOpenAdd} className="mt-4 text-lime text-sm font-bold hover:underline">Add your first instructor</button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {faculty.map((f) => (
            <DarkCard key={f._id}>
              <div className="flex items-center gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-lime text-plum-dark font-bold grid place-items-center">
                  {f.image ? (
                    <img src={getAssetUrl(f.image)} alt={f.name} className="h-full w-full object-cover" />
                  ) : (
                    f.initials || f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold truncate">{f.name}</div>
                  <div className="text-xs text-cream/60">{f.role} · {f.specialty}</div>
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={() => handleOpenEdit(f)}
                    className="p-2 rounded-lg hover:bg-white/10 text-cream/70 hover:text-lime transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(f._id)}
                    className="p-2 rounded-lg hover:bg-white/10 text-cream/70 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-cream/5 p-3">
                  <div className="flex items-center justify-center gap-1 text-lime"><Star className="h-3.5 w-3.5 fill-lime" /><span className="font-bold">{f.rating}</span></div>
                  <div className="text-[10px] uppercase tracking-widest text-cream/50 mt-1">Rating</div>
                </div>
                <div className="rounded-xl bg-cream/5 p-3">
                  <div className="font-bold text-lime flex items-center justify-center gap-1"><Users className="h-3.5 w-3.5" /> —</div>
                  <div className="text-[10px] uppercase tracking-widest text-cream/50 mt-1">Students</div>
                </div>
                <div className="rounded-xl bg-cream/5 p-3">
                  <div className="font-bold text-lime">{f.years}y</div>
                  <div className="text-[10px] uppercase tracking-widest text-cream/50 mt-1">Experience</div>
                </div>
              </div>
            </DarkCard>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#1A0F33] text-cream border-white/10">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editingFaculty ? "Edit Faculty Member" : "Add Faculty Member"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-5 mb-6">
              <div className="relative group">
                <div 
                  className="h-28 w-28 overflow-hidden rounded-[2rem] bg-white/5 border-2 border-dashed border-white/10 group-hover:border-lime/50 transition-all grid place-items-center shadow-inner"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                  ) : (
                    <Users className="h-10 w-10 text-cream/10" />
                  )}
                </div>
                {previewUrl && (
                  <button 
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-red-500 text-white grid place-items-center shadow-lg hover:bg-red-600 transition-colors z-10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white/5 border-white/10 text-cream hover:bg-white/10 hover:text-lime rounded-full px-4 h-9 text-xs font-bold"
                >
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  {previewUrl ? "Change Photo" : "Upload Photo"}
                </Button>
                <p className="text-[10px] text-cream/30 uppercase tracking-[0.15em] font-medium">JPG, PNG or WebP · Max 2MB</p>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-cream/70">Full Name</Label>
                <Input id="name" name="name" defaultValue={editingFaculty?.name} required className="bg-white/5 border-white/10 text-cream focus:border-lime" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role" className="text-cream/70">Role</Label>
                <Input id="role" name="role" defaultValue={editingFaculty?.role} placeholder="e.g. Lead Instructor" required className="bg-white/5 border-white/10 text-cream focus:border-lime" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="specialty" className="text-cream/70">Specialty</Label>
                <Input id="specialty" name="specialty" defaultValue={editingFaculty?.specialty} placeholder="e.g. OT & Surgery" required className="bg-white/5 border-white/10 text-cream focus:border-lime" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="years" className="text-cream/70">Exp (Years)</Label>
                <Input id="years" name="years" type="number" defaultValue={editingFaculty?.years} required className="bg-white/5 border-white/10 text-cream focus:border-lime" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rating" className="text-cream/70">Initial Rating</Label>
                <Input id="rating" name="rating" type="number" step="0.1" max="5" defaultValue={editingFaculty?.rating || 5.0} className="bg-white/5 border-white/10 text-cream focus:border-lime" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initials" className="text-cream/70">Initials (Optional)</Label>
                <Input id="initials" name="initials" defaultValue={editingFaculty?.initials} maxLength={2} className="bg-white/5 border-white/10 text-cream focus:border-lime" />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="text-cream hover:bg-white/5 hover:text-cream">Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-lime text-plum-dark font-bold hover:bg-lime/90">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingFaculty ? "Update Instructor" : "Create Instructor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
