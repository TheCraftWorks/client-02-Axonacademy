// firebase-admin v12+ uses named exports, not the namespace pattern.
const {
  initializeApp,
  getApp,
  cert,
} = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let _app = null;
let _initAttempted = false;

function getFirebaseApp() {
  // Only attempt once per process start
  if (_initAttempted) return _app;
  _initAttempted = true;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  // dotenv stores multiline values with literal \n — replace with real newlines
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '[FCM] Firebase Admin SDK not configured — missing FIREBASE_PROJECT_ID / ' +
      'FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. Push notifications disabled.'
    );
    return null;
  }

  // Reuse the default app if already initialized (handles nodemon hot reload)
  try {
    _app = getApp();
    console.log('[FCM] Reusing existing Firebase Admin app.');
    return _app;
  } catch (_) {
    // getApp() throws if no app exists — proceed to initialize
  }

  try {
    _app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    console.log('[FCM] Firebase Admin SDK initialized successfully.');
  } catch (err) {
    console.error('[FCM] Failed to initialize Firebase Admin SDK:', err.message);
    _app = null;
  }

  return _app;
}

/**
 * Send a push notification to a list of FCM registration tokens.
 *
 * @param {string[]} tokens  — device FCM tokens
 * @param {{ title: string, body: string, data?: Record<string,string> }} payload
 * @returns {{ successCount: number, failureCount: number, invalidTokens: string[] }}
 */
async function sendFCMNotification(tokens, { title, body, data = {} }) {
  if (!tokens || tokens.length === 0) {
    console.log('[FCM] No tokens provided — skipping push.');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const app = getFirebaseApp();
  if (!app) {
    console.warn('[FCM] Skipping push — Firebase Admin not initialized.');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const messaging = getMessaging(app);

  // FCM multicast supports max 500 tokens per call
  const CHUNK_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);

    const message = {
      tokens: chunk,
      notification: { title, body },
      // FCM data payload only accepts string values
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      webpush: {
        notification: {
          title,
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          requireInteraction: true,
          actions: [
            { action: 'join', title: '▶ Join Class' },
          ],
        },
        fcmOptions: {
          link: data.click_action || '/',
        },
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;

      // Collect invalid / expired tokens for the caller to purge from DB
      response.responses.forEach((r, idx) => {
        if (!r.success) {
          const errCode = r.error?.code;
          const isInvalid =
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered';
          if (isInvalid) invalidTokens.push(chunk[idx]);
          console.warn(
            `[FCM] Token ...${chunk[idx].slice(-12)} failed: ${errCode} — ${r.error?.message}`
          );
        }
      });
    } catch (err) {
      console.error('[FCM] Multicast send error:', err.message);
      failureCount += chunk.length;
    }
  }

  console.log(
    `[FCM] Push complete: ✓ ${successCount} delivered, ✗ ${failureCount} failed, ${invalidTokens.length} invalid.`
  );
  return { successCount, failureCount, invalidTokens };
}

module.exports = { getFirebaseApp, sendFCMNotification };
