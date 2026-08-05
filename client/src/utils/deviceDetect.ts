export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
  const isMobileUA = /android|iphone|ipad|ipod|iemobile|opera mini/i.test(ua.toLowerCase());
  // Handle modern iPadOS where userAgent identifies as Macintosh but supports touch points
  const isMacIPad = navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent);
  return !!(isMobileUA || isMacIPad);
}
