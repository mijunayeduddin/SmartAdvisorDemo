const fs = require('fs');
const path = require('path');
const dbPool = require('../patterns/singleton/dbPool');

/**
 * Database Seeder Script
 * Executes backend/src/db/seed.sql transactionally to populate:
 * - 37 BSCSE courses catalog
 * - 28 prerequisite edges
 * - Demo student 2412800642
 * - 24 completed courses (Years 1 & 2 history, 70 credits)
 */
async function seedDatabase() {
  console.log('🌱 [Seeder] Connecting to database...');

  const isConnected = await dbPool.ping();
  if (!isConnected) {
    console.error('❌ [Seeder Error] Database connection failed.');
    console.error('👉 Ensure PostgreSQL is running (e.g. `docker compose up -d` or local PostgreSQL service).');
    process.exit(1);
  }

  const client = await dbPool.getClient();

  try {
    console.log('📖 [Seeder] Reading seed.sql...');
    const seedSqlPath = path.join(__dirname, 'seed.sql');
    const sql = fs.readFileSync(seedSqlPath, 'utf8');

    console.log('⚡ [Seeder] Executing seed transaction...');
    await client.query(sql);

    // Verify seeded data counts
    const { rows: courseRows } = await client.query('SELECT COUNT(*) AS count FROM courses');
    const { rows: prereqRows } = await client.query('SELECT COUNT(*) AS count FROM prerequisites');
    const { rows: studentRows } = await client.query(
      "SELECT student_id, name, completed_credits FROM students WHERE student_id = '2412800642'"
    );
    const { rows: enrollRows } = await client.query(
      "SELECT COUNT(*) AS count FROM enrollments WHERE status = 'completed'"
    );

    console.log('====================================================');
    console.log('🎉 [Seeder] Database successfully seeded!');
    console.log(`📚 Total Courses in Catalog: ${courseRows[0].count}`);
    console.log(`🔗 Total Prerequisite Edges: ${prereqRows[0].count}`);
    if (studentRows.length > 0) {
      const student = studentRows[0];
      console.log(`👤 Demo Student: ${student.name} (${student.student_id})`);
      console.log(`🎓 Completed Credits: ${student.completed_credits} cr`);
      console.log(`✅ Completed Course Records: ${enrollRows[0].count}`);
    }
    console.log('====================================================');
  } catch (error) {
    console.error('❌ [Seeder Error] Failed to execute seed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await dbPool.close();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
