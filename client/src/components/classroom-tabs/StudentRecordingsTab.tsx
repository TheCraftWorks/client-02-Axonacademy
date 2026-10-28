import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, RotateCcw, RotateCw, Settings, Check, Gauge, ShieldAlert,
  ArrowLeft, BookOpen, Lock, Download, X
} from "lucide-react";
import { LuArrowLeft, LuFolder } from "react-icons/lu";
import { useClassroomStore, formatDuration, classroomActions } from "@/lib/classroomStore";
import { getRecordingStreamUrl, trackRecordingProgress, api } from "@/lib/api";
import { useVideoProtection } from "@/lib/video-protection";
import { toast } from "sonner";
import { TabSkeletonLoader, fmtDate } from "./shared";
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

  // Use a ref to track in-progress state so it doesn't cause useCallback to
  // recreate on every toggle (which would cause an infinite effect loop).
  const isRefreshingUrlRef = useRef(false);

  const refreshPlaybackUrl = useCallback(async () => {
    if (isRefreshingUrlRef.current) return;
    isRefreshingUrlRef.current = true;
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
      isRefreshingUrlRef.current = false;
      setIsRefreshingUrl(false);
    }
  }, [recordingId, accessToken]);

  // Eagerly resolve a fresh signed Cloudflare URL on mount if one isn't already embedded.
  // NOTE: refreshPlaybackUrl is stable (no isRefreshingUrl in deps) so this only fires
  // when recordingId actually changes ÔÇö no infinite loop.
  useEffect(() => {
    if (!isDirectSignedUrl && recordingId) {
      void refreshPlaybackUrl();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirectSignedUrl, recordingId]);

  useEffect(() => {
    const userId = currentUser?.id || currentUser?.userId;
    const stat = recording.viewStats?.find((v) => v.studentId === userId || (v as any).student === userId);
    totalWatchedRef.current = stat?.totalWatchedSec || 0;
  }, [currentUser?.id, currentUser?.userId, recordingId, recording.viewStats]);

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

  const isSendingProgressRef = useRef(false);

  const sendProgress = useCallback(async (force = false) => {
    if (isSendingProgressRef.current) return;
    const video = videoRef.current;
    const userId = currentUser?.id || currentUser?.userId;
    if (!video || !userId) return;

    const watchedSec = Math.floor(pendingWatchedRef.current);
    const currentPosition = Math.floor(video.currentTime || 0);
    const completed = (recording.duration > 0 && currentPosition >= recording.duration * 0.9) ||
      (video.duration > 0 && currentPosition >= video.duration * 0.9);
    const now = Date.now();

    if (!force && (watchedSec < 10 || now - lastSentAtRef.current < 10_000)) return;
    if (watchedSec <= 0 && !completed) return;

    isSendingProgressRef.current = true;
    pendingWatchedRef.current = 0;
    lastSentAtRef.current = now;

    try {
      const res = await trackRecordingProgress(recordingId, {
        position: currentPosition,
        watchedSec,
        completed,
      }) as any;
      
      const serverTotalWatchedSec = res?.progress?.totalWatchedSec;
      if (typeof serverTotalWatchedSec === 'number') {
        totalWatchedRef.current = serverTotalWatchedSec;
      } else {
        totalWatchedRef.current += watchedSec;
      }

      const recDuration = recording.duration || Math.floor(video.duration || 0);
      let watchedPercent = recDuration > 0
        ? Math.min(100, Math.round((totalWatchedRef.current / recDuration) * 100))
        : 0;

      if (completed) {
        watchedPercent = 100;
      }

      classroomActions.updateViewStat(
        classroomId,
        recordingId,
        userId,
        currentUser?.name || 'Student',
        watchedPercent,
        currentPosition,
        totalWatchedRef.current
      );
    } catch {
      pendingWatchedRef.current += watchedSec;
    } finally {
      isSendingProgressRef.current = false;
    }
  }, [classroomId, currentUser?.id, currentUser?.userId, currentUser?.name, recording.duration, recordingId]);

  const sendProgressRef = useRef(sendProgress);
  sendProgressRef.current = sendProgress;

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
      void sendProgressRef.current(true);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      void sendProgressRef.current(true);
    };
    const handleBeforeUnload = () => {
      void sendProgressRef.current(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    window.addEventListener('beforeunload', handleBeforeUnload);
    const interval = window.setInterval(() => void sendProgressRef.current(), 15_000);

    return () => {
      window.clearInterval(interval);
      if (pendingWatchedRef.current >= 5) {
        void sendProgressRef.current(true);
      }
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.id, recording.id, playbackSpeed]);

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
              className="w-full h-full max-h-full object-contain bg-black no-select select-none pointer-events-auto"
              controls={!isBuffering}
              autoPlay
              onError={handleVideoError}
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              disableRemotePlayback
              // @ts-ignore ÔÇö non-standard AirPlay attribute for Safari iOS
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
                Loading video...
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
                  : "Focus was lost ÔÇö this may indicate a screen recording tool, notification shade, or app switch."}
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

// ÔöÇÔöÇÔöÇ Quiz Tab ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

export { RecordingsTab as StudentRecordingsTab };