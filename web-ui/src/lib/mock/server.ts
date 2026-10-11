import { ApiError, type HealthSnapshot, type Role, type Section, type SeatRequest, type User } from '../types';
import { missingPrerequisites } from '../dag';
import { socket } from '../realtime';
import { COMPLETED_BY_STUDENT, COURSES, DEMO_PASSWORD, SECTIONS, SEED_REQUESTS, USERS } from './data';

/**
 * In-memory stand-in for the Node/Express + PostgreSQL backend.
 * JS is single-threaded, so "check seats then decrement" is atomic here, which mirrors what the real
 * backend does with SELECT ... FOR UPDATE inside one transaction.
 *
 * Seeded with North South University sample data. Data resets when the page is reloaded.
 */

const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms + Math.random() * 80));

const state = {
  courses: structuredClone(COURSES),
  sections: structuredClone(SECTIONS),
  completed: structuredClone(COMPLETED_BY_STUDENT['2412000001']),
  requests: structuredClone(SEED_REQUESTS),
};
const waiting: Record<string, number> = {};
const shortCourses = new Set<string>();
let rushTimer: ReturnType<typeof setInterval> | null = null;
let seq = 100;

const snapshot = () => structuredClone(state);

const find = (id: string) => {
  const s = state.sections.find((x) => x.id === id);
  if (!s) throw new ApiError('NOT_FOUND', 'Section not found.');
  return s;
};

function emitSeat(s: Section) {
  socket.emit({ type: 'seat', sectionId: s.id, seats: s.seats, capacity: s.capacity });
}

function refreshShortage(courseCode: string) {
  const all = state.sections.filter((s) => s.courseCode === courseCode);
  const isShort = all.length > 0 && all.every((s) => s.seats === 0);
  if (isShort) {
    shortCourses.add(courseCode);
    socket.emit({ type: 'shortage', courseCode, waiting: waiting[courseCode] ?? 0 });
  } else if (shortCourses.delete(courseCode)) {
    socket.emit({ type: 'shortage-cleared', courseCode });
  }
}

export const mockApi = {
  /**
   * DEV ONLY. Demo accounts need the demo password. Any other @northsouth.edu address is accepted
   * with any non-empty password, and the role is picked on the login screen. Real
   * credential checking happens on the backend (see lib/api.ts).
   */
  async login(email: string, password: string, role: Role = 'student'): Promise<User> {
    await wait();
    const mail = email.trim().toLowerCase();
    const demo = USERS.find((u) => u.email === mail);
    if (demo) {
      if (password !== DEMO_PASSWORD) throw new ApiError('AUTH_FAILED', 'Email or password is incorrect.');
      return demo;
    }
    if (!/^[^\s@]+@northsouth\.edu$/.test(mail)) {
      throw new ApiError('AUTH_FAILED', 'Use your @northsouth.edu email address.');
    }
    if (password.length === 0) throw new ApiError('AUTH_FAILED', 'Enter your password.');
    const local = mail.split('@')[0];
    const name = local.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || 'User';
    // Custom faculty borrow the demo faculty id so they see sections and requests in the mock.
    const id = role === 'faculty' ? 'fac-1' : role === 'admin' ? 'adm-1' : local;
    return { id, name, email: mail, role };
  },

  async getCourses() {
    await wait(60);
    return snapshot().courses;
  },

  async getSections() {
    await wait(80);
    return snapshot().sections;
  },

  async getCompleted(_studentId: string) {
    await wait(40);
    return [...state.completed];
  },

  async getRequests() {
    await wait(80);
    return snapshot().requests;
  },

  async getShortages(): Promise<Record<string, number>> {
    await wait(40);
    return Object.fromEntries([...shortCourses].map((c) => [c, waiting[c] ?? 0]));
  },

  // ---- Advising ----

  async submitRequest(input: { studentId: string; studentName: string; sectionId: string; overrideReason?: string }) {
    await wait();
    const section = find(input.sectionId);
    const course = state.courses.find((c) => c.code === section.courseCode)!;

    const dup = state.requests.find(
      (r) => r.studentId === input.studentId && r.courseCode === course.code && r.status !== 'rejected',
    );
    if (dup) throw new ApiError('DUPLICATE', `You already have a ${dup.status} request for ${course.code}.`);

    const missing = missingPrerequisites(course, state.completed);

    const base = {
      id: `r-${++seq}-${Date.now().toString(36)}`,
      studentId: input.studentId,
      studentName: input.studentName,
      sectionId: section.id,
      courseCode: course.code,
      createdAt: Date.now(),
    };

    // Rule failed: blocked unless the student explicitly asks faculty for an override.
    if (missing.length > 0 && !input.overrideReason) {
      throw new ApiError('PREREQ_MISSING', `Missing prerequisite: ${missing.join(', ')}.`, { missing });
    }
    if (missing.length > 0) {
      const req: SeatRequest = {
        ...base,
        status: 'pending',
        reason: `Missing prerequisite: ${missing.join(', ')}. ${input.overrideReason}`,
      };
      state.requests = [req, ...state.requests];
          socket.emit({ type: 'request', request: req });
      return req;
    }

    if (section.seats === 0) {
      waiting[course.code] = (waiting[course.code] ?? 0) + 1;
      refreshShortage(course.code);
      const alternatives = state.sections.filter((s) => s.courseCode === course.code && s.seats > 0 && s.id !== section.id);
      throw new ApiError('SECTION_FULL', `${course.code} ${section.label} is full.`, { alternatives });
    }

    section.seats -= 1; // atomic seat decrement + request record
    const req: SeatRequest = { ...base, status: 'approved', decidedAt: Date.now(), reason: 'All rules passed. Approved automatically.' };
    state.requests = [req, ...state.requests];
      emitSeat(section);
    socket.emit({ type: 'request', request: req });
    refreshShortage(course.code);
    return req;
  },

  async decideRequest(id: string, decision: 'approved' | 'rejected', note?: string) {
    await wait();
    const req = state.requests.find((r) => r.id === id);
    if (!req) throw new ApiError('NOT_FOUND', 'Request not found.');
    if (decision === 'approved') {
      const section = find(req.sectionId);
      if (section.seats === 0) throw new ApiError('SECTION_FULL', 'No seats left. Add capacity first, then approve.');
      section.seats -= 1;
      emitSeat(section);
      refreshShortage(section.courseCode);
    }
    const updated: SeatRequest = { ...req, status: decision, decidedAt: Date.now(), reason: note ? `${req.reason ?? ''} Decision note: ${note}`.trim() : req.reason };
    state.requests = state.requests.map((r) => (r.id === id ? updated : r));
      socket.emit({ type: 'request', request: updated });
    return updated;
  },

  async expandCapacity(sectionId: string, by: number, facultyId: string) {
    await wait();
    const section = find(sectionId);
    if (section.facultyId !== facultyId) throw new ApiError('FORBIDDEN', 'You can only change capacity for your own sections.');
    section.seats += by;
    section.capacity += by;
      emitSeat(section);
    refreshShortage(section.courseCode);
    return structuredClone(section);
  },

  setRush(on: boolean) {
    if (on && !rushTimer) {
      rushTimer = setInterval(() => {
        const open = state.sections.filter((s) => s.seats > 0);
        if (open.length === 0) return;
        const s = open[Math.floor(Math.random() * open.length)];
        s.seats -= 1;
              emitSeat(s);
        refreshShortage(s.courseCode);
      }, 900);
    }
    if (!on && rushTimer) {
      clearInterval(rushTimer);
      rushTimer = null;
    }
  },

  async getHealth(): Promise<HealthSnapshot> {
    await wait(30);
    const rush = rushTimer !== null;
    const j = (n: number) => n * (0.85 + Math.random() * 0.3);
    return {
      rps: Math.round(j(rush ? 820 : 45)),
      p95Ms: Math.round(j(rush ? 168 : 58)),
      errorRatePct: Number(j(rush ? 0.4 : 0.05).toFixed(2)),
      dbPoolPct: Math.round(j(rush ? 72 : 18)),
      services: { api: 'up', redis: 'up', postgres: 'up' },
      at: Date.now(),
    };
  },
};
