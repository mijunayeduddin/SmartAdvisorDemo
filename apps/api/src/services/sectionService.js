const { query } = require('../db/pool');
const { getCache, setCache } = require('../cache/redisClient');

const DAY_NAME_MAP = {
  sunday: 'S',
  sun: 'S',
  monday: 'M',
  mon: 'M',
  tuesday: 'T',
  tue: 'T',
  wednesday: 'W',
  wed: 'W',
  thursday: 'R',
  thu: 'R',
  friday: 'F',
  fri: 'F',
  saturday: 'A',
  sat: 'A',
};

const ALLOWED_SORT_COLUMNS = {
  course: 'course',
  section: 'section',
  faculty: 'faculty',
  time: 'start_time',
  room: 'room',
  seats: 'seats',
};

function buildWhereClause(filters) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Search query (multi-word: every word must match case-insensitively)
  if (filters.q && typeof filters.q === 'string' && filters.q.trim()) {
    const words = filters.q.trim().split(/\s+/).filter(Boolean);
    for (const word of words) {
      const wordPattern = `%${word}%`;
      const wordParamIdx = paramIndex++;
      params.push(wordPattern);

      const dayCode = DAY_NAME_MAP[word.toLowerCase()];
      if (dayCode) {
        conditions.push(`(
          course ILIKE $${wordParamIdx} OR
          faculty ILIKE $${wordParamIdx} OR
          room ILIKE $${wordParamIdx} OR
          time_raw ILIKE $${wordParamIdx} OR
          days LIKE '%${dayCode}%'
        )`);
      } else {
        conditions.push(`(
          course ILIKE $${wordParamIdx} OR
          faculty ILIKE $${wordParamIdx} OR
          room ILIKE $${wordParamIdx} OR
          time_raw ILIKE $${wordParamIdx}
        )`);
      }
    }
  }

  // Department filter
  if (filters.dept && typeof filters.dept === 'string' && filters.dept.trim()) {
    const deptIdx = paramIndex++;
    params.push(filters.dept.trim().toUpperCase());
    conditions.push(`department = $${deptIdx}`);
  }

  // Day filter
  if (filters.day && typeof filters.day === 'string' && filters.day.trim()) {
    const dayIdx = paramIndex++;
    params.push(`%${filters.day.trim().toUpperCase()}%`);
    conditions.push(`days LIKE $${dayIdx}`);
  }

  // Open seats only
  if (filters.openOnly === true || filters.openOnly === 'true' || filters.openOnly === '1' || filters.openOnly === 1) {
    conditions.push(`seats > 0`);
  }

  // Faculty filter
  if (filters.faculty && typeof filters.faculty === 'string' && filters.faculty.trim()) {
    const facultyIdx = paramIndex++;
    params.push(`%${filters.faculty.trim()}%`);
    conditions.push(`faculty ILIKE $${facultyIdx}`);
  }

  // Eligible courses filter (curriculum progress tracker)
  if (filters.eligibleCodes !== null && filters.eligibleCodes !== undefined) {
    if (filters.eligibleCodes.size === 0) {
      conditions.push('1 = 0');
    } else {
      const matchPatterns = new Set();
      for (const code of filters.eligibleCodes) {
        matchPatterns.add(code);
        matchPatterns.add(code.replace(/([A-Z]{3})(\d+.*)/, '$1 $2'));
      }
      const patternArray = Array.from(matchPatterns);
      const placeholders = patternArray.map(() => `$${paramIndex++}`).join(', ');
      params.push(...patternArray);
      conditions.push(`course IN (${placeholders})`);
    }
  }

  const whereString = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereString, params, nextParamIndex: paramIndex };
}

async function getSections(queryParams) {
  const page = Math.max(1, parseInt(queryParams.page || '1', 10) || 1);
  const requestedLimit = parseInt(queryParams.limit || '50', 10) || 50;
  const limit = Math.min(200, Math.max(1, requestedLimit));
  const offset = (page - 1) * limit;

  const sortKey = (queryParams.sort || 'course').toLowerCase();
  const sortCol = ALLOWED_SORT_COLUMNS[sortKey] || 'course';
  const order = (queryParams.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const isEligibleOnly =
    queryParams.eligibleOnly === true ||
    queryParams.eligibleOnly === 'true' ||
    queryParams.eligibleOnly === '1' ||
    queryParams.eligibleOnly === 1;

  const program = (queryParams.program || 'CSE').trim().toUpperCase();

  let completedList = [];
  if (isEligibleOnly) {
    if (Array.isArray(queryParams.completed)) {
      completedList = queryParams.completed;
    } else if (typeof queryParams.completed === 'string' && queryParams.completed.trim()) {
      completedList = queryParams.completed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  let waivedList = [];
  if (isEligibleOnly) {
    if (Array.isArray(queryParams.waived)) {
      waivedList = queryParams.waived;
    } else if (typeof queryParams.waived === 'string' && queryParams.waived.trim()) {
      waivedList = queryParams.waived.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  const completedKeyStr = Array.isArray(queryParams.completed)
    ? queryParams.completed.slice().sort().join(',')
    : (queryParams.completed || '').trim();

  const waivedKeyStr = Array.isArray(queryParams.waived)
    ? queryParams.waived.slice().sort().join(',')
    : (queryParams.waived || '').trim();

  // Redis cache key construction
  const cacheKey = `sections:${JSON.stringify({
    program,
    q: (queryParams.q || '').trim(),
    dept: (queryParams.dept || '').trim().toUpperCase(),
    day: (queryParams.day || '').trim().toUpperCase(),
    openOnly: queryParams.openOnly === true || queryParams.openOnly === 'true' || queryParams.openOnly === '1',
    faculty: (queryParams.faculty || '').trim(),
    sort: sortKey,
    order: order.toLowerCase(),
    page,
    limit,
    eligibleOnly: isEligibleOnly,
    completed: completedKeyStr,
    waived: waivedKeyStr,
  })}`;

  const cachedResult = await getCache(cacheKey);
  if (cachedResult) {
    return { ...cachedResult, fromCache: true };
  }

  let eligibleCodes = null;
  if (isEligibleOnly) {
    const { getEligibleCourseCodes } = require('./curriculumService');
    eligibleCodes = await getEligibleCourseCodes(completedList, waivedList, program);
  }

  const { whereString, params, nextParamIndex } = buildWhereClause({
    q: queryParams.q,
    dept: queryParams.dept,
    day: queryParams.day,
    openOnly: queryParams.openOnly,
    faculty: queryParams.faculty,
    eligibleCodes,
  });

  const countSql = `
    SELECT 
      COUNT(*)::int AS total,
      COALESCE(SUM(seats), 0)::int AS total_open_seats
    FROM sections
    ${whereString}
  `;

  let orderByClause = '';
  if (sortKey === 'time') {
    orderByClause = `ORDER BY start_time ${order} NULLS LAST, end_time ${order} NULLS LAST, id ASC`;
  } else {
    orderByClause = `ORDER BY ${sortCol} ${order} NULLS LAST, id ASC`;
  }

  const itemsSql = `
    SELECT 
      id,
      course,
      department,
      section,
      faculty,
      time_raw,
      days,
      start_time,
      end_time,
      room,
      seats,
      semester,
      prediction,
      records
    FROM sections
    ${whereString}
    ${orderByClause}
    LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
  `;

  const itemsParams = [...params, limit, offset];

  const [countResult, itemsResult] = await Promise.all([
    query(countSql, params),
    query(itemsSql, itemsParams),
  ]);

  const total = countResult.rows[0]?.total || 0;
  const totalOpenSeats = countResult.rows[0]?.total_open_seats || 0;
  const items = itemsResult.rows || [];

  const responsePayload = {
    items,
    total,
    totalOpenSeats,
    page,
    limit,
  };

  // Cache in Redis for 60 seconds
  await setCache(cacheKey, responsePayload, 60);

  return { ...responsePayload, fromCache: false };
}

module.exports = {
  getSections,
  buildWhereClause,
  ALLOWED_SORT_COLUMNS,
  DAY_NAME_MAP,
};
