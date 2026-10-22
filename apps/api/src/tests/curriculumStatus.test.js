const { setupTestDb, teardownTestDb } = require('./setupTestDb');
const { calculateStatus, validateCompletedList } = require('../services/curriculumService');

describe('Curriculum Status Rules and Logic Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 45000);

  afterAll(async () => {
    await teardownTestDb();
  });

  test('Acceptance Check #2: completed=[] -> ENG102, MAT116, CSE115, CSE115L, PHI101 are "available"; CSE173, CSE327 and MAT120 are "locked"', async () => {
    const result = await calculateStatus([]);
    const map = result.courseMap;

    expect(map['ENG102'].status).toBe('available');
    expect(map['MAT116'].status).toBe('available');
    expect(map['CSE115'].status).toBe('available');
    expect(map['CSE115L'].status).toBe('available');
    expect(map['PHI101'].status).toBe('available');

    expect(map['CSE173'].status).toBe('locked');
    expect(map['CSE327'].status).toBe('locked');
    expect(map['MAT120'].status).toBe('locked');

    expect(result.completedCredits).toBe(0);
    expect(result.completedCourses).toBe(0);
    expect(result.totalCourses).toBe(88);
  });

  test('Acceptance Check #3: completed=["ENG102"] -> ENG103 is "available". completed=["MAT116"] -> MAT125 is "available"', async () => {
    const res1 = await calculateStatus(['ENG102']);
    expect(res1.courseMap['ENG102'].status).toBe('done');
    expect(res1.courseMap['ENG103'].status).toBe('available');

    const res2 = await calculateStatus(['MAT116']);
    expect(res2.courseMap['MAT116'].status).toBe('done');
    expect(res2.courseMap['MAT125'].status).toBe('available');
  });

  test('Acceptance Check #4: completed=["CSE115","CSE115L"] -> CSE173 is "available"', async () => {
    const res = await calculateStatus(['CSE115', 'CSE115L']);
    expect(res.courseMap['CSE115'].status).toBe('done');
    expect(res.courseMap['CSE115L'].status).toBe('done');
    expect(res.courseMap['CSE173'].status).toBe('available');
  });

  test('Acceptance Check #5: CSE299 stays locked until completedCredits >= 60, CSE498 until 80, and CSE499A until 100', async () => {
    // 0 credits: all three locked
    const res0 = await calculateStatus([]);
    expect(res0.courseMap['CSE299'].status).toBe('locked');
    expect(res0.courseMap['CSE498'].status).toBe('locked');
    expect(res0.courseMap['CSE499A'].status).toBe('locked');

    // Create a list of 20 courses of 3 credits each = 60 credits
    const courses60 = [
      'ENG102', 'ENG103', 'ENG111', 'PHI101', 'PHI104',
      'LBA101', 'LBA102', 'POL101', 'POL104', 'ECO101',
      'ECO104', 'SOC101', 'ENV203', 'ANT101', 'MAT116',
      'MAT120', 'MAT125', 'MAT130', 'MAT250', 'MAT350',
    ];

    const res60 = await calculateStatus(courses60);
    expect(res60.completedCredits).toBeGreaterThanOrEqual(60);
    expect(res60.courseMap['CSE299'].status).toBe('available');
    expect(res60.courseMap['CSE498'].status).toBe('locked');
    expect(res60.courseMap['CSE499A'].status).toBe('locked');

    // Add more courses to reach >= 80 credits (7 more 3-credit courses = +21 -> 81 credits)
    const courses80 = [
      ...courses60,
      'MAT361', 'CHE101', 'EEE141', 'EEE111', 'CSE115',
      'CSE215', 'CSE225',
    ];
    const res80 = await calculateStatus(courses80);
    expect(res80.completedCredits).toBeGreaterThanOrEqual(80);
    expect(res80.courseMap['CSE498'].status).toBe('available');
    expect(res80.courseMap['CSE499A'].status).toBe('locked');

    // Add more courses to reach >= 100 credits (7 more 3-credit courses = +21 -> >100 credits)
    const courses100 = [
      ...courses80,
      'CSE231', 'CSE311', 'CSE323', 'CSE327', 'CSE331',
      'CSE332', 'CSE373',
    ];
    const res100 = await calculateStatus(courses100);
    expect(res100.completedCredits).toBeGreaterThanOrEqual(100);
    expect(res100.courseMap['CSE499A'].status).toBe('available');
  });

  test('Acceptance Check #6: A course with an unknown prerequisite (PHY108 needs MAT240) becomes available once its known prerequisite (PHY107) is done', async () => {
    // Before PHY107: locked
    const resBefore = await calculateStatus([]);
    expect(resBefore.courseMap['PHY108'].status).toBe('locked');

    // After PHY107: available (MAT240 does not block eligibility)
    const resAfter = await calculateStatus(['PHY107']);
    expect(resAfter.courseMap['PHY108'].status).toBe('available');
  });

  test('Acceptance Check #7: CSE440 with completed=["CSE225"] returns "maybe"; with ["CSE225","MAT361"] returns "available"', async () => {
    const resMaybe = await calculateStatus(['CSE225']);
    expect(resMaybe.courseMap['CSE440'].status).toBe('maybe');
    expect(resMaybe.courseMap['CSE440'].missing).toContain('MAT 361');

    const resAvailable = await calculateStatus(['CSE225', 'MAT361']);
    expect(resAvailable.courseMap['CSE440'].status).toBe('available');
    expect(resAvailable.courseMap['CSE440'].missing).toBeNull();
  });

  describe('Input Validation on completed list', () => {
    test('rejects non-array completed input', async () => {
      const res = await validateCompletedList('CSE115');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/must be an array/i);
    });

    test('rejects completed list exceeding 200 items', async () => {
      const longList = new Array(201).fill('CSE115');
      const res = await validateCompletedList(longList);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/200/);
    });

    test('rejects unknown course codes not in curriculum', async () => {
      const res = await validateCompletedList(['CSE115', 'INVALID999']);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/Unknown course code.*INVALID999/i);
    });

    test('accepts valid curriculum courses and aliases', async () => {
      const res = await validateCompletedList(['CSE115', 'GEO205', 'CSE425']);
      expect(res.valid).toBe(true);
      expect(res.normalized).toEqual(['CSE115', 'GEO205', 'CSE425']);
    });
  });
});
