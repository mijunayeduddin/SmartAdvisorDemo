import { create } from 'zustand';
import { Course, Section, StudentContext, FallbackRouteResponse, StrategyMode, CoursePathway, CourseRecommendation, PathwayMode } from '../types';
import { solvePathwayForCourse, solveBestRecommendations } from '../utils/pathwaySolver';

function refreshDynamicPathways(
  courses: Course[],
  enrolled: Section[],
  selectedCode: string | null,
  mode: PathwayMode
) {
  const completedSet = new Set(
    courses.filter((c) => c.isCompleted).map((c) => c.code.toUpperCase())
  );
  const recommendations = solveBestRecommendations(courses, enrolled, completedSet);

  let activePathway: CoursePathway | null = null;
  if (mode === 'selected' && selectedCode) {
    activePathway = solvePathwayForCourse(selectedCode, courses, completedSet);
  } else if (mode === 'best') {
    const topRec = recommendations.find((r) => !r.isEnrolled) || recommendations[0];
    if (topRec) {
      activePathway = solvePathwayForCourse(topRec.code, courses, completedSet);
    }
  } else if (mode === 'curriculum') {
    activePathway = solvePathwayForCourse('CSE311', courses, completedSet);
  }

  return { recommendations, activePathway };
}

interface ScheduleStore {
  courses: Course[];
  sections: Section[];
  student: StudentContext | null;
  enrolledSections: Section[];
  criticalPath: string[];
  eligibleCourses: string[];
  recommendations: CourseRecommendation[];
  activePathway: CoursePathway | null;
  pathwayMode: PathwayMode;
  fallbackProposal: FallbackRouteResponse | null;
  strategy: StrategyMode;
  lastSyncedTimestamp: string | null;
  wsConnected: boolean;
  isLoading: boolean;
  searchQuery: string;
  selectedCourseCode: string | null;
  selectedDepartment: string;
  seatFilter: 'all' | 'open' | 'full';

  init: () => Promise<void>;
  connectWebSocket: () => void;
  setStrategy: (strategy: StrategyMode) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCourseCode: (code: string | null) => void;
  setPathwayMode: (mode: PathwayMode) => void;
  setSelectedDepartment: (dept: string) => void;
  setSeatFilter: (filter: 'all' | 'open' | 'full') => void;
  simulateAddSection: (courseCode: string, sectionNumber: number) => Promise<FallbackRouteResponse | null>;
  dropSection: (sectionId: string) => void;
  acceptFallback: () => void;
  rejectFallback: () => void;
  triggerManualSync: () => Promise<void>;
}

export const useScheduleStore = create<ScheduleStore>((set, get) => {
  let wsInstance: WebSocket | null = null;
  let reconnectTimeout: any = null;

  return {
    courses: [],
    sections: [],
    student: null,
    enrolledSections: [],
    criticalPath: [],
    eligibleCourses: [],
    recommendations: [],
    activePathway: null,
    pathwayMode: 'best',
    fallbackProposal: null,
    strategy: 'MilestonePriority',
    lastSyncedTimestamp: null,
    wsConnected: false,
    isLoading: true,
    searchQuery: '',
    selectedCourseCode: null,
    selectedDepartment: 'ALL',
    seatFilter: 'all',

    setStrategy: (strategy: StrategyMode) => {
      set({ strategy });
    },

    setSearchQuery: (searchQuery: string) => {
      set({ searchQuery });
    },

    setSelectedCourseCode: (selectedCourseCode: string | null) => {
      const state = get();
      if (selectedCourseCode) {
        const { recommendations, activePathway } = refreshDynamicPathways(
          state.courses,
          state.enrolledSections,
          selectedCourseCode,
          'selected'
        );
        set({
          selectedCourseCode,
          pathwayMode: 'selected',
          recommendations,
          activePathway,
        });
      } else {
        const { recommendations, activePathway } = refreshDynamicPathways(
          state.courses,
          state.enrolledSections,
          null,
          'best'
        );
        set({
          selectedCourseCode: null,
          pathwayMode: 'best',
          recommendations,
          activePathway,
        });
      }
    },

    setPathwayMode: (pathwayMode: PathwayMode) => {
      const state = get();
      const targetCode = pathwayMode === 'selected' ? state.selectedCourseCode : null;
      const { recommendations, activePathway } = refreshDynamicPathways(
        state.courses,
        state.enrolledSections,
        targetCode,
        pathwayMode
      );
      set({ pathwayMode, recommendations, activePathway });
    },

    setSelectedDepartment: (selectedDepartment: string) => {
      set({ selectedDepartment });
    },

    setSeatFilter: (seatFilter: 'all' | 'open' | 'full') => {
      set({ seatFilter });
    },

    init: async () => {
      set({ isLoading: true });
      try {
        // 1. Fetch courses with student critical path context
        const coursesRes = await fetch('/api/courses?studentId=2412800642');
        const coursesData = await coursesRes.json();

        // 2. Fetch available sections
        const sectionsRes = await fetch('/api/schedule/sections?term=Fall 2026');
        const sectionsData = await sectionsRes.json();

        // 2b. Fetch active draft enrolled schedule from backend observer store
        let initialEnrolled: Section[] = [];
        try {
          const enrolledRes = await fetch('/api/schedule/enrolled?studentId=2412800642');
          const enrolledData = await enrolledRes.json();
          if (enrolledData && Array.isArray(enrolledData.schedule) && enrolledData.schedule.length > 0) {
            initialEnrolled = enrolledData.schedule;
          }
        } catch (e) {
          console.warn('[ScheduleStore] Could not load initial enrolled schedule:', e);
        }

        const courses: Course[] = coursesData.courses || [];
        const sections: Section[] = sectionsData.sections || [];
        const cPath = courses.filter((c) => c.isCriticalPath).map((c) => c.code);
        const eligible = courses.filter((c) => c.isEligible).map((c) => c.code);

        // Solve initial dynamic recommendations and pathway
        const { recommendations, activePathway } = refreshDynamicPathways(
          courses,
          initialEnrolled,
          null,
          'best'
        );

        set({
          courses,
          sections,
          enrolledSections: initialEnrolled,
          student: coursesData.studentContext || {
            studentId: '2412800642',
            name: 'Tariqul Islam',
            completedCredits: 70,
            completedCoursesCount: 24,
            criticalPathLength: cPath.length,
          },
          criticalPath: cPath,
          eligibleCourses: eligible,
          recommendations,
          activePathway,
          pathwayMode: 'best',
          lastSyncedTimestamp: new Date().toISOString(),
          isLoading: false,
        });

        // 3. Connect WebSocket observer
        get().connectWebSocket();
      } catch (err) {
        console.error('[ScheduleStore] Failed to initialize data:', err);
        set({ isLoading: false });
      }
    },


    connectWebSocket: () => {
      if (typeof window === 'undefined') return;
      if (wsInstance && (wsInstance.readyState === WebSocket.OPEN || wsInstance.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.hostname}:5000/ws`;

      try {
        wsInstance = new WebSocket(wsUrl);

        wsInstance.onopen = () => {
          console.log('[WebSocket] Connected to SmartAdvisor backend observer');
          set({ wsConnected: true });
          // Subscribe to real-time events
          wsInstance?.send(JSON.stringify({ action: 'subscribe' }));
        };

        wsInstance.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'SEAT_UPDATE') {
              const payload = data.payload;
              const eventTimestamp = data.timestamp || new Date().toISOString();

              set((state) => {
                const updatedSections = state.sections.map((sec) => {
                  if (sec.id === payload.sectionId || 
                     (sec.course_code === payload.courseCode && sec.section_number === Number(payload.sectionNumber))) {
                    return {
                      ...sec,
                      seats_available: Number(payload.seatsAvailable),
                      capacity: payload.capacity ? Number(payload.capacity) : sec.capacity,
                      enrolled_count: payload.enrolledCount !== undefined ? Number(payload.enrolledCount) : sec.enrolled_count,
                    };
                  }
                  return sec;
                });

                const updatedEnrolled = state.enrolledSections.map((sec) => {
                  if (sec.id === payload.sectionId) {
                    return {
                      ...sec,
                      seats_available: Number(payload.seatsAvailable),
                    };
                  }
                  return sec;
                });

                return {
                  sections: updatedSections,
                  enrolledSections: updatedEnrolled,
                  lastSyncedTimestamp: eventTimestamp,
                };
              });
            } else if (data.type === 'SCHEDULE_SYNC') {
              const payload = data.payload || {};
              const eventTimestamp = data.timestamp || new Date().toISOString();
              set((state) => {
                let updated = state.enrolledSections;
                if (payload.schedule && Array.isArray(payload.schedule)) {
                  updated = payload.schedule;
                } else if (payload.action === 'DROPPED' && payload.sectionId) {
                  updated = state.enrolledSections.filter(
                    (s) => s.id !== payload.sectionId && `${s.course_code}-${s.section_number}` !== payload.sectionId && s.course_code !== payload.sectionId
                  );
                } else if (payload.action === 'ENROLLED' && payload.section) {
                  const filtered = state.enrolledSections.filter(
                    (s) => s.course_code !== payload.section.course_code
                  );
                  updated = [...filtered, payload.section];
                }
                const { recommendations, activePathway } = refreshDynamicPathways(
                  state.courses,
                  updated,
                  state.selectedCourseCode,
                  state.pathwayMode
                );
                return {
                  enrolledSections: updated,
                  recommendations,
                  activePathway,
                  lastSyncedTimestamp: eventTimestamp,
                };
              });
            } else if (data.type === 'FALLBACK_PROPOSED') {
              set({
                fallbackProposal: data.payload,
                lastSyncedTimestamp: data.timestamp || new Date().toISOString(),
              });
            }
          } catch (e) {
            console.error('[WebSocket] Error processing message:', e);
          }
        };

        wsInstance.onclose = () => {
          console.warn('[WebSocket] Closed. Attempting reconnect in 3s...');
          set({ wsConnected: false });
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            get().connectWebSocket();
          }, 3000);
        };

        wsInstance.onerror = (err) => {
          console.error('[WebSocket] Error:', err);
          wsInstance?.close();
        };
      } catch (err) {
        console.error('[WebSocket] Connection attempt failed:', err);
        set({ wsConnected: false });
      }
    },

    simulateAddSection: async (courseCode: string, sectionNumber: number) => {
      const state = get();
      try {
        const payload = {
          studentId: '2412800642',
          courseCode: courseCode.trim().toUpperCase(),
          sectionNumber: Number(sectionNumber),
          strategy: state.strategy,
          currentSchedule: state.enrolledSections,
        };

        const res = await fetch('/api/schedule/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data: FallbackRouteResponse = await res.json();

        if (data.status === 'FALLBACK_PROPOSED') {
          set({ fallbackProposal: data });
          // Broadcast emergency fallback alert to all WebSocket observers (e.g. mobile)
          if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send(JSON.stringify({
              type: 'FALLBACK_PROPOSED',
              payload: data
            }));
          }
          return data;
        }

        if (data.status === 'ACCEPTED') {
          // Find matching section in sections list
          const targetSection = state.sections.find(
            (s) => s.course_code === courseCode && s.section_number === Number(sectionNumber)
          ) || {
            id: data.requested.sectionId || `${courseCode}-${sectionNumber}`,
            course_code: data.requested.courseCode,
            section_number: data.requested.sectionNumber || 1,
            capacity: data.requested.capacity || 35,
            enrolled_count: (data.requested.capacity || 35) - (data.requested.seatsAvailable || 1),
            seats_available: data.requested.seatsAvailable,
            day_of_week: data.requested.dayOfWeek || 'ST',
            start_time: data.requested.startTime || '08:00:00',
            end_time: data.requested.endTime || '09:30:00',
            faculty_name: data.requested.facultyName || 'TBA',
          };

          // Check if already in enrolled
          const alreadyEnrolled = state.enrolledSections.some(
            (s) => s.course_code === targetSection.course_code
          );

          if (!alreadyEnrolled) {
            const nextEnrolled = [...state.enrolledSections, targetSection];
            const { recommendations, activePathway } = refreshDynamicPathways(
              state.courses,
              nextEnrolled,
              state.selectedCourseCode,
              state.pathwayMode
            );
            set({
              enrolledSections: nextEnrolled,
              recommendations,
              activePathway,
              fallbackProposal: null,
            });

            // Broadcast enrollment to mobile observer
            if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
              wsInstance.send(JSON.stringify({
                type: 'SCHEDULE_SYNC',
                payload: {
                  studentId: '2412800642',
                  action: 'ENROLLED',
                  section: targetSection,
                  schedule: nextEnrolled
                }
              }));
            }
          }
          return data;
        }

        if (data.status === 'NO_ALTERNATIVE') {
          set({ fallbackProposal: data });
          if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
            wsInstance.send(JSON.stringify({
              type: 'FALLBACK_PROPOSED',
              payload: data
            }));
          }
          return data;
        }

        return data;
      } catch (err) {
        console.error('[ScheduleStore] Error simulating add:', err);
        return null;
      }
    },

    dropSection: (sectionId: string) => {
      const state = get();
      const updated = state.enrolledSections.filter(
        (s) => s.id !== sectionId && `${s.course_code}-${s.section_number}` !== sectionId && s.course_code !== sectionId
      );
      const { recommendations, activePathway } = refreshDynamicPathways(
        state.courses,
        updated,
        state.selectedCourseCode,
        state.pathwayMode
      );
      set({ 
        enrolledSections: updated,
        recommendations,
        activePathway,
      });

      // 1. Broadcast immediately to WebSocket Observer
      if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        wsInstance.send(JSON.stringify({
          type: 'SCHEDULE_SYNC',
          payload: {
            studentId: '2412800642',
            action: 'DROPPED',
            sectionId,
            schedule: updated
          }
        }));
      }

      // 2. Persist to backend
      fetch(`/api/schedule/enrolled/${sectionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: '2412800642', sectionId })
      }).catch((e) => console.error('Error syncing drop:', e));
    },

    acceptFallback: () => {
      const state = get();
      if (!state.fallbackProposal || !state.fallbackProposal.alternative) return;

      const alt = state.fallbackProposal.alternative;
      const targetSection = state.sections.find(
        (s) => s.id === alt.sectionId || (s.course_code === alt.courseCode && s.section_number === alt.sectionNumber)
      ) || {
        id: alt.sectionId,
        course_code: alt.courseCode,
        section_number: alt.sectionNumber,
        capacity: alt.capacity || 35,
        enrolled_count: (alt.capacity || 35) - alt.seatsAvailable,
        seats_available: alt.seatsAvailable,
        day_of_week: alt.dayOfWeek || 'MW',
        start_time: alt.startTime || '09:30:00',
        end_time: alt.endTime || '11:00:00',
        room: alt.room || 'SAC 601',
        faculty_name: alt.facultyName || 'Selim Ahmed',
      };

      // Replace or add to enrolled sections
      const filtered = state.enrolledSections.filter(
        (s) => s.course_code !== targetSection.course_code
      );
      const nextEnrolled = [...filtered, targetSection];

      const { recommendations, activePathway } = refreshDynamicPathways(
        state.courses,
        nextEnrolled,
        state.selectedCourseCode,
        state.pathwayMode
      );

      set({
        enrolledSections: nextEnrolled,
        recommendations,
        activePathway,
        fallbackProposal: null,
      });

      // Broadcast accepted fallback to mobile observer
      if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        wsInstance.send(JSON.stringify({
          type: 'SCHEDULE_SYNC',
          payload: {
            studentId: '2412800642',
            action: 'ENROLLED',
            section: targetSection,
            schedule: nextEnrolled
          }
        }));
      }

      // Persist to backend
      fetch('/api/schedule/enrolled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: '2412800642',
          action: 'ENROLLED',
          section: targetSection,
          schedule: nextEnrolled
        })
      }).catch((e) => console.error('Error persisting accepted fallback:', e));
    },

    rejectFallback: () => {
      set({ fallbackProposal: null });
    },

    triggerManualSync: async () => {
      try {
        const res = await fetch('/api/schedule/sync-now', { method: 'POST' });
        const data = await res.json();
        set({ lastSyncedTimestamp: new Date().toISOString() });
        // Refresh sections
        const sectionsRes = await fetch('/api/schedule/sections?term=Fall 2026');
        const sectionsData = await sectionsRes.json();
        if (sectionsData.sections) {
          set({ sections: sectionsData.sections });
        }
      } catch (e) {
        console.error('Manual sync failed:', e);
      }
    },
  };
});
