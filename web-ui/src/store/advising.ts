import { create } from 'zustand';
import { mockApi } from '@/lib/mock/server';
import type { Course, Section, SeatEvent, SeatRequest, User } from '@/lib/types';

interface AdvisingState {
  courses: Course[];
  sections: Section[];
  requests: SeatRequest[];
  completed: string[];
  shortages: Record<string, number>;
  loaded: boolean;
  load: (user: User) => Promise<void>;
  applyEvent: (e: SeatEvent) => void;
  submitRequest: (user: User, sectionId: string, overrideReason?: string) => Promise<SeatRequest>;
  decide: (id: string, decision: 'approved' | 'rejected', note?: string) => Promise<void>;
  expand: (sectionId: string, by: number, facultyId: string) => Promise<void>;
}

const upsert = (list: SeatRequest[], r: SeatRequest) =>
  list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [r, ...list];

export const useAdvising = create<AdvisingState>((set, get) => ({
  courses: [],
  sections: [],
  requests: [],
  completed: [],
  shortages: {},
  loaded: false,

  load: async (user) => {
    const [courses, sections, requests, completed, shortages] = await Promise.all([
      mockApi.getCourses(),
      mockApi.getSections(),
      mockApi.getRequests(),
      mockApi.getCompleted(user.id),
      mockApi.getShortages(),
    ]);
    set({ courses, sections, requests, completed, shortages, loaded: true });
  },

  // Single entry point for everything the WebSocket pushes.
  applyEvent: (e) => {
    switch (e.type) {
      case 'seat':
        set({ sections: get().sections.map((s) => (s.id === e.sectionId ? { ...s, seats: e.seats, capacity: e.capacity } : s)) });
        break;
      case 'request':
        set({ requests: upsert(get().requests, e.request) });
        break;
      case 'shortage':
        set({ shortages: { ...get().shortages, [e.courseCode]: e.waiting } });
        break;
      case 'shortage-cleared': {
        const { [e.courseCode]: _removed, ...rest } = get().shortages;
        set({ shortages: rest });
        break;
      }
    }
  },

  submitRequest: async (user, sectionId, overrideReason) => {
    const req = await mockApi.submitRequest({ studentId: user.id, studentName: user.name, sectionId, overrideReason });
    set({ requests: upsert(get().requests, req) });
    return req;
  },

  decide: async (id, decision, note) => {
    const updated = await mockApi.decideRequest(id, decision, note);
    set({ requests: upsert(get().requests, updated) });
  },

  expand: async (sectionId, by, facultyId) => {
    const s = await mockApi.expandCapacity(sectionId, by, facultyId);
    set({ sections: get().sections.map((x) => (x.id === s.id ? s : x)) });
  },
}));
