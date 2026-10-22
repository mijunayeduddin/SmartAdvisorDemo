const { query } = require('../db/pool');
const { checkRedisHealth } = require('../cache/redisClient');

async function getHealth() {
  let postgresStatus = 'down';
  try {
    const res = await Promise.race([
      query('SELECT 1 AS alive'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Postgres timeout')), 2000)),
    ]);
    if (res && res.rows && res.rows.length > 0) {
      postgresStatus = 'ok';
    }
  } catch (err) {
    postgresStatus = 'down';
  }

  const redisStatus = await checkRedisHealth();
  const apiStatus = 'ok';

  let overallStatus = 'ok';
  if (postgresStatus !== 'ok') {
    overallStatus = 'down';
  } else if (redisStatus !== 'ok') {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    api: apiStatus,
    postgres: postgresStatus,
    redis: redisStatus,
  };
}

module.exports = {
  getHealth,
};
