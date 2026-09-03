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
  LuScan,
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
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const [swipeNotice, setSwipeNotice] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);

  // Touch tracking for swipe & pinch-to-zoom
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1.0);

  // Keyboard shortcut blocker (Ctrl+S, Ctrl+P, Cmd+S, Cmd+P, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        handlePrevPage();
        return;
      }
      if (e.key === 'ArrowRight') {
        handleNextPage();
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
  }, [isOpen, onClose, numPages]);

  // Load PDF.js script dynamically from CDN
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

  // Compute optimal fit-width scale based on screen/container
  const computeFitScale = useCallback((page: any): number => {
    const isMobile = window.innerWidth < 640;
    const containerWidth = contentAreaRef.current?.clientWidth || window.innerWidth;
    const padding = isMobile ? 24 : 48;
    const availableWidth = Math.max(260, containerWidth - padding);

    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const targetScale = availableWidth / unscaledViewport.width;

    // Mobile: clamp between 0.45 and 1.25 for crisp reading without horizontal overflow
    if (isMobile) {
      return Math.min(Math.max(targetScale, 0.45), 1.25);
    }
    // Desktop: clamp between 0.8 and 1.6
    return Math.min(Math.max(targetScale, 0.8), 1.6);
  }, []);

  // Render a specific page to the canvas
  const renderPage = useCallback(
    async (pageNum: number, pdf: any, customScale?: number) => {
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

        const effectiveScale = customScale || scale;
        const viewport = page.getViewport({ scale: effectiveScale });
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

        let pdf: any;
        try {
          // Fetch raw PDF bytes directly to bypass worker origin blocks
          const response = await fetch(url, { credentials: 'include' });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch document`);
          }
          const arrayBuffer = await response.arrayBuffer();
          if (isCancelled) return;

          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          pdf = await loadingTask.promise;
        } catch (fetchErr: any) {
          console.warn('[PDF Viewer] Direct fetch fallback to URL loading:', fetchErr?.message);
          const loadingTask = pdfjs.getDocument({ url });
          pdf = await loadingTask.promise;
        }

        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);

        // Calculate initial auto-fit scale
        const firstPage = await pdf.getPage(1);
        const fitScale = computeFitScale(firstPage);
        setScale(fitScale);

        setLoading(false);
        await renderPage(1, pdf, fitScale);

        // Show a brief swipe tip on mobile if multi-page
        if (window.innerWidth < 640 && pdf.numPages > 1) {
          setSwipeNotice(true);
          setTimeout(() => setSwipeNotice(false), 3000);
        }
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
  }, [isOpen, url, loadPdfJs, computeFitScale]);

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdfDocRef.current && !loading && !useIframeFallback) {
      renderPage(currentPage, pdfDocRef.current);
    }
  }, [currentPage, scale, loading, useIframeFallback, renderPage]);

  // Handle window resize / orientation change: re-fit width
  useEffect(() => {
    if (!isOpen) return;

    let resizeTimer: any;
    const handleResize = async () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        if (pdfDocRef.current) {
          try {
            const page = await pdfDocRef.current.getPage(currentPage);
            const newFit = computeFitScale(page);
            setScale(newFit);
          } catch (e) {
            // ignore
          }
        }
      }, 200);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, currentPage, computeFitScale]);

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
    setScale((s) => Math.min(2.5, Number((s + 0.15).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.45, Number((s - 0.15).toFixed(2))));
  };

  const handleFitWidth = async () => {
    if (pdfDocRef.current) {
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        const fitScale = computeFitScale(page);
        setScale(fitScale);
      } catch {
        setScale(1.0);
      }
    } else {
      setScale(1.0);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Touch handlers for mobile swipe & pinch
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    } else if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartScaleRef.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistanceRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ratio = dist / pinchStartDistanceRef.current;
      const newScale = Math.min(2.5, Math.max(0.45, pinchStartScaleRef.current * ratio));
      setScale(Number(newScale.toFixed(2)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartDistanceRef.current && e.touches.length < 2) {
      pinchStartDistanceRef.current = null;
      return;
    }

    if (!touchStartRef.current || e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Significant horizontal swipe detection (faster than 600ms, > 40px, more horizontal than vertical)
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2 && deltaTime < 600) {
      if (deltaX < 0) {
        // Swiped Left -> Next page
        handleNextPage();
      } else {
        // Swiped Right -> Previous page
        handlePrevPage();
      }
    }

    touchStartRef.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={containerRef}
        className={`w-full bg-slate-950 border border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
          isFullscreen ? 'h-full max-w-full rounded-none border-none' : 'max-w-5xl h-full sm:h-[92vh] sm:rounded-2xl'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-900/95 border-b border-slate-800 text-white shrink-0">
          {/* Left: Document Info */}
          <div className="flex items-center gap-2 min-w-0 max-w-[180px] sm:max-w-xs md:max-w-md">
            <div className="grid h-7 w-7 sm:h-8 sm:w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <LuFileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="truncate">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                {title || 'Document Preview'}
              </h3>
              <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Protected • Read Only</span>
              </div>
            </div>
          </div>

          {/* Center / Right: Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Desktop Page Navigation */}
            {!useIframeFallback && numPages > 1 && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-xl px-2 py-1 text-xs">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
                  title="Previous Page (or swipe right)"
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
                  title="Next Page (or swipe left)"
                >
                  <LuChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            {!useIframeFallback && (
              <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/80 border border-slate-700/60 rounded-xl px-1.5 sm:px-2 py-1 text-xs">
                <button
                  onClick={handleZoomOut}
                  className="p-1 rounded hover:bg-slate-700 transition-colors"
                  title="Zoom Out"
                >
                  <LuZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1 text-[10px] sm:text-[11px] font-medium text-slate-300 min-w-[2.4rem] sm:min-w-[2.8rem] text-center">
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
                  onClick={handleFitWidth}
                  className="p-1 rounded hover:bg-slate-700 transition-colors ml-0.5 text-slate-400 hover:text-white"
                  title="Fit to Screen Width"
                >
                  <LuScan className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <LuMinimize2 className="h-3.5 w-3.5" /> : <LuMaximize2 className="h-3.5 w-3.5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors ml-0.5"
              title="Close Preview"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Area with Touch Handlers */}
        <div
          ref={contentAreaRef}
          className="relative flex-1 overflow-auto bg-slate-950 p-2 sm:p-4 flex flex-col items-center justify-start sm:justify-center touch-pan-y"
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-400 my-auto">
              <LuLoader className="h-8 w-8 animate-spin text-blue-400" />
              <p className="text-xs font-medium tracking-wide">Loading protected preview…</p>
            </div>
          )}

          {error && (
            <div className="text-center p-6 max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl my-auto">
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
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800 my-auto bg-white pointer-events-auto max-w-full flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="block select-none max-w-full h-auto object-contain"
                onContextMenu={(e) => e.preventDefault()}
              />
              {/* Subtle Protected Overlay Watermark */}
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.035] select-none text-slate-900 font-extrabold text-3xl sm:text-6xl uppercase rotate-[-25deg]"
                style={{ letterSpacing: '0.25em' }}
              >
                Axon Academy
              </div>
            </div>
          )}

          {/* Iframe Fallback */}
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

          {/* Swipe Tip Toast on Mobile */}
          {swipeNotice && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-[11px] font-medium px-3.5 py-1.5 rounded-full shadow-lg pointer-events-none animate-bounce flex items-center gap-1.5 z-10">
              <span>👉 Swipe left or right to flip pages</span>
            </div>
          )}
        </div>

        {/* Mobile Bottom Floating Navigation Bar */}
        {!useIframeFallback && numPages > 1 && (
          <div className="flex sm:hidden items-center justify-between px-4 py-2.5 bg-slate-900/95 border-t border-slate-800 text-white shrink-0">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 disabled:opacity-30 disabled:pointer-events-none active:bg-slate-700 transition-colors"
            >
              <LuChevronLeft className="h-4 w-4" /> Prev
            </button>

            <span className="text-xs font-bold text-slate-300">
              Page {currentPage} of {numPages}
            </span>

            <button
              onClick={handleNextPage}
              disabled={currentPage >= numPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 disabled:opacity-30 disabled:pointer-events-none active:bg-slate-700 transition-colors"
            >
              Next <LuChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
