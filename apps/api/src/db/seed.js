const fs = require('fs');
const path = require('path');
const { getPool, query } = require('./pool');
const { parseCurriculumCsv } = require('../services/curriculumParser');

function parse12HourTime(timeStr) {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
}

function parseTimeField(timeRaw) {
  if (!timeRaw || timeRaw.trim().toUpperCase() === 'TBA') {
    return { days: '', startTime: null, endTime: null };
  }
  const match = timeRaw.trim().match(/^([SMTWRFA]+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
  if (!match) {
    return { days: '', startTime: null, endTime: null };
  }
  const days = match[1].toUpperCase();
  const startTime = parse12HourTime(match[2]);
  const endTime = parse12HourTime(match[3]);
  return { days, startTime, endTime };
}

function parseDepartment(course) {
  const match = (course || '').match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '';
}

function findDataFilePath(customPath) {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  const candidatePaths = [
    process.env.DATA_PATH,
    path.resolve(__dirname, '../../../../data/response.json'),
    path.resolve(__dirname, '../../../data/response.json'),
    path.resolve(__dirname, '../../data/response.json'),
    path.resolve(process.cwd(), 'data/response.json'),
    path.resolve(process.cwd(), '../data/response.json'),
    path.resolve(process.cwd(), 'response.json'),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('data/response.json could not be found in any expected location.');
}

function findCurriculumFilePath(program = 'CSE', customPath = null) {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  const normProg = (program || 'CSE').toUpperCase();
  const filename = normProg === 'BBA' ? 'BBA_nsu_courses.csv' : (normProg === 'MIC' ? 'MIC_nsu_courses.csv' : 'CSE_nsu_courses.csv');
  const envVar = normProg === 'BBA' ? process.env.BBA_CURRICULUM_DATA_PATH : (normProg === 'MIC' ? process.env.MIC_CURRICULUM_DATA_PATH : process.env.CURRICULUM_DATA_PATH);

  const candidatePaths = [
    envVar,
    path.resolve(__dirname, `../../../../data/${filename}`),
    path.resolve(__dirname, `../../../data/${filename}`),
    path.resolve(__dirname, `../../data/${filename}`),
    path.resolve(process.cwd(), `data/${filename}`),
    path.resolve(process.cwd(), `../data/${filename}`),
    path.resolve(process.cwd(), filename),
    path.resolve(process.cwd(), `../../${filename}`),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(`data/${filename} could not be found in any expected location.`);
}

async function initSchema(poolInstance) {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const q = poolInstance ? poolInstance.query.bind(poolInstance) : query;

  try {
    if (poolInstance) {
      await poolInstance.query(schemaSql);
    } else {
      await query(schemaSql);
    }
  } catch (e) {
    // If table already exists or partial failure, proceed with migrations
  }

  // Defensive migrations for pre-existing tables
  const migrationQueries = [
    `ALTER TABLE curriculum_courses ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'CSE'`,
    `ALTER TABLE curriculum_courses ADD COLUMN IF NOT EXISTS waivable BOOL DEFAULT FALSE`,
    `ALTER TABLE curriculum_courses ADD COLUMN IF NOT EXISTS elective_pool TEXT NULL`,
    `ALTER TABLE curriculum_courses ADD COLUMN IF NOT EXISTS note TEXT NULL`,
    `ALTER TABLE curriculum_courses ADD COLUMN IF NOT EXISTS coreq_codes TEXT[] DEFAULT '{}'`,
    `ALTER TABLE curriculum_courses ADD COLUMN IF NOT EXISTS has_waiver_option BOOL DEFAULT FALSE`,
    `ALTER TABLE curriculum_courses ADD COLUMN IF NOT EXISTS special TEXT NULL`,
    `ALTER TABLE curriculum_prereqs ADD COLUMN IF NOT EXISTS program TEXT DEFAULT 'CSE'`,
    `CREATE TABLE IF NOT EXISTS curriculum_course_majors (
       program TEXT NOT NULL,
       code TEXT NOT NULL,
       major TEXT NOT NULL,
       kind TEXT NOT NULL,
       PRIMARY KEY (program, code, major, kind)
     )`,
  ];

  for (const mQuery of migrationQueries) {
    try {
      await q(mQuery);
    } catch (ignore) {}
  }
}

async function seedSingleProgram(pool, program, filePath) {
  const resolvedPath = findCurriculumFilePath(program, filePath);
  const courses = parseCurriculumCsv(resolvedPath, program);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert curriculum courses
    for (const c of courses) {
      await client.query(
        `INSERT INTO curriculum_courses (
          program, code, aliases, name, credits, grp, min_credits, has_alternative,
          raw_prereq, unknown_prereqs, waivable, elective_pool, note, coreq_codes,
          has_waiver_option, special
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (program, code) DO UPDATE SET
          aliases = EXCLUDED.aliases,
          name = EXCLUDED.name,
          credits = EXCLUDED.credits,
          grp = EXCLUDED.grp,
          min_credits = EXCLUDED.min_credits,
          has_alternative = EXCLUDED.has_alternative,
          raw_prereq = EXCLUDED.raw_prereq,
          unknown_prereqs = EXCLUDED.unknown_prereqs,
          waivable = EXCLUDED.waivable,
          elective_pool = EXCLUDED.elective_pool,
          note = EXCLUDED.note,
          coreq_codes = EXCLUDED.coreq_codes,
          has_waiver_option = EXCLUDED.has_waiver_option,
          special = EXCLUDED.special;`,
        [
          program,
          c.code,
          c.aliases,
          c.name,
          c.credits,
          c.grp,
          c.min_credits,
          c.has_alternative,
          c.raw_prereq,
          c.unknown_prereqs,
          c.waivable || false,
          c.elective_pool || null,
          c.note || null,
          c.coreq_codes || [],
          c.has_waiver_option || false,
          c.special || null,
        ]
      );
    }

    // Replace curriculum prerequisites for this program
    await client.query('DELETE FROM curriculum_prereqs WHERE program = $1', [program]);
    for (const c of courses) {
      if (c.prereqGroups && c.prereqGroups.length > 0) {
        for (let g = 0; g < c.prereqGroups.length; g++) {
          const groupNo = g + 1;
          for (const altCode of c.prereqGroups[g]) {
            await client.query(
              `INSERT INTO curriculum_prereqs (program, course_code, group_no, alt_code) VALUES ($1, $2, $3, $4)`,
              [program, c.code, groupNo, altCode]
            );
          }
        }
      }
    }

    // Replace curriculum course majors for this program
    await client.query('DELETE FROM curriculum_course_majors WHERE program = $1', [program]);
    for (const c of courses) {
      if (c.majors && c.majors.length > 0) {
        for (const m of c.majors) {
          await client.query(
            `INSERT INTO curriculum_course_majors (program, code, major, kind) VALUES ($1, $2, $3, $4)
             ON CONFLICT (program, code, major, kind) DO NOTHING`,
            [program, c.code, m.major, m.kind]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${courses.length} ${program} curriculum courses into the database.`);
    return courses.length;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedCurriculum(poolInstance = null, programOrPath = null, curriculumFilePath = null) {
  const pool = poolInstance || getPool();
  await initSchema(pool);

  let program = null;
  let customPath = null;

  if (typeof programOrPath === 'string') {
    if (programOrPath.toUpperCase() === 'CSE' || programOrPath.toUpperCase() === 'BBA' || programOrPath.toUpperCase() === 'MIC') {
      program = programOrPath.toUpperCase();
      customPath = curriculumFilePath;
    } else {
      customPath = programOrPath;
    }
  }

  if (program) {
    return await seedSingleProgram(pool, program, customPath);
  }

  // Default: Seed CSE, BBA, and MIC
  const cseCount = await seedSingleProgram(pool, 'CSE', customPath);
  const bbaCount = await seedSingleProgram(pool, 'BBA', null);
  const micCount = await seedSingleProgram(pool, 'MIC', null);
  return cseCount + bbaCount + micCount;
}

async function seedDatabase(poolInstance = null, dataFilePath = null, curriculumFilePath = null) {
  const pool = poolInstance || getPool();
  await initSchema(pool);

  // 1. Seed sections
  const resolvedPath = findDataFilePath(dataFilePath);
  const rawData = fs.readFileSync(resolvedPath, 'utf8');
  const sections = JSON.parse(rawData);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const batchSize = 100;
    for (let i = 0; i < sections.length; i += batchSize) {
      const batch = sections.slice(i, i + batchSize);
      const values = [];
      const valuePlaceholders = [];

      batch.forEach((row, rowIndex) => {
        const course = (row.Course || '').trim();
        const department = parseDepartment(course);
        const section = parseInt(row.Section || '0', 10);
        const faculty = (row.Faculty || 'TBA').trim();
        const timeRaw = (row.Time || 'TBA').trim();
        const { days, startTime, endTime } = parseTimeField(timeRaw);
        const room = (row.Room || 'TBA').trim();
        const seats = parseInt(row.Seats || '0', 10);
        const semester = row.Semester ? row.Semester.trim() : null;
        const prediction = row.Prediction ? row.Prediction.trim() : null;
        const records = row.Records ? row.Records.trim() : null;

        const offset = rowIndex * 13;
        valuePlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13})`
        );

        values.push(
          course,
          department,
          section,
          faculty,
          timeRaw,
          days,
          startTime,
          endTime,
          room,
          seats,
          semester,
          prediction,
          records
        );
      });

      const insertSql = `
        INSERT INTO sections (
          course, department, section, faculty, time_raw, days, start_time, end_time, room, seats, semester, prediction, records
        ) VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (course, section, time_raw, room) DO UPDATE SET
          department = EXCLUDED.department,
          faculty = EXCLUDED.faculty,
          days = EXCLUDED.days,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          seats = EXCLUDED.seats,
          semester = EXCLUDED.semester,
          prediction = EXCLUDED.prediction,
          records = EXCLUDED.records;
      `;

      await client.query(insertSql, values);
    }

    await client.query('COMMIT');
    console.log(`Successfully seeded ${sections.length} sections into the database.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // 2. Seed curriculum for both programs
  await seedCurriculum(pool, null, curriculumFilePath);

  return sections.length;
}

if (require.main === module) {
  (async () => {
    try {
      const testClient = await Promise.race([
        getPool().connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 1500)),
      ]);
      testClient.release();
    } catch (e) {
      console.warn('Live PostgreSQL not detected at', process.env.DATABASE_URL || 'localhost:5432');
      console.log('Falling back to in-memory PostgreSQL engine (pg-mem)...');
      const { newDb } = require('pg-mem');
      const memDb = newDb();
      const { Pool: MemPool } = memDb.adapters.createPg();
      const { setPool } = require('./pool');
      setPool(new MemPool());
    }

    return seedDatabase();
  })()
    .then((count) => {
      console.log(`Seeding complete: ${count} sections.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
  seedCurriculum,
  seedSingleProgram,
  parseTimeField,
  parseDepartment,
  parse12HourTime,
  initSchema,
  findDataFilePath,
  findCurriculumFilePath,
};
