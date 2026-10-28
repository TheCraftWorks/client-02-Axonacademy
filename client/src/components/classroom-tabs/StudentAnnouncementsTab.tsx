import React, { useState, useEffect, useMemo, useRef } from "react";
import { Megaphone, FileText, ChevronRight, Eye, Search } from "lucide-react";
import { LuEye, LuDownload, LuSearch, LuX, LuFolder, LuFileText } from "react-icons/lu";
import { useClassroomStore } from "@/lib/classroomStore";
import { resolveAttachmentUrl } from "@/lib/api";
import { PdfViewerModal } from "@/components/portal/PdfViewerModal";
import { TabSkeletonLoader, timeAgo } from "./shared";

function AnnouncementsTab({
  classroomId,
  isFetching,
  initialSubTab = "text",
}: {
  classroomId: string;
  isFetching?: boolean;
  initialSubTab?: "text" | "pdf";
}) {
  const [subTab, setSubTab] = useState<"text" | "pdf">(initialSubTab);
  const { classrooms } = useClassroomStore();
  const cls = classrooms.find((c) => c.id === classroomId || (c as any)._id === classroomId);
  const [previewPdf, setPreviewPdf] = useState<{ url: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const announcements = cls?.announcements || [];

  // Extract all PDF attachments from all announcements in this classroom
  const allPdfs = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      url: string;
      cloudflareKey?: string;
      announcementContent: string;
      authorName: string;
      createdAt: string;
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
        ? (ann.author.fullName || ann.author.name || 'Faculty / Admin')
        : (typeof ann?.author === 'string' && ann.author.trim() ? ann.author : 'Faculty / Admin');
      
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
          name: finalName,
          url: resolvedUrl || atUrl,
          cloudflareKey: cfKey,
          announcementContent: safeContent,
          authorName: String(authorName),
          createdAt: ann.createdAt || new Date().toISOString(),
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

  if (isFetching && announcements.length === 0) {
    return <TabSkeletonLoader type="rows" />;
  }

  if (!cls) return null;

  return (
    <div className="space-y-5">
      {/* In-app secure PDF preview modal */}
      {previewPdf && (
        <PdfViewerModal
          isOpen={!!previewPdf}
          onClose={() => setPreviewPdf(null)}
          url={previewPdf.url}
          title={previewPdf.name}
        />
      )}

      {/* Two Distinct Square Boxes for Text Announcements & PDF Documents */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-5 max-w-sm sm:max-w-md mx-auto">
        {/* Square Box 1: Text Announcements */}
        <button
          type="button"
          onClick={() => setSubTab("text")}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all relative overflow-hidden group aspect-square shadow-xs cursor-pointer ${
            subTab === "text"
              ? "bg-[#EFF6FF] border-[#93C5FD] text-[#1E40AF] scale-[1.03] ring-2 ring-[#2563EB] ring-offset-2 ring-offset-slate-50 shadow-md"
              : "bg-white border-slate-200 text-slate-700 hover:bg-blue-50/50 hover:border-blue-200 hover:scale-[1.01]"
          }`}
        >
          {textAnnouncementsCount > 0 && (
            <span className="absolute top-2.5 right-2.5 min-w-[22px] h-5.5 px-1.5 flex items-center justify-center rounded-full text-[11px] font-black shadow-2xs bg-[#2563EB] text-white">
              {textAnnouncementsCount > 99 ? "99+" : textAnnouncementsCount}
            </span>
          )}
          <Megaphone className={`w-8 h-8 mb-2 transition-transform group-hover:scale-110 ${subTab === 'text' ? 'text-[#2563EB]' : 'text-slate-500 group-hover:text-blue-600'}`} />
          <span className="text-xs sm:text-sm font-black tracking-tight text-center">Text Announcements</span>
          <span className="text-[10px] text-slate-400 mt-1 font-medium">{textAnnouncementsCount} {textAnnouncementsCount === 1 ? 'notice' : 'notices'}</span>
        </button>

        {/* Square Box 2: PDF Documents */}
        <button
          type="button"
          onClick={() => setSubTab("pdf")}
          className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all relative overflow-hidden group aspect-square shadow-xs cursor-pointer ${
            subTab === "pdf"
              ? "bg-[#FFF1F2] border-[#FECDD3] text-[#9F1239] scale-[1.03] ring-2 ring-[#E11D48] ring-offset-2 ring-offset-slate-50 shadow-md"
              : "bg-white border-slate-200 text-slate-700 hover:bg-rose-50/50 hover:border-rose-200 hover:scale-[1.01]"
          }`}
        >
          {pdfDocumentsCount > 0 && (
            <span className="absolute top-2.5 right-2.5 min-w-[22px] h-5.5 px-1.5 flex items-center justify-center rounded-full text-[11px] font-black shadow-2xs bg-[#E11D48] text-white">
              {pdfDocumentsCount > 99 ? "99+" : pdfDocumentsCount}
            </span>
          )}
          <FileText className={`w-8 h-8 mb-2 transition-transform group-hover:scale-110 ${subTab === 'pdf' ? 'text-[#E11D48]' : 'text-slate-500 group-hover:text-rose-600'}`} />
          <span className="text-xs sm:text-sm font-black tracking-tight text-center">PDF Documents</span>
          <span className="text-[10px] text-slate-400 mt-1 font-medium">{pdfDocumentsCount} {pdfDocumentsCount === 1 ? 'document' : 'documents'}</span>
        </button>
      </div>

      {/* Sub-tab 1: Text Announcements Content */}
      {subTab === "text" && (
        <div className="space-y-4 pt-2">
          {announcements.length === 0 && !isFetching && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-xs">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-500 mx-auto mb-3 border border-blue-100">
                <Megaphone className="h-7 w-7" />
              </div>
              <h4 className="text-slate-800 font-bold text-base mb-1">No Text Announcements Yet</h4>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                Faculty and administrators post important announcements, deadlines, and notices here.
              </p>
            </div>
          )}

          {announcements.map((ann: any, idx: number) => {
            if (!ann) return null;
            const authorName = typeof ann.author === 'object' && ann.author !== null
              ? (ann.author.fullName || ann.author.name || 'Faculty / Admin')
              : (typeof ann.author === 'string' && ann.author.trim() ? ann.author : 'Faculty / Admin');
            const safeAuthorName = String(authorName || 'Faculty / Admin');
            const initials = safeAuthorName
              .split(/\s+/)
              .filter(Boolean)
              .map((w: string) => w[0])
              .join("")
              .slice(0, 2) || "FA";

            const rawAttachments = Array.isArray(ann.attachments) ? ann.attachments : [];
            const safeContent = typeof ann.content === 'string' ? ann.content : (typeof ann.content === 'object' && ann.content !== null ? JSON.stringify(ann.content) : String(ann.content || ''));
            const annId = ann.id || ann._id || `ann-${idx}`;

            return (
              <div key={annId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-200 transition-all">
                <div className="flex items-start gap-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-blue-900 text-white font-bold text-xs shadow-2xs">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900 text-sm font-bold">{safeAuthorName}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          Instructor
                        </span>
                      </div>
                      <span className="text-slate-400 text-xs font-medium">{timeAgo(ann.createdAt)}</span>
                    </div>
                    <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">{safeContent}</div>

                    {rawAttachments.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-rose-500" />
                            <span>{rawAttachments.length} Attached {rawAttachments.length === 1 ? "Document" : "Documents"}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setSubTab("pdf")}
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                          >
                            <span>Open PDF Repository</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {rawAttachments.map((at: any, i: number) => {
                            if (!at) return null;
                            const atUrl = typeof at === 'string' ? at : (at.url || at.fileUrl || at.secure_url || at.link || at.path || '');
                            const cfKey = typeof at === 'object' && at !== null ? (at.cloudflareKey || at.publicId || at.key) : undefined;
                            const resolvedUrl = resolveAttachmentUrl(atUrl, cfKey);
                            if (!atUrl && !resolvedUrl && !cfKey) return null;
                            const rawName = typeof at === 'string' ? '' : (at.name || at.filename || at.title || '');
                            const fallbackName = cfKey ? cfKey.split('/').pop() : (atUrl ? atUrl.split('?')[0].split('/').pop() : `Document_${i + 1}.pdf`);
                            const atName = (rawName && rawName.trim()) ? rawName.trim() : (fallbackName || `Document_${i + 1}.pdf`);

                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setPreviewPdf({ url: resolvedUrl || atUrl, name: atName })}
                                className="inline-flex items-center gap-2 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-rose-800 transition-all cursor-pointer shadow-2xs group"
                              >
                                <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate max-w-[180px] sm:max-w-[240px]">{atName}</span>
                                <Eye className="h-3 w-3 text-rose-400 ml-0.5" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-tab 2: PDF Documents Content */}
      {subTab === "pdf" && (
        <div className="space-y-4 pt-2">
          {/* Top Banner & Search Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Classroom PDF Repository</h3>
                <p className="text-xs text-slate-500">
                  {allPdfs.length} {allPdfs.length === 1 ? "document" : "documents"} available
                </p>
              </div>
            </div>

            {allPdfs.length > 0 && (
              <div className="relative min-w-[220px] sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search PDF documents..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-400 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                />
              </div>
            )}
          </div>

          {/* Empty States */}
          {allPdfs.length === 0 && !isFetching && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-xs">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500 mx-auto mb-3 border border-rose-100">
                <FileText className="h-7 w-7" />
              </div>
              <h4 className="text-slate-800 font-bold text-base mb-1">No PDF Documents Yet</h4>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                Faculty study materials, lecture slides, assignments, and PDF notices uploaded for this classroom will appear here.
              </p>
            </div>
          )}

          {allPdfs.length > 0 && filteredPdfs.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-xs">
              <p className="text-slate-600 text-sm font-medium">No PDF documents match &quot;{searchQuery}&quot;</p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer underline"
              >
                Clear search filter
              </button>
            </div>
          )}

          {/* PDF Grid Cards */}
          {filteredPdfs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPdfs.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4.5 hover:border-rose-300 hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-xs">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
                            PDF
                          </span>
                          <span className="text-[11px] text-slate-400">{timeAgo(doc.createdAt)}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-1 truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                      </div>
                    </div>

                    {doc.announcementContent && (
                      <p className="mt-2.5 text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                        {doc.announcementContent}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500 truncate">
                      By <span className="font-medium text-slate-700">{doc.authorName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewPdf({ url: doc.url, name: doc.name })}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs hover:shadow cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View PDF</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Live Classes Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export { AnnouncementsTab as StudentAnnouncementsTab };
