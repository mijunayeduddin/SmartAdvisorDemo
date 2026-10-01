const fs = require('fs');
const path = require('path');
const dbPool = require('../patterns/singleton/dbPool');

/**
 * Lightweight, zero-ORM Migration Runner
 * Reads SQL migration files sequentially and applies unapplied migrations.
 */
async function runMigrations() {
  console.log('🔄 [Migration Runner] Starting database migrations...');

  const client = await dbPool.getClient();

  try {
    await client.query('BEGIN');

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch list of already executed migrations
    const { rows: appliedRows } = await client.query(
      'SELECT filename FROM schema_migrations ORDER BY id ASC'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.filename));

    // 3. Scan migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    let appliedCount = 0;

    for (const file of files) {
      if (!appliedSet.has(file)) {
        console.log(`⏳ Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Execute migration
        await client.query(sql);

        // Record migration
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        console.log(`✅ Applied: ${file}`);
        appliedCount += 1;
      } else {
        console.log(`⏩ Skipping already applied: ${file}`);
      }
    }

    await client.query('COMMIT');

    if (appliedCount === 0) {
      console.log('✨ [Migration Runner] Database is already up to date.');
    } else {
      console.log(`🎉 [Migration Runner] Successfully applied ${appliedCount} migration(s).`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [Migration Runner Error] Migration failed and rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await dbPool.close();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
