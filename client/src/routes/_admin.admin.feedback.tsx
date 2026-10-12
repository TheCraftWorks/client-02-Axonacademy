import { createFileRoute } from "@tanstack/react-router";
import { 
  Plus, Star, Trash2, Edit2, Loader2, Upload, MessageSquareQuote, 
  Search, ArrowRight, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle 
} from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";
import { useState, useEffect, useRef, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_admin/admin/feedback")({
  component: AdminFeedback,
});

interface TestimonialItem {
  _id: string;
  name: string;
  roll: string;
  review: string;
  row?: number;
  image?: string;
  createdAt?: string;
}

function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "row1" | "row2">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<TestimonialItem | null>(null);
  const [targetRow, setTargetRow] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  
  // Photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/testimonials");
      if (res.success) {
        setFeedbacks(res.testimonials || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch feedbacks:", err);
      setStatusMsg({ type: "error", text: "Failed to load feedbacks from database" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleOpenAdd = (preferredRow?: 1 | 2) => {
    setEditingFeedback(null);
    setTargetRow(preferredRow || 1);
    setSelectedFile(null);
    setPreviewUrl(null);
    setStatusMsg(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (fb: TestimonialItem) => {
    setEditingFeedback(fb);
    setTargetRow((fb.row === 2 ? 2 : 1));
    setSelectedFile(null);
    setPreviewUrl(fb.image ? getAssetUrl(fb.image) : null);
    setStatusMsg(null);
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
    setStatusMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.set("row", String(targetRow));

    if (selectedFile) {
      formData.set("image", selectedFile);
    }

    try {
      if (editingFeedback) {
        if (selectedFile) {
          await api.multipart(`/admin/testimonials/${editingFeedback._id}`, "PUT", formData);
        } else {
          await api.put(`/admin/testimonials/${editingFeedback._id}`, {
            name: formData.get("name"),
            roll: formData.get("roll"),
            review: formData.get("review"),
            row: targetRow,
            removeImage: !previewUrl && Boolean(editingFeedback.image),
          });
        }
        setStatusMsg({ type: "success", text: "Feedback updated successfully" });
      } else {
        if (selectedFile) {
          await api.multipart("/admin/testimonials", "POST", formData);
        } else {
          await api.post("/admin/testimonials", {
            name: formData.get("name"),
            roll: formData.get("roll"),
            review: formData.get("review"),
            row: targetRow,
          });
        }
        setStatusMsg({ type: "success", text: `Feedback added successfully to Row ${targetRow}` });
      }

      setDialogOpen(false);
      await fetchFeedbacks();
    } catch (err: any) {
      console.error("Failed to save feedback:", err);
      alert(err.message || "Failed to save feedback. Please check required fields.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the feedback from "${name}"?`)) {
      return;
    }
    try {
      setDeletingId(id);
      await api.delete(`/admin/testimonials/${id}`);
      setFeedbacks((prev) => prev.filter((item) => item._id !== id));
      setStatusMsg({ type: "success", text: `Deleted feedback from ${name}` });
    } catch (err: any) {
      console.error("Failed to delete feedback:", err);
      alert("Failed to delete feedback. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered lists
  const row1Count = useMemo(() => feedbacks.filter((f) => f.row === 1 || !f.row).length, [feedbacks]);
  const row2Count = useMemo(() => feedbacks.filter((f) => f.row === 2).length, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((fb) => {
      // Row filter
      if (activeTab === "row1" && fb.row === 2) return false;
      if (activeTab === "row2" && fb.row !== 2) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = fb.name?.toLowerCase().includes(q);
        const matchesRoll = fb.roll?.toLowerCase().includes(q);
        const matchesReview = fb.review?.toLowerCase().includes(q);
        return matchesName || matchesRoll || matchesReview;
      }

      return true;
    });
  }, [feedbacks, activeTab, searchQuery]);

  return (
    <div className="space-y-6 text-cream">
      {/* Header Banner */}
      <div className="flex items-start sm:items-end justify-between flex-wrap gap-4 pb-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5 text-lime mb-1">
            <MessageSquareQuote className="h-5 w-5" />
            <span className="text-xs uppercase font-mono tracking-widest font-semibold">Student Voice Management</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Feedback Center</h1>
          <p className="text-cream/60 text-sm mt-1">
            Manage live home page testimonials across Row 1 (Right-to-Left) and Row 2 (Left-to-Right).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFeedbacks}
            disabled={loading}
            className="bg-white/5 border-white/10 text-cream hover:bg-white/10 rounded-xl gap-2 h-10 px-4"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            onClick={() => handleOpenAdd(1)}
            className="bg-lime text-plum-dark font-bold hover:bg-lime/90 rounded-xl gap-2 h-10 px-5 shadow-lg shadow-lime/20"
          >
            <Plus className="h-4 w-4" />
            Add Feedback
          </Button>
        </div>
      </div>

      {/* Status alert message */}
      {statusMsg && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm ${
          statusMsg.type === "success" 
            ? "bg-lime/10 border border-lime/30 text-lime" 
            : "bg-red-500/10 border border-red-500/30 text-red-300"
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMsg.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-cream/40 hover:text-cream text-xs">Dismiss</button>
        </div>
      )}

      {/* Row Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div 
          onClick={() => setActiveTab("all")}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "all" 
              ? "bg-white/10 border-lime shadow-md shadow-lime/10" 
              : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-cream/70 text-xs uppercase tracking-wider font-semibold">
            <span>Total Feedbacks</span>
            <MessageSquareQuote className="h-4 w-4 text-cream/50" />
          </div>
          <div className="mt-2 text-3xl font-display font-bold text-cream">{feedbacks.length}</div>
          <div className="text-xs text-cream/50 mt-1">Both Row 1 & Row 2 Combined</div>
        </div>

        <div 
          onClick={() => setActiveTab("row1")}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "row1" 
              ? "bg-white/10 border-amber-400 shadow-md shadow-amber-400/10" 
              : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-amber-300 text-xs uppercase tracking-wider font-semibold">
            <span className="flex items-center gap-1.5">
              1st Row <ArrowRight className="h-3 w-3" />
            </span>
            <span className="text-[10px] bg-amber-400/20 px-2 py-0.5 rounded-full text-amber-300">R-to-L</span>
          </div>
          <div className="mt-2 text-3xl font-display font-bold text-cream">{row1Count}</div>
          <div className="text-xs text-cream/50 mt-1 flex items-center justify-between">
            <span>Top Marquee Stream</span>
            <button 
              onClick={(e) => { e.stopPropagation(); handleOpenAdd(1); }} 
              className="text-amber-300 hover:underline font-bold text-[11px]"
            >
              + Add to Row 1
            </button>
          </div>
        </div>

        <div 
          onClick={() => setActiveTab("row2")}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            activeTab === "row2" 
              ? "bg-white/10 border-cyan-400 shadow-md shadow-cyan-400/10" 
              : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
          }`}
        >
          <div className="flex items-center justify-between text-cyan-300 text-xs uppercase tracking-wider font-semibold">
            <span className="flex items-center gap-1.5">
              <ArrowLeft className="h-3 w-3" /> 2nd Row
            </span>
            <span className="text-[10px] bg-cyan-400/20 px-2 py-0.5 rounded-full text-cyan-300">L-to-R</span>
          </div>
          <div className="mt-2 text-3xl font-display font-bold text-cream">{row2Count}</div>
          <div className="text-xs text-cream/50 mt-1 flex items-center justify-between">
            <span>Bottom Marquee Stream</span>
            <button 
              onClick={(e) => { e.stopPropagation(); handleOpenAdd(2); }} 
              className="text-cyan-300 hover:underline font-bold text-[11px]"
            >
              + Add to Row 2
            </button>
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
        <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "all" ? "bg-lime text-plum-dark shadow" : "text-cream/70 hover:text-cream"
            }`}
          >
            All ({feedbacks.length})
          </button>
          <button
            onClick={() => setActiveTab("row1")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "row1" ? "bg-amber-400 text-plum-dark shadow" : "text-cream/70 hover:text-cream"
            }`}
          >
            Row 1 · R-to-L ({row1Count})
          </button>
          <button
            onClick={() => setActiveTab("row2")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "row2" ? "bg-cyan-400 text-plum-dark shadow" : "text-cream/70 hover:text-cream"
            }`}
          >
            Row 2 · L-to-R ({row2Count})
          </button>
        </div>

        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, Reg No, or feedback text..."
            className="pl-10 bg-white/5 border-white/10 text-cream placeholder:text-cream/40 rounded-xl focus:border-lime"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cream/40 hover:text-cream"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Feedbacks Grid */}
      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-lime" />
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-cream/40 text-center p-6">
          <MessageSquareQuote className="h-12 w-12 mb-3 opacity-20" />
          <p className="font-semibold text-cream/70">No student feedbacks found</p>
          <p className="text-xs text-cream/40 mt-1 max-w-sm">
            {searchQuery 
              ? "No feedback entries matched your search query." 
              : activeTab !== "all" 
                ? `No feedbacks assigned to ${activeTab === "row1" ? "Row 1" : "Row 2"}.` 
                : "No student testimonials saved in database yet."}
          </p>
          <Button 
            onClick={() => handleOpenAdd(activeTab === "row2" ? 2 : 1)} 
            className="mt-4 bg-lime text-plum-dark font-bold hover:bg-lime/90 rounded-xl text-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add First Feedback
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredFeedbacks.map((fb) => {
            const isRow2 = fb.row === 2;
            const initials = fb.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "ST";

            return (
              <DarkCard key={fb._id} className="relative flex flex-col justify-between overflow-hidden border-white/10 group">
                {/* Top Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-lime text-plum-dark font-bold grid place-items-center shrink-0">
                        {fb.image ? (
                          <img src={getAssetUrl(fb.image)} alt={fb.name} className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-cream truncate">{fb.name}</div>
                        <div className="text-xs font-mono text-lime/90 font-medium">{fb.roll}</div>
                      </div>
                    </div>

                    {/* Row Badge */}
                    <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      isRow2 
                        ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/30" 
                        : "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                    }`}>
                      {isRow2 ? <ArrowLeft className="h-3 w-3" /> : null}
                      {isRow2 ? "2nd Row (L-to-R)" : "1st Row (R-to-L)"}
                      {!isRow2 ? <ArrowRight className="h-3 w-3" /> : null}
                    </span>
                  </div>

                  {/* Stars Rating */}
                  <div className="flex items-center gap-1 mt-3">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} className="h-3.5 w-3.5 fill-gold text-gold" />
                    ))}
                    <span className="text-[10px] text-cream/40 font-mono ml-1.5">Verified Review</span>
                  </div>

                  {/* Review Text */}
                  <div className="mt-3 p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs text-cream/85 leading-relaxed max-h-44 overflow-y-auto whitespace-pre-line">
                    "{fb.review}"
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-cream/40">
                    {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : "Live on Home"}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(fb)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-cream/80 hover:text-lime transition-colors"
                      title="Edit Feedback"
                      aria-label="Edit Feedback"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === fb._id}
                      onClick={() => handleDelete(fb._id, fb.name)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-cream/80 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete Feedback"
                      aria-label="Delete Feedback"
                    >
                      {deletingId === fb._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </DarkCard>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] bg-[#120A24] text-cream border-white/15 p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold flex items-center gap-2">
              <MessageSquareQuote className="h-6 w-6 text-lime" />
              {editingFeedback ? "Edit Feedback" : "Add Student Feedback"}
            </DialogTitle>
            <p className="text-xs text-cream/60">
              Provide student details and choose whether this testimonial streams in 1st row or 2nd row on the website.
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* Row Selector Option (1st Row vs 2nd Row) */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-cream/70 font-bold">
                Select Display Row <span className="text-lime">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetRow(1)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    targetRow === 1 
                      ? "bg-amber-400/20 border-amber-400 text-amber-200 shadow-md shadow-amber-400/10" 
                      : "bg-white/5 border-white/10 text-cream/60 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">1st Row</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10">R &rarr; L</span>
                  </div>
                  <span className="text-[11px] opacity-80 mt-1">Top marquee, moves right to left</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetRow(2)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    targetRow === 2 
                      ? "bg-cyan-400/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-400/10" 
                      : "bg-white/5 border-white/10 text-cream/60 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">2nd Row</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10">&larr; L &larr; R</span>
                  </div>
                  <span className="text-[11px] opacity-80 mt-1">Bottom marquee, moves left to right</span>
                </button>
              </div>
            </div>

            {/* Student Name & Reg No */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-cream/70 font-semibold">Student Name *</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingFeedback?.name}
                  placeholder="e.g. RANJITH KUMAR S"
                  required
                  className="bg-white/5 border-white/15 text-cream focus:border-lime rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="roll" className="text-xs text-cream/70 font-semibold">Reg No / Roll No *</Label>
                <Input
                  id="roll"
                  name="roll"
                  defaultValue={editingFeedback?.roll}
                  placeholder="e.g. AXP26164"
                  required
                  className="bg-white/5 border-white/15 text-cream focus:border-lime rounded-xl"
                />
              </div>
            </div>

            {/* Student Photo (Optional) */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="relative h-14 w-14 rounded-xl overflow-hidden bg-white/10 border border-white/15 grid place-items-center shrink-0">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-5 w-5 text-cream/30" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-cream">Student Avatar (Optional)</div>
                <div className="text-[10px] text-cream/40">If omitted, name initials will be displayed automatically.</div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 text-xs px-2.5 rounded-lg bg-white/10 border-white/15 text-cream hover:bg-white/20"
                  >
                    {previewUrl ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Feedback Review Text */}
            <div className="space-y-1.5">
              <Label htmlFor="review" className="text-xs text-cream/70 font-semibold">Student Feedback *</Label>
              <Textarea
                id="review"
                name="review"
                defaultValue={editingFeedback?.review}
                placeholder="Enter detailed feedback about classes, mnemonics, tests, telegram support, faculties..."
                rows={4}
                required
                className="bg-white/5 border-white/15 text-cream focus:border-lime rounded-xl leading-relaxed resize-y"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="text-cream hover:bg-white/10 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-lime text-plum-dark font-bold hover:bg-lime/90 rounded-xl shadow-lg shadow-lime/20"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingFeedback ? "Save Changes" : `Save Feedback to Row ${targetRow}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
