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
  const [isDragging, setIsDragging] = useState(false);
  const [renderedDimensions, setRenderedDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentAreaRef = useRef<HTMLDivElement | null>(null);
  const fitScaleRef = useRef<number>(1.0);

  // Mouse pan tracking for desktop
  const isMouseDownRef = useRef(false);
  const mouseStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number }>({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // Touch tracking for mobile swipe & pinch
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1.0);

  const isZoomed = scale > fitScaleRef.current * 1.08;

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
          try {
            // Circumvent cross-origin Worker restriction on mobile by creating an inline Blob
            const workerBlob = new Blob(
              ['importScripts("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js");'],
              { type: 'application/javascript' }
            );
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
          } catch {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          }
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
    const padding = isMobile ? 24 : 64;
    const availableWidth = Math.max(260, containerWidth - padding);

    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const targetScale = availableWidth / unscaledViewport.width;

    // Mobile: clamp between 0.45 and 1.25 for crisp reading without horizontal overflow
    let computed: number;
    if (isMobile) {
      computed = Math.min(Math.max(targetScale, 0.45), 1.25);
    } else {
      computed = Math.min(Math.max(targetScale, 0.75), 1.5);
    }
    const rounded = Number(computed.toFixed(2));
    fitScaleRef.current = rounded;
    return rounded;
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

        const effectiveScale = customScale !== undefined ? customScale : scale;
        const viewport = page.getViewport({ scale: effectiveScale });
        const outputScale = window.devicePixelRatio || 1;

        // Internal pixel resolution (high DPI for retina screens)
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);

        // CSS display size (unconstrained so zoomed document actually expands!)
        const displayWidth = Math.floor(viewport.width);
        const displayHeight = Math.floor(viewport.height);
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        setRenderedDimensions({ width: displayWidth, height: displayHeight });

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
          // Fetch raw PDF bytes directly. Fall back gracefully if credentials mode is blocked.
          let response: Response;
          try {
            response = await fetch(url);
          } catch {
            response = await fetch(url, { credentials: 'include' });
          }
          if (!response.ok) {
            let errorMsg = `HTTP ${response.status}: Failed to fetch document`;
            try {
              const errJson = await response.json();
              if (errJson?.message) errorMsg = errJson.message;
            } catch {
              // Not JSON
            }
            throw new Error(errorMsg);
          }
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || 'Server returned invalid file format');
          }
          const arrayBuffer = await response.arrayBuffer();
          if (isCancelled) return;

          const loadingTask = pdfjs.getDocument({
            data: arrayBuffer,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
          });
          pdf = await loadingTask.promise;
        } catch (fetchErr: any) {
          console.warn('[PDF Viewer] Direct fetch fallback to URL loading:', fetchErr?.message);
          if (fetchErr?.message?.includes('HTTP') || fetchErr?.message?.includes('Server returned')) {
            throw fetchErr;
          }
          const loadingTask = pdfjs.getDocument({
            url,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
          });
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
        console.warn('[PDF Viewer] Error loading PDF:', err?.message);
        if (!isCancelled) {
          setLoading(false);
          if (err?.message?.includes('HTTP') || err?.message?.includes('Server returned') || err?.message?.includes('Failed to fetch')) {
            setError(err.message || 'Document preview is currently unavailable.');
          } else {
            setUseIframeFallback(true);
          }
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

  // Handle window resize / orientation change: re-fit width if not manually zoomed
  useEffect(() => {
    if (!isOpen) return;

    let resizeTimer: any;
    const handleResize = async () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        if (pdfDocRef.current && !isZoomed) {
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
  }, [isOpen, currentPage, computeFitScale, isZoomed]);

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
    setScale((s) => Math.min(3.5, Number((s + 0.25).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.4, Number((s - 0.25).toFixed(2))));
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

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Mouse pan handlers for desktop when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isZoomed || !contentAreaRef.current) return;
    isMouseDownRef.current = true;
    setIsDragging(true);
    mouseStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: contentAreaRef.current.scrollLeft,
      scrollTop: contentAreaRef.current.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !contentAreaRef.current) return;
    const dx = e.clientX - mouseStartRef.current.x;
    const dy = e.clientY - mouseStartRef.current.y;
    contentAreaRef.current.scrollLeft = mouseStartRef.current.scrollLeft - dx;
    contentAreaRef.current.scrollTop = mouseStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    setIsDragging(false);
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
      const newScale = Math.min(3.5, Math.max(0.4, pinchStartScaleRef.current * ratio));
      setScale(Number(newScale.toFixed(2)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartDistanceRef.current && e.touches.length < 2) {
      pinchStartDistanceRef.current = null;
      return;
    }

    // If the user is zoomed in, horizontal dragging is for panning the document, NOT flipping pages!
    if (isZoomed) {
      touchStartRef.current = null;
      return;
    }

    if (!touchStartRef.current || e.changedTouches.length !== 1) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Significant horizontal swipe detection (faster than 500ms, > 45px, more horizontal than vertical)
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && deltaTime < 500) {
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
          <div className="flex items-center gap-2 min-w-0 max-w-[170px] sm:max-w-xs md:max-w-md">
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

            {/* Zoom Controls */}
            {!useIframeFallback && (
              <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-800/80 border border-slate-700/60 rounded-xl px-1.5 sm:px-2 py-1 text-xs">
                <button
                  onClick={handleZoomOut}
                  className="p-1 rounded hover:bg-slate-700 transition-colors"
                  title="Zoom Out (-25%)"
                >
                  <LuZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1 text-[10px] sm:text-[11px] font-medium text-slate-300 min-w-[2.5rem] sm:min-w-[2.9rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1 rounded hover:bg-slate-700 transition-colors"
                  title="Zoom In (+25%)"
                >
                  <LuZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleFitWidth}
                  className="p-1 rounded hover:bg-slate-700 transition-colors ml-0.5 text-slate-400 hover:text-white"
                  title="Fit to Width"
                >
                  <LuScan className="h-3 w-3" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white hidden sm:inline-flex"
                  title="100% Actual Size"
                >
                  <LuRotateCcw className="h-3 w-3" />
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

        {/* Content Area with Full Two-Way Scroll & Drag Pan */}
        <div
          ref={contentAreaRef}
          className={`relative flex-1 overflow-x-auto overflow-y-auto bg-slate-950 p-2 sm:p-6 flex flex-col ${
            isZoomed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: isZoomed ? 'pan-x pan-y pinch-zoom' : 'pan-y pinch-zoom',
          }}
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-400 m-auto">
              <LuLoader className="h-8 w-8 animate-spin text-blue-400" />
              <p className="text-xs font-medium tracking-wide">Loading protected preview…</p>
            </div>
          )}

          {error && (
            <div className="text-center p-6 max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl m-auto">
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

          {/* Canvas Rendering Engine (Unconstrained sizing so zoomed content expands & scrolls!) */}
          {!loading && !error && !useIframeFallback && (
            <div
              className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-white m-auto shrink-0 transition-[width,height] duration-100"
              style={{
                width: renderedDimensions.width > 0 ? `${renderedDimensions.width}px` : 'auto',
                height: renderedDimensions.height > 0 ? `${renderedDimensions.height}px` : 'auto',
              }}
            >
              <canvas
                ref={canvasRef}
                className="block select-none pointer-events-auto"
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
            <div className="w-full h-full relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 m-auto flex flex-col">
              <iframe
                src={
                  typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
                    : `${url}#toolbar=0&navpanes=0&scrollbar=1`
                }
                className="w-full flex-1 border-0"
                title="Document Preview"
                onContextMenu={(e) => e.preventDefault()}
              />
            </div>
          )}

          {/* Swipe Tip Toast on Mobile */}
          {swipeNotice && !isZoomed && (
            <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-[11px] font-medium px-3.5 py-1.5 rounded-full shadow-lg pointer-events-none animate-bounce flex items-center gap-1.5 z-20">
              <span>👉 Swipe left or right to flip pages</span>
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation Bar */}
        {!useIframeFallback && numPages > 1 && (
          <div className="flex sm:hidden items-center justify-between px-4 py-2 bg-slate-900/95 border-t border-slate-800 text-white shrink-0">
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
