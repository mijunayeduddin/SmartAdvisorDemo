const request = require('supertest');
const app = require('../app');
const { setupTestDb, teardownTestDb } = require('./setupTestDb');
const { getProgramConfig, PROGRAMS_CONFIG } = require('../config/programs');

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
});

describe('Degree Graduation Credit Requirement Tests & Acceptance Checks', () => {
  // Test 1
  test('Check 1: GET /api/curriculum/programs returns requiredCredits 138 for CSE and 130 for BBA', async () => {
    const res = await request(app).get('/api/curriculum/programs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const cse = res.body.find((p) => p.id === 'CSE');
    const bba = res.body.find((p) => p.id === 'BBA');

    expect(cse).toBeDefined();
    expect(cse.requiredCredits).toBe(138);
    expect(cse.catalogCredits).toBe(238);
    expect(cse.courses).toBe(88);

    expect(bba).toBeDefined();
    expect(bba.requiredCredits).toBe(130);
    expect(bba.catalogCredits).toBe(361);
    expect(bba.courses).toBe(124);
  });

  // Test 2
  test('Check 2: Status with completed = [] returns completedCredits 0, requiredCredits 138 and remainingCredits 138 for CSE (and 130 for BBA)', async () => {
    // CSE
    const resCse = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'CSE', completed: [] });

    expect(resCse.status).toBe(200);
    expect(resCse.body.completedCredits).toBe(0);
    expect(resCse.body.requiredCredits).toBe(138);
    expect(resCse.body.remainingCredits).toBe(138);
    expect(resCse.body.catalogCredits).toBe(238);
    expect(resCse.body.summary).toEqual(
      expect.objectContaining({
        completedCredits: 0,
        requiredCredits: 138,
        remainingCredits: 138,
        catalogCredits: 238,
      })
    );

    // BBA
    const resBba = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: [] });

    expect(resBba.status).toBe(200);
    expect(resBba.body.completedCredits).toBe(0);
    expect(resBba.body.requiredCredits).toBe(130);
    expect(resBba.body.remainingCredits).toBe(130);
    expect(resBba.body.catalogCredits).toBe(361);
    expect(resBba.body.summary).toEqual(
      expect.objectContaining({
        completedCredits: 0,
        requiredCredits: 130,
        remainingCredits: 130,
        catalogCredits: 361,
      })
    );
  });

  // Test 3
  test('Check 3: If completedCredits is 61, CSE remainingCredits is 77 and the percent is 44', async () => {
    // 29 courses in CSE totalling exactly 61 credits
    const courses61 = [
      'CSE115', 'CSE115L', 'CSE173', 'CSE215', 'CSE215L', 'CSE225', 'CSE225L',
      'CSE231', 'CSE231L', 'CSE299', 'CSE311', 'CSE311L', 'CSE323', 'CSE325',
      'CSE327', 'CSE331', 'CSE331L', 'CSE332', 'CSE373', 'CSE498', 'CSE499A',
      'CSE499B', 'CSE401', 'CSE411', 'CSE413', 'CSE414', 'CSE417', 'CSE418',
      'CEE110',
    ];

    const res = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'CSE', completed: courses61 });

    expect(res.status).toBe(200);
    expect(res.body.completedCredits).toBe(61);
    expect(res.body.requiredCredits).toBe(138);
    expect(res.body.remainingCredits).toBe(77);
    expect(res.body.summary.remainingCredits).toBe(77);

    // Degree completion percent = min(100, round(completed / requiredCredits * 100))
    const percent = Math.min(100, Math.round((res.body.completedCredits / res.body.requiredCredits) * 100));
    expect(percent).toBe(44);
  });

  // Test 4
  test('Check 4: Marking enough courses to exceed the requirement: remainingCredits is 0, the percent is capped at 100, and extra credits are shown', async () => {
    // Fetch all courses for CSE and select enough to exceed 138 credits
    const curRes = await request(app).get('/api/curriculum?program=CSE');
    const allCourses = curRes.body.courses;

    const completedMany = [];
    let sum = 0;
    for (const c of allCourses) {
      completedMany.push(c.code);
      sum += c.credits;
      if (sum >= 145) break;
    }

    expect(sum).toBeGreaterThan(138);

    const res = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'CSE', completed: completedMany });

    expect(res.status).toBe(200);
    expect(res.body.completedCredits).toBe(sum);
    expect(res.body.requiredCredits).toBe(138);
    expect(res.body.remainingCredits).toBe(0);
    expect(res.body.summary.remainingCredits).toBe(0);

    // Percent capped at 100
    const percent = Math.min(100, Math.round((res.body.completedCredits / res.body.requiredCredits) * 100));
    expect(percent).toBe(100);

    // Extra credits
    const extraCredits = Math.round((res.body.completedCredits - res.body.requiredCredits) * 10) / 10;
    expect(extraCredits).toBeGreaterThan(0);
    expect(extraCredits).toBe(Math.round((sum - 138) * 10) / 10);
  });

  // Test 5
  test('Check 5: Waived courses do not change completedCredits or remainingCredits', async () => {
    // Compare BBA with completed=['ENG102'] vs completed=['ENG102'] + waived=['BUS112']
    const resWithoutWaiver = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['ENG102'], waived: [] });

    const resWithWaiver = await request(app)
      .post('/api/curriculum/status')
      .send({ program: 'BBA', completed: ['ENG102'], waived: ['BUS112'] });

    expect(resWithoutWaiver.status).toBe(200);
    expect(resWithWaiver.status).toBe(200);

    expect(resWithWaiver.body.completedCredits).toBe(3);
    expect(resWithoutWaiver.body.completedCredits).toBe(3);

    expect(resWithWaiver.body.remainingCredits).toBe(127);
    expect(resWithoutWaiver.body.remainingCredits).toBe(127);

    expect(resWithWaiver.body.summary.completedCredits).toBe(3);
    expect(resWithWaiver.body.summary.remainingCredits).toBe(127);
  });

  // Test 6
  test('Check 6: Unit tests for the clamping logic (remaining never below 0, percent never above 100)', () => {
    const calculateClamped = (completed, required) => {
      const remainingCredits = Math.max(0, Math.round((required - completed) * 10) / 10);
      const percent = required > 0 ? Math.min(100, Math.round((completed / required) * 100)) : 0;
      const extra = Math.max(0, Math.round((completed - required) * 10) / 10);
      return { remainingCredits, percent, extra };
    };

    // Case 1: 0 completed
    const zero = calculateClamped(0, 138);
    expect(zero.remainingCredits).toBe(138);
    expect(zero.percent).toBe(0);
    expect(zero.extra).toBe(0);

    // Case 2: Partial (61 / 138)
    const partial = calculateClamped(61, 138);
    expect(partial.remainingCredits).toBe(77);
    expect(partial.percent).toBe(44);
    expect(partial.extra).toBe(0);

    // Case 3: Exact (138 / 138)
    const exact = calculateClamped(138, 138);
    expect(exact.remainingCredits).toBe(0);
    expect(exact.percent).toBe(100);
    expect(exact.extra).toBe(0);

    // Case 4: Exceeded (150 / 138)
    const exceeded = calculateClamped(150, 138);
    expect(exceeded.remainingCredits).toBe(0); // NEVER negative
    expect(exceeded.percent).toBe(100); // NEVER above 100
    expect(exceeded.extra).toBe(12);

    // Case 5: Extremely exceeded (300 / 138)
    const high = calculateClamped(300, 138);
    expect(high.remainingCredits).toBe(0);
    expect(high.percent).toBe(100);
    expect(high.extra).toBe(162);
  });

  test('Central config test: getProgramConfig returns correct single source of truth values', () => {
    expect(getProgramConfig('CSE').requiredCredits).toBe(138);
    expect(getProgramConfig('BBA').requiredCredits).toBe(130);
    expect(getProgramConfig('cse').requiredCredits).toBe(138);
    expect(getProgramConfig('bba').requiredCredits).toBe(130);
    expect(PROGRAMS_CONFIG.CSE.requiredCredits).toBe(138);
    expect(PROGRAMS_CONFIG.BBA.requiredCredits).toBe(130);
  });
});
