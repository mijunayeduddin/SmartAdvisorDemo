import type { Course, Day, Section, SeatRequest, User } from '../types';

export const DEMO_PASSWORD = 'demo1234';

export const USERS: User[] = [
  { id: '2412000001', name: 'Ayesha Rahman', email: 'student@demo.nsu.edu', role: 'student' },
  { id: 'fac-1', name: 'Dr. Nadia Karim', email: 'faculty@demo.nsu.edu', role: 'faculty' },
  { id: 'adm-1', name: 'Rafiq Hasan', email: 'admin@demo.nsu.edu', role: 'admin' },
];

export const COURSES: Course[] = [
  { code: 'CSE115', title: 'Programming Language I', credits: 3, prerequisites: [] },
  { code: 'CSE173', title: 'Discrete Mathematics', credits: 3, prerequisites: ['CSE115'] },
  { code: 'CSE215', title: 'Programming Language II', credits: 3, prerequisites: ['CSE115'] },
  { code: 'MAT116', title: 'Calculus I', credits: 3, prerequisites: [] },
  { code: 'MAT120', title: 'Calculus II', credits: 3, prerequisites: ['MAT116'] },
  { code: 'CSE225', title: 'Data Structures and Algorithms', credits: 3, prerequisites: ['CSE173', 'CSE215'] },
  { code: 'CSE231', title: 'Digital Logic Design', credits: 3, prerequisites: ['CSE173'] },
  { code: 'CSE332', title: 'Computer Organization and Architecture', credits: 3, prerequisites: ['CSE173'] },
  { code: 'MAT250', title: 'Calculus III', credits: 3, prerequisites: ['MAT120'] },
  { code: 'CSE311', title: 'Database Systems', credits: 3, prerequisites: ['CSE225'] },
  { code: 'CSE323', title: 'Operating Systems Design', credits: 3, prerequisites: ['CSE225'] },
  { code: 'CSE327', title: 'Software Engineering', credits: 3, prerequisites: ['CSE311'] },
  { code: 'CSE331', title: 'Microprocessor Interfacing', credits: 3, prerequisites: ['CSE231'] },
];

/** What the demo student has already finished. */
export const COMPLETED_BY_STUDENT: Record<string, string[]> = {
  '2412000001': ['CSE115', 'CSE173', 'CSE215', 'MAT116', 'MAT120'],
};

const PATTERNS: Record<'ST' | 'MW', Day[]> = { ST: ['Sun', 'Tue'], MW: ['Mon', 'Wed'] };
const FACULTY: Record<string, string> = {
  'fac-1': 'Dr. Nadia Karim',
  'fac-2': 'Mr. Imran Chowdhury',
  'fac-3': 'Dr. Sabina Yasmin',
};

function sec(
  course: string,
  n: number,
  fac: string,
  seats: number,
  capacity: number,
  pattern: 'ST' | 'MW',
  start: number,
): Section {
  return {
    id: `s-${course.slice(-3)}-${n}`,
    courseCode: course,
    label: `Section ${n}`,
    facultyId: fac,
    facultyName: FACULTY[fac],
    seats,
    capacity,
    slots: PATTERNS[pattern].map((day) => ({ day, start, end: start + 90 })),
  };
}

// start times: 480 = 8:00, 570 = 9:30, 660 = 11:00, 750 = 12:30, 840 = 2:00 pm, 930 = 3:30 pm
export const SECTIONS: Section[] = [
  sec('CSE225', 1, 'fac-1', 6, 35, 'ST', 480),
  sec('CSE225', 2, 'fac-1', 14, 35, 'MW', 570),
  sec('CSE225', 3, 'fac-2', 3, 35, 'ST', 660),
  sec('CSE231', 1, 'fac-2', 9, 35, 'MW', 480),
  sec('CSE231', 2, 'fac-2', 0, 35, 'ST', 570),
  sec('CSE231', 3, 'fac-2', 11, 35, 'MW', 750),
  sec('CSE332', 1, 'fac-2', 1, 35, 'ST', 750),
  sec('CSE332', 2, 'fac-2', 0, 35, 'MW', 660),
  sec('MAT250', 1, 'fac-3', 20, 40, 'ST', 570),
  sec('MAT250', 2, 'fac-3', 8, 40, 'MW', 840),
  sec('CSE311', 1, 'fac-1', 4, 35, 'ST', 840),
  sec('CSE311', 2, 'fac-1', 16, 35, 'MW', 930),
  sec('CSE323', 1, 'fac-1', 10, 35, 'MW', 480),
  sec('CSE323', 2, 'fac-2', 5, 35, 'ST', 930),
  sec('CSE327', 1, 'fac-1', 0, 35, 'ST', 570),
  sec('CSE327', 2, 'fac-1', 7, 35, 'MW', 840),
  sec('CSE331', 1, 'fac-2', 12, 35, 'MW', 570),
  sec('CSE331', 2, 'fac-2', 2, 35, 'ST', 840),
];

const now = Date.now();
export const SEED_REQUESTS: SeatRequest[] = [
  {
    id: 'r-seed-1',
    studentId: '2412000077',
    studentName: 'Tanvir Ahmed',
    sectionId: 's-311-1',
    courseCode: 'CSE311',
    status: 'pending',
    reason: 'Missing prerequisite: CSE225. Instructor consent requested.',
    createdAt: now - 4 * 60_000,
  },
  {
    id: 'r-seed-2',
    studentId: '2412000078',
    studentName: 'Nusrat Jahan',
    sectionId: 's-327-1',
    courseCode: 'CSE327',
    status: 'pending',
    reason: 'Section is full. Seat override requested.',
    createdAt: now - 11 * 60_000,
  },
];
