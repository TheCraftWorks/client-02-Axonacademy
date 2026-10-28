import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, Suspense } from "react";
import { ArrowLeft, Megaphone, Video, Play, ClipboardList, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  useClassroomStore,
  classroomActions,
  isClassroomStale,
  markClassroomFresh,
} from "@/lib/classroomStore";
import { getClassroomById } from "@/lib/api";

// ─── Lazy-load each tab — only downloads on first click ───────────────────────
const AnnouncementsTab = React.lazy(() =>
  import("@/components/classroom-tabs/StudentAnnouncementsTab").then((m) => ({ default: m.StudentAnnouncementsTab }))
);
const LiveClassesTab = React.lazy(() =>
  import("@/components/classroom-tabs/StudentLiveClassesTab").then((m) => ({ default: m.StudentLiveClassesTab }))
);
const RecordingsTab = React.lazy(() =>
  import("@/components/classroom-tabs/StudentRecordingsTab").then((m) => ({ default: m.StudentRecordingsTab }))
);
const TestsTab = React.lazy(() =>
  import("@/components/classroom-tabs/StudentTestsTab").then((m) => ({ default: m.StudentTestsTab }))
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabKey = "announcements" | "documents" | "live" | "recordings" | "tests";

export interface ClassroomSearchParams {
  tab?: TabKey;
  quizId?: string;
  action?: "start" | "result";
  attemptId?: string;
}

// ─── Route declaration ────────────────────────────────────────────────────────

export const Route = createFileRoute("/_student/student/classroom/$id")({
  validateSearch: (search: Record<string, unknown>): ClassroomSearchParams => ({
    tab: typeof search.tab === "string" ? (search.tab as TabKey) : undefined,
    quizId: typeof search.quizId === "string" ? search.quizId : undefined,
    action: typeof search.action === "string" ? (search.action as "start" | "result") : undefined,
    attemptId: typeof search.attemptId === "string" ? search.attemptId : undefined,
  }),
  component: StudentClassroomDetail,
});

// ─── Tab configuration ────────────────────────────────────────────────────────

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ComponentType<any>;
  bg: string;
  text: string;
  border: string;
  iconColor: string;
  ringColor: string;
  badgeBg: string;
  isLive?: boolean;
}

const TABS: readonly TabConfig[] = [
  { key: "announcements", label: "Announcements", icon: Megaphone, bg: "bg-[#EFF6FF]", text: "text-[#1E40AF]", border: "border-[#BFDBFE]", iconColor: "#2563EB", ringColor: "ring-[#2563EB]", badgeBg: "bg-[#2563EB] text-white" },
  { key: "live", label: "Live Class", icon: Video, bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", border: "border-[#FCA5A5]", iconColor: "#DC2626", ringColor: "ring-[#DC2626]", badgeBg: "bg-[#DC2626] text-white", isLive: true },
  { key: "recordings", label: "Recording", icon: Play, bg: "bg-[#FFF7ED]", text: "text-[#9A3412]", border: "border-[#FED7AA]", iconColor: "#EA580C", ringColor: "ring-[#EA580C]", badgeBg: "bg-[#EA580C] text-white" },
  { key: "tests", label: "Smart Test", icon: ClipboardList, bg: "bg-[#F0F9FF]", text: "text-[#075985]", border: "border-[#BAE6FD]", iconColor: "#0284C7", ringColor: "ring-[#0284C7]", badgeBg: "bg-[#0284C7] text-white" },
];

// ─── Loading fallback for lazy-loaded tabs ────────────────────────────────────

function TabFallback() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-2xl bg-slate-100 border border-slate-200" />
      <div className="h-20 rounded-2xl bg-slate-100 border border-slate-200" />
      <div className="h-20 rounded-2xl bg-slate-100 border border-slate-200" />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function StudentClassroomDetail() {
  const params = (Route.useParams as any)();
  const navigate = Route.useNavigate();
  const id = params.id as string;
  const { classrooms, currentUser } = useClassroomStore();
  const CURRENT_STUDENT = { id: currentUser?.id || "", name: currentUser?.name || "" };

  const search: any = (Route.useSearch as any) ? Route.useSearch() : {};
  const queryTab = (search?.tab as TabKey) || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get("tab") as TabKey) : null);
  const queryQuizId = (search?.quizId as string | undefined) || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get("quizId") : null);
  const queryAction = (search?.action as "start" | "result" | undefined) || (typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get("action") as "start" | "result") : null);
  const queryAttemptId = (search?.attemptId as string | undefined) || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get("attemptId") : null);

  const validTabs: TabKey[] = ["announcements", "documents", "live", "recordings", "tests"];

  const [tab, setTab] = useState<TabKey>(() => {
    if (queryTab && validTabs.includes(queryTab)) return queryTab;
    return "live";
  });

  useEffect(() => {
    if (queryTab && validTabs.includes(queryTab)) setTab(queryTab);
  }, [queryTab]);

  const [isLoading, setIsLoading] = useState(!classrooms.some((c) => c.id === id || (c as any)._id === id));
  const [isFetching, setIsFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cls = classrooms.find((c) => c.id === id || (c as any)._id === id);

  const myInfo = cls?.students?.find((s) =>
    s.id === currentUser?.id ||
    s.id === currentUser?.userId ||
    (s.email && currentUser?.email && s.email.toLowerCase() === currentUser.email.toLowerCase())
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoadError(null);
        const hasCached = classrooms.some((c) => c.id === id || (c as any)._id === id);
        if (!hasCached) setIsLoading(true);
        setIsFetching(true);
        const refreshed = await getClassroomById(id, isClassroomStale(id));
        if (!active) return;
        if (classrooms.some((c) => c.id === id || (c as any)._id === id)) {
          classroomActions.updateClassroom(id, refreshed);
        } else {
          classroomActions.addClassroom(refreshed);
        }
        markClassroomFresh(id);
      } catch (err) {
        if (active && !classrooms.some((c) => c.id === id)) {
          setLoadError(err instanceof Error ? err.message : "Could not load classroom");
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
  }, [id]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const mainEl = document.querySelector("main");
    if (mainEl) mainEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [id, tab]);

  if (isLoading || (!cls && isFetching) || (!myInfo && isFetching)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-plum-dark mb-4" />
        <p className="text-slate-500 text-sm font-medium">Loading classroom details...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 text-sm">Error loading classroom: {loadError}</p>
        <button onClick={() => navigate({ to: "/student/classrooms" })} className="mt-5 rounded-full bg-plum-dark text-cream px-6 py-2.5 text-sm font-bold cursor-pointer">
          ← My Classrooms
        </button>
      </div>
    );
  }

  if (!cls || (!myInfo && currentUser?.role === "student") || (myInfo && myInfo.status !== "active")) {
    return (
      <div className="text-center py-20">
        <Lock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <h2 className="font-display font-bold text-plum-dark text-xl">Access Denied</h2>
        <p className="text-slate-500 text-sm mt-2">You are not enrolled in this classroom.</p>
        <button onClick={() => navigate({ to: "/student/classrooms" })} className="mt-5 rounded-full bg-plum-dark text-cream px-6 py-2.5 text-sm font-bold cursor-pointer">
          ← My Classrooms
        </button>
      </div>
    );
  }

  // Notification badge counts
  const announcementsCount = (cls.announcements || []).length;
  const pdfDocumentsCount = (cls.announcements || []).reduce((acc: number, a: any) => {
    const rawAttachments = Array.isArray(a.attachments) ? a.attachments : (a.attachment ? [a.attachment] : []);
    const directCount = (a.fileUrl && !rawAttachments.some((x: any) => (typeof x === 'string' ? x : x?.url) === a.fileUrl) ? 1 : 0) +
      (a.pdfUrl && !rawAttachments.some((x: any) => (typeof x === 'string' ? x : x?.url) === a.pdfUrl) ? 1 : 0);
    return acc + rawAttachments.length + directCount;
  }, 0);
  const liveMeetings = (cls.meetings || []).filter((m) => m.status === "live");
  const scheduledMeetings = (cls.meetings || []).filter((m) => m.status === "scheduled");
  const recordingsCount = (cls.recordings || []).filter((r) => r.isPublished).length;
  const testsCount = (cls.quizzes || []).filter((q) => q.status === "published").length;

  const isAnnouncementsActive = tab === "announcements" || tab === "documents";
  const classroomId = cls.id || (cls as any)._id || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate({ to: "/student/classrooms" })} className="text-slate-400 hover:text-plum-dark mt-1 shrink-0 cursor-pointer">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-plum-dark">{cls.name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="font-mono text-[11px] text-slate-400">{cls.code}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 text-xs">{cls.program}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 text-xs">{(cls.students || []).filter((s) => s.status === "active").length} students enrolled</span>
            {cls.instructors && cls.instructors.length > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500 text-xs font-semibold text-plum">Faculty: {(cls.instructors || []).map(i => i.name).join(", ")}</span>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 max-w-sm">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-plum rounded-full" style={{ width: `${myInfo?.progress || 0}%` }} />
            </div>
            <span className="text-xs font-mono text-plum-dark font-bold">{myInfo?.progress || 0}% complete</span>
          </div>
        </div>
      </div>

      {/* 4-square tab bar with notification badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto my-6">
        {TABS.map((t) => {
          const isActive = t.key === "announcements" ? isAnnouncementsActive : tab === t.key;
          let badgeCount = 0;
          let showLivePill = false;

          if (t.key === "announcements") {
            badgeCount = announcementsCount + pdfDocumentsCount;
          } else if (t.key === "live") {
            if (liveMeetings.length > 0) showLivePill = true;
            else badgeCount = scheduledMeetings.length;
          } else if (t.key === "recordings") {
            badgeCount = recordingsCount;
          } else if (t.key === "tests") {
            badgeCount = testsCount;
          }

          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl border ${t.bg} ${t.text} ${t.border} transition-all relative overflow-hidden group aspect-square shadow-xs cursor-pointer ${
                isActive
                  ? `scale-[1.04] ring-2 ring-offset-2 ring-offset-slate-50 shadow-md ${t.ringColor}`
                  : "hover:scale-[1.02] hover:shadow-sm opacity-90 hover:opacity-100"
              }`}
            >
              {showLivePill ? (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[#E11D48] text-white text-[8px] font-extrabold tracking-wider uppercase animate-pulse shadow-xs">LIVE</span>
              ) : badgeCount > 0 ? (
                <span className={`absolute top-2 right-2 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-black shadow-2xs ${t.badgeBg}`}>
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
              <t.icon className="w-7 h-7 sm:w-8 sm:h-8 mb-1.5 transition-transform group-hover:scale-110" style={{ color: t.iconColor }} />
              <span className="text-[11px] sm:text-xs font-black tracking-tight text-center leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab contents — each tab is a separate JS chunk loaded on first click */}
      <div className="border-t border-slate-100 pt-6">
        <h2 className="font-display text-base font-extrabold text-slate-800 mb-4 capitalize">
          {isAnnouncementsActive ? "Classroom Announcements & Materials"
           : tab === "live" ? "Live Classes & Interactive Sessions"
           : tab === "recordings" ? "Video Lecture Recordings"
           : "Smart Tests & Quizzes"}
        </h2>

        <Suspense fallback={<TabFallback />}>
          {isAnnouncementsActive && (
            <AnnouncementsTab
              classroomId={classroomId}
              isFetching={isFetching}
              initialSubTab={tab === "documents" || queryTab === "documents" ? "pdf" : "text"}
            />
          )}
          {tab === "live" && <LiveClassesTab classroomId={classroomId} isFetching={isFetching} />}
          {tab === "recordings" && <RecordingsTab classroomId={classroomId} isFetching={isFetching} />}
          {tab === "tests" && (
            <TestsTab
              classroomId={classroomId}
              isFetching={isFetching}
              initialQuizId={queryQuizId}
              initialAction={queryAction}
              initialAttemptId={queryAttemptId}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
}