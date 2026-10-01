/**
 * services/seatSyncService.mjs
 *
 * Periodic sync loop: scrapes RDS4 (or reads local snapshot fixture in DEMO_MODE)
 * on a configured interval, persists changed sections to the database via the
 * Singleton DB pool, and notifies the SeatAvailabilityPublisher (Observer Pattern)
 * to broadcast real-time WebSocket updates.
 *
 * This module has NO direct Express dependency. It receives its collaborators
 * (dbPool, publisher) via start() / runOnce(), remaining testable in isolation.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';
import { fetchNormalizedCourses } from '../scripts/scrape_courses.mjs';

const require = createRequire(import.meta.url);

// Lazy-loaded fallbacks for collaborators to preserve standalone testability
let _cachedDefaultDbPool = null;
function getDefaultDbPool() {
  if (!_cachedDefaultDbPool) {
    _cachedDefaultDbPool = require('../src/patterns/singleton/dbPool.js');
  }
  return _cachedDefaultDbPool;
}

let _cachedDefaultPublisher = null;
function getDefaultPublisher() {
  if (!_cachedDefaultPublisher) {
    const { seatAvailabilityPublisher } = require('../core/observer.ts');
    _cachedDefaultPublisher = seatAvailabilityPublisher;
  }
  return _cachedDefaultPublisher;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_PATH = path.resolve(__dirname, '../scripts/fixtures/offered_courses_snapshot.json');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes
const DEFAULT_CAPACITY = 35;

// In-memory cache for course UUIDs (code -> UUID) to avoid N+1 SELECTs
const _courseCodeCache = new Map();

// In-memory seat state tracking: key -> seatsAvailable
// key format: `${term}:${courseCode}:${sectionNumber}`
const _seatCache = new Map();

/**
 * Reset seat cache (useful for testing and deterministic sync runs)
 */
export function clearSeatCache() {
  _seatCache.clear();
}

/**
 * Read current in-memory seat cache
 */
export function getSeatCache() {
  return new Map(_seatCache);
}

/**
 * Load the static snapshot fixture when in DEMO_MODE or as offline fallback.
 * @returns {Array<Object>}
 */
export function loadSnapshotFixture() {
  const content = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(content);
}

/**
 * Resolve course UUID from code using the provided DB pool.
 *
 * @param {any} pool - dbPool instance
 * @param {string} code - Course code (e.g. 'CSE115')
 * @returns {Promise<string|null>}
 */
export async function resolveCourseId(pool, code) {
  if (!code) return null;
  const normalizedCode = code.trim().toUpperCase();
  if (_courseCodeCache.has(normalizedCode)) {
    return _courseCodeCache.get(normalizedCode);
  }

  const res = await pool.query(
    'SELECT id FROM courses WHERE UPPER(code) = $1 LIMIT 1',
    [normalizedCode]
  );

  const id = res.rows[0]?.id ?? null;
  if (id) {
    _courseCodeCache.set(normalizedCode, id);
  }
  return id;
}

/**
 * Persist section(s) into the database using the Singleton DB pool.
 * Upserts each section's seats_available, capacity, enrolled_count, schedule, and room.
 *
 * @param {Object|Array<Object>} sections - Single section row or array of rows
 * @param {{ dbPool?: any, term?: string }} [opts]
 * @returns {Promise<Array<Object>>} Array of persisted section records (including generated UUIDs)
 */
export async function persist(sections, { dbPool, term = 'Fall 2026' } = {}) {
  const pool = dbPool || getDefaultDbPool();
  const items = Array.isArray(sections) ? sections : [sections];
  const persisted = [];

  for (const row of items) {
    const courseCode = (row.courseCode || row.course_code || '').trim().toUpperCase();
    const sectionNumber = Number(row.sectionNumber ?? row.section_number);
    const courseId = row.courseId || row.course_id || (await resolveCourseId(pool, courseCode));

    if (!courseId) {
      console.warn(`[SeatSync:persist] Course not found in catalog, skipping: ${courseCode}`);
      continue;
    }

    const faculty = row.faculty ?? row.faculty_name ?? 'TBA';
    const days = row.days ?? row.day_of_week ?? 'ST';
    const startTime = row.startTime ?? row.start_time ?? '08:00:00';
    const endTime = row.endTime ?? row.end_time ?? '09:30:00';
    const room = row.room ?? 'TBA';
    const seatsAvailable = Math.max(0, Number(row.seatsAvailable ?? row.seats_available ?? 0));
    const capacity = Number(row.capacity) || DEFAULT_CAPACITY;
    const enrolled = Math.max(0, Math.min(capacity, capacity - seatsAvailable));
    const rowTerm = row.term || term;

    const upsertQuery = `
      INSERT INTO sections
        (course_id, course_code, section_number, faculty_name, day_of_week,
         start_time, end_time, room, seats_available, capacity,
         enrolled_count, term)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        course_code     = EXCLUDED.course_code
      RETURNING
        id, course_id, course_code, section_number, seats_available,
        capacity, enrolled_count, term, room, day_of_week,
        start_time, end_time, faculty_name;
    `;

    const res = await pool.query(upsertQuery, [
      courseId,
      courseCode,
      sectionNumber,
      faculty,
      days,
      startTime,
      endTime,
      room,
      seatsAvailable,
      capacity,
      enrolled,
      rowTerm,
    ]);

    if (res.rows.length > 0) {
      persisted.push(res.rows[0]);
    }
  }

  return persisted;
}

/**
 * Publish changed section(s) to WebSocket subscribers via SeatAvailabilityPublisher.
 * Dispatches real-time SEAT_UPDATE events.
 *
 * @param {Object|Array<Object>} sections - Single section row or array of rows
 * @param {{ publisher?: any }} [opts]
 * @returns {number} Number of published events
 */
export function publish(sections, { publisher } = {}) {
  const pub = publisher || getDefaultPublisher();
  if (!pub) {
    console.warn('[SeatSync:publish] No publisher available to broadcast events.');
    return 0;
  }

  const items = Array.isArray(sections) ? sections : [sections];
  let notifiedCount = 0;

  for (const item of items) {
    const payload = {
      sectionId:      item.id || item.sectionId,
      courseCode:     item.course_code || item.courseCode,
      sectionNumber:  Number(item.section_number ?? item.sectionNumber),
      seatsAvailable: Number(item.seats_available ?? item.seatsAvailable ?? 0),
      capacity:       Number(item.capacity || DEFAULT_CAPACITY),
      enrolledCount:  Number(item.enrolled_count ?? item.enrolledCount ?? 0),
      term:           item.term,
      room:           item.room,
      dayOfWeek:      item.day_of_week || item.days,
      startTime:      item.start_time || item.startTime,
      endTime:        item.end_time || item.endTime,
      facultyName:    item.faculty_name || item.faculty
    };

    if (typeof pub.notify === 'function') {
      pub.notify(payload);
      notifiedCount += 1;
    } else if (typeof pub.notifySeatUpdate === 'function') {
      pub.notifySeatUpdate(payload);
      notifiedCount += 1;
    } else if (typeof pub.emit === 'function') {
      pub.emit('seat:available', payload);
      notifiedCount += 1;
    }
  }

  return notifiedCount;
}

// ─── types (JSDoc) ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} SyncResult
 * @property {number}   fetched   - Raw rows returned by the scraper or fixture
 * @property {number}   upserted  - Rows written/updated in the DB
 * @property {number}   notified  - Observer events emitted
 * @property {Date}     syncedAt  - Timestamp of this sync
 * @property {string[]} errors    - Non-fatal per-row error messages
 */

// ─── internal state ──────────────────────────────────────────────────────────

let _timer   = null;
let _running = false;

// ─── core sync ───────────────────────────────────────────────────────────────

/**
 * Execute one sync cycle.
 *
 * @param {{ dbPool?: any, publisher?: any, term?: string }} opts
 * @returns {Promise<SyncResult>}
 */
export async function runOnce({ dbPool, publisher, term } = {}) {
  const pool = dbPool || getDefaultDbPool();
  const pub = publisher || getDefaultPublisher();
  const targetTerm = term || process.env.SYNC_TERM || 'Fall 2026';

  const result = {
    fetched:  0,
    upserted: 0,
    notified: 0,
    syncedAt: new Date(),
    errors:   [],
  };

  const isDemoMode = process.env.DEMO_MODE === 'true';
  let rows = [];

  if (isDemoMode) {
    console.log('[SeatSync] DEMO_MODE active: loading offered courses from local snapshot fixture...');
    try {
      rows = loadSnapshotFixture();
      result.fetched = rows.length;
      console.log(`[SeatSync] Loaded ${rows.length} section(s) from snapshot fixture.`);
    } catch (err) {
      const msg = `[SeatSync] Fixture read failed: ${err.message}`;
      console.error(msg);
      result.errors.push(msg);
      return result;
    }
  } else {
    try {
      console.log('[SeatSync] Fetching offered courses from RDS4...');
      rows = await fetchNormalizedCourses();
      result.fetched = rows.length;
      console.log(`[SeatSync] Fetched ${rows.length} section(s) from RDS4.`);
    } catch (err) {
      const msg = `[SeatSync] Scrape failed: ${err.message}`;
      console.error(msg);
      result.errors.push(msg);
      return result;
    }
  }

  // Filter sections whose seat availability has changed since last sync cycle
  const changedRows = [];
  for (const row of rows) {
    const courseCode = (row.courseCode || '').trim().toUpperCase();
    const sectionNumber = Number(row.sectionNumber);
    const key = `${targetTerm}:${courseCode}:${sectionNumber}`;
    const previousSeats = _seatCache.get(key);

    if (previousSeats === undefined || previousSeats !== row.seatsAvailable) {
      changedRows.push({ row, key });
    }
  }

  if (changedRows.length === 0) {
    console.log('[SeatSync] No seat count changes detected in this cycle.');
    return result;
  }

  console.log(`[SeatSync] Detected ${changedRows.length} changed section(s) to persist and publish.`);

  for (const { row, key } of changedRows) {
    try {
      // ── Persist row to sections table via dbPool ─────────────────────────
      const persistedRows = await persist(row, { dbPool: pool, term: targetTerm });

      if (persistedRows.length > 0) {
        result.upserted += persistedRows.length;

        // ── Notify Observer fans out to WebSocket subscribers ──────────────
        const notified = publish(persistedRows, { publisher: pub });
        result.notified += notified;

        // Update in-memory cache upon successful persist & publish
        _seatCache.set(key, row.seatsAvailable);
      }
    } catch (rowErr) {
      result.errors.push(
        `[SeatSync] Row error (${row.courseCode} §${row.sectionNumber}): ${rowErr.message}`
      );
    }
  }

  console.log(
    `[SeatSync] Sync complete — fetched: ${result.fetched}, ` +
    `upserted: ${result.upserted}, notified: ${result.notified}, ` +
    `errors: ${result.errors.length}`
  );

  return result;
}

// ─── periodic loop control ───────────────────────────────────────────────────

/**
 * Start the periodic sync loop.
 *
 * @param {{
 *   dbPool?:       any,
 *   publisher?:    any,
 *   term?:         string,
 *   intervalMs?:   number
 * }} opts
 */
export function start({ dbPool, publisher, term, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (_running) {
    console.warn('[SeatSync] Loop already running — ignoring duplicate start().');
    return;
  }
  _running = true;
  console.log(`[SeatSync] Starting sync loop (interval: ${intervalMs / 1000}s).`);

  // Run immediately on start, then on schedule
  runOnce({ dbPool, publisher, term }).catch((err) =>
    console.error('[SeatSync] Unhandled error in initial run:', err.message)
  );

  _timer = setInterval(() => {
    runOnce({ dbPool, publisher, term }).catch((err) =>
      console.error('[SeatSync] Unhandled error in scheduled run:', err.message)
    );
  }, intervalMs);
}

/**
 * Stop the periodic sync loop gracefully.
 */
export function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _running = false;
  console.log('[SeatSync] Loop stopped.');
}
