import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useClassroomStore } from "@/lib/classroomStore";
import { api, getAssetUrl } from "@/lib/api";
import {
  Save,
  Plus,
  Trash2,
  Edit2,
  X,
  Building2,
  BookOpen,
  Users,
  Award,
  FileText,
  Phone,
  Mail,
  MapPin,
  Clock,
  Star,
  MessageSquare,
  Check,
  Upload,
  Play
} from "lucide-react";
import { DarkCard } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_admin/admin/settings")({
  component: Settings,
});

function Settings() {
  const { currentUser } = useClassroomStore();
  if (currentUser?.role === "faculty") {
    return <Navigate to="/admin/classrooms" />;
  }
  const [activeTab, setActiveTab] = useState<
    "Organization"| "About" | "Faculty" | "Placement" | "Blog" | "Voices"
  >("Organization");

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- STATE FOR TABS ---

  // 1. Organization
  const [org, setOrg] = useState({
    name: "Axon Med Academy",
    url: "axonmedacademy",
    email: "hello@axon.academy",
    phone: "+91 98765 43210",
    gst: "29AABCM1234C1ZK",
    timezone: "Asia/Kolkata",
    address: "Plot 21, Medical Campus,\nBengaluru 560001",
    about: "India's most trusted paramedical training academy."
  });
  const [isLoadingOrg, setIsLoadingOrg] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  const applyOrgDetails = (contactDetails: any) => {
    setOrg((current) => ({
      ...current,
      name: contactDetails.name || current.name,
      url: contactDetails.url || current.url,
      email: contactDetails.email || current.email,
      phone: contactDetails.phone || current.phone,
      gst: contactDetails.gst || current.gst,
      timezone: contactDetails.timezone || current.timezone,
      address: contactDetails.address || current.address,
      about: contactDetails.about || current.about,
    }));
  };

  const fetchOrg = async () => {
    setIsLoadingOrg(true);
    try {
      const res = await api.get("/admin/contact-details");
      if (res.success && res.contactDetails) {
        applyOrgDetails(res.contactDetails);
      }
    } catch (err) {
      console.error("Failed to fetch organization settings:", err);
      showToast("Error loading organization details");
    } finally {
      setIsLoadingOrg(false);
    }
  };

  // 2. Courses
  

  // 3. About Us
  const [aboutText, setAboutText] = useState({
    mission: "To make world-class paramedical education accessible to every aspirant in India — regardless of background or budget.",
    vision: "A future where every hospital bedside is supported by a confident, certified, expertly trained paramedical professional.",
    values: "Empathy in care. Rigor in training. Honesty in assessment. Respect for every learner who trusts us with their future."
  });
  const [milestones, setMilestones] = useState<any[]>([]);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);

  // 4. Faculty
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [isAddingFaculty, setIsAddingFaculty] = useState(false);
  const [isLoadingFaculty, setIsLoadingFaculty] = useState(false);
  const facultyPhotoRef = useRef<HTMLInputElement>(null);
  const [facultyPhotoFile, setFacultyPhotoFile] = useState<File | null>(null);
  const [facultyPhotoPreview, setFacultyPhotoPreview] = useState<string | null>(null);

  const fetchFaculty = async () => {
    setIsLoadingFaculty(true);
    try {
      const res = await api.get("/admin/faculty");
      if (res.success) {
        setFacultyList(res.facultyList || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch faculty:", err);
      showToast("Error loading faculty members");
    } finally {
      setIsLoadingFaculty(false);
    }
  };

  // 5. Placements
  const [hospitalPartners, setHospitalPartners] = useState<any[]>([]);
  const [newHospital, setNewHospital] = useState("");
  const [stories, setStories] = useState<any[]>([]);
  const [editingStory, setEditingStory] = useState<any | null>(null);
  const [isAddingStory, setIsAddingStory] = useState(false);

  // 6. Blog
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [isAddingPost, setIsAddingPost] = useState(false);
  const [blogImageFile, setBlogImageFile] = useState<File | null>(null);
  const [blogImagePreview, setBlogImagePreview] = useState<string | null>(null);
  const blogImageRef = useRef<HTMLInputElement>(null);

  // 7. Voices & Reviews
  const [voicesSubTab, setVoicesSubTab] = useState<"Reviews" | "Videos">("Reviews");

  // Written testimonials
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [editingTestimonial, setEditingTestimonial] = useState<any | null>(null);
  const [isAddingTestimonial, setIsAddingTestimonial] = useState(false);
  const [testimonialImageFile, setTestimonialImageFile] = useState<File | null>(null);
  const [testimonialImagePreview, setTestimonialImagePreview] = useState<string | null>(null);
  const testimonialImageRef = useRef<HTMLInputElement>(null);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(false);

  // Review videos
  const [reviewVideos, setReviewVideos] = useState<any[]>([]);
  const [editingVideo, setEditingVideo] = useState<any | null>(null);
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);

  const fetchTestimonials = async () => {
    setIsLoadingTestimonials(true);
    try {
      const res = await api.get("/admin/testimonials");
      if (res.success) {
        setTestimonials(res.testimonials || []);
      }
    } catch (err) {
      console.error("Failed to fetch testimonials:", err);
      showToast("Error loading testimonials");
    } finally {
      setIsLoadingTestimonials(false);
    }
  };

  const fetchReviewVideos = async () => {
    setIsLoadingVideos(true);
    try {
      const res = await api.get("/admin/review-videos");
      if (res.success) {
        setReviewVideos(res.videos || []);
      }
    } catch (err) {
      console.error("Failed to fetch review videos:", err);
      showToast("Error loading review videos");
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // --- NEW FETCH FUNCTIONS FOR ABOUT, PLACEMENTS, BLOG ---
  const [isLoadingAbout, setIsLoadingAbout] = useState(false);
  const fetchAbout = async () => {
    setIsLoadingAbout(true);
    try {
      const res = await api.get("/public/about");
      if (res.success) {
        if (res.about) {
          setAboutText({
            mission: res.about.mission || "",
            vision: res.about.vision || "",
            values: res.about.values || ""
          });
        }
        setMilestones(res.milestones || []);
      }
    } catch (err) {
      console.error("Failed to fetch about:", err);
      showToast("Error loading About details");
    } finally {
      setIsLoadingAbout(false);
    }
  };

  const [isLoadingPlacement, setIsLoadingPlacement] = useState(false);
  const fetchPlacement = async () => {
    setIsLoadingPlacement(true);
    try {
      const res = await api.get("/public/placements");
      if (res.success) {
        setHospitalPartners(res.partners || []);
        setStories(res.stories || []);
      }
    } catch (err) {
      console.error("Failed to fetch placements:", err);
      showToast("Error loading placement details");
    } finally {
      setIsLoadingPlacement(false);
    }
  };

  const [isLoadingBlog, setIsLoadingBlog] = useState(false);
  const fetchBlog = async () => {
    setIsLoadingBlog(true);
    try {
      const res = await api.get("/admin/blogs");
      if (res.success) {
        setBlogPosts(res.blogs || []);
      }
    } catch (err) {
      console.error("Failed to fetch blogs:", err);
      showToast("Error loading blog posts");
    } finally {
      setIsLoadingBlog(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Organization") {
      fetchOrg();
    } else if (activeTab === "Faculty") {
      fetchFaculty();
    } else if (activeTab === "About") {
      fetchAbout();
    } else if (activeTab === "Placement") {
      fetchPlacement();
    } else if (activeTab === "Blog") {
      fetchBlog();
    } else if (activeTab === "Voices") {
      fetchTestimonials();
      fetchReviewVideos();
    }
  }, [activeTab]);

  // 7. Contact Info & Submissio
 



  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return isoString;
    }
  };

  // --- ACTIONS ---

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingOrg(true);
    try {
      const res = await api.put("/admin/contact-details", org);
      if (res.success) {
        if (res.contactDetails) applyOrgDetails(res.contactDetails);
        showToast("Organization settings saved successfully!");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save organization settings");
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleResetOrg = async () => {
    if (!confirm("Reset organization details to defaults?")) return;
    try {
      const res = await api.delete("/admin/contact-details");
      if (res.success) {
        if (res.contactDetails) applyOrgDetails(res.contactDetails);
        showToast("Organization settings reset successfully!");
      }
    } catch (err: any) {
      alert(err.message || "Failed to reset organization settings");
    }
  };

  const handleSaveAbout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put("/admin/about", aboutText);
      if (res.success) {
        showToast("About content saved successfully!");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save core statements");
    }
  };

  

  return (
    <div className="space-y-6 text-cream pb-12">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin settings</h1>
        <p className="text-cream/60 text-sm mt-1">Manage public site pages, configurations and layouts</p>
      </div>

      {/* Main settings layout */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">

        {/* Navigation sidebar */}
        <aside className="space-y-1">
          {["Organization", "About", "Faculty", "Placement", "Blog", "Voices"].map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab as any);
                  setEditingMilestone(null);
                  setIsAddingMilestone(false);
                  setEditingFaculty(null);
                  setIsAddingFaculty(false);
                  setEditingStory(null);
                  setIsAddingStory(false);
                  setEditingPost(null);
                  setIsAddingPost(false);
                  setEditingTestimonial(null);
                  setIsAddingTestimonial(false);
                  setEditingVideo(null);
                  setIsAddingVideo(false);
                }}
                className={`w-full text-left rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${isSelected
                    ? "bg-lime text-plum-dark font-bold"
                    : "text-cream/70 hover:bg-cream/5 hover:text-cream"
                  }`}
              >
                {tab}
              </button>
            );
          })}
        </aside>

        {/* Dynamic configurations view card */}
        <div className="space-y-6">

          {/* 1. ORGANIZATION SETTINGS */}
          {activeTab === "Organization" && (
            <DarkCard>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-display font-bold text-lg">Organization details</h3>
                  <p className="text-xs text-cream/60 mt-1">General public information about Axon Med Academy</p>
                  {isLoadingOrg && <p className="text-xs text-lime mt-1">Loading saved details...</p>}
                </div>
                <Building2 className="text-lime w-6 h-6 opacity-80" />
              </div>

              <form onSubmit={handleSaveOrg} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">Academy name</label>
                    <input
                      type="text"
                      value={org.name}
                      onChange={(e) => setOrg({ ...org, name: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">Display URL</label>
                    <input
                      type="text"
                      value={org.url}
                      onChange={(e) => setOrg({ ...org, url: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">Support email</label>
                    <input
                      type="email"
                      value={org.email}
                      onChange={(e) => setOrg({ ...org, email: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">Phone</label>
                    <input
                      type="text"
                      value={org.phone}
                      onChange={(e) => setOrg({ ...org, phone: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">GST Code</label>
                    <input
                      type="text"
                      value={org.gst}
                      onChange={(e) => setOrg({ ...org, gst: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">Time zone</label>
                    <input
                      type="text"
                      value={org.timezone}
                      onChange={(e) => setOrg({ ...org, timezone: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">Address</label>
                    <textarea
                      value={org.address}
                      onChange={(e) => setOrg({ ...org, address: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-lime min-h-[90px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">About summary</label>
                    <textarea
                      value={org.about}
                      onChange={(e) => setOrg({ ...org, about: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-lime min-h-[90px]"
                    />
                  </div>
                </div>

                <div className="mt-7 flex justify-end gap-3 border-t border-cream/10 pt-5">
                  <button type="button" onClick={handleResetOrg} className="inline-flex items-center gap-2 rounded-full border border-cream/15 px-5 py-2.5 text-sm font-bold text-cream/80 hover:bg-cream/10">
                    <Trash2 className="h-4 w-4" /> Reset
                  </button>
                  <button type="submit" disabled={isSavingOrg} className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold shadow hover:opacity-90 disabled:opacity-60">
                    <Save className="h-4 w-4" /> {isSavingOrg ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            </DarkCard>
          )}

          {/* 3. ABOUT PAGE CONTENT SETTINGS */}
          {activeTab === "About" && (
            <div className="space-y-6">
              <DarkCard>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-display font-bold text-lg">About details & Core values</h3>
                    <p className="text-xs text-cream/60 mt-1">Configure company pillars and statements</p>
                  </div>
                  <BookOpen className="text-lime w-6 h-6 opacity-80" />
                </div>

                <form onSubmit={handleSaveAbout} className="space-y-5">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Mission statement</label>
                      <textarea
                        value={aboutText.mission}
                        onChange={(e) => setAboutText({ ...aboutText, mission: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-lime min-h-[70px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Vision statement</label>
                      <textarea
                        value={aboutText.vision}
                        onChange={(e) => setAboutText({ ...aboutText, vision: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-lime min-h-[70px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Pillar values description</label>
                      <textarea
                        value={aboutText.values}
                        onChange={(e) => setAboutText({ ...aboutText, values: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-lime min-h-[70px]"
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-end border-t border-cream/10 pt-4">
                    <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold hover:opacity-90">
                      <Save className="h-4 w-4" /> Save Core Statements
                    </button>
                  </div>
                </form>
              </DarkCard>

              {/* Milestones settings */}
              <DarkCard>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-display font-bold text-base">Academy history timeline</h3>
                    <p className="text-xs text-cream/60 mt-0.5">Edit milestones showing progress year over year</p>
                  </div>
                  {!editingMilestone && !isAddingMilestone && (
                    <button
                      onClick={() => {
                        setIsAddingMilestone(true);
                        setEditingMilestone({ year: "", title: "", description: "" });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-lime text-plum-dark px-3 py-1.5 text-[11px] font-bold"
                    >
                      <Plus className="h-3 w-3" /> Add milestone
                    </button>
                  )}
                </div>

                {(editingMilestone || isAddingMilestone) ? (
                  <div className="space-y-4 border-t border-cream/10 pt-4">
                    <h4 className="font-semibold text-xs text-lime">{isAddingMilestone ? "Add Milestone" : "Edit Milestone"}</h4>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-cream/60">Year</label>
                        <input
                          type="text"
                          value={editingMilestone.year}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, year: e.target.value })}
                          className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime"
                          placeholder="e.g. 2026"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] uppercase tracking-widest text-cream/60">Heading Title</label>
                        <input
                          type="text"
                          value={editingMilestone.title}
                          onChange={(e) => setEditingMilestone({ ...editingMilestone, title: e.target.value })}
                          className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime"
                          placeholder="e.g. Signed flagship hospital partnerships"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Detail description</label>
                      <textarea
                        value={editingMilestone.description}
                        onChange={(e) => setEditingMilestone({ ...editingMilestone, description: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime min-h-15"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMilestone(null);
                          setIsAddingMilestone(false);
                        }}
                        className="px-3.5 py-1.5 bg-cream/10 hover:bg-cream/20 text-xs font-semibold rounded-full"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editingMilestone.year || !editingMilestone.title) {
                            alert("Please fill year and title");
                            return;
                          }
                          try {
                            if (isAddingMilestone) {
                              const res = await api.post("/admin/milestones", editingMilestone);
                              if (res.success) {
                                showToast("Academy milestone added!");
                                fetchAbout();
                              }
                            } else {
                              const res = await api.put(`/admin/milestones/${editingMilestone._id || editingMilestone.id}`, editingMilestone);
                              if (res.success) {
                                showToast("Milestone updated!");
                                fetchAbout();
                              }
                            }
                          } catch (err: any) {
                            alert(err.message || "Failed to save milestone");
                          }
                          setEditingMilestone(null);
                          setIsAddingMilestone(false);
                        }}
                        className="px-3.5 py-1.5 bg-lime text-plum-dark text-xs font-bold rounded-full"
                      >
                        Save Milestone
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-cream/5 mt-3">
                    {milestones.map((m) => (
                      <div key={m._id || m.id} className="py-3 flex justify-between gap-4 items-start group">
                        <div className="flex gap-4">
                          <span className="font-mono text-lime font-bold text-sm bg-cream/5 rounded px-2.5 py-1 h-fit shrink-0">{m.year}</span>
                          <div>
                            <h5 className="font-semibold text-sm text-cream">{m.title}</h5>
                            <p className="text-xs text-cream/60 mt-1">{m.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingMilestone(m)}
                            className="p-1 hover:bg-cream/10 rounded text-cream"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm("Delete this milestone?")) {
                                try {
                                  const res = await api.delete(`/admin/milestones/${m._id || m.id}`);
                                  if (res.success) {
                                    showToast("Milestone deleted");
                                    fetchAbout();
                                  }
                                } catch (err: any) {
                                  alert(err.message || "Failed to delete milestone");
                                }
                              }
                            }}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DarkCard>
            </div>
          )}

          {/* 4. FACULTY SETTINGS */}
          {activeTab === "Faculty" && (
            <DarkCard>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-display font-bold text-lg">Faculty & Clinicians</h3>
                  <p className="text-xs text-cream/60 mt-1">Manage public profile cards for teaching doctors and nurses</p>
                </div>
                {!editingFaculty && !isAddingFaculty && (
                  <button
                    onClick={() => {
                      setIsAddingFaculty(true);
                      setEditingFaculty({ name: "", role: "", specialty: "", years: 10, rating: 4.8, initials: "" });
                      setFacultyPhotoFile(null);
                      setFacultyPhotoPreview(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Faculty
                  </button>
                )}
              </div>

              {(editingFaculty || isAddingFaculty) ? (
                <div className="space-y-4 border-t border-cream/10 pt-4">
                  <h4 className="font-semibold text-sm text-lime">{isAddingFaculty ? "Register New Faculty" : "Edit Faculty credentials"}</h4>
                  
                  {/* ── Photo picker ── */}
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      <div className="h-24 w-24 overflow-hidden rounded-2xl bg-cream/5 border-2 border-dashed border-cream/10 grid place-items-center">
                        {facultyPhotoPreview ? (
                          <img src={facultyPhotoPreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : editingFaculty?.image ? (
                          <img src={getAssetUrl(editingFaculty.image)} alt="Current" className="h-full w-full object-cover" />
                        ) : (
                          <Users className="h-8 w-8 text-cream/10" />
                        )}
                      </div>
                      {(facultyPhotoPreview || editingFaculty?.image) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFacultyPhotoFile(null);
                            setFacultyPhotoPreview(null);
                            setEditingFaculty((f: any) => ({ ...f, removeImage: true }));
                            if (facultyPhotoRef.current) facultyPhotoRef.current.value = "";
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
                        onClick={() => facultyPhotoRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full bg-cream/10 hover:bg-cream/20 text-cream border border-cream/10 px-4 py-2 text-xs font-bold transition-colors"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {facultyPhotoPreview || editingFaculty?.image ? "Change Photo" : "Upload Photo"}
                      </button>
                      <p className="text-[10px] text-cream/30 uppercase tracking-[0.15em]">JPG, PNG or WebP · Max 2MB</p>
                      <input
                        ref={facultyPhotoRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setFacultyPhotoFile(file);
                            setFacultyPhotoPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Email (for login)</label>
                      <input
                        type="email"
                        value={editingFaculty.email}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, email: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="e.g. dr.anita@axon.academy"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Password (for login)</label>
                      <input
                        type="text"
                        value={editingFaculty.password}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, password: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="Set a password for faculty login"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Full Name</label>
                      <input
                        type="text"
                        value={editingFaculty.name}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, name: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="e.g. Dr. Anita Sharma"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Initials (For Avatar)</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={editingFaculty.initials}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, initials: e.target.value.toUpperCase() })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="e.g. AS"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Role Title</label>
                      <input
                        type="text"
                        value={editingFaculty.role}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, role: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="e.g. Chief Cardiologist"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Specialty</label>
                      <input
                        type="text"
                        value={editingFaculty.specialty}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, specialty: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="e.g. Cardiac Care"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Years of Experience</label>
                      <input
                        type="number"
                        value={editingFaculty.years}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, years: parseInt(e.target.value) || 0 })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Rating score</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        value={editingFaculty.rating}
                        onChange={(e) => setEditingFaculty({ ...editingFaculty, rating: parseFloat(e.target.value) || 5.0 })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFaculty(null);
                        setIsAddingFaculty(false);
                        setFacultyPhotoFile(null);
                        setFacultyPhotoPreview(null);
                        if (facultyPhotoRef.current) facultyPhotoRef.current.value = "";
                      }}
                      className="px-4 py-2 bg-cream/10 hover:bg-cream/20 text-xs font-semibold rounded-full"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editingFaculty.name || !editingFaculty.role) {
                          alert("Please fill name and role");
                          return;
                        }
                        try {
                          const fd = new FormData();
                          fd.append("name", editingFaculty.name);
                          fd.append("role", editingFaculty.role);
                          fd.append("specialty", editingFaculty.specialty || "");
                          fd.append("years", String(editingFaculty.years || 0));
                          fd.append("rating", String(editingFaculty.rating || 5.0));
                          fd.append("initials", editingFaculty.initials || "");
                          if (editingFaculty.email) fd.append("email", editingFaculty.email);
                          if (editingFaculty.password) fd.append("password", editingFaculty.password);
                          if (facultyPhotoFile) {
                            fd.append("image", facultyPhotoFile);
                          } else if (editingFaculty.removeImage) {
                            fd.append("removeImage", "true");
                          }

                          if (isAddingFaculty) {
                            const res = await api.multipart("/admin/faculty", "POST", fd);
                            if (res.success) {
                              showToast("New faculty profile created!");
                              fetchFaculty();
                            }
                          } else {
                            const res = await api.multipart(`/admin/faculty/${editingFaculty._id || editingFaculty.id}`, "PUT", fd);
                            if (res.success) {
                              showToast("Faculty profile updated successfully!");
                              fetchFaculty();
                            }
                          }
                          setEditingFaculty(null);
                          setIsAddingFaculty(false);
                          setFacultyPhotoFile(null);
                          setFacultyPhotoPreview(null);
                          if (facultyPhotoRef.current) facultyPhotoRef.current.value = "";
                        } catch (err: any) {
                          alert(err.message || "Operation failed");
                        }
                      }}
                      className="px-4 py-2 bg-lime text-plum-dark text-xs font-bold rounded-full"
                    >
                      Save Faculty Profile
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {isLoadingFaculty ? (
                    <div className="col-span-2 text-center py-6 text-sm text-cream/50">Loading faculty members...</div>
                  ) : facultyList.length === 0 ? (
                    <div className="col-span-2 text-center py-6 text-sm text-cream/50">No faculty members found.</div>
                  ) : (
                    facultyList.map(f => (
                      <div key={f._id || f.id} className="flex gap-4 p-4 rounded-2xl bg-cream/5 border border-cream/10 relative group">
                        <div className="w-12 h-12 bg-lime text-plum-dark rounded-xl overflow-hidden flex items-center justify-center font-display font-bold text-base shrink-0">
                          {f.image ? (
                            <img src={getAssetUrl(f.image)} alt={f.name} className="h-full w-full object-cover" />
                          ) : (
                            f.initials || f.name.charAt(0)
                          )}
                        </div>
                        <div className="space-y-1 pr-16">
                          <h4 className="font-semibold text-sm text-cream">{f.name}</h4>
                          <div className="text-xs text-cream/70 font-medium">{f.role}</div>
                          <div className="text-[10px] text-cream/55 flex items-center gap-3">
                            <span>{f.specialty}</span>
                            <span>·</span>
                            <span>{f.years} yrs exp</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-0.5 text-lime"><Star className="h-3 w-3 fill-lime" /> {f.rating}</span>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingFaculty(f);
                              setFacultyPhotoFile(null);
                              setFacultyPhotoPreview(null);
                            }}
                            className="p-1 hover:bg-cream/10 rounded text-cream/80"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Remove ${f.name} from faculty?`)) {
                                try {
                                  const res = await api.delete(`/admin/faculty/${f._id || f.id}`);
                                  if (res.success) {
                                    showToast("Faculty profile removed");
                                    fetchFaculty();
                                  }
                                } catch (err: any) {
                                  alert(err.message || "Failed to remove faculty member");
                                }
                              }
                            }}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </DarkCard>
          )}

          {/* 5. PLACEMENT & RECRUITER SETTINGS */}
          {activeTab === "Placement" && (
            <div className="space-y-6">

              {/* Partner Hospitals */}
              <DarkCard>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-display font-bold text-base">Partner hospital networks</h3>
                    <p className="text-xs text-cream/60 mt-0.5">Recruiting medical networks appearing on the site</p>
                  </div>
                  <Building2 className="text-lime w-5 h-5 opacity-70" />
                </div>

                <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-xl bg-cream/5 border border-cream/10">
                  {hospitalPartners.map(h => (
                    <span key={h._id || h.name} className="inline-flex items-center gap-1.5 px-3 py-1 bg-plum-dark border border-cream/15 text-cream rounded-full text-xs font-semibold">
                      {h.name}
                      <button
                        onClick={async () => {
                          if (h._id) {
                            try {
                              await api.delete(`/admin/placements/partners/${h._id}`);
                              showToast("Partner hospital removed");
                              fetchPlacement();
                            } catch (err: any) {
                              alert(err.message || "Failed to remove partner");
                            }
                          } else {
                            setHospitalPartners(hospitalPartners.filter(x => x.name !== h.name));
                            showToast("Partner hospital removed");
                          }
                        }}
                        className="text-cream/50 hover:text-red-400 font-bold ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 max-w-sm">
                  <input
                    type="text"
                    placeholder="e.g. Columbia Asia"
                    value={newHospital}
                    onChange={(e) => setNewHospital(e.target.value)}
                    className="flex-1 bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-lime"
                  />
                  <button
                    onClick={async () => {
                      if (!newHospital.trim()) return;
                      if (hospitalPartners.some(x => x.name.toLowerCase() === newHospital.trim().toLowerCase())) {
                        alert("Hospital already added");
                        return;
                      }
                      try {
                        const res = await api.post("/admin/placements/partners", { name: newHospital.trim() });
                        if (res.success) {
                          showToast("Hospital partner listed!");
                          setNewHospital("");
                          fetchPlacement();
                        }
                      } catch (err: any) {
                        alert(err.message || "Failed to add partner");
                      }
                    }}
                    className="inline-flex items-center gap-1 bg-lime text-plum-dark px-3 py-2 text-xs font-bold rounded-xl"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </DarkCard>

              {/* Placement success stories */}
              <DarkCard>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-display font-bold text-lg">Placement success stories</h3>
                    <p className="text-xs text-cream/60 mt-1">Manage testimonials and placements of recent graduates</p>
                  </div>
                  {!editingStory && !isAddingStory && (
                    <button
                      onClick={() => {
                        setIsAddingStory(true);
                        setEditingStory({ name: "", role: "", hospital: "", salary: "", city: "" });
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full bg-lime text-plum-dark px-3.5 py-1.5 text-xs font-bold"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Story
                    </button>
                  )}
                </div>

                {(editingStory || isAddingStory) ? (
                  <div className="space-y-4 border-t border-cream/10 pt-4">
                    <h4 className="font-semibold text-xs text-lime">{isAddingStory ? "Add Placement Story" : "Edit Story"}</h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-cream/60">Graduate Name</label>
                        <input
                          type="text"
                          value={editingStory.name}
                          onChange={(e) => setEditingStory({ ...editingStory, name: e.target.value })}
                          className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime"
                          placeholder="e.g. Priya Krishnan"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-cream/60">Placed Role</label>
                        <input
                          type="text"
                          value={editingStory.role}
                          onChange={(e) => setEditingStory({ ...editingStory, role: e.target.value })}
                          className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime"
                          placeholder="e.g. Staff Nurse"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-cream/60">Hospital Recruiter</label>
                        <input
                          type="text"
                          value={editingStory.hospital}
                          onChange={(e) => setEditingStory({ ...editingStory, hospital: e.target.value })}
                          className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime"
                          placeholder="e.g. Apollo Hospitals"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-cream/60">Package (Per Year)</label>
                        <input
                          type="text"
                          value={editingStory.salary}
                          onChange={(e) => setEditingStory({ ...editingStory, salary: e.target.value })}
                          className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime"
                          placeholder="e.g. ₹3.6L"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest text-cream/60">City</label>
                        <input
                          type="text"
                          value={editingStory.city}
                          onChange={(e) => setEditingStory({ ...editingStory, city: e.target.value })}
                          className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-lime"
                          placeholder="e.g. Bengaluru"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2.5 mt-5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStory(null);
                          setIsAddingStory(false);
                        }}
                        className="px-4 py-1.5 bg-cream/10 hover:bg-cream/20 text-xs font-semibold rounded-full"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!editingStory.name || !editingStory.hospital) {
                            alert("Please fill name and hospital");
                            return;
                          }
                          try {
                            if (isAddingStory) {
                              const res = await api.post("/admin/placements/stories", editingStory);
                              if (res.success) {
                                showToast("New success story added!");
                                fetchPlacement();
                              }
                            } else {
                              const res = await api.put(`/admin/placements/stories/${editingStory._id || editingStory.id}`, editingStory);
                              if (res.success) {
                                showToast("Success story updated!");
                                fetchPlacement();
                              }
                            }
                          } catch (err: any) {
                            alert(err.message || "Failed to save story");
                          }
                          setEditingStory(null);
                          setIsAddingStory(false);
                        }}
                        className="px-4 py-1.5 bg-lime text-plum-dark text-xs font-bold rounded-full"
                      >
                        Save Story
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-cream/10 text-cream/60 uppercase font-semibold">
                          <th className="pb-3">Graduate</th>
                          <th className="pb-3">Role</th>
                          <th className="pb-3">Hospital</th>
                          <th className="pb-3">City</th>
                          <th className="pb-3 text-right">Salary</th>
                          <th className="pb-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cream/5">
                        {stories.map(story => (
                          <tr key={story._id || story.id} className="group hover:bg-cream/[0.02]">
                            <td className="py-2.5 font-medium text-cream">{story.name}</td>
                            <td className="py-2.5 text-cream/70">{story.role}</td>
                            <td className="py-2.5 text-cream/70 font-semibold">{story.hospital}</td>
                            <td className="py-2.5 text-cream/60">{story.city}</td>
                            <td className="py-2.5 text-right font-mono font-bold text-lime">{story.salary}</td>
                            <td className="py-2.5 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setEditingStory(story)}
                                  className="p-1 hover:bg-cream/10 rounded text-cream"
                                >
                                  <Edit2 className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={async () => {
                                    if (confirm("Delete this story?")) {
                                      try {
                                        const res = await api.delete(`/admin/placements/stories/${story._id || story.id}`);
                                        if (res.success) {
                                          showToast("Placement story removed");
                                          fetchPlacement();
                                        }
                                      } catch (err: any) {
                                        alert(err.message || "Failed to remove story");
                                      }
                                    }
                                  }}
                                  className="p-1 hover:bg-red-500/20 rounded text-red-400"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DarkCard>
            </div>
          )}

          {/* 6. BLOG POST CONFIGURATIONS */}
          {activeTab === "Blog" && (
            <DarkCard>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-display font-bold text-lg">Site Journal / Blog</h3>
                  <p className="text-xs text-cream/60 mt-1">Manage featured posts, clinical trends, and study plans</p>
                </div>
                {!editingPost && !isAddingPost && (
                  <button
                    onClick={() => {
                      setIsAddingPost(true);
                      setEditingPost({ title: "", category: "Career", date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }), readTime: "5 min", excerpt: "", featured: false });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" /> New Article
                  </button>
                )}
              </div>

              {(editingPost || isAddingPost) ? (
                <div className="space-y-4 border-t border-cream/10 pt-4">
                  <h4 className="font-semibold text-sm text-lime">{isAddingPost ? "Compose Article" : "Edit Article summary"}</h4>

                  {/* ── Image picker ── */}
                  <div className="flex items-center gap-5">
                    <div className="relative shrink-0">
                      <div className="h-24 w-40 overflow-hidden rounded-2xl bg-cream/5 border-2 border-dashed border-cream/10 grid place-items-center">
                        {blogImagePreview ? (
                          <img src={blogImagePreview} alt="Preview" className="h-full w-full object-cover" />
                        ) : editingPost?.image ? (
                          <img src={getAssetUrl(editingPost.image)} alt="Current" className="h-full w-full object-cover" />
                        ) : (
                          <FileText className="h-8 w-8 text-cream/10" />
                        )}
                      </div>
                      {(blogImagePreview || editingPost?.image) && (
                        <button
                          type="button"
                          onClick={() => {
                            setBlogImageFile(null);
                            setBlogImagePreview(null);
                            setEditingPost((f: any) => ({ ...f, image: null, removeImage: true }));
                            if (blogImageRef.current) blogImageRef.current.value = "";
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
                        onClick={() => blogImageRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full bg-cream/10 hover:bg-cream/20 text-cream border border-cream/10 px-4 py-2 text-xs font-bold transition-colors"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {blogImagePreview || editingPost?.image ? "Change Image" : "Upload Image"}
                      </button>
                      <p className="text-[10px] text-cream/30 uppercase tracking-[0.15em]">JPG, PNG or WebP · Max 2MB</p>
                      <input
                        ref={blogImageRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setBlogImageFile(file);
                            setBlogImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Article Title</label>
                      <input
                        type="text"
                        value={editingPost.title}
                        onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="e.g. Salary benchmarks for paramedical roles"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Category</label>
                      <select
                        value={editingPost.category}
                        onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                        className="mt-1.5 w-full bg-plum-dark text-cream border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                      >
                        {["Career", "Clinical", "Exam Prep", "Stories"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Read Time (minutes)</label>
                      <input
                        type="text"
                        value={editingPost.readTime}
                        onChange={(e) => setEditingPost({ ...editingPost, readTime: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                        placeholder="e.g. 6 min"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-cream/60">Publish Date</label>
                      <input
                        type="text"
                        value={editingPost.date}
                        onChange={(e) => setEditingPost({ ...editingPost, date: e.target.value })}
                        className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <input
                        type="checkbox"
                        id="featured"
                        checked={editingPost.featured}
                        onChange={(e) => setEditingPost({ ...editingPost, featured: e.target.checked })}
                        className="h-4 w-4 rounded border-cream/20 bg-cream/5 accent-lime text-plum-dark"
                      />
                      <label htmlFor="featured" className="text-xs font-semibold text-cream cursor-pointer select-none">
                        Pin to Featured Hero Banner
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60">Excerpt description</label>
                    <textarea
                      value={editingPost.excerpt}
                      onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                      className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-lime min-h-[90px]"
                      placeholder="Brief excerpt summing up article..."
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 mt-5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPost(null);
                        setIsAddingPost(false);
                        setBlogImageFile(null);
                        setBlogImagePreview(null);
                        if (blogImageRef.current) blogImageRef.current.value = "";
                      }}
                      className="px-4 py-2 bg-cream/10 hover:bg-cream/20 text-xs font-semibold rounded-full"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editingPost.title || !editingPost.excerpt) {
                          alert("Please fill title and excerpt content");
                          return;
                        }
                        try {
                          const fd = new FormData();
                          fd.append("title", editingPost.title);
                          fd.append("category", editingPost.category || "Career");
                          fd.append("date", editingPost.date || "");
                          fd.append("readTime", editingPost.readTime || "5 min");
                          fd.append("excerpt", editingPost.excerpt);
                          fd.append("featured", editingPost.featured ? "true" : "false");
                          if (blogImageFile) {
                            fd.append("image", blogImageFile);
                          } else if (editingPost.removeImage) {
                            fd.append("removeImage", "true");
                          }

                          if (isAddingPost) {
                            const res = await api.multipart("/admin/blogs", "POST", fd);
                            if (res.success) {
                              showToast("New blog post published!");
                              fetchBlog();
                            }
                          } else {
                            const res = await api.multipart(`/admin/blogs/${editingPost._id || editingPost.id}`, "PUT", fd);
                            if (res.success) {
                              showToast("Blog post saved!");
                              fetchBlog();
                            }
                          }
                        } catch (err: any) {
                          alert(err.message || "Failed to publish article");
                        }
                        setEditingPost(null);
                        setIsAddingPost(false);
                        setBlogImageFile(null);
                        setBlogImagePreview(null);
                        if (blogImageRef.current) blogImageRef.current.value = "";
                      }}
                      className="px-4 py-2 bg-lime text-plum-dark text-xs font-bold rounded-full"
                    >
                      Publish Article
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-cream/5">
                  {blogPosts.map(post => (
                    <div key={post._id || post.id} className="py-4 flex items-start justify-between gap-4 group">
                      <div className="flex gap-3">
                        {post.image && (
                          <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-cream/5">
                            <img src={getAssetUrl(post.image)} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-lime bg-lime/10 px-2 py-0.5 rounded">
                              {post.category}
                            </span>
                            {post.featured && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-plum-dark bg-lime px-2 py-0.5 rounded">
                                Featured
                              </span>
                            )}
                            <span className="text-[10px] text-cream/55 font-mono">{post.date} · {post.readTime} read</span>
                          </div>
                          <h4 className="font-semibold text-sm text-cream">{post.title}</h4>
                          <p className="text-xs text-cream/60 line-clamp-1">{post.excerpt}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingPost(post);
                            setBlogImageFile(null);
                            setBlogImagePreview(null);
                          }}
                          className="p-1 hover:bg-cream/10 rounded text-cream"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm("Delete this blog post?")) {
                              try {
                                const res = await api.delete(`/admin/blogs/${post._id || post.id}`);
                                if (res.success) {
                                  showToast("Blog post deleted");
                                  fetchBlog();
                                }
                              } catch (err: any) {
                                alert(err.message || "Failed to delete blog post");
                              }
                            }
                          }}
                          className="p-1 hover:bg-red-500/20 rounded text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DarkCard>
          )}

         
          {/* 7. VOICES & REVIEWS */}
          {activeTab === "Voices" && (
            <div className="space-y-6">
              {/* Sub-navigation */}
              <div className="flex gap-2 border-b border-cream/10 pb-1">
                {(["Reviews", "Videos"] as const).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setVoicesSubTab(sub)}
                    className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                      voicesSubTab === sub
                        ? "bg-lime text-plum-dark"
                        : "text-cream/60 hover:text-cream"
                    }`}
                  >
                    {sub === "Reviews" ? "Student Reviews" : "Review Videos"}
                  </button>
                ))}
              </div>

              {/* --- REVIEWS SUB-TAB --- */}
              {voicesSubTab === "Reviews" && (
                <DarkCard>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-display font-bold text-lg">Student Reviews</h3>
                      <p className="text-xs text-cream/60 mt-1">Manage testimonials shown on the home page Voices section</p>
                    </div>
                    {!editingTestimonial && !isAddingTestimonial && (
                      <button
                        onClick={() => {
                          setIsAddingTestimonial(true);
                          setEditingTestimonial({ name: "", roll: "", review: "" });
                          setTestimonialImageFile(null);
                          setTestimonialImagePreview(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Review
                      </button>
                    )}
                  </div>

                  {(editingTestimonial || isAddingTestimonial) ? (
                    <div className="space-y-4 border-t border-cream/10 pt-4">
                      <h4 className="font-semibold text-sm text-lime">{isAddingTestimonial ? "Add Student Review" : "Edit Student Review"}</h4>

                      {/* Image picker */}
                      <div className="flex items-center gap-5">
                        <div className="relative shrink-0">
                          <div className="h-20 w-20 overflow-hidden rounded-2xl bg-cream/5 border-2 border-dashed border-cream/10 grid place-items-center">
                            {testimonialImagePreview ? (
                              <img src={testimonialImagePreview} alt="Preview" className="h-full w-full object-cover" />
                            ) : editingTestimonial?.image ? (
                              <img src={editingTestimonial.image} alt="Current" className="h-full w-full object-cover" />
                            ) : (
                              <Users className="h-7 w-7 text-cream/10" />
                            )}
                          </div>
                          {(testimonialImagePreview || editingTestimonial?.image) && (
                            <button
                              type="button"
                              onClick={() => {
                                setTestimonialImageFile(null);
                                setTestimonialImagePreview(null);
                                setEditingTestimonial((t: any) => ({ ...t, image: null, removeImage: true }));
                                if (testimonialImageRef.current) testimonialImageRef.current.value = "";
                              }}
                              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white grid place-items-center"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => testimonialImageRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-full bg-cream/10 hover:bg-cream/20 text-cream border border-cream/10 px-3 py-1.5 text-xs font-bold"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {testimonialImagePreview || editingTestimonial?.image ? "Change Photo" : "Upload Photo"}
                          </button>
                          <p className="text-[10px] text-cream/30 uppercase tracking-[0.15em]">JPG, PNG or WebP · Max 2MB</p>
                          <input
                            ref={testimonialImageRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setTestimonialImageFile(file);
                                setTestimonialImagePreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-cream/60">Student Name</label>
                          <input
                            type="text"
                            value={editingTestimonial.name}
                            onChange={(e) => setEditingTestimonial({ ...editingTestimonial, name: e.target.value })}
                            className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                            placeholder="e.g. Priya Krishnan"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-cream/60">Roll / Current Role</label>
                          <input
                            type="text"
                            value={editingTestimonial.roll}
                            onChange={(e) => setEditingTestimonial({ ...editingTestimonial, roll: e.target.value })}
                            className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                            placeholder="e.g. Staff Nurse · Apollo Hospitals"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-cream/60">Review Text</label>
                          <textarea
                            value={editingTestimonial.review}
                            onChange={(e) => setEditingTestimonial({ ...editingTestimonial, review: e.target.value })}
                            className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-lime min-h-[80px]"
                            placeholder="What the student said about the academy..."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2.5 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTestimonial(null);
                            setIsAddingTestimonial(false);
                            setTestimonialImageFile(null);
                            setTestimonialImagePreview(null);
                            if (testimonialImageRef.current) testimonialImageRef.current.value = "";
                          }}
                          className="px-4 py-2 bg-cream/10 hover:bg-cream/20 text-xs font-semibold rounded-full"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!editingTestimonial.name || !editingTestimonial.roll || !editingTestimonial.review) {
                              alert("Please fill name, roll, and review");
                              return;
                            }
                            try {
                              const fd = new FormData();
                              fd.append("name", editingTestimonial.name);
                              fd.append("roll", editingTestimonial.roll);
                              fd.append("review", editingTestimonial.review);
                              if (testimonialImageFile) {
                                fd.append("image", testimonialImageFile);
                              } else if (editingTestimonial.removeImage) {
                                fd.append("removeImage", "true");
                              }

                              if (isAddingTestimonial) {
                                const res = await api.multipart("/admin/testimonials", "POST", fd);
                                if (res.success) {
                                  showToast("Student review added!");
                                  fetchTestimonials();
                                }
                              } else {
                                const res = await api.multipart(`/admin/testimonials/${editingTestimonial._id || editingTestimonial.id}`, "PUT", fd);
                                if (res.success) {
                                  showToast("Student review updated!");
                                  fetchTestimonials();
                                }
                              }
                              setEditingTestimonial(null);
                              setIsAddingTestimonial(false);
                              setTestimonialImageFile(null);
                              setTestimonialImagePreview(null);
                              if (testimonialImageRef.current) testimonialImageRef.current.value = "";
                            } catch (err: any) {
                              alert(err.message || "Failed to save review");
                            }
                          }}
                          className="px-4 py-2 bg-lime text-plum-dark text-xs font-bold rounded-full"
                        >
                          Save Review
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {isLoadingTestimonials ? (
                        <div className="col-span-2 text-center py-8 text-sm text-cream/50">Loading reviews...</div>
                      ) : testimonials.length === 0 ? (
                        <div className="col-span-2 text-center py-8 text-sm text-cream/50">No student reviews yet. Add your first review!</div>
                      ) : (
                        testimonials.map((t) => (
                          <div key={t._id || t.id} className="flex gap-3 p-4 rounded-2xl bg-cream/5 border border-cream/10 relative group">
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center bg-plum-dark shrink-0 border border-cream/10">
                              {t.image ? (
                                <img src={t.image} alt={t.name} className="h-full w-full object-cover" />
                              ) : (
                                <span className="font-display font-bold text-lime text-base">{t.name.charAt(0)}</span>
                              )}
                            </div>
                            <div className="space-y-1 pr-14">
                              <h4 className="font-semibold text-sm text-cream">{t.name}</h4>
                              <div className="text-[11px] text-lime font-medium">{t.roll}</div>
                              <p className="text-xs text-cream/60 line-clamp-2">"{t.review}"</p>
                            </div>
                            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingTestimonial(t);
                                  setTestimonialImageFile(null);
                                  setTestimonialImagePreview(null);
                                }}
                                className="p-1 hover:bg-cream/10 rounded text-cream/80"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete review by ${t.name}?`)) {
                                    try {
                                      const res = await api.delete(`/admin/testimonials/${t._id || t.id}`);
                                      if (res.success) {
                                        showToast("Review deleted");
                                        fetchTestimonials();
                                      }
                                    } catch (err: any) {
                                      alert(err.message || "Failed to delete review");
                                    }
                                  }
                                }}
                                className="p-1 hover:bg-red-500/20 rounded text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </DarkCard>
              )}

              {/* --- REVIEW VIDEOS SUB-TAB --- */}
              {voicesSubTab === "Videos" && (
                <DarkCard>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-display font-bold text-lg">Review Videos</h3>
                      <p className="text-xs text-cream/60 mt-1">Upload student video testimonials to Cloudflare R2</p>
                    </div>
                    {!editingVideo && !isAddingVideo && (
                      <button
                        onClick={() => {
                          setIsAddingVideo(true);
                          setEditingVideo({ title: "", studentName: "", roll: "" });
                          setVideoFile(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full bg-lime text-plum-dark px-4 py-2 text-xs font-bold"
                      >
                        <Plus className="h-3.5 w-3.5" /> Upload Video
                      </button>
                    )}
                  </div>

                  {(editingVideo || isAddingVideo) ? (
                    <div className="space-y-4 border-t border-cream/10 pt-4">
                      <h4 className="font-semibold text-sm text-lime">{isAddingVideo ? "Upload New Review Video" : "Edit Video Details"}</h4>

                      {isAddingVideo && (
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-cream/60">Video File (MP4 / MOV / WebM)</label>
                          <div
                            onClick={() => videoFileRef.current?.click()}
                            className="mt-1.5 cursor-pointer flex flex-col items-center justify-center gap-2 h-28 rounded-2xl bg-cream/5 border-2 border-dashed border-cream/10 hover:border-lime/50 transition-colors"
                          >
                            {videoFile ? (
                              <div className="text-center">
                                <Check className="h-6 w-6 text-lime mx-auto mb-1" />
                                <span className="text-xs font-semibold text-lime">{videoFile.name}</span>
                                <p className="text-[10px] text-cream/40 mt-0.5">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                              </div>
                            ) : (
                              <>
                                <Upload className="h-6 w-6 text-cream/20" />
                                <span className="text-xs text-cream/40">Click to select a video file</span>
                              </>
                            )}
                          </div>
                          <input
                            ref={videoFileRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setVideoFile(file);
                            }}
                          />
                        </div>
                      )}

                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-3">
                          <label className="text-[10px] uppercase tracking-widest text-cream/60">Video Title</label>
                          <input
                            type="text"
                            value={editingVideo.title}
                            onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                            className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                            placeholder="e.g. My journey from student to staff nurse"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest text-cream/60">Student Name</label>
                          <input
                            type="text"
                            value={editingVideo.studentName}
                            onChange={(e) => setEditingVideo({ ...editingVideo, studentName: e.target.value })}
                            className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                            placeholder="e.g. Priya Krishnan"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] uppercase tracking-widest text-cream/60">Roll / Current Role</label>
                          <input
                            type="text"
                            value={editingVideo.roll}
                            onChange={(e) => setEditingVideo({ ...editingVideo, roll: e.target.value })}
                            className="mt-1.5 w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-lime"
                            placeholder="e.g. Staff Nurse · Apollo Hospitals"
                          />
                        </div>
                      </div>

                      {isUploadingVideo && (
                        <div className="rounded-xl bg-lime/10 border border-lime/20 px-4 py-3 text-xs font-semibold text-lime flex items-center gap-2">
                          <span className="animate-spin inline-block h-3 w-3 border-2 border-lime border-t-transparent rounded-full" />
                          Uploading video to Cloudflare R2… this may take a moment.
                        </div>
                      )}

                      <div className="flex justify-end gap-2.5 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVideo(null);
                            setIsAddingVideo(false);
                            setVideoFile(null);
                            if (videoFileRef.current) videoFileRef.current.value = "";
                          }}
                          className="px-4 py-2 bg-cream/10 hover:bg-cream/20 text-xs font-semibold rounded-full"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isUploadingVideo}
                          onClick={async () => {
                            if (!editingVideo.title) { alert("Please fill the video title"); return; }
                            if (isAddingVideo && !videoFile) { alert("Please select a video file"); return; }
                            try {
                              if (isAddingVideo) {
                                setIsUploadingVideo(true);
                                const fd = new FormData();
                                fd.append("title", editingVideo.title);
                                fd.append("studentName", editingVideo.studentName || "");
                                fd.append("roll", editingVideo.roll || "");
                                fd.append("video", videoFile!);
                                const res = await api.multipart("/admin/review-videos", "POST", fd);
                                if (res.success) {
                                  showToast("Review video uploaded to Cloudflare R2!");
                                  fetchReviewVideos();
                                }
                              } else {
                                const res = await api.put(`/admin/review-videos/${editingVideo._id || editingVideo.id}`, {
                                  title: editingVideo.title,
                                  studentName: editingVideo.studentName,
                                  roll: editingVideo.roll,
                                });
                                if (res.success) {
                                  showToast("Video details updated!");
                                  fetchReviewVideos();
                                }
                              }
                              setEditingVideo(null);
                              setIsAddingVideo(false);
                              setVideoFile(null);
                              if (videoFileRef.current) videoFileRef.current.value = "";
                            } catch (err: any) {
                              alert(err.message || "Failed to save video");
                            } finally {
                              setIsUploadingVideo(false);
                            }
                          }}
                          className="px-4 py-2 bg-lime text-plum-dark text-xs font-bold rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAddingVideo ? (isUploadingVideo ? "Uploading..." : "Upload to R2") : "Save Details"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 divide-y divide-cream/5">
                      {isLoadingVideos ? (
                        <div className="text-center py-8 text-sm text-cream/50">Loading review videos...</div>
                      ) : reviewVideos.length === 0 ? (
                        <div className="text-center py-8 text-sm text-cream/50">No review videos yet. Upload your first video!</div>
                      ) : (
                        reviewVideos.map((v) => (
                          <div key={v._id || v.id} className="py-3.5 flex items-center justify-between gap-4 group">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="shrink-0 w-10 h-10 rounded-xl bg-plum-dark border border-cream/10 grid place-items-center">
                                <Play className="h-4 w-4 fill-lime text-lime" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-semibold text-sm text-cream truncate">{v.title}</h4>
                                <div className="text-xs text-cream/55 flex items-center gap-1.5">
                                  {v.studentName && <span>{v.studentName}</span>}
                                  {v.studentName && v.roll && <span>·</span>}
                                  {v.roll && <span className="text-lime/80">{v.roll}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setEditingVideo(v)}
                                className="p-1 hover:bg-cream/10 rounded text-cream"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm(`Delete "${v.title}"? This will also remove it from Cloudflare R2.`)) {
                                    try {
                                      const res = await api.delete(`/admin/review-videos/${v._id || v.id}`);
                                      if (res.success) {
                                        showToast("Review video deleted from R2");
                                        fetchReviewVideos();
                                      }
                                    } catch (err: any) {
                                      alert(err.message || "Failed to delete video");
                                    }
                                  }
                                }}
                                className="p-1 hover:bg-red-500/20 rounded text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </DarkCard>
              )}
            </div>
          )}

         
        </div>
      </div>

      
   
    </div>
  );
}
