/**
 * scripts/scrape_courses.mjs
 *
 * Scrapes NSU RDS4's public "offered_courses" page and returns a normalised
 * array of section rows.
 *
 * Output shape per row:
 *   {
 *     courseCode:      string,   // e.g. "CSE115"
 *     sectionNumber:   number,   // e.g. 1
 *     faculty:         string,   // e.g. "Shamim H Ripon"
 *     days:            string,   // e.g. "ST"
 *     startTime:       string,   // e.g. "08:30:00"
 *     endTime:         string,   // e.g. "10:00:00"
 *     room:            string,   // e.g. "SAC 512"
 *     seatsAvailable:  number,   // e.g. 5
 *   }
 *
 * Architecture note: this module has ZERO knowledge of Express or PostgreSQL.
 * It is a pure data-fetching utility.
 */

import { JSDOM } from 'jsdom';

const OFFERED_COURSES_URL =
  process.env.RDS4_URL || 'https://rds4.northsouth.edu/offered_courses';

const FETCH_TIMEOUT_MS = 15_000;

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Normalise a raw time string from RDS4 to HH:MM:SS.
 *   "8:30 AM"  → "08:30:00"
 *   "10:00 PM" → "22:00:00"
 *   "08:30"    → "08:30:00"
 */
function normaliseTime(raw) {
  if (!raw) return null;
  raw = raw.trim();

  // "HH:MM AM/PM" format
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2];
    const meridiem = ampmMatch[3].toUpperCase();
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}:00`;
  }

  // "HH:MM" 24-hour format
  const hhmm = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}:00`;
  }

  return null;
}

/**
 * Map RDS4 day strings to our canonical codes.
 *   "Sunday-Tuesday"   → "ST"
 *   "Monday-Wednesday" → "MW"
 *   "Thursday-Saturday"→ "RA"   (Ra = Thursday in Bangla notation used at NSU)
 *   Already-coded values pass through unchanged.
 */
function normaliseDays(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();

  if (cleaned.includes('sun') || cleaned.includes('tue') || cleaned === 'st') return 'ST';
  if (cleaned.includes('mon') || cleaned.includes('wed') || cleaned === 'mw') return 'MW';
  if (cleaned.includes('thu') || cleaned.includes('sat') || cleaned === 'ra') return 'RA';

  // Return upper-cased raw value as fallback
  return raw.trim().toUpperCase();
}

/**
 * Parse the integer seats-available value.
 * Handles "5", "5 / 35", "Closed", "Waitlist" etc.
 */
function normaliseSeats(raw) {
  if (!raw) return 0;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'closed' || trimmed === 'waitlist' || trimmed === '') return 0;

  // "5 / 35" → take the first number
  const match = trimmed.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Normalise course code — strip extra whitespace, uppercase.
 */
function normaliseCourseCode(raw) {
  if (!raw) return null;
  // Remove spaces within code: "CSE 115" → "CSE115"
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

// ─── main scraper ────────────────────────────────────────────────────────────

/**
 * Fetch and parse the RDS4 offered-courses HTML page.
 *
 * @returns {Promise<Array<{
 *   courseCode: string,
 *   sectionNumber: number,
 *   faculty: string,
 *   days: string,
 *   startTime: string,
 *   endTime: string,
 *   room: string,
 *   seatsAvailable: number
 * }>>}
 */
export async function fetchNormalizedCourses() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html;
  try {
    const response = await fetch(OFFERED_COURSES_URL, {
      signal: controller.signal,
      headers: {
        // Identify as a browser to avoid bot-detection 403s
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} from ${OFFERED_COURSES_URL}`);
    }

    html = await response.text();
  } finally {
    clearTimeout(timer);
  }

  return parseOfferedCoursesHtml(html);
}

/**
 * Parse the raw HTML and return normalised rows.
 * Exported separately so it can be unit-tested without network access.
 *
 * RDS4 renders a standard Bootstrap table with columns:
 *   Course | Section | Faculty | Days | Time | Room | Seats
 *
 * @param {string} html
 * @returns {Array<Object>}
 */
export function parseOfferedCoursesHtml(html) {
  const { window } = new JSDOM(html);
  const { document } = window;

  const rows = [];

  // The page may have multiple tables (one per department); iterate all.
  const tables = document.querySelectorAll('table');

  for (const table of tables) {
    const tbodyRows = table.querySelectorAll('tbody tr');

    for (const tr of tbodyRows) {
      const cells = tr.querySelectorAll('td');
      if (cells.length < 7) continue; // skip header-rows or malformed rows

      const rawCode    = cells[0]?.textContent ?? '';
      const rawSection = cells[1]?.textContent ?? '';
      const rawFaculty = cells[2]?.textContent ?? '';
      const rawDays    = cells[3]?.textContent ?? '';
      const rawTime    = cells[4]?.textContent ?? '';
      const rawRoom    = cells[5]?.textContent ?? '';
      const rawSeats   = cells[6]?.textContent ?? '';

      const courseCode = normaliseCourseCode(rawCode);
      if (!courseCode) continue;

      // Parse time range "08:30 AM - 10:00 AM" or "8:30-10:00"
      const timeParts = rawTime.split(/[-–]/);
      const startTime = normaliseTime(timeParts[0]);
      const endTime   = normaliseTime(timeParts[1]);

      rows.push({
        courseCode,
        sectionNumber:  parseInt(rawSection.trim(), 10) || 1,
        faculty:        rawFaculty.trim() || 'TBA',
        days:           normaliseDays(rawDays),
        startTime,
        endTime,
        room:           rawRoom.trim() || 'TBA',
        seatsAvailable: normaliseSeats(rawSeats),
      });
    }
  }

  return rows;
}
