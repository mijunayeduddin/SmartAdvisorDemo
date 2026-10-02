/**
 * backend/scripts/seedFromResponse.mjs
 *
 * Bulk-seeds courses and sections from backend/data/response.json into PostgreSQL
 *
 * Usage:
 *   node backend/scripts/seedFromResponse.mjs [--term "Fall 2026"] [--dry-run]
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = require('pg');
const { loadAndParseResponseData } = require('../src/utils/courseDataParser');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

let termArg = 'Fall 2026';
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--term=')) {
    termArg = args[i].replace('--term=', '').replace(/^['"]|['"]$/g, '');
  } else if (args[i] === '--term' && args[i + 1]) {
    termArg = args[i + 1].replace(/^['"]|['"]$/g, '');
  }
}

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'smartadvisor',
  password: process.env.DB_PASSWORD || 'advisor_secret_pass',
  database: process.env.DB_NAME || 'smartadvisor_db',
  connectionTimeoutMillis: 5000,
});

async function main() {
  console.log('==================================================');
  console.log('📚 SmartAdvisor: Seed From response.json Dataset');
  console.log(`Target Term: ${termArg} | Dry Run: ${dryRun}`);
  console.log('==================================================');

  const { courses, sections } = loadAndParseResponseData();
  console.log(`Loaded ${courses.length} courses and ${sections.length} sections from response.json.`);

  if (dryRun) {
    console.log('Dry run complete. No database modifications made.');
    return;
  }

  let client;
  try {
    client = await pool.connect();
    console.log('Connected to PostgreSQL database.');
  } catch (err) {
    console.warn('Could not connect to PostgreSQL database (offline/fallback mode):', err.message);
    console.log('Skipping SQL insert. The in-memory fallback will automatically serve response.json data.');
    return;
  }

  try {
    await client.query('BEGIN');

    // 1. Upsert Courses
    console.log(`Upserting ${courses.length} courses...`);
    for (const c of courses) {
      await client.query(
        `INSERT INTO courses (code, title, credits, department, description, is_milestone)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET
           title = EXCLUDED.title,
           credits = EXCLUDED.credits,
           department = EXCLUDED.department,
           description = EXCLUDED.description,
           is_milestone = EXCLUDED.is_milestone;`,
        [c.code, c.title, c.credits, c.department, c.description, c.isMilestone]
      );
    }

    // Cache course UUIDs
    const { rows: courseRows } = await client.query('SELECT id, code FROM courses;');
    const courseIdMap = new Map(courseRows.map(r => [r.code, r.id]));

    // 2. Upsert Sections
    console.log(`Upserting ${sections.length} sections for term ${termArg}...`);
    let inserted = 0;
    for (const s of sections) {
      const courseId = courseIdMap.get(s.course_code);
      if (!courseId) continue;

      await client.query(
        `INSERT INTO sections (
           course_id, course_code, section_number, capacity, enrolled_count,
           seats_available, room, day_of_week, start_time, end_time, faculty_name, term
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (course_id, term, section_number) DO UPDATE SET
           course_code = EXCLUDED.course_code,
           capacity = EXCLUDED.capacity,
           enrolled_count = EXCLUDED.enrolled_count,
           seats_available = EXCLUDED.seats_available,
           room = EXCLUDED.room,
           day_of_week = EXCLUDED.day_of_week,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           faculty_name = EXCLUDED.faculty_name;`,
        [
          courseId,
          s.course_code,
          s.section_number,
          s.capacity,
          s.enrolled_count,
          s.seats_available,
          s.room,
          s.day_of_week,
          s.start_time,
          s.end_time,
          s.faculty_name,
          termArg
        ]
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${courses.length} courses and ${inserted} sections.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during database seed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
