import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Megaphone, Video, BookOpen, ClipboardList,
  Play, Check, X, Clock, Calendar, ChevronRight,
  Trophy, Radio, Lock, ShieldAlert, Download,
  DollarSign, FileText, MessageSquare, HelpCircle, LifeBuoy,
  Pause, RotateCcw, RotateCw, Settings, Gauge
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
  isClassroomStale,
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

export const Route = createFileRoute("/_student/student/classroom/$id")({
  component: StudentClassroomDetail,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
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

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab({ classroomId }: { classroomId: string }) {
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);
  if (!cls) return null;

  const announcements = cls.announcements || [];

  return (
    <div className="space-y-3">
      {announcements.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
          <Megaphone className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No announcements yet. Check back later.</p>
        </div>
      )}
      {announcements.map((ann) => (
        <div key={ann.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum-dark text-cream font-bold text-xs">
              {ann.author.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-plum-dark text-sm font-semibold">{ann.author}</span>
                <span className="text-slate-400 text-xs">{timeAgo(ann.createdAt)}</span>
              </div>
              <p className="text-slate-700 text-sm leading-relaxed">{ann.content}</p>
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
                        {"Attachment"}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Live Classes Tab ─────────────────────────────────────────────────────────

function LiveClassesTab({ classroomId }: { classroomId: string }) {
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);
  if (!cls) return null;

  const meetings = cls.meetings || [];
  const upcoming = meetings
    .filter((m) => m.status === "scheduled" || m.status === "live")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  const past = meetings
    .filter((m) => m.status === "ended")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  return (
    <div className="space-y-5">
      {meetings.length === 0 && (
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
    <div className="fixed inset-0 z-50 bg-black flex flex-col no-select select-none" onContextMenu={(e) => e.preventDefault()}>
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
      <div className="flex items-center justify-between px-5 py-3 bg-black/90 border-b border-white/10 z-40 relative">
        <span className="text-white font-semibold text-sm truncate max-w-md">{recording.title}</span>
        <div className="flex items-center gap-3 no-gesture">
          {/* Quality Selector */}
          <div className="relative">
            <button
              onClick={() => {
                setShowQualityMenu((v) => !v);
                setShowSpeedMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/10"
              title="Select video quality"
            >
              <Settings className="h-3.5 w-3.5 text-lime" />
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/10"
              title="Select playback speed"
            >
              <Gauge className="h-3.5 w-3.5 text-lime" />
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
      <div className="flex flex-1 relative select-none">
        <div
          onClick={handleVideoAreaClick}
          className="flex-1 bg-linear-to-br from-plum-dark/90 to-[#0B0719] flex items-center justify-center relative cursor-pointer"
        >
          {resolvedStreamUrl ? (
            <video
              ref={videoRef}
              src={resolvedStreamUrl}
              crossOrigin="anonymous"
              className="w-full h-[95vh] object-contain bg-black no-select select-none pointer-events-auto"
              controls
              autoPlay
              onError={handleVideoError}
              controlsList="nodownload nofullscreen noremoteplayback"
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
                {!useProxyFallback && (
                  <button
                    onClick={() => {
                      setFatalError(null);
                      setUseProxyFallback(true);
                      setRetryCount(2);
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
                    Force Proxy Streaming
                  </button>
                )}
                <button
                  onClick={() => {
                    setFatalError(null);
                    setRetryCount(0);
                    setUseProxyFallback(false);
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
                  Retry Direct Stream
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
          <div className="w-56 bg-[#111] border-l border-white/10 overflow-y-auto">
            <div className="p-3 border-b border-white/10 text-white/70 text-xs uppercase tracking-widest">Chapters</div>
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setPosition(ch.startTimeSec)}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-white/5 transition-colors ${position >= ch.startTimeSec ? "text-white" : "text-white/50"}`}
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

function RecordingsTab({ classroomId }: { classroomId: string }) {
  const { classrooms, currentUser } = useClassroomStore();
  const CURRENT_STUDENT = { id: currentUser?.id || "", name: currentUser?.name || "" };
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);
  const [activeRec, setActiveRec] = useState<string | null>(null);

  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  if (!cls) return null;

  const publishedRecordings = (cls.recordings || []).filter((r) => r.isPublished);
  const activeRecording = publishedRecordings.find((r) => (r.id || (r as any)._id) === activeRec);

  // Compute folder list: only show folders containing at least one published recording
  const folders = (cls.folders || []).filter(folder =>
    publishedRecordings.some(r => r.folder === (folder.id || (folder as any)._id))
  );

  const currentFolder = folders.find(f => (f.id || (f as any)._id) === currentFolderId);

  // Filter recordings for the current view
  const visibleRecordings = currentFolderId
    ? publishedRecordings.filter(rec => rec.folder === currentFolderId)
    : [];

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {folders.map(folder => {
              const videoCount = publishedRecordings.filter(r => r.folder === folder.id).length;
              return (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:border-plum/30 transition-all text-left shadow-sm hover:shadow-md w-full"
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
        )}

        {!currentFolderId && folders.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
            <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No folders created yet.</p>
          </div>
        )}

        {/* Videos list */}
        {currentFolderId && (
          <div className="space-y-3">
            {visibleRecordings.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-sm">
                <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No videos inside this folder.</p>
              </div>
            )}

            {visibleRecordings.map((rec) => {
              const recId = rec.id || (rec as any)._id || '';
              const viewStats = rec.viewStats || [];
              const chapters = rec.chapters || [];
              const myStats = viewStats.find((v) => v.studentId === CURRENT_STUDENT.id);
              return (
                <div key={recId} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-plum/30 hover:shadow-md transition-all shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-14 rounded-xl bg-linear-to-br from-plum/20 to-plum-dark/10 flex items-center justify-center shrink-0">
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
                      className="rounded-full bg-plum-dark text-cream px-4 py-2 text-xs font-bold flex items-center gap-1.5 shrink-0 hover:bg-plum transition-colors shadow-sm"
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
    explanation: string;
    correctOptions: string[];
  }>;
};

function TestsTab({ classroomId }: { classroomId: string }) {
  const { classrooms, currentUser } = useClassroomStore();
  const CURRENT_STUDENT = { id: currentUser?.id || "", name: currentUser?.name || "" };
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);
  if (!cls) return null;

  const [phase, setPhase] = useState<QuizPhase>("list");
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResultReview | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const answersRef = useRef(answers);
  const submitQuizRef = useRef<() => void>(() => { });

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const submittingQuizRef = useRef(false);

  const submitQuiz = useCallback(async () => {
    if (!activeQuiz || !attemptId || submittingQuizRef.current) return;
    submittingQuizRef.current = true;
    setError("");
    setIsSubmitting(true);
    try {
      const currentAnswers = answersRef.current;
      await saveQuizAnswersBulk(activeQuiz.id, {
        attemptId,
        answers: examQuestions.map((q) => ({
          questionId: q.id,
          selectedOptions: currentAnswers[q.id] || [],
        })),
      });
      await submitQuizAttempt(activeQuiz.id, attemptId);
      const review = await getQuizAttemptResult(activeQuiz.id, attemptId);
      setResult(review);
      toast.success("Quiz submitted successfully!");
      const refreshed = await getClassroomById(classroomId);
      classroomActions.updateClassroom(classroomId, refreshed);
      setPhase("result");
    } catch (err) {
      submittingQuizRef.current = false;
      const msg = err instanceof Error ? err.message : "Could not submit quiz";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeQuiz, attemptId, classroomId, examQuestions]);

  useEffect(() => {
    submitQuizRef.current = () => { void submitQuiz(); };
  }, [submitQuiz]);

  // Timer effect
  useEffect(() => {
    if (phase !== "taking" || !activeQuiz?.duration) return;
    setTimeLeft(activeQuiz.duration * 60);
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(t);
          submitQuizRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, activeQuiz]);

  const startQuiz = (quiz: Quiz) => {
    setActiveQuiz(quiz);
    setExamQuestions([]);
    setAttemptId(null);
    setAnswers({});
    setResult(null);
    setError("");
    setPhase("intro");
  };

  const beginTaking = async () => {
    if (!activeQuiz || isStarting) return;
    setError("");
    setIsStarting(true);
    try {
      const started = await startQuizAttempt(activeQuiz.id);
      if (started.alreadySubmitted) {
        toast.info(started.message || "You have already submitted this quiz.");
        if (started.attemptId) {
          const review = await getQuizAttemptResult(activeQuiz.id, started.attemptId);
          setResult(review);
        }
        setPhase("result");
        return;
      }
      setAttemptId(started.attemptId!);
      setExamQuestions(started.questions);
      setAnswers({});
      setPhase("taking");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start quiz";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsStarting(false);
    }
  };

  const selectAnswer = (qId: string, label: string, isMulti: boolean) => {
    setAnswers((prev) => {
      const current = prev[qId] || [];
      if (isMulti) {
        return { ...prev, [qId]: current.includes(label) ? current.filter((l) => l !== label) : [...current, label] };
      }
      return { ...prev, [qId]: [label] };
    });
  };

  const publishedQuizzes = cls.quizzes.filter((q) => q.status === "published");

  // List view
  if (phase === "list") {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {publishedQuizzes.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center">
            <ClipboardList className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No tests published yet.</p>
          </div>
        )}
        {publishedQuizzes.map((q) => {
          const myAttempts = q.attempts.filter((a) => a.studentId === CURRENT_STUDENT.id && a.status === "submitted");
          const bestAttempt = myAttempts.sort((a, b) => b.score.percentage - a.score.percentage)[0];
          const canAttempt = myAttempts.length < q.maxAttempts;

          return (
            <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <h4 className="font-display font-bold text-plum-dark mb-1">{q.title}</h4>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>{q.questions.length} questions</span>
                    <span>{q.questions.reduce((s, x) => s + x.marks, 0)} marks</span>
                    {q.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {q.duration} min</span>}
                    <span>Pass: {q.passPercent}%</span>
                    <span>Attempts: {myAttempts.length}/{q.maxAttempts}</span>
                  </div>
                  {(q.availableFrom || q.availableUntil) && (
                    <div className="text-xs text-[#0284C7] font-medium mt-2 bg-[#F0F9FF] rounded-lg px-3 py-1.5 inline-flex flex-wrap items-center gap-x-2 gap-y-1 border border-[#BAE6FD]">
                      <span className="font-bold text-[#0369A1]">Availability:</span>
                      {q.availableFrom && <span>Starts: {fmtDate(q.availableFrom)}</span>}
                      {q.availableUntil && <span>Ends: {fmtDate(q.availableUntil)}</span>}
                    </div>
                  )}
                  {bestAttempt && (
                    <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${bestAttempt.score.passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {bestAttempt.score.passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      Best score: {bestAttempt.score.percentage}% — {bestAttempt.score.passed ? "Passed ✓" : "Failed"}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {bestAttempt && (
                    <button
                      onClick={async () => {
                        try {
                          setError("");
                          const review = await getQuizAttemptResult(q.id, bestAttempt.id);
                          setActiveQuiz(q);
                          setResult(review);
                          setPhase("result");
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Could not load quiz review");
                        }
                      }}
                      className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 text-sm font-bold"
                    >
                      Review Answers
                    </button>
                  )}
                  <button
                    onClick={() => startQuiz(q)}
                    disabled={!canAttempt}
                    className={`rounded-full px-2 py-2.5 text-sm font-bold ${canAttempt ? "bg-plum-dark text-cream hover:bg-plum" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                  >
                    {!canAttempt ? "Completed" : myAttempts.length > 0 ? "Retry" : "Start Quiz"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Intro view
  if (phase === "intro" && activeQuiz) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-plum-dark/10 mx-auto mb-4">
            <ClipboardList className="h-8 w-8 text-plum-dark" />
          </div>
          <h2 className="font-display text-2xl font-bold text-plum-dark mb-2">{activeQuiz.title}</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">{activeQuiz.instructions}</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { l: "Questions", v: activeQuiz.questions.length },
              { l: "Total Marks", v: activeQuiz.questions.reduce((s, q) => s + q.marks, 0) },
              { l: "Pass Mark", v: `${activeQuiz.passPercent}%` },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-slate-50 p-3">
                <div className="text-[10px] uppercase tracking-widest text-slate-400">{s.l}</div>
                <div className="font-display text-xl font-bold text-plum-dark">{s.v}</div>
              </div>
            ))}
          </div>
          {activeQuiz.duration && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-sm text-amber-700 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              Time limit: {activeQuiz.duration} minutes. The quiz will auto-submit when time runs out.
            </div>
          )}
          {activeQuiz.negativeMarking && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-600">
              ⚠️ Negative marking: −{activeQuiz.negativeMarkValue} marks per wrong answer.
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4 text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setPhase("list")} className="flex-1 rounded-full border border-slate-200 text-slate-600 py-3 text-sm font-semibold">Cancel</button>
            <button onClick={beginTaking} disabled={isStarting} className="flex-1 rounded-full bg-plum-dark text-cream py-3 text-sm font-bold disabled:opacity-50">
              {isStarting ? "Starting…" : "Start Quiz →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Taking quiz view
  if (phase === "taking" && activeQuiz) {
    const answered = Object.keys(answers).length;

    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#F5F3FF] py-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 flex items-center justify-between">
            <span className="text-plum-dark font-semibold text-sm">{activeQuiz.title}</span>
            <div className="flex items-center gap-4">
              <span className="text-slate-500 text-xs">{answered}/{examQuestions.length} answered</span>
              {timeLeft !== null && (
                <span className={`font-mono text-sm font-bold ${timeLeft < 120 ? "text-red-500" : "text-plum-dark"}`}>
                  <Clock className="h-3.5 w-3.5 inline mr-1" />
                  {Math.floor(timeLeft / 60).toString().padStart(2, "0")}:{(timeLeft % 60).toString().padStart(2, "0")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Questions */}
        {examQuestions.map((q, i) => (
          <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-plum-dark text-cream text-xs font-bold">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-plum-dark font-semibold text-sm">{q.text}</span>
                </div>
                <div className="text-slate-400 text-xs">
                  {q.marks} mark{q.marks !== 1 ? "s" : ""} ·{" "}
                  {q.type === "msq" ? "Select all correct answers" : "Select one answer"}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {q.options.map((opt) => {
                const selected = answers[q.id]?.includes(opt.label);
                return (
                  <button
                    key={opt.label}
                    onClick={() => selectAnswer(q.id, opt.label, q.type === "msq")}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border text-left transition-colors ${selected ? "border-plum bg-plum/5" : "border-slate-200 hover:border-plum/30 hover:bg-slate-50"}`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold transition-colors ${selected ? "bg-plum-dark border-plum-dark text-cream" : "border-slate-300 text-slate-400"}`}>
                      {selected ? <Check className="h-3 w-3" /> : opt.label}
                    </span>
                    <span className="text-sm text-slate-700">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Submit */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center justify-between">
          <div className="text-slate-500 text-sm">
            {answered < examQuestions.length
              ? `${examQuestions.length - answered} question${examQuestions.length - answered !== 1 ? "s" : ""} unanswered`
              : "All questions answered ✓"}
          </div>
          <button
            onClick={() => void submitQuiz()}
            disabled={isSubmitting}
            className="rounded-full bg-plum-dark text-cream px-8 py-3 text-sm font-bold hover:bg-plum transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : "Submit Quiz"}
          </button>
        </div>
      </div>
    );
  }

  // Result view
  if (phase === "result" && result && activeQuiz) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div className={`grid h-20 w-20 place-items-center rounded-full mx-auto mb-4 ${result.score.passed ? "bg-green-100" : "bg-red-100"}`}>
            {result.score.passed
              ? <Trophy className="h-10 w-10 text-green-600" />
              : <X className="h-10 w-10 text-red-500" />}
          </div>
          <h2 className="font-display text-3xl font-bold text-plum-dark mb-1">{result.score.percentage}%</h2>
          <p className={`text-lg font-semibold mb-2 ${result.score.passed ? "text-green-600" : "text-red-500"}`}>
            {result.score.passed ? "🎉 Congratulations! You Passed!" : "Keep trying — you can do this!"}
          </p>
          <p className="text-slate-500 text-sm mb-6">
            {result.score.rawMarks} / {result.score.totalMarks} marks · Pass mark: {activeQuiz.passPercent}%
          </p>
          <button onClick={() => setPhase("list")} className="rounded-full bg-plum-dark text-cream px-8 py-3 text-sm font-bold">
            ← Back to Tests
          </button>
        </div>

        {/* Answer review */}
        <div className="space-y-3">
          <h3 className="font-display font-bold text-plum-dark">Answer Review</h3>
          {result.answers.map((myAns, i) => {
            const quizQ = activeQuiz.questions.find(q => q.id === myAns.questionId)
              || activeQuiz.questions.find(q => q.text === myAns.questionText)
              || activeQuiz.questions[i];
            return (
              <div key={myAns.questionId} className={`rounded-2xl border p-5 ${myAns.isCorrect ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-start gap-2 mb-3">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${myAns.isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                    {myAns.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <p className="text-slate-800 text-sm font-semibold flex-1">Q{i + 1}. {myAns.questionText || quizQ?.text || ""}</p>
                  <span className="text-xs font-mono text-slate-500 shrink-0">{myAns.marksAwarded} marks</span>
                </div>
                {quizQ && quizQ.options.length > 0 && (
                  <div className="ml-8 space-y-1.5 mb-3">
                    {quizQ.options.map((opt) => {
                      const isSelected = myAns.selectedOptions.includes(opt.label);
                      const isCorrectOpt = myAns.correctOptions.includes(opt.label);
                      let optClass = "border-slate-200 bg-white text-slate-600";
                      if (isCorrectOpt && isSelected) optClass = "border-green-500 bg-green-100 text-green-800 font-semibold";
                      else if (isCorrectOpt) optClass = "border-green-400 bg-green-50 text-green-700 font-semibold";
                      else if (isSelected) optClass = "border-red-400 bg-red-100 text-red-700";
                      let badge: React.ReactNode = null;
                      if (isCorrectOpt && isSelected) badge = <span className="ml-auto text-green-600 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">✓ Your answer (Correct)</span>;
                      else if (isCorrectOpt) badge = <span className="ml-auto text-green-600 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">✓ Correct Answer</span>;
                      else if (isSelected) badge = <span className="ml-auto text-red-500 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">✗ Your answer (Wrong)</span>;
                      return (
                        <div key={opt.label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${optClass}`}>
                          <span className={`h-5 w-5 shrink-0 grid place-items-center rounded-full text-[10px] font-bold border ${isCorrectOpt ? "bg-green-500 border-green-500 text-white"
                              : isSelected ? "bg-red-400 border-red-400 text-white"
                                : "border-slate-300 text-slate-400"
                            }`}>
                            {isCorrectOpt ? <Check className="h-3 w-3" /> : isSelected ? <X className="h-3 w-3" /> : opt.label}
                          </span>
                          <span>{opt.text}</span>
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                )}
                {myAns.explanation && (
                  <p className="text-xs text-slate-500 ml-8 mt-1 italic">💡 {myAns.explanation}</p>
                )}
              </div>
            );
          })}
        </div>
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
  const [loadError, setLoadError] = useState<string | null>(null);

  const cls = classrooms.find((c) => c.id === id || (c as any)._id === id);
  const myInfo = cls?.students?.find((s) => s.id === CURRENT_STUDENT.id);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoadError(null);
        const hasCached = classrooms.some((c) => c.id === id || (c as any)._id === id);
        if (hasCached && !isClassroomStale(id)) return;
        if (!hasCached) setIsLoading(true);
        const refreshed = await getClassroomById(id);
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
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 text-sm">Loading classroom...</p>
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

  if (!cls || !myInfo || myInfo.status !== "active") {
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
              {tab === "announcements" && <AnnouncementsTab classroomId={classroomId} />}
              {tab === "live" && <LiveClassesTab classroomId={classroomId} />}
              {tab === "recordings" && <RecordingsTab classroomId={classroomId} />}
              {tab === "tests" && <TestsTab classroomId={classroomId} />}
            </>
          );
        })()}
      </div>
    </div>
  );
}