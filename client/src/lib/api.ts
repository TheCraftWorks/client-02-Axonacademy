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

  // Pre-index metrics for O(1) student lookups
  const meetings = Array.isArray(raw.meetings) ? raw.meetings : [];
  const countableMeetings = meetings.filter((m: any) => ['live', 'ended'].includes(normalizeMeetingStatus(m.status)));
  const attendedCountMap = new Map<string, number>();
  countableMeetings.forEach((m: any) => {
    if (Array.isArray(m.attendees)) {
      const seenInThisMeeting = new Set<string>();
      m.attendees.forEach((a: any) => {
        const attendeeId = String(a.student?._id || a.student || a);
        if (attendeeId && !seenInThisMeeting.has(attendeeId) && (a.joinedAt || (a.duration ?? 0) > 0)) {
          seenInThisMeeting.add(attendeeId);
          attendedCountMap.set(attendeeId, (attendedCountMap.get(attendeeId) || 0) + 1);
        }
      });
    }
  });

  const recordings = Array.isArray(raw.recordings) ? raw.recordings : [];
  const publishedRecordings = recordings.filter((r: any) => r.isPublished);
  const recordingWatchedMap = new Map<string, number>();
  publishedRecordings.forEach((r: any) => {
    const duration = Number(r.duration || 0);
    if (duration > 0 && Array.isArray(r.viewStats)) {
      r.viewStats.forEach((v: any) => {
        const sId = String(v.student?._id || v.student || '');
        if (sId) {
          const pct = Math.min(100, Math.round(((v.totalWatchedSec || 0) / duration) * 100));
          recordingWatchedMap.set(sId, (recordingWatchedMap.get(sId) || 0) + pct);
        }
      });
    }
  });

  const quizzes = Array.isArray(raw.quizzes) ? raw.quizzes : [];
  const publishedQuizzes = quizzes.filter((q: any) => ['published', 'closed'].includes(q.status));
  const quizScoresMap = new Map<string, { totalPct: number; count: number; quizIds: Set<string> }>();
  publishedQuizzes.forEach((q: any) => {
    const qId = String(q._id || q.id || '');
    if (Array.isArray(q.attempts)) {
      q.attempts.forEach((a: any) => {
        if (a.status === 'submitted') {
          const sId = String(a.student?._id || a.student || '');
          if (sId) {
            let entry = quizScoresMap.get(sId);
            if (!entry) {
              entry = { totalPct: 0, count: 0, quizIds: new Set() };
              quizScoresMap.set(sId, entry);
            }
            entry.totalPct += (a.score?.percentage || 0);
            entry.count += 1;
            if (qId) entry.quizIds.add(qId);
          }
        }
      });
    }
  });

  const computeStudentMetrics = (studentId: string) => {
    const attendedCount = attendedCountMap.get(studentId) || 0;
    const attendance = countableMeetings.length
      ? Math.round((attendedCount / countableMeetings.length) * 100)
      : 0;

    const totalRecPct = recordingWatchedMap.get(studentId) || 0;
    const recordingProgress = publishedRecordings.length
      ? Math.round(totalRecPct / publishedRecordings.length)
      : 0;

    const quizEntry = quizScoresMap.get(studentId);
    const quizAvg = quizEntry && quizEntry.count > 0
      ? Math.round(quizEntry.totalPct / quizEntry.count)
      : 0;
    const quizProgress = publishedQuizzes.length && quizEntry
      ? Math.round((quizEntry.quizIds.size / publishedQuizzes.length) * 100)
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
          const studentObj = typeof s.student === 'object' && s.student !== null ? s.student : (typeof s === 'object' && s !== null ? s : {});
          const id = String(studentObj._id || studentObj.id || (typeof s.student === 'string' ? s.student : '') || s._id || s.id || `student-${Date.now()}`);
          const metrics = computeStudentMetrics(id);
          const studentName = studentObj.fullName || studentObj.name || (studentObj.email ? studentObj.email.split('@')[0] : '') || s.name || s.fullName || '';
          return {
            id,
            name: studentName || 'Student',
            email: studentObj.email || s.email || '',
            enrollmentId: s.enrollmentId || (id && id.length >= 4 && !id.startsWith('student-') ? `STU-${id.slice(-4).toUpperCase()}` : `STU-${Date.now().toString().slice(-4)}`),
            progress: typeof s.progress === 'number' ? s.progress : metrics.progress,
            attendance: typeof s.attendance === 'number' ? s.attendance : metrics.attendance,
            quizAvg: typeof s.quizAvg === 'number' ? s.quizAvg : metrics.quizAvg,
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
        roomId: m.roomId || m._id || m.id || '',
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
        title: q.title || '',
        instructions: q.instructions || '',
        duration: q.duration ?? null,
        maxAttempts: q.maxAttempts || 1,
        randomizeQuestions: q.randomizeQuestions ?? true,
        randomizeOptions: q.randomizeOptions ?? true,
        showLeaderboard: q.showLeaderboard ?? false,
        negativeMarking: q.negativeMarking ?? false,
        negativeMarkValue: q.negativeMarkValue ?? 0.25,
        passPercent: typeof q.passPercent === 'number' ? q.passPercent : 60,
        availableFrom: q.availableFrom || '',
        availableUntil: q.availableUntil || '',
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
            isCorrect: Boolean(o.isCorrect)
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
  invalidateClientClassroomCache();
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

export async function logoutUser() {
  invalidateClientClassroomCache();
  return fetchJson('/auth/logout', { method: 'POST' });
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

// User-aware, isolated client cache
const cachedClassroomsListMap = new Map<string, { data: any[]; timestamp: number }>();
const cachedClassroomDetails = new Map<string, { data: any; timestamp: number }>();
const CLIENT_CACHE_TTL = 30_000;

export function invalidateClientClassroomCache() {
  cachedClassroomsListMap.clear();
  cachedClassroomDetails.clear();
}

export function invalidateClassroomCacheById(classroomId: string) {
  if (!classroomId) return;
  for (const key of cachedClassroomDetails.keys()) {
    if (key.startsWith(`${classroomId}_`) || key.includes(classroomId)) {
      cachedClassroomDetails.delete(key);
    }
  }
  cachedClassroomsListMap.clear();
}

function getCacheUserKey(): string {
  const u = classroomStore.getState().currentUser;
  return u?.id || u?.userId || 'anonymous';
}

export async function getClassrooms(forceRefresh = false) {
  const userKey = `admin_${getCacheUserKey()}`;
  const cached = cachedClassroomsListMap.get(userKey);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < CLIENT_CACHE_TTL)) {
    return cached.data;
  }
  const payload = await fetchJson('/classrooms');
  const normalized = payload.classrooms.map(normalizeBackendClassroom);
  cachedClassroomsListMap.set(userKey, { data: normalized, timestamp: Date.now() });
  return normalized;
}

export async function getMyClassrooms(forceRefresh = false) {
  const userKey = `my_${getCacheUserKey()}`;
  const cached = cachedClassroomsListMap.get(userKey);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < CLIENT_CACHE_TTL)) {
    return cached.data;
  }
  const payload = await fetchJson('/classrooms/my');
  const normalized = payload.classrooms.map(normalizeBackendClassroom);
  cachedClassroomsListMap.set(userKey, { data: normalized, timestamp: Date.now() });
  return normalized;
}

export async function getClassroomById(id: string, forceRefresh = false) {
  const userKey = `${id}_${getCacheUserKey()}`;
  const cached = cachedClassroomDetails.get(userKey);
  if (!forceRefresh && cached && (Date.now() - cached.timestamp < CLIENT_CACHE_TTL)) {
    return cached.data;
  }
  const payload = await fetchJson(`/classrooms/${encodeURIComponent(id)}`);
  const normalized = normalizeBackendClassroom(payload.classroom);
  cachedClassroomDetails.set(userKey, { data: normalized, timestamp: Date.now() });
  return normalized;
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
    rank: att.rank || 1,
    studentId: String(att.student?._id || att.student || ''),
    studentName: att.studentName || att.student?.fullName || 'Student',
    studentEmail: att.studentEmail || att.student?.email || '',
    studentAvatar: att.studentAvatar || att.student?.avatar || '',
    attemptNo: att.attemptNo || 1,
    status: att.status || 'submitted',
    startedAt: att.startedAt,
    submittedAt: att.submittedAt,
    totalTimeTakenSec: att.totalTimeTakenSec || 0,
    correctCount: att.correctCount ?? 0,
    wrongCount: att.wrongCount ?? 0,
    unattemptedCount: att.unattemptedCount ?? 0,
    totalQuestions: att.totalQuestions ?? 0,
    answers: Array.isArray(att.answers) ? att.answers.map((ans: any) => ({
      questionId: String(ans.questionId),
      questionText: ans.questionText || '',
      marks: ans.marks || 1,
      selectedOptions: ans.selectedOptions || [],
      correctOptions: ans.correctOptions || [],
      isAttempted: ans.isAttempted !== undefined ? !!ans.isAttempted : (ans.selectedOptions && ans.selectedOptions.length > 0),
      isCorrect: !!ans.isCorrect,
      marksAwarded: ans.marksAwarded ?? 0,
      timeTakenSec: ans.timeTakenSec ?? 0,
      explanation: ans.explanation || '',
      options: Array.isArray(ans.options) ? ans.options.map((o: any) => ({
        label: o.label || '',
        text: o.text || '',
        isCorrect: !!o.isCorrect,
      })) : [],
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
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}/attempt/start`, {
    method: 'POST',
  });
  if (payload.alreadySubmitted) {
    return {
      alreadySubmitted: true,
      attemptId: String(payload.attemptId || ''),
      message: payload.message || 'You have already submitted this quiz.',
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

export interface QuizAttemptReviewResult {
  score: {
    rawMarks: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
  };
  submittedAt?: string;
  totalTimeTakenSec?: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  totalQuestions: number;
  rank?: number;
  totalParticipants?: number;
  answers: Array<{
    questionId: string;
    questionText: string;
    marks?: number;
    selectedOptions: string[];
    correctOptions: string[];
    isAttempted: boolean;
    isCorrect: boolean;
    marksAwarded: number;
    timeTakenSec?: number;
    explanation?: string;
    options: Array<{
      label: string;
      text: string;
      isCorrect: boolean;
    }>;
  }>;
}

export async function getQuizAttemptResult(quizId: string, attemptId?: string): Promise<QuizAttemptReviewResult> {
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
    totalTimeTakenSec: payload.totalTimeTakenSec || 0,
    correctCount: payload.correctCount ?? 0,
    wrongCount: payload.wrongCount ?? 0,
    unattemptedCount: payload.unattemptedCount ?? 0,
    totalQuestions: payload.totalQuestions ?? 0,
    rank: payload.rank,
    totalParticipants: payload.totalParticipants,
    answers: Array.isArray(payload.answers) ? payload.answers.map((ans: any) => ({
      questionId: String(ans.questionId),
      questionText: ans.questionText || '',
      marks: ans.marks || 1,
      selectedOptions: ans.selectedOptions || [],
      correctOptions: ans.correctOptions || [],
      isAttempted: ans.isAttempted !== undefined ? !!ans.isAttempted : (ans.selectedOptions && ans.selectedOptions.length > 0),
      isCorrect: !!ans.isCorrect,
      marksAwarded: ans.marksAwarded ?? 0,
      timeTakenSec: ans.timeTakenSec ?? 0,
      explanation: ans.explanation || '',
      options: Array.isArray(ans.options) ? ans.options.map((o: any) => ({
        label: o.label || '',
        text: o.text || '',
        isCorrect: !!o.isCorrect,
      })) : [],
    })) : [],
  };
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  email?: string;
  avatar?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  timeTakenSec: number;
  submittedAt?: string;
  attemptNo: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  totalQuestions: number;
}

export interface QuizLeaderboardResponse {
  quizTitle: string;
  totalQuestions: number;
  stats: {
    totalParticipants: number;
    averageScore: number;
    topScore: number;
    passRate: number;
  };
  top3: LeaderboardEntry[];
  leaderboard: LeaderboardEntry[];
  myRank: LeaderboardEntry | null;
}

export async function getQuizLeaderboard(quizId: string): Promise<QuizLeaderboardResponse> {
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}/leaderboard`);
  return {
    quizTitle: payload.quizTitle || '',
    totalQuestions: payload.totalQuestions || 0,
    stats: payload.stats || { totalParticipants: 0, averageScore: 0, topScore: 0, passRate: 0 },
    top3: Array.isArray(payload.top3) ? payload.top3 : [],
    leaderboard: Array.isArray(payload.leaderboard) ? payload.leaderboard : [],
    myRank: payload.myRank || null,
  };
}

export async function getQuizReport(quizId: string) {
  const payload = await fetchJson(`/quizzes/${encodeURIComponent(quizId)}/report`);
  return Array.isArray(payload.attempts) ? payload.attempts.map(normalizeBackendQuizAttempt) : [];
}

// ─── Chunk size for multipart uploads ────────────────────────────────────────
// 10 MB per part (well above Cloudflare R2's 5 MB minimum).
// Files < 20 MB use single presigned PUT with auto-retry.
// Files ≥ 20 MB use 10 MB multipart chunks with part-level auto-retry.
// 10 MB chunks give smooth, fast progress updates even on slow/mobile connections
// and allow quick retries if any single chunk drops.
const MULTIPART_CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
const SINGLE_UPLOAD_THRESHOLD = 20 * 1024 * 1024; // 20 MB in bytes

export interface VideoUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  part?: number;
  totalParts?: number;
  statusText?: string;
  isRetrying?: boolean;
}

/**
 * Upload one part of a multipart upload directly to R2 with auto-retry & watchdog.
 */
async function uploadPartToR2WithRetry({
  getPresignedUrl,
  chunk,
  partNumber,
  totalParts,
  onPartBytes,
  onStatusUpdate,
  maxRetries = 4,
}: {
  getPresignedUrl: () => Promise<string>;
  chunk: Blob;
  partNumber: number;
  totalParts: number;
  onPartBytes?: (loaded: number) => void;
  onStatusUpdate?: (status: string, isRetrying: boolean) => void;
  maxRetries?: number;
}): Promise<string> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 2), 6000);
        onStatusUpdate?.(
          `Connection hiccup. Retrying part ${partNumber}/${totalParts} (Attempt ${attempt}/${maxRetries})...`,
          true
        );
        await new Promise((r) => setTimeout(r, delay));
      }

      const presignedUrl = await getPresignedUrl();

      const etag = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let lastActivity = Date.now();
        let hasResolved = false;

        // Inactivity watchdog: abort if no bytes are transferred for 45s
        const watchdog = setInterval(() => {
          if (Date.now() - lastActivity > 45000) {
            clearInterval(watchdog);
            if (!hasResolved) {
              hasResolved = true;
              xhr.abort();
              reject(new Error(`Part ${partNumber} upload timed out (network stalled)`));
            }
          }
        }, 3000);

        xhr.open('PUT', presignedUrl, true);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.addEventListener('progress', (e) => {
          lastActivity = Date.now();
          if (e.lengthComputable && onPartBytes) {
            onPartBytes(e.loaded);
          }
        });

        xhr.addEventListener('load', () => {
          clearInterval(watchdog);
          if (hasResolved) return;
          hasResolved = true;

          if (xhr.status >= 200 && xhr.status < 300) {
            const rawEtag =
              xhr.getResponseHeader('ETag') ||
              xhr.getResponseHeader('etag') ||
              xhr.getResponseHeader('Etag') ||
              '';
            const etag = rawEtag.trim() || `"${Date.now()}-${partNumber}"`;
            resolve(etag);
          } else {
            reject(new Error(`Part ${partNumber} upload failed: HTTP ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          clearInterval(watchdog);
          if (hasResolved) return;
          hasResolved = true;
          reject(new Error(`Network error while uploading part ${partNumber}`));
        });

        xhr.addEventListener('abort', () => {
          clearInterval(watchdog);
          if (hasResolved) return;
          hasResolved = true;
          reject(new Error(`Upload aborted on part ${partNumber}`));
        });

        xhr.send(chunk);
      });

      return etag;
    } catch (err: any) {
      console.warn(`[Upload] Part ${partNumber} attempt ${attempt} failed:`, err.message);
      lastError = err;
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`Failed to upload part ${partNumber}`);
}

/**
 * Upload a small file (< 20MB) directly to R2 via single presigned PUT with auto-retry.
 */
async function uploadSingleFileToR2WithRetry({
  getPresignedUrl,
  file,
  contentType,
  onProgress,
  maxRetries = 3,
}: {
  getPresignedUrl: () => Promise<string>;
  file: File;
  contentType: string;
  onProgress?: (loaded: number, total: number) => void;
  maxRetries?: number;
}): Promise<void> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 2), 4000);
        await new Promise((r) => setTimeout(r, delay));
      }

      const uploadUrl = await getPresignedUrl();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let lastActivity = Date.now();
        let hasResolved = false;

        const watchdog = setInterval(() => {
          if (Date.now() - lastActivity > 45000) {
            clearInterval(watchdog);
            if (!hasResolved) {
              hasResolved = true;
              xhr.abort();
              reject(new Error('Upload timed out (network stalled)'));
            }
          }
        }, 3000);

        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', contentType);

        xhr.upload.addEventListener('progress', (e) => {
          lastActivity = Date.now();
          if (e.lengthComputable && onProgress) {
            onProgress(e.loaded, e.total);
          }
        });

        xhr.addEventListener('load', () => {
          clearInterval(watchdog);
          if (hasResolved) return;
          hasResolved = true;
          if (xhr.status >= 200 && xhr.status < 300) {
            if (onProgress) onProgress(file.size, file.size);
            resolve();
          } else {
            reject(new Error(`R2 upload failed: HTTP ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          clearInterval(watchdog);
          if (hasResolved) return;
          hasResolved = true;
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          clearInterval(watchdog);
          if (hasResolved) return;
          hasResolved = true;
          reject(new Error('Upload was cancelled'));
        });

        xhr.send(file);
      });

      return;
    } catch (err: any) {
      console.warn(`[Upload] Single PUT attempt ${attempt} failed:`, err.message);
      lastError = err;
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Upload failed after retries');
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
 * Upload a classroom recording to Cloudflare R2 with automatic retry & smooth chunking.
 *
 * Strategy:
 *   • File < 20 MB  → single presigned PUT with auto-retry
 *   • File ≥ 20 MB  → S3 multipart upload (10 MB chunks) with part-level auto-retry
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
  onProgress?: (progress: VideoUploadProgress) => void;
}) {
  const authHeaders = getDevAuthUserHeaders();
  const accessToken = classroomStore.getState().accessToken;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...authHeaders,
  };

  const reportProgress = (
    loaded: number,
    total: number,
    part?: number,
    totalParts?: number,
    statusText?: string,
    isRetrying?: boolean
  ) => {
    onProgress?.({
      loaded,
      total,
      percentage: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      ...(part != null ? { part, totalParts } : {}),
      statusText,
      isRetrying,
    });
  };

  const fileMB = (file.size / (1024 * 1024)).toFixed(1);
  const videoContentType = getNormalizedVideoContentType(file);

  // Immediately notify UI of the exact total size and starting state
  reportProgress(0, file.size, 1, 1, 'Initializing upload...');

  // ============================================================
  // PATH A — Single presigned PUT for small files (< 20 MB)
  // ============================================================
  if (file.size < SINGLE_UPLOAD_THRESHOLD) {
    console.log(`[Upload] PATH A — single PUT | ${file.name} | ${fileMB} MB`);

    const getPresignedUrl = async () => {
      const presignRes = await fetch(`${API_BASE}/recordings/classroom/presigned-url`, {
        method: 'POST',
        credentials: 'include',
        headers: baseHeaders,
        body: JSON.stringify({ classroom, filename: file.name, contentType: videoContentType }),
      });
      const presignData = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) {
        if (presignRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
        throw new Error(presignData.message || 'Failed to get upload URL');
      }
      return presignData;
    };

    const initialPresign = await getPresignedUrl();
    const { objectKey, publicUrl } = initialPresign;

    await uploadSingleFileToR2WithRetry({
      getPresignedUrl: async () => (await getPresignedUrl()).uploadUrl,
      file,
      contentType: videoContentType,
      onProgress: (loaded, total) => {
        reportProgress(loaded, total, 1, 1, 'Uploading to cloud...');
      },
    });

    reportProgress(file.size, file.size, 1, 1, 'Saving metadata...');

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

  // ============================================================
  // PATH B — Resilient Multipart Upload for files ≥ 20 MB (10 MB chunks)
  // ============================================================
  const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
  console.log(`[Upload] PATH B — multipart | ${file.name} | ${fileMB} MB | ${totalParts} parts × 10 MB`);

  reportProgress(0, file.size, 1, totalParts, `Initiating multipart upload (10 MB chunks)...`);

  const initiateRes = await fetch(`${API_BASE}/recordings/classroom/multipart/initiate`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders,
    body: JSON.stringify({ classroom, filename: file.name, contentType: videoContentType }),
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

  const partBytesLoaded = new Array<number>(totalParts).fill(0);
  const completedParts: { PartNumber: number; ETag: string }[] = [];

  try {
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * MULTIPART_CHUNK_SIZE;
      const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkMB = (chunk.size / 1024 / 1024).toFixed(1);

      reportProgress(
        partBytesLoaded.reduce((acc, b) => acc + b, 0),
        file.size,
        partNumber,
        totalParts,
        `Uploading part ${partNumber} of ${totalParts} (${chunkMB} MB)...`
      );

      const fetchPartPresignedUrl = async () => {
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
        return (partUrlData as { presignedUrl: string }).presignedUrl;
      };

      const etag = await uploadPartToR2WithRetry({
        getPresignedUrl: fetchPartPresignedUrl,
        chunk,
        partNumber,
        totalParts,
        onPartBytes: (loaded) => {
          partBytesLoaded[i] = loaded;
          const totalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
          reportProgress(
            totalLoaded,
            file.size,
            partNumber,
            totalParts,
            `Uploading part ${partNumber} of ${totalParts}...`
          );
        },
        onStatusUpdate: (statusText, isRetrying) => {
          const totalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
          reportProgress(totalLoaded, file.size, partNumber, totalParts, statusText, isRetrying);
        },
      });

      partBytesLoaded[i] = chunk.size;
      completedParts.push({ PartNumber: partNumber, ETag: etag });

      const currentTotalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
      reportProgress(
        currentTotalLoaded,
        file.size,
        partNumber,
        totalParts,
        `Part ${partNumber}/${totalParts} completed`
      );
    }
  } catch (uploadError) {
    fetch(`${API_BASE}/recordings/classroom/multipart/abort`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ objectKey, uploadId }),
    }).catch(() => {});

    throw uploadError;
  }

  reportProgress(file.size, file.size, totalParts, totalParts, 'Assembling video on cloud storage...');

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

  reportProgress(file.size, file.size, totalParts, totalParts, 'Saving recording metadata...');

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
  invalidateClientClassroomCache();
  const result = await fetchJson(`/classrooms/${encodeURIComponent(id)}/archive`, {
    method: 'PUT',
  });
  return normalizeBackendClassroom(result.classroom);
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
  invalidateClientClassroomCache();
  return fetchJson(`/recordings/classroom/${encodeURIComponent(recordingId)}/publish`, {
    method: 'PUT',
  });
}

export async function unpublishRecording(recordingId: string) {
  invalidateClientClassroomCache();
  return fetchJson(`/recordings/classroom/${encodeURIComponent(recordingId)}`, {
    method: 'PUT',
    body: JSON.stringify({ isPublished: false }),
  });
}

export async function deleteRecording(recordingId: string) {
  invalidateClientClassroomCache();
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
  invalidateClassroomCacheById(payload.targetClassroomId);
  return fetchJson('/recordings/classroom/reuse', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createClassroomFolder(classroomId: string, name: string, description?: string) {
  invalidateClassroomCacheById(classroomId);
  return fetchJson('/recordings/classroom/folders', {
    method: 'POST',
    body: JSON.stringify({ classroomId, name, description }),
  });
}

export async function updateClassroomFolder(folderId: string, name: string, description?: string) {
  invalidateClientClassroomCache();
  return fetchJson(`/recordings/classroom/folders/${encodeURIComponent(folderId)}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export async function deleteClassroomFolder(folderId: string) {
  invalidateClientClassroomCache();
  return fetchJson(`/recordings/classroom/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  });
}

export async function getClassroomReuseList() {
  return fetchJson('/recordings/classroom/reuse-list');
}

export async function reuseClassroomFolder(sourceFolderId: string, targetClassroomId: string, selectedRecordingIds?: string[]) {
  invalidateClassroomCacheById(targetClassroomId);
  return fetchJson('/recordings/classroom/reuse-folder', {
    method: 'POST',
    body: JSON.stringify({ sourceFolderId, targetClassroomId, selectedRecordingIds }),
  });
}

export async function getDetailedProgress(classroomId: string) {
  const payload = await fetchJson(`/enrollments/classroom/${encodeURIComponent(classroomId)}/progress`);
  return payload.stats;
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


function getNormalizedVideoContentType(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith('.mov') || name.endsWith('.qt') || file.type === 'video/quicktime' || !file.type) {
    return 'video/mp4';
  }
  return file.type;
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
  onProgress?: (progress: VideoUploadProgress) => void;
}) {
  const authHeaders = getDevAuthUserHeaders();
  const accessToken = classroomStore.getState().accessToken;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...authHeaders,
  };

  const videoContentType = getNormalizedVideoContentType(file);

  const reportProgress = (
    loaded: number,
    total: number,
    part?: number,
    totalParts?: number,
    statusText?: string,
    isRetrying?: boolean
  ) => {
    onProgress?.({
      loaded,
      total,
      percentage: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      ...(part != null ? { part, totalParts } : {}),
      statusText,
      isRetrying,
    });
  };

  const fileMB = (file.size / (1024 * 1024)).toFixed(1);

  // Immediately notify UI of the exact total size and starting state
  reportProgress(0, file.size, 1, 1, 'Initializing upload...');

  if (file.size < SINGLE_UPLOAD_THRESHOLD) {
    console.log(`[Upload Library] PATH A — single PUT | ${file.name} | ${fileMB} MB`);

    const getPresignedUrl = async () => {
      const presignRes = await fetch(`${API_BASE}/recordings/presigned-url`, {
        method: 'POST',
        credentials: 'include',
        headers: baseHeaders,
        body: JSON.stringify({ filename: file.name, contentType: videoContentType }),
      });
      const presignData = await presignRes.json().catch(() => ({}));
      if (!presignRes.ok) {
        if (presignRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
        throw new Error(presignData.message || 'Failed to get upload URL');
      }
      return presignData;
    };

    const initialPresign = await getPresignedUrl();
    const { objectKey, publicUrl } = initialPresign;

    await uploadSingleFileToR2WithRetry({
      getPresignedUrl: async () => (await getPresignedUrl()).uploadUrl,
      file,
      contentType: videoContentType,
      onProgress: (loaded, total) => {
        reportProgress(loaded, total, 1, 1, 'Uploading to cloud...');
      },
    });

    reportProgress(file.size, file.size, 1, 1, 'Saving metadata...');

    const saveRes = await fetch(`${API_BASE}/recordings/save-recording`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ folderId, title, description, duration, objectKey, publicUrl }),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) {
      if (saveRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
      throw new Error(saveData.message || 'Failed to save recording metadata');
    }
    return saveData;
  }

  const totalParts = Math.ceil(file.size / MULTIPART_CHUNK_SIZE);
  console.log(`[Upload Library] PATH B — multipart | ${file.name} | ${fileMB} MB | ${totalParts} parts × 10 MB`);

  reportProgress(0, file.size, 1, totalParts, `Initiating multipart upload (10 MB chunks)...`);

  const initiateRes = await fetch(`${API_BASE}/recordings/multipart/initiate`, {
    method: 'POST',
    credentials: 'include',
    headers: baseHeaders,
    body: JSON.stringify({ filename: file.name, contentType: videoContentType }),
  });
  const initiateData = await initiateRes.json().catch(() => ({}));
  if (!initiateRes.ok) {
    if (initiateRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
    throw new Error(initiateData.message || 'Failed to initiate multipart upload');
  }

  const { uploadId, objectKey, publicUrl } = initiateData as any;
  const completedParts: { PartNumber: number; ETag: string }[] = [];
  const partBytesLoaded = new Array<number>(totalParts).fill(0);

  try {
    for (let i = 0; i < totalParts; i++) {
      const partNumber = i + 1;
      const start = i * MULTIPART_CHUNK_SIZE;
      const end = Math.min(start + MULTIPART_CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);
      const chunkMB = (chunk.size / 1024 / 1024).toFixed(1);

      reportProgress(
        partBytesLoaded.reduce((acc, b) => acc + b, 0),
        file.size,
        partNumber,
        totalParts,
        `Uploading part ${partNumber} of ${totalParts} (${chunkMB} MB)...`
      );

      const fetchPartPresignedUrl = async () => {
        const presignRes = await fetch(`${API_BASE}/recordings/multipart/presign-part`, {
          method: 'POST',
          credentials: 'include',
          headers: baseHeaders,
          body: JSON.stringify({ objectKey, uploadId, partNumber }),
        });
        const presignData = await presignRes.json().catch(() => ({}));
        if (!presignRes.ok) {
          if (presignRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
          throw new Error(presignData.message || `Failed to presign part ${partNumber}`);
        }
        return (presignData as { presignedUrl: string }).presignedUrl;
      };

      const etag = await uploadPartToR2WithRetry({
        getPresignedUrl: fetchPartPresignedUrl,
        chunk,
        partNumber,
        totalParts,
        onPartBytes: (loaded) => {
          partBytesLoaded[i] = loaded;
          const totalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
          reportProgress(
            totalLoaded,
            file.size,
            partNumber,
            totalParts,
            `Uploading part ${partNumber} of ${totalParts}...`
          );
        },
        onStatusUpdate: (statusText, isRetrying) => {
          const totalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
          reportProgress(totalLoaded, file.size, partNumber, totalParts, statusText, isRetrying);
        },
      });

      partBytesLoaded[i] = chunk.size;
      completedParts.push({ PartNumber: partNumber, ETag: etag });

      const currentTotalLoaded = partBytesLoaded.reduce((acc, b) => acc + b, 0);
      reportProgress(
        currentTotalLoaded,
        file.size,
        partNumber,
        totalParts,
        `Part ${partNumber}/${totalParts} completed`
      );
    }

    reportProgress(file.size, file.size, totalParts, totalParts, 'Assembling video on cloud storage...');

    const completeRes = await fetch(`${API_BASE}/recordings/multipart/complete`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ objectKey, uploadId, parts: completedParts }),
    });
    const completeData = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) {
      if (completeRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
      throw new Error(completeData.message || 'Failed to complete multipart upload');
    }

    reportProgress(file.size, file.size, totalParts, totalParts, 'Saving recording metadata...');

    const saveRes = await fetch(`${API_BASE}/recordings/save-recording`, {
      method: 'POST',
      credentials: 'include',
      headers: baseHeaders,
      body: JSON.stringify({ folderId, title, description, duration, objectKey, publicUrl }),
    });
    const saveData = await saveRes.json().catch(() => ({}));
    if (!saveRes.ok) {
      if (saveRes.status === 401) classroomStore.setState(() => ({ currentUser: null }));
      throw new Error(saveData.message || 'Failed to save recording metadata');
    }
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

export async function getAppVersion() {
  return fetchJson('/public/app-version');
}
