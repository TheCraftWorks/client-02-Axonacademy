import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Megaphone, Video, BookOpen, ClipboardList,
  Play, Check, X, Clock, Calendar, ChevronRight,
  Trophy, Radio, Lock, ShieldAlert, Download,
  DollarSign, FileText, MessageSquare, HelpCircle, LifeBuoy,
  Pause, RotateCcw, RotateCw, Settings, Gauge, Loader2
} from "lucide-react";
import {
  LuArrowLeft, LuMegaphone, LuVideo, LuBookOpen, LuClipboardList,
  LuPlus, LuX, LuTrash2, LuPlay, LuEye, LuEyeOff, LuCheck, LuSend,
  LuCalendar, LuClock, LuRadio, LuUpload, LuUsers, LuCircleDot, LuDownload, LuCopy,
  LuFolder
} from "react-icons/lu";
import { useVideoProtection } from "@/lib/video-protection";
import {
  useClassroomStore,
  classroomActions,
  formatDuration,
  getExamType,
  formatTime,
  isClassroomStale,
  classroomFetchCache,
  markClassroomFresh,
  type Quiz,
  type Question,
} from "@/lib/classroomStore";
import {
  api,
  getClassroomById,
  getQuizAttemptResult,
  getRecordingStreamUrl,
  saveQuizAnswersBulk,
  startQuizAttempt,
  submitQuizAttempt,
  trackRecordingProgress,
} from "@/lib/api";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { QuizQuestionReviewTabs } from "@/components/quiz/QuizQuestionReviewTabs";

export const Route = createFileRoute("/_student/student/classroom/$id")({
  component: StudentClassroomDetail,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso?: string) {
  if (!iso) return "recently";
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "recently";
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ComponentType<any>;
  bg: string;
  text: string;
  border: string;
  iconColor: string;
  isLive?: boolean;
}

type TabKey = "announcements" | "live" | "recordings" | "tests";

const TABS: readonly TabConfig[] = [
  { key: "announcements", label: "Announcements", icon: BookOpen, bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]", border: "border-[#93C5FD]", iconColor: "#2563EB" },
  { key: "live", label: "Live Class", icon: Video, bg: "bg-[#FFE4E6]", text: "text-[#9F1239]", border: "border-[#FDA4AF]", iconColor: "#E11D48", isLive: true },
  { key: "recordings", label: "Recording", icon: Play, bg: "bg-[#FFEDD5]", text: "text-[#9A3412]", border: "border-[#FED7AA]", iconColor: "#EA580C" },
  { key: "tests", label: "Smart Test", icon: ClipboardList, bg: "bg-[#E0F2FE]", text: "text-[#075985]", border: "border-[#7DD3FC]", iconColor: "#0284C7" },
];

// ─── Skeleton Loaders ─────────────────────────────────────────────────────────

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-slate-200/70 border border-slate-100 ${className}`} />
  );
}

function TabSkeletonLoader({ type = "cards" }: { type?: "cards" | "grid" | "rows" }) {
  return (
    <div className="space-y-3">
      {type === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <SkeletonCard className="h-24 w-full" />
          <SkeletonCard className="h-24 w-full" />
          <SkeletonCard className="h-24 w-full" />
        </div>
      ) : (
        <>
          <SkeletonCard className="h-20 w-full" />
          <SkeletonCard className="h-20 w-full" />
          <SkeletonCard className="h-20 w-full" />
        </>
      )}
    </div>
  );
}

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab({ classroomId, isFetching }: { classroomId: string; isFetching?: boolean }) {
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);

  const announcements = cls?.announcements || [];

  if (isFetching && announcements.length === 0) {
    return <TabSkeletonLoader type="rows" />;
  }

  if (!cls) return null;

  return (
    <div className="space-y-3">
      {announcements.length === 0 && !isFetching && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-xs">
          <Megaphone className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No announcements yet. Check back later.</p>
        </div>
      )}
      {announcements.map((ann) => {
        const authorName = typeof ann.author === 'object' && ann.author !== null
          ? ((ann.author as any).fullName || (ann.author as any).name || 'Admin')
          : (ann.author || 'Admin');
        return (
          <div key={ann.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum-dark text-cream font-bold text-xs">
                {authorName.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-plum-dark text-sm font-semibold">{authorName}</span>
                  <span className="text-slate-400 text-xs">{timeAgo(ann.createdAt)}</span>
                </div>
                <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">{ann.content}</div>
                {ann.attachments && ann.attachments.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ann.attachments.map((at: any, i: number) => {
                      return (
                        <a
                          key={i}
                          href={at.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-plum-dark transition-colors"
                        >
                          <Download className="h-3.5 w-3.5 text-plum-dark" />
                          {at.name || "View Attachment"}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Live Classes Tab ─────────────────────────────────────────────────────────

function LiveClassesTab({ classroomId, isFetching }: { classroomId: string; isFetching?: boolean }) {
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);

  const meetings = cls?.meetings || [];
  const upcoming = meetings
    .filter((m) => m.status === "scheduled" || m.status === "live")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  const past = meetings
    .filter((m) => m.status === "ended")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  if (isFetching && meetings.length === 0) {
    return <TabSkeletonLoader type="rows" />;
  }

  if (!cls) return null;

  return (
    <div className="space-y-5">
      {meetings.length === 0 && !isFetching && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
          <Video className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No live classes scheduled yet.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Upcoming & Live</h3>
          <div className="space-y-3">
            {upcoming.map((m) => (
              <div key={m.id} className={`rounded-2xl border p-5 ${m.status === "live" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-display font-bold text-plum-dark">{m.title}</span>
                      {m.status === "live" && (
                        <span className="bg-red-100 text-red-600 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded flex items-center gap-1">
                          <Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-sm">{m.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(m.scheduledAt)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {m.duration} min</span>
                    </div>
                  </div>
                  {m.status === "live" ? (
                    <a
                      href={`/live/${m.roomId}`}
                      className="rounded-full bg-red-500 text-white px-5 py-2.5 text-sm font-bold flex items-center gap-2 shrink-0"
                    >
                      <Radio className="h-4 w-4" /> Join Now
                    </a>
                  ) : (
                    <a
                      href={`/live/${m.roomId}`}
                      className="rounded-full bg-plum-dark text-cream px-5 py-2.5 text-sm font-bold flex items-center gap-2 shrink-0 hover:bg-plum transition-colors"
                    >
                      Join Class
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-3">Past Sessions</h3>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 text-left">
                  <th className="p-4">Class</th><th>Date</th><th>Duration</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="p-4 font-semibold text-plum-dark">{m.title}</td>
                    <td className="text-slate-500 text-xs">{fmtDate(m.scheduledAt)}</td>
                    <td className="text-slate-500 text-xs font-mono">{m.duration}m</td>
                    <td><span className="bg-slate-100 text-slate-500 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded">Done</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Recordings Tab ───────────────────────────────────────────────────────────

function SecurePlayer({
  classroomId,
  recording,
  onClose,
}: {
  classroomId: string;
  recording: {
    id: string;
    title: string;
    duration: number;
    chapters: { id: string; title: string; startTimeSec: number }[];
    storageProvider?: string;
    cloudflareUrl?: string;
    viewStats?: { studentId: string; studentName: string; watchedPercent: number; totalWatchedSec?: number; lastPosition: number }[];
    security?: {
      signedUrlRequired?: boolean;
      urlExpiryHours?: number;
      watermark?: boolean;
      downloadBlocked?: boolean;
      screenRecordDetect?: boolean;
      devToolsBlocked?: boolean;
    };
  };
  onClose: () => void;
}) {
  const { currentUser, accessToken } = useClassroomStore();
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [selectedQuality, setSelectedQuality] = useState<'Auto (1080p)' | '1080p' | '720p' | '480p' | '360p'>('Auto (1080p)');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const [gestureEffect, setGestureEffect] = useState<{ type: 'play' | 'pause' | 'rewind' | 'forward'; id: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingWatchedRef = useRef(0);
  const totalWatchedRef = useRef(0);
  const lastVideoTimeRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const tapTimeoutRef = useRef<any>(null);

  const [resolvedStreamUrl, setResolvedStreamUrl] = useState<string>('');
  const [isRefreshingUrl, setIsRefreshingUrl] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [fatalError, setFatalError] = useState<{ code: number; message: string } | null>(null);

  const recordingId = recording.id || (recording as any)._id || '';
  const chapters = recording.chapters || [];

  const screenRecordDetect = recording.security?.screenRecordDetect !== false;
  const { isLocked, lockReason, resetLock } = useVideoProtection(screenRecordDetect);

  const isDirectSignedUrl = Boolean(
    recording.cloudflareUrl &&
    (recording.cloudflareUrl.includes('X-Amz-Signature') || recording.cloudflareUrl.includes('X-Amz-Algorithm'))
  );

  const initialStreamUrl = isDirectSignedUrl
    ? recording.cloudflareUrl
    : `${getRecordingStreamUrl(recordingId)}${accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''}`;

  useEffect(() => {
    if (useProxyFallback) {
      const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      const proxyUrl = `${getRecordingStreamUrl(recordingId)}${tokenQuery}${tokenQuery ? '&' : '?'}proxy=true`;
      setResolvedStreamUrl(proxyUrl);
    } else if (initialStreamUrl) {
      setResolvedStreamUrl(initialStreamUrl);
    }
  }, [useProxyFallback, initialStreamUrl, recordingId, accessToken]);

  const refreshPlaybackUrl = useCallback(async () => {
    if (isRefreshingUrl) return;
    setIsRefreshingUrl(true);
    try {
      const res = await api.get(`/recordings/classroom/${recordingId}`) as any;
      if (res.success && res.cloudflareUrl) {
        setResolvedStreamUrl(res.cloudflareUrl);
      } else if (res.success && res.recording?.cloudflareUrl) {
        setResolvedStreamUrl(res.recording.cloudflareUrl);
      } else {
        const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
        setResolvedStreamUrl(`${getRecordingStreamUrl(recordingId)}${tokenQuery}`);
      }
    } catch (err) {
      console.error("Failed to refresh playback URL:", err);
      const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      setResolvedStreamUrl(`${getRecordingStreamUrl(recordingId)}${tokenQuery}`);
    } finally {
      setIsRefreshingUrl(false);
    }
  }, [recordingId, accessToken, isRefreshingUrl]);

  useEffect(() => {
    totalWatchedRef.current = recording.viewStats?.find((v) => v.studentId === currentUser?.id)?.totalWatchedSec || 0;
  }, [currentUser?.id, recordingId]);

  useEffect(() => {
    if (gestureEffect) {
      const timer = setTimeout(() => setGestureEffect(null), 700);
      return () => clearTimeout(timer);
    }
  }, [gestureEffect]);

  const handleQualityChange = (quality: 'Auto (1080p)' | '1080p' | '720p' | '480p' | '360p') => {
    setSelectedQuality(quality);
    setShowQualityMenu(false);
    toast.success(`Video quality set to ${quality}`);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
    toast.success(`Playback speed set to ${speed}x`);
  };

  const handleVideoAreaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('.no-gesture') || target.tagName === 'VIDEO' || target.closest('video')) return;
    if (isLocked) return;

    const video = videoRef.current;
    if (!video) return;

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const isDoubleTap = now - lastTapRef.current.time < 300 && Math.abs(clickX - lastTapRef.current.x) < 100;

    if (isDoubleTap) {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
      if (clickX < width * 0.35) {
        video.currentTime = Math.max(0, video.currentTime - 10);
        setGestureEffect({ type: 'rewind', id: now });
      } else if (clickX > width * 0.65) {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
        setGestureEffect({ type: 'forward', id: now });
      }
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x: clickX };
      tapTimeoutRef.current = setTimeout(() => {
        if (video.paused) {
          void video.play().catch(() => { });
          setIsPlaying(true);
          setGestureEffect({ type: 'play', id: now });
        } else {
          video.pause();
          setIsPlaying(false);
          setGestureEffect({ type: 'pause', id: now });
        }
      }, 250);
    }
  };

  const sendProgress = useCallback(async (force = false) => {
    const video = videoRef.current;
    if (!video || !currentUser?.id) return;

    const watchedSec = Math.floor(pendingWatchedRef.current);
    const currentPosition = Math.floor(video.currentTime || 0);
    const completed = recording.duration > 0 && currentPosition >= recording.duration * 0.9;
    const now = Date.now();

    if (!force && (watchedSec < 10 || now - lastSentAtRef.current < 10_000)) return;
    if (watchedSec <= 0 && !completed) return;

    pendingWatchedRef.current = 0;
    lastSentAtRef.current = now;

    try {
      await trackRecordingProgress(recordingId, {
        position: currentPosition,
        watchedSec,
        completed,
      });
      totalWatchedRef.current += watchedSec;
      const watchedPercent = recording.duration > 0
        ? Math.min(100, Math.round((totalWatchedRef.current / recording.duration) * 100))
        : 0;
      classroomActions.updateViewStat(classroomId, recordingId, currentUser.id, currentUser.name, watchedPercent, currentPosition);
    } catch {
      pendingWatchedRef.current += watchedSec;
    }
  }, [classroomId, currentUser?.id, currentUser?.name, recording.duration, recordingId, recording.viewStats]);

  const handleVideoError = useCallback(async () => {
    const err = videoRef.current?.error;
    const code = err?.code || 0;
    const msg = err?.message || 'Unknown playback error';
    const currentUrl = resolvedStreamUrl;

    console.error(`Video playback error: Code ${code}, Message: ${msg}, URL: ${currentUrl}`);

    // Log the error to the database automatically
    try {
      await api.post('/recordings/log-error', {
        recordingId,
        classroomId,
        errorCode: code,
        errorMessage: msg,
        userAgent: navigator.userAgent,
        videoUrl: currentUrl
      });
    } catch (e) {
      console.error("Failed to submit playback error log:", e);
    }

    if (isRefreshingUrl) return;

    const currentPos = videoRef.current ? videoRef.current.currentTime : position;

    if (retryCount === 0) {
      // First retry: Refresh the signed URL
      toast.info("Refreshing secure video link...");
      setRetryCount(1);
      await refreshPlaybackUrl();

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          if (currentPos > 0) {
            videoRef.current.currentTime = currentPos;
          }
          videoRef.current.play().catch(err => console.error("Play failure after URL refresh:", err));
        }
      }, 500);
    } else if (retryCount === 1) {
      // Second retry: Switch to proxy streaming
      toast.info("Switching to backup streaming connection...");
      setRetryCount(2);
      setUseProxyFallback(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          if (currentPos > 0) {
            videoRef.current.currentTime = currentPos;
          }
          videoRef.current.play().catch(err => console.error("Play failure after switching to proxy:", err));
        }
      }, 500);
    } else {
      // Failed both options: show fatal error overlay
      setFatalError({ code, message: msg });
      toast.error("Playback failed. Please see diagnostic details on screen.");
    }
  }, [isRefreshingUrl, refreshPlaybackUrl, position, retryCount, recordingId, classroomId, resolvedStreamUrl, useProxyFallback]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime || 0;
      const delta = currentTime - lastVideoTimeRef.current;
      if (!video.paused && delta > 0 && delta <= 5) {
        pendingWatchedRef.current += delta;
      }
      lastVideoTimeRef.current = currentTime;
      setPosition(Math.floor(currentTime));
    };
    const handleLoadedMetadata = () => {
      const stats = recording.viewStats?.find((v) => v.studentId === currentUser?.id || (v as any).student === currentUser?.id);
      const savedPosition = stats?.lastPosition || 0;
      const watchedPct = stats?.watchedPercent || 0;
      const isCompleted = (stats as any)?.completedAt || watchedPct >= 85;

      // If already watched or near the end (>85% watched), start from beginning for a clean rewatch without seek stalls
      if (isCompleted || savedPosition <= 2 || (video.duration && savedPosition >= video.duration - 10)) {
        try { video.currentTime = 0; } catch {}
        lastVideoTimeRef.current = 0;
        setPosition(0);
      } else if (savedPosition > 2 && video.duration && savedPosition < video.duration - 10) {
        // Only set savedPosition if media is ready and safely within boundaries
        try {
          video.currentTime = savedPosition;
          lastVideoTimeRef.current = savedPosition;
          setPosition(Math.floor(savedPosition));
        } catch (e) {
          console.error("Failed to restore video position:", e);
        }
      }

      if (videoRef.current) {
        videoRef.current.playbackRate = playbackSpeed;
      }
    };
    const handlePlay = () => {
      lastVideoTimeRef.current = video.currentTime || 0;
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
      void sendProgress(true);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      void sendProgress(true);
    };
    const handleBeforeUnload = () => {
      void sendProgress(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    window.addEventListener('beforeunload', handleBeforeUnload);
    const interval = window.setInterval(() => void sendProgress(), 15_000);

    return () => {
      window.clearInterval(interval);
      void sendProgress(true);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.id, recording.id, recording.viewStats, sendProgress, playbackSpeed]);

  // Pause video if locked
  useEffect(() => {
    if (isLocked && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isLocked]);

  const pct = recording.duration > 0 ? (position / recording.duration) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col h-[100dvh] overflow-hidden no-select select-none" onContextMenu={(e) => e.preventDefault()}>
      <style>{`
        @media print {
          body, html, #root, .fixed, video {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }
        }
        .no-select {
          user-select: none !important;
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
        }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-black/90 border-b border-white/10 z-40 relative shrink-0">
        <span className="text-white font-semibold text-xs sm:text-sm truncate max-w-[200px] sm:max-w-md">{recording.title}</span>
        <div className="flex items-center gap-2 sm:gap-3 no-gesture">
          {/* Quality Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowQualityMenu((v) => !v);
                setShowSpeedMenu(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] sm:text-xs font-medium transition-colors border border-white/10"
              title="Select video quality"
            >
              <Settings className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-lime" />
              <span>{selectedQuality}</span>
            </button>

            {showQualityMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider">Quality</div>
                {(['Auto (1080p)', '1080p', '720p', '480p', '360p'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => handleQualityChange(q)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-white/10 transition-colors ${selectedQuality === q ? 'text-lime font-bold' : 'text-white/80'}`}
                  >
                    <span>{q}</span>
                    {selectedQuality === q && <Check className="h-3.5 w-3.5 text-lime" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Playback Speed Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSpeedMenu((v) => !v);
                setShowQualityMenu(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] sm:text-xs font-medium transition-colors border border-white/10"
              title="Select playback speed"
            >
              <Gauge className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-lime" />
              <span>{playbackSpeed}x</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-[#18181B] border border-white/10 rounded-xl shadow-2xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] font-bold text-white/40 uppercase tracking-wider">Speed</div>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-white/10 transition-colors ${playbackSpeed === s ? 'text-lime font-bold' : 'text-white/80'}`}
                  >
                    <span>{s === 1 ? '1.0x (Normal)' : `${s}x`}</span>
                    {playbackSpeed === s && <Check className="h-3.5 w-3.5 text-lime" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={onClose} className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex flex-1 min-h-0 relative select-none flex-col md:flex-row overflow-hidden">
        <div
          onClick={handleVideoAreaClick}
          className="flex-1 min-h-0 bg-linear-to-br from-plum-dark/90 to-[#0B0719] flex items-center justify-center relative cursor-pointer overflow-hidden p-1.5 sm:p-3 pb-8 sm:pb-6"
        >
          {resolvedStreamUrl ? (
            <video
              ref={videoRef}
              src={resolvedStreamUrl}
              crossOrigin="anonymous"
              className="w-full h-full max-h-full object-contain bg-black no-select select-none pointer-events-auto"
              controls
              autoPlay
              onError={handleVideoError}
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              disableRemotePlayback
              // @ts-ignore — non-standard AirPlay attribute for Safari iOS
              x-webkit-airplay="deny"
              poster="/default-video-thumb.jpg"
              onPlay={() => {
                setIsPlaying(true);
                setIsBuffering(false);
              }}
              onPause={() => setIsPlaying(false)}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onCanPlay={() => setIsBuffering(false)}
              onSeeking={() => setIsBuffering(true)}
              onSeeked={() => setIsBuffering(false)}
              onLoadStart={() => setIsBuffering(true)}
              onLoadedData={() => setIsBuffering(false)}
              onDragStart={(e) => e.preventDefault()}
            />
          ) : (
            <>
              {/* Fake video frame */}
              <button onClick={() => {
                if (isLocked) return;
                setIsPlaying((p) => !p);
              }} className="text-white/80 hover:text-white transition-colors">
                {isPlaying ? (
                  <div className="flex gap-2">
                    <div className="w-3 h-10 bg-white rounded-sm" />
                    <div className="w-3 h-10 bg-white rounded-sm" />
                  </div>
                ) : (
                  <Play className="h-16 w-16 fill-current" />
                )}
              </button>
            </>
          )}

          {resolvedStreamUrl && isBuffering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20 pointer-events-none backdrop-blur-[2px] transition-all duration-300">
              <div className="w-14 h-14 border-[5px] border-lime/20 border-t-lime rounded-full animate-spin" />
              <span className="text-white text-xs font-bold tracking-wider uppercase mt-4 drop-shadow-md animate-pulse">
                Buffering video...
              </span>
            </div>
          )}

          {/* Gesture Ripple Overlay */}
          {gestureEffect && (
            <div
              key={gestureEffect.id}
              className="absolute inset-0 pointer-events-none flex items-center justify-center z-30"
            >
              <div className="bg-black/80 backdrop-blur-md text-white rounded-2xl px-6 py-5 flex flex-col items-center justify-center shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-200">
                {gestureEffect.type === 'play' && (
                  <>
                    <Play className="h-10 w-10 fill-lime text-lime mb-1" />
                    <span className="text-xs font-bold tracking-wider uppercase text-lime">Play</span>
                  </>
                )}
                {gestureEffect.type === 'pause' && (
                  <>
                    <Pause className="h-10 w-10 text-white mb-1" />
                    <span className="text-xs font-bold tracking-wider uppercase text-white">Pause</span>
                  </>
                )}
                {gestureEffect.type === 'rewind' && (
                  <>
                    <RotateCcw className="h-10 w-10 text-lime mb-1" />
                    <span className="text-xs font-bold tracking-wider text-lime">-10 Seconds</span>
                  </>
                )}
                {gestureEffect.type === 'forward' && (
                  <>
                    <RotateCw className="h-10 w-10 text-lime mb-1" />
                    <span className="text-xs font-bold tracking-wider text-lime">+10 Seconds</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Security Lock overlay */}
          {isLocked && (
            <div className="absolute inset-0 backdrop-blur-xl bg-black/95 flex flex-col items-center justify-center z-30 p-6 transition-all duration-300">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
                <div className="relative rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                  <ShieldAlert className="h-12 w-12 text-red-500 animate-bounce" />
                </div>
              </div>

              <h2 className="text-white font-display text-xl font-bold tracking-wider mb-2 uppercase">
                {lockReason === "shortcut" ? "Security Alert" : "Playback Paused"}
              </h2>

              <p className="text-slate-400 text-sm max-w-sm text-center mb-8 leading-relaxed">
                {lockReason === "shortcut"
                  ? "A screenshot, screen-recording shortcut, or Developer Tools attempt was detected."
                  : "Focus was lost — this may indicate a screen recording tool, notification shade, or app switch."}
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    resetLock();
                    if (videoRef.current) {
                      void videoRef.current.play().catch(() => { });
                    }
                  }}
                  className="rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-all duration-200 bg-lime text-plum-dark hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Resume Playback
                </button>
                <button
                  onClick={() => {
                    void sendProgress(true);
                    onClose();
                  }}
                  className="rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-all duration-200 bg-white/10 text-white hover:bg-white/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Recordings
                </button>
              </div>
            </div>
          )}

          {/* Fatal Playback Error overlay */}
          {fatalError && !isLocked && (
            <div className="absolute inset-0 backdrop-blur-xl bg-black/95 flex flex-col items-center justify-center z-30 p-6 transition-all duration-300">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
                <div className="relative rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                  <ShieldAlert className="h-12 w-12 text-red-500 animate-pulse" />
                </div>
              </div>

              <h2 className="text-white font-display text-xl font-bold tracking-wider mb-2 uppercase text-center">
                Playback Failed
              </h2>

              <div className="text-slate-400 text-sm max-w-md text-center mb-8 leading-relaxed space-y-2 text-wrap">
                <p>
                  We encountered an issue loading this classroom video. This error has been logged automatically for support.
                </p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-left font-mono text-xs text-slate-300">
                  <div><strong>Error Code:</strong> {fatalError.code} ({
                    fatalError.code === 1 ? "Aborted" :
                      fatalError.code === 2 ? "Network Error" :
                        fatalError.code === 3 ? "Decoding Error" :
                          fatalError.code === 4 ? "Source Not Supported" : "Unknown"
                  })</div>
                  <div className="truncate"><strong>Details:</strong> {fatalError.message || "No additional information"}</div>
                  <div><strong>Stream Mode:</strong> {useProxyFallback ? "Local Proxy" : "Direct S3 Redirect"}</div>
                </div>
                <p className="text-xs text-slate-500 italic mt-2">
                  Troubleshooting tip: {
                    fatalError.code === 2 ? "Ensure you have an active internet connection." :
                      fatalError.code === 3 ? "Try using a different browser (Chrome/Firefox)." :
                        fatalError.code === 4 ? "Your school firewall may be blocking Cloudflare storage domains, or browser tracking prevention is blocking the redirect. Try streaming via proxy." :
                          "Refresh the page and try playing again."
                  }
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button
                  onClick={() => {
                    setFatalError(null);
                    setUseProxyFallback(true);
                    setRetryCount(2);
                    const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
                    setResolvedStreamUrl(`${getRecordingStreamUrl(recordingId)}${tokenQuery}${tokenQuery ? '&' : '?'}proxy=true&_t=${Date.now()}`);
                    const currentPos = videoRef.current ? videoRef.current.currentTime : position;
                    setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.load();
                        videoRef.current.currentTime = currentPos;
                        videoRef.current.play().catch(() => { });
                      }
                    }, 500);
                  }}
                  className="rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-all duration-200 bg-[#C084FC] text-black hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  {useProxyFallback ? "Retry Local Proxy" : "Force Local Proxy"}
                </button>

                <button
                  onClick={() => {
                    setFatalError(null);
                    setRetryCount(0);
                    setUseProxyFallback(false);
                    const tokenQuery = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
                    setResolvedStreamUrl(`${getRecordingStreamUrl(recordingId)}${tokenQuery}${tokenQuery ? '&' : '?'}direct=true&_t=${Date.now()}`);
                    const currentPos = videoRef.current ? videoRef.current.currentTime : position;
                    setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.load();
                        videoRef.current.currentTime = currentPos;
                        videoRef.current.play().catch(() => { });
                      }
                    }, 500);
                  }}
                  className="rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-all duration-200 bg-white/20 text-white hover:bg-white/30 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <RotateCw className="h-4 w-4" />
                  {useProxyFallback ? "Switch to Direct Stream" : "Retry Direct Stream"}
                </button>

                <button
                  onClick={() => {
                    void sendProgress(true);
                    onClose();
                  }}
                  className="rounded-full px-6 py-3 text-sm font-bold shadow-lg transition-all duration-200 bg-white/10 text-white hover:bg-white/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Close Player
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Chapters sidebar */}
        {chapters.length > 0 && (
          <div className="w-full md:w-56 max-h-36 md:max-h-full bg-[#111] border-t md:border-t-0 md:border-l border-white/10 overflow-y-auto shrink-0">
            <div className="p-2.5 sm:p-3 border-b border-white/10 text-white/70 text-[10px] sm:text-xs uppercase tracking-widest font-semibold">Chapters</div>
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setPosition(ch.startTimeSec)}
                className={`w-full text-left px-3 py-2 sm:py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors ${position >= ch.startTimeSec ? "text-white" : "text-white/50"}`}
              >
                <span className="font-mono text-[10px] text-lime shrink-0">{fmt(ch.startTimeSec)}</span>
                <span className="text-xs truncate">{ch.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecordingsTab({ classroomId, isFetching }: { classroomId: string; isFetching?: boolean }) {
  const { classrooms, currentUser } = useClassroomStore();
  const CURRENT_STUDENT = { id: currentUser?.id || "", name: currentUser?.name || "" };
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);
  const [activeRec, setActiveRec] = useState<string | null>(null);

  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const publishedRecordings = (cls?.recordings || []).filter((r) => r.isPublished);
  const activeRecording = publishedRecordings.find((r) => (r.id || (r as any)._id) === activeRec);

  if (isFetching && publishedRecordings.length === 0) {
    return <TabSkeletonLoader type="grid" />;
  }

  if (!cls) return null;

  // Compute folder list: only show folders containing at least one published recording
  const folders = (cls.folders || []).filter(folder =>
    publishedRecordings.some(r => r.folder === (folder.id || (folder as any)._id))
  );

  const currentFolder = folders.find(f => (f.id || (f as any)._id) === currentFolderId);

  // Root recordings: recordings with no folder or folder not found in folder list
  const rootRecordings = publishedRecordings.filter(rec =>
    !rec.folder || !folders.some(f => f.id === rec.folder || (f as any)._id === rec.folder)
  );

  // Filter recordings for the current view
  const visibleRecordings = currentFolderId
    ? publishedRecordings.filter(rec => rec.folder === currentFolderId)
    : rootRecordings;

  return (
    <>
      {activeRec && activeRecording && (
        <SecurePlayer classroomId={classroomId} recording={activeRecording} onClose={() => setActiveRec(null)} />
      )}

      <div className="space-y-4">
        {/* Breadcrumb / Folder Title */}
        {currentFolderId ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <button
              className="hover:text-plum flex items-center gap-1 transition-colors font-bold text-plum-dark"
              onClick={() => setCurrentFolderId(null)}
            >
              <LuArrowLeft className="w-4 h-4" /> Recordings
            </button>
            <span className="text-slate-400">/</span>
            <span className="font-bold text-plum">
              {currentFolder?.name}
            </span>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Classroom Library</div>
        )}

        {/* Folders list (only at root) */}
        {!currentFolderId && folders.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Folders</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {folders.map(folder => {
                const videoCount = publishedRecordings.filter(r => r.folder === folder.id || (r as any).folder === (folder as any)._id).length;
                return (
                  <button
                    key={folder.id}
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-plum/30 transition-all text-left shadow-xs hover:shadow-md w-full"
                  >
                    <div className="w-10 h-10 rounded-xl bg-plum/10 text-plum flex items-center justify-center shrink-0">
                      <LuFolder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-plum-dark text-sm truncate">{folder.name}</div>
                      {folder.description && (
                        <div className="text-xs text-slate-500 truncate mt-0.5">{folder.description}</div>
                      )}
                      <div className="text-[10px] text-slate-400 mt-1 font-semibold">{videoCount} videos</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when no recordings exist in classroom at all */}
        {!currentFolderId && folders.length === 0 && publishedRecordings.length === 0 && !isFetching && (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-xs">
            <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No recordings available in this classroom yet.</p>
          </div>
        )}

        {/* Videos list */}
        {((!currentFolderId && visibleRecordings.length > 0) || currentFolderId) && (
          <div className="space-y-3">
            {!currentFolderId && folders.length > 0 && visibleRecordings.length > 0 && (
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-2">Other Recordings</div>
            )}

            {currentFolderId && visibleRecordings.length === 0 && !isFetching && (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-xs">
                <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No videos inside this folder.</p>
              </div>
            )}

            {visibleRecordings.map((rec) => {
              const recId = rec.id || (rec as any)._id || '';
              const viewStats = rec.viewStats || [];
              const chapters = rec.chapters || [];
              const myStats = viewStats.find((v) =>
                v.studentId === CURRENT_STUDENT.id ||
                v.studentId === currentUser?.userId ||
                (v as any).student === CURRENT_STUDENT.id
              );
              return (
                <div key={recId} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-plum/30 hover:shadow-md transition-all shadow-xs">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-plum/20 to-plum-dark/10 flex items-center justify-center shrink-0">
                      <Play className="h-5 w-5 text-plum" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-bold text-plum-dark text-sm mb-0.5">{rec.title}</h4>
                      <p className="text-slate-500 text-xs line-clamp-1">{rec.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span className="font-mono">{formatDuration(rec.duration || 0)}</span>
                        <span>{chapters.length} chapters</span>
                        {myStats && <span className="text-plum font-medium">{myStats.watchedPercent}% watched</span>}
                      </div>
                      {myStats && (
                        <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden w-48">
                          <div className="h-full bg-plum rounded-full" style={{ width: `${myStats.watchedPercent}%` }} />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setActiveRec(recId)}
                      className="rounded-full bg-plum-dark text-cream px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 hover:bg-plum transition-colors shadow-xs"
                    >
                      <Play className="h-3 w-3" /> {myStats ? "Resume" : "Watch"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

type QuizPhase = "list" | "intro" | "taking" | "result";

type QuizResultReview = {
  score: { rawMarks: number; totalMarks: number; percentage: number; passed: boolean };
  answers: Array<{
    questionId: string;
    selectedOptions: string[];
    isCorrect: boolean;
    marksAwarded: number;
    questionText: string;
    explanation?: string;
    correctOptions: string[];
    isAttempted?: boolean;
    options?: Array<{ label: string; text: string; isCorrect?: boolean }>;
  }>;
};
function TestsTab({ classroomId, isFetching }: { classroomId: string; isFetching?: boolean }) {
  const { classrooms, currentUser } = useClassroomStore();
  const CURRENT_STUDENT = { id: currentUser?.id || "", name: currentUser?.name || "" };
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);

  const quizzes = (cls?.quizzes || []).filter(q => q.status === "published");

  if (isFetching && quizzes.length === 0) {
    return <TabSkeletonLoader type="rows" />;
  }

  if (!cls) return null;

  const [phase, setPhase] = useState<QuizPhase>("list");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResultReview | null>(null);
  const [resultViewTab, setResultViewTab] = useState<"review" | "leaderboard">("review");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startingQuizId, setStartingQuizId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const answersRef = useRef(answers);
  const submitQuizRef = useRef<() => void>(() => { });

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submittingQuizRef = useRef(false);

  const formatQuizDate = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  const submitQuiz = useCallback(async () => {
    if (!activeQuiz || !attemptId || submittingQuizRef.current) return;
    submittingQuizRef.current = true;
    setError("");
    setIsSubmitting(true);
    try {
      const currentAnswers = answersRef.current;
      await saveQuizAnswersBulk(activeQuiz.id, {
        attemptId,
        answers: Object.entries(currentAnswers).map(([questionId, selectedOptions]) => ({
          questionId,
          selectedOptions,
        })),
      });

      const submitRes = await submitQuizAttempt(activeQuiz.id, attemptId);
      const fullResult = await getQuizAttemptResult(activeQuiz.id, attemptId);

      const review: QuizResultReview = {
        score: submitRes.score,
        answers: fullResult.answers,
      };

      setResult(review);
      setPhase("result");

      classroomActions.submitQuizAttempt(classroomId, activeQuiz.id, {
        studentId: CURRENT_STUDENT.id,
        studentName: CURRENT_STUDENT.name,
        attemptNo: (activeQuiz.attempts?.length || 0) + 1,
        status: "submitted",
        startedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        answers: fullResult.answers.map((a: any) => ({
          questionId: a.questionId,
          selectedOptions: a.selectedOptions,
          isCorrect: a.isCorrect,
          marksAwarded: a.marksAwarded,
        })),
        score: submitRes.score,
      });

      const updatedClassroom = await getClassroomById(classroomId);
      classroomActions.updateClassroom(classroomId, updatedClassroom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit assessment");
      toast.error(err instanceof Error ? err.message : "Failed to submit assessment");
    } finally {
      setIsSubmitting(false);
      submittingQuizRef.current = false;
    }
  }, [activeQuiz, attemptId, classroomId, CURRENT_STUDENT.id, CURRENT_STUDENT.name]);

  useEffect(() => {
    submitQuizRef.current = submitQuiz;
  }, [submitQuiz]);

  useEffect(() => {
    if (phase !== "taking" || timeLeft === null) return;
    if (timeLeft <= 0) {
      submitQuizRef.current();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const handleStartExam = async (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setError("");
    setStartingQuizId(quiz.id);
    try {
      const payload = await startQuizAttempt(quiz.id);
      if (payload.alreadySubmitted) {
        toast.info(payload.message || "You have already submitted this quiz.");
        if (payload.attemptId) {
          const review = await getQuizAttemptResult(quiz.id, payload.attemptId);
          setResult(review);
        }
        setPhase("result");
        return;
      }
      setAttemptId(payload.attemptId ?? null);
      setExamQuestions(payload.questions || []);
      setAnswers({});

      if (quiz.duration && quiz.duration > 0) {
        setTimeLeft(quiz.duration * 60);
      } else {
        setTimeLeft(null);
      }

      setPhase("taking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start assessment");
      toast.error(err instanceof Error ? err.message : "Could not start assessment");
    } finally {
      setStartingQuizId(null);
    }
  };

  const handleViewResult = async (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setError("");
    try {
      const fullResult = await getQuizAttemptResult(quiz.id);
      setResult({
        score: fullResult.score,
        answers: fullResult.answers,
      });
      setPhase("result");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load test results");
    }
  };

  const toggleOption = (questionId: string, optionLabel: string, type: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === "msq") {
        const next = current.includes(optionLabel)
          ? current.filter((o) => o !== optionLabel)
          : [...current, optionLabel];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionLabel] };
    });
  };

  if (phase === "list") {
    const publishedQuizzes = (cls.quizzes || []).filter((q) => q.status === "published");
    return (
      <div className="space-y-4">
        {publishedQuizzes.length === 0 && !isFetching && (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-xs">
            <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No tests or quizzes available yet.</p>
          </div>
        )}
        {publishedQuizzes.map((q) => {
          const myAttempts = (q.attempts || []).filter(
            (a) => a.studentId === CURRENT_STUDENT.id || a.studentId === currentUser?.userId
          );
          const submittedAttempts = myAttempts.filter((a) => a.status === "submitted");
          const hasSubmitted = submittedAttempts.length > 0;
          const bestAttempt = submittedAttempts.sort((a, b) => (b.score?.percentage || 0) - (a.score?.percentage || 0))[0];
          const attemptsLeft = q.maxAttempts - submittedAttempts.length;
          const hasAttemptsLeft = attemptsLeft > 0;

          const now = Date.now();
          const startTime = q.availableFrom ? new Date(q.availableFrom).getTime() : null;
          const endTime = q.availableUntil ? new Date(q.availableUntil).getTime() : null;
          const isNotStarted = startTime !== null && !isNaN(startTime) && startTime > now;
          const isExpired = endTime !== null && !isNaN(endTime) && endTime < now;
          const canTake = hasAttemptsLeft && !isNotStarted && !isExpired;
          const isThisStarting = startingQuizId === q.id;

          return (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-sky-300 transition-all shadow-xs">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-display font-bold text-plum-dark text-base">{q.title}</h4>
                    <span className="bg-sky-50 text-sky-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-sky-200">
                      {getExamType(q.questions || [])}
                    </span>
                  </div>
                  <p className="text-slate-500 text-xs line-clamp-2">{q.instructions || "No instructions provided."}</p>

                  {(q.availableFrom || q.availableUntil) && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      {isNotStarted ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          <Calendar className="h-3 w-3" /> Starts: {formatQuizDate(q.availableFrom)}
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
                          <Calendar className="h-3 w-3" /> Closed: {formatQuizDate(q.availableUntil)} (Deadline Reached)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-200">
                          <Calendar className="h-3 w-3" /> {q.availableUntil ? `Deadline: ${formatQuizDate(q.availableUntil)}` : `Started: ${formatQuizDate(q.availableFrom)}`}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1 font-mono"><Clock className="h-3 w-3" /> {q.duration ? `${q.duration} min` : "No limit"}</span>
                    <span>{q.questions?.length || 0} questions</span>
                    <span>{q.passPercent}% pass score</span>
                    <span className="font-medium text-slate-600">Attempts: {submittedAttempts.length}/{q.maxAttempts}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {hasSubmitted && bestAttempt && (
                    <button
                      onClick={() => void handleViewResult(q)}
                      className="rounded-full border border-plum-dark text-plum-dark px-4 py-2 text-xs font-bold hover:bg-plum/5 transition-colors"
                    >
                      View Result ({bestAttempt.score?.percentage}%)
                    </button>
                  )}
                  {isNotStarted && (
                    <span className="rounded-full bg-slate-100 text-slate-400 px-4 py-2 text-xs font-bold border border-slate-200 cursor-not-allowed">
                      Starts Soon
                    </span>
                  )}
                  {isExpired && !hasSubmitted && (
                    <span className="rounded-full bg-red-50 text-red-500 px-4 py-2 text-xs font-bold border border-red-200 cursor-not-allowed">
                      Deadline Passed
                    </span>
                  )}
                  {canTake && (
                    <button
                      disabled={!!startingQuizId}
                      onClick={() => void handleStartExam(q)}
                      className="rounded-full bg-plum-dark text-cream px-5 py-2 text-xs font-bold hover:bg-plum transition-colors shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {isThisStarting && <Loader2 className="h-3 w-3 animate-spin text-lime" />}
                      <span>{isThisStarting ? "Starting..." : hasSubmitted ? "Retake Test" : "Start Test"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (phase === "taking" && activeQuiz) {
    const answeredCount = Object.keys(answers).length;
    return (
      <div className="space-y-6 max-w-3xl mx-auto bg-white p-6 rounded-3xl border border-slate-200 shadow-md">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-plum-dark">{activeQuiz.title}</h3>
            <p className="text-xs text-slate-400">Question {answeredCount} of {examQuestions.length} answered</p>
          </div>
          {timeLeft !== null && (
            <div className={`px-4 py-2 rounded-xl font-mono font-bold text-sm ${timeLeft < 300 ? "bg-red-50 text-red-600 border border-red-200 animate-pulse" : "bg-slate-100 text-slate-700"}`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          )}
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">{error}</div>}

        <div className="space-y-6">
          {examQuestions.map((q, idx) => {
            const selected = answers[q.id] || [];
            return (
              <div key={q.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="font-bold text-plum text-sm">{idx + 1}.</span>
                  <p className="font-semibold text-slate-800 text-sm">{q.text}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 pl-7">
                  {q.options.map((opt) => {
                    const isSel = selected.includes(opt.label);
                    return (
                      <button
                        key={opt.label}
                        onClick={() => toggleOption(q.id, opt.label, q.type)}
                        className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center gap-3 ${
                          isSel ? "border-plum bg-plum/10 text-plum-dark font-bold shadow-xs" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isSel ? "bg-plum text-white" : "bg-slate-100 text-slate-500"}`}>
                          {opt.label}
                        </span>
                        <span>{opt.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <button
            onClick={() => setPhase("list")}
            className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
          >
            Cancel Assessment
          </button>
          <button
            disabled={isSubmitting}
            onClick={() => void submitQuiz()}
            className="rounded-full bg-plum-dark text-cream px-8 py-3 text-sm font-bold shadow-md hover:bg-plum transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Submitting..." : "Submit Test"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "result" && result && activeQuiz) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Result Hero Banner */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                result.score.passed ? "bg-emerald-100 text-emerald-600 shadow-inner" : "bg-red-100 text-red-600 shadow-inner"
              }`}>
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h3 className="font-display text-xl font-bold text-plum-dark">
                    {result.score.passed ? "Assessment Passed 🎉" : "Assessment Completed"}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    result.score.passed ? "bg-emerald-100 text-emerald-950 border border-emerald-400" : "bg-red-100 text-red-950 border border-red-400"
                  }`}>
                    {result.score.passed ? "Passed" : "Needs Review"}
                  </span>
                </div>
                <p className="text-slate-700 text-xs mt-1 font-semibold">
                  {activeQuiz.title} · Score: <strong className="text-plum-dark font-black">{result.score.rawMarks} / {result.score.totalMarks}</strong> ({result.score.percentage}%)
                </p>
              </div>
            </div>

            <button
              onClick={() => setPhase("list")}
              className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-900 px-5 py-2 text-xs font-black transition-all shrink-0 border border-slate-300"
            >
              ← Back to Tests
            </button>
          </div>

          {/* Segmented Switcher for Review vs Leaderboard */}
          <div className="mt-5 flex items-center justify-center sm:justify-start gap-2">
            <div className="bg-slate-100 p-1.5 rounded-2xl inline-flex items-center gap-1.5 border border-slate-300">
              <button
                type="button"
                onClick={() => setResultViewTab("review")}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  resultViewTab === "review"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-700 hover:text-slate-950 hover:bg-white/60"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Question Review (3 Tabs)</span>
              </button>

              <button
                type="button"
                onClick={() => setResultViewTab("leaderboard")}
                className={`px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  resultViewTab === "leaderboard"
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-700 hover:text-slate-950 hover:bg-white/60"
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Leaderboard & Top Ranks</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Section */}
        {resultViewTab === "review" ? (
          <QuizQuestionReviewTabs answers={result.answers} theme="light" />
        ) : (
          <QuizLeaderboard
            quizId={activeQuiz.id}
            currentUserId={CURRENT_STUDENT.id}
            theme="light"
          />
        )}
      </div>
    );
  }

  return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function StudentClassroomDetail() {
  const params = (Route.useParams as any)();
  const navigate = Route.useNavigate();
  const id = params.id as string;
  const { classrooms, currentUser } = useClassroomStore();
  const CURRENT_STUDENT = { id: currentUser?.id || "", name: currentUser?.name || "" };
  const [tab, setTab] = useState<TabKey>("live");

  const [isLoading, setIsLoading] = useState(!classrooms.some((c) => c.id === id || (c as any)._id === id));
  const [isFetching, setIsFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cls = classrooms.find((c) => c.id === id || (c as any)._id === id);

  // Flexible student enrollment check (match ID, userId, or Email)
  const myInfo = cls?.students?.find((s) =>
    s.id === currentUser?.id ||
    s.id === currentUser?.userId ||
    (s.email && currentUser?.email && s.email.toLowerCase() === currentUser.email.toLowerCase())
  );

  React.useEffect(() => {
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
    return () => {
      active = false;
    };
  }, [id]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
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
        <button onClick={() => navigate({ to: "/student/classrooms" })} className="mt-5 rounded-full bg-plum-dark text-cream px-6 py-2.5 text-sm font-bold">
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
        <button onClick={() => navigate({ to: "/student/classrooms" })} className="mt-5 rounded-full bg-plum-dark text-cream px-6 py-2.5 text-sm font-bold">
          ← My Classrooms
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate({ to: "/student/classrooms" })} className="text-slate-400 hover:text-plum-dark mt-1 shrink-0">
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
          {/* My progress bar */}
          <div className="mt-3 flex items-center gap-3 max-w-sm">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-plum rounded-full" style={{ width: `${myInfo?.progress || 0}%` }} />
            </div>
            <span className="text-xs font-mono text-plum-dark font-bold">{myInfo?.progress || 0}% complete</span>
          </div>
        </div>
      </div>

      {/* Grid tab bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto my-6">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border ${t.bg} ${t.text} ${t.border} transition-all relative overflow-hidden group aspect-square shadow-xs ${isActive
                  ? `scale-[1.04] ring-2 ring-offset-2 ring-offset-slate-50 shadow-md ${t.key === 'live' ? 'ring-[#E11D48]' : t.key === 'recordings' ? 'ring-[#EA580C]' : t.key === 'announcements' ? 'ring-[#2563EB]' : 'ring-[#059669]'}`
                  : "hover:scale-[1.02] hover:shadow-sm"
                }`}
            >
              {t.isLive && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[#E11D48] text-white text-[8px] font-extrabold tracking-wider uppercase animate-pulse">
                  LIVE
                </span>
              )}

              <t.icon className="w-8 h-8 mb-1.5 transition-transform group-hover:scale-110" style={{ color: t.iconColor }} />
              <span className="text-[10px] sm:text-xs font-black tracking-tight text-center leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents Area */}
      <div className="border-t border-slate-100 pt-6">
        <h2 className="font-display text-base font-extrabold text-slate-800 mb-4 capitalize">
          {tab === "announcements" ? "Study Material & Announcements" : tab === "live" ? "Live Classes" : tab === "recordings" ? "Recordings" : "Smart Tests & Quizzes"}
        </h2>

        {(() => {
          const classroomId = cls.id || (cls as any)._id || '';
          return (
            <>
              {tab === "announcements" && <AnnouncementsTab classroomId={classroomId} isFetching={isFetching} />}
              {tab === "live" && <LiveClassesTab classroomId={classroomId} isFetching={isFetching} />}
              {tab === "recordings" && <RecordingsTab classroomId={classroomId} isFetching={isFetching} />}
              {tab === "tests" && <TestsTab classroomId={classroomId} isFetching={isFetching} />}
            </>
          );
        })()}
      </div>
    </div>
  );
}