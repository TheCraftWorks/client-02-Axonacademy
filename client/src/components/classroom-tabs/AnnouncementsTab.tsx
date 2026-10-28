import React, { useState, useRef, useMemo } from "react";
import {
  LuMegaphone, LuPlus, LuX, LuTrash2, LuEye, LuSend,
  LuUpload, LuCopy, LuLink, LuFolder, LuSearch, LuFileText, LuLoader, LuImage, LuZoomIn,
  LuDownload, LuRefreshCw
} from "react-icons/lu";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore } from "@/lib/classroomStore";
import type { Classroom } from "@/lib/classroomStore";
import {
  createClassroomAnnouncement, deleteClassroomAnnouncement, getClassroomAnnouncements,
  getClassroomReuseList, reuseClassroomFolder, uploadAnnouncementPdf, resolveAttachmentUrl
} from "@/lib/api";
import { PdfViewerModal } from "@/components/portal/PdfViewerModal";
import { toast } from "sonner";
import { DarkTabSkeletonLoader, timeAgo } from "./shared";

function AnnouncementsTab({ classroom, refreshClassroom, isFetching }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom>; isFetching?: boolean }) {
  const cls = classroom;
  const { classrooms } = useClassroomStore();
  const [subTab, setSubTab] = useState<"text" | "pdf">("text");
  const [text, setText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [driveLink, setDriveLink] = useState("");
  const [attachedPdf, setAttachedPdf] = useState<{ name: string; url: string; cloudflareKey?: string } | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewPdf, setPreviewPdf] = useState<{ url: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // Dedicated PDF Document Upload states (for the PDF subtab)
  const [pdfDocFile, setPdfDocFile] = useState<File | null>(null);
  const [pdfDocTitle, setPdfDocTitle] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadProgress, setDocUploadProgress] = useState(0);
  const pdfDocInputRef = useRef<HTMLInputElement | null>(null);

  // Push reuse (duplicate to other classrooms) states
  const [duplicateAnnouncement, setDuplicateAnnouncement] = useState<any | null>(null);
  const [selectedTargetClassrooms, setSelectedTargetClassrooms] = useState<string[]>([]);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Pull reuse (import from another classroom) states
  const [showImportModal, setShowImportModal] = useState(false);
  const [sourceClassroomId, setSourceClassroomId] = useState("");
  const [sourceAnnouncements, setSourceAnnouncements] = useState<any[]>([]);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [selectedSourceAnnoIds, setSelectedSourceAnnoIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const announcements = cls.announcements || [];

  // Extract all PDF attachments from all announcements in this classroom (same logic as student portal)
  const allPdfs = useMemo(() => {
    const list: Array<{
      id: string;
      announcementId: string;
      name: string;
      url: string;
      cloudflareKey?: string;
      announcementContent: string;
      authorName: string;
      createdAt: string;
      rawAnnouncement: any;
    }> = [];

    announcements.forEach((ann: any, annIdx: number) => {
      if (!ann) return;
      const rawAttachments = Array.isArray(ann?.attachments)
        ? ann.attachments
        : (ann?.attachment ? [ann.attachment] : []);

      if (ann?.fileUrl && !rawAttachments.some((x: any) => (typeof x === 'string' ? x : x?.url) === ann.fileUrl)) {
        rawAttachments.push({ name: ann.fileName || 'Document.pdf', url: ann.fileUrl });
      }
      if (ann?.pdfUrl && !rawAttachments.some((x: any) => (typeof x === 'string' ? x : x?.url) === ann.pdfUrl)) {
        rawAttachments.push({ name: ann.pdfName || 'Document.pdf', url: ann.pdfUrl });
      }

      const authorName = typeof ann?.author === 'object' && ann?.author !== null
        ? (ann.author.fullName || ann.author.name || 'Admin')
        : (typeof ann?.author === 'string' && ann.author.trim() ? ann.author : 'Admin');
      
      const safeContent = typeof ann?.content === 'string' ? ann.content : String(ann?.content || '');

      rawAttachments.forEach((at: any, atIdx: number) => {
        if (!at) return;
        const atUrl = typeof at === 'string'
          ? at
          : (at.url || at.fileUrl || at.secure_url || at.link || at.path || '');
        const cfKey = typeof at === 'object' && at !== null
          ? (at.cloudflareKey || at.publicId || at.key)
          : undefined;
        const rawName = typeof at === 'string'
          ? ''
          : (at.name || at.filename || at.title || '');

        const resolvedUrl = resolveAttachmentUrl(atUrl, cfKey);
        if (!resolvedUrl && !atUrl && !cfKey) return;

        const fallbackName = cfKey
          ? cfKey.split('/').pop()
          : (atUrl ? atUrl.split('?')[0].split('/').pop() : `Document_${annIdx + 1}_${atIdx + 1}.pdf`);
        const finalName = (rawName && rawName.trim()) ? rawName.trim() : (fallbackName || `Document_${annIdx + 1}_${atIdx + 1}.pdf`);

        list.push({
          id: `${ann.id || ann._id || annIdx}-${atIdx}`,
          announcementId: ann.id || ann._id || `ann-${annIdx}`,
          name: finalName,
          url: resolvedUrl || atUrl,
          cloudflareKey: cfKey,
          announcementContent: safeContent,
          authorName: String(authorName),
          createdAt: ann.createdAt || new Date().toISOString(),
          rawAnnouncement: ann,
        });
      });
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [announcements]);

  const filteredPdfs = useMemo(() => {
    if (!searchQuery.trim()) return allPdfs;
    const q = searchQuery.toLowerCase().trim();
    return allPdfs.filter(
      (doc) =>
        doc.name.toLowerCase().includes(q) ||
        doc.announcementContent.toLowerCase().includes(q) ||
        doc.authorName.toLowerCase().includes(q)
    );
  }, [allPdfs, searchQuery]);

  const textAnnouncementsCount = announcements.length;
  const pdfDocumentsCount = allPdfs.length;

  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a valid PDF file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("PDF file must be under 50MB");
      return;
    }

    setIsUploadingPdf(true);
    setUploadProgress(0);
    try {
      const res = await uploadAnnouncementPdf({
        file,
        onProgress: (pct) => setUploadProgress(pct),
      });
      setAttachedPdf({ name: file.name, url: res.url, cloudflareKey: res.cloudflareKey });
      toast.success("PDF uploaded successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload PDF");
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handlePdfDocSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a valid PDF file");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("PDF file must be under 50MB");
      return;
    }
    setPdfDocFile(file);
    if (!pdfDocTitle.trim()) {
      setPdfDocTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleDirectPdfUpload = async () => {
    if (!pdfDocFile || isUploadingDoc) return;
    setIsUploadingDoc(true);
    setDocUploadProgress(0);
    try {
      const res = await uploadAnnouncementPdf({
        file: pdfDocFile,
        onProgress: (pct) => setDocUploadProgress(pct),
      });
      const finalTitle = pdfDocTitle.trim() || pdfDocFile.name.replace(/\.[^/.]+$/, "");
      const attachments = [{
        name: pdfDocFile.name,
        url: res.url,
        type: "pdf",
        cloudflareKey: res.cloudflareKey,
      }];
      await createClassroomAnnouncement(classroom.id, finalTitle, attachments);
      setPdfDocFile(null);
      setPdfDocTitle("");
      if (pdfDocInputRef.current) pdfDocInputRef.current.value = "";
      await refreshClassroom();
      toast.success("PDF document published successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload and publish PDF document");
    } finally {
      setIsUploadingDoc(false);
      setDocUploadProgress(0);
    }
  };

  const handlePost = async () => {
    const contentToPost = text.trim() || (attachedPdf ? attachedPdf.name : "");
    if (!contentToPost || isPosting || isUploadingPdf) return;
    setIsPosting(true);
    try {
      let attachments: any[] = [];
      if (attachedPdf) {
        attachments.push({
          name: attachedPdf.name,
          url: attachedPdf.url,
          type: "pdf",
          cloudflareKey: attachedPdf.cloudflareKey,
        });
      }
      if (driveLink.trim()) {
        attachments.push({ name: "External Resource", url: driveLink.trim(), type: "pdf" });
      }
      await createClassroomAnnouncement(classroom.id, contentToPost, attachments);
      setText("");
      setDriveLink("");
      setAttachedPdf(null);
      await refreshClassroom();
      toast.success("Announcement posted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post announcement");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (announcementId: string) => {
    if (deletingId) return;
    setDeletingId(announcementId);
    try {
      await deleteClassroomAnnouncement(classroom.id, announcementId);
      await refreshClassroom();
      toast.success("Announcement deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete announcement");
    } finally {
      setDeletingId(null);
    }
  };

  // Push reuse handler: duplicate announcement to selected target classrooms
  const handleDuplicateConfirm = async () => {
    if (!duplicateAnnouncement || selectedTargetClassrooms.length === 0) return;
    setIsDuplicating(true);
    try {
      const attachments = Array.isArray(duplicateAnnouncement.attachments) ? duplicateAnnouncement.attachments : [];
      for (const targetId of selectedTargetClassrooms) {
        await createClassroomAnnouncement(targetId, duplicateAnnouncement.content, attachments);
      }
      toast.success("Announcement duplicated successfully to selected class(es)!");
      setDuplicateAnnouncement(null);
      setSelectedTargetClassrooms([]);
      await refreshClassroom();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Duplication failed");
    } finally {
      setIsDuplicating(false);
    }
  };

  // Pull reuse handler: fetch announcements from chosen source classroom
  const fetchSourceAnnouncements = async (classroomIdToFetch: string) => {
    if (!classroomIdToFetch) {
      setSourceAnnouncements([]);
      setSelectedSourceAnnoIds([]);
      return;
    }
    setIsLoadingSource(true);
    try {
      const list = await getClassroomAnnouncements(classroomIdToFetch);
      setSourceAnnouncements(list);
      setSelectedSourceAnnoIds([]);
    } catch (err: any) {
      toast.error("Failed to load announcements from selected classroom");
      setSourceAnnouncements([]);
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleSourceClassroomChange = (newSourceId: string) => {
    setSourceClassroomId(newSourceId);
    if (newSourceId) {
      fetchSourceAnnouncements(newSourceId);
    } else {
      setSourceAnnouncements([]);
      setSelectedSourceAnnoIds([]);
    }
  };

  // Pull reuse handler: clone selected source announcements into current classroom
  const handleImportConfirm = async () => {
    if (selectedSourceAnnoIds.length === 0) {
      toast.error("Please select at least one announcement to reuse");
      return;
    }
    setIsImporting(true);
    try {
      const selectedAnnos = sourceAnnouncements.filter((a) =>
        selectedSourceAnnoIds.includes(a.id || a._id)
      );
      for (const ann of selectedAnnos) {
        await createClassroomAnnouncement(cls.id, ann.content, ann.attachments || []);
      }
      toast.success(`Successfully reused ${selectedAnnos.length} announcement${selectedAnnos.length > 1 ? 's' : ''}!`);
      setShowImportModal(false);
      setSourceClassroomId("");
      setSourceAnnouncements([]);
      setSelectedSourceAnnoIds([]);
      await refreshClassroom();
    } catch (err: any) {
      toast.error(err.message || "Failed to reuse announcements");
    } finally {
      setIsImporting(false);
    }
  };

  // Pull reuse handler: load selected announcement into composer editor
  const handleLoadIntoEditor = (ann: any) => {
    setText(ann.content || "");
    if (ann.attachments && ann.attachments.length > 0) {
      const firstPdf = ann.attachments.find((at: any) => at.type === "pdf" || at.url?.endsWith(".pdf") || at.name?.endsWith(".pdf"));
      if (firstPdf) {
        setAttachedPdf({
          name: firstPdf.name || "Reused PDF",
          url: firstPdf.url,
          cloudflareKey: firstPdf.cloudflareKey,
        });
      }
      const extLink = ann.attachments.find((at: any) => at !== firstPdf);
      if (extLink?.url) {
        setDriveLink(extLink.url);
      }
    }
    setSubTab("text");
    setShowImportModal(false);
    toast.success("Loaded announcement into editor!");
  };

  return (
    <div className="space-y-5">
      {/* Hidden PDF file inputs */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePdfFileSelect}
      />
      <input
        ref={pdfDocInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePdfDocSelect}
      />

      {/* In-app PDF Viewer Modal */}
      {previewPdf && (
        <PdfViewerModal
          isOpen={!!previewPdf}
          onClose={() => setPreviewPdf(null)}
          url={previewPdf.url}
          title={previewPdf.name}
        />
      )}

      {/* Two Distinct Square Boxes for Text Announcements & PDF Documents (Matches Student Portal) */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-5 max-w-sm sm:max-w-md mx-auto">
        {/* Square Box 1: Text Announcements */}
        <button
          type="button"
          onClick={() => setSubTab("text")}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all relative overflow-hidden group aspect-square shadow-xs cursor-pointer ${
            subTab === "text"
              ? "bg-[#EFF6FF] border-[#93C5FD] text-[#1E40AF] scale-[1.03] ring-2 ring-[#2563EB] ring-offset-2 ring-offset-[#1A0F33] shadow-md"
              : "bg-cream/5 border-cream/10 text-cream/70 hover:bg-blue-500/10 hover:border-blue-400/30 hover:scale-[1.01]"
          }`}
        >
          {textAnnouncementsCount > 0 && (
            <span className="absolute top-2.5 right-2.5 min-w-[22px] h-5.5 px-1.5 flex items-center justify-center rounded-full text-[11px] font-black shadow-2xs bg-[#2563EB] text-white">
              {textAnnouncementsCount > 99 ? "99+" : textAnnouncementsCount}
            </span>
          )}
          <LuMegaphone className={`w-8 h-8 mb-2 transition-transform group-hover:scale-110 ${subTab === 'text' ? 'text-[#2563EB]' : 'text-cream/60 group-hover:text-blue-400'}`} />
          <span className="text-xs sm:text-sm font-black tracking-tight text-center">Text Announcements</span>
          <span className={`text-[10px] mt-1 font-medium ${subTab === 'text' ? 'text-blue-700 font-bold' : 'text-cream/40'}`}>
            {textAnnouncementsCount} {textAnnouncementsCount === 1 ? 'notice' : 'notices'}
          </span>
        </button>

        {/* Square Box 2: PDF Documents */}
        <button
          type="button"
          onClick={() => setSubTab("pdf")}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all relative overflow-hidden group aspect-square shadow-xs cursor-pointer ${
            subTab === "pdf"
              ? "bg-[#FFF1F2] border-[#FECDD3] text-[#9F1239] scale-[1.03] ring-2 ring-[#E11D48] ring-offset-2 ring-offset-[#1A0F33] shadow-md"
              : "bg-cream/5 border-cream/10 text-cream/70 hover:bg-rose-500/10 hover:border-rose-400/30 hover:scale-[1.01]"
          }`}
        >
          {pdfDocumentsCount > 0 && (
            <span className="absolute top-2.5 right-2.5 min-w-[22px] h-5.5 px-1.5 flex items-center justify-center rounded-full text-[11px] font-black shadow-2xs bg-[#E11D48] text-white">
              {pdfDocumentsCount > 99 ? "99+" : pdfDocumentsCount}
            </span>
          )}
          <LuFileText className={`w-8 h-8 mb-2 transition-transform group-hover:scale-110 ${subTab === 'pdf' ? 'text-[#E11D48]' : 'text-cream/60 group-hover:text-rose-400'}`} />
          <span className="text-xs sm:text-sm font-black tracking-tight text-center">PDF Documents</span>
          <span className={`text-[10px] mt-1 font-medium ${subTab === 'pdf' ? 'text-rose-700 font-bold' : 'text-cream/40'}`}>
            {pdfDocumentsCount} {pdfDocumentsCount === 1 ? 'document' : 'documents'}
          </span>
        </button>
      </div>

      {/* Sub-tab 1: Text Announcements Content */}
      {subTab === "text" && (
        <div className="space-y-4 pt-1">
          {/* Compose Text Announcement Card */}
          <DarkCard>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
                <LuMegaphone className="h-4 w-4 text-lime" /> Post Text Announcement
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(true);
                  if (sourceClassroomId) {
                    fetchSourceAnnouncements(sourceClassroomId);
                  }
                }}
                disabled={isPosting || isUploadingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cream/10 hover:bg-cream/15 text-cream text-xs font-semibold border border-cream/15 transition-colors disabled:opacity-50"
                title="Reuse announcement from another classroom"
              >
                <LuCopy className="h-3.5 w-3.5 text-lime" /> Reuse from Class
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your announcementâ€¦ (supports emoji ðŸŽ¯)"
              rows={3}
              disabled={isPosting || isUploadingPdf}
              className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-cream text-sm outline-none focus:border-lime/50 resize-none disabled:opacity-50"
            />

            {/* Attached PDF pill */}
            {attachedPdf && (
              <div className="mt-2.5 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-lime/10 border border-lime/30 text-cream text-xs w-fit">
                <LuFileText className="h-3.5 w-3.5 text-lime shrink-0" />
                <span className="font-semibold text-lime truncate max-w-[220px]" title={attachedPdf.name}>
                  {attachedPdf.name}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewPdf({ url: resolveAttachmentUrl(attachedPdf.url, attachedPdf.cloudflareKey), name: attachedPdf.name })}
                  className="text-cream/70 hover:text-white p-0.5 ml-1"
                  title="Preview PDF"
                >
                  <LuEye className="h-3.5 w-3.5 text-lime" />
                </button>
                <button
                  type="button"
                  onClick={() => setAttachedPdf(null)}
                  disabled={isPosting}
                  className="text-cream/50 hover:text-red-400 p-0.5"
                  title="Remove attached PDF"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                {/* Upload PDF Button */}
                {!attachedPdf && (
                  <button
                    type="button"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={isPosting || isUploadingPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cream/10 hover:bg-cream/15 text-cream text-xs font-semibold border border-cream/15 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isUploadingPdf ? (
                      <>
                        <LuLoader className="h-3.5 w-3.5 animate-spin text-lime" />
                        <span>Uploading ({uploadProgress}%)â€¦</span>
                      </>
                    ) : (
                      <>
                        <LuUpload className="h-3.5 w-3.5 text-lime" />
                        <span>Upload PDF</span>
                      </>
                    )}
                  </button>
                )}

                {/* Optional Drive / External Link Input */}
                <div className="flex items-center gap-1.5 flex-1 sm:w-56">
                  <LuLink className="h-3.5 w-3.5 text-cream/60 shrink-0" />
                  <input
                    type="url"
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    placeholder="Or paste external linkâ€¦"
                    disabled={isPosting || isUploadingPdf}
                    className="w-full bg-cream/5 border border-cream/10 rounded-lg px-2.5 py-1 text-cream text-xs outline-none focus:border-lime/50 disabled:opacity-50"
                  />
                  {driveLink && (
                    <button
                      type="button"
                      onClick={() => setDriveLink("")}
                      disabled={isPosting}
                      className="text-cream/40 hover:text-red-400 shrink-0"
                    >
                      <LuX className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handlePost}
                disabled={(!text.trim() && !attachedPdf) || isPosting || isUploadingPdf}
                className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2 text-sm font-bold disabled:opacity-40 shrink-0 cursor-pointer"
              >
                <LuSend className="h-3.5 w-3.5" /> {isPosting ? "Postingâ€¦" : "Post to All Students"}
              </button>
            </div>
          </DarkCard>

          {/* Feed of Text Announcements */}
          {isFetching && announcements.length === 0 ? (
            <DarkTabSkeletonLoader type="rows" />
          ) : (
            <div className="space-y-3">
              {announcements.length === 0 && !isFetching && (
                <DarkCard className="text-center py-12">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-400 mx-auto mb-3 border border-blue-500/20">
                    <LuMegaphone className="h-6 w-6" />
                  </div>
                  <h4 className="text-cream font-bold text-sm mb-1">No Text Announcements Yet</h4>
                  <p className="text-cream/50 text-xs max-w-sm mx-auto">
                    Post news, schedule updates, and classroom notices for enrolled students here.
                  </p>
                </DarkCard>
              )}
              {announcements.map((ann: any, idx: number) => {
                if (!ann) return null;
                const authorName = typeof ann.author === 'object' && ann.author !== null
                  ? (ann.author.fullName || ann.author.name || 'Admin')
                  : (typeof ann.author === 'string' && ann.author.trim() ? ann.author : 'Admin');
                const safeAuthorName = String(authorName || 'Admin');
                const initials = safeAuthorName
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((w: string) => w[0])
                  .join("")
                  .slice(0, 2) || "A";

                const rawAttachments = Array.isArray(ann.attachments) ? ann.attachments : [];
                const safeContent = typeof ann.content === 'string' ? ann.content : (typeof ann.content === 'object' && ann.content !== null ? JSON.stringify(ann.content) : String(ann.content || ''));
                const annId = ann.id || ann._id || `ann-${idx}`;

                return (
                  <DarkCard key={annId}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime text-plum-dark font-bold text-xs">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-cream text-sm font-semibold">{safeAuthorName}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime/10 text-lime border border-lime/20">
                              Instructor
                            </span>
                            <span className="text-cream/40 text-xs">{timeAgo(ann.createdAt)}</span>
                          </div>
                          <div className="text-cream/80 text-sm leading-relaxed whitespace-pre-wrap break-words">{safeContent}</div>

                          {rawAttachments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-cream/10 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs text-cream/60 font-semibold flex items-center gap-1.5">
                                  <LuFileText className="h-3.5 w-3.5 text-rose-400" />
                                  <span>{rawAttachments.length} Attached {rawAttachments.length === 1 ? "Document" : "Documents"}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSubTab("pdf")}
                                  className="text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span>Open PDF Repository &rarr;</span>
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {rawAttachments.map((at: any, i: number) => {
                                  if (!at) return null;
                                  const atUrl = typeof at === 'string' ? at : (at?.url || at?.fileUrl || at?.secure_url || at?.link || at?.path || '');
                                  const cfKey = typeof at === 'object' && at !== null ? (at.cloudflareKey || at.publicId || at.key) : undefined;
                                  const resolvedUrl = resolveAttachmentUrl(atUrl, cfKey);
                                  if (!atUrl && !resolvedUrl && !cfKey) return null;
                                  const rawName = typeof at === 'string' ? '' : (at?.name || at?.filename || at?.title || '');
                                  const fallbackName = cfKey ? cfKey.split('/').pop() : (atUrl ? atUrl.split('?')[0].split('/').pop() : `Document_${i + 1}.pdf`);
                                  const atName = (rawName && rawName.trim()) ? rawName.trim() : (fallbackName || `Document_${i + 1}.pdf`);
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => setPreviewPdf({ url: resolvedUrl || atUrl, name: atName })}
                                      className="inline-flex items-center gap-2 bg-cream/5 border border-cream/10 rounded-lg px-3 py-1.5 text-xs font-semibold text-cream/70 hover:bg-cream/10 hover:text-lime transition-all cursor-pointer"
                                    >
                                      <LuFileText className="h-3.5 w-3.5 text-rose-400" />
                                      <span className="truncate max-w-[200px]">{atName}</span>
                                      <LuEye className="h-3 w-3 text-cream/40 ml-1" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDuplicateAnnouncement(ann);
                            setSelectedTargetClassrooms([]);
                          }}
                          className="rounded-full bg-cream/10 text-cream px-2.5 py-1 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors cursor-pointer"
                          title="Reuse/Duplicate to another class"
                        >
                          <LuCopy className="h-3 w-3" /> Reuse
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(annId)}
                          disabled={deletingId === annId}
                          className="rounded-full bg-cream/5 text-cream/40 hover:text-red-400 p-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                          title="Delete announcement"
                        >
                          <LuTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </DarkCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: PDF Documents Content */}
      {subTab === "pdf" && (
        <div className="space-y-4 pt-1">
          {/* Top Banner & Search Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-cream/5 border border-cream/10 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <LuFileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-cream">Classroom PDF Repository</h3>
                <p className="text-xs text-cream/50">
                  {allPdfs.length} {allPdfs.length === 1 ? "document" : "documents"} available in this classroom
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {allPdfs.length > 0 && (
                <div className="relative min-w-[200px] sm:w-64">
                  <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search PDF documents..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-cream/5 border border-cream/10 rounded-xl focus:outline-none focus:border-rose-400 focus:bg-cream/10 transition-all text-cream placeholder-cream/40"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(true);
                  if (sourceClassroomId) {
                    fetchSourceAnnouncements(sourceClassroomId);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cream/10 hover:bg-cream/15 text-cream text-xs font-semibold border border-cream/15 transition-colors shrink-0 cursor-pointer"
                title="Reuse announcement or PDF from another class"
              >
                <LuCopy className="h-3.5 w-3.5 text-lime" /> Reuse from Class
              </button>
            </div>
          </div>

          {/* Dedicated PDF Document Upload Composer */}
          <DarkCard>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
                <LuUpload className="h-4 w-4 text-rose-400" /> Upload & Publish PDF Document
              </h3>
              <span className="text-[11px] text-cream/40">PDF format &bull; Max 50MB</span>
            </div>

            {/* Drop / Select Area */}
            {!pdfDocFile ? (
              <div
                onClick={() => pdfDocInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
                      toast.error("Please drop a valid PDF file");
                      return;
                    }
                    if (file.size > 50 * 1024 * 1024) {
                      toast.error("PDF file must be under 50MB");
                      return;
                    }
                    setPdfDocFile(file);
                    if (!pdfDocTitle.trim()) {
                      setPdfDocTitle(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }
                }}
                className="border border-dashed border-cream/20 hover:border-rose-400/50 bg-cream/2 hover:bg-rose-500/5 rounded-2xl p-6 text-center transition-all cursor-pointer group"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-rose-500/10 text-rose-400 mx-auto mb-2 group-hover:scale-110 transition-transform">
                  <LuUpload className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold text-cream">Click or drag & drop a PDF file here</p>
                <p className="text-[11px] text-cream/40 mt-1">Study materials, notes, question banks, or syllabus</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-500 text-white">
                      <LuFileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-cream truncate">{pdfDocFile.name}</p>
                      <p className="text-[10px] text-cream/50">{(pdfDocFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const blobUrl = URL.createObjectURL(pdfDocFile);
                        setPreviewPdf({ url: blobUrl, name: pdfDocFile.name });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cream/10 text-cream text-xs hover:bg-cream/20 transition-colors cursor-pointer"
                      title="Preview before uploading"
                    >
                      <LuEye className="h-3 w-3 text-rose-400" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfDocFile(null);
                        if (pdfDocInputRef.current) pdfDocInputRef.current.value = "";
                      }}
                      disabled={isUploadingDoc}
                      className="p-1 rounded-lg text-cream/50 hover:text-red-400 hover:bg-cream/10 transition-colors"
                      title="Remove file"
                    >
                      <LuX className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-cream/70 block">
                    Document Title / Context Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={pdfDocTitle}
                    onChange={(e) => setPdfDocTitle(e.target.value)}
                    placeholder="e.g. Pharmacology Chapter 2 Notes (defaults to filename if empty)"
                    disabled={isUploadingDoc}
                    className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-xs outline-none focus:border-rose-400 disabled:opacity-50"
                  />
                </div>

                {isUploadingDoc && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-cream/60 font-medium">
                      <span>Uploading to secure repositoryâ€¦</span>
                      <span>{docUploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-cream/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-150"
                        style={{ width: `${docUploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPdfDocFile(null);
                      setPdfDocTitle("");
                      if (pdfDocInputRef.current) pdfDocInputRef.current.value = "";
                    }}
                    disabled={isUploadingDoc}
                    className="px-4 py-2 rounded-full bg-cream/10 text-cream text-xs font-semibold hover:bg-cream/15 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDirectPdfUpload}
                    disabled={isUploadingDoc}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingDoc ? (
                      <>
                        <LuLoader className="h-3.5 w-3.5 animate-spin" />
                        <span>Publishing ({docUploadProgress}%)â€¦</span>
                      </>
                    ) : (
                      <>
                        <LuUpload className="h-3.5 w-3.5" />
                        <span>Publish PDF Document</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </DarkCard>

          {/* Empty States */}
          {allPdfs.length === 0 && !isFetching && (
            <DarkCard className="text-center py-12">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/10 text-rose-400 mx-auto mb-3 border border-rose-500/20">
                <LuFileText className="h-6 w-6" />
              </div>
              <h4 className="text-cream font-bold text-sm mb-1">No PDF Documents Yet</h4>
              <p className="text-cream/50 text-xs max-w-sm mx-auto">
                Faculty lecture slides, assignments, notes, and PDF notices uploaded for this classroom will appear here.
              </p>
            </DarkCard>
          )}

          {allPdfs.length > 0 && filteredPdfs.length === 0 && (
            <DarkCard className="text-center py-10">
              <p className="text-cream/70 text-xs font-medium">No PDF documents match &quot;{searchQuery}&quot;</p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer underline"
              >
                Clear search filter
              </button>
            </DarkCard>
          )}

          {/* PDF Grid Cards (Matching Student's Beautiful Card Layout + Admin Actions) */}
          {filteredPdfs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredPdfs.map((doc) => (
                <DarkCard
                  key={doc.id}
                  className="flex flex-col justify-between hover:border-rose-400/40 transition-all group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2.5 mb-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-xs">
                          <LuFileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              PDF
                            </span>
                            <span className="text-[11px] text-cream/40">{timeAgo(doc.createdAt)}</span>
                          </div>
                          <h4 className="text-sm font-bold text-cream mt-1 truncate" title={doc.name}>
                            {doc.name}
                          </h4>
                        </div>
                      </div>

                      {/* Admin Quick Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDuplicateAnnouncement(doc.rawAnnouncement);
                            setSelectedTargetClassrooms([]);
                          }}
                          className="rounded-full bg-cream/10 text-cream p-1.5 hover:bg-cream/20 transition-colors cursor-pointer"
                          title="Reuse/Duplicate PDF to other classes"
                        >
                          <LuCopy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doc.announcementId)}
                          disabled={deletingId === doc.announcementId}
                          className="rounded-full bg-cream/5 text-cream/40 hover:text-red-400 p-1.5 disabled:opacity-40 transition-colors cursor-pointer"
                          title="Delete document announcement"
                        >
                          <LuTrash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {doc.announcementContent && doc.announcementContent !== doc.name && (
                      <p className="mt-2 text-xs text-cream/70 line-clamp-2 leading-relaxed bg-cream/5 p-2 rounded-lg border border-cream/5">
                        {doc.announcementContent}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-cream/10 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-cream/50 truncate">
                      By <span className="font-semibold text-cream/80">{doc.authorName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={doc.name}
                        className="inline-flex items-center gap-1 rounded-xl bg-cream/10 hover:bg-cream/15 text-cream px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                        title="Download PDF"
                      >
                        <LuDownload className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Download</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewPdf({ url: doc.url, name: doc.name })}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
                      >
                        <LuEye className="h-3.5 w-3.5" />
                        <span>View PDF</span>
                      </button>
                    </div>
                  </div>
                </DarkCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Push Reuse Modal: duplicate current announcement to other classrooms (matches Quiz reuse pattern) */}
      {duplicateAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Reuse Announcement in other Classes</h3>
              <button
                type="button"
                onClick={() => setDuplicateAnnouncement(null)}
                className="text-cream/50 hover:text-cream p-1 rounded-full hover:bg-cream/5"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="p-3 bg-cream/5 rounded-xl border border-cream/10">
                <div className="text-[10px] uppercase tracking-widest text-cream/40 font-bold mb-1">Announcement Preview</div>
                <p className="text-xs text-cream/80 line-clamp-3 whitespace-pre-wrap">{duplicateAnnouncement.content}</p>
                {Array.isArray(duplicateAnnouncement.attachments) && duplicateAnnouncement.attachments.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-lime font-medium">
                    <LuFileText className="h-3 w-3" />
                    <span>{duplicateAnnouncement.attachments.length} attachment(s) will be included</span>
                  </div>
                )}
              </div>

              <div className="text-sm text-cream/70">
                Duplicate to the following classroom(s):
              </div>
              <div className="space-y-2">
                {classrooms
                  .filter((c) => c.id !== cls.id && c.status === "active")
                  .map((targetCls) => {
                    const isChecked = selectedTargetClassrooms.includes(targetCls.id);
                    return (
                      <label
                        key={targetCls.id}
                        className="flex items-center gap-3 bg-cream/5 border border-cream/10 rounded-xl p-3 cursor-pointer hover:border-lime/30 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTargetClassrooms([...selectedTargetClassrooms, targetCls.id]);
                            } else {
                              setSelectedTargetClassrooms(selectedTargetClassrooms.filter((id) => id !== targetCls.id));
                            }
                          }}
                          className="accent-lime h-4 w-4"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-cream">{targetCls.name}</div>
                          <div className="text-[10px] font-mono text-cream/50 uppercase tracking-widest">{targetCls.code} &middot; {targetCls.program}</div>
                        </div>
                      </label>
                    );
                  })}
                {classrooms.filter((c) => c.id !== cls.id && c.status === "active").length === 0 && (
                  <p className="text-xs text-cream/40 text-center py-4">No other active classes available.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button
                type="button"
                onClick={() => setDuplicateAnnouncement(null)}
                disabled={isDuplicating}
                className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDuplicateConfirm}
                disabled={selectedTargetClassrooms.length === 0 || isDuplicating}
                className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-40"
              >
                {isDuplicating ? "Duplicatingâ€¦" : "Confirm Duplicate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull Reuse Modal: import announcements from other classrooms (matches Video Recordings reuse pattern) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-cream">Reuse Announcements from other Classes</h3>
                {isLoadingSource && (
                  <div className="w-3.5 h-3.5 border-2 border-lime border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {sourceClassroomId && (
                  <button
                    type="button"
                    onClick={() => fetchSourceAnnouncements(sourceClassroomId)}
                    disabled={isLoadingSource || isImporting}
                    title="Refresh announcements"
                    className="text-cream/50 hover:text-cream text-xs flex items-center gap-1 p-1 rounded hover:bg-cream/5 disabled:opacity-40 transition-colors"
                  >
                    <LuRefreshCw className={`h-3.5 w-3.5 ${isLoadingSource ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="text-cream/50 hover:text-cream"
                  disabled={isImporting}
                >
                  <LuX className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-cream/60 block mb-1">Select Source Classroom</label>
                <select
                  value={sourceClassroomId}
                  onChange={(e) => handleSourceClassroomChange(e.target.value)}
                  disabled={isImporting}
                  className="w-full bg-[#1A0F33] border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50"
                >
                  <option value="">-- Choose a Class --</option>
                  {classrooms
                    .filter((c) => c.id !== cls.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                </select>
              </div>

              {sourceClassroomId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-widest text-cream/50 font-bold">Available Announcements</div>
                    {sourceAnnouncements.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSourceAnnoIds.length === sourceAnnouncements.length) {
                            setSelectedSourceAnnoIds([]);
                          } else {
                            setSelectedSourceAnnoIds(sourceAnnouncements.map((a) => a.id || a._id));
                          }
                        }}
                        className="text-[10px] text-lime font-bold hover:underline"
                      >
                        {selectedSourceAnnoIds.length === sourceAnnouncements.length ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

                  {isLoadingSource ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-lime/30 border-t-lime rounded-full animate-spin" />
                      <p className="text-xs text-cream/70 font-medium">Loading announcements...</p>
                    </div>
                  ) : sourceAnnouncements.length === 0 ? (
                    <div className="p-6 text-center border border-cream/10 rounded-xl bg-cream/2">
                      <p className="text-xs text-cream/40">No announcements found in this classroom.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {sourceAnnouncements.map((ann) => {
                        const annId = ann.id || ann._id;
                        const isChecked = selectedSourceAnnoIds.includes(annId);
                        const author = typeof ann.author === "object" && ann.author !== null ? (ann.author.fullName || ann.author.name || "Admin") : (ann.author || "Admin");
                        const rawAttachments = Array.isArray(ann.attachments) ? ann.attachments : [];

                        return (
                          <div
                            key={annId}
                            className={`border rounded-xl p-3 transition-colors ${
                              isChecked ? "border-lime/40 bg-lime/5" : "border-cream/10 bg-cream/2 hover:bg-cream/5"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSourceAnnoIds((prev) => [...prev, annId]);
                                  } else {
                                    setSelectedSourceAnnoIds((prev) => prev.filter((id) => id !== annId));
                                  }
                                }}
                                className="accent-lime h-4 w-4 mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-semibold text-cream truncate">{author}</span>
                                  <span className="text-[10px] text-cream/40 shrink-0">{timeAgo(ann.createdAt)}</span>
                                </div>
                                <p className="text-xs text-cream/80 line-clamp-3 whitespace-pre-wrap mb-2">{ann.content}</p>
                                {rawAttachments.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {rawAttachments.map((at: any, i: number) => {
                                      const name = typeof at === "string" ? "Attachment" : at.name || "Attachment";
                                      return (
                                        <span
                                          key={i}
                                          className="inline-flex items-center gap-1 text-[10px] text-lime bg-lime/10 border border-lime/20 px-2 py-0.5 rounded"
                                        >
                                          <LuFileText className="h-3 w-3" />
                                          <span className="truncate max-w-[150px]">{name}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="flex justify-end pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleLoadIntoEditor(ann)}
                                    className="text-[10px] text-lime hover:underline font-semibold flex items-center gap-1"
                                    title="Load this text into your compose editor"
                                  >
                                    <LuCopy className="h-3 w-3" /> Load into Editor
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
                className="flex-1 rounded-full bg-cream/10 text-cream py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportConfirm}
                disabled={selectedSourceAnnoIds.length === 0 || isImporting}
                className="flex-1 rounded-full bg-lime text-plum-dark py-2.5 text-sm font-bold disabled:opacity-40"
              >
                {isImporting ? "Reusingâ€¦" : `Import Selected (${selectedSourceAnnoIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Live Classes Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export { AnnouncementsTab };
