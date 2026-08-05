import { classroomStore } from '@/lib/classroomStore';

// Auth is cookie-based, with Authorization header fallback from the in-memory store.
const getApiBase = () => {
  const runtimeApiUrl =
    import.meta.env.VITE_API_URL ||
    import.meta.env.BACKEND_URL ||
    (typeof process !== 'undefined' ? process.env.VITE_API_URL || process.env.BACKEND_URL : '');

  return (runtimeApiUrl?.trim() || '/api/v1').replace(/\/+$/, '');
};

const API_BASE = getApiBase();

function getDevAuthUserHeaders(): Record<string, string> {
  if (import.meta.env.PROD) return {};
  const currentUser = classroomStore.getState().currentUser;
  if (!currentUser?.email) return {};
  const name = currentUser.name || 'Dev User';
  return {
    'x-dev-user-email': currentUser.email,
    'x-dev-user-role': currentUser.role,
    'x-dev-user-name': name || 'Dev User',
  };
}

function normalizeLoginIdentifier(value: string) {
  if (value.includes('@')) return value;
  const map: Record<string, string> = {
    Ajay: 'navin.procols@gmail.com',
    Admin: 'axonmedacademy2@gmail.com',
  };
  return map[value] ?? value;
}

export interface PortalNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  read: boolean;
  readAt?: string | null;
  actionUrl?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function normalizeBackendClassroom(raw: any) {
  const normalizeMeetingStatus = (status: string) => {
    if (status === 'waiting') return 'scheduled';
    return status || 'scheduled';
  };

  const computeStudentMetrics = (studentId: string) => {
    const meetings = Array.isArray(raw.meetings) ? raw.meetings : [];
    const countableMeetings = meetings.filter((m: any) => ['live', 'ended'].includes(normalizeMeetingStatus(m.status)));
    const attendedMeetings = countableMeetings.filter((m: any) =>
      Array.isArray(m.attendees) && m.attendees.some((a: any) => {
        const attendeeId = String(a.student?._id || a.student || a);
        return attendeeId === studentId && (a.joinedAt || (a.duration ?? 0) > 0);
      })
    );
    const attendance = countableMeetings.length
      ? Math.round((attendedMeetings.length / countableMeetings.length) * 100)
      : 0;

    const recordings = Array.isArray(raw.recordings) ? raw.recordings : [];
    const publishedRecordings = recordings.filter((r: any) => r.isPublished);
    const recordingPercents = publishedRecordings.map((r: any) => {
      const stats = Array.isArray(r.viewStats)
        ? r.viewStats.find((v: any) => String(v.student?._id || v.student) === studentId)
        : null;
      const duration = Number(r.duration || 0);
      return stats && duration > 0 ? Math.min(100, Math.round(((stats.totalWatchedSec || 0) / duration) * 100)) : 0;
    });
    const recordingProgress = recordingPercents.length
      ? Math.round(recordingPercents.reduce((sum: number, pct: number) => sum + pct, 0) / recordingPercents.length)
      : 0;

    const quizzes = Array.isArray(raw.quizzes) ? raw.quizzes : [];
    const publishedQuizzes = quizzes.filter((q: any) => ['published', 'closed'].includes(q.status));
    const submittedAttempts = publishedQuizzes.flatMap((q: any) =>
      Array.isArray(q.attempts)
        ? q.attempts.filter((a: any) => String(a.student?._id || a.student) === studentId && a.status === 'submitted')
        : []
    );
    const quizAvg = submittedAttempts.length
      ? Math.round(submittedAttempts.reduce((sum: number, att: any) => sum + (att.score?.percentage || 0), 0) / submittedAttempts.length)
      : 0;
    const quizProgress = publishedQuizzes.length
      ? Math.round((new Set(submittedAttempts.map((att: any) => String(att.quiz?._id || att.quiz))).size / publishedQuizzes.length) * 100)
      : 0;

    const progress = Math.round(
      (attendance * 0.3) +
      (recordingProgress * 0.4) +
      (quizProgress * 0.3)
    );

    return { attendance, quizAvg, progress };
  };

  return {
    id: raw._id || raw.id,
    name: raw.name || '',
    description: raw.description || '',
    code: raw.code || '',
    status: raw.status || 'active',
    maxStudents: raw.maxStudents ?? 100,
    program: raw.program?.name || raw.program?.title || raw.program || '',
    programId: raw.program?._id || raw.program?.id || (typeof raw.program === 'string' && raw.program.length === 24 ? raw.program : ''),
    createdAt: raw.createdAt || new Date().toISOString(),
    pendingJoinRequestsCount: raw.pendingJoinRequestsCount || 0,
    students: Array.isArray(raw.students)
      ? raw.students.map((s: any) => ({
        ...(() => {
          const id = String(s.student?._id || s.student || `student-${Date.now()}`);
          const metrics = computeStudentMetrics(id);
          return {
            id,
            name: s.student?.fullName || s.student?.email || 'Student',
            email: s.student?.email || '',
            enrollmentId: s.enrollmentId || '',
            progress: metrics.progress,
            attendance: metrics.attendance,
            quizAvg: metrics.quizAvg,
            status: s.status || 'active',
            addedAt: s.addedAt ? new Date(s.addedAt).toISOString() : new Date().toISOString(),
            certificateUrl: s.certificateUrl || undefined,
          };
        })()
      }))
      : [],
    announcements: Array.isArray(raw.announcements)
      ? raw.announcements.map(normalizeBackendAnnouncement)
      : [],
    meetings: Array.isArray(raw.meetings)
      ? raw.meetings.map((m: any) => ({
        id: m._id || m.id,
        title: m.title,
        description: m.description || '',
        scheduledAt: m.scheduledAt || new Date().toISOString(),
        duration: m.duration || 60,
        status: normalizeMeetingStatus(m.status),
        attendees: Array.isArray(m.attendees) ? m.attendees.map((a: any) => String(a.student?._id || a.student || a)) : [],
        roomId: m.roomId || '',
        webexLink: m.webexLink || '',
        webexPassword: m.webexPassword || '',
      }))
      : [],
    recordings: Array.isArray(raw.recordings)
      ? raw.recordings.map((r: any) => ({
        id: r._id || r.id,
        title: r.title,
        description: r.description || '',
        duration: r.duration || 0,
        isPublished: r.isPublished || false,
        chapters: r.chapters || [],
        storageProvider: r.storageProvider,
        cloudflareKey: r.cloudflareKey,
        cloudflareUrl: r.cloudflareUrl,
        folder: r.folder ? String(r.folder?._id || r.folder) : null,
        viewStats: Array.isArray(r.viewStats)
          ? r.viewStats.map((v: any) => ({
            studentId: String(v.student?._id || v.student),
            studentName: v.student ? v.student.fullName || 'Student' : 'Student',
            watchedPercent: r.duration > 0 ? Math.round((v.totalWatchedSec / r.duration) * 100) : 0,
            totalWatchedSec: v.totalWatchedSec || 0,
            lastPosition: v.lastPosition || 0,
          }))
          : [],
      }))
      : [],
    folders: Array.isArray(raw.folders)
      ? raw.folders.map((f: any) => ({
        id: f._id || f.id,
        name: f.name,
        description: f.description || '',
        classroomId: String(f.classroom?._id || f.classroom),
        createdBy: String(f.createdBy?._id || f.createdBy),
      }))
      : [],
    quizzes: Array.isArray(raw.quizzes)
      ? raw.quizzes.map((q: any) => ({
        id: q._id || q.id,
        title: q.title,
        instructions: q.instructions || '',
        duration: q.duration,
        maxAttempts: q.maxAttempts || 1,
        randomizeQuestions: q.randomizeQuestions,
        randomizeOptions: q.randomizeOptions,
        showLeaderboard: q.showLeaderboard,
        negativeMarking: q.negativeMarking,
        negativeMarkValue: q.negativeMarkValue,
        passPercent: q.passPercent,
        availableFrom: q.availableFrom,
        availableUntil: q.availableUntil,
        status: q.status || 'draft',
        questions: Array.isArray(q.questions) ? q.questions.map((quest: any) => ({
          id: quest._id || quest.id,
          type: quest.type || 'mcq',
          text: quest.text,
          marks: quest.marks || 1,
          explanation: quest.explanation || '',
          order: quest.order || 1,
          options: Array.isArray(quest.options) ? quest.options.map((o: any) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.isCorrect || false
          })) : []
        })) : [],
        attempts: Array.isArray(q.attempts) ? q.attempts.map((att: any) => ({
          id: att._id || att.id,
          studentId: String(att.student?._id || att.student),
          studentName: att.studentName || 'Student',
          attemptNo: att.attemptNo || 1,
          status: att.status || 'submitted',
          startedAt: att.startedAt,
          submittedAt: att.submittedAt,
          totalTimeTakenSec: att.totalTimeTakenSec || 0,
          answers: Array.isArray(att.answers) ? att.answers.map((ans: any) => ({
            questionId: String(ans.questionId),
            selectedOptions: ans.selectedOptions || [],
            isCorrect: !!ans.isCorrect,
            marksAwarded: ans.marksAwarded ?? 0,
          })) : [],
          score: att.score || { rawMarks: 0, totalMarks: 0, percentage: 0, passed: false }
        })) : []
      }))
      : [],
    instructors: Array.isArray(raw.instructors)
      ? raw.instructors.map((i: any) => ({
        id: i._id || i.id || (typeof i === 'string' ? i : ''),
        name: i.fullName || i.name || 'Faculty',
      }))
      : [],
  };
}

function normalizeBackendAnnouncement(raw: any) {
  const author = raw.author;
  return {
    id: raw._id || raw.id,
    content: raw.content || '',
    createdAt: raw.createdAt || new Date().toISOString(),
    author: author?.fullName || author?.email || author?.role || 'Admin',
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  };
}

function normalizeBackendQuiz(raw: any) {
  return {
    id: raw._id || raw.id,
    title: raw.title || '',
    instructions: raw.instructions || '',
    duration: raw.duration ?? null,
    maxAttempts: raw.maxAttempts || 1,
    randomizeQuestions: raw.randomizeQuestions || false,
    randomizeOptions: raw.randomizeOptions || false,
    showLeaderboard: raw.showLeaderboard || false,
    negativeMarking: raw.negativeMarking || false,
    negativeMarkValue: raw.negativeMarkValue ?? 0.25,
    passPercent: raw.passPercent || 0,
    availableFrom: raw.availableFrom || '',
    availableUntil: raw.availableUntil || '',
    status: raw.status || 'draft',
    questions: Array.isArray(raw.questions) ? raw.questions.map((quest: any) => ({
      id: quest._id || quest.id,
      type: quest.type || 'mcq',
      text: quest.text || '',
      marks: quest.marks || 1,
      explanation: quest.explanation || '',
      order: quest.order || 0,
      options: Array.isArray(quest.options) ? quest.options.map((o: any) => ({
        label: o.label,
        text: o.text,
        isCorrect: !!o.isCorrect,
      })) : [],
    })) : [],
    attempts: Array.isArray(raw.attempts) ? raw.attempts.map((att: any) => ({
      id: att._id || att.id,
      studentId: String(att.student?._id || att.student || ''),
      studentName: att.studentName || att.student?.fullName || 'Student',
      attemptNo: att.attemptNo || 1,
      status: att.status || 'submitted',
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      totalTimeTakenSec: att.totalTimeTakenSec || 0,
      answers: Array.isArray(att.answers) ? att.answers.map((ans: any) => ({
        questionId: String(ans.questionId),
        selectedOptions: ans.selectedOptions || [],
        isCorrect: !!ans.isCorrect,
        marksAwarded: ans.marksAwarded ?? 0,
      })) : [],
      score: att.score || { rawMarks: 0, totalMarks: 0, percentage: 0, passed: false },
    })) : [],
  };
}

async function fetchJson(path: string, options: RequestInit = {}) {
  const accessToken = classroomStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    ...getDevAuthUserHeaders(),
  };
  const extraHeaders = options.headers as Record<string, string> | undefined;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include', // sends HttpOnly cookies cross-origin (Vercel → Railway)
    headers,
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    // On 401, clear the in-memory user so the router redirects to /login.
    // Exclude /auth/me — boot-time rehydration handles that path itself.
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      classroomStore.setState(() => ({ currentUser: null }));
    }
    throw new Error(payload.message || 'Server error');
  }
  return payload;
}

export async function loginUser(identifier: string, password: string) {
  // Server sets HttpOnly cookies (accessToken, refreshToken, session) in the response.
  // Nothing to store client-side — cookies are sent automatically on every subsequent request.
  // Supports login by email or userId — send raw identifier, server detects which one it is.
  return fetchJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export async function forgotPassword(identifier: string) {
  return fetchJson('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

export async function resetPassword(identifier: string, otp: string, newPassword: string) {
  return fetchJson('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ identifier, otp, newPassword }),
  });
}

export async function getCurrentUser() {
  return fetchJson('/auth/me');
}

export async function updateMyProfile(data: { fullName?: string; phone?: string; address?: string }) {
  return fetchJson('/auth/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadProfileAvatar(file: File, onProgress?: (pct: number) => void): Promise<{ avatar: string; user: any }> {
  const accessToken = classroomStore.getState().accessToken;
  const formData = new FormData();
  formData.append('avatar', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/auth/me/avatar`);
    xhr.withCredentials = true;
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    // Dev auth headers
    if (!import.meta.env.PROD) {
      const devHeaders = getDevAuthUserHeaders();
      Object.entries(devHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const resp = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && resp.success) {
          resolve(resp);
        } else {
          reject(new Error(resp.message || `Upload failed: ${xhr.statusText}`));
        }
      } catch {
        reject(new Error('Failed to parse upload response'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during avatar upload'));
    xhr.send(formData);
  });
}

export async function getAdminUsers(role?: string) {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  const payload = await fetchJson(`/admin/users${query}`);
  return payload.users.map((user: any) => ({
    id: String(user._id || user.id),
    name: user.fullName || user.email,
    email: user.email || '',
    phone: user.phone || '',
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  }));
}

export async function createAdminUser(data: {
  fullName: string;
  email: string;
  role: string;
  password?: string;
  phone?: string;
}) {
  return fetchJson('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminUser(id: string) {
  return fetchJson(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function getClassrooms() {
  const payload = await fetchJson('/classrooms');
  return payload.classrooms.map(normalizeBackendClassroom);
}

export async function getClassroomById(id: string) {
  const payload = await fetchJson(`/classrooms/${encodeURIComponent(id)}`);
  return normalizeBackendClassroom(payload.classroom);
}

export async function createClassroomAnnouncement(classroomId: string, content: string, attachments: any[] = []) {
  const payload = await fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/announcements`, {
    method: 'POST',
    body: JSON.stringify({ content, attachments }),
  });
  return normalizeBackendAnnouncement(payload.announcement);
}

export async function deleteClassroomAnnouncement(classroomId: string, announcementId: string) {
  return fetchJson(
    `/classrooms/${encodeURIComponent(classroomId)}/announcements/${encodeURIComponent(announcementId)}`,
    { method: 'DELETE' }
  );
}

export async function createQuiz(classroomId: string, quiz: any) {
  const payload = await fetchJson('/quizzes', {
    method: 'POST',
    body: JSON.stringify({ ...quiz, classroom: classroomId }),
  });
  return normalizeBackendQuiz(payload.quiz);
}

export async function generateQuizFromPdf(file: File) {
  const accessToken = classroomStore.getState().accessToken;
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {
    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    ...getDevAuthUserHeaders(),
  };

  const response = await fetch(`${API_BASE}/quizzes/generate-from-pdf`, {
    method: 'POST',
    credentials: 'include',
    headers, // Content-Type is omitted so browser sets it with multipart boundary
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      classroomStore.setState(() => ({ currentUser: null }));
    }
    throw new Error(payload.message || 'Failed to generate quiz from PDF');
  }
  return payload.questions;
}


export async function updateQuiz(quizId: string, quiz: any) {
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}`, {
    method: 'PUT',
    body: JSON.stringify(quiz),
  });
  return normalizeBackendQuiz(payload.quiz);
}

export async function publishQuiz(quizId: string) {
  return fetchJson(`/quizzes/${encodeURIComponent(quizId)}/publish`, { method: 'PUT' });
}

export async function closeQuiz(quizId: string) {
  return fetchJson(`/quizzes/${encodeURIComponent(quizId)}/close`, { method: 'PUT' });
}

export async function deleteQuiz(quizId: string) {
  return fetchJson(`/quizzes/${encodeURIComponent(quizId)}`, { method: 'DELETE' });
}

function normalizeBackendQuizAttempt(att: any) {
  return {
    id: att._id || att.id,
    studentId: String(att.student?._id || att.student || ''),
    studentName: att.studentName || att.student?.fullName || 'Student',
    attemptNo: att.attemptNo || 1,
    status: att.status || 'submitted',
    startedAt: att.startedAt,
    submittedAt: att.submittedAt,
    totalTimeTakenSec: att.totalTimeTakenSec || 0,
    answers: Array.isArray(att.answers) ? att.answers.map((ans: any) => ({
      questionId: String(ans.questionId),
      selectedOptions: ans.selectedOptions || [],
      isCorrect: !!ans.isCorrect,
      marksAwarded: ans.marksAwarded ?? 0,
    })) : [],
    score: {
      rawMarks: att.score?.rawMarks ?? 0,
      totalMarks: att.score?.totalMarks ?? 0,
      percentage: Math.round(att.score?.percentage ?? 0),
      passed: !!att.score?.passed,
    },
  };
}

function normalizeApiQuizQuestion(q: any) {
  return {
    id: q._id || q.id,
    type: q.type || 'mcq',
    text: q.text || '',
    marks: q.marks || 1,
    explanation: q.explanation || '',
    order: q.order || 0,
    options: Array.isArray(q.options)
      ? q.options.map((o: any) => ({ label: o.label, text: o.text, isCorrect: !!o.isCorrect }))
      : [],
  };
}

export async function startQuizAttempt(quizId: string) {
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}/attempt/start`, { method: 'POST' });
  if (payload.alreadySubmitted) {
    return {
      alreadySubmitted: true,
      attemptId: payload.attemptId ? String(payload.attemptId) : undefined,
      message: payload.message || 'You have already submitted this quiz.',
      questions: [],
    };
  }
  return {
    alreadySubmitted: false,
    attemptId: String(payload.attempt?._id || payload.attempt?.id || ''),
    startedAt: payload.attempt?.startedAt,
    attemptNo: payload.attempt?.attemptNo,
    duration: payload.attempt?.duration,
    questions: Array.isArray(payload.questions) ? payload.questions.map(normalizeApiQuizQuestion) : [],
  };
}

export async function saveQuizAnswer(
  quizId: string,
  data: { attemptId: string; questionId: string; selectedOptions: string[]; timeTakenSec?: number },
) {
  return fetchJson(`/quizzes/${encodeURIComponent(quizId)}/attempt/answer`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export interface QuizAnswerItem {
  questionId: string;
  selectedOptions: string[];
  timeTakenSec?: number;
}

export async function saveQuizAnswersBulk(
  quizId: string,
  data: { attemptId: string; answers: QuizAnswerItem[] },
) {
  return fetchJson(`/quizzes/${encodeURIComponent(quizId)}/attempt/answers`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function submitQuizAttempt(quizId: string, attemptId: string) {
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}/attempt/submit`, {
    method: 'POST',
    body: JSON.stringify({ attemptId }),
  });
  return {
    score: {
      rawMarks: payload.score?.rawMarks ?? 0,
      totalMarks: payload.score?.totalMarks ?? 0,
      percentage: Math.round(payload.score?.percentage ?? 0),
      passed: !!payload.score?.passed,
    },
  };
}

export async function getQuizAttemptResult(quizId: string, attemptId?: string) {
  const query = attemptId ? `?attemptId=${encodeURIComponent(attemptId)}` : '';
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}/attempt/my-result${query}`);
  return {
    score: {
      rawMarks: payload.score?.rawMarks ?? 0,
      totalMarks: payload.score?.totalMarks ?? 0,
      percentage: Math.round(payload.score?.percentage ?? 0),
      passed: !!payload.score?.passed,
    },
    submittedAt: payload.submittedAt,
    answers: Array.isArray(payload.answers) ? payload.answers.map((ans: any) => ({
      questionId: String(ans.questionId),
      selectedOptions: ans.selectedOptions || [],
      isCorrect: !!ans.isCorrect,
      marksAwarded: ans.marksAwarded ?? 0,
      questionText: ans.questionText || '',
      explanation: ans.explanation || '',
      correctOptions: ans.correctOptions || [],
    })) : [],
  };
}

export async function getQuizReport(quizId: string) {
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}/report`);
  return Array.isArray(payload.attempts) ? payload.attempts.map(normalizeBackendQuizAttempt) : [];
}

// ─── Chunk size for multipart uploads ────────────────────────────────────────
// 50 MB per part. Files ≥ 50 MB use the multipart path; smaller files use a
// single presigned PUT (simpler, no overhead). R2 minimum part size is 5 MB
// (last part exempt), so 50 MB chunks satisfy that rule for any real video.
const MULTIPART_CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB in bytes

/**
 * Upload one part of a multipart upload directly to R2 and return its ETag.
 *
 * NOTE: your R2 bucket's CORS policy must include `ETag` in
 * `Access-Control-Expose-Headers` so the browser can read it.
 * Example CORS rule to add in the Cloudflare dashboard:
 *   AllowedOrigins: ["https://your-frontend.vercel.app"]
 *   AllowedMethods: ["PUT"]
 *   AllowedHeaders: ["Content-Type"]
 *   ExposedHeaders: ["ETag"]
 */
async function uploadPartToR2(
  presignedUrl: string,
  chunk: Blob,
  partNumber: number,
  onPartBytes?: (loaded: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl, true);
    // Parts must be sent as binary — do NOT set Content-Type to the video MIME type
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onPartBytes) onPartBytes(e.loaded);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // R2 returns ETag in the response header (quoted string, e.g. "abc123")
        const etag =
          xhr.getResponseHeader('ETag') ||
          xhr.getResponseHeader('etag') ||
          xhr.getResponseHeader('Etag') ||
          '';
        if (!etag) {
          // ETag is mandatory for CompleteMultipartUpload — missing means CORS
          // is not exposing it. See the NOTE above about your R2 CORS policy.
          reject(
            new Error(
              `Part ${partNumber} uploaded but ETag header is missing. ` +
              `Add "ETag" to Access-Control-Expose-Headers in your R2 bucket CORS policy.`,
            ),
          );
          return;
        }
        resolve(etag); // Keep quotes — R2 expects them in CompleteMultipartUpload
      } else {
        reject(new Error(`Part ${partNumber} upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () =>
      reject(new Error(`Network error while uploading part ${partNumber}`)),
    );
    xhr.addEventListener('abort', () =>
      reject(new Error(`Upload aborted on part ${partNumber}`)),
    );

    xhr.send(chunk);
  });
}

/**
 * Upload a general file (like PDF) to Cloudinary for classroom assets.
 */
export async function uploadClassroomFileToCloudinary({
  file,
  onProgress,
}: {
  file: File;
  onProgress?: (percentage: number) => void;
}) {
  const accessToken = classroomStore.getState().accessToken;
  const formData = new FormData();
  formData.append('file', file);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/classrooms/upload-asset`);

    if (accessToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    }
    // Note: Do NOT set Content-Type header for FormData, browser does it with boundary

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percentage = Math.round((e.loaded / e.total) * 100);
        onProgress?.(percentage);
      }
    };

    xhr.onload = () => {
      try {
        const resp = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && resp.success) {
          resolve(resp.url);
        } else {
          reject(new Error(resp.message || `Upload failed: ${xhr.statusText}`));
        }
      } catch (err) {
        reject(new Error('Failed to parse upload response'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

/**
 * Upload a classroom recording to Cloudflare R2.
 *
 * Strategy (chosen automatically by file size):
 *
 *   • File < 100 MB  → single presigned PUT  (simple, no overhead)
 *   • File ≥ 100 MB  → S3 multipart upload   (100 MB chunks, direct to R2)
 *
 * The multipart path supports files from 100 MB up to 3 GB+ without any
 * Railway timeout risk — Railway only handles tiny JSON orchestration calls.
 *
 * @param options.file          - The File / Blob to upload
 * @param options.classroom     - Classroom ObjectId
 * @param options.title         - Recording title
 * @param options.description   - Optional description
 * @param options.duration      - Duration in seconds
 * @param options.isPublished   - Whether to publish immediately
 * @param options.chapters      - Optional chapters array
 * @param options.onProgress    - Progress callback ({ loaded, total, percentage, part?, totalParts? })
 */
export async function uploadClassroomRecordingToCloudflare({
  file,
  classroom,
  title,
  description = '',
  duration = 0,
  isPublished = false,
  chapters = [],
  folderId,
  onProgress,
}: {
  file: File;
  classroom: string;
  title: string;
  description?: string;
  duration?: number;
  isPublished?: boolean;
  chapters?: unknown[];
  folderId?: string;
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percentage: number;
    part?: number;       // current chunk number (multipart only)
    totalParts?: number; // total chunks (multipart only)
  }) => void;
}) {
  const authHeaders = getDevAuthUserHeaders();
  const accessToken = classroomStore.getState().accessToken;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...authHeaders,
  };

  // Helper: fire onProgress safely
  const reportProgress = (
    loaded: number,
    total: number,
    part?: number,
    totalParts?: number,
  ) => {
    onProgress?.({
      loaded,
      total,
      percentage: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      ...(part != null ? { part, totalParts } : {}),
    });
  };

  const fileMB = (file.size / (1024 * 1024)).toFixed(1);

  // ============================================================
  // PATH A — Single presigned PUT for small files (< 50 MB)
  // ============================================================
  if (file.size < MULTIPART_CHUNK_SIZE) {
    console.log(`[Upload] PATH A — single PUT | ${file.name} | ${fileMB} MB (below 50 MB threshold)`);
    // ── Step 1: get presigned upload URL from Railway ────────────────────
    const presignRes = await fetch(`${API_BASE}/recordings/classroom/presigned-url`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ classroom, filename: file.name, contentType: file.type || 'video/mp4' }),
    });

    const presignData = await presignRes.json().catch(() => ({}));
    if (!presignRes.ok) {
      if (presignRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
      throw new Error(presignData.message || 'Failed to get upload URL');
    }

    const { uploadUrl, objectKey, publicUrl } = presignData as {
      uploadUrl: string;
      objectKey: string;
      publicUrl: string;
    };

    // ── Step 2: PUT directly to R2 ───────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) reportProgress(e.loaded, e.total);
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          reportProgress(file.size, file.size);
          resolve();
        } else {
          reject(new Error(`R2 upload failed: HTTP ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled')));

      xhr.send(file);
    });

    // ── Step 3: save metadata ────────────────────────────────────────────
    const saveRes = await fetch(`${API_BASE}/recordings/classroom/save-recording`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ classroom, title, description, duration, isPublished, objectKey, publicUrl, chapters, folderId }),
    });

    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) {
      if (saveRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
      throw new Error(saveData.message || 'Failed to save recording metadata');
    }

    return saveData;
  }

  // ============================================================
  // PATH B — S3 Multipart Upload for large files (≥ 50 MB)
  // ============================================================
  const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
  console.log(`[Upload] PATH B — multipart | ${file.name} | ${fileMB} MB | ${totalParts} parts × 50 MB`);

  // ── Step 1: Initiate multipart — Railway creates the upload on R2 ────
  const initiateRes = await fetch(`${API_BASE}/recordings/classroom/multipart/initiate`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders,
    body: JSON.stringify({ classroom, filename: file.name, contentType: file.type || 'video/mp4' }),
  });

  const initiateData = await initiateRes.json().catch(() => ({}));
  if (!initiateRes.ok) {
    if (initiateRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
    throw new Error(initiateData.message || 'Failed to initiate multipart upload');
  }

  const { uploadId, objectKey, publicUrl } = initiateData as {
    uploadId: string;
    objectKey: string;
    publicUrl: string;
  };

  // Track bytes uploaded per part so progress is accurate across all chunks
  const partBytesLoaded = new Array<number>(totalParts).fill(0);

  // Collect { PartNumber, ETag } after each successful part
  const completedParts: { PartNumber: number; ETag: string }[] = [];

  // ── Steps 2–3: Upload each 100 MB chunk sequentially ────────────────
  // Sequential is safer than parallel for unstable connections; each part
  // is independently retryable at the application level if needed.
  try {
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * MULTIPART_CHUNK_SIZE;
      const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      console.log(`[Upload] Starting part ${partNumber}/${totalParts} — ${(chunk.size / 1024 / 1024).toFixed(1)} MB`);

      // 2a. Get a presigned URL for this specific part from Railway (instant)
      const partUrlRes = await fetch(`${API_BASE}/recordings/classroom/multipart/presign-part`, {
        method: 'POST',
        credentials: 'include',
        headers: baseHeaders,
        body: JSON.stringify({ objectKey, uploadId, partNumber }),
      });

      const partUrlData = await partUrlRes.json().catch(() => ({}));
      if (!partUrlRes.ok) {
        throw new Error(partUrlData.message || `Failed to get presigned URL for part ${partNumber}`);
      }

      const { presignedUrl } = partUrlData as { presignedUrl: string };

      // 2b. PUT the chunk directly to R2 (never touches Railway)
      const etag = await uploadPartToR2(presignedUrl, chunk, partNumber, (loaded) => {
        partBytesLoaded[i] = loaded;
        const totalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
        reportProgress(totalLoaded, file.size, partNumber, totalParts);
      });

      // Mark this part's bytes as fully loaded in the tracker
      partBytesLoaded[i] = chunk.size;
      completedParts.push({ PartNumber: partNumber, ETag: etag });
      console.log(`[Upload] Part ${partNumber}/${totalParts} done ✓  ETag: ${etag}`);

      // Intermediate progress update after part completes
      const totalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
      reportProgress(totalLoaded, file.size, partNumber, totalParts);
    }
  } catch (uploadError) {
    // Clean up incomplete multipart upload on R2 (best-effort, fire-and-forget)
    fetch(`${API_BASE}/recordings/classroom/multipart/abort`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ objectKey, uploadId }),
    }).catch(() => { /* ignore abort errors */ });

    throw uploadError; // Re-throw so the UI shows the real error
  }

  // ── Step 4: Tell R2 to assemble all parts into the final object ──────
  const completeRes = await fetch(`${API_BASE}/recordings/classroom/multipart/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders,
    body: JSON.stringify({ objectKey, uploadId, parts: completedParts }),
  });

  const completeData = await completeRes.json().catch(() => ({}));
  if (!completeRes.ok) {
    throw new Error(completeData.message || 'Failed to complete multipart upload on R2');
  }

  reportProgress(file.size, file.size); // 100%

  // ── Step 5: Save metadata in Railway DB (tiny JSON, instant) ────────
  const saveRes = await fetch(`${API_BASE}/recordings/classroom/save-recording`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders,
    body: JSON.stringify({
      classroom,
      title,
      description,
      duration,
      isPublished,
      objectKey,
      publicUrl,
      chapters,
      folderId,
    }),
  });

  const saveData = await saveRes.json().catch(() => ({}));
  if (!saveRes.ok) {
    if (saveRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
    throw new Error(saveData.message || 'Failed to save recording metadata');
  }

  return saveData;
}

export async function addStudentsToClassroom(classroomId: string, studentIds: string[]) {
  const payload = await fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/students/add`, {
    method: 'POST',
    body: JSON.stringify({ studentIds }),
  });
  return payload;
}

export async function updateClassroomStudentStatus(classroomId: string, studentId: string, status: string) {
  const payload = await fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/students/${encodeURIComponent(studentId)}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return payload;
}

export async function removeStudentFromClassroom(classroomId: string, studentId: string) {
  const payload = await fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/students/${encodeURIComponent(studentId)}`, {
    method: 'DELETE',
  });
  return payload;
}

export async function updateStudentCertificate(classroomId: string, studentId: string, certificateUrl: string) {
  const payload = await fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/students/${encodeURIComponent(studentId)}/certificate`, {
    method: 'PUT',
    body: JSON.stringify({ certificateUrl }),
  });
  return payload;
}

export async function createClassroom(payload: {
  name: string;
  description?: string;
  thumbnail?: string;
  code: string;
  program?: string;
  batch?: string;
  maxStudents?: number;
  settings?: Record<string, any>;
  instructors?: string[];
}) {
  const result = await fetchJson('/classrooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeBackendClassroom(result.classroom);
}

export async function updateClassroom(
  id: string,
  payload: {
    name?: string;
    description?: string;
    thumbnail?: string;
    code?: string;
    program?: string;
    batch?: string;
    maxStudents?: number;
    status?: 'active' | 'archived' | 'draft';
    settings?: Record<string, any>;
    instructors?: string[];
  }
) {
  const result = await fetchJson(`/classrooms/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return normalizeBackendClassroom(result.classroom);
}

export async function archiveClassroom(id: string) {
  const result = await fetchJson(`/classrooms/${encodeURIComponent(id)}/archive`, {
    method: 'PUT',
  });
  return normalizeBackendClassroom(result.classroom);
}

export async function getMyClassrooms() {
  const payload = await fetchJson('/classrooms/my');
  return payload.classrooms.map(normalizeBackendClassroom);
}

export async function getMyMeetings() {
  return fetchJson('/meetings/my');
}

export async function createMeeting(payload: {
  classroom: string;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  sendWhatsApp?: boolean;
  sendPortalNotification?: boolean;
}) {
  return fetchJson('/meetings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function startMeeting(meetingId: string) {
  return fetchJson(`/meetings/${encodeURIComponent(meetingId)}/start`, {
    method: 'POST',
  });
}

export async function endMeeting(meetingId: string) {
  return fetchJson(`/meetings/${encodeURIComponent(meetingId)}/end`, {
    method: 'POST',
  });
}

export async function deleteMeeting(meetingId: string) {
  return fetchJson(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: 'DELETE',
  });
}

export async function getClassroomMeetings(classroomIdentifier: string) {
  return fetchJson(`/meetings/classroom/${encodeURIComponent(classroomIdentifier)}`);
}

export async function getMyNotifications(limit = 10) {
  const payload = await fetchJson(`/notifications?limit=${encodeURIComponent(String(limit))}`);
  return payload.notifications as PortalNotification[];
}

export async function getUnreadNotificationCount() {
  const payload = await fetchJson('/notifications/unread-count');
  return payload.unreadCount as number;
}

export async function markNotificationRead(notificationId: string) {
  return fetchJson(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PUT',
  });
}

export async function saveFcmToken(token: string) {
  return fetchJson('/notifications/fcm-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function removeFcmToken(token: string) {
  return fetchJson('/notifications/fcm-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

export function getRecordingStreamUrl(recordingId: string): string {
  return `${API_BASE}/recordings/classroom/${recordingId}/stream`;
}

export async function trackRecordingProgress(
  recordingId: string,
  data: { position: number; watchedSec: number; completed?: boolean },
) {
  return fetchJson(`/recordings/classroom/${encodeURIComponent(recordingId)}/progress`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  // If it starts with /uploads, it's relative to the server root (not API_BASE)
  const baseUrl = API_BASE.replace(/\/api\/v1$/, '');
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function publishRecording(recordingId: string) {
  return fetchJson(`/recordings/classroom/${encodeURIComponent(recordingId)}/publish`, {
    method: 'PUT',
  });
}

export async function unpublishRecording(recordingId: string) {
  return fetchJson(`/recordings/classroom/${encodeURIComponent(recordingId)}`, {
    method: 'PUT',
    body: JSON.stringify({ isPublished: false }),
  });
}

export async function deleteRecording(recordingId: string) {
  return fetchJson(`/recordings/classroom/${encodeURIComponent(recordingId)}`, {
    method: 'DELETE',
  });
}

export async function reuseClassroomRecording(payload: {
  sourceRecordingId: string;
  targetClassroomId: string;
  title?: string;
  description?: string;
  folderId?: string;
}) {
  return fetchJson('/recordings/classroom/reuse', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createClassroomFolder(classroomId: string, name: string, description?: string) {
  return fetchJson('/recordings/classroom/folders', {
    method: 'POST',
    body: JSON.stringify({ classroomId, name, description }),
  });
}

export async function updateClassroomFolder(folderId: string, name: string, description?: string) {
  return fetchJson(`/recordings/classroom/folders/${encodeURIComponent(folderId)}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteClassroomFolder(folderId: string) {
  return fetchJson(`/recordings/classroom/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  });
}

export async function getClassroomReuseList() {
  return fetchJson('/recordings/classroom/reuse-list');
}

export async function reuseClassroomFolder(sourceFolderId: string, targetClassroomId: string, selectedRecordingIds?: string[]) {
  return fetchJson('/recordings/classroom/reuse-folder', {
    method: 'POST',
    body: JSON.stringify({ sourceFolderId, targetClassroomId, selectedRecordingIds }),
  });
}

export async function getDetailedProgress(classroomId: string) {
  const payload = await fetchJson(`/enrollments/classroom/${encodeURIComponent(classroomId)}/progress`);
  return payload.stats;
}

export async function logoutUser() {
  return fetchJson('/auth/logout', { method: 'POST' });
}

// ─── Programs (Courses) ───────────────────────────────────────────────────────

export interface ProgramCourse {
  id: string;
  title: string;
  category: string;
  description: string;
  price: number;
  status: 'published' | 'draft' | 'archived';
  updatedAt: string;
  specialty?: string;
  duration?: string;
  rating?: number;
  image?: string;
}

function normalizeBackendProgram(raw: any): ProgramCourse {
  const status: ProgramCourse['status'] =
    raw.status === 'archived' ? 'archived' :
      (raw.isPublished || raw.status === 'published') ? 'published' : 'draft';
  return {
    id: String(raw._id || raw.id),
    title: raw.title || '',
    category: raw.category || 'Other',
    description: raw.description || raw.shortDesc || '',
    price: raw.fee?.baseAmount ?? 0,
    status,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    specialty: raw.specialty,
    duration: raw.duration,
    rating: raw.rating,
    image: raw.image,
  };
}

export async function getAdminPrograms(): Promise<ProgramCourse[]> {
  const payload = await fetchJson('/programs/admin-all');
  return (payload.programs as any[]).map(normalizeBackendProgram);
}

export async function getPublicPrograms(): Promise<ProgramCourse[]> {
  const payload = await fetchJson('/programs');
  return (payload.programs as any[]).map(normalizeBackendProgram);
}

export async function createAdminProgram(
  data: Omit<ProgramCourse, 'id' | 'updatedAt'>,
  imageFile?: File | null
): Promise<ProgramCourse> {
  const fd = new FormData();
  fd.append("title", data.title);
  fd.append("category", data.category);
  fd.append("status", data.status);
  if (data.description) fd.append("description", data.description);
  if (data.specialty) fd.append("specialty", data.specialty);
  if (data.duration) fd.append("duration", data.duration);
  if (data.rating) fd.append("rating", String(data.rating));
  fd.append("fee", JSON.stringify({ baseAmount: data.price, gstPercent: 18 }));
  if (imageFile) {
    fd.append("image", imageFile);
  }

  const payload = await api.multipart('/programs', 'POST', fd);
  return normalizeBackendProgram(payload.program);
}

export async function updateAdminProgram(
  id: string,
  data: Partial<Omit<ProgramCourse, 'id'>>,
  imageFile?: File | null,
  removeImage?: boolean
): Promise<ProgramCourse> {
  const fd = new FormData();
  if (data.title !== undefined) fd.append("title", data.title);
  if (data.category !== undefined) fd.append("category", data.category);
  if (data.status !== undefined) fd.append("status", data.status);
  if (data.description !== undefined) fd.append("description", data.description);
  if (data.specialty !== undefined) fd.append("specialty", data.specialty);
  if (data.duration !== undefined) fd.append("duration", data.duration);
  if (data.rating !== undefined) fd.append("rating", String(data.rating));
  if (data.price !== undefined) {
    fd.append("fee", JSON.stringify({ baseAmount: data.price, gstPercent: 18 }));
  }

  if (imageFile) {
    fd.append("image", imageFile);
  } else if (removeImage) {
    fd.append("removeImage", "true");
  }

  const payload = await api.multipart(`/programs/${encodeURIComponent(id)}`, 'PUT', fd);
  return normalizeBackendProgram(payload.program);
}

export async function deleteAdminProgram(id: string) {
  return fetchJson(`/programs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Public Enrollment Registration ──────────────────────────────────────────

export interface RegisterStudentData {
  fullName: string;
  email: string;
  phone?: string;
  qualification?: string;
  address?: string;
  program?: string;
  message?: string;
}

export async function registerStudent(data: RegisterStudentData): Promise<{ requestId: string }> {
  const BASE = getApiBase();
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Registration failed');
  return json;
}

// ─── Admin Enrollment Requests ────────────────────────────────────────────────

export interface EnrollmentRequest {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  qualification?: string;
  program?: { _id: string; title: string } | string;
  message?: string;
  status: 'pending' | 'approved' | 'held' | 'rejected';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  user?: { _id: string; email: string };
}

export async function getEnrollmentRequests(status?: string): Promise<{
  requests: EnrollmentRequest[];
  counts: { total: number; pending_count: number; approved_count: number; held_count: number; rejected_count: number };
}> {
  const qs = status && status !== 'all' ? `?status=${status}` : '';
  const data = await fetchJson(`/requests${qs}`);
  return data;
}

export async function approveEnrollmentRequest(id: string, opts: { classroomIds?: string[]; note?: string } = {}) {
  return fetchJson(`/requests/${id}/approve`, {
    method: 'PUT',
    body: JSON.stringify(opts),
  });
}

export async function rejectEnrollmentRequest(id: string, opts: { note?: string } = {}) {
  return fetchJson(`/requests/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify(opts),
  });
}

export async function holdEnrollmentRequest(id: string, opts: { note?: string } = {}) {
  return fetchJson(`/requests/${id}/hold`, {
    method: 'PUT',
    body: JSON.stringify(opts),
  });
}

export const api = {
  get: (path: string) => fetchJson(path, { method: 'GET' }),
  post: (path: string, body?: any) => fetchJson(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: (path: string, body?: any) => fetchJson(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => fetchJson(path, { method: 'DELETE' }),
  multipart: async (path: string, method: 'POST' | 'PUT', formData: FormData) => {
    const accessToken = classroomStore.getState().accessToken;
    const headers: Record<string, string> = {
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
      ...getDevAuthUserHeaders(),
    };

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
        classroomStore.setState(() => ({ currentUser: null }));
      }
      throw new Error(payload.message || 'Server error');
    }
    return payload;
  }
};

export async function getMeetingByRoomId(roomId: string) {
  const payload = await fetchJson(`/meetings/room/${encodeURIComponent(roomId)}`);
  return payload.meeting;
}

export async function joinMeetingByRoomId(roomId: string) {
  const payload = await fetchJson(`/meetings/room/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
  });
  return payload.meeting;
}

export async function heartbeatMeetingByRoomId(roomId: string) {
  return fetchJson(`/meetings/room/${encodeURIComponent(roomId)}/heartbeat`, {
    method: 'POST',
  });
}

export async function leaveMeetingByRoomId(roomId: string) {
  return fetchJson(`/meetings/room/${encodeURIComponent(roomId)}/leave`, {
    method: 'POST',
  });
}

export async function getClassStudents(classId: string) {
  return fetchJson(`/classes/${encodeURIComponent(classId)}/students`);
}

export async function getClassAttendance(classId: string, date?: string, subject?: string, meetingId?: string) {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (subject) params.append('subject', subject);
  if (meetingId) params.append('meetingId', meetingId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchJson(`/attendance/class/${encodeURIComponent(classId)}${query}`);
}

export async function saveAttendance(data: {
  classId: string;
  date: string;
  subject?: string;
  meetingId?: string;
  records: Array<{ studentId: string; status: string }>
}) {
  return fetchJson('/attendance', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStudentAttendanceDetails(studentId: string) {
  return fetchJson(`/attendance/student/${encodeURIComponent(studentId)}`);
}

export async function getClassAttendanceReport(classId: string) {
  return fetchJson(`/attendance/report/class/${encodeURIComponent(classId)}`);
}

// ─── Chat / Messaging ─────────────────────────────────────────────────────────

export interface ChatUser {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  avatar: string | null;
  lastMessage: string;
  lastMessageTime: string | null;
}

export interface ChatMessage {
  _id: string;
  senderId: { _id: string; fullName: string; email: string; role: string };
  receiverId: { _id: string; fullName: string; email: string; role: string };
  message: string;
  createdAt: string;
  updatedAt: string;
}

export async function getChatUsers(): Promise<ChatUser[]> {
  const payload = await fetchJson('/messages/users');
  return payload.data;
}

export async function getConversation(userId: string): Promise<ChatMessage[]> {
  const payload = await fetchJson(`/messages/conversation/${encodeURIComponent(userId)}`);
  return payload.data;
}

export async function sendMessage(receiverId: string, message: string): Promise<ChatMessage> {
  const payload = await fetchJson('/messages/send', {
    method: 'POST',
    body: JSON.stringify({ receiverId, message }),
  });
  return payload.data;
}


export async function uploadLibraryRecordingToCloudflare({
  file,
  folderId,
  title,
  description = '',
  duration = 0,
  onProgress,
}: {
  file: File;
  folderId?: string;
  title: string;
  description?: string;
  duration?: number;
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percentage: number;
    part?: number;       
    totalParts?: number; 
  }) => void;
}) {
  const authHeaders = getDevAuthUserHeaders();
  const accessToken = classroomStore.getState().accessToken;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...authHeaders,
  };

  const reportProgress = (loaded: number, total: number, part?: number, totalParts?: number) => {
    onProgress?.({
      loaded,
      total,
      percentage: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      ...(part != null ? { part, totalParts } : {}),
    });
  };

  if (file.size < MULTIPART_CHUNK_SIZE) {
    const presignRes = await fetch(`${API_BASE}/recordings/presigned-url`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' }),
    });

    const presignData = await presignRes.json().catch(() => ({}));
    if (!presignRes.ok) throw new Error(presignData.message || 'Failed to get upload URL');

    const { uploadUrl, objectKey, publicUrl } = presignData as any;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) reportProgress(e.loaded, e.total);
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          reportProgress(file.size, file.size);
          resolve();
        } else {
          reject(new Error(`R2 upload failed: HTTP ${xhr.status}`));
        }
      });
      xhr.addEventListener('error', () => reject(new Error('Network error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
      xhr.send(file);
    });

    const saveRes = await fetch(`${API_BASE}/recordings/save-recording`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ folderId, title, description, duration, objectKey, publicUrl }),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) throw new Error(saveData.message || 'Failed to save recording metadata');
    return saveData;
  }

  const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
  const initiateRes = await fetch(`${API_BASE}/recordings/multipart/initiate`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders,
    body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' }),
  });
  const initiateData = await initiateRes.json().catch(() => ({}));
  if (!initiateRes.ok) throw new Error(initiateData.message || 'Failed to initiate multipart upload');

  const { uploadId, objectKey, publicUrl } = initiateData as any;
  const parts: { ETag: string; PartNumber: number }[] = [];
  let uploadedBytes = 0;

  try {
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * MULTIPART_CHUNK_SIZE;
      const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const presignRes = await fetch(`${API_BASE}/recordings/multipart/presign-part`, {
        method: 'POST',
        credentials: 'include',
        headers: baseHeaders,
        body: JSON.stringify({ objectKey, uploadId, partNumber }),
      });
      const presignData = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) throw new Error(presignData.message || 'Failed to presign part');

      const etag = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignData.presignedUrl, true);
        let lastLoaded = 0;
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const diff = e.loaded - lastLoaded;
            lastLoaded = e.loaded;
            uploadedBytes += diff;
            reportProgress(uploadedBytes, file.size, partNumber, totalParts);
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const returnedEtag = xhr.getResponseHeader('ETag');
            if (returnedEtag) resolve(returnedEtag.replace(/"/g, ''));
            else resolve('');
          } else {
            reject(new Error(`Part ${partNumber} upload failed: HTTP ${xhr.status}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        xhr.send(chunk);
      });

      parts.push({ ETag: etag, PartNumber: partNumber });
    }

    const completeRes = await fetch(`${API_BASE}/recordings/multipart/complete`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ objectKey, uploadId, parts }),
    });
    const completeData = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) throw new Error(completeData.message || 'Failed to complete multipart upload');

    const saveRes = await fetch(`${API_BASE}/recordings/save-recording`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ folderId, title, description, duration, objectKey, publicUrl }),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) throw new Error(saveData.message || 'Failed to save recording metadata');
    return saveData;

  } catch (error) {
    await fetch(`${API_BASE}/recordings/multipart/abort`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ objectKey, uploadId }),
    }).catch(console.error);
    throw error;
  }
}

export async function getClassroomJoinStatus(classroomId: string, email: string) {
  return fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/join-status?email=${encodeURIComponent(email)}`);
}

export async function submitClassroomJoinRequest(classroomId: string, data: any) {
  return fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/join-request`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getClassroomJoinRequests(classroomId: string) {
  return fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/join-requests`);
}

export async function approveClassroomJoinRequest(classroomId: string, requestId: string) {
  return fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
  });
}

export async function rejectClassroomJoinRequest(classroomId: string, requestId: string) {
  return fetchJson(`/classrooms/${encodeURIComponent(classroomId)}/join-requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
  });
}
