const request = require('supertest');
const app = require('../app');
const { setupTestDb, teardownTestDb } = require('./setupTestDb');
const { parseCurriculumCsv, checkPrerequisiteCycles } = require('../services/curriculumParser');
const { closeRedis } = require('../cache/redisClient');
const path = require('path');

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
});

describe('Phase 3 - BBA Curriculum & Multi-Program Acceptance Checks', () => {
  test('Acceptance Check #1: GET /api/curriculum/programs returns CSE (88) and BBA (124)', async () => {
    const res = await request(app).get('/api/curriculum/programs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const cse = res.body.find((p) => p.id === 'CSE');
    const bba = res.body.find((p) => p.id === 'BBA');
    expect(cse).toBeDefined();
    expect(cse.courses).toBe(88);
    expect(bba).toBeDefined();
    expect(bba.courses).toBe(124);

    // Backward compatibility: default program=CSE returns 88
    const cseRes = await request(app).get('/api/curriculum');
    expect(cseRes.status).toBe(200);
    expect(cseRes.body.totalCourses).toBe(88);

    const cseExplicitRes = await request(app).get('/api/curriculum?program=CSE');
    expect(cseExplicitRes.status).toBe(200);
    expect(cseExplicitRes.body.totalCourses).toBe(88);

    const bbaRes = await request(app).get('/api/curriculum?program=BBA');
    expect(bbaRes.status).toBe(200);
    expect(bbaRes.body.totalCourses).toBe(124);
  });

  test('Acceptance Check #2: BBA with completed=[] -> correct available, locked, maybe statuses', async () => {
    const res = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: [] });

    expect(res.status).toBe(200);
    const map = res.body.courseMap;

    // Available courses
    const expectedAvailable = [
      'ENG102',
      'BUS112',
      'PHI401',
      'HIS103',
      'POL101',
      'ECO101',
      'MIS107',
      'ACT201',
      'LAW200',
      'MKT202',
      'MGT212',
      'BIO103',
      'BIO103L', // Co-requisite does not block
    ];
    for (const code of expectedAvailable) {
      expect(map[code]).toBeDefined();
      expect(map[code].status).toBe('available');
    }

    // Locked courses
    const expectedLocked = ['ACT202', 'MGT351', 'FIN254'];
    for (const code of expectedLocked) {
      expect(map[code]).toBeDefined();
      expect(map[code].status).toBe('locked');
      expect(map[code].missing).toBeTruthy();
    }

    // Maybe courses
    const expectedMaybe = ['ENG103', 'BUS172', 'BUS135', 'BUS498'];
    for (const code of expectedMaybe) {
      expect(map[code]).toBeDefined();
      expect(map[code].status).toBe('maybe');
    }

    expect(map['BUS498'].missing).toBe('Requires completion of all coursework. Confirm with your advisor.');
  });

  test('Acceptance Check #3: completed=["ENG102"] unlocks ENG103; waived=["BUS112"] unlocks BUS172 & BUS135 with 0 credits', async () => {
    // 1. ENG102 completed -> ENG103 is available
    const res1 = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['ENG102'] });

    expect(res1.status).toBe(200);
    expect(res1.body.courseMap['ENG103'].status).toBe('available');
    expect(res1.body.completedCredits).toBe(3);

    // 2. BUS112 waived -> BUS172 and BUS135 are available, completedCredits stays 0
    const res2 = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: [], waived: ['BUS112'] });

    expect(res2.status).toBe(200);
    expect(res2.body.courseMap['BUS112'].status).toBe('waived');
    expect(res2.body.courseMap['BUS172'].status).toBe('available');
    expect(res2.body.courseMap['BUS135'].status).toBe('available');
    expect(res2.body.completedCredits).toBe(0);
  });

  test('Acceptance Check #4: completed=["ACT201","BUS172"] -> FIN254 is "available"', async () => {
    const res = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['ACT201', 'BUS172'] });

    expect(res.status).toBe(200);
    expect(res.body.courseMap['FIN254'].status).toBe('available');
  });

  test('Acceptance Check #5: INB372 and MGT314 prerequisite chains', async () => {
    // INB372 needs MKT202 and ECO104 (which needs ECO101)
    // Test with missing ECO104
    const resInbMissing = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['MKT202'] });
    expect(resInbMissing.body.courseMap['INB372'].status).toBe('locked');

    // Test with both satisfied
    const resInbDone = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['MKT202', 'ECO104'] });
    expect(resInbDone.body.courseMap['INB372'].status).toBe('available');

    // MGT314 needs BUS135, BUS172, MKT202 and MGT212
    // Test with one missing (e.g. missing BUS135)
    const resMgtMissing = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['BUS172', 'MKT202', 'MGT212'] });
    expect(resMgtMissing.body.courseMap['MGT314'].status).toBe('locked');

    // Test with all present
    const resMgtDone = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['BUS135', 'BUS172', 'MKT202', 'MGT212'] });
    expect(resMgtDone.body.courseMap['MGT314'].status).toBe('available');
  });

  test('Acceptance Check #6: MGT489 min_credits=100 and BUS498 always maybe', async () => {
    // With 0 credits: MGT489 locked, BUS498 maybe
    const res0 = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: [] });
    expect(res0.body.courseMap['MGT489'].status).toBe('locked');
    expect(res0.body.courseMap['BUS498'].status).toBe('maybe');

    // Build completed list reaching >= 100 credits
    const { courses } = (await request(app).get('/api/curriculum?program=BBA')).body;
    const manyCourses = [];
    let creds = 0;
    for (const c of courses) {
      if (c.code !== 'MGT489' && c.code !== 'BUS498') {
        manyCourses.push(c.code);
        creds += c.credits;
        if (creds >= 102) break;
      }
    }

    const res100 = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: manyCourses });

    expect(res100.body.completedCredits).toBeGreaterThanOrEqual(100);
    expect(res100.body.courseMap['MGT489'].status).toBe('available');
    // BUS498 is still maybe
    expect(res100.body.courseMap['BUS498'].status).toBe('maybe');
  });

  test('Acceptance Check #7: HRM370 and MKT382 duplicate handling and majorProgress', async () => {
    const res = await request(app).get('/api/curriculum?program=BBA');
    const courses = res.body.courses;

    const hrm370Occurrences = courses.filter((c) => c.code === 'HRM370');
    expect(hrm370Occurrences.length).toBe(1);
    expect(hrm370Occurrences[0].majors).toEqual(
      expect.arrayContaining([
        { major: 'HRM', kind: 'elective' },
        { major: 'MGT', kind: 'core' },
      ])
    );

    const mkt382Occurrences = courses.filter((c) => c.code === 'MKT382');
    expect(mkt382Occurrences.length).toBe(1);
    expect(mkt382Occurrences[0].majors).toEqual(
      expect.arrayContaining([
        { major: 'MKT', kind: 'elective' },
        { major: 'INB', kind: 'core' },
      ])
    );

    // Status check with major=MGT
    const statusMgt = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['HRM370'], major: 'MGT' });

    expect(statusMgt.body.majorProgress).toBeDefined();
    expect(statusMgt.body.majorProgress.core.done).toBeGreaterThanOrEqual(1);

    // Status check with major=HRM
    const statusHrm = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['HRM370'], major: 'HRM' });

    expect(statusHrm.body.majorProgress).toBeDefined();
    expect(statusHrm.body.majorProgress.elective.done).toBeGreaterThanOrEqual(1);
  });

  test('Acceptance Check #8: PHI104 alias counts as PHI401', async () => {
    const res = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['PHI104'] });

    expect(res.status).toBe(200);
    expect(res.body.courseMap['PHI401'].status).toBe('done');
  });

  test('Acceptance Check #9: Prerequisite cycle check passes on clean files, fails on cycle', () => {
    // Both files pass cycle check
    const csePath = path.resolve(__dirname, '../../../../data/CSE_nsu_courses.csv');
    const bbaPath = path.resolve(__dirname, '../../../../data/BBA_nsu_courses.csv');

    const cseCourses = parseCurriculumCsv(csePath, 'CSE');
    expect(() => checkPrerequisiteCycles(cseCourses)).not.toThrow();

    const bbaCourses = parseCurriculumCsv(bbaPath, 'BBA');
    expect(() => checkPrerequisiteCycles(bbaCourses)).not.toThrow();

    // Artificial cycle fails with clear error
    const cyclicCourses = [
      { code: 'CRS101', prereqGroups: [['CRS102']] },
      { code: 'CRS102', prereqGroups: [['CRS103']] },
      { code: 'CRS103', prereqGroups: [['CRS101']] },
    ];

    expect(() => checkPrerequisiteCycles(cyclicCourses)).toThrow(/Prerequisite cycle detected/);
  });

  test('Acceptance Check #10: GET /api/sections?eligibleOnly=true&program=BBA returns sections of available BBA courses', async () => {
    const res = await request(app).get('/api/sections?eligibleOnly=true&program=BBA&completed=ENG102');
    expect(res.status).toBe(200);
    // ENG103 is available when ENG102 is completed
    const coursesFound = new Set(res.body.items.map((i) => i.course.replace(/\s+/g, '').toUpperCase()));
    for (const c of coursesFound) {
      // Must not contain locked courses like ACT202
      expect(c).not.toBe('ACT202');
    }
  });

  test('Acceptance Check #11: Redis down fallback works seamlessly', async () => {
    await closeRedis();

    const resProg = await request(app).get('/api/curriculum/programs');
    expect(resProg.status).toBe(200);

    const resBba = await request(app).get('/api/curriculum?program=BBA');
    expect(resBba.status).toBe(200);
    expect(resBba.body.totalCourses).toBe(124);

    const resStatus = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['ENG102'] });
    expect(resStatus.status).toBe(200);
  });
});
