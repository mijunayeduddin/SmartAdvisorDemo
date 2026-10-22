const { query } = require('../db/pool');
const { getCache, setCache } = require('../cache/redisClient');

async function getMeta() {
  const cacheKey = 'meta:overview';
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached;
  }

  const deptsSql = `SELECT DISTINCT department FROM sections WHERE department IS NOT NULL ORDER BY department ASC`;
  const countsSql = `SELECT COUNT(*)::int AS total_sections, COUNT(DISTINCT course)::int AS total_courses FROM sections`;

  const [deptsResult, countsResult] = await Promise.all([
    query(deptsSql),
    query(countsSql),
  ]);

  const departments = deptsResult.rows.map((r) => r.department);
  const totalSections = countsResult.rows[0]?.total_sections || 0;
  const totalCourses = countsResult.rows[0]?.total_courses || 0;

  const result = {
    departments,
    totalSections,
    totalCourses,
  };

  await setCache(cacheKey, result, 300); // 5 min cache for meta
  return result;
}

module.exports = {
  getMeta,
};
