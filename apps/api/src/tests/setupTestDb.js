const { newDb } = require('pg-mem');
const path = require('path');
const { setPool, getPool } = require('../db/pool');
const { seedDatabase } = require('../db/seed');
const { closeRedis } = require('../cache/redisClient');

let memoryPool = null;
let isSeeded = false;

async function setupTestDb() {
  let useLiveDb = false;
  if (process.env.DATABASE_URL && process.env.USE_REAL_DB_FOR_TESTS === 'true') {
    try {
      const p = getPool();
      await p.query('SELECT 1');
      useLiveDb = true;
    } catch (e) {
      useLiveDb = false;
    }
  }

  if (!useLiveDb) {
    if (!memoryPool) {
      const memDb = newDb();
      const { Pool } = memDb.adapters.createPg();
      memoryPool = new Pool();
      setPool(memoryPool);
    } else {
      setPool(memoryPool);
    }

    if (!isSeeded) {
      const dataPath = path.resolve(__dirname, '../../../../data/response.json');
      await seedDatabase(memoryPool, dataPath);
      isSeeded = true;
    }
  }
}

async function teardownTestDb() {
  await closeRedis();
}

module.exports = {
  setupTestDb,
  teardownTestDb,
};
