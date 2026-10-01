const { Pool } = require('pg');
const config = require('../../config/env');

/**
 * Singleton Pattern: Database Connection Pool
 * Ensures exactly one shared connection pool is created and reused throughout the application.
 */
class DatabasePool {
  constructor() {
    if (DatabasePool.instance) {
      return DatabasePool.instance;
    }

    this.pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      max: config.db.max,
      idleTimeoutMillis: config.db.idleTimeoutMillis,
      connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    });

    this.pool.on('error', (err) => {
      console.error('[DBPool] Unexpected idle client error:', err.message);
    });

    DatabasePool.instance = this;
  }

  /**
   * Execute a SQL query using a pooled connection
   * @param {string} text - SQL statement
   * @param {Array} [params] - Query parameters
   * @returns {Promise<import('pg').QueryResult>}
   */
  async query(text, params) {
    return this.pool.query(text, params);
  }

  /**
   * Acquire a dedicated client for multi-statement transactions
   * @returns {Promise<import('pg').PoolClient>}
   */
  async getClient() {
    return this.pool.connect();
  }

  /**
   * Test pool connectivity
   * @returns {Promise<boolean>}
   */
  async ping() {
    try {
      const res = await this.pool.query('SELECT 1 AS health');
      return res.rows[0].health === 1;
    } catch (err) {
      return false;
    }
  }

  /**
   * Graceful pool shutdown
   */
  async close() {
    await this.pool.end();
  }
}

// Export a single instance (Singleton)
const instance = new DatabasePool();
Object.freeze(instance);

module.exports = instance;
