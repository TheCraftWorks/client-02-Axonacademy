/**
 * FCM (Firebase Cloud Messaging) client helper.
 *
 * Usage:
 *   import { initFCM, teardownFCM } from '@/lib/fcm';
 *
 *   // Call after a user logs in / session is confirmed:
 *   initFCM();
 *
 *   // Call on logout / when user denies permission:
 *   teardownFCM();
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, deleteToken, type Messaging } from 'firebase/messaging';
import { saveFcmToken, removeFcmToken } from '@/lib/api';

// ── Firebase Web Config ───────────────────────────────────────────────────────
// These are PUBLIC keys — safe to ship to the browser.
// Set them in client/.env.development (or .env.production).
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || '',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || '',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '',
};

// Public VAPID key from Firebase Console → Project settings → Cloud Messaging → Web push certificates
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

let _app: FirebaseApp | null = null;
let _messaging: Messaging | null = null;
let _currentToken: string | null = null;

function isConfigured(): boolean {
  return !!(firebaseConfig.projectId && firebaseConfig.apiKey && firebaseConfig.appId);
}

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  const existing = getApps().find((a) => a.name === '[DEFAULT]');
  _app = existing ?? initializeApp(firebaseConfig);
  return _app;
}

function getFirebaseMessaging(): Messaging | null {
  if (!('serviceWorker' in navigator)) return null;
  if (_messaging) return _messaging;
  try {
    _messaging = getMessaging(getFirebaseApp());
    return _messaging;
  } catch (err) {
    console.warn('[FCM] Could not get messaging instance:', err);
    return null;
  }
}

/**
 * Register the service worker, pass the Firebase config to it, obtain the
 * device's FCM token, and send it to the backend.
 *
 * Safe to call multiple times — idempotent.
 */
export async function initFCM(): Promise<void> {
  if (!isConfigured()) {
    console.warn('[FCM] Firebase not configured — push notifications disabled. Set VITE_FIREBASE_* env vars.');
    return;
  }

  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('[FCM] Service workers or Notifications not supported in this browser.');
    return;
  }

  try {
    // 1. Register (or get the existing) service worker with configuration query parameters
    const params = new URLSearchParams({
      apiKey: firebaseConfig.apiKey || '',
      authDomain: firebaseConfig.authDomain || '',
      projectId: firebaseConfig.projectId || '',
      storageBucket: firebaseConfig.storageBucket || '',
      messagingSenderId: firebaseConfig.messagingSenderId || '',
      appId: firebaseConfig.appId || '',
    });
    const swReg = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
    await navigator.serviceWorker.ready;

    // 2. Also keep postMessage as a backup trigger for already-running workers
    const sw = swReg.active || swReg.waiting || swReg.installing;
    if (sw) {
      sw.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
    }

    // 3. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission not granted — skipping token registration.');
      return;
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    // 4. Get the device FCM token
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) {
      console.warn('[FCM] No registration token available. Check VAPID key configuration.');
      return;
    }

    // 5. Persist token in DB (backend deduplicates automatically)
    if (token !== _currentToken) {
      await saveFcmToken(token);
      _currentToken = token;
      console.info('[FCM] Token registered:', token.slice(0, 20) + '…');
    }

    // 6. Handle foreground messages (app is open) — show a custom toast instead of native notification
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      const data = payload.data || {};

      // Dispatch a custom DOM event so any React component can listen
      window.dispatchEvent(
        new CustomEvent('fcm:foreground-message', {
          detail: { title, body, data },
        })
      );

      // Also trigger a browser notification if the page is visible
      if (document.visibilityState !== 'visible' && Notification.permission === 'granted') {
        new Notification(title ?? 'Live Class Started', {
          body: body ?? 'Tap to join',
          icon: '/favicon.ico',
          tag: `live-class-${data.meetingId || Date.now()}`,
        });
      }
    });
  } catch (err) {
    console.error('[FCM] Initialization error:', err);
  }
}

/**
 * Remove the current device's FCM token from the backend and Firebase.
 * Call on logout or when the user revokes notification permission.
 */
export async function teardownFCM(): Promise<void> {
  if (!_currentToken) return;
  try {
    await removeFcmToken(_currentToken);
    const messaging = getFirebaseMessaging();
    if (messaging) await deleteToken(messaging);
    _currentToken = null;
    console.info('[FCM] Token removed and messaging cleaned up.');
  } catch (err) {
    console.warn('[FCM] Teardown error:', err);
  }
}
