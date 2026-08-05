import { useSyncExternalStore } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
// Session is fully server-managed: MongoDB Session collection + HttpOnly cookies.
// currentUser lives only in memory and is rehydrated on boot via GET /auth/me.

export interface User {
  id: string;
  userId:string;
  name: string;
  email: string;
  role: "student" | "admin" | "faculty" | "superadmin" | "accounts" | "receptionist";
  password?: string;
  phone?: string;
  address?: string;
  avatar?: string;
}

export interface Course {
  id: string;
  title: string;
  category: string;
  description?: string;
  price: number;
  status: "published" | "draft" | "archived";
  updatedAt: string;
}

export interface Option {
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  type: "mcq" | "msq" | "true_false";
  text: string;
  marks: number;
  explanation: string;
  options: Option[];
  order: number;
}

export interface Answer {
  questionId: string;
  selectedOptions: string[];
  isCorrect: boolean;
  marksAwarded: number;
}

export interface QuizAttempt {
  id: string;
  studentId: string;
  studentName: string;
  attemptNo: number;
  status: "in_progress" | "submitted";
  startedAt: string;
  submittedAt?: string;
  totalTimeTakenSec?: number;
  answers: Answer[];
  score: {
    rawMarks: number;
    totalMarks: number;
    percentage: number;
    passed: boolean;
  };
}

export interface Quiz {
  id: string;
  title: string;
  instructions: string;
  duration: number | null;
  maxAttempts: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  showLeaderboard: boolean;
  negativeMarking: boolean;
  negativeMarkValue: number;
  passPercent: number;
  availableFrom: string;
  availableUntil: string;
  status: "draft" | "published" | "closed";
  questions: Question[];
  attempts: QuizAttempt[];
}

export interface Chapter {
  id: string;
  title: string;
  startTimeSec: number;
}

export interface ViewStat {
  studentId: string;
  studentName: string;
  watchedPercent: number;
  totalWatchedSec?: number;
  lastPosition: number;
}

export interface Recording {
  id: string;
  title: string;
  description: string;
  duration: number;
  isPublished: boolean;
  storageProvider?: 'mux' | 'cloudflare';
  cloudflareUrl?: string;
  cloudflareKey?: string;
  chapters: Chapter[];
  viewStats: ViewStat[];
  uploadedAt: string;
  folder?: string | null;
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "live" | "ended" | "cancelled";
  attendees: string[];
  roomId: string;
  webexLink?: string;
  webexPassword?: string;
}

export interface Announcement {
  attachments: any;
  id: string;
  content: string;
  createdAt: string;
  author: string;
}

export interface EnrolledStudent {
  id: string;
  name: string;
  email: string;
  enrollmentId: string;
  progress: number;
  attendance: number;
  quizAvg: number;
  status: "active" | "held" | "removed" | "placed" | "at risk";
  addedAt: string;
  certificateUrl?: string;
}

export interface ClassroomFolder {
  id: string;
  name: string;
  description: string;
  classroomId: string;
  createdBy: string;
}

export interface Classroom {
  id: string;
  name: string;
  description: string;
  code: string;
  status: "active" | "archived" | "draft";
  maxStudents: number;
  program: string;
  programId?: string;
  certificateUrl?: string;
  createdAt: string;
  students: EnrolledStudent[];
  announcements: Announcement[];
  meetings: Meeting[];
  recordings: Recording[];
  folders: ClassroomFolder[];
  quizzes: Quiz[];
  pendingJoinRequestsCount?: number;
  instructors?: { id: string; name: string }[];
}

// ─── Messaging Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface Thread {
  id: string;
  participantIds: string[]; // [studentId, "admin-01"] or [studentId, classroomId]
  participantNames: string[];
  type: "direct" | "announcement";
  messages: ChatMessage[];
  lastUpdated: string;
}

// ─── Payment Types ────────────────────────────────────────────────────────────

export type PaymentStatus = "Paid" | "Pending" | "Overdue";

export interface Payment {
  studentId: string;
  classroomId: string;
  status: PaymentStatus;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
const in1h = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();

const INITIAL_USERS: User[] = [
  { id: "Ajay", userId: "Ajay", name: "Ajay Kumar", email: "navin.procols@gmail.com", role: "student", password: "1111", phone: "+91 98700 11110" },
  {
    id: "admin", userId: "admin", name: "Admin", email: "axonmedacademy2@gmail.com", role: "admin", password: "axon@admin",
    
  },
];

const INITIAL_COURSES: Course[] = [
  { id: "crs-01", title: "Staff Nursing Diploma", category: "Diploma", description: "Comprehensive nursing diploma covering patient care, medication administration, and clinical skills.", price: 22500, status: "published", updatedAt: "2026-03-04T08:00:00Z" },
  { id: "crs-02", title: "OT Technician Pro", category: "Certificate", description: "Operation theatre technician certification with hands-on surgical training.", price: 18000, status: "published", updatedAt: "2026-02-28T08:00:00Z" },
  { id: "crs-03", title: "Lab Technician", category: "Certificate", description: "Clinical laboratory technology and diagnostic procedures.", price: 16500, status: "published", updatedAt: "2026-02-26T08:00:00Z" },
  { id: "crs-04", title: "ICU Critical Care", category: "Advanced", description: "Advanced critical care nursing covering ventilator management, haemodynamics, and ICU protocols.", price: 24000, status: "published", updatedAt: "2026-02-20T08:00:00Z" },
  { id: "crs-05", title: "Radiology Basics", category: "Certificate", description: "Introduction to radiological techniques and imaging interpretation.", price: 19500, status: "draft", updatedAt: "2026-02-12T08:00:00Z" },
  { id: "crs-06", title: "Trauma Response", category: "Workshop", description: "Emergency trauma response and pre-hospital care workshop.", price: 9500, status: "draft", updatedAt: "2026-03-06T08:00:00Z" }
];

const INITIAL_CLASSROOMS: Classroom[] = [];

const INITIAL_THREADS: Thread[] = [
  {
    id: "thread-001",
    participantIds: ["Ajay", "admin-01"],
    participantNames: ["Ajay Kumar", "Admin"],
    type: "direct",
    lastUpdated: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    messages: [
      { id: "msg-001", senderId: "admin-01", senderName: "Admin", text: "Hi Ajay! Great work on the Module 1 assessment — 100% score! 🎉", createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), read: true },
      { id: "msg-002", senderId: "Ajay", senderName: "Ajay Kumar", text: "Thank you! The questions were very clear. Looking forward to Module 2.", createdAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(), read: true },
      { id: "msg-003", senderId: "admin-01", senderName: "Admin", text: "Module 2 recording (Ventilators) is now published. Please complete it before the next live class.", createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), read: false },
    ],
  },
  {
    id: "thread-002",
    participantIds: ["Navin", "admin-01"],
    participantNames: ["Navin Raj", "Admin"],
    type: "direct",
    lastUpdated: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    messages: [
      { id: "msg-004", senderId: "admin-01", senderName: "Admin", text: "Hi Navin! Please complete the Patient Assessment recording before June 5th practical.", createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), read: true },
      { id: "msg-005", senderId: "Navin", senderName: "Navin Raj", text: "Understood. I'll complete it by June 3rd. Should I attempt the quiz as well?", createdAt: new Date(now.getTime() - 3.5 * 60 * 60 * 1000).toISOString(), read: true },
      { id: "msg-006", senderId: "admin-01", senderName: "Admin", text: "Yes please! The quiz is now open. Good luck!", createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(), read: false },
    ],
  },
];

const INITIAL_PAYMENTS: Payment[] = [
  { studentId: "Ajay", classroomId: "cls-001", status: "Paid" },
  { studentId: "Navin", classroomId: "cls-002", status: "Paid" },
];

// ─── Store Implementation ─────────────────────────────────────────────────────

type Listener = () => void;

interface StoreState {
  classrooms: Classroom[];
  users: User[];
  courses: Course[];
  currentUser: User | null;
  accessToken: string | null;
  threads: Thread[];
  payments: Payment[];
}

function createStore(initial: StoreState) {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (updater: (s: StoreState) => Partial<StoreState>) => {
      const patch = updater(state);
      // No localStorage persistence — session lives in MongoDB + HttpOnly cookies.
      // currentUser is in-memory only; rehydrated on boot via GET /auth/me.
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const classroomStore = createStore({
  classrooms: INITIAL_CLASSROOMS,
  users: INITIAL_USERS,
  courses: INITIAL_COURSES,
  currentUser: null, // always null at boot; __root.tsx rehydrates via GET /auth/me (cookie)
  accessToken: null,
  threads: INITIAL_THREADS,
  payments: INITIAL_PAYMENTS,
});

// ─── React Hook ───────────────────────────────────────────────────────────────

export function useClassroomStore() {
  return useSyncExternalStore(
    classroomStore.subscribe,
    classroomStore.getState,
    classroomStore.getState,
  );
}

// ─── Per-classroom Fetch Cache ────────────────────────────────────────────────
// Tracks the last time each classroom was fetched from the backend.
// Both student and admin routes use this to implement Stale-While-Revalidate.

const STALE_MS = 60_000; // 60 seconds

/** Map of classroomId → epoch ms of last successful fetch */
export const classroomFetchCache = new Map<string, number>();

/** Returns true if we should re-fetch the classroom from the API */
export function isClassroomStale(id: string): boolean {
  const last = classroomFetchCache.get(id);
  if (last === undefined) return true;
  return Date.now() - last > STALE_MS;
}

/** Call after a successful fetch to mark the classroom as fresh */
export function markClassroomFresh(id: string) {
  classroomFetchCache.set(id, Date.now());
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export const authActions = {
  login: (id: string, pass: string) => {
    const s = classroomStore.getState();
    const u = s.users.find(x => x.id.toLowerCase() === id.toLowerCase() && x.password === pass);
    if (u) {
      classroomStore.setState(() => ({ currentUser: u }));
      return true;
    }
    return false;
  },
  logout: () => {
    classroomStore.setState(() => ({ currentUser: null }));
  }
};

export const adminActions = {

  // Users
  createUser: (u: Omit<User, "id">) => {
    const newUser = { ...u, id: `user-${Date.now()}` };
    classroomStore.setState((s) => ({ users: [...s.users, newUser] }));
    return newUser;
  },

  updateUser: (id: string, updates: Partial<User>) => {
    classroomStore.setState((s) => ({
      users: s.users.map(u => u.id === id ? { ...u, ...updates } : u),
      currentUser: s.currentUser?.id === id ? { ...s.currentUser, ...updates } : s.currentUser,
    }));
  },

  // Courses
  createCourse: (c: Omit<Course, "id" | "updatedAt">) => {
    const nc: Course = { ...c, id: `crs-${Date.now()}`, updatedAt: new Date().toISOString() };
    classroomStore.setState((s) => ({ courses: [...s.courses, nc] }));
    return nc;
  },

  updateCourse: (id: string, updates: Partial<Omit<Course, "id">>) => {
    classroomStore.setState((s) => ({
      courses: s.courses.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c)
    }));
  },

  deleteCourse: (id: string) => {
    classroomStore.setState((s) => ({
      courses: s.courses.filter(c => c.id !== id)
    }));
  },

  updateCourseStatus: (id: string, status: Course["status"]) => {
    classroomStore.setState((s) => ({ courses: s.courses.map(c => c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c) }));
  },

  // Payments
  updatePaymentStatus: (studentId: string, classroomId: string, status: PaymentStatus) => {
    classroomStore.setState((s) => {
      const existing = s.payments.find(p => p.studentId === studentId && p.classroomId === classroomId);
      if (existing) {
        return { payments: s.payments.map(p => p.studentId === studentId && p.classroomId === classroomId ? { ...p, status } : p) };
      }
      return { payments: [...s.payments, { studentId, classroomId, status }] };
    });
  },
};

export const classroomActions = {
  // Classroom CRUD
  createClassroom: (c: Omit<Classroom, "id" | "students" | "announcements" | "meetings" | "recordings" | "quizzes" | "createdAt">) => {
    const newCls: Classroom = {
      ...c,
      id: `cls-${Date.now()}`,
      students: [],
      announcements: [],
      meetings: [],
      recordings: [],
      quizzes: [],
      createdAt: new Date().toISOString(),
    };
    classroomStore.setState((s) => ({ classrooms: [...s.classrooms, newCls] }));
    return newCls;
  },
  addClassroom: (c: Classroom) => {
    classroomStore.setState((s) => ({ classrooms: [...s.classrooms, c] }));
  },
  setClassrooms: (classrooms: Classroom[]) => {
    classroomStore.setState(() => ({ classrooms }));
  },

  updateClassroom: (id: string, updates: Partial<Classroom>) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  },

  archiveClassroom: (id: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) => (c.id === id ? { ...c, status: "archived" } : c)),
    }));
  },

  // Announcements
  addAnnouncement: (classroomId: string, content: string) => {
    const ann: Announcement = {
      id: `ann-${Date.now()}`, content, createdAt: new Date().toISOString(), author: "Admin",
      attachments: undefined
    };
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, announcements: [ann, ...c.announcements] } : c,
      ),
    }));
  },

  deleteAnnouncement: (classroomId: string, annId: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, announcements: c.announcements.filter((a) => a.id !== annId) } : c,
      ),
    }));
  },

  // Meetings
  addMeeting: (classroomId: string, m: Omit<Meeting, "id" | "attendees"> & { roomId?: string; status?: Meeting["status"]; attendees?: string[]; id?: string }) => {
    const meeting: Meeting = {
      ...m,
      id: m.id ?? `meet-${Date.now()}`,
      roomId: m.roomId ?? `room-${Date.now()}`,
      status: m.status ?? "scheduled",
      attendees: m.attendees ?? []
    };
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, meetings: [...c.meetings, meeting] } : c,
      ),
    }));
    return meeting;
  },

  startMeeting: (classroomId: string, meetingId: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? { ...c, meetings: c.meetings.map((m) => (m.id === meetingId ? { ...m, status: "live" as const } : m)) }
          : c,
      ),
    }));
  },

  endMeeting: (classroomId: string, meetingId: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? { ...c, meetings: c.meetings.map((m) => (m.id === meetingId ? { ...m, status: "ended" as const } : m)) }
          : c,
      ),
    }));
  },

  deleteMeeting: (classroomId: string, meetingId: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, meetings: c.meetings.filter((m) => m.id !== meetingId) } : c,
      ),
    }));
  },

  // Recordings
  addRecording: (classroomId: string, r: Omit<Recording, "viewStats" | "uploadedAt"> & Partial<Pick<Recording, "id">>) => {
    const rec: Recording = {
      ...r,
      id: 'id' in r && r.id ? r.id : `rec-${Date.now()}`,
      viewStats: [],
      uploadedAt: new Date().toISOString(),
    };
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, recordings: [...c.recordings, rec] } : c,
      ),
    }));
    return rec;
  },

  publishRecording: (classroomId: string, recordingId: string, publish: boolean) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? { ...c, recordings: c.recordings.map((r) => (r.id === recordingId ? { ...r, isPublished: publish } : r)) }
          : c,
      ),
    }));
  },

  deleteRecording: (classroomId: string, recordingId: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, recordings: c.recordings.filter((r) => r.id !== recordingId) } : c,
      ),
    }));
  },

  updateViewStat: (classroomId: string, recordingId: string, studentId: string, studentName: string, watchedPercent: number, lastPosition: number) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? {
              ...c,
              recordings: c.recordings.map((r) => {
                if (r.id !== recordingId) return r;
                const existing = r.viewStats.find(v => v.studentId === studentId);
                const updatedStats = existing
                  ? r.viewStats.map(v => v.studentId === studentId ? { ...v, watchedPercent, lastPosition } : v)
                  : [...r.viewStats, { studentId, studentName, watchedPercent, lastPosition }];
                return { ...r, viewStats: updatedStats };
              }),
            }
          : c,
      ),
    }));
  },

  // Quizzes
  addQuiz: (classroomId: string, q: Omit<Quiz, "id" | "attempts"> & Partial<Pick<Quiz, "id" | "attempts">>) => {
    const quiz: Quiz = { ...q, id: q.id ?? `quiz-${Date.now()}`, attempts: q.attempts ?? [] };
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, quizzes: [...c.quizzes, quiz] } : c,
      ),
    }));
    return quiz;
  },

  updateQuizStatus: (classroomId: string, quizId: string, status: Quiz["status"]) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? { ...c, quizzes: c.quizzes.map((q) => (q.id === quizId ? { ...q, status } : q)) }
          : c,
      ),
    }));
  },

  updateQuiz: (classroomId: string, quizId: string, updates: Partial<Quiz>) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? {
              ...c,
              quizzes: c.quizzes.map((q) => (q.id === quizId ? { ...q, ...updates } : q)),
            }
          : c,
      ),
    }));
  },

  deleteQuiz: (classroomId: string, quizId: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, quizzes: c.quizzes.filter((q) => q.id !== quizId) } : c,
      ),
    }));
  },

  // Quiz Attempts (student submits)
  submitQuizAttempt: (classroomId: string, quizId: string, attempt: Omit<QuizAttempt, "id">) => {
    const att: QuizAttempt = { ...attempt, id: `att-${Date.now()}` };
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? { ...c, quizzes: c.quizzes.map((q) => (q.id === quizId ? { ...q, attempts: [...q.attempts, att] } : q)) }
          : c,
      ),
    }));
    return att;
  },

  // Students
  addStudent: (classroomId: string, student: EnrolledStudent) => {
    classroomStore.setState((s) => {
      const cls = s.classrooms.find(c => c.id === classroomId);
      if (cls?.students.some(st => st.id === student.id)) return s;
      return {
        classrooms: s.classrooms.map((c) =>
          c.id === classroomId ? { ...c, students: [...c.students, student] } : c,
        ),
      };
    });
  },

  updateStudentStatus: (classroomId: string, studentId: string, status: EnrolledStudent["status"]) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId
          ? { ...c, students: c.students.map((st) => (st.id === studentId ? { ...st, status } : st)) }
          : c,
      ),
    }));
  },

  removeStudent: (classroomId: string, studentId: string) => {
    classroomStore.setState((s) => ({
      classrooms: s.classrooms.map((c) =>
        c.id === classroomId ? { ...c, students: c.students.filter(st => st.id !== studentId) } : c,
      ),
    }));
  },
};

// ─── Message Actions ──────────────────────────────────────────────────────────

export const messageActions = {
  sendMessage: (threadId: string, senderId: string, senderName: string, text: string) => {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId,
      senderName,
      text,
      createdAt: new Date().toISOString(),
      read: false,
    };
    classroomStore.setState((s) => ({
      threads: s.threads.map(t =>
        t.id === threadId
          ? { ...t, messages: [...t.messages, msg], lastUpdated: msg.createdAt }
          : t
      ),
    }));
  },

  createThread: (studentId: string, studentName: string) => {
    const s = classroomStore.getState();
    const exists = s.threads.find(t => t.participantIds.includes(studentId) && t.participantIds.includes("admin-01") && t.type === "direct");
    if (exists) return exists;
    const thread: Thread = {
      id: `thread-${Date.now()}`,
      participantIds: [studentId, "admin-01"],
      participantNames: [studentName, "Admin"],
      type: "direct",
      messages: [],
      lastUpdated: new Date().toISOString(),
    };
    classroomStore.setState((s) => ({ threads: [...s.threads, thread] }));
    return thread;
  },

  markRead: (threadId: string, userId: string) => {
    classroomStore.setState((s) => ({
      threads: s.threads.map(t =>
        t.id === threadId
          ? { ...t, messages: t.messages.map(m => m.senderId !== userId ? { ...m, read: true } : m) }
          : t
      ),
    }));
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function uid(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getExamType(questions: Question[]): string {
  const types = new Set(questions.map(q => q.type));
  if (types.size === 1) {
    if (types.has("mcq")) return "MCQ";
    if (types.has("msq")) return "MSQ";
    if (types.has("true_false")) return "True/False";
  }
  return "Mixed";
}

export function getGrade(percent: number): string {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B+";
  if (percent >= 60) return "B";
  if (percent >= 50) return "C";
  return "F";
}

export function computeCertificates(classrooms: Classroom[], userId: string) {
  const certs: { classroomId: string; classroomName: string; program: string; earnedAt: string; certificateUrl?: string }[] = [];
  const enrolledClassrooms = classrooms.filter(c => c.students.some(s => s.id === userId && s.status === "active"));
  for (const cls of enrolledClassrooms) {
    const studentRecord = cls.students.find(s => s.id === userId);
    const certUrl = studentRecord?.certificateUrl || cls.certificateUrl;

    // Only skip if there are published quizzes AND student hasn't passed them AND no certificate URL
    const publishedQuizzes = cls.quizzes.filter(q => q.status === "published");
    if (publishedQuizzes.length > 0 && !certUrl) {
      const allPassed = publishedQuizzes.every(q =>
        q.attempts.some(a => a.studentId === userId && a.status === "submitted" && a.score.passed)
      );
      if (!allPassed) continue;
    }

    const lastAttempt = publishedQuizzes
      .flatMap(q => q.attempts.filter(a => a.studentId === userId && a.score.passed))
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())[0];

    certs.push({
      classroomId: cls.id,
      classroomName: cls.name,
      program: cls.program,
      earnedAt: lastAttempt?.submittedAt || cls.createdAt,
      certificateUrl: certUrl,
    });
  }
  return certs;
}
