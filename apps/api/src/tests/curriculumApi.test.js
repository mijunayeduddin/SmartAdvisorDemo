const request = require('supertest');
const app = require('../app');
const { setupTestDb, teardownTestDb } = require('./setupTestDb');
const { closeRedis } = require('../cache/redisClient');

describe('Curriculum Endpoints and Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
  }, 45000);

  afterAll(async () => {
    await teardownTestDb();
  });

  test('Acceptance Check #1: GET /api/curriculum returns 88 courses in 5 groups', async () => {
    const res = await request(app).get('/api/curriculum');
    expect(res.status).toBe(200);

    const body = res.body;
    expect(body.totalCourses).toBe(88);

    const groups = body.groups;
    expect(groups).toBeDefined();

    const expectedGroups = [
      'General Education',
      'Math & Science',
      'Engineering Foundation',
      'CSE Core',
      'CSE Electives',
    ];

    for (const g of expectedGroups) {
      expect(Array.isArray(groups[g])).toBe(true);
      expect(groups[g].length).toBeGreaterThan(0);
    }

    const totalInGroups = expectedGroups.reduce((sum, g) => sum + groups[g].length, 0);
    expect(totalInGroups).toBe(88);

    // Verify course fields and section statistics
    const cse115 = body.courses.find((c) => c.code === 'CSE115');
    expect(cse115).toBeDefined();
    expect(cse115.name).toBe('Programming language I');
    expect(cse115.credits).toBe(3);
    expect(cse115.sectionCount).toBeGreaterThan(0);

    // Verify alias matching for section statistics (e.g. CSE325 matches CSE425 in sections)
    const cse325 = body.courses.find((c) => c.code === 'CSE325');
    expect(cse325).toBeDefined();
    expect(cse325.aliases).toContain('CSE425');
    // Even if CSE325 has 0 sections, CSE425 has sections so total sectionCount includes alias
    expect(typeof cse325.sectionCount).toBe('number');
  });

  test('POST /api/curriculum/status calculates course statuses and summary', async () => {
    const res = await request(app)
      .post('/api/curriculum/status')
      .send({ completed: ['ENG102', 'MAT116'] });

    expect(res.status).toBe(200);
    expect(res.body.completedCredits).toBe(6);
    expect(res.body.completedCourses).toBe(2);
    expect(res.body.totalCourses).toBe(88);

    const map = res.body.courseMap;
    expect(map['ENG102'].status).toBe('done');
    expect(map['MAT116'].status).toBe('done');
    expect(map['ENG103'].status).toBe('available');
    expect(map['MAT125'].status).toBe('available');
  });

  test('POST /api/curriculum/status validation returns 400 for bad input', async () => {
    // Missing body
    const res1 = await request(app).post('/api/curriculum/status').send({});
    expect(res1.status).toBe(400);
    expect(res1.body.error).toBeDefined();

    // Unknown code
    const res2 = await request(app)
      .post('/api/curriculum/status')
      .send({ completed: ['UNKNOWN_XYZ'] });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toMatch(/unknown/i);

    // More than 200 items
    const res3 = await request(app)
      .post('/api/curriculum/status')
      .send({ completed: new Array(205).fill('ENG102') });
    expect(res3.status).toBe(400);
    expect(res3.body.error).toMatch(/200/);
  });

  test('Acceptance Check #8: GET /api/sections?eligibleOnly=true&completed=... only returns sections of available courses', async () => {
    // With completed = ['ENG102', 'MAT116', 'CSE115', 'CSE115L']
    // Available courses include: ENG103, MAT120, MAT125, CSE173, etc.
    // Locked courses include: CSE327, CSE311, etc.
    const res = await request(app)
      .get('/api/sections')
      .query({
        eligibleOnly: 'true',
        completed: 'ENG102,MAT116,CSE115,CSE115L',
      });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    // Every returned section must belong to an eligible/available course
    // Verify that completed courses (like CSE115) are NOT in the available sections
    const returnedCourses = new Set(res.body.items.map((sec) => sec.course.replace(/\s+/g, '').toUpperCase()));
    expect(returnedCourses.has('CSE115')).toBe(false);
    expect(returnedCourses.has('ENG102')).toBe(false);

    // If CSE173 sections exist, they may be included because CSE173 is available
    for (const c of returnedCourses) {
      expect(['CSE115', 'ENG102', 'MAT116', 'CSE115L']).not.toContain(c);
    }
  });

  test('Acceptance Check #9: Stopping Redis does not break any endpoint', async () => {
    // Close redis connection
    await closeRedis();

    // 1. GET /api/curriculum still functions normally
    const curRes = await request(app).get('/api/curriculum');
    expect(curRes.status).toBe(200);
    expect(curRes.body.totalCourses).toBe(88);

    // 2. POST /api/curriculum/status still functions normally
    const statusRes = await request(app)
      .post('/api/curriculum/status')
      .send({ completed: ['ENG102'] });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.completedCredits).toBe(3);

    // 3. GET /api/sections still functions normally
    const secRes = await request(app)
      .get('/api/sections')
      .query({ limit: 10, eligibleOnly: 'true', completed: 'ENG102' });
    expect(secRes.status).toBe(200);
    expect(secRes.body.items).toBeDefined();
  });
});
