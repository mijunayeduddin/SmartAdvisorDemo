import { FallbackRouter } from '../core/fallbackRouter';
import { buildGraph } from '../core/graphSolver';
import { MilestonePriorityStrategy } from '../core/strategy/scheduleStrategy';

describe('FallbackRouter & MilestonePriorityStrategy', () => {
  const courses = [
    { code: 'CSE115', isMilestone: true, credits: 4 },
    { code: 'CSE173', prerequisites: ['CSE115'], isMilestone: true, credits: 3 },
    { code: 'CSE215', prerequisites: ['CSE173'], isMilestone: true, credits: 4 },
    { code: 'CSE225', prerequisites: ['CSE215'], isMilestone: true, credits: 3 },
    { code: 'CSE311', prerequisites: ['CSE225'], isMilestone: true, credits: 3 },
    { code: 'ENG102', credits: 3 } // Non-milestone generic elective
  ];

  const graph = buildGraph(courses);
  const router = new FallbackRouter();

  test('returns ACCEPTED when requested section has seats available', () => {
    const sections = [
      { id: 'sec-1', courseCode: 'CSE115', sectionNumber: 1, seatsAvailable: 5, capacity: 35 }
    ];

    const student = {
      studentId: 'student-1',
      completedCourses: [],
      completedCredits: 0
    };

    const res = router.routeSimulation(
      student,
      { courseCode: 'CSE115', sectionNumber: 1 },
      graph,
      sections
    );

    expect(res.status).toBe('ACCEPTED');
    expect(res.requested.courseCode).toBe('CSE115');
    expect(res.requested.seatsAvailable).toBe(5);
    expect(res.alternative).toBeNull();
  });

  test('proposes same-course open section when requested section has 0 seats', () => {
    const sections = [
      { id: 'sec-full', courseCode: 'CSE115', sectionNumber: 2, seatsAvailable: 0, capacity: 35 },
      { id: 'sec-open', courseCode: 'CSE115', sectionNumber: 1, seatsAvailable: 4, capacity: 35 }
    ];

    const student = {
      studentId: 'student-1',
      completedCourses: [],
      completedCredits: 0
    };

    const res = router.routeSimulation(
      student,
      { courseCode: 'CSE115', sectionNumber: 2 },
      graph,
      sections
    );

    expect(res.status).toBe('FALLBACK_PROPOSED');
    expect(res.requested.sectionNumber).toBe(2);
    expect(res.requested.seatsAvailable).toBe(0);
    expect(res.alternative).not.toBeNull();
    expect(res.alternative?.courseCode).toBe('CSE115');
    expect(res.alternative?.sectionNumber).toBe(1);
    expect(res.alternative?.seatsAvailable).toBe(4);
  });

  test('prefers critical path milestone over generic elective when course is completely full', () => {
    // Both CSE115 sections are completely full
    // Candidate alternatives: CSE173 (not eligible yet because CSE115 not completed),
    // Student already completed CSE115, now needs CSE173 (on critical path) or ENG102 (generic elective)
    const student = {
      studentId: 'student-2',
      completedCourses: ['CSE115'],
      completedCredits: 4
    };

    // Both sections of full course requested:
    const sections = [
      { id: 'sec-cse173-full', courseCode: 'CSE173', sectionNumber: 1, seatsAvailable: 0 },
      { id: 'sec-eng102', courseCode: 'ENG102', sectionNumber: 1, seatsAvailable: 10 },
      { id: 'sec-cse173-alt', courseCode: 'CSE173', sectionNumber: 2, seatsAvailable: 2 }
    ];

    const res = router.routeSimulation(
      student,
      { courseCode: 'CSE173', sectionNumber: 1 },
      graph,
      sections
    );

    expect(res.status).toBe('FALLBACK_PROPOSED');
    // Alternative should be CSE173 §2 because it has open seats and preserves critical path
    expect(res.alternative?.courseCode).toBe('CSE173');
    expect(res.alternative?.sectionNumber).toBe(2);
    expect(res.alternative?.isCriticalPath).toBe(true);
  });

  test('when requested course has NO open sections, selects next critical path course over elective', () => {
    // Student has completed CSE115, CSE173, CSE215.
    // Eligible courses: CSE225 (on critical path, milestone) and ENG102 (generic elective)
    // Student tries to enroll in a non-existent or 0-seat section of an unavailable course
    const student = {
      studentId: 'student-3',
      completedCourses: ['CSE115', 'CSE173', 'CSE215'],
      completedCredits: 11
    };

    const sections = [
      { id: 'sec-eng102', courseCode: 'ENG102', sectionNumber: 1, seatsAvailable: 25 },
      { id: 'sec-cse225', courseCode: 'CSE225', sectionNumber: 1, seatsAvailable: 3, isMilestone: true }
    ];

    const strategy = new MilestonePriorityStrategy();
    const ranked = strategy.rankAlternatives(student, graph, sections);

    // First ranked alternative MUST be CSE225 (critical path milestone) over ENG102 (elective)
    expect(ranked.length).toBe(2);
    expect(ranked[0].courseCode).toBe('CSE225');
    expect(ranked[0].isCriticalPath).toBe(true);
    expect(ranked[1].courseCode).toBe('ENG102');
  });

  test('returns NO_ALTERNATIVE when no conflict-free open sections exist', () => {
    const student = {
      studentId: 'student-4',
      completedCourses: [],
      completedCredits: 0
    };

    const sections = [
      { id: 'sec-1', courseCode: 'CSE115', sectionNumber: 1, seatsAvailable: 0 }
    ];

    const res = router.routeSimulation(
      student,
      { courseCode: 'CSE115', sectionNumber: 1 },
      graph,
      sections
    );

    expect(res.status).toBe('NO_ALTERNATIVE');
    expect(res.alternative).toBeNull();
  });
});
