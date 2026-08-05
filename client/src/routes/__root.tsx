import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { App } from "@capacitor/app";
import { getCurrentUser, getClassrooms } from "@/lib/api";
import { classroomStore, type User } from "@/lib/classroomStore";
import { initFCM } from "@/lib/fcm";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-plum-dark">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full bg-plum-dark px-5 py-2.5 text-sm font-semibold text-cream hover:bg-plum"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try again or head back home.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-plum-dark px-5 py-2.5 text-sm font-semibold text-cream"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Axon Med Academy — Dream. Prepare. Achieve." },
      { name: "description", content: "India's #1 paramedical training academy. Live classes, proctored exams, blockchain certificates, 95% placement rate across 200+ partner hospitals." },
      { property: "og:title", content: "Axon Med Academy" },
      { property: "og:description", content: "Dream. Prepare. Achieve." },
      { property: "og:image", content: "/logo.jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:type", content: "website" },
      { name: "google-site-verification", content: "c1RnvmOxsCqv3w95ekdPijnT2elFME4TrVqiAdPcuhU" },
    ],
    links: [
      { rel: "icon", type: "image/jpeg", href: "/logo.jpeg" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [authReady, setAuthReady] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const router = useRouter();

  // Handle Capacitor custom scheme deep linking
  useEffect(() => {
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;
    if (!isCapacitor) return;

    let active = true;

    const setupDeepLinkListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const handler = (event: any) => {
          if (!active) return;
          console.log('[Capacitor] App opened with URL:', event.url);
          
          // Match URL format: edumeetlive://meeting/ROOM_ID?token=TOKEN
          const match = event.url.match(/edumeetlive:\/\/meeting\/([^\/?#]+)/);
          if (match) {
            const roomId = match[1];
            console.log('[Capacitor] Routing to live class room:', roomId);
            router.navigate({ to: '/live/$roomId', params: { roomId } });
          }
        };

        // Add the listener
        const listener = await App.addListener('appUrlOpen', handler);

        // Check if app was launched with a URL directly (cold start)
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl && launchUrl.url) {
          handler(launchUrl);
        }

        return () => {
          active = false;
          listener.remove();
        };
      } catch (err) {
        console.warn('[Capacitor] Deep link setup failed:', err);
      }
    };

    const cleanupPromise = setupDeepLinkListener();
    return () => {
      active = false;
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [router]);

  useEffect(() => {
    // On every page load, verify the stored token is still valid with the server.
    // Also fetch live classrooms.
    Promise.all([
      getCurrentUser().catch(() => null),
      getClassrooms().catch(() => []) // if not logged in, this might fail, default to empty
    ])
      .then(([payload, classrooms]) => {
        if (!payload || !payload.user) {
          classroomStore.setState(() => ({ currentUser: null, accessToken: null }));
          return;
        }
        const backendUser = payload.user;
        const accessToken = payload.accessToken || null;
        const role = backendUser.role === "student" ? "student" : backendUser.role;
        const currentUser: User = {
          id: backendUser._id,
          name: backendUser.fullName || backendUser.email,
          email: backendUser.email,
          phone: backendUser.phone,
          address: backendUser.address,
          avatar: backendUser.avatar,
          role,
          userId: backendUser.userId
        };
        
        classroomStore.setState(() => ({ currentUser, accessToken, classrooms }));

        // ── FCM: register push token for students after auth is confirmed ──
        if (role === 'student') {
          if ('Notification' in window && Notification.permission === 'default') {
            const hasDismissed = sessionStorage.getItem('fcm_prompt_dismissed');
            if (!hasDismissed) {
              setShowPermissionPrompt(true);
            }
          } else if ('Notification' in window && Notification.permission === 'granted') {
            initFCM().catch((err) =>
              console.warn('[FCM] Background init failed:', err)
            );
          }
        }
      })
      .catch(() => {
        // Token invalid or expired — clear stored session
        classroomStore.setState(() => ({ currentUser: null, accessToken: null }));
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, []);

  // ── Foreground push: show a browser notification toast when app is active ──
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      const { title, body, data } = event.detail || {};
      const roomId = data?.roomId;
      if (!title) return;

      // If the browser Notification API is available and permitted, show it
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(title, {
          body: body ?? '',
          icon: '/favicon.ico',
          tag: `live-class-${data?.meetingId || Date.now()}`,
          requireInteraction: true,
        });
        notif.onclick = () => {
          const url = data?.click_action || (roomId ? `/live/${roomId}` : '/');
          window.focus();
          window.open(url, '_blank');
        };
      }
    };

    window.addEventListener('fcm:foreground-message', handler as EventListener);
    return () => window.removeEventListener('fcm:foreground-message', handler as EventListener);
  }, []);

  if (!authReady) {
    // Show a minimal loading screen while we verify auth
    return (
      <QueryClientProvider client={queryClient}>
        <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#faf9f7' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4c1d95', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
      {showPermissionPrompt && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden transform animate-in zoom-in-95 duration-200">
            {/* Visual Indicator/Icon */}
            <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell animate-bounce"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </div>
            
            <h3 className="font-display font-bold text-plum-dark dark:text-zinc-100 text-xl">Enable Notifications</h3>
            <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mt-1">Allow for live class updates</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
              Stay in the loop! Get instant alerts on your device the moment a live class is scheduled or started by your instructors.
            </p>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  sessionStorage.setItem('fcm_prompt_dismissed', 'true');
                  setShowPermissionPrompt(false);
                }}
                className="rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400"
              >
                Not Now
              </button>
              <button
                onClick={async () => {
                  setShowPermissionPrompt(false);
                  sessionStorage.setItem('fcm_prompt_dismissed', 'true');
                  await initFCM().catch((err) =>
                    console.warn('[FCM] Manual init failed:', err)
                  );
                }}
                className="rounded-full bg-plum-dark text-cream hover:bg-plum px-6 py-2.5 text-sm font-bold shadow-lg shadow-plum/20 transition-all hover:scale-105 active:scale-95"
              >
                Enable updates
              </button>
            </div>
          </div>
        </div>
      )}
    </QueryClientProvider>
  );
}
