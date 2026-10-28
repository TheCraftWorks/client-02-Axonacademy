import React, { useState, useRef, useMemo } from "react";
import {
  LuPlay, LuEye, LuEyeOff, LuTrash2, LuUpload, LuDownload, LuCopy, LuLink,
  LuAward, LuFolder, LuSearch, LuPrinter, LuRefreshCw, LuCrown, LuMedal,
  LuSparkles, LuTrophy, LuFileText, LuLoader, LuX, LuPlus, LuZoomIn,
  LuArrowLeft, LuVideo
} from "react-icons/lu";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import type { Classroom } from "@/lib/classroomStore";
import {
  uploadClassroomRecordingToCloudflare, publishRecording, unpublishRecording,
  deleteRecording, getRecordingStreamUrl, reuseClassroomRecording,
  uploadClassroomFileToCloudinary, api, createClassroomFolder, updateClassroomFolder,
  deleteClassroomFolder, getClassroomReuseList, reuseClassroomFolder
} from "@/lib/api";
import { PdfViewerModal } from "@/components/portal/PdfViewerModal";
import { toast } from "sonner";
import { formatDuration } from "@/lib/classroomStore";
import { DarkTabSkeletonLoader, fmtDate, fmtShortDate, fmtTime, timeAgo } from "./shared";

function RecordingsTab({ classroom, refreshClassroom }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom> }) {
  const cls = classroom;
  const { accessToken } = useClassroomStore();
  const [activeRec, setActiveRec] = useState<any | null>(null);

  // Classroom Folders & Selective navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // Folder CRUD States
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");

  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderDesc, setEditFolderDesc] = useState("");

  // Video Upload States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPublished, setUploadPublished] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadBytes, setUploadBytes] = useState({ loaded: 0, total: 0 });
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'preparing' | 'uploading' | 'saving'>('idle');
  const [uploadPartInfo, setUploadPartInfo] = useState<{ part: number; totalParts: number } | null>(null);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [isUploadRetrying, setIsUploadRetrying] = useState(false);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  const handleCancelUpload = () => {
    if (uploadAbortControllerRef.current) {
      try {
        uploadAbortControllerRef.current.abort();
      } catch { }
      uploadAbortControllerRef.current = null;
      toast.info("Upload cancelled");
    }
    setIsUploadModalOpen(false);
    setUploadTitle("");
    setUploadDesc("");
    setUploadFile(null);
    setUploadPublished(false);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadBytes({ loaded: 0, total: 0 });
    setUploadPhase('idle');
    setUploadStatusText("");
    setIsUploadRetrying(false);
    setUploadPartInfo(null);
  };

  // Video Edit States
  const [editRecId, setEditRecId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTargetFolderId, setEditTargetFolderId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  // Reuse Modal States
  const [showReuseModal, setShowReuseModal] = useState(false);
  const [reuseClassrooms, setReuseClassrooms] = useState<any[]>([]);
  const [reuseFolders, setReuseFolders] = useState<any[]>([]);
  const [reuseRecordings, setReuseRecordings] = useState<any[]>([]);
  const [isLoadingReuseList, setIsLoadingReuseList] = useState(false);
  const [hasLoadedReuseList, setHasLoadedReuseList] = useState(false);

  const [selectedSourceClassroomId, setSelectedSourceClassroomId] = useState<string>("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Selection tracking
  // Keys are folderId (for whole folder) or recordingId (for individual recording)
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);

  const [isReusing, setIsReusing] = useState(false);

  const formatMB = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createClassroomFolder(cls.id, newFolderName.trim(), newFolderDesc.trim());
      toast.success("Folder created successfully!");
      setIsFolderModalOpen(false);
      setNewFolderName("");
      setNewFolderDesc("");
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to create folder");
    }
  };

  const handleEditFolder = async () => {
    if (!editFolderId || !editFolderName.trim()) return;
    try {
      await updateClassroomFolder(editFolderId, editFolderName.trim(), editFolderDesc.trim());
      toast.success("Folder updated successfully!");
      setEditFolderId(null);
      setEditFolderName("");
      setEditFolderDesc("");
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to update folder");
    }
  };

  const handleDeleteFolder = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete folder "${name}"? All videos inside it will be permanently deleted.`)) return;
    try {
      await deleteClassroomFolder(id);
      toast.success("Folder and its videos deleted!");
      if (currentFolderId === id) setCurrentFolderId(null);
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete folder");
    }
  };

  const handleUploadVideo = async () => {
    if (!uploadTitle.trim() || !uploadFile) {
      toast.error("Title and video file are required");
      return;
    }

    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadBytes({ loaded: 0, total: uploadFile.size });
    setUploadPhase('preparing');
    setUploadStatusText('Preparing video metadata...');
    setIsUploadRetrying(false);

    try {
      // Extract video duration in seconds on the client side with a safety timeout
      let calculatedDuration = 0;
      try {
        calculatedDuration = await new Promise<number>((resolve) => {
          const timeoutId = setTimeout(() => {
            try {
              if (video.src) window.URL.revokeObjectURL(video.src);
            } catch { }
            resolve(0);
          }, 2000);

          const video = document.createElement('video');
          video.preload = 'metadata';
          video.onloadedmetadata = () => {
            clearTimeout(timeoutId);
            try {
              window.URL.revokeObjectURL(video.src);
            } catch { }
            resolve(Math.round(video.duration) || 0);
          };
          video.onerror = () => {
            clearTimeout(timeoutId);
            try {
              window.URL.revokeObjectURL(video.src);
            } catch { }
            resolve(0);
          };
          video.src = URL.createObjectURL(uploadFile);
        });
      } catch (durationErr) {
        console.error("Failed to parse video duration, defaulting to 0:", durationErr);
      }

      await uploadClassroomRecordingToCloudflare({
        file: uploadFile,
        classroom: cls.id,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        duration: calculatedDuration,
        isPublished: uploadPublished,
        folderId: currentFolderId || undefined,
        signal: abortController.signal,
        onProgress: ({ loaded, total, percentage, part, totalParts, statusText, isRetrying }) => {
          setUploadPhase(percentage === 100 ? 'saving' : 'uploading');
          setUploadProgress(percentage);
          setUploadBytes({ loaded, total });
          if (statusText) setUploadStatusText(statusText);
          setIsUploadRetrying(!!isRetrying);
          if (part != null && totalParts != null) {
            setUploadPartInfo({ part, totalParts });
          }
        }
      });

      toast.success("Video uploaded successfully!");
      setIsUploadModalOpen(false);
      setUploadTitle("");
      setUploadDesc("");
      setUploadFile(null);
      setUploadPublished(false);
      setUploadPhase('idle');
      setUploadStatusText("");
      setIsUploadRetrying(false);
      await refreshClassroom();
    } catch (err: any) {
      if (err.message === "Upload cancelled") {
        toast.info("Upload cancelled");
      } else {
        toast.error(err.message || "Failed to upload video");
      }
      setUploadPhase('idle');
      setUploadStatusText("");
      setIsUploadRetrying(false);
    } finally {
      uploadAbortControllerRef.current = null;
      setIsUploading(false);
      setUploadProgress(0);
      setUploadBytes({ loaded: 0, total: 0 });
      setUploadPartInfo(null);
      setIsUploadRetrying(false);
    }
  };

  const handleEditRecording = async () => {
    if (!editRecId || !editTitle.trim()) return;
    setIsEditing(true);
    try {
      const payload: any = {
        title: editTitle.trim(),
        description: editDesc.trim(),
        folder: editTargetFolderId ? editTargetFolderId : null
      };
      await api.put(`/recordings/classroom/${editRecId}`, payload);
      toast.success("Video details updated!");
      setEditRecId(null);
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to update video");
    } finally {
      setIsEditing(false);
    }
  };

  const fetchReuseList = async (force = false) => {
    if (isLoadingReuseList) return;
    setIsLoadingReuseList(true);
    try {
      const res = await getClassroomReuseList() as any;
      if (res && res.success) {
        setReuseClassrooms(res.classrooms || []);
        setReuseFolders(res.folders || []);
        setReuseRecordings(res.recordings || []);
        setHasLoadedReuseList(true);
      }
    } catch (err: any) {
      toast.error("Failed to load classrooms for reuse");
    } finally {
      setIsLoadingReuseList(false);
    }
  };

  const openReuseModal = () => {
    setShowReuseModal(true);
    if (!hasLoadedReuseList || reuseClassrooms.length === 0) {
      fetchReuseList();
    }
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleConfirmReuse = async () => {
    if (selectedFolderIds.length === 0 && selectedRecIds.length === 0) {
      toast.error("Please select folders or videos to reuse");
      return;
    }

    setIsReusing(true);
    try {
      // Find all folders for the selected source classroom
      const sourceFolders = reuseFolders.filter(
        f => (f.classroom?.toString() || f.classroom) === selectedSourceClassroomId
      );

      // Collect folder IDs from sourceFolders as well as any folder referenced by selected recordings
      const folderMap = new Map<string, any>();
      for (const f of sourceFolders) {
        const fId = (f._id || f.id).toString();
        folderMap.set(fId, f);
      }
      for (const rec of reuseRecordings) {
        const rClassroomId = (rec.classroom?.toString() || rec.classroom);
        const rFolderId = (rec.folder?._id || rec.folder?.id || rec.folder)?.toString();
        const recId = (rec._id || rec.id).toString();
        if (rClassroomId === selectedSourceClassroomId && rFolderId && selectedRecIds.includes(recId)) {
          if (!folderMap.has(rFolderId)) {
            folderMap.set(rFolderId, { _id: rFolderId, id: rFolderId });
          }
        }
      }

      // 1. Process folders (whole folder or selected subset of recordings)
      for (const [folderId] of folderMap) {
        const folderRecs = reuseRecordings.filter(r => {
          const rFolderId = (r.folder?._id || r.folder?.id || r.folder)?.toString();
          return rFolderId === folderId;
        });
        const folderRecIds = folderRecs.map(r => (r._id || r.id).toString());
        const selectedInFolder = folderRecIds.filter(id => selectedRecIds.includes(id));
        const isFolderExplicitlyChecked = selectedFolderIds.includes(folderId);

        if (isFolderExplicitlyChecked && (folderRecs.length === 0 || selectedInFolder.length === folderRecs.length)) {
          // Whole folder reuse
          await reuseClassroomFolder(folderId, cls.id);
        } else if (selectedInFolder.length > 0) {
          // Individual recordings inside this folder (subset)
          await reuseClassroomFolder(folderId, cls.id, selectedInFolder);
        }
      }

      // 2. Reuse root recordings (recordings with no folder in source classroom)
      const rootRecs = reuseRecordings.filter(r => {
        const rClassroomId = (r.classroom?.toString() || r.classroom);
        const rFolderId = (recFolder => (recFolder?._id || recFolder?.id || recFolder)?.toString())(r.folder);
        const recId = (r.id || r._id).toString();
        return rClassroomId === selectedSourceClassroomId && !rFolderId && selectedRecIds.includes(recId);
      });

      for (const rec of rootRecs) {
        const recId = (rec.id || rec._id).toString();
        await reuseClassroomRecording({
          sourceRecordingId: recId,
          targetClassroomId: cls.id,
          folderId: currentFolderId || undefined
        });
      }

      toast.success("Assets reused successfully!");
      setShowReuseModal(false);
      setSelectedFolderIds([]);
      setSelectedRecIds([]);
      setSelectedSourceClassroomId("");
      setHasLoadedReuseList(false);
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to reuse files");
    } finally {
      setIsReusing(false);
    }
  };

  // Filters for current view
  const visibleFolders = cls.folders || [];
  const visibleRecordings = currentFolderId
    ? (cls.recordings || []).filter(r => r.folder === currentFolderId)
    : [];

  const isAdminDirectSigned = Boolean(
    activeRec?.cloudflareUrl &&
    (activeRec.cloudflareUrl.includes('X-Amz-Signature') || activeRec.cloudflareUrl.includes('X-Amz-Algorithm'))
  );

  const streamUrl = activeRec
    ? (isAdminDirectSigned
      ? activeRec.cloudflareUrl
      : `${getRecordingStreamUrl(activeRec.id)}${accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''}`)
    : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          {currentFolderId ? (
            <div className="flex items-center gap-2 text-sm text-cream/60">
              <button
                className="hover:text-cream flex items-center gap-1 transition-colors font-bold"
                onClick={() => setCurrentFolderId(null)}
              >
                <LuArrowLeft className="w-4 h-4" /> Recordings
              </button>
              <span className="text-cream/40">/</span>
              <span className="font-bold text-lime">
                {visibleFolders.find(f => f.id === currentFolderId)?.name}
              </span>
            </div>
          ) : (
            <div className="text-sm font-semibold text-cream/80">Folder Structure</div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={openReuseModal}
            className="inline-flex items-center gap-2 rounded-full bg-[#F4B400] text-plum-dark px-4 py-2.5 text-xs font-bold shadow-sm hover:bg-[#E0A300] transition-colors"
          >
            <LuCopy className="h-4 w-4" /> Reuse Assets
          </button>
          {!currentFolderId && (
            <button
              onClick={() => setIsFolderModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-cream/10 text-cream px-4 py-2.5 text-xs font-bold hover:bg-cream/20 transition-colors"
            >
              <LuFolder className="h-4 w-4" /> New Folder
            </button>
          )}
          {currentFolderId && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-4 py-2.5 text-xs font-bold hover:bg-lime/90 transition-colors"
            >
              <LuUpload className="h-4 w-4" /> Upload Video
            </button>
          )}
        </div>
      </div>

      {/* Grid of Folders (only visible at root) */}
      {!currentFolderId && visibleFolders.length > 0 && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-cream/50 font-bold">Folders</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {visibleFolders.map((folder) => {
              const videoCount = (cls.recordings || []).filter(r => r.folder === folder.id).length;
              return (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-cream/10 bg-cream/5 hover:border-lime/40 hover:bg-cream/10 transition-all group"
                >
                  <button
                    onClick={() => setCurrentFolderId(folder.id)}
                    className="flex items-center gap-3 text-left flex-1 min-w-0"
                  >
                    <div className="w-9 h-9 rounded-lg bg-lime/10 text-lime flex items-center justify-center shrink-0">
                      <LuFolder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-cream text-xs truncate">{folder.name}</div>
                      {folder.description && (
                        <div className="text-[10px] text-cream/50 truncate mt-0.5">{folder.description}</div>
                      )}
                      <div className="text-[9px] text-cream/40 mt-1 font-semibold">{videoCount} videos</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      className="p-1.5 hover:bg-cream/10 rounded-lg text-cream/60 hover:text-cream text-xs font-bold"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditFolderId(folder.id);
                        setEditFolderName(folder.name);
                        setEditFolderDesc(folder.description || "");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id, folder.name);
                      }}
                    >
                      <LuTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!currentFolderId && visibleFolders.length === 0 && (
        <DarkCard className="text-center py-12">
          <LuFolder className="h-8 w-8 text-cream/20 mx-auto mb-2" />
          <p className="text-cream/50 text-sm">No folders created yet.</p>
          <p className="text-cream/40 text-xs mt-1">Create a folder to start uploading and managing videos inside.</p>
        </DarkCard>
      )}

      {/* Videos Section */}
      {currentFolderId && (
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-cream/50 font-bold">
            Videos in Folder
          </div>
          {visibleRecordings.length === 0 ? (
            <DarkCard className="text-center py-10">
              <LuVideo className="h-8 w-8 text-cream/20 mx-auto mb-2" />
              <p className="text-cream/50 text-sm">No videos here yet. Upload or reuse to add one.</p>
            </DarkCard>
          ) : (
            <DarkCard className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-cream/5">
                    <tr className="text-left text-[10px] uppercase tracking-widest text-cream/60 border-b border-cream/10">
                      <th className="p-4 text-center w-12">#</th>
                      <th>Recording</th>
                      <th>Duration</th>
                      <th>Stats</th>
                      <th>Chapters</th>
                      <th>Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream/10">
                    {visibleRecordings.map((rec, index) => {
                      const avgWatch = rec.viewStats.length
                        ? Math.round(rec.viewStats.reduce((s, v) => s + v.watchedPercent, 0) / rec.viewStats.length)
                        : 0;
                      return (
                        <React.Fragment key={rec.id}>
                          <tr className="hover:bg-cream/5 transition-colors">
                            <td className="p-4 text-center font-mono text-cream/60">{index + 1}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => setActiveRec(rec)}
                                  className="w-12 h-9 rounded bg-linear-to-br from-lime/20 to-lime/5 flex items-center justify-center shrink-0 hover:from-lime/30 hover:to-lime/10 transition-colors"
                                >
                                  <LuPlay className="h-3.5 w-3.5 text-lime" />
                                </button>
                                <div className="min-w-0">
                                  <div className="font-semibold text-cream text-xs">{rec.title}</div>
                                  {rec.description && (
                                    <div className="text-[10px] text-cream/50 line-clamp-1 mt-0.5">{rec.description}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-cream/70 text-xs">
                              {formatDuration(rec.duration)}
                            </td>
                            <td className="p-4 text-cream/70 text-xs">
                              {rec.viewStats.length} viewers Â· {avgWatch}% avg
                            </td>
                            <td className="p-4 font-mono text-cream/70 text-xs">
                              {rec.chapters.length}
                            </td>
                            <td className="p-4">
                              <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${rec.isPublished ? "bg-lime/20 text-lime" : "bg-cream/10 text-cream/60"}`}>
                                {rec.isPublished ? "Published" : "Draft"}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditRecId(rec.id);
                                    setEditTitle(rec.title);
                                    setEditDesc(rec.description || "");
                                    setEditTargetFolderId(rec.folder || "");
                                  }}
                                  className="rounded-full bg-cream/10 text-cream px-2.5 py-1 text-[10px] font-bold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      if (rec.isPublished) {
                                        await unpublishRecording(rec.id);
                                        toast.success("Recording unpublished.");
                                      } else {
                                        await publishRecording(rec.id);
                                        toast.success("Recording published.");
                                      }
                                      await refreshClassroom();
                                    } catch (error) {
                                      toast.error("Failed to publish/unpublish recording.");
                                    }
                                  }}
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${rec.isPublished ? "bg-cream/10 text-cream/70" : "bg-lime/10 text-lime"}`}
                                >
                                  {rec.isPublished ? <><LuEyeOff className="h-2.5 w-2.5" /> Unpublish</> : <><LuEye className="h-2.5 w-2.5" /> Publish</>}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!confirm("Are you sure you want to delete this recording?")) return;
                                    try {
                                      await deleteRecording(rec.id);
                                      await refreshClassroom();
                                      toast.success("Recording deleted.");
                                    } catch (error) {
                                      toast.error("Failed to delete recording.");
                                    }
                                  }}
                                  className="rounded-full bg-cream/5 text-cream/40 hover:text-red-400 p-1.5 hover:bg-red-500/10 transition-colors"
                                >
                                  <LuTrash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Sub-row for detailed viewer analytics if they exist */}
                          {rec.viewStats.length > 0 && (
                            <tr className="bg-cream/[0.02]">
                              <td colSpan={7} className="p-3 border-t border-cream/5">
                                <div className="pl-14">
                                  <div className="text-[9px] uppercase tracking-widest text-cream/40 mb-1.5 font-bold">Viewer Progress</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5 max-h-32 overflow-y-auto pr-2">
                                    {rec.viewStats.map((vs) => (
                                      <div key={vs.studentId} className="flex items-center gap-2">
                                        <span className="text-[11px] text-cream/70 w-24 truncate">{vs.studentName}</span>
                                        <div className="flex-1 h-1 bg-cream/10 rounded-full overflow-hidden">
                                          <div className="h-full bg-lime rounded-full" style={{ width: `${vs.watchedPercent}%` }} />
                                        </div>
                                        <span className="text-[10px] font-mono text-cream/50 w-8 text-right">{vs.watchedPercent}%</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DarkCard>
          )}
        </div>
      )}

      {/* New Folder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Create New Folder</h3>
              <button onClick={() => setIsFolderModalOpen(false)} className="text-cream/50 hover:text-cream"><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Folder Name</label>
                <input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="e.g. Anatomy & Physiology"
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description (Optional)</label>
                <textarea
                  value={newFolderDesc}
                  onChange={e => setNewFolderDesc(e.target.value)}
                  placeholder="Briefly describe the contents of this folder"
                  rows={2}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setIsFolderModalOpen(false)} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button onClick={handleCreateFolder} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold">Create Folder</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {editFolderId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Edit Folder Details</h3>
              <button onClick={() => setEditFolderId(null)} className="text-cream/50 hover:text-cream"><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Folder Name</label>
                <input
                  value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description</label>
                <textarea
                  value={editFolderDesc}
                  onChange={e => setEditFolderDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setEditFolderId(null)} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button onClick={handleEditFolder} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">
                Upload to {currentFolderId ? `Folder: ${visibleFolders.find(f => f.id === currentFolderId)?.name}` : "Classroom Root"}
              </h3>
              <button onClick={handleCancelUpload} className="text-cream/50 hover:text-cream"><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Video Title</label>
                <input
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="e.g. Introduction to Cells"
                  disabled={isUploading}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description (Optional)</label>
                <textarea
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="Brief summary of the video lecture"
                  rows={2}
                  disabled={isUploading}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Video File</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  disabled={isUploading}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2 text-cream text-xs outline-none focus:border-lime/50 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-lime/25 file:text-lime hover:file:bg-lime/30"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={uploadPublished}
                  onChange={e => setUploadPublished(e.target.checked)}
                  disabled={isUploading}
                  className="accent-lime h-4 w-4"
                />
                <span className="text-cream/80 text-xs font-semibold">Publish immediately to students</span>
              </label>

              {isUploading && (
                <div className="bg-cream/5 p-4 rounded-xl border border-cream/10 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cream flex items-center gap-1.5 truncate max-w-[280px]">
                      {isUploadRetrying ? (
                        <span className="text-amber-400 animate-pulse font-bold flex items-center gap-1">
                          âš ï¸ {uploadStatusText || 'Retrying part...'}
                        </span>
                      ) : (
                        uploadStatusText || (
                          uploadPhase === 'preparing' ? 'Preparing upload...' :
                            uploadPhase === 'saving' ? 'Saving metadata...' :
                              'Uploading to cloud...'
                        )
                      )}
                    </span>
                    <span className="text-cream/70 font-mono text-[11px]">
                      {formatMB(uploadBytes.loaded)} / {formatMB(uploadBytes.total)}
                    </span>
                  </div>

                  <div className="h-1.5 bg-cream/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isUploadRetrying ? 'bg-amber-400' : 'bg-lime'}`}
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-cream/50">
                    <span className="font-medium">{uploadProgress}% Complete</span>
                    {uploadPartInfo && (
                      <span className="font-mono text-lime/90 bg-lime/10 px-2 py-0.5 rounded">
                        Part {uploadPartInfo.part} of {uploadPartInfo.totalParts} (10 MB chunks)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button
                type="button"
                onClick={handleCancelUpload}
                className="flex-1 rounded-full bg-cream/10 hover:bg-rose-500/20 hover:text-rose-300 text-cream py-2 text-xs font-semibold transition-colors"
              >
                {isUploading ? "Cancel Upload" : "Cancel"}
              </button>
              <button onClick={handleUploadVideo} disabled={isUploading || !uploadFile || !uploadTitle} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold disabled:opacity-40">
                {isUploading ? "Uploading..." : "Upload Video"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Video Modal */}
      {editRecId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Edit Video Details</h3>
              <button onClick={() => setEditRecId(null)} className="text-cream/50 hover:text-cream" disabled={isEditing}><LuX className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Video Title</label>
                <input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  disabled={isEditing}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={2}
                  disabled={isEditing}
                  className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Move to Folder</label>
                <select
                  value={editTargetFolderId}
                  onChange={e => setEditTargetFolderId(e.target.value)}
                  disabled={isEditing}
                  className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                >
                  <option value="">[Root / No Folder]</option>
                  {visibleFolders.map(folder => (
                    <option key={folder.id} value={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setEditRecId(null)} disabled={isEditing} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button onClick={handleEditRecording} disabled={isEditing || !editTitle} className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold">
                {isEditing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reuse Modal */}
      {showReuseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-cream">Reuse Folders & Videos</h3>
                {isLoadingReuseList && (
                  <div className="w-3.5 h-3.5 border-2 border-lime border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchReuseList(true)}
                  disabled={isLoadingReuseList || isReusing}
                  title="Refresh list"
                  className="text-cream/50 hover:text-cream text-xs flex items-center gap-1 p-1 rounded hover:bg-cream/5 disabled:opacity-40 transition-colors"
                >
                  <LuRefreshCw className={`h-3.5 w-3.5 ${isLoadingReuseList ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={() => setShowReuseModal(false)} className="text-cream/50 hover:text-cream" disabled={isReusing}><LuX className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {isLoadingReuseList && reuseClassrooms.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-lime/30 border-t-lime rounded-full animate-spin" />
                  <p className="text-xs text-cream/70 font-medium">Loading classrooms & recordings...</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Select Source Classroom</label>
                    <select
                      value={selectedSourceClassroomId}
                      onChange={e => {
                        setSelectedSourceClassroomId(e.target.value);
                        setSelectedFolderIds([]);
                        setSelectedRecIds([]);
                      }}
                      disabled={isReusing}
                      className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                    >
                      <option value="">-- Choose a Class --</option>
                      {reuseClassrooms
                        .filter(c => c.id !== cls.id)
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                        ))}
                    </select>
                  </div>

                  {selectedSourceClassroomId && (
                    <div className="space-y-3">
                      <div className="text-[10px] uppercase tracking-widest text-cream/50 font-bold">Select Items to Clone</div>

                      {/* Folders in source classroom */}
                      <div className="space-y-2.5">
                        {reuseFolders
                          .filter(f => (f.classroom?.toString() || f.classroom) === selectedSourceClassroomId)
                          .map(folder => {
                            const folderId = (folder._id || folder.id).toString();
                            const folderRecs = reuseRecordings.filter(r => {
                              const rFolderId = (r.folder?._id || r.folder?.id || r.folder)?.toString();
                              return rFolderId === folderId;
                            });
                            const folderRecIds = folderRecs.map(r => (r._id || r.id).toString());
                            const selectedFolderRecIds = folderRecIds.filter(id => selectedRecIds.includes(id));
                            const isAllSelected = folderRecs.length > 0 && selectedFolderRecIds.length === folderRecs.length;
                            const isPartial = selectedFolderRecIds.length > 0 && !isAllSelected;
                            const isFolderChecked = selectedFolderIds.includes(folderId) || isAllSelected;
                            const isExpanded = !!expandedFolders[folderId];

                            return (
                              <div key={folderId} className="border border-cream/10 rounded-xl bg-cream/2 overflow-hidden">
                                <div className="flex items-center justify-between p-3 hover:bg-cream/5">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      ref={el => {
                                        if (el) el.indeterminate = isPartial;
                                      }}
                                      checked={isFolderChecked}
                                      onChange={e => {
                                        if (e.target.checked) {
                                          // Select folder & all its recordings
                                          setSelectedFolderIds(prev => Array.from(new Set([...prev, folderId])));
                                          setSelectedRecIds(prev => Array.from(new Set([...prev, ...folderRecIds])));
                                        } else {
                                          // Deselect folder & its recordings
                                          setSelectedFolderIds(prev => prev.filter(id => id !== folderId));
                                          setSelectedRecIds(prev => prev.filter(id => !folderRecIds.includes(id)));
                                        }
                                      }}
                                      className="accent-lime h-4 w-4 cursor-pointer"
                                    />
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-cream">{folder.name}</span>
                                      {selectedFolderRecIds.length > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-lime/20 text-lime font-mono font-medium">
                                          {selectedFolderRecIds.length}/{folderRecs.length} selected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleFolderExpanded(folderId)}
                                    className="text-[10px] text-lime font-bold hover:underline"
                                  >
                                    {isExpanded ? "Collapse" : `Expand (${folderRecs.length} vids)`}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="bg-black/20 border-t border-cream/5 p-3 space-y-2 pl-9">
                                    {folderRecs.map(rec => {
                                      const recId = (rec._id || rec.id).toString();
                                      const isRecChecked = selectedRecIds.includes(recId);
                                      return (
                                        <label key={recId} className="flex items-center gap-3 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={isRecChecked}
                                            onChange={e => {
                                              if (e.target.checked) {
                                                setSelectedRecIds(prev => Array.from(new Set([...prev, recId])));
                                                if (selectedFolderRecIds.length + 1 === folderRecs.length) {
                                                  setSelectedFolderIds(prev => Array.from(new Set([...prev, folderId])));
                                                }
                                              } else {
                                                setSelectedRecIds(prev => prev.filter(id => id !== recId));
                                                setSelectedFolderIds(prev => prev.filter(id => id !== folderId));
                                              }
                                            }}
                                            className="accent-lime h-3.5 w-3.5 cursor-pointer"
                                          />
                                          <div className="text-xs text-cream/80 truncate">{rec.title}</div>
                                        </label>
                                      );
                                    })}
                                    {folderRecs.length === 0 && (
                                      <div className="text-[10px] text-cream/40 italic">No recordings in this folder</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {/* Root recordings in source classroom */}
                      {(() => {
                        const rootRecs = reuseRecordings.filter(
                          r => (r.classroom?.toString() || r.classroom) === selectedSourceClassroomId && !r.folder
                        );
                        if (rootRecs.length === 0) return null;
                        return (
                          <div className="border border-cream/10 rounded-xl bg-cream/2 p-3 space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-cream/40 font-bold mb-1">Root Recordings</div>
                            {rootRecs.map(rec => {
                              const recId = (rec._id || rec.id).toString();
                              const isChecked = selectedRecIds.includes(recId);
                              return (
                                <label key={recId} className="flex items-center gap-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      if (e.target.checked) {
                                        setSelectedRecIds(prev => Array.from(new Set([...prev, recId])));
                                      } else {
                                        setSelectedRecIds(prev => prev.filter(id => id !== recId));
                                      }
                                    }}
                                    className="accent-lime h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <div className="text-xs text-cream">{rec.title}</div>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {reuseClassrooms.filter(c => c.id !== cls.id).length === 0 && !isLoadingReuseList && (
                    <div className="text-center py-6 text-cream/50 text-xs">
                      No other active classrooms available to copy from.
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button onClick={() => setShowReuseModal(false)} disabled={isReusing} className="flex-1 rounded-full bg-cream/10 text-cream py-2 text-xs font-semibold">Cancel</button>
              <button
                onClick={handleConfirmReuse}
                disabled={isReusing || (!selectedSourceClassroomId) || (selectedFolderIds.length === 0 && selectedRecIds.length === 0)}
                className="flex-1 rounded-full bg-lime text-plum-dark py-2 text-xs font-bold disabled:opacity-40"
              >
                {isReusing ? "Reusing..." : "Confirm Reuse"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Video Preview Modal */}
      {activeRec && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#110D26] border-b border-cream/10">
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm truncate">{activeRec.title}</span>
              <span className="text-cream/50 text-[10px] uppercase tracking-widest font-mono font-medium">Admin Video Preview</span>
            </div>
            <button
              onClick={() => setActiveRec(null)}
              className="text-white/60 hover:text-white p-1 hover:bg-cream/10 rounded-full transition-colors"
            >
              <LuX className="h-5 w-5" />
            </button>
          </div>

          {/* Player area */}
          <div className="flex flex-1 relative">
            <div className="flex-1 bg-black flex items-center justify-center relative">
              {streamUrl ? (
                <video
                  src={streamUrl}
                  className="w-full h-full max-h-[85vh] object-contain bg-black"
                  controls
                  autoPlay
                  poster="/default-video-thumb.jpg"
                />
              ) : (
                <p className="text-cream/50 text-sm">Video stream URL not configured.</p>
              )}
            </div>

            {/* Chapters sidebar */}
            {activeRec.chapters && activeRec.chapters.length > 0 && (
              <div className="w-64 bg-[#110D26] border-l border-cream/10 overflow-y-auto animate-in slide-in-from-right duration-250">
                <div className="p-3 border-b border-cream/10 text-white/70 text-xs uppercase tracking-widest font-bold">Chapters</div>
                {activeRec.chapters.map((ch: any) => (
                  <button
                    key={ch.id || ch.title}
                    onClick={() => {
                      const video = document.querySelector('video');
                      if (video) {
                        video.currentTime = ch.startTimeSec;
                        video.play().catch(() => { });
                      }
                    }}
                    className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-cream/5 border-b border-cream/5 text-cream/70 hover:text-cream transition-colors"
                  >
                    <span className="font-mono text-[10px] text-lime font-bold shrink-0">
                      {Math.floor(ch.startTimeSec / 60).toString().padStart(2, "0")}:{(ch.startTimeSec % 60).toString().padStart(2, "0")}
                    </span>
                    <span className="text-xs truncate font-medium">{ch.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { RecordingsTab };

