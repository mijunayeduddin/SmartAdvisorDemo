const request = require('supertest');
const app = require('../app');
const { setupTestDb, teardownTestDb } = require('./setupTestDb');

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
});

describe('SmartAdvisor Sections API - Search, Filters, Sorting, and Validation', () => {
  test('Acceptance Check #3: Searching "ACT201" returns only ACT201 sections', async () => {
    const res = await request(app).get('/api/sections?q=ACT201');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.course).toBe('ACT201');
    }
  });

  test('Acceptance Check #4: Searching "monday" returns only sections whose days include M', async () => {
    const res = await request(app).get('/api/sections?q=monday');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.days).toContain('M');
    }
  });

  test('Multi-word search: Every word must match (case-insensitive)', async () => {
    const res = await request(app).get('/api/sections?q=ACT201 ARM');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.course).toBe('ACT201');
      expect(item.faculty.toUpperCase()).toBe('ARM');
    }
  });

  test('Acceptance Check #5: openOnly=true returns only rows with seats > 0', async () => {
    const res = await request(app).get('/api/sections?openOnly=true');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.seats).toBeGreaterThan(0);
    }
  });

  test('Department filter: dept=ACT returns only ACT sections', async () => {
    const res = await request(app).get('/api/sections?dept=ACT');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.department).toBe('ACT');
    }
  });

  test('Day filter: day=M returns only sections with M in days', async () => {
    const res = await request(app).get('/api/sections?day=M');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.days).toContain('M');
    }
  });

  test('Faculty filter: returns matching faculty', async () => {
    const res = await request(app).get('/api/sections?faculty=ARM');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.faculty.toUpperCase()).toContain('ARM');
    }
  });

  test('Sorting: sort=seats&order=desc sorts properly', async () => {
    const res = await request(app).get('/api/sections?sort=seats&order=desc&limit=20');
    expect(res.status).toBe(200);
    const seatsList = res.body.items.map((i) => i.seats);
    for (let i = 0; i < seatsList.length - 1; i++) {
      expect(seatsList[i]).toBeGreaterThanOrEqual(seatsList[i + 1]);
    }
  });

  test('Sorting: sort=course&order=asc sorts alphabetically', async () => {
    const res = await request(app).get('/api/sections?sort=course&order=asc&limit=20');
    expect(res.status).toBe(200);
    const courseList = res.body.items.map((i) => i.course);
    for (let i = 0; i < courseList.length - 1; i++) {
      expect(courseList[i].localeCompare(courseList[i + 1])).toBeLessThanOrEqual(0);
    }
  });

  test('Pagination: respects limit and page calculation', async () => {
    const resPage1 = await request(app).get('/api/sections?limit=10&page=1');
    const resPage2 = await request(app).get('/api/sections?limit=10&page=2');
    expect(resPage1.status).toBe(200);
    expect(resPage2.status).toBe(200);
    expect(resPage1.body.items.length).toBe(10);
    expect(resPage2.body.items.length).toBe(10);
    expect(resPage1.body.items[0].id).not.toBe(resPage2.body.items[0].id);
  });

  test('Input validation: invalid sort parameter returns 400', async () => {
    const res = await request(app).get('/api/sections?sort=invalid_column');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid sort parameter/i);
  });

  test('Input validation: invalid order parameter returns 400', async () => {
    const res = await request(app).get('/api/sections?order=invalid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid order parameter/i);
  });

  test('Input validation: invalid day parameter returns 400', async () => {
    const res = await request(app).get('/api/sections?day=INVALID');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid day parameter/i);
  });

  test('Input validation: limit exceeding 200 returns 400', async () => {
    const res = await request(app).get('/api/sections?limit=250');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid limit parameter/i);
  });

  test('Input validation: negative page returns 400', async () => {
    const res = await request(app).get('/api/sections?page=-5');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid page parameter/i);
  });
});

const { parseTimeField } = require('../db/seed');

describe('Time Parser and Duplicate Days Validation', () => {
  test('Parser: "MW 04:20 PM - 05:50 PM" gives days "MW", start 16:20:00, end 17:50:00', () => {
    const result = parseTimeField('MW 04:20 PM - 05:50 PM');
    expect(result.days).toBe('MW');
    expect(result.startTime).toBe('16:20:00');
    expect(result.endTime).toBe('17:50:00');
  });

  test('Parser: "RA 01:00 PM - 02:30 PM" gives days "RA", "STWR 09:40 AM - 11:10 AM" gives days "STWR"', () => {
    const raResult = parseTimeField('RA 01:00 PM - 02:30 PM');
    expect(raResult.days).toBe('RA');
    expect(raResult.startTime).toBe('13:00:00');
    expect(raResult.endTime).toBe('14:30:00');

    const stwrResult = parseTimeField('STWR 09:40 AM - 11:10 AM');
    expect(stwrResult.days).toBe('STWR');
    expect(stwrResult.startTime).toBe('09:40:00');
    expect(stwrResult.endTime).toBe('11:10:00');
  });

  test('Parser: "TBA" gives days "", start_time NULL, end_time NULL', () => {
    const result = parseTimeField('TBA');
    expect(result.days).toBe('');
    expect(result.startTime).toBeNull();
    expect(result.endTime).toBeNull();
  });

  test('API: no item returned by GET /api/sections has time_raw with duplicate days (^([SMTWRFA]+)\\1)', async () => {
    const res = await request(app).get('/api/sections?limit=200');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);

    const dupRegex = /^([SMTWRFA]+)\1/;
    for (const item of res.body.items) {
      expect(item.time_raw).not.toMatch(dupRegex);
    }
  });

  test('API: GET /api/sections?day=M returns only sections whose days include M', async () => {
    const res = await request(app).get('/api/sections?day=M&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.days).toContain('M');
    }
  });

  test('API: GET /api/sections?q=monday returns only sections whose days include M', async () => {
    const res = await request(app).get('/api/sections?q=monday&limit=100');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.days).toContain('M');
    }
  });
});

