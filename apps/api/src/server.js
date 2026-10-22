const app = require('./app');
const { getPool, setPool, query } = require('./db/pool');
const { initSchema, seedDatabase } = require('./db/seed');
const { connectRedis } = require('./cache/redisClient');

const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer() {
  try {
    // Verify database connection; fallback to in-memory PostgreSQL (pg-mem) if live Postgres is offline
    try {
      const testClient = await Promise.race([
        getPool().connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 1500)),
      ]);
      testClient.release();
    } catch (dbErr) {
      console.warn('Live PostgreSQL not detected at', process.env.DATABASE_URL || 'localhost:5432');
      console.log('Falling back to in-memory PostgreSQL engine (pg-mem) for standalone local execution...');
      const { newDb } = require('pg-mem');
      const memDb = newDb();
      const { Pool: MemPool } = memDb.adapters.createPg();
      setPool(new MemPool());
    }

    // Check if sections and curriculum tables exist and need seeding
    let needsSectionsSeed = false;
    try {
      const countCheck = await query('SELECT COUNT(*)::int AS count FROM sections');
      const existingCount = countCheck.rows[0]?.count || 0;
      if (existingCount === 0) {
        needsSectionsSeed = true;
      } else {
        console.log(`Database already populated with ${existingCount} sections.`);
      }
    } catch (err) {
      needsSectionsSeed = true;
    }

    let needsCurriculumSeed = false;
    try {
      const bbaCheck = await query("SELECT COUNT(*)::int AS count FROM curriculum_courses WHERE program = 'BBA'");
      const bbaCount = bbaCheck.rows[0]?.count || 0;
      const cseCheck = await query("SELECT COUNT(*)::int AS count FROM curriculum_courses WHERE program = 'CSE'");
      const cseCount = cseCheck.rows[0]?.count || 0;
      const micCheck = await query("SELECT COUNT(*)::int AS count FROM curriculum_courses WHERE program = 'MIC'");
      const micCount = micCheck.rows[0]?.count || 0;
      if (bbaCount < 124 || cseCount < 88 || micCount < 50) {
        needsCurriculumSeed = true;
      } else {
        console.log(`Database populated with ${cseCount} CSE, ${bbaCount} BBA, and ${micCount} MIC curriculum courses.`);
      }
    } catch (err) {
      needsCurriculumSeed = true;
    }

    const { seedCurriculum } = require('./db/seed');
    if (needsSectionsSeed) {
      console.log('Database needs seeding. Initializing schema and seeding sections & curriculum...');
      await seedDatabase();
    } else if (needsCurriculumSeed) {
      console.log('Curriculum table needs seeding. Initializing schema and seeding curriculum...');
      await seedCurriculum();
    }

    // Try connecting Redis (non-blocking, app works even if redis is down)
    connectRedis().catch((err) => {
      console.warn('Initial Redis connection warning (cache will remain inactive until Redis is available):', err.message);
    });

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`SmartAdvisor API listening on port ${PORT}`);
    });

    const gracefulShutdown = async () => {
      console.log('Shutting down server gracefully...');
      server.close(async () => {
        try {
          const pool = getPool();
          await pool.end();
        } catch (e) {
          // ignore
        }
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (err) {
    console.error('Fatal error starting SmartAdvisor API server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
