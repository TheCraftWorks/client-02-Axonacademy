import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  LuX,
  LuChevronLeft,
  LuChevronRight,
  LuZoomIn,
  LuZoomOut,
  LuRotateCcw,
  LuFileText,
  LuShieldAlert,
  LuLoader,
  LuMaximize2,
  LuMinimize2,
} from 'react-icons/lu';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

export function PdfViewerModal({ isOpen, onClose, url, title }: PdfViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keyboard shortcut blocker (Ctrl+S, Ctrl+P, Cmd+S, Cmd+P, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'p' || e.key.toLowerCase() === 'u')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  // Load PDF.js script dynamically
  const loadPdfJs = useCallback(async (): Promise<any> => {
    if (window.pdfjsLib) {
      return window.pdfjsLib;
    }

    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById('pdfjs-cdn-script');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.pdfjsLib));
        existingScript.addEventListener('error', () => reject(new Error('Failed to load PDF engine')));
        return;
      }

      const script = document.createElement('script');
      script.id = 'pdfjs-cdn-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF engine not initialized'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF engine from CDN'));
      document.body.appendChild(script);
    });
  }, []);

  // Render a specific page to the canvas
  const renderPage = useCallback(
    async (pageNum: number, pdf: any) => {
      if (!pdf || !canvasRef.current) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdf.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform || undefined,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[PDF Render Page Error]:', err);
        }
      }
    },
    [scale]
  );

  // Load the PDF document
  useEffect(() => {
    if (!isOpen || !url) return;

    let isCancelled = false;
    setLoading(true);
    setError(null);
    setCurrentPage(1);
    setUseIframeFallback(false);

    async function loadDocument() {
      try {
        const pdfjs = await loadPdfJs();
        if (isCancelled) return;

        const loadingTask = pdfjs.getDocument({
          url: url,
          withCredentials: true,
        });

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);
        await renderPage(1, pdf);
      } catch (err: any) {
        console.warn('[PDF Viewer] Canvas render failed, falling back to secure frame:', err?.message);
        if (!isCancelled) {
          setLoading(false);
          setUseIframeFallback(true);
        }
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [isOpen, url, loadPdfJs, renderPage]);

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdfDocRef.current && !loading && !useIframeFallback) {
      renderPage(currentPage, pdfDocRef.current);
    }
  }, [currentPage, scale, loading, useIframeFallback, renderPage]);

  if (!isOpen) return null;

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage((p) => p + 1);
    }
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(2.5, s + 0.15));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.65, s - 0.15));
  };

  const handleResetZoom = () => {
    setScale(1.15);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={containerRef}
        className={`w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'h-full max-w-full rounded-none border-none' : 'max-w-5xl h-[92vh]'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-white shrink-0">
          {/* Left: Document Info */}
          <div className="flex items-center gap-2.5 min-w-0 max-w-[280px] sm:max-w-xs md:max-w-md">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <LuFileText className="h-4 w-4" />
            </div>
            <div className="truncate">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                {title || 'Document Preview'}
              </h3>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Protected View • Read Only</span>
              </div>
            </div>
          </div>

          {/* Center: Controls (Pagination & Zoom) */}
          <div className="flex items-center gap-1 sm:gap-2">
            {!useIframeFallback && numPages > 1 && (
              <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2 py-1 text-xs">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  title="Previous Page"
                >
                  <LuChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-1 text-[11px] font-medium text-slate-300">
                  {currentPage} / {numPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= numPages}
                  className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  title="Next Page"
                >
                  <LuChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {!useIframeFallback && (
              <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2 py-1 text-xs">
                <button
                  onClick={handleZoomOut}
                  className="p-1 rounded hover:bg-slate-700 transition-colors"
                  title="Zoom Out"
                >
                  <LuZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1 text-[11px] font-medium text-slate-300 min-w-[3rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1 rounded hover:bg-slate-700 transition-colors"
                  title="Zoom In"
                >
                  <LuZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-1 rounded hover:bg-slate-700 transition-colors ml-0.5 text-slate-400 hover:text-white"
                  title="Reset Zoom"
                >
                  <LuRotateCcw className="h-3 w-3" />
                </button>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <LuMinimize2 className="h-3.5 w-3.5" /> : <LuMaximize2 className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors ml-1"
              title="Close Preview"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div
          className="relative flex-1 overflow-auto bg-slate-950 p-4 flex items-center justify-center"
          onContextMenu={(e) => e.preventDefault()}
        >
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <LuLoader className="h-8 w-8 animate-spin text-blue-400" />
              <p className="text-xs font-medium tracking-wide">Loading protected preview…</p>
            </div>
          )}

          {error && (
            <div className="text-center p-6 max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl">
              <LuShieldAlert className="h-8 w-8 text-amber-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-200 mb-1">Preview Unavailable</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Canvas Rendering Engine */}
          {!loading && !error && !useIframeFallback && (
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800 my-auto bg-white pointer-events-auto">
              <canvas ref={canvasRef} className="block select-none" onContextMenu={(e) => e.preventDefault()} />
              {/* Subtle Protected Overlay Watermark */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.035] select-none text-slate-900 font-extrabold text-4xl sm:text-6xl uppercase rotate-[-25deg]"
                style={{ letterSpacing: '0.25em' }}
              >
                Axon Academy
              </div>
            </div>
          )}

          {/* Iframe Fallback with toolbar disabled */}
          {!loading && !error && useIframeFallback && (
            <div className="w-full h-full relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
              <iframe
                src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                title="Document Preview"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
