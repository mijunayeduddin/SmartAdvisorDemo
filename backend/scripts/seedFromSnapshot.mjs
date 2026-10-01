/**
 * scripts/seedFromSnapshot.mjs
 *
 * One-off script: calls fetchNormalizedCourses() once, then bulk-inserts the
 * result into the sections table so we have realistic seed data from the live
 * RDS4 site instead of hand-written fixtures.
 *
 * Usage:
 *   node backend/scripts/seedFromSnapshot.mjs [--term "Fall 2026"] [--dry-run]
 *
 * Options:
 *   --term    Semester label stored in sections.term (default: "Fall 2026")
 *   --dry-run Print rows without writing to the database
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ── resolve CommonJS imports from an ESM context ────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

// Load dotenv before pg so the config picks up DB_* variables
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = require('pg');

// ── import our scraper ───────────────────────────────────────────────────────
import { fetchNormalizedCourses } from './scrape_courses.mjs';

// ── CLI args ─────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const dryRun      = args.includes('--dry-run');
const fromFixture = args.includes('--from-fixture');

// Accepts both: --term="Fall 2026"  and  --term "Fall 2026"
let termArg = 'Fall 2026';
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--term=')) {
    termArg = args[i].replace('--term=', '').replace(/^['"]|['"]$/g, '');
    break;
  }
  if (args[i] === '--term' && args[i + 1] && !args[i + 1].startsWith('--')) {
    termArg = args[i + 1].replace(/^['"]|['"]$/g, '');
    break;
  }
}

// ── DB pool (local to this script, closed on exit) ───────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER     || 'smartadvisor',
  password: process.env.DB_PASSWORD || 'advisor_secret_pass',
  database: process.env.DB_NAME     || 'smartadvisor_db',
});

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve course UUID from code.
 * Returns null if the course is not in the catalog (section will be skipped).
 *
 * @param {import('pg').PoolClient} client
 * @param {string} code
 * @returns {Promise<string|null>}
 */
const codeCache = new Map();
async function resolveCourseId(client, code) {
  if (codeCache.has(code)) return codeCache.get(code);

  const { rows } = await client.query(
    'SELECT id FROM courses WHERE code = $1 LIMIT 1',
    [code]
  );
  const id = rows[0]?.id ?? null;
  codeCache.set(code, id);
  return id;
}

async function connectWithRetry(pool, maxRetries = 5, delayMs = 1500) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (err) {
      if (i === maxRetries) throw err;
      console.log(`⏳ Waiting for database connection (attempt ${i}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('================================================');
  console.log('🌐 SmartAdvisor — Seed From Live RDS4 Snapshot');
  console.log(`📅 Term: ${termArg}`);
  if (dryRun) console.log('🔍 DRY-RUN mode — no DB writes');
  console.log('================================================\n');

  // 1. Fetch data (live RDS4 or snapshot fixture)
  let rows;
  if (fromFixture) {
    console.log('📂 Loading offered courses from local snapshot fixture...');
    const fixturePath = path.resolve(__dirname, 'fixtures/offered_courses_snapshot.json');
    rows = require(fixturePath);
    console.log(`✅ Loaded ${rows.length} section row(s) from snapshot fixture.\n`);
  } else {
    console.log('⏳ Fetching offered courses from RDS4...');
    try {
      rows = await fetchNormalizedCourses();
      console.log(`✅ Scraped ${rows.length} section row(s).\n`);
    } catch (err) {
      console.warn('⚠️  Live RDS4 scrape failed:', err.message);
      console.warn('💡 Falling back to bundled snapshot fixture: fixtures/offered_courses_snapshot.json\n');
      const fixturePath = path.resolve(__dirname, 'fixtures/offered_courses_snapshot.json');
      rows = require(fixturePath);
      console.log(`✅ Loaded ${rows.length} section row(s) from snapshot fixture.\n`);
    }
  }

  if (dryRun) {
    console.table(rows.slice(0, 10));
    console.log(`\n(dry-run) Would insert up to ${rows.length} row(s) into sections.`);
    process.exit(0);
  }

  if (rows.length === 0) {
    console.warn('⚠️  No rows returned — nothing to insert.');
    process.exit(0);
  }

  // 2. Bulk upsert
  const client = await connectWithRetry(pool);
  let inserted = 0;
  let skipped  = 0;
  let sample   = [];

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      const courseId = await resolveCourseId(client, row.courseCode);

      if (!courseId) {
        console.warn(`  ⚠️  Course not in catalog, skipping: ${row.courseCode}`);
        skipped++;
        continue;
      }

      // Derive capacity from seats_available: assume full section is 35 seats
      // and seats_available is what remains. Adjust DEFAULT_CAPACITY as needed.
      const DEFAULT_CAPACITY = 35;
      const enrolled = Math.max(0, DEFAULT_CAPACITY - row.seatsAvailable);

      await client.query(
        `INSERT INTO sections
           (course_id, course_code, section_number,
            faculty_name, day_of_week, start_time, end_time,
            room, seats_available, capacity, enrolled_count, term)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (course_id, term, section_number)
         DO UPDATE SET
           faculty_name    = EXCLUDED.faculty_name,
           day_of_week     = EXCLUDED.day_of_week,
           start_time      = EXCLUDED.start_time,
           end_time        = EXCLUDED.end_time,
           room            = EXCLUDED.room,
           seats_available = EXCLUDED.seats_available,
           capacity        = EXCLUDED.capacity,
           enrolled_count  = EXCLUDED.enrolled_count,
           course_code     = EXCLUDED.course_code`,
        [
          courseId,
          row.courseCode,
          row.sectionNumber,
          row.faculty,
          row.days,
          row.startTime,
          row.endTime,
          row.room,
          row.seatsAvailable,
          DEFAULT_CAPACITY,
          enrolled,
          termArg,
        ]
      );

      inserted++;
    }

    await client.query('COMMIT');

    // 3. Sample 5 rows from DB for verification
    const res = await client.query(
      `SELECT
         s.course_code,
         s.section_number,
         s.faculty_name,
         s.day_of_week,
         s.start_time::text,
         s.end_time::text,
         s.room,
         s.seats_available,
         s.term
       FROM   sections s
       WHERE  s.term = $1
       ORDER  BY s.course_code, s.section_number
       LIMIT  5`,
      [termArg]
    );
    sample = res.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Bulk insert failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }

  console.log('\n================================================');
  console.log(`✅ Inserted/updated: ${inserted} section(s)`);
  console.log(`⏭️  Skipped (not in catalog): ${skipped} section(s)`);
  console.log('================================================\n');

  console.log('📋 Sample 5 rows from sections table:');
  console.table(sample);

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
