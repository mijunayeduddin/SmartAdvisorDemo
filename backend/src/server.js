const http = require('http');
const app = require('./app');
const config = require('./config/env');
const socketManager = require('./websocket/socketManager');
const dbPool = require('./patterns/singleton/dbPool');

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server (Observer Pattern endpoint for Web & Mobile)
socketManager.initialize(server);

// Start listening
server.listen(config.port, async () => {
  console.log('====================================================');
  console.log(`🚀 SmartAdvisor Backend Server started`);
  console.log(`📡 HTTP Server running at http://localhost:${config.port}`);
  console.log(`🔌 WebSockets listening at ws://localhost:${config.port}${config.ws.path}`);
  console.log(`🩺 Health check: http://localhost:${config.port}/api/health`);
  console.log(`📦 Node Environment: ${config.env}`);
  console.log(`🔀 Demo Mode: ${config.sync.demoMode ? 'ON (Static Fixture)' : 'OFF (Live RDS4)'}`);
  console.log('====================================================');

  // Verify DB pool connectivity before starting sync loop
  const dbOk = await dbPool.ping();
  if (dbOk) {
    console.log('🗄️  Database connection verified (Singleton pool ready)');
  } else {
    console.warn('⚠️  Database ping failed — check PostgreSQL service');
  }

  // Import and start seatSyncService once after DB pool and WebSockets are ready
  try {
    const { seatAvailabilityPublisher } = require('../core/observer.ts');
    const { start: startSeatSync } = await import('../services/seatSyncService.mjs');
    startSeatSync({
      dbPool,
      publisher: seatAvailabilityPublisher,
      term: config.sync.term,
      intervalMs: config.sync.intervalMs,
    });
  } catch (syncErr) {
    console.error('[Server] Failed to initialize SeatSyncService:', syncErr.message);
  }
});

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log('[Server] HTTP and WebSocket server closed.');
    try {
      const { stop: stopSeatSync } = await import('../services/seatSyncService.mjs');
      stopSeatSync();
    } catch (e) {
      // Ignore if seatSyncService wasn't loaded
    }
    try {
      await dbPool.close();
      console.log('[Server] Database pool connections drained.');
    } catch (err) {
      console.error('[Server] Error closing DB pool:', err.message);
    }
    process.exit(0);
  });

  // Force shutdown if taking longer than 10s
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
