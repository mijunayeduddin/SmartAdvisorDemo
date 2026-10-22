const request = require('supertest');
const app = require('../app');
const { setupTestDb, teardownTestDb } = require('./setupTestDb');
const redisClientModule = require('../cache/redisClient');

beforeAll(async () => {
  await setupTestDb();
}, 30000);

afterAll(async () => {
  await teardownTestDb();
});

describe('SmartAdvisor Metadata, Health, and Resilience', () => {
  test('Acceptance Check #2: GET /api/meta returns totalSections 3814 and totalCourses 735', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body.totalSections).toBe(3814);
    expect(res.body.totalCourses).toBe(735);
    expect(Array.isArray(res.body.departments)).toBe(true);
    expect(res.body.departments.length).toBeGreaterThan(0);
    expect(res.body.departments).toContain('ACT');
    expect(res.body.departments).toContain('CSE');
  });

  test('GET /api/health returns separate status for API, PostgreSQL and Redis', async () => {
    const res = await request(app).get('/api/health');
    // Status is 200 because Postgres and API are ok (redis may be ok or down)
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('api');
    expect(res.body).toHaveProperty('postgres');
    expect(res.body).toHaveProperty('redis');
    expect(res.body.api).toBe('ok');
    expect(res.body.postgres).toBe('ok');
    expect(['ok', 'down']).toContain(res.body.redis);
  });

  test('Acceptance Check #6: Stopping Redis does not break search', async () => {
    // Forcefully ensure Redis cache throws or is inactive
    const originalGetCache = redisClientModule.getCache;
    const originalSetCache = redisClientModule.setCache;

    try {
      // Simulate Redis being completely down
      redisClientModule.getCache = async () => {
        throw new Error('Redis connection refused: ECONNREFUSED 127.0.0.1:6379');
      };
      redisClientModule.setCache = async () => {
        throw new Error('Redis connection refused: ECONNREFUSED 127.0.0.1:6379');
      };

      const res = await request(app).get('/api/sections?q=ACT201');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(35);
      expect(res.body.items.length).toBeGreaterThan(0);
      for (const item of res.body.items) {
        expect(item.course).toBe('ACT201');
      }
    } finally {
      redisClientModule.getCache = originalGetCache;
      redisClientModule.setCache = originalSetCache;
    }
  });
});
