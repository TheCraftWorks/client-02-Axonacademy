import React, { useState, useRef, useMemo } from "react";
import {
  LuClipboardList, LuPlus, LuX, LuTrash2, LuEye, LuCheck, LuSend,
  LuCalendar, LuClock, LuDownload, LuCopy, LuAward, LuCrown, LuMedal,
  LuSparkles, LuTrophy, LuSearch, LuRefreshCw, LuPrinter, LuLoader, LuBookOpen,
  LuFileText, LuImage, LuZoomIn, LuArrowLeft, LuUpload
} from "react-icons/lu";
import { DarkCard } from "@/components/portal/PortalShell";
import { useClassroomStore, classroomActions } from "@/lib/classroomStore";
import type { Classroom, Quiz, Question, Option, QuizAttempt } from "@/lib/classroomStore";
import { uid } from "@/lib/classroomStore";
import {
  getQuizReport, publishQuiz, closeQuiz, deleteQuiz as apiDeleteQuiz, createQuiz,
  updateQuiz, generateQuizFromPdf, uploadQuestionImage, api
} from "@/lib/api";
import { QuizLeaderboard } from "@/components/quiz/QuizLeaderboard";
import { AdminStudentAnswerSheetModal } from "@/components/quiz/AdminStudentAnswerSheetModal";
import { toast } from "sonner";
import { DarkTabSkeletonLoader, fmtDate, toISODateString, toDatetimeLocal } from "./shared";

function newQuestion(order: number, defaultMarks: number = 1): Question {
  return {
    id: uid(),
    type: "mcq",
    text: "",
    marks: defaultMarks,
    explanation: "",
    order,
    options: [
      { label: "A", text: "", isCorrect: false },
      { label: "B", text: "", isCorrect: false },
      { label: "C", text: "", isCorrect: false },
      { label: "D", text: "", isCorrect: false },
    ],
  };
}

function QuestionCard({ q, qIdx, onChange, onRemove }: {
  q: Question; qIdx: number;
  onChange: (updated: Question) => void;
  onRemove: () => void;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const setType = (type: Question["type"]) => {
    const opts: Option[] = type === "true_false"
      ? [{ label: "True", text: "True", isCorrect: true }, { label: "False", text: "False", isCorrect: false }]
      : [{ label: "A", text: "", isCorrect: false }, { label: "B", text: "", isCorrect: false }, { label: "C", text: "", isCorrect: false }, { label: "D", text: "", isCorrect: false }];
    onChange({ ...q, type, options: opts });
  };

  const toggleCorrect = (label: string) => {
    onChange({
      ...q,
      options: q.options.map((o) => ({
        ...o,
        isCorrect: q.type === "msq" ? (o.label === label ? !o.isCorrect : o.isCorrect) : (o.label === label),
      })),
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image (JPG, PNG, WebP, or GIF)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewImageUrl(localPreview);
    setIsUploadingImage(true);
    setImageUploadProgress(0);

    try {
      const result = await uploadQuestionImage({
        file,
        onProgress: (pct) => setImageUploadProgress(pct),
      });
      onChange({ ...q, image: result.url });
      toast.success("Question image uploaded to Cloudinary!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload question image");
      setPreviewImageUrl(null);
      onChange({ ...q, image: undefined });
    } finally {
      setIsUploadingImage(false);
      setImageUploadProgress(0);
      if (imageInputRef.current) imageInputRef.current.value = "";
      // Revoke local preview URL
      URL.revokeObjectURL(localPreview);
    }
  };

  const handleRemoveImage = () => {
    setPreviewImageUrl(null);
    onChange({ ...q, image: undefined });
  };

  const displayImageUrl = q.image || previewImageUrl;

  const LABELS = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="rounded-xl bg-cream/3 border border-cream/10 p-4 space-y-3">
      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImageSelect}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-lime/10 text-lime text-xs font-bold shrink-0">Q{qIdx + 1}</span>
        <select value={q.type} onChange={(e) => setType(e.target.value as Question["type"])}
          className="bg-cream/5 border border-cream/10 rounded-lg px-3 py-1.5 text-cream text-xs outline-none">
          <option value="mcq">Single Correct (MCQ)</option>
          <option value="msq">Multiple Correct (MSQ)</option>
          <option value="true_false">True / False</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <input type="number" min={0.5} step={0.5} value={q.marks} onChange={(e) => onChange({ ...q, marks: Number(e.target.value) })}
            className="w-16 bg-cream/5 border border-cream/10 rounded-lg px-2 py-1.5 text-cream text-xs outline-none text-center" />
          <span className="text-cream/50 text-xs">marks</span>
          <button onClick={onRemove} className="text-cream/30 hover:text-red-400 ml-2"><LuTrash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <textarea value={q.text} onChange={(e) => onChange({ ...q, text: e.target.value })}
        placeholder={`Question ${qIdx + 1} textâ€¦`} rows={2}
        className="w-full bg-cream/5 border border-cream/10 rounded-xl px-3 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none" />

      {/* â”€â”€ Question Image Upload (Optional) â”€â”€ */}
      <div className="flex items-start gap-3">
        {displayImageUrl ? (
          <div className="relative group">
            <img
              src={displayImageUrl}
              alt={`Q${qIdx + 1} image`}
              className="h-24 w-auto max-w-[200px] rounded-xl object-cover border border-cream/20 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(displayImageUrl, "_blank")}
            />
            {isUploadingImage && (
              <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-1">
                <LuLoader className="h-4 w-4 text-lime animate-spin" />
                <span className="text-xs text-white font-bold">{imageUploadProgress}%</span>
              </div>
            )}
            {!isUploadingImage && (
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => window.open(displayImageUrl, "_blank")}
                  className="bg-black/70 hover:bg-black/90 text-white p-1 rounded-md"
                  title="View full image"
                >
                  <LuZoomIn className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-md"
                  title="Remove image"
                >
                  <LuX className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isUploadingImage}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-cream/20 bg-cream/3 hover:bg-cream/5 hover:border-lime/40 text-cream/50 hover:text-lime text-xs font-medium transition-all disabled:opacity-50"
          >
            {isUploadingImage ? (
              <>
                <LuLoader className="h-3.5 w-3.5 animate-spin text-lime" />
                <span>Uploading {imageUploadProgress}%â€¦</span>
              </>
            ) : (
              <>
                <LuImage className="h-3.5 w-3.5 text-lime/70" />
                <span>Add Question Image <span className="text-cream/30 font-normal">(optional)</span></span>
              </>
            )}
          </button>
        )}
        {displayImageUrl && !isUploadingImage && (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="text-xs text-cream/40 hover:text-cream px-2 py-1 rounded-lg border border-cream/10 hover:border-cream/20 transition-colors"
          >
            Change Image
          </button>
        )}
      </div>

      <div className="space-y-2">
        {q.options.map((opt, oi) => (
          <div key={opt.label} className={`flex items-center gap-2 rounded-lg px-3 py-2 border transition-colors ${opt.isCorrect ? "border-lime/40 bg-lime/5" : "border-cream/10 bg-cream/2"}`}>
            <button onClick={() => toggleCorrect(opt.label)}
              className={`h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-bold border transition-colors ${opt.isCorrect ? "bg-lime border-lime text-plum-dark" : "border-cream/30 text-cream/50"}`}>
              {opt.isCorrect ? <LuCheck className="h-3 w-3" /> : opt.label}
            </button>
            {q.type === "true_false" ? (
              <span className="flex-1 text-sm text-cream/80">{opt.text}</span>
            ) : (
              <input value={opt.text} onChange={(e) => {
                const opts = [...q.options]; opts[oi] = { ...opts[oi], text: e.target.value };
                onChange({ ...q, options: opts });
              }} placeholder={`Option ${opt.label}`} className="flex-1 bg-transparent outline-none text-sm text-cream placeholder:text-cream/30" />
            )}
          </div>
        ))}
        {q.type !== "true_false" && q.options.length < 6 && (
          <button onClick={() => onChange({ ...q, options: [...q.options, { label: LABELS[q.options.length] || `Opt${q.options.length + 1}`, text: "", isCorrect: false }] })}
            className="text-lime/70 hover:text-lime text-xs flex items-center gap-1 mt-1">
            <LuPlus className="h-3 w-3" /> Add option
          </button>
        )}
      </div>
      <input value={q.explanation} onChange={(e) => onChange({ ...q, explanation: e.target.value })}
        placeholder="Explanation shown to student after submission (optional)" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-3 py-2 text-cream/70 text-xs outline-none focus:border-lime/50" />
    </div>
  );
}

function TestsTab({ classroom, refreshClassroom, isFetching }: { classroom: Classroom; refreshClassroom: () => Promise<Classroom>; isFetching?: boolean }) {
  const cls = classroom;
  const classroomId = classroom.id;
  const { classrooms } = useClassroomStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [quizOperationQuizId, setQuizOperationQuizId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [viewQuizId, setViewQuizId] = useState<string | null>(null);
  const [reportAttempts, setReportAttempts] = useState<QuizAttempt[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState("");
  const [inspectStudentAttempt, setInspectStudentAttempt] = useState<any | null>(null);
  const [adminReportTab, setAdminReportTab] = useState<"table" | "leaderboard">("table");

  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [duplicateQuiz, setDuplicateQuiz] = useState<Quiz | null>(null);
  const [selectedTargetClassrooms, setSelectedTargetClassrooms] = useState<string[]>([]);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [bulkMarksEnabled, setBulkMarksEnabled] = useState(false);
  const [bulkMarksValue, setBulkMarksValue] = useState(4);
  const [bulkNegEnabled, setBulkNegEnabled] = useState(false);
  const [bulkNegValue, setBulkNegValue] = useState(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  React.useEffect(() => {
    if (!viewQuizId) {
      setReportAttempts([]);
      return;
    }
    let active = true;
    const loadReport = async () => {
      setIsLoadingReport(true);
      setReportError("");
      try {
        const attempts = await getQuizReport(viewQuizId);
        if (!active) return;
        setReportAttempts(attempts);
      } catch (err) {
        if (active) toast.error(err instanceof Error ? err.message : "Could not load quiz report");
      } finally {
        if (active) setIsLoadingReport(false);
      }
    };
    loadReport();
    return () => {
      active = false;
    };
  }, [viewQuizId]);

  const [quiz, setQuiz] = useState<Omit<Quiz, "id" | "attempts">>({
    title: "", instructions: "", duration: null, maxAttempts: 1,
    randomizeQuestions: true, randomizeOptions: true,
    showLeaderboard: false, negativeMarking: true,
    negativeMarkValue: 1, passPercent: 60,
    availableFrom: "", availableUntil: "",
    status: "draft", questions: [],
  });

  const updateQ = (idx: number, updated: Question) => {
    setQuiz((q) => { const qs = [...q.questions]; qs[idx] = updated; return { ...q, questions: qs }; });
    if (updated.marks !== bulkMarksValue) {
      setBulkMarksEnabled(false);
    }
  };

  const totalMarks = quiz.questions.reduce((s, q) => s + q.marks, 0);

  const handleSave = async (status: Quiz["status"]) => {
    if (!quiz.title || quiz.questions.length === 0) return;
    setIsSavingQuiz(true);
    try {
      const quizPayload = {
        ...quiz,
        status,
        availableFrom: toISODateString(quiz.availableFrom),
        availableUntil: toISODateString(quiz.availableUntil),
      };

      if (editingQuizId) {
        const updatedQuiz = await updateQuiz(editingQuizId, quizPayload);
        classroomActions.updateQuiz(classroomId, editingQuizId, updatedQuiz);
      } else {
        const createdQuiz = await createQuiz(classroomId, quizPayload);
        classroomActions.addQuiz(classroomId, createdQuiz);
      }
      await refreshClassroom();
      setShowBuilder(false);
      setEditingQuizId(null);
      setQuiz({ title: "", instructions: "", duration: null, maxAttempts: 1, randomizeQuestions: true, randomizeOptions: true, showLeaderboard: false, negativeMarking: true, negativeMarkValue: 1, passPercent: 60, availableFrom: "", availableUntil: "", status: "draft", questions: [] });
      setBulkMarksEnabled(false);
      setBulkMarksValue(4);
      setBulkNegEnabled(false);
      setBulkNegValue(1);
      toast.success(status === "published" ? "Quiz published successfully!" : "Quiz saved as draft.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Could not save quiz.');
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsGeneratingPdf(true);
    try {
      const generatedQuestions = await generateQuizFromPdf(file);
      if (generatedQuestions && Array.isArray(generatedQuestions)) {
        // Map unique IDs and orders to the generated questions
        const newQuestions = generatedQuestions.map((q: any, i: number) => ({
          id: uid(),
          type: q.type || "mcq",
          text: q.text,
          marks: q.marks || (bulkMarksEnabled ? bulkMarksValue : 1),
          explanation: "",
          order: quiz.questions.length + i + 1,
          options: (q.options || []).map((o: any) => ({
            label: o.label,
            text: o.text,
            isCorrect: false
          }))
        }));

        setQuiz(prev => ({
          ...prev,
          questions: [...prev.questions, ...newQuestions]
        }));
        toast.success("Questions generated from PDF.");
      }
    } catch (error) {
      console.error("PDF Generation error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate questions from PDF");
    } finally {
      setIsGeneratingPdf(false);
      // Reset input value to allow re-upload of same file if needed
      e.target.value = "";
    }
  };

  const handlePublishQuiz = async (quizId: string) => {
    setQuizOperationQuizId(quizId);
    try {
      await publishQuiz(quizId);
      classroomActions.updateQuizStatus(classroomId, quizId, "published");
      toast.success("Quiz published.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to publish quiz.");
    } finally {
      setQuizOperationQuizId(null);
    }
  };

  const handleCloseQuiz = async (quizId: string) => {
    setQuizOperationQuizId(quizId);
    try {
      await closeQuiz(quizId);
      classroomActions.updateQuizStatus(classroomId, quizId, "closed");
      toast.success("Quiz closed.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to close quiz.");
    } finally {
      setQuizOperationQuizId(null);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    setQuizOperationQuizId(quizId);
    try {
      await apiDeleteQuiz(quizId);
      classroomActions.deleteQuiz(classroomId, quizId);
      toast.success("Quiz deleted.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete quiz.");
    } finally {
      setQuizOperationQuizId(null);
    }
  };

  const handleDownloadQuiz = (q: Quiz, format: 'pdf' | 'doc' | 'print') => {
    const totalMarks = q.questions.reduce((s, quest) => s + quest.marks, 0);

    // Create professional HTML structure
    let htmlContent = `
      <div class="header">
        <h1>${cls.name}</h1>
        <h2>${q.title}</h2>
        ${q.instructions ? `<h3>${q.instructions}</h3>` : ''}
        <div class="meta">
          <span><strong>Total Marks:</strong> ${totalMarks}</span>
          <span><strong>Time:</strong> ${q.duration ? q.duration + ' mins' : 'N/A'}</span>
        </div>
      </div>
      <hr class="header-divider" />
      <div class="questions">
    `;

    q.questions.forEach((quest, i) => {
      htmlContent += `
        <div class="question">
          <div class="q-header">
            <div class="q-title-container">
              <span class="q-num">Q${i + 1}.</span>
              <span class="q-text">${quest.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            </div>
            <span class="q-marks">[${quest.marks} Marks]</span>
          </div>
          <div class="options">
      `;
      quest.options.forEach((opt) => {
        htmlContent += `
            <div class="option">
              <span class="option-label">${opt.label})</span>
              <span class="option-text">${opt.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
            </div>
        `;
      });
      htmlContent += `</div></div>`; // end options and question
    });

    htmlContent += `</div>`;

    const fullHtml = `
      <html>
        <head>
          <title>${q.title}</title>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Times New Roman', serif; line-height: 1.5; padding: 40px; color: black; background: white; max-width: 820px; margin: 0 auto; }
            .header { text-align: center; }
            .header h1 { margin: 0 0 10px 0; font-size: 26px; text-transform: uppercase; font-weight: bold; }
            .header h2 { margin: 0 0 8px 0; font-size: 19px; font-weight: bold; }
            .header h3 { margin: 0 0 15px 0; font-size: 16px; font-weight: normal; }
            .meta { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-top: 25px; margin-bottom: 5px; }
            .header-divider { border: none; border-top: 2.5px solid #000; margin: 15px 0 35px 0; }
            .questions { display: flex; flex-direction: column; gap: 35px; }
            .question { page-break-inside: avoid; break-inside: avoid; }
            .q-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; font-size: 16px; line-height: 1.5; }
            .q-title-container { display: flex; align-items: flex-start; flex-grow: 1; text-align: left; }
            .q-num { font-weight: bold; min-width: 35px; display: inline-block; flex-shrink: 0; }
            .q-text { flex-grow: 1; word-break: break-word; }
            .q-marks { font-weight: bold; font-size: 14px; margin-left: 20px; white-space: nowrap; flex-shrink: 0; }
            .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 40px; margin-left: 35px; }
            .option { display: flex; align-items: flex-start; font-size: 15px; line-height: 1.4; }
            .option-label { font-weight: bold; min-width: 25px; display: inline-block; flex-shrink: 0; }
            .option-text { flex-grow: 1; word-break: break-word; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

    if (format === 'doc') {
      const blob = new Blob(['\ufeff', fullHtml], { type: "application/msword" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${q.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_quiz.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (format === 'print') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      } else {
        toast.error("Failed to open print window. Please allow popups for this site.");
      }
    } else if (format === 'pdf') {
      const filename = `${q.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_quiz.pdf`;
      const toastId = toast.loading("Preparing PDF download...");

      setTimeout(async () => {
        // Create an isolated off-screen iframe to render the HTML document safely without touch/scroll interference
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '750px';
        iframe.style.height = '1000px';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);

        try {
          const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
          if (!iframeDoc) {
            throw new Error("Could not access iframe document");
          }

          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();

          // Wait 250ms for fonts and CSS layout to resolve in iframe
          await new Promise((r) => setTimeout(r, 250));

          // Set iframe height dynamically to match scrollHeight to prevent page clipping in canvas rendering
          const contentHeight = iframeDoc.documentElement?.scrollHeight || iframeDoc.body?.scrollHeight || 1000;
          iframe.style.height = `${contentHeight}px`;

          // Resolve html2pdf function robustly
          // @ts-ignore
          const html2pdfModule = await import("html2pdf.js");
          const html2pdfFn = html2pdfModule.default || html2pdfModule;
          if (typeof html2pdfFn !== 'function') {
            throw new Error('html2pdf package is not resolving to a function');
          }

          const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          const opt = {
            margin: 12,
            filename: filename,
            image: { type: 'jpeg' as const, quality: 0.98 },
            html2canvas: {
              scale: isMobile ? 1.0 : 1.2, // Avoid canvas memory crashes on mobile/tablet devices
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff', // Force canvas background to white (transparency defaults to black in JPEG)
              window: iframe.contentWindow || undefined,
              onclone: (clonedDoc: Document) => {
                try {
                  // Remove all parent stylesheets that were copied to the cloned document.
                  // This prevents parent dark/navy styles and variables from polluting the print template.
                  const styleSheets = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
                  styleSheets.forEach((s) => {
                    const text = s.textContent || '';
                    if (text.includes('Times New Roman') || text.includes('q-header') || text.includes('q-marks')) {
                      // Keep our custom print styles
                      return;
                    }
                    s.parentNode?.removeChild(s);
                  });

                  // Ensure document element and body have white background and black text
                  if (clonedDoc.documentElement) {
                    clonedDoc.documentElement.style.cssText = 'background-color: #ffffff !important; color: #000000 !important; color-scheme: light !important;';
                  }
                  if (clonedDoc.body) {
                    clonedDoc.body.style.cssText = 'background-color: #ffffff !important; color: #000000 !important; color-scheme: light !important;';
                  }
                } catch (e) {
                  console.warn("onclone clean styles error:", e);
                }
              }
            },
            jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
          };

          let pdfBlob: Blob | null = null;
          try {
            pdfBlob = await html2pdfFn().from(iframeDoc.body).set(opt).outputPdf('blob');
          } catch (e1) {
            console.warn("outputPdf('blob') failed, trying toPdf().output('blob'):", e1);
            try {
              pdfBlob = await html2pdfFn().from(iframeDoc.body).set(opt).toPdf().output('blob');
            } catch (e2) {
              console.warn("toPdf().output('blob') failed:", e2);
            }
          }

          if (!pdfBlob || pdfBlob.size === 0) {
            // Native save fallback
            await html2pdfFn().from(iframeDoc.body).set(opt).save();
            toast.dismiss(toastId);
            toast.success("PDF Downloaded!");
            return;
          }

          const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

          // On mobile devices, use native Web Share API if supported for direct Save to Files / Downloads
          if (isMobile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            try {
              await navigator.share({
                files: [pdfFile],
                title: q.title || 'Quiz PDF',
              });
              toast.dismiss(toastId);
              toast.success("PDF saved!");
              return;
            } catch (shareErr: any) {
              if (shareErr.name === 'AbortError') {
                toast.dismiss(toastId);
                return;
              }
              console.warn("navigator.share failed, falling back to anchor download:", shareErr);
            }
          }

          // Direct anchor file download trigger (NO target="_blank") to save file directly
          const blobUrl = URL.createObjectURL(pdfBlob);
          const downloadLink = document.createElement('a');
          downloadLink.href = blobUrl;
          downloadLink.download = filename;
          document.body.appendChild(downloadLink);
          downloadLink.click();

          toast.dismiss(toastId);
          toast.success("PDF Downloaded!");

          setTimeout(() => {
            if (downloadLink.parentNode) {
              document.body.removeChild(downloadLink);
            }
            URL.revokeObjectURL(blobUrl);
          }, 10000);
        } catch (err: any) {
          console.error("PDF generation error:", err);
          toast.dismiss(toastId);
          toast.error("Failed to generate PDF. Please try again.");
        } finally {
          // ALWAYS clean up iframe so main page touch and scroll are never blocked
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }
      }, 50);
    }
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateQuiz || selectedTargetClassrooms.length === 0) return;
    setIsDuplicating(true);
    try {
      const quizData = {
        title: `${duplicateQuiz.title}`,
        instructions: duplicateQuiz.instructions,
        duration: duplicateQuiz.duration,
        maxAttempts: duplicateQuiz.maxAttempts,
        randomizeQuestions: duplicateQuiz.randomizeQuestions,
        randomizeOptions: duplicateQuiz.randomizeOptions,
        showLeaderboard: duplicateQuiz.showLeaderboard,
        negativeMarking: duplicateQuiz.negativeMarking,
        negativeMarkValue: duplicateQuiz.negativeMarkValue,
        passPercent: duplicateQuiz.passPercent,
        availableFrom: duplicateQuiz.availableFrom,
        availableUntil: duplicateQuiz.availableUntil,
        status: "draft",
        questions: duplicateQuiz.questions.map((quest) => ({
          type: quest.type,
          text: quest.text,
          image: quest.image,
          marks: quest.marks,
          explanation: quest.explanation,
          options: quest.options.map((o) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        })),
      };

      for (const targetId of selectedTargetClassrooms) {
        await createQuiz(targetId, quizData);
      }

      toast.success("Quiz duplicated successfully to selected class(es)!");
      setDuplicateQuiz(null);
      setSelectedTargetClassrooms([]);
      await refreshClassroom();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Duplication failed");
    } finally {
      setIsDuplicating(false);
    }
  };

  if (showBuilder) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            setShowBuilder(false);
            setEditingQuizId(null);
            setQuiz({ title: "", instructions: "", duration: null, maxAttempts: 1, randomizeQuestions: true, randomizeOptions: true, showLeaderboard: false, negativeMarking: false, negativeMarkValue: 0.25, passPercent: 60, availableFrom: "", availableUntil: "", status: "draft", questions: [] });
            setBulkMarksEnabled(false);
            setBulkMarksValue(1);
            setBulkNegEnabled(true);
            setBulkNegValue(1);
          }} className="text-cream/60 hover:text-cream"><LuArrowLeft className="h-5 w-5" /></button>
          <h2 className="font-display font-bold text-cream text-xl">{editingQuizId ? "Edit Quiz" : "Quiz Builder"}</h2>
        </div>

        {/* Settings */}
        <DarkCard className="space-y-4">
          <h3 className="font-display font-bold text-cream">Quiz Settings</h3>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Quiz Title *</label>
            <input value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
              placeholder="e.g. Module 2 Assessment â€” Ventilator Management" className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Instructions for students</label>
            <textarea value={quiz.instructions} onChange={(e) => setQuiz({ ...quiz, instructions: e.target.value })}
              rows={2} className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50 resize-none" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Timer (min, blank = no timer)</label>
              <input type="number" min={1} value={quiz.duration ?? ""} onChange={(e) => setQuiz({ ...quiz, duration: e.target.value ? Number(e.target.value) : null })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Max Attempts</label>
              <input type="number" min={1} value={quiz.maxAttempts} onChange={(e) => setQuiz({ ...quiz, maxAttempts: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Pass Mark %</label>
              <input type="number" min={1} max={100} value={quiz.passPercent} onChange={(e) => setQuiz({ ...quiz, passPercent: Number(e.target.value) })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Available From</label>
              <input type="datetime-local" value={quiz.availableFrom} onChange={(e) => setQuiz({ ...quiz, availableFrom: e.target.value })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-cream/60 block mb-1">Available Until</label>
              <input type="datetime-local" value={quiz.availableUntil} onChange={(e) => setQuiz({ ...quiz, availableUntil: e.target.value })}
                className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-2.5 text-cream text-sm outline-none focus:border-lime/50" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { key: "randomizeQuestions", label: "Randomize question order" },
              { key: "randomizeOptions", label: "Randomize option order" },
              { key: "negativeMarking", label: "Negative marking (âˆ’1/wrong)" },
              { key: "showLeaderboard", label: "Show leaderboard to students" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(quiz[key as keyof typeof quiz])}
                  onChange={(e) => setQuiz({ ...quiz, [key]: e.target.checked })} className="accent-lime" />
                <span className="text-cream/80 text-sm">{label}</span>
              </label>
            ))}
          </div>
        </DarkCard>

        {/* Bulk Marks Setter â€” Checkbox approach */}
        {quiz.questions.length > 0 && (
          <DarkCard className="space-y-3">
            <span className="text-cream/70 text-sm font-semibold">Quick apply to all questions:</span>
            <div className="flex flex-wrap gap-4">
              {/* Fix Marks */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={bulkMarksEnabled}
                  className="accent-lime h-4 w-4"
                  onChange={(e) => {
                    setBulkMarksEnabled(e.target.checked);
                    if (e.target.checked) {
                      setQuiz(q => ({ ...q, questions: q.questions.map(quest => ({ ...quest, marks: bulkMarksValue })) }));
                    }
                  }}
                />
                <span className="text-cream/80 text-sm">Fix marks:</span>
                <input
                  type="number" min={0.5} step={0.5}
                  value={bulkMarksValue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBulkMarksValue(val);
                    if (bulkMarksEnabled && val > 0) {
                      setQuiz(q => ({ ...q, questions: q.questions.map(quest => ({ ...quest, marks: val })) }));
                    }
                  }}
                  className="w-16 bg-cream/5 border border-cream/20 rounded-lg px-2 py-1 text-cream text-xs outline-none text-center focus:border-lime/50"
                />
                <span className="text-cream/50 text-xs">marks / question</span>
              </label>

              {/* Fix Negative Marks */}
              {quiz.negativeMarking && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bulkNegEnabled}
                    className="accent-red-400 h-4 w-4"
                    onChange={(e) => {
                      setBulkNegEnabled(e.target.checked);
                      if (e.target.checked) {
                        setQuiz(q => ({ ...q, negativeMarkValue: bulkNegValue }));
                      }
                    }}
                  />
                  <span className="text-cream/80 text-sm">Fix negative mark:</span>
                  <input
                    type="number" min={0.25} step={0.25}
                    value={bulkNegValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBulkNegValue(val);
                      if (bulkNegEnabled && val > 0) {
                        setQuiz(q => ({ ...q, negativeMarkValue: val }));
                      }
                    }}
                    className="w-16 bg-cream/5 border border-cream/20 rounded-lg px-2 py-1 text-cream text-xs outline-none text-center focus:border-red-400/50"
                  />
                  <span className="text-cream/50 text-xs">marks deducted</span>
                </label>
              )}
            </div>
          </DarkCard>
        )}

        {/* Questions */}
        <div className="space-y-3">
          {quiz.questions.map((q, i) => (
            <QuestionCard key={q.id} q={q} qIdx={i} onChange={(u) => updateQ(i, u)} onRemove={() => setQuiz((qz) => ({ ...qz, questions: qz.questions.filter((_, ci) => ci !== i) }))} />
          ))}

          {isGeneratingPdf && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl bg-cream/3 border border-cream/10 p-4 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-lime/10 text-lime text-xs font-bold shrink-0">
                      Q{quiz.questions.length + i}
                    </span>
                    <div className="h-7 w-36 bg-cream/10 rounded-lg" />
                    <div className="h-7 w-20 bg-cream/10 rounded-lg ml-auto" />
                  </div>
                  <div className="h-12 bg-cream/5 rounded-xl w-full" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((optI) => (
                      <div key={optI} className="h-9 bg-cream/5 rounded-lg w-full flex items-center px-3 gap-2">
                        <div className="h-5 w-5 rounded-full bg-cream/10 shrink-0" />
                        <div className="h-3 bg-cream/10 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => setQuiz((q) => ({ ...q, questions: [...q.questions, newQuestion(q.questions.length + 1, bulkMarksEnabled ? bulkMarksValue : 1)] }))}
            className="flex-1 rounded-2xl border-2 border-dashed border-lime/20 hover:border-lime/40 py-5 text-lime/70 hover:text-lime text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
            <LuPlus className="h-4 w-4" /> Add Question
          </button>
          <label className={`flex-1 rounded-2xl border-2 border-dashed border-lime/20 hover:border-lime/40 py-5 text-lime/70 hover:text-lime text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${isGeneratingPdf ? 'opacity-50 pointer-events-none' : ''}`}>
            <LuUpload className="h-4 w-4" /> {isGeneratingPdf ? 'Generating...' : 'Upload PDF (AI)'}
            <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={isGeneratingPdf} />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-cream/5 px-5 py-3">
          <span className="text-cream/60 text-sm">Questions: <strong className="text-cream">{quiz.questions.length}</strong></span>
          <span className="text-cream/60 text-sm">Total marks: <strong className="text-cream">{totalMarks}</strong></span>
          <span className="text-cream/60 text-sm">Est. time: <strong className="text-cream">~{quiz.questions.length * 2}m</strong></span>
        </div>

        <div className="flex gap-3">
          <button onClick={() => handleSave("draft")}
            disabled={quiz.questions.length === 0 || isSavingQuiz}
            className="flex-1 rounded-full bg-cream/10 text-cream py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            {isSavingQuiz ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave("published")}
            disabled={quiz.questions.length === 0 || isSavingQuiz}
            className="flex-1 rounded-full bg-lime text-plum-dark py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50">
            {isSavingQuiz ? 'Publishing...' : 'Publish & Notify Students'}
          </button>
        </div>
      </div>
    );
  }

  // Quiz Report View
  if (viewQuizId) {
    const q = cls.quizzes.find((x) => x.id === viewQuizId);
    if (!q) return null;
    const submitted = reportAttempts.filter((a) => a.status === "submitted");
    const passRate = submitted.length ? Math.round(submitted.filter((a) => a.score.passed).length / submitted.length * 100) : 0;
    const avgScore = submitted.length ? Math.round(submitted.reduce((s, a) => s + a.score.percentage, 0) / submitted.length) : 0;

    const sortedAttempts = [...submitted].sort((a: any, b: any) => {
      const aPct = a.score?.percentage ?? 0;
      const bPct = b.score?.percentage ?? 0;
      if (bPct !== aPct) return bPct - aPct;

      const aCorrect = a.correctCount ?? (a.answers?.filter((x: any) => x.isCorrect).length || 0);
      const bCorrect = b.correctCount ?? (b.answers?.filter((x: any) => x.isCorrect).length || 0);
      if (bCorrect !== aCorrect) return bCorrect - aCorrect;

      const aRaw = a.score?.rawMarks ?? 0;
      const bRaw = b.score?.rawMarks ?? 0;
      if (bRaw !== aRaw) return bRaw - aRaw;

      return (a.totalTimeTakenSec || 0) - (b.totalTimeTakenSec || 0);
    });
    const rank1 = sortedAttempts[0];
    const rank2 = sortedAttempts[1];
    const rank3 = sortedAttempts[2];

    const formatSec = (sec?: number) => {
      if (!sec || sec <= 0) return "< 1m";
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      if (m === 0) return `${s}s`;
      return `${m}m ${s}s`;
    };

    return (
      <div className="space-y-6 text-slate-900">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewQuizId(null)}
              className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors shadow-xs"
            >
              <LuArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="font-display font-bold text-slate-900 text-lg sm:text-xl">{q.title} â€” Report & Mark Sheet</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                {isLoadingReport ? "Loading submissionsâ€¦" : `${submitted.length} submissions Â· ${passRate}% pass rate Â· ${avgScore}% avg score`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void refreshClassroom().then(() => getQuizReport(viewQuizId).then(setReportAttempts))}
              disabled={isLoadingReport}
              className="flex items-center gap-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-1.5 text-xs font-semibold disabled:opacity-40 transition-colors shadow-xs"
            >
              <LuRefreshCw className={`w-3.5 h-3.5 ${isLoadingReport ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        {isLoadingReport ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 text-center animate-pulse shadow-xs">
                <div className="h-3 bg-slate-100 rounded w-16 mx-auto mb-2" />
                <div className="h-7 bg-slate-150 rounded w-12 mx-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { l: "Total Submissions", v: submitted.length },
              { l: "Pass Rate", v: `${passRate}%` },
              { l: "Average Score", v: `${avgScore}%` },
              { l: "Top Score", v: submitted.length > 0 ? `${Math.max(...submitted.map(a => a.score.percentage))}%` : "0%" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white border border-slate-200 p-4 text-center shadow-xs">
                <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">{s.l}</div>
                <div className="font-display text-2xl font-bold text-slate-900 mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Top 3 Podium Achievers - 3-by-3 Responsive Olympic Pedestal */}
        {!isLoadingReport && sortedAttempts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LuTrophy className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Top 3 Podium Achievers
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <LuSparkles className="w-3 h-3 text-amber-500" /> Olympic Pedestal
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-4 items-end pt-5 sm:pt-6">
              {/* Rank 2 (Silver - Left) */}
              {rank2 ? (
                <div className="p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-300/80 bg-linear-to-b from-slate-50 via-slate-100/60 to-slate-200/60 flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-xs">
                  <div className="absolute -top-3 sm:-top-4 px-2 sm:px-3 py-0.5 rounded-full bg-slate-200 text-slate-800 border border-slate-300 text-[9px] sm:text-[11px] font-black shadow-xs flex items-center gap-1 ring-2 ring-white">
                    <LuMedal className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-slate-600" /> 2ND RANK
                  </div>
                  <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-br from-slate-100 to-slate-300 border-2 border-white shadow-sm flex items-center justify-center font-display font-bold text-sm sm:text-xl text-slate-800 ring-2 ring-slate-300/50 mt-1">
                    {rank2.studentName.charAt(0).toUpperCase()}
                  </div>
                  <h5 className="font-display font-bold text-[11px] sm:text-sm mt-1.5 truncate w-full text-slate-900 px-0.5">
                    {rank2.studentName}
                  </h5>
                  <div className="text-[11px] sm:text-base font-mono font-black text-slate-900 mt-0.5 leading-tight">
                    {rank2.score.percentage}%
                  </div>
                  <div className="text-[9px] sm:text-xs font-mono font-bold text-slate-600">
                    {rank2.score.rawMarks}/{rank2.score.totalMarks} Marks
                  </div>
                  <div className="text-[9px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden xs:block truncate max-w-full">
                    {(rank2.correctCount ?? 0) + (rank2.wrongCount ?? 0)}/{rank2.totalQuestions || q.questions?.length || 50} Qs Attended
                  </div>
                  <div className="text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-medium text-slate-500">
                    <LuClock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" /> {formatSec(rank2.totalTimeTakenSec)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectStudentAttempt(rank2)}
                    className="mt-2 w-full max-w-[120px] py-1 sm:py-1.5 px-2 rounded-xl bg-white hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] sm:text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-1"
                  >
                    <LuEye className="w-3 h-3 text-slate-500" />
                    <span className="hidden sm:inline">View</span> Sheet
                  </button>
                  {/* Stepped Pedestal Base */}
                  <div className="mt-2.5 sm:mt-3.5 w-full h-7 sm:h-10 rounded-xl bg-linear-to-b from-slate-300 to-slate-400 flex items-center justify-center text-slate-800 font-display font-black text-sm sm:text-lg shadow-inner border-t border-slate-100">
                    2
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center opacity-60">
                  <p className="text-[10px] sm:text-xs py-6 text-slate-400">No 2nd rank</p>
                </div>
              )}

              {/* Rank 1 (Gold - Center Champion) */}
              {rank1 && (
                <div className="p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-amber-300/90 bg-linear-to-b from-amber-50 via-amber-100/50 to-amber-200/60 flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl shadow-md ring-2 sm:ring-4 ring-amber-400/25">
                  <div className="absolute -top-4 sm:-top-5 px-2.5 sm:px-4 py-0.5 rounded-full bg-linear-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 text-[10px] sm:text-xs font-black shadow-md flex items-center gap-1 sm:gap-1.5 animate-bounce ring-2 ring-white">
                    <LuCrown className="w-3 h-3 sm:w-4 sm:h-4 fill-current" /> 1ST RANK ðŸ†
                  </div>
                  <div className="relative mt-1">
                    <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-2xl bg-linear-to-br from-amber-200 to-amber-400 border-2 sm:border-3 border-white shadow-md flex items-center justify-center font-display font-black text-base sm:text-2xl text-amber-950 ring-2 sm:ring-3 ring-amber-400/50">
                      {rank1.studentName.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 text-slate-950 border border-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs">
                      ðŸ†
                    </span>
                  </div>
                  <h5 className="font-display font-black text-xs sm:text-base mt-2 truncate w-full text-slate-900 px-1">
                    {rank1.studentName}
                  </h5>
                  <div className="text-xs sm:text-lg font-mono font-black text-amber-950 mt-0.5 leading-tight">
                    {rank1.score.percentage}%
                  </div>
                  <div className="text-[10px] sm:text-xs font-mono font-bold text-amber-900/90">
                    {rank1.score.rawMarks}/{rank1.score.totalMarks} Marks
                  </div>
                  <div className="text-[9px] sm:text-xs text-amber-900/80 font-semibold mt-0.5 hidden xs:block truncate max-w-full">
                    {(rank1.correctCount ?? 0) + (rank1.wrongCount ?? 0)}/{rank1.totalQuestions || q.questions?.length || 50} Qs Attended
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[9px] sm:text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200">
                    <LuCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {rank1.correctCount ?? (rank1.answers?.filter((a: any) => a.isCorrect).length || 0)} Correct
                  </div>
                  <div className="text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-semibold text-slate-600">
                    <LuClock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-600" /> {formatSec(rank1.totalTimeTakenSec)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectStudentAttempt(rank1)}
                    className="mt-2 w-full max-w-[130px] py-1 sm:py-1.5 px-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-[10px] sm:text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1"
                  >
                    <LuEye className="w-3 h-3 text-slate-950" />
                    <span className="hidden sm:inline">View</span> Sheet
                  </button>
                  {/* Stepped Pedestal Base */}
                  <div className="mt-2.5 sm:mt-3.5 w-full h-10 sm:h-14 rounded-xl bg-linear-to-b from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 font-display font-black text-base sm:text-2xl shadow-inner border-t border-amber-200">
                    1
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze - Right) */}
              {rank3 ? (
                <div className="p-2 sm:p-4 rounded-2xl sm:rounded-3xl border border-amber-200/80 bg-linear-to-b from-amber-50/40 via-amber-100/40 to-amber-200/50 flex flex-col items-center text-center relative transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-xs">
                  <div className="absolute -top-3 sm:-top-4 px-2 sm:px-3 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] sm:text-[11px] font-black shadow-xs flex items-center gap-1 ring-2 ring-white">
                    <LuMedal className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-700" /> 3RD RANK
                  </div>
                  <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-br from-amber-100 to-amber-300 border-2 border-white shadow-sm flex items-center justify-center font-display font-bold text-sm sm:text-xl text-amber-900 ring-2 ring-amber-300/50 mt-1">
                    {rank3.studentName.charAt(0).toUpperCase()}
                  </div>
                  <h5 className="font-display font-bold text-[11px] sm:text-sm mt-1.5 truncate w-full text-slate-900 px-0.5">
                    {rank3.studentName}
                  </h5>
                  <div className="text-[11px] sm:text-base font-mono font-black text-slate-900 mt-0.5 leading-tight">
                    {rank3.score.percentage}%
                  </div>
                  <div className="text-[9px] sm:text-xs font-mono font-bold text-slate-600">
                    {rank3.score.rawMarks}/{rank3.score.totalMarks} Marks
                  </div>
                  <div className="text-[9px] sm:text-xs text-slate-500 font-medium mt-0.5 hidden xs:block truncate max-w-full">
                    {(rank3.correctCount ?? 0) + (rank3.wrongCount ?? 0)}/{rank3.totalQuestions || q.questions?.length || 50} Qs Attended
                  </div>
                  <div className="text-[9px] sm:text-xs flex items-center gap-1 mt-1 font-medium text-slate-500">
                    <LuClock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" /> {formatSec(rank3.totalTimeTakenSec)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectStudentAttempt(rank3)}
                    className="mt-2 w-full max-w-[120px] py-1 sm:py-1.5 px-2 rounded-xl bg-white hover:bg-amber-100/80 text-amber-900 border border-amber-200 text-[10px] sm:text-xs font-semibold transition-all shadow-2xs flex items-center justify-center gap-1"
                  >
                    <LuEye className="w-3 h-3 text-amber-700" />
                    <span className="hidden sm:inline">View</span> Sheet
                  </button>
                  {/* Stepped Pedestal Base */}
                  <div className="mt-2.5 sm:mt-3.5 w-full h-5 sm:h-8 rounded-xl bg-linear-to-b from-amber-300 to-amber-400 flex items-center justify-center text-amber-950 font-display font-black text-xs sm:text-base shadow-inner border-t border-amber-100">
                    3
                  </div>
                </div>
              ) : (
                <div className="p-2 sm:p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-center opacity-60">
                  <p className="text-[10px] sm:text-xs py-6 text-slate-400">No 3rd rank</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Marksheet Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <LuClipboardList className="w-4 h-4 text-slate-600" />
              <span>Full Student Mark Sheet ({submitted.length})</span>
            </h4>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-[11px] uppercase tracking-wider text-slate-600 font-bold text-left">
                    <th className="p-3.5 pl-4 w-14">Rank</th>
                    <th className="p-3.5 min-w-[160px]">Student</th>
                    <th className="p-3.5 text-center min-w-[120px] whitespace-nowrap">Score & Qs</th>
                    <th className="p-3.5 text-center min-w-[75px] whitespace-nowrap">%</th>
                    <th className="p-3.5 text-center min-w-[150px] whitespace-nowrap">Breakdown</th>
                    <th className="p-3.5 min-w-[80px] whitespace-nowrap">Status</th>
                    <th className="p-3.5 min-w-[110px] whitespace-nowrap">Submitted</th>
                    <th className="p-3.5 pr-4 text-right min-w-[120px] whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingReport ? (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="border-t border-slate-100 animate-pulse">
                          <td className="p-3.5 pl-4"><div className="h-5 bg-slate-100 rounded w-6" /></td>
                          <td className="p-3.5"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                          <td className="p-3.5"><div className="h-4 bg-slate-100 rounded w-14 mx-auto" /></td>
                          <td className="p-3.5"><div className="h-4 bg-slate-100 rounded w-10 mx-auto" /></td>
                          <td className="p-3.5"><div className="h-4 bg-slate-100 rounded w-24 mx-auto" /></td>
                          <td className="p-3.5"><div className="h-5 bg-slate-100 rounded w-12" /></td>
                          <td className="p-3.5"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                          <td className="p-3.5 pr-4 text-right"><div className="h-6 bg-slate-100 rounded w-24 ml-auto" /></td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <>
                      {sortedAttempts.map((att: any, idx: number) => {
                        const rankNum = idx + 1;
                        const isTop1 = rankNum === 1;
                        const isTop2 = rankNum === 2;
                        const isTop3 = rankNum === 3;
                        const attendedCount = (att.correctCount ?? 0) + (att.wrongCount ?? 0);
                        const totalQs = att.totalQuestions || q.questions.length || 50;

                        return (
                          <tr key={att.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                            <td className="p-3.5 pl-4">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${isTop1
                                ? "bg-amber-400 text-slate-950 font-black shadow-2xs"
                                : isTop2
                                  ? "bg-slate-200 text-slate-800 font-bold border border-slate-300"
                                  : isTop3
                                    ? "bg-amber-100 text-amber-900 font-bold border border-amber-300"
                                    : "bg-slate-100 text-slate-600 font-medium"
                                }`}>
                                #{rankNum}
                              </span>
                            </td>

                            <td className="p-3.5">
                              <div>
                                <div className="font-bold text-slate-900 text-sm">{att.studentName}</div>
                                {att.studentEmail && (
                                  <div className="text-xs text-slate-500 truncate max-w-xs">{att.studentEmail}</div>
                                )}
                              </div>
                            </td>

                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="font-mono font-bold text-slate-900 text-sm">
                                {att.score.rawMarks}/{att.score.totalMarks} Marks
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                {attendedCount}/{totalQs} Qs Attended
                              </div>
                            </td>

                            <td className="p-3.5 text-center whitespace-nowrap">
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-xs">
                                {att.score.percentage}%
                              </span>
                            </td>

                            <td className="p-3.5 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 text-xs">
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold" title="Correct">
                                  âœ“ {att.correctCount ?? (att.answers?.filter((a: any) => a.isCorrect).length || 0)}
                                </span>
                                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 font-semibold" title="Wrong">
                                  âœ— {att.wrongCount ?? (att.answers?.filter((a: any) => a.isAttempted && !a.isCorrect).length || 0)}
                                </span>
                                <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-medium" title="Not Attempted">
                                  âŠ˜ {att.unattemptedCount ?? (att.answers?.filter((a: any) => !a.isAttempted).length || 0)}
                                </span>
                              </div>
                            </td>

                            <td className="p-3.5 whitespace-nowrap">
                              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${att.score.passed
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                {att.score.passed ? "Pass" : "Fail"}
                              </span>
                            </td>

                            <td className="p-3.5 text-slate-500 text-xs whitespace-nowrap">
                              {att.submittedAt ? fmtDate(att.submittedAt) : "â€”"}
                            </td>

                            <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setInspectStudentAttempt(att)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200 transition-colors shadow-2xs"
                              >
                                <LuEye className="w-3.5 h-3.5 text-slate-500" />
                                <span>View Sheet</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {submitted.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 text-sm">
                            No submissions found for this test yet.
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Answer Sheet Modal for Admin */}
        {inspectStudentAttempt && (
          <AdminStudentAnswerSheetModal
            isOpen={Boolean(inspectStudentAttempt)}
            onClose={() => setInspectStudentAttempt(null)}
            studentName={inspectStudentAttempt.studentName}
            studentEmail={inspectStudentAttempt.studentEmail}
            quizTitle={q.title}
            rank={inspectStudentAttempt.rank}
            score={inspectStudentAttempt.score}
            totalTimeTakenSec={inspectStudentAttempt.totalTimeTakenSec}
            submittedAt={inspectStudentAttempt.submittedAt}
            answers={inspectStudentAttempt.answers || []}
          />
        )}
      </div>
    );
  }

  // Filter quizzes by search query
  const filteredQuizzes = cls.quizzes.filter((q) =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Quiz list
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="flex items-center gap-2 bg-cream/5 rounded-full px-4 py-2.5 flex-1 max-w-md border border-cream/10">
          <LuSearch className="h-4 w-4 text-cream/50" />
          <input
            type="text"
            placeholder="Search tests by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-cream w-full placeholder:text-cream/40"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-cream/50 hover:text-cream">
              <LuX className="h-4 w-4" />
            </button>
          )}
        </div>

        <button onClick={() => {
          setEditingQuizId(null);
          setQuiz({ title: "", instructions: "", duration: null, maxAttempts: 1, randomizeQuestions: true, randomizeOptions: true, showLeaderboard: false, negativeMarking: true, negativeMarkValue: 1, passPercent: 60, availableFrom: "", availableUntil: "", status: "draft", questions: [] });
          setBulkMarksEnabled(false);
          setBulkMarksValue(1);
          setBulkNegEnabled(false);
          setBulkNegValue(1);
          setShowBuilder(true);
        }} className="inline-flex items-center justify-center gap-2 rounded-full bg-lime text-plum-dark px-5 py-2.5 text-sm font-bold shrink-0">
          <LuPlus className="h-4 w-4" /> Create Quiz
        </button>
      </div>

      {isFetching && filteredQuizzes.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-[#1A0F33] border border-cream/10 p-5 space-y-3 animate-pulse">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-5 bg-cream/15 rounded-md w-48" />
                    <div className="h-4 bg-cream/10 rounded w-16" />
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="h-3.5 bg-cream/10 rounded w-24" />
                    <div className="h-3.5 bg-cream/10 rounded w-24" />
                    <div className="h-3.5 bg-cream/10 rounded w-20" />
                    <div className="h-3.5 bg-cream/10 rounded w-28" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-7 w-20 bg-cream/10 rounded-full" />
                  <div className="h-7 w-16 bg-cream/10 rounded-full" />
                  <div className="h-7 w-16 bg-cream/10 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <DarkCard className="text-center py-12">
          <LuClipboardList className="h-8 w-8 text-cream/20 mx-auto mb-2" />
          <p className="text-cream/50 text-sm">
            {searchQuery ? "No tests match your search query." : "No quizzes created yet."}
          </p>
        </DarkCard>
      ) : (
        <div className="space-y-3">
          {filteredQuizzes.map((q) => {
            const subCount = q.attempts.filter((a) => a.status === "submitted").length;
            const isQListLoading = isFetching && (!q.questions || q.questions.length === 0);
            return (
              <DarkCard key={q.id}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-cream">{q.title}</span>
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${q.status === "published" ? "bg-lime/20 text-lime" : q.status === "closed" ? "bg-cream/10 text-cream/60" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {q.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-cream/60 items-center">
                      <span>{q.questions.length} questions</span>
                      <span>{q.questions.reduce((s, x) => s + x.marks, 0)} total marks</span>
                      {q.duration && <span>{q.duration} min timer</span>}
                      <span>{subCount} submissions</span>
                      <span>Pass: {q.passPercent}%</span>
                    </div>
                    {(q.availableFrom || q.availableUntil) && (
                      <div className="text-[11px] text-lime font-medium mt-2 bg-lime/10 rounded-lg px-2.5 py-1 inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 border border-lime/20">
                        <span className="font-bold text-lime">Availability:</span>
                        {q.availableFrom && <span>Starts: {fmtDate(q.availableFrom)}</span>}
                        {q.availableUntil && <span>Ends: {fmtDate(q.availableUntil)}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setViewQuizId(q.id)} className="rounded-full bg-cream/10 text-cream px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors">
                      <LuEye className="h-3 w-3" /> Report
                    </button>
                    <button
                      onClick={() => {
                        setEditingQuizId(q.id);
                        setQuiz({
                          title: q.title,
                          instructions: q.instructions || "",
                          duration: q.duration,
                          maxAttempts: q.maxAttempts || 1,
                          randomizeQuestions: q.randomizeQuestions ?? true,
                          randomizeOptions: q.randomizeOptions ?? true,
                          showLeaderboard: q.showLeaderboard ?? false,
                          negativeMarking: q.negativeMarking ?? false,
                          negativeMarkValue: q.negativeMarkValue ?? 0.25,
                          passPercent: q.passPercent || 60,
                          availableFrom: toDatetimeLocal(q.availableFrom),
                          availableUntil: toDatetimeLocal(q.availableUntil),
                          status: q.status || "draft",
                          questions: (q.questions || []).map((quest) => ({
                            ...quest,
                            options: (quest.options || []).map((o) => ({
                              label: o.label,
                              text: o.text,
                              isCorrect: Boolean(o.isCorrect),
                            })),
                          })),
                        });
                        const hasQuestions = q.questions && q.questions.length > 0;
                        const allSameMarks = hasQuestions && q.questions.every(quest => quest.marks === q.questions[0].marks);
                        if (allSameMarks) {
                          setBulkMarksEnabled(true);
                          setBulkMarksValue(q.questions[0].marks);
                        } else {
                          setBulkMarksEnabled(false);
                          setBulkMarksValue(1);
                        }
                        setBulkNegEnabled(q.negativeMarking ?? false);
                        setBulkNegValue(q.negativeMarkValue ?? 0);
                        setShowBuilder(true);
                      }}
                      className="rounded-full bg-cream/10 text-cream px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setDuplicateQuiz(q);
                        setSelectedTargetClassrooms([]);
                      }}
                      className="rounded-full bg-cream/10 text-cream px-3 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                      title="Reuse/Duplicate to another class"
                    >
                      <LuCopy className="h-3 w-3" /> Reuse
                    </button>
                    <button
                      onClick={() => handleDownloadQuiz(q, 'print')}
                      className="rounded-full bg-cream/10 text-cream px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                      title="Download Quiz as PDF"
                    >
                      <LuDownload className="h-3.5 w-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => handleDownloadQuiz(q, 'doc')}
                      className="rounded-full bg-cream/10 text-cream px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 hover:bg-cream/20 transition-colors"
                      title="Download Quiz as Word Doc"
                    >
                      <LuDownload className="h-3.5 w-3.5" /> DOC
                    </button>
                    {q.status === "draft" && (
                      <button onClick={() => handlePublishQuiz(q.id)}
                        disabled={quizOperationQuizId === q.id}
                        className="rounded-full bg-lime/10 text-lime px-3 py-1.5 text-xs font-semibold hover:bg-lime/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                        {quizOperationQuizId === q.id ? 'Publishing...' : 'Publish'}
                      </button>
                    )}
                    {q.status === "published" && (
                      <button onClick={() => handleCloseQuiz(q.id)}
                        disabled={quizOperationQuizId === q.id}
                        className="rounded-full bg-cream/10 text-cream/70 px-3 py-1.5 text-xs font-semibold hover:bg-cream/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                        {quizOperationQuizId === q.id ? 'Closing...' : 'Close'}
                      </button>
                    )}
                    <button onClick={() => handleDeleteQuiz(q.id)}
                      disabled={quizOperationQuizId === q.id}
                      className="rounded-full bg-cream/5 text-cream/40 hover:text-red-400 p-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
                      <LuTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </DarkCard>
            );
          })}
        </div>
      )}

      {/* Quiz Reuse / Duplication Modal */}
      {duplicateQuiz && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A0F33] border border-cream/10 rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-cream/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-cream">Reuse Quiz in other Classes</h3>
              <button
                onClick={() => setDuplicateQuiz(null)}
                className="text-cream/50 hover:text-cream p-1 rounded-full hover:bg-cream/5"
              >
                <LuX className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="text-sm text-cream/70 mb-2">
                Duplicate <strong className="text-lime">{duplicateQuiz.title}</strong> to the following classroom(s):
              </div>
              <div className="space-y-2">
                {classrooms
                  .filter((c) => c.id !== classroomId && c.status === "active")
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
                {classrooms.filter((c) => c.id !== classroomId && c.status === "active").length === 0 && (
                  <p className="text-xs text-cream/40 text-center py-4">No other active classes available.</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-black/20 border-t border-cream/10 flex gap-3">
              <button
                type="button"
                onClick={() => setDuplicateQuiz(null)}
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
    </div>
  );
}

// â”€â”€â”€ Students Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


export { TestsTab };
