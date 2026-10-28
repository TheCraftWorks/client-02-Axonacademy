import { createFileRoute } from "@tanstack/react-router";
import React, { useState, Suspense } from "react";
import { LuArrowLeft, LuShare2, LuMegaphone, LuVideo, LuPlay, LuClipboardList, LuUsers, LuUserPlus } from "react-icons/lu";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useClassroomStore,
  classroomActions,
  isClassroomStale,
  markClassroomFresh,
  type Classroom,
} from "@/lib/classroomStore";
import { getClassroomById } from "@/lib/api";

// ─── Lazy-load each tab — browser only downloads the tab you actually click ───
const AnnouncementsTab = React.lazy(() =>
  import("@/components/classroom-tabs/AnnouncementsTab").then((m) => ({ default: m.AnnouncementsTab }))
);
const LiveClassesTab = React.lazy(() =>
  import("@/components/classroom-tabs/LiveClassesTab").then((m) => ({ default: m.LiveClassesTab }))
);
const RecordingsTab = React.lazy(() =>
  import("@/components/classroom-tabs/RecordingsTab").then((m) => ({ default: m.RecordingsTab }))
);
const TestsTab = React.lazy(() =>
  import("@/components/classroom-tabs/TestsTab").then((m) => ({ default: m.TestsTab }))
);
const StudentsTab = React.lazy(() =>
  import("@/components/classroom-tabs/StudentsTab").then((m) => ({ default: m.StudentsTab }))
);
const JoinRequestsTab = React.lazy(() =>
  import("@/components/classroom-tabs/JoinRequestsTab").then((m) => ({ default: m.JoinRequestsTab }))
);

// ─── Route declaration ────────────────────────────────────────────────────────

export const Route = createFileRoute("/_admin/admin/classrooms/$id")({
  component: AdminClassroomDetail,
});

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabKey = "announcements" | "live" | "recordings" | "tests" | "students" | "requests";

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ComponentType<any>;
  bg: string;
  text: string;
  border: string;
  iconColor: string;
}

const TABS: readonly TabConfig[] = [
  { key: "announcements", label: "Announcements", icon: LuMegaphone, bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", border: "border-[#93C5FD]", iconColor: "#2563EB" },
  { key: "live", label: "Live Classes", icon: LuVideo, bg: "bg-[#FFE4E6]", text: "text-[#9F1239]", border: "border-[#FDA4AF]", iconColor: "#E11D48" },
  { key: "recordings", label: "Recordings", icon: LuPlay, bg: "bg-[#FFEDD5]", text: "text-[#9A3412]", border: "border-[#FED7AA]", iconColor: "#EA580C" },
  { key: "tests", label: "Tests", icon: LuClipboardList, bg: "bg-[#E0F2FE]", text: "text-[#075985]", border: "border-[#7DD3FC]", iconColor: "#0284C7" },
  { key: "students", label: "Students", icon: LuUsers, bg: "bg-[#D1FAE5]", text: "text-[#065F46]", border: "border-[#A7F3D0]", iconColor: "#059669" },
  { key: "requests", label: "Join Requests", icon: LuUserPlus, bg: "bg-[#F5F3FF]", text: "text-[#5B21B6]", border: "border-[#DDD6FE]", iconColor: "#7C3AED" },
];

// ─── Skeleton loader (shown only when classroom not yet in cache) ──────────────

function AdminClassroomDetailSkeleton() {
  return (
    <div className="space-y-6 text-cream animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-5 w-5 rounded bg-cream/10 mt-1 shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-64 rounded-lg bg-cream/10" />
            <div className="h-5 w-16 rounded bg-cream/10" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3.5 w-20 rounded bg-cream/5" />
            <div className="h-3.5 w-24 rounded bg-cream/5" />
            <div className="h-3.5 w-28 rounded bg-cream/5" />
          </div>
        </div>
        <div className="h-9 w-28 rounded-full bg-cream/10 shrink-0" />
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3.5 max-w-2xl mx-auto my-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-square rounded-2xl bg-[#1A0F33] border border-cream/10 p-3 flex flex-col items-center justify-center space-y-2.5">
            <div className="h-8 w-8 rounded-lg bg-cream/10" />
            <div className="h-3 w-12 rounded bg-cream/5" />
          </div>
        ))}
      </div>
      <div className="border-t border-cream/10 pt-6 space-y-4">
        <div className="h-28 rounded-2xl bg-[#1A0F33] border border-cream/10" />
        <div className="h-36 rounded-2xl bg-[#1A0F33] border border-cream/10" />
        <div className="h-36 rounded-2xl bg-[#1A0F33] border border-cream/10" />
      </div>
    </div>
  );
}

// ─── Tab content skeleton (shown while lazy chunk downloads) ──────────────────

function TabFallback() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-2xl bg-[#1A0F33] border border-cream/10" />
      <div className="h-20 rounded-2xl bg-[#1A0F33] border border-cream/10" />
      <div className="h-20 rounded-2xl bg-[#1A0F33] border border-cream/10" />
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

function AdminClassroomDetail() {
  const params = (Route.useParams as any)();
  const id = params.id as string;
  const { classrooms, currentUser } = useClassroomStore();

  // Grab cached classroom immediately — no wait
  const storeClassroom = React.useMemo(
    () => classrooms.find((c) => c.id === id) ?? null,
    [classrooms, id]
  );

  const [isLoading, setIsLoading] = useState(!storeClassroom);
  const [isFetching, setIsFetching] = useState(false);
  const [tab, setTab] = useState<TabKey>("announcements");

  const visibleTabs = React.useMemo(() => {
    if (currentUser?.role === "faculty") {
      return TABS.filter((t) => t.key !== "requests");
    }
    return TABS;
  }, [currentUser]);

  React.useEffect(() => {
    if (currentUser?.role === "faculty" && tab === "requests") {
      setTab("announcements");
    }
  }, [currentUser, tab]);

  // Scroll to top when classroom or tab changes
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [id, tab]);

  const refreshClassroom = React.useCallback(async () => {
    setIsFetching(true);
    try {
      const refreshed = await getClassroomById(id, true);
      classroomActions.addClassroom(refreshed);
      markClassroomFresh(id);
      return refreshed;
    } finally {
      setIsFetching(false);
    }
  }, [id]);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!storeClassroom) setIsLoading(true);
        if (isClassroomStale(id) || !storeClassroom) {
          setIsFetching(true);
          await refreshClassroom();
        }
      } catch (err) {
        if (active && !storeClassroom) {
          toast.error(err instanceof Error ? err.message : "Could not load classroom by id");
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsFetching(false);
        }
      }
    };
    load();
    return () => { active = false; };
  }, [id, refreshClassroom]);

  const classroom = React.useMemo(() => storeClassroom, [storeClassroom]);

  if (isLoading && !classroom) return <AdminClassroomDetailSkeleton />;

  if (!classroom) {
    return (
      <div className="text-cream text-center py-20">
        <p className="text-cream/60">Classroom not found.</p>
        <Link to="/admin/classrooms" className="mt-4 text-lime block">← Back to Classrooms</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-cream">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/admin/classrooms" className="text-cream/60 hover:text-cream mt-1 shrink-0">
          <LuArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold">{classroom.name}</h1>
            <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${classroom.status === "active" ? "bg-lime/20 text-lime" : "bg-cream/10 text-cream/60"}`}>
              {classroom.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="font-mono text-[11px] text-cream/50">{classroom.code}</span>
            <span className="text-cream/60 text-xs">·</span>
            <span className="text-cream/60 text-xs">{(classroom.students || []).filter((s) => s.status === "active").length} / {classroom.maxStudents} students</span>
            <span className="text-cream/60 text-xs">·</span>
            <span className="text-cream/60 text-xs">{classroom.program}</span>
            {classroom.instructors && classroom.instructors.length > 0 && (
              <>
                <span className="text-cream/60 text-xs">·</span>
                <span className="text-cream/60 text-xs font-semibold text-lime/80">Faculty: {classroom.instructors.map(i => i.name).join(", ")}</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            const teacherName = classroom.instructors?.[0]?.name || "Axon Med Academy";
            const inviteMsg = `Your teacher, ${teacherName}, has invited you to join classroom ${classroom.name}.\n\nClassroom ID: ${classroom.code}\nClass Name: ${classroom.name}\nSubject Name: ${classroom.program}\n\nJoin now using the link below or the classroom ID above on Axon Med Academy App to never miss any classwork! 📚🤓\nEnjoy your learning through practice bits, quizzes, classwork & much more!\n\n\nTap the link below to join:\n${window.location.origin}/classroom-join/${classroom.id}`;
            navigator.clipboard.writeText(inviteMsg);
            toast.success('Share invite copied to clipboard!');
          }}
          className="inline-flex items-center gap-2 rounded-full bg-lime/20 text-lime px-4 py-2 text-sm font-bold hover:bg-lime/30 transition-colors"
        >
          <LuShare2 className="h-4 w-4" /> Share Link
        </button>
      </div>

      {/* Grid tab bar */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3.5 max-w-2xl mx-auto my-6">
        {visibleTabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border ${t.bg} ${t.text} ${t.border} transition-all relative overflow-hidden group aspect-square shadow-xs ${isActive
                ? `scale-[1.04] ring-2 ring-offset-2 ring-offset-slate-900 shadow-md ${t.key === 'live' ? 'ring-[#E11D48]' : t.key === 'recordings' ? 'ring-[#EA580C]' : t.key === 'announcements' ? 'ring-[#2563EB]' : t.key === 'tests' ? 'ring-[#0284C7]' : t.key === 'students' ? 'ring-[#059669]' : 'ring-[#7C3AED]'}`
                : "hover:scale-[1.02] hover:shadow-sm"
                }`}
            >
              {t.key === 'requests' && (classroom.pendingJoinRequestsCount || 0) > 0 && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#E11D48] text-white text-[9px] font-extrabold flex items-center justify-center animate-bounce">
                  {classroom.pendingJoinRequestsCount}
                </span>
              )}
              <t.icon className="w-8 h-8 mb-1.5 transition-transform group-hover:scale-110" style={{ color: t.iconColor }} />
              <span className="text-[10px] sm:text-xs font-black tracking-tight text-center leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content — each tab is a separate JS chunk, loaded on first click */}
      <div className="border-t border-cream/10 pt-6">
        <Suspense fallback={<TabFallback />}>
          {tab === "announcements" && <AnnouncementsTab classroom={classroom} refreshClassroom={refreshClassroom} isFetching={isFetching} />}
          {tab === "live" && <LiveClassesTab classroomId={classroom.id} refreshClassroom={refreshClassroom} isFetching={isFetching} />}
          {tab === "recordings" && <RecordingsTab classroom={classroom} refreshClassroom={refreshClassroom} />}
          {tab === "tests" && <TestsTab classroom={classroom} refreshClassroom={refreshClassroom} isFetching={isFetching} />}
          {tab === "students" && <StudentsTab classroom={classroom} refreshClassroom={refreshClassroom} isFetching={isFetching} />}
          {tab === "requests" && <JoinRequestsTab classroom={classroom} refreshClassroom={refreshClassroom} />}
        </Suspense>
      </div>
    </div>
  );
}
