const { Pool } = require('pg');
require('dotenv').config();

let currentPool = null;

function createDefaultPool() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    return new Pool({ connectionString });
  }

  return new Pool({
    user: process.env.POSTGRES_USER || 'smartadvisor',
    password: process.env.POSTGRES_PASSWORD || 'smartadvisor_secret',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'smartadvisor_db',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

function getPool() {
  if (!currentPool) {
    currentPool = createDefaultPool();
    currentPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
    });
  }
  return currentPool;
}

function setPool(customPool) {
  currentPool = customPool;
}

async function query(text, params) {
  const pool = getPool();
  return pool.query(text, params);
}

module.exports = {
  getPool,
  setPool,
  query,
};
