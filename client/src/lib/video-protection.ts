import { useEffect, useRef, useState } from "react";

/** True when the device is likely a touch-only mobile device */
const isMobile = () =>
  typeof window !== "undefined" &&
  (navigator.maxTouchPoints > 1 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

/**
 * Hook to apply various deterrence measures against screen recording and screenshots.
 * Note: Full prevention is impossible in a browser without DRM, but these measures
 * make it significantly more difficult for casual users.
 */
export function useVideoProtection(isActive: boolean) {
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState<"blur" | "shortcut" | null>(null);

  const resetLock = () => {
    setIsLocked(false);
    setLockReason(null);
  };

  // Track whether the grace period after mount has elapsed.
  // On mobile, blur/visibility events fire during page load, scroll, and
  // keyboard-show animations — we ignore them for the first 2 seconds.
  const readyRef = useRef(false);

  useEffect(() => {
    if (!isActive) return;

    const mobile = isMobile();

    // Grace period: don't react to focus-loss events right after mounting
    const gracePeriod = setTimeout(() => {
      readyRef.current = true;
    }, mobile ? 2000 : 300);

    // 1. Block Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 2. Block Keyboard Shortcuts & Trigger Lock
    const handleKeyDown = (e: KeyboardEvent) => {
      let shouldLock = false;

      // Print Screen, F12, or explicit screen-capture shortcuts
      if (
        e.key === "PrintScreen" ||
        e.key === "Print" ||
        e.key === "F12" ||
        (e.shiftKey && (e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S" || e.key === "3" || e.key === "4"))
      ) {
        shouldLock = true;
      }

      if (shouldLock) {
        e.preventDefault();
        e.stopPropagation();
        setIsLocked(true);
        setLockReason("shortcut");
        return false;
      }
    };

    // Keyup fallback for PrintScreen
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.key === "Print") {
        setIsLocked(true);
        setLockReason("shortcut");
      }
    };

    // 3. Tab Visibility — lock when tab is hidden.
    const handleVisibilityChange = () => {
      if (!readyRef.current) return;
      if (document.hidden) {
        setIsLocked(true);
        setLockReason("blur");
      }
    };

    // 4. Detect DevTools Opening (Desktop only)
    let intervalCheck: ReturnType<typeof setInterval> | null = null;
    if (!mobile) {
      intervalCheck = setInterval(() => {
        const threshold = 260;
        const isDevToolsOpen =
          window.outerWidth - window.innerWidth > threshold ||
          window.outerHeight - window.innerHeight > threshold;

        if (isDevToolsOpen && readyRef.current) {
          setIsLocked(true);
          setLockReason("shortcut");
        }
      }, 2000);
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(gracePeriod);
      if (intervalCheck) clearInterval(intervalCheck);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive]);

  return { isLocked, lockReason, resetLock };
}

/**
 * Hook to manage a floating watermark position
 */
export function useFloatingWatermark(isActive: boolean) {
  const [position, setPosition] = useState({ top: 10, left: 10 });

  useEffect(() => {
    if (!isActive) return;

    const moveWatermark = () => {
      const top = Math.floor(Math.random() * 80) + 10; // 10% to 90%
      const left = Math.floor(Math.random() * 80) + 10; // 10% to 90%
      setPosition({ top, left });
    };

    const interval = setInterval(moveWatermark, 6000); // Move every 6 seconds for tighter security
    moveWatermark();

    return () => clearInterval(interval);
  }, [isActive]);

  return position;
}
